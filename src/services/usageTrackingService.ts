import { supabase } from '@/integrations/supabase/client';

export interface CompanyUsageInfo {
  canProcessCV: boolean;
  currentCVCount: number;
  maxCVs: number;
  remainingCVs: number;
  planName: string;
  resetDate: string;
  // ✅ NEW: Trial status fields
  isTrial?: boolean;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysRemaining?: number;
  cvsExhausted?: boolean;
  shouldForceUpgrade?: boolean;
  warningMessage?: string;
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

export interface JobDescriptionLimitInfo {
  canCreateJD: boolean;
  currentActiveJDCount: number;
  maxActiveJDs: number;
  remainingJDs: number;
  planName: string;
}

export interface InterviewLimitInfo {
  canStartInterview: boolean;
  currentInterviewCount: number;
  maxInterviews: number;
  remainingInterviews: number;
  planName: string;
  planType: string | null;
}

export class UsageTrackingService {
  /**
   * Check if a company can process more CVs based on their plan limits
   * ✅ UPDATED: Now also checks trial expiration
   */
  static async checkCVProcessingLimit(companyId: string): Promise<CompanyUsageInfo> {
    try {
      // 1) Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('company_id, selected_plan, plan_type, cv_processed_count, cv_processing_reset_date, subscription_status, subscription_end')
        .eq('company_id', companyId)
        .single();

      if (companyError) {
        console.error('Error fetching company data:', companyError);
        throw new Error('Failed to fetch company information');
      }

      if (!companyData) {
        throw new Error('Company not found');
      }

      // ✅ NEW: Check trial status via backend
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      let trialStatus = null;
      
      try {
        const trialResponse = await fetch(`${API_BASE_URL}/subscription/check-trial-status?company_id=${companyId}`);
        if (trialResponse.ok) {
          trialStatus = await trialResponse.json();
        }
      } catch (error) {
        console.warn('Could not fetch trial status:', error);
      }

      // 2) Fetch plan info separately (selected_plan stores plan name, not FK)
      let maxCVs = 0;
      let planName = 'No Plan';
      let planData: { plan_name?: string; max_cvs?: number; plan_cost?: number; plan_type?: string; max_interviews?: number | null } | null = null;

      if (companyData.selected_plan) {
        const { data: planRow, error: planError } = await supabase
          .from('plans')
          .select('plan_name, max_cvs, plan_cost, plan_type, max_interviews')
          .eq('plan_name', companyData.selected_plan)
          .eq('plan_type', companyData.plan_type || 'combo')
          .single();

        if (planError) {
          console.warn('Could not fetch plan data:', planError);
        } else if (planRow) {
          planData = planRow;
          maxCVs = planRow.max_cvs ?? 0;
          planName = planRow.plan_name ?? companyData.selected_plan;
        }
      }

      const currentCount = companyData.cv_processed_count || 0;
      
      // ✅ UPDATED: Check subscription status and trial expiration
      const subscriptionStatus = companyData.subscription_status || '';
      const isExpired = subscriptionStatus === 'expired' || (trialStatus?.is_expired ?? false);
      const isTrial = trialStatus?.is_trial ?? (planData != null ? (planData.plan_cost ?? 0) === 0 : false);

      // Effective plan type: null/missing → combo (same as free tier / full access)
      const planType = (companyData.plan_type || planData?.plan_type || 'combo').toLowerCase();

      // For interview-only plans, block CV processing entirely
      if (planType === 'interview') {
        return {
          canProcessCV: false,
          currentCVCount: currentCount,
          maxCVs: maxCVs,
          remainingCVs: 0,
          planName,
          resetDate: companyData.cv_processing_reset_date || new Date().toISOString(),
          isTrial,
          isExpired,
          isExpiringSoon: trialStatus?.is_expiring_soon ?? false,
          daysRemaining: trialStatus?.days_remaining ?? undefined,
          cvsExhausted: true,
          shouldForceUpgrade: true,
          warningMessage:
            trialStatus?.warning_message ??
            'Aapke plan mein CV screening shamil nahi hai. CV screening use karne ke liye CV ya Combo plan pe switch kijiye.'
        };
      }
      
      // Block processing if expired (for CV/combo)
      // Calculate available CVs: maxCVs - currentCount
      // Negative currentCount means bonus CVs (e.g., -18 = 18 bonus CVs)
      // Available = maxCVs - currentCount = 50 - (-18) = 68 CVs
      const availableCVs = maxCVs === 0 ? -1 : (maxCVs - currentCount);
      const canProcess = !isExpired && (maxCVs === 0 || availableCVs > 0);
      const remaining = availableCVs;

      return {
        canProcessCV: canProcess,
        currentCVCount: currentCount,
        maxCVs,
        remainingCVs: remaining,
        planName,
        resetDate: companyData.cv_processing_reset_date || new Date().toISOString(),
        // ✅ NEW: Trial status fields
        isTrial: isTrial,
        isExpired: isExpired,
        isExpiringSoon: trialStatus?.is_expiring_soon ?? false,
        daysRemaining: trialStatus?.days_remaining ?? undefined,
        cvsExhausted: trialStatus?.cvs_exhausted ?? (remaining <= 0),
        shouldForceUpgrade: trialStatus?.should_force_upgrade ?? (isExpired || (isTrial && remaining <= 0)),
        warningMessage: trialStatus?.warning_message ?? undefined
      };
    } catch (error) {
      console.error('Error checking CV processing limit:', error);
      throw error;
    }
  }

