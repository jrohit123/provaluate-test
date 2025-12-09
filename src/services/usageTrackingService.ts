import { supabase } from '@/integrations/supabase/client';

export interface CompanyUsageInfo {
  canProcessCV: boolean;
  currentCVCount: number;
  maxCVs: number;
  remainingCVs: number;
  planName: string;
  resetDate: string;
}

export interface PaymentInfo {
  id: string;
  company_id: string;
  plan_id: string;
  payment_amount: number;
  currency: string;
  payment_status: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  payment_date?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  billing_cycle?: string;
  metadata?: any;
}

export class UsageTrackingService {
  /**
   * Check if a company can process more CVs based on their plan limits
   */
  static async checkCVProcessingLimit(companyId: string): Promise<CompanyUsageInfo> {
    try {
      // 1) Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('company_id, selected_plan, cv_processed_count, cv_processing_reset_date')
        .eq('company_id', companyId)
        .single();

      if (companyError) {
        console.error('Error fetching company data:', companyError);
        throw new Error('Failed to fetch company information');
      }

      if (!companyData) {
        throw new Error('Company not found');
      }

      // 2) Fetch plan info separately (selected_plan stores plan name, not FK)
      let maxCVs = 0;
      let planName = 'No Plan';

      if (companyData.selected_plan) {
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('plan_name, max_cvs')
          .eq('plan_name', companyData.selected_plan)
          .single();

        if (planError) {
          console.warn('Could not fetch plan data:', planError);
        } else if (planData) {
          maxCVs = planData.max_cvs ?? 0;
          planName = planData.plan_name ?? companyData.selected_plan;
        }
      }

      const currentCount = companyData.cv_processed_count || 0;
      const canProcess = maxCVs === 0 || currentCount < maxCVs; // 0 means unlimited
      const remaining = maxCVs === 0 ? -1 : Math.max(0, maxCVs - currentCount); // -1 means unlimited

      return {
        canProcessCV: canProcess,
        currentCVCount: currentCount,
        maxCVs,
        remainingCVs: remaining,
        planName,
        resetDate: companyData.cv_processing_reset_date || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error checking CV processing limit:', error);
      throw error;
    }
  }

  /**
   * Increment CV processing count for a company
   */
  static async incrementCVCount(companyId: string, metadata?: any): Promise<void> {
    try {
      const resumeCount = metadata?.resume_count ?? 1;

      // Use the database function to increment count and track usage
      const { error } = await supabase.rpc('increment_cv_count', {
        company_uuid: companyId,
        resume_count: resumeCount
      });

      if (error) {
        console.error('Error incrementing CV count:', error);
        throw new Error('Failed to increment CV processing count');
      }

      // Also insert detailed usage tracking
      await supabase
        .from('company_usage_tracking')
        .insert({
          company_id: companyId,
          usage_type: 'cv_processing',
          usage_count: resumeCount,
          metadata: metadata || null
        });

    } catch (error) {
      console.error('Error incrementing CV count:', error);
      throw error;
    }
  }

  /**
   * Get company's usage history
   */
  static async getCompanyUsageHistory(companyId: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('company_usage_tracking')
        .select('*')
        .eq('company_id', companyId)
        .order('usage_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching usage history:', error);
        throw new Error('Failed to fetch usage history');
      }

      return data || [];
    } catch (error) {
      console.error('Error getting usage history:', error);
      throw error;
    }
  }

  /**
   * Record a successful payment
   */
  static async recordPayment(paymentData: {
    company_id: string;
    plan_id: string;
    payment_amount: number;
    currency: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    subscription_start_date: string;
    subscription_end_date: string;
    billing_cycle?: string;
    metadata?: any;
  }): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('subscription_payments')
        .insert({
          company_id: paymentData.company_id,
          plan_id: paymentData.plan_id,
          payment_amount: paymentData.payment_amount,
          currency: paymentData.currency,
          payment_status: 'completed',
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          payment_date: new Date().toISOString(),
          subscription_start_date: paymentData.subscription_start_date,
          subscription_end_date: paymentData.subscription_end_date,
          billing_cycle: paymentData.billing_cycle || 'monthly',
          metadata: paymentData.metadata || null
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error recording payment:', error);
        throw new Error('Failed to record payment');
      }

      // Update company's subscription info
      await supabase
        .from('companies')
        .update({
          selected_plan: paymentData.plan_id,
          subscription_status: 'active',
          subscription_start: paymentData.subscription_start_date,
          subscription_end: paymentData.subscription_end_date,
          cv_processed_count: 0, // Reset CV count on new subscription
          cv_processing_reset_date: new Date().toISOString()
        })
        .eq('company_id', paymentData.company_id);

      // Record in subscription history
      await supabase
        .from('subscription_history')
        .insert({
          company_id: paymentData.company_id,
          plan_id: paymentData.plan_id,
          action_type: 'renewal',
          effective_date: paymentData.subscription_start_date,
          end_date: paymentData.subscription_end_date,
          reason: 'Payment completed successfully'
        });

      return data.id;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Get company's payment history
   */
  static async getPaymentHistory(companyId: string, limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select(`
          *,
          plans!inner(
            plan_name,
            plan_cost
          )
        `)
        .eq('company_id', companyId)
        .order('payment_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching payment history:', error);
        throw new Error('Failed to fetch payment history');
      }

      return data || [];
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }

  /**
   * Get company's subscription history
   */
  static async getSubscriptionHistory(companyId: string, limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('subscription_history')
        .select(`
          *,
          plans!inner(
            plan_name,
            plan_cost
          ),
          previous_plan:plans!subscription_history_previous_plan_id_fkey(
            plan_name,
            plan_cost
          )
        `)
        .eq('company_id', companyId)
        .order('effective_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching subscription history:', error);
        throw new Error('Failed to fetch subscription history');
      }

      return data || [];
    } catch (error) {
      console.error('Error getting subscription history:', error);
      throw error;
    }
  }

  /**
   * Reset monthly CV count (should be called by a cron job)
   */
  static async resetMonthlyCVCount(): Promise<void> {
    try {
      const { error } = await supabase.rpc('reset_monthly_cv_count');
      
      if (error) {
        console.error('Error resetting monthly CV count:', error);
        throw new Error('Failed to reset monthly CV count');
      }
    } catch (error) {
      console.error('Error resetting monthly CV count:', error);
      throw error;
    }
  }

  /**
   * Check if a company's subscription has expired and needs renewal
   */
  static async checkSubscriptionExpiry(companyId: string): Promise<{
    isExpired: boolean;
    daysUntilExpiry: number;
    company?: any;
  }> {
    try {
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error) {
        console.error('Error fetching company subscription data:', error);
        throw error;
      }

      if (!companyData?.subscription_end) {
        return { isExpired: false, daysUntilExpiry: -1 };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const expiryDate = new Date(companyData.subscription_end);
      expiryDate.setHours(0, 0, 0, 0);
      
      const timeDifference = expiryDate.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(timeDifference / (1000 * 3600 * 24));
      
      const isExpired = daysUntilExpiry <= 0;

      return {
        isExpired,
        daysUntilExpiry,
        company: companyData
      };
    } catch (error) {
      console.error('Error checking subscription expiry:', error);
      throw error;
    }
  }

  /**
   * Get companies that have expired subscriptions
   */
  static async getExpiredSubscriptions() {
    try {
      const today = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('companies')
        .select(`
          company_id,
          company_name,
          selected_plan,
          subscription_end,
          plans!inner(
            plan_id,
            plan_name,
            plan_cost
          )
        `)
        .lte('subscription_end', today)
        .eq('subscription_status', 'active');

      if (error) {
        console.error('Error fetching expired subscriptions:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Process automatic renewal for expired subscription
   */
  static async processAutomaticRenewal(companyId: string): Promise<string> {
    try {
      // Fetch company and current plan
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          *,
          plans!inner(
            plan_id,
            plan_name,
            plan_cost
          )
        `)
        .eq('company_id', companyId)
        .single();

      if (companyError || !companyData) {
        throw new Error('Company not found');
      }

      const plan = companyData.plans;
      if (!plan) {
        throw new Error('Company plan not found');
      }

      // Calculate new subscription dates
      const subscriptionStartDate = new Date();
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

      // Create automatic renewal payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
          company_id: companyId,
          plan_id: plan.plan_id,
          payment_amount: plan.plan_cost,
          currency: 'INR',
          payment_status: 'pending',
          razorpay_order_id: null,
          razorpay_payment_id: null,
          razorpay_signature: null,
          payment_date: new Date().toISOString(),
          subscription_start_date: subscriptionStartDate.toISOString(),
          subscription_end_date: subscriptionEndDate.toISOString(),
          billing_cycle: 'monthly',
          metadata: {
            renewal_type: 'automatic',
            triggered_date: new Date().toISOString(),
            company_name: companyData.company_name,
            plan_name: plan.plan_name
          }
        })
        .select('id')
        .single();

      if (paymentError) {
        console.error('Error creating renewal payment record:', paymentError);
        throw new Error('Failed to create renewal payment record');
      }

      // Update company subscription status to 'pending_renewal'
      await supabase
        .from('companies')
        .update({
          subscription_status: 'pending_renewal',
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId);

      // Record in subscription history
      await supabase
        .from('subscription_history')
        .insert({
          company_id: companyId,
          plan_id: plan.plan_id,
          action_type: 'renewal',
          effective_date: subscriptionStartDate.toISOString(),
          end_date: subscriptionEndDate.toISOString(),
          reason: 'Automatic renewal triggered - subscription expired'
        });

      console.log(`✅ Automatic renewal initiated for company ${companyId}`);
      return paymentData.id;
    } catch (error) {
      console.error('Error processing automatic renewal:', error);
      throw error;
    }
  }

  /**
   * Complete automatic renewal after payment is made
   */
  static async completeAutomaticRenewal(companyId: string, paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<void> {
    try {
      // Get pending renewal payment record
      const { data: pendingPayment, error: fetchError } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('company_id', companyId)
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !pendingPayment) {
        throw new Error('Pending renewal payment not found');
      }

      // Update payment record with Razorpay details
      await supabase
        .from('subscription_payments')
        .update({
          payment_status: 'completed',
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          payment_date: new Date().toISOString()
        })
        .eq('id', pendingPayment.id);

      // Update company subscription status back to 'active'
      await supabase
        .from('companies')
        .update({
          subscription_status: 'active',
          subscription_start: pendingPayment.subscription_start_date,
          subscription_end: pendingPayment.subscription_end_date,
          cv_processed_count: 0,
          cv_processing_reset_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId);

      console.log(`✅ Automatic renewal completed for company ${companyId}`);
    } catch (error) {
      console.error('Error completing automatic renewal:', error);
      throw error;
    }
  }
}

