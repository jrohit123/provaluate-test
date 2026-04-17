import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UsageTrackingService } from '@/services/usageTrackingService';

interface AdminUserManagementProps {
  onSectionReady?: () => void;
}

export default function AdminUserManagement({ onSectionReady }: AdminUserManagementProps) {
  // All hooks must be called unconditionally
  const { user } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string>('');
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', role: 'user' });
  const [inviteError, setInviteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [cycleDateOpen, setCycleDateOpen] = useState(false);
  const [newCycleDay, setNewCycleDay] = useState<number>(1);
  const [rechargingCVs, setRechargingCVs] = useState(false);
  const [rechargePlanOpen, setRechargePlanOpen] = useState(false);
  const [selectedRechargePlan, setSelectedRechargePlan] = useState<string>('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellingDowngrade, setCancellingDowngrade] = useState(false);

  // Compute admin status after all hooks
  const isAdmin = user?.profile?.role === 'admin';

  // Load company data function (reusable)
  const loadCompanyData = async () => {
    if (!isAdmin || !user?.profile?.company_id) return;
    
    try {
    setLoading(true);
        // Fetch company info
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', user.profile.company_id)
          .single();
        setCompany(companyData);
      
        // Fetch available plans for plan changes (plan_cost > 0 and status = 'Active')
        const { data: availablePlansData } = await supabase
          .from('plans')
          .select('*')
          .gt('plan_cost', 0)
          .eq('status', 'Active');
        setAvailablePlans(availablePlansData || []);
        console.log('Available plans:', availablePlansData);
      
        // Fetch plan info
        if (companyData?.selected_plan) {
          const { data: planData } = await supabase
            .from('plans')
            .select('*')
            .eq('plan_name', companyData.selected_plan)
            .eq('plan_type', companyData.plan_type || 'combo')
            .single();
          console.log('Fetched plan:', planData);
          setPlan(planData);
        } else {
          setPlan(null);
        }
      
        // Fetch users in company
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, email, role, user_status, created_at')
          .eq('company_id', user.profile.company_id);
        setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading company data:', error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!isAdmin) return; // Only fetch if admin
    loadCompanyData();
  }, [user?.profile?.company_id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || loading) return;
    const t = setTimeout(() => onSectionReady?.(), 400);
    return () => clearTimeout(t);
  }, [isAdmin, loading, onSectionReady]);

  const maxUsers = plan?.max_users ?? null;
  const slotsLeft = maxUsers !== null ? maxUsers - users.length : null;
  
  // Check if user is on trial/free plan (plan_cost === 0)
  const isTrialPlan = (plan?.plan_cost ?? 0) === 0;

  const handleInviteChange = (e: any) => {
    setInviteForm({ ...inviteForm, [e.target.name]: e.target.value });
  };

  const handleInvite = async (e: any) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setLoading(true);
    if (!inviteForm.email) {
      setInviteError('Email is required.');
      setLoading(false);
      return;
    }
    
    // Validate email domain matches the logged-in user's domain
    if (user?.email && inviteForm.email) {
      const userDomain = user.email.split('@')[1]?.toLowerCase();
      const inviteDomain = inviteForm.email.split('@')[1]?.toLowerCase();
      
      if (!userDomain || !inviteDomain) {
        setInviteError('Invalid email format.');
        setLoading(false);
        return;
      }
      
      if (userDomain !== inviteDomain) {
        setInviteError(`Email domain must match your domain (@${userDomain}). Cannot invite users from different domains.`);
        setLoading(false);
        return;
      }
    }
    
    if (!inviteForm.firstName || !inviteForm.lastName) {
      setInviteError('First name and last name are required.');
      setLoading(false);
      return;
    }
    
    if (slotsLeft <= 0) {
      setInviteError('User limit reached for your plan.');
      setLoading(false);
      return;
    }
    
    // REAL EDGE FUNCTION CODE:
    try {
      console.log('Inviting user:', { email: inviteForm.email, firstName: inviteForm.firstName, lastName: inviteForm.lastName, role: inviteForm.role });
      
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: inviteForm.email,
          first_name: inviteForm.firstName,
          last_name: inviteForm.lastName,
          role: inviteForm.role 
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        const errorMessage = error.message || 'Failed to send invitation. Please check if the edge function is deployed.';
        setInviteError(errorMessage);
        toast({
          title: "Invitation Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data?.success) {
        setInviteSuccess('Invitation sent successfully!');
        setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
        setInviteOpen(false);
        
        // Refresh users list
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, email, role, user_status, onboarding_complete, created_at')
          .eq('company_id', user.profile.company_id)
          .order('role', { ascending: true })
          .order('first_name', { ascending: true })
          .order('last_name', { ascending: true });
        setUsers(usersData || []);
        
        toast({
          title: "Invitation Sent",
          description: `Successfully invited ${inviteForm.email}`,
        });
      } else {
        const errorMsg = data?.error || 'Failed to send invitation.';
        setInviteError(errorMsg);
        toast({
          title: "Invitation Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error('Invitation error:', err);
      const errorMessage = err.message || 'An error occurred. Please try again.';
      setInviteError(errorMessage);
      toast({
        title: "Invitation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async () => {
    if (!selectedNewPlan || !company || !plan) {
      toast({
        title: "Error",
        description: "Please select a plan to change to.",
        variant: "destructive",
      });
      return;
    }

    setChangingPlan(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      const selectedPlanData = availablePlans.find(p => p.plan_id === selectedNewPlan);
      
      if (!selectedPlanData) {
        throw new Error('Selected plan not found');
      }

      const planName = selectedPlanData.plan_name;
      const currentPlanCost = plan.plan_cost || 0;
      const newPlanCost = selectedPlanData.plan_cost || 0;
      
      // Determine if upgrade or downgrade
      const isUpgrade = newPlanCost > currentPlanCost;
      const isDowngrade = newPlanCost < currentPlanCost;
      
      let endpoint = '';
      if (isUpgrade) {
        endpoint = '/payments/upgrade-plan';
      } else if (isDowngrade) {
        endpoint = '/payments/schedule-downgrade';
      } else {
        // Same price - just update in database
      const { error } = await supabase
        .from('companies')
        .update({ selected_plan: planName, plan_type: selectedPlanData.plan_type })
        .eq('company_id', company.company_id);

      if (error) throw error;

      setCompany(prev => ({ ...prev, selected_plan: planName, plan_type: selectedPlanData.plan_type }));
      setPlan(selectedPlanData);
      setPlanChangeOpen(false);
      setSelectedNewPlan('');
      
      toast({
        title: "Plan Updated",
        description: `Successfully updated to ${planName} plan.`,
      });
        setChangingPlan(false);
        return;
      }

      // Call upgrade or downgrade endpoint
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          new_plan_id: selectedPlanData.plan_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change plan');
      }

      const result = await response.json();
      
      // ✅ For upgrades: Use order_id (one-time payment order) or subscription_id (free upgrade)
      // ✅ For downgrades: Use subscription_id (if returned)
      if (isUpgrade) {
        // If net_payment is 0 (credit covers full amount), subscription is already created
        if ((result.net_payment === 0 || result.net_payment <= 0) && result.subscription_id) {
          const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
          
          // Open Razorpay subscription checkout to activate subscription
          if (typeof window !== 'undefined' && (window as any).Razorpay) {
            const subOptions = {
              key: result.key_id,
              subscription_id: result.subscription_id,
              name: "aitamate",
              description: `Activate ${planName} subscription`,
              prefill: {
                name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
                email: user?.email || "",
                contact: ""
              },
              notes: {
                company_id: company.company_id,
                plan_name: planName
              },
              theme: {
                color: "#094D7B"
              },
              handler: async function (subResponse: any) {
                // Subscription activated!
                await loadCompanyData();
                toast({
                  title: "Subscription Activated",
                  description: `Your ${planName} subscription is now active. Credit covers full amount - no payment required.`,
                });
                setPlanChangeOpen(false);
                setSelectedNewPlan('');
                setChangingPlan(false);
              },
              modal: {
                ondismiss: function() {
                  setChangingPlan(false);
                }
              }
            };
            
            const rzp2 = new (window as any).Razorpay(subOptions);
            
            rzp2.on('payment.failed', function (subResponse: any) {
              console.error('Subscription activation failed:', subResponse.error);
              toast({
                title: "Activation Failed",
                description: subResponse.error.description || "Subscription could not be activated. Please contact support.",
                variant: "destructive",
              });
              setChangingPlan(false);
            });
            
            rzp2.open();
          } else {
            // Fallback if Razorpay not loaded
            await loadCompanyData();
            toast({
              title: "Plan Upgraded",
              description: result.message || `Successfully upgraded to ${planName} plan. Credit covers full amount - no payment required. Please activate subscription manually.`,
            });
            setPlanChangeOpen(false);
            setSelectedNewPlan('');
            setChangingPlan(false);
          }
          return;
        }
        
        // If order_id exists, proceed with payment
        if (result.order_id && result.key_id) {
          // Check if Razorpay is loaded
          if (typeof window === 'undefined' || !(window as any).Razorpay) {
            throw new Error('Razorpay SDK not loaded. Please refresh the page.');
          }

          const options = {
            key: result.key_id,
            amount: result.net_payment * 100,  // Convert to paise
            currency: 'INR',
            order_id: result.order_id,
            name: "aitamate",
            description: `Upgrade to ${planName} plan${result.credit_applied > 0 ? ` (Credit ₹${result.credit_applied} applied)` : ''}`,
            prefill: {
              name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
              email: user?.email || "",
              contact: ""
            },
            notes: {
              company_id: company.company_id,
              plan_name: planName,
              action: 'upgrade'
            },
            theme: {
              color: "#094D7B"
            },
            handler: async function (response: any) {
              try {
                setChangingPlan(true);
                const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
                
                // Wait for webhook to process (create subscription)
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Get subscription_id created by webhook
                try {
                  const subResponse = await fetch(`${API_BASE_URL}/payments/get-subscription-id`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      company_id: company.company_id
                    })
                  });
                  
                  const subData = await subResponse.json();
                  
                  if (subData.success && subData.subscription_id) {
                    // Open Razorpay subscription checkout to activate subscription
                    const subOptions = {
                      key: subData.key_id,
                      subscription_id: subData.subscription_id,
                      name: "aitamate",
                      description: `Activate ${planName} subscription`,
                      prefill: {
                        name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
                        email: user?.email || "",
                        contact: ""
                      },
                      notes: {
                        company_id: company.company_id,
                        plan_name: planName
                      },
                      theme: {
                        color: "#094D7B"
                      },
                      handler: async function (subResponse: any) {
                        // Subscription activated!
                        await loadCompanyData();
                        toast({
                          title: "Subscription Activated",
                          description: `Your ${planName} subscription is now active. Payments will be charged automatically.`,
                        });
                        setPlanChangeOpen(false);
                        setSelectedNewPlan('');
                        setChangingPlan(false);
                      },
                      modal: {
                        ondismiss: function() {
                          setChangingPlan(false);
                        }
                      }
                    };
                    
                    const rzp2 = new (window as any).Razorpay(subOptions);
                    
                    rzp2.on('payment.failed', function (subResponse: any) {
                      console.error('Subscription activation failed:', subResponse.error);
                      toast({
                        title: "Activation Failed",
                        description: subResponse.error.description || "Subscription could not be activated. Please contact support.",
                        variant: "destructive",
                      });
                      setChangingPlan(false);
                    });
                    
                    rzp2.open();
                  } else {
                    // Fallback: Just refresh data if subscription not found
                    await loadCompanyData();
                    toast({
                      title: "Plan Upgraded",
                      description: result.message || `Successfully upgraded to ${planName} plan. Please activate subscription manually.`,
                    });
                    setPlanChangeOpen(false);
                    setSelectedNewPlan('');
                    setChangingPlan(false);
                  }
                } catch (subError: any) {
                  // If subscription check fails, just refresh data
                  console.error('Error getting subscription:', subError);
                  await loadCompanyData();
                  toast({
                    title: "Plan Upgraded",
                    description: result.message || `Successfully upgraded to ${planName} plan.`,
                  });
                  setPlanChangeOpen(false);
                  setSelectedNewPlan('');
                  setChangingPlan(false);
                }
              } catch (error: any) {
                console.error('Error processing payment:', error);
                toast({
                  title: "Payment Error",
                  description: error.message || "An error occurred. Please contact support.",
                  variant: "destructive",
                });
                setChangingPlan(false);
              }
            },
            modal: {
              ondismiss: function() {
                setChangingPlan(false);
              }
            }
          };
          
          const rzp1 = new (window as any).Razorpay(options);
          
          rzp1.on('payment.failed', function (response: any) {
            console.error('Payment failed:', response.error);
            toast({
              title: "Payment Failed",
              description: response.error.description || "Payment could not be completed. Please try again.",
              variant: "destructive",
            });
            setChangingPlan(false);
          });
          
          rzp1.open();
        } else {
          // No order_id for upgrade (shouldn't happen unless free upgrade already handled above)
          await loadCompanyData();
          setPlanChangeOpen(false);
          setSelectedNewPlan('');
          setChangingPlan(false);
        }
      } else if (isDowngrade) {
        // Schedule downgrade at end of cycle – no payment today
        if (result.success) {
          await loadCompanyData();
          toast({
            title: "Downgrade Scheduled",
            description: result.message || `Downgrade to ${planName} scheduled. No charge today.`,
          });
          setPlanChangeOpen(false);
          setSelectedNewPlan('');
        }
        setChangingPlan(false);
      } else {
        // If no order_id/subscription_id returned (shouldn't happen, but handle gracefully)
        await loadCompanyData();
        setPlanChangeOpen(false);
        setSelectedNewPlan('');
        
        toast({
          title: isUpgrade ? "Plan Upgraded" : "Plan Downgraded",
          description: result.message || `Successfully ${isUpgrade ? 'upgraded' : 'downgraded'} to ${planName} plan.`,
        });
        setChangingPlan(false);
      }
    } catch (error: any) {
      console.error('Error changing plan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update plan. Please try again.",
        variant: "destructive",
      });
      setChangingPlan(false);
    }
  };

  const handleTopUp = async () => {
    if (!user?.profile?.company_id || !plan) {
      toast({ title: "Error", description: "Missing company or plan information.", variant: "destructive" });
      return;
    }
    const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
    try {
      setRechargingCVs(true);
      const response = await fetch(`${API_BASE_URL}/payments/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: user.profile.company_id })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create recharge order');
      }
      const orderData = await response.json();
      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }
      const desc = `Top-up for ${plan.plan_name}`;
      const successMsg = 'Top-up successful. Quotas have been reset for the current cycle.';
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "aitamate",
        description: desc,
        order_id: orderData.order_id,
        prefill: {
          name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
          email: user?.email || "",
          contact: ""
        },
        notes: {
          company_id: user.profile.company_id,
          plan_name: plan.plan_name,
          recharge_type: 'topup'
        },
        theme: { color: "#094D7B" },
        handler: async function (rzpResponse: any) {
          try {
            const verifyResponse = await fetch(`${API_BASE_URL}/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: user.profile.company_id,
                plan_id: plan.plan_id,
                razorpay_order_id: rzpResponse.razorpay_order_id,
                razorpay_payment_id: rzpResponse.razorpay_payment_id,
                razorpay_signature: rzpResponse.razorpay_signature
              })
            });
            if (!verifyResponse.ok) throw new Error('Payment verification failed');
            toast({ title: "Recharge Successful", description: successMsg });
            await loadCompanyData();
          } catch (error: any) {
            toast({ title: "Recharge Error", description: error.message || "An error occurred.", variant: "destructive" });
          } finally {
            setRechargingCVs(false);
          }
        },
        modal: { ondismiss: () => setRechargingCVs(false) }
      };
      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on('payment.failed', () => {
        toast({ title: "Payment Failed", description: "Payment could not be completed. Please try again.", variant: "destructive" });
        setRechargingCVs(false);
      });
      rzp1.open();
    } catch (error: any) {
      toast({ title: "Recharge Error", description: error.message || "Failed to initiate recharge.", variant: "destructive" });
      setRechargingCVs(false);
    }
  };

  const handleChangeCycleDate = async () => {
    if (!user?.profile?.company_id || !newCycleDay) {
      toast({
        title: "Error",
        description: "Please select a valid cycle day.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      
      const response = await fetch(`${API_BASE_URL}/payments/change-cycle-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: user.profile.company_id,
          new_cycle_day: newCycleDay
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to change cycle date';
        
        // Show specific error messages
        if (errorMessage.includes('No unused CVs')) {
          toast({
            title: "Cannot Change Date",
            description: "You need unused CVs to change the billing cycle date. Please use some CVs first or wait for renewal.",
            variant: "destructive",
          });
        } else if (errorMessage.includes('cannot be after')) {
          toast({
            title: "Invalid Date",
            description: "The selected date cannot be after your current billing end date.",
            variant: "destructive",
          });
        } else if (errorMessage.includes('cannot be before')) {
          toast({
            title: "Invalid Date",
            description: "The selected date cannot be before today.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
        return;
      }

      const result = await response.json();
      
      // Refresh company data
      await loadCompanyData();
      
      setCycleDateOpen(false);
      setNewCycleDay(1);
      
      toast({
        title: "Cycle Date Changed",
        description: result.message || `Billing cycle date changed successfully.`,
      });
    } catch (error: any) {
      console.error('Error changing cycle date:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change cycle date. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async () => {
    if (!user?.profile?.company_id) {
      toast({
        title: "Error",
        description: "Missing company information.",
        variant: "destructive",
      });
      return;
    }

    // If no plan exists, open plan selection dialog
    if (!plan) {
      setRechargePlanOpen(true);
      return;
    }

    // If plan exists, proceed with subscription creation
    try {
      setLoading(true);
      
      // Step 1: Create subscription on backend (passes internal plan_id, backend fetches razorpay_plan_id from database)
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      const createSubscriptionResponse = await fetch(`${API_BASE_URL}/payments/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: user.profile.company_id,
          plan_id: plan.plan_id  // Internal plan_id - backend will fetch razorpay_plan_id from database
        })
      });

      if (!createSubscriptionResponse.ok) {
        const errorData = await createSubscriptionResponse.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const subscriptionData = await createSubscriptionResponse.json();
      
      // subscriptionData.subscription_id comes from database - NO HARDCODING
      
      // Step 2: Check if Razorpay is loaded
      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      // Step 3: Open Razorpay subscription checkout using subscription_id from backend
      const options = {
        key: subscriptionData.key_id,
        subscription_id: subscriptionData.subscription_id,  // From database via backend - NO HARDCODING
        name: "aitamate",
        description: `Subscription for ${plan.plan_name} - ₹${plan.plan_cost}/month`,
        prefill: {
          name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
          email: user?.email || "",
          contact: ""
        },
        notes: {
          company_id: user.profile.company_id,
          plan_name: plan.plan_name
        },
        theme: {
          color: "#094D7B"
        },
        handler: async function (response: any) {
          try {
            setLoading(true);
            
            toast({
              title: "Subscription Activated",
              description: subscriptionData.is_existing 
                ? "Using your existing subscription. Payments will continue automatically."
                : `Your ${plan.plan_name} subscription has been activated. Payments of ₹${plan.plan_cost} will be charged automatically monthly.`,
              });
              
            // Refresh company data
              await loadCompanyData();
            
          } catch (error: any) {
            console.error('Error processing subscription:', error);
            toast({
              title: "Subscription Error",
              description: error.message || "An error occurred. Please contact support.",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };
      
      const rzp1 = new (window as any).Razorpay(options);
      
      rzp1.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast({
          title: "Payment Failed",
          description: response.error.description || "Payment could not be completed. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      });
      
      rzp1.open();
      setLoading(false);
      
    } catch (error: any) {
      console.error('Error initiating subscription:', error);
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to initiate subscription. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleRechargePlanSelect = async () => {
    if (!user?.profile?.company_id || !selectedRechargePlan) {
      toast({
        title: "Error",
        description: "Please select a plan.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Find selected plan data (selectedRechargePlan is plan_id)
      const selectedPlanData = availablePlans.find(p => p.plan_id === selectedRechargePlan);
      if (!selectedPlanData) {
        throw new Error('Selected plan not found');
      }
      const planName = selectedPlanData.plan_name;

      // Step 1: Create subscription on backend (backend will update selected_plan automatically)
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      const createSubscriptionResponse = await fetch(`${API_BASE_URL}/payments/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: user.profile.company_id,
          plan_id: selectedPlanData.plan_id
        })
      });

      if (!createSubscriptionResponse.ok) {
        const errorData = await createSubscriptionResponse.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const subscriptionData = await createSubscriptionResponse.json();
      
      // Step 2: Check if Razorpay is loaded
      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      // Step 3: Open Razorpay subscription checkout
      const options = {
        key: subscriptionData.key_id,
        subscription_id: subscriptionData.subscription_id,
        name: "aitamate",
        description: `Activate ${planName} subscription - ₹${selectedPlanData.plan_cost}/month`,
        prefill: {
          name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
          email: user?.email || "",
          contact: ""
        },
        notes: {
          company_id: user.profile.company_id,
          plan_name: planName
        },
        theme: {
          color: "#094D7B"
        },
        handler: async function (response: any) {
          try {
            setLoading(true);
            
            toast({
              title: "Subscription Activated",
              description: `Your ${planName} subscription has been activated. Payments of ₹${selectedPlanData.plan_cost} will be charged automatically monthly.`,
            });
              
            // Refresh company data
            await loadCompanyData();
            
            // Close dialog
            setRechargePlanOpen(false);
            setSelectedRechargePlan('');
        
          } catch (error: any) {
            console.error('Error processing subscription:', error);
            toast({
              title: "Subscription Error",
              description: error.message || "An error occurred. Please contact support.",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };
      
      const rzp1 = new (window as any).Razorpay(options);
      
      rzp1.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast({
          title: "Payment Failed",
          description: response.error.description || "Payment could not be completed. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      });
      
      rzp1.open();
      setRechargePlanOpen(false);
      setLoading(false);
      
    } catch (error: any) {
      console.error('Error initiating subscription:', error);
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to initiate subscription. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleCancelDowngrade = async () => {
    if (!user?.profile?.company_id || !company?.company_id) {
      toast({ title: "Error", description: "Missing company information.", variant: "destructive" });
      return;
    }
    const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
    try {
      setCancellingDowngrade(true);
      const response = await fetch(`${API_BASE_URL}/payments/cancel-downgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to cancel downgrade');
      toast({
        title: "Downgrade Cancelled",
        description: data.message || "Your current plan will renew as usual.",
      });
      await loadCompanyData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not cancel downgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancellingDowngrade(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.profile?.company_id) {
      toast({
        title: "Error",
        description: "Missing company information.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCancelling(true);
      
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      const response = await fetch(`${API_BASE_URL}/payments/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: user.profile.company_id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      toast({
        title: "Subscription Cancelled",
        description: data.subscription_end_date 
          ? `Your subscription has been cancelled. You'll have access until ${new Date(data.subscription_end_date).toLocaleDateString()}.`
          : "Your subscription has been cancelled.",
      });

      // Close dialog
      setCancelConfirmOpen(false);
      
      // Refresh company data
      await loadCompanyData();
      
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: "Cancellation Error",
        description: error.message || "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  // Only render UI if admin
  if (!isAdmin) return null;

  const pendingPlanName = company?.pending_plan_id
    ? (availablePlans.find(p => p.plan_id === company.pending_plan_id)?.plan_name ?? 'lower plan')
    : null;
  const pendingChangeDate = company?.pending_plan_change_at
    ? new Date(company.pending_plan_change_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Card className="mb-8" data-tour="settings-user-management">
      {company?.pending_plan_id && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span>
            Scheduled downgrade to <strong>{pendingPlanName}</strong>
            {pendingChangeDate && <> on {pendingChangeDate}</>}. No charge until then.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-3 mt-2 sm:mt-0 sm:ml-2"
            disabled={cancellingDowngrade}
            onClick={handleCancelDowngrade}
          >
            {cancellingDowngrade ? 'Cancelling…' : 'Cancel downgrade'}
          </Button>
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">User Management</CardTitle>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1">
          {plan ? (
            <>
              Plan:{' '}
              <b>
                {plan.plan_name}
                {plan.plan_type && (
                  <>
                    {' '}
                    (
                    {plan.plan_type === 'cv'
                      ? 'CV Only'
                      : plan.plan_type === 'interview'
                      ? 'Interviews Only'
                      : 'Combo'}
                    )
                  </>
                )}
              </b>{' '}
              | Max Users: <b>{maxUsers}</b> | Slots Left: <b>{slotsLeft}</b>
            </>
          ) : (
            <span className="text-red-600">No plan information available for this company.</span>
          )}
        </div>
        {availablePlans.length === 0 && (
          <div className="text-yellow-600 text-xs mt-1">Warning: No active plans with cost greater than 0 found. Please check your plan configuration.</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="font-semibold text-base sm:text-lg">Company Users</div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {!isTrialPlan && (
              <>
                <Button variant="outline" onClick={handleRecharge} disabled={loading}>
                  Recharge Subscription
                </Button>
                {/* Top Up Usage - hidden for now
                <Button
                  variant="outline"
                  onClick={handleTopUp}
                  disabled={rechargingCVs || !plan}
                >
                  {rechargingCVs ? 'Processing...' : 'Top Up Usage'}
                </Button>
                */}
                {company?.subscription_status !== 'cancelled' &&
                 company?.subscription_status !== 'expired' &&
                 company?.razorpay_subscription_id && (
                  <Button 
                    variant="outline" 
                    onClick={() => setCancelConfirmOpen(true)} 
                    disabled={loading || cancelling}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                  </Button>
                )}
              </>
            )}
            {/* Change Billing Date - hidden for now
            <Dialog open={cycleDateOpen} onOpenChange={setCycleDateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled>
                  Change Cycle Date
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Billing Cycle Date</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Current billing date: <strong>{company?.subscription_end ? new Date(company.subscription_end).toLocaleDateString() : 'N/A'}</strong>
                    </p>
                    {plan && company && (plan.max_cvs ?? 0) > 0 && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Unused CVs: <strong>{plan.max_cvs - (company.cv_processed_count || 0)}</strong> / {plan.max_cvs}
                      </p>
                    )}
                    {plan && company && (plan.max_interviews ?? 0) > 0 && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Interviews used: <strong>{company.interview_count ?? 0}</strong> / {plan.max_interviews ?? 0}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a day (1-31) for your new billing cycle date. The date must be between today and your current billing end date. You can only prepone the date, not postpone it.
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Select Day (1-31)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={newCycleDay}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        setNewCycleDay(Math.max(1, Math.min(31, value)));
                      }}
                      placeholder="Day (1-31)"
                    />
                  </div>
                  {newCycleDay && company?.subscription_end && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">
                        Calculated new date:
                      </p>
                      <p className="text-sm font-medium">
                        {(() => {
                          const today = new Date();
                          const targetDay = Math.min(newCycleDay, 28);
                          let calculatedDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                          
                          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          if (calculatedDate < todayStart) {
                            if (today.getMonth() === 11) {
                              calculatedDate = new Date(today.getFullYear() + 1, 0, targetDay);
                            } else {
                              calculatedDate = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
                            }
                          }
                          
                          const currentBillingEnd = new Date(company.subscription_end);
                          const isValid = calculatedDate >= todayStart && calculatedDate <= currentBillingEnd;
                          
                          return (
                            <span className={isValid ? "text-green-600" : "text-red-600"}>
                              {calculatedDate.toLocaleDateString()}
                              {!isValid && (
                                <span className="ml-2 text-xs">
                                  ({calculatedDate < todayStart ? 'Before today' : 'After billing end'})
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleChangeCycleDate} 
                      disabled={!newCycleDay || loading}
                      className="flex-1"
                    >
                      {loading ? 'Updating...' : 'Update Date'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setCycleDateOpen(false);
                        setNewCycleDay(1);
                      }}
                      className="flex-1"
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            */}
            <Dialog open={planChangeOpen} onOpenChange={setPlanChangeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Plan</Button>
              </DialogTrigger>
              <DialogContent aria-describedby="plan-change-description">
                <DialogHeader>
                  <DialogTitle>Change Company Plan</DialogTitle>
                </DialogHeader>
                <div id="plan-change-description" className="sr-only">Dialog to change the company subscription plan</div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Current Plan:{' '}
                      <strong>
                        {plan?.plan_name || 'None'}
                        {plan?.plan_type && (
                          <>
                            {' '}
                            (
                            {plan.plan_type === 'cv'
                              ? 'CV Only'
                              : plan.plan_type === 'interview'
                              ? 'Interviews Only'
                              : 'Combo'}
                            )
                          </>
                        )}
                      </strong>
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a new plan from the available options below:
                    </p>
                  </div>
                  <Select value={selectedNewPlan} onValueChange={setSelectedNewPlan}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select new plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans
                        .sort((a, b) => (a.plan_cost || 0) - (b.plan_cost || 0))
                        .map(availablePlan => (
                        <SelectItem key={availablePlan.plan_id} value={availablePlan.plan_id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {availablePlan.plan_name}
                              {availablePlan.plan_type ? ` (${availablePlan.plan_type === 'cv' ? 'CV Only' : availablePlan.plan_type === 'interview' ? 'Interviews Only' : 'Combo'})` : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ₹{availablePlan.plan_cost}/month • Max {availablePlan.max_users} users
                              {availablePlan.max_cvs != null ? ` • ${availablePlan.max_cvs} CVs` : ''}
                              {availablePlan.max_interviews != null ? ` • ${availablePlan.max_interviews} interviews` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handlePlanChange} 
                      disabled={!selectedNewPlan || changingPlan}
                      className="flex-1"
                    >
                      {changingPlan ? 'Updating...' : 'Update Plan'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPlanChangeOpen(false);
                        setSelectedNewPlan('');
                      }}
                      className="flex-1"
                      disabled={changingPlan}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={rechargePlanOpen} onOpenChange={setRechargePlanOpen}>
              <DialogContent aria-describedby="recharge-plan-description">
                <DialogHeader>
                  <DialogTitle>Select Plan to Activate</DialogTitle>
                </DialogHeader>
                <div id="recharge-plan-description" className="sr-only">Dialog to select a subscription plan for activation</div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a plan to activate your subscription. The amount will be charged automatically monthly.
                    </p>
                  </div>
                  <Select value={selectedRechargePlan} onValueChange={setSelectedRechargePlan}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans
                        .sort((a, b) => (a.plan_cost || 0) - (b.plan_cost || 0))
                        .map(availablePlan => (
                        <SelectItem key={availablePlan.plan_id} value={availablePlan.plan_id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {availablePlan.plan_name}
                              {availablePlan.plan_type ? ` (${availablePlan.plan_type === 'cv' ? 'CV Only' : availablePlan.plan_type === 'interview' ? 'Interviews Only' : 'Combo'})` : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ₹{availablePlan.plan_cost}/month • Max {availablePlan.max_users} users
                              {availablePlan.max_cvs != null ? ` • ${availablePlan.max_cvs} CVs` : ''}
                              {availablePlan.max_interviews != null ? ` • ${availablePlan.max_interviews} interviews` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRechargePlan && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-900">Amount to be charged:</span>
                        <span className="text-lg font-bold text-blue-900">
                          ₹{availablePlans.find(p => p.plan_id === selectedRechargePlan)?.plan_cost || 0}/month
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#094D7B]">
                        This amount will be automatically charged monthly after activation.
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleRechargePlanSelect} 
                      disabled={!selectedRechargePlan || loading}
                      className="flex-1"
                    >
                      {loading ? 'Processing...' : 'Activate Subscription'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setRechargePlanOpen(false);
                        setSelectedRechargePlan('');
                      }}
                      className="flex-1"
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* Cancel Subscription Confirmation Dialog */}
            <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Subscription</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Are you sure you want to cancel your subscription?
                    </p>
                    {company?.subscription_end && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-medium text-yellow-900 mb-1">
                          ⚠️ Important Information:
                        </p>
                        <p className="text-xs text-yellow-800">
                          Your subscription will be cancelled immediately, but you'll retain access until{' '}
                          <strong>{new Date(company.subscription_end).toLocaleDateString()}</strong>.
                          After that date, you'll lose access to premium features.
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      You can reactivate your subscription anytime by clicking "Recharge".
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCancelSubscription} 
                      disabled={cancelling}
                      variant="destructive"
                      className="flex-1"
                    >
                      {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setCancelConfirmOpen(false)}
                      className="flex-1"
                      disabled={cancelling}
                    >
                      Keep Subscription
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button disabled={slotsLeft <= 0}>Invite User</Button>
              </DialogTrigger>
            <DialogContent aria-describedby="invite-user-description">
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
              </DialogHeader>
              <div id="invite-user-description" className="sr-only">Dialog to invite a new user to the company</div>
              <form className="space-y-3" onSubmit={handleInvite}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    name="firstName"
                    type="text"
                    placeholder="First Name"
                    value={inviteForm.firstName}
                    onChange={handleInviteChange}
                    required
                    disabled={loading}
                  />
                  <Input
                    name="lastName"
                    type="text"
                    placeholder="Last Name"
                    value={inviteForm.lastName}
                    onChange={handleInviteChange}
                    required
                    disabled={loading}
                  />
                </div>
                <Input
                  name="email"
                  type="email"
                  placeholder={user?.email ? `Email (must be @${user.email.split('@')[1]})` : "Email"}
                  value={inviteForm.email}
                  onChange={handleInviteChange}
                  required
                  disabled={loading}
                />
                <Select value={inviteForm.role} onValueChange={val => setInviteForm(f => ({ ...f, role: val }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
                {inviteSuccess && <div className="text-green-600 text-sm">{inviteSuccess}</div>}
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending...' : 'Send Invite'}</Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <div className="overflow-x-auto relative">
          <table className="min-w-full text-xs sm:text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Name</th>
                <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Email</th>
                <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Role</th>
                <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground text-xs sm:text-sm">
                    No users found in your company.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.user_id} className="border-t">
                    <td className="p-2 sm:p-3 text-xs sm:text-sm">{u.first_name || ''} {u.last_name || ''}</td>
                    <td className="p-2 sm:p-3 text-xs sm:text-sm break-words">{u.email || 'N/A'}</td>
                    <td className="p-2 sm:p-3 text-xs sm:text-sm capitalize">{u.role || 'N/A'}</td>
                    <td className="p-2 sm:p-3 text-xs sm:text-sm capitalize">{u.user_status || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
} 