  /**
   * Check if a company can create more job descriptions based on their plan limits
   */
  static async checkJDProcessingLimit(companyId: string): Promise<JobDescriptionLimitInfo> {
    try {
      // 1) Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('company_id, selected_plan, plan_type')
        .eq('company_id', companyId)
        .single();

      if (companyError) {
        console.error('Error fetching company data:', companyError);
        throw new Error('Failed to fetch company information');
      }

      if (!companyData) {
        throw new Error('Company not found');
      }

      // 2) Fetch plan info
      let maxActiveJDs = 0;
      let planName = 'No Plan';

      if (companyData.selected_plan) {
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('plan_name, active_jobs, plan_type')
          .eq('plan_name', companyData.selected_plan)
          .eq('plan_type', companyData.plan_type || 'combo')
          .single();

        if (planError) {
          console.warn('Could not fetch plan data:', planError);
        } else if (planData) {
          maxActiveJDs = planData.active_jobs ?? 0;
          planName = planData.plan_name ?? companyData.selected_plan;
        }
      }

      // 3) Count active JDs for this company
      const { count: activeJDCount, error: countError } = await supabase
        .from('job_descriptions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active');

      if (countError) {
        console.error('Error counting active JDs:', countError);
        throw new Error('Failed to count active job descriptions');
      }

      const currentActiveJDCount = activeJDCount || 0;
      
      // Calculate remaining JDs
      // If maxActiveJDs is 0, it means unlimited
      const remainingJDs = maxActiveJDs === 0 ? -1 : (maxActiveJDs - currentActiveJDCount);
      const canCreateJD = maxActiveJDs === 0 || remainingJDs > 0;

      return {
        canCreateJD,
        currentActiveJDCount,
        maxActiveJDs,
        remainingJDs,
        planName
      };
    } catch (error) {
      console.error('Error checking JD processing limit:', error);
      throw error;
    }
  }

  /**
   * Check if a company can create more interview JDs (jd_for_interview) based on plan limits.
   * Uses same plan field active_jobs; counts rows in jd_for_interview where is_active = true.
   */
  static async checkInterviewJDLimit(companyId: string): Promise<JobDescriptionLimitInfo> {
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('company_id, selected_plan, plan_type')
        .eq('company_id', companyId)
        .single();

      if (companyError || !companyData) {
        if (companyError) console.error('Error fetching company data:', companyError);
        throw new Error('Failed to fetch company information');
      }

      let maxActiveJDs = 0;
      let planName = 'No Plan';

      if (companyData.selected_plan) {
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('plan_name, active_jobs, plan_type')
          .eq('plan_name', companyData.selected_plan)
          .eq('plan_type', companyData.plan_type || 'combo')
          .single();

        if (!planError && planData) {
          maxActiveJDs = planData.active_jobs ?? 0;
          planName = planData.plan_name ?? companyData.selected_plan;
        }
      }

      // Count active CV-screening JDs (job_descriptions.status = 'active')
      const { count: activeCvJdCount, error: activeCvError } = await supabase
        .from('job_descriptions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active');

      if (activeCvError) {
        console.error('Error counting active CV JDs for interview limit:', activeCvError);
        throw new Error('Failed to count active job descriptions for interview limit');
      }

      // Count active interview JDs (jd_for_interview.is_active = true)
      const { count: activeInterviewJdCount, error: activeInterviewError } = await supabase
        .from('jd_for_interview')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (activeInterviewError) {
        console.error('Error counting active interview JDs:', activeInterviewError);
        throw new Error('Failed to count active interview job descriptions');
      }

      // Shared pool: active_jobs cap is applied to combined active JDs from both tables
      const currentActiveJDCount = (activeCvJdCount ?? 0) + (activeInterviewJdCount ?? 0);
      const remainingJDs = maxActiveJDs === 0 ? -1 : maxActiveJDs - currentActiveJDCount;
      const canCreateJD = maxActiveJDs === 0 || remainingJDs > 0;

      return {
        canCreateJD,
        currentActiveJDCount,
        maxActiveJDs,
        remainingJDs,
        planName
      };
    } catch (error) {
      console.error('Error checking interview JD limit:', error);
      throw error;
    }
  }

  /**
   * Check if a company can start more interviews based on their plan limits (interview/combo plans only).
   */
  static async checkInterviewLimit(companyId: string): Promise<InterviewLimitInfo> {
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('company_id, selected_plan, plan_type, interview_count')
        .eq('company_id', companyId)
        .single();

      if (companyError || !companyData) {
        throw new Error(companyError?.message ?? 'Company not found');
      }

      let maxInterviews = 0;
      let planName = 'No Plan';
      let planType: string | null = null;

      if (companyData.selected_plan) {
        const { data: planRow, error: planError } = await supabase
          .from('plans')
          .select('plan_name, plan_type, max_interviews')
          .eq('plan_name', companyData.selected_plan)
          .eq('plan_type', companyData.plan_type || 'combo')
          .single();

        if (!planError && planRow && planRow.max_interviews != null) {
          maxInterviews = planRow.max_interviews;
          planName = planRow.plan_name ?? companyData.selected_plan;
          planType = planRow.plan_type ?? null;
        }
      }

      const currentCount = companyData.interview_count ?? 0;
      const remaining = maxInterviews === 0 ? -1 : maxInterviews - currentCount;
      const canStartInterview = maxInterviews === 0 || remaining > 0;

      return {
        canStartInterview,
        currentInterviewCount: currentCount,
        maxInterviews,
        remainingInterviews: remaining,
        planName,
        planType
      };
    } catch (error) {
      console.error('Error checking interview limit:', error);
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

      // Look up plan details by ID so we can store name + type on the company
      const { data: planRow, error: planLookupError } = await supabase
        .from('plans')
        .select('plan_name, plan_type')
        .eq('plan_id', paymentData.plan_id)
        .single();

      if (planLookupError) {
        console.warn('Could not look up plan for company update:', planLookupError);
      }

      // Update company's subscription info
      await supabase
        .from('companies')
        .update({
          selected_plan: planRow?.plan_name ?? null,
          plan_type: planRow?.plan_type ?? null,
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

