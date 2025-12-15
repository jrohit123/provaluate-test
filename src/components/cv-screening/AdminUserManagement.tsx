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

export default function AdminUserManagement() {
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
            .single();
          console.log('Fetched plan:', planData);
          setPlan(planData);
        } else {
          setPlan(null);
        }
      
        // Fetch users in company
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
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

  const maxUsers = plan?.max_users ?? null;
  const slotsLeft = maxUsers !== null ? maxUsers - users.length : null;

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
    
    if (slotsLeft <= 0) {
      setInviteError('User limit reached for your plan.');
      setLoading(false);
      return;
    }
    // TEMPORARY SIMULATION - COMPLETELY BYPASS EDGE FUNCTION
    console.log(`🔄 SIMULATION: Inviting ${inviteForm.email} with role: ${inviteForm.role}`);
    
    // Simulate processing time
    setTimeout(() => {
      setInviteSuccess('✅ Invitation sent successfully! (Simulated)');
      setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
      setInviteOpen(false);
      setLoading(false);
      
      toast({
        title: "Invitation Sent (Simulated)",
        description: `Simulated invitation for ${inviteForm.email}. Edge Function needs deployment for real functionality.`,
      });
    }, 1000);
    
    return; // Exit early to avoid any Edge Function calls
    
    /*
    // REAL EDGE FUNCTION CODE - UNCOMMENT AFTER DEPLOYMENT:
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: inviteForm.email, 
          role: inviteForm.role 
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.success) {
        setInviteSuccess('Invitation sent successfully!');
        setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
        setInviteOpen(false);
        
        // Refresh users list
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
          .eq('company_id', user.profile.company_id);
        setUsers(usersData || []);
        
        toast({
          title: "Invitation Sent",
          description: `Successfully invited ${inviteForm.email}`,
        });
      } else {
        setInviteError(data?.error || 'Failed to send invitation.');
      }
          } catch (err: any) {
        console.error('Invitation error:', err);
        setInviteError(err.message || 'An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    */
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
      const selectedPlanData = availablePlans.find(p => p.plan_name === selectedNewPlan);
      
      if (!selectedPlanData) {
        throw new Error('Selected plan not found');
      }

      const currentPlanCost = plan.plan_cost || 0;
      const newPlanCost = selectedPlanData.plan_cost || 0;
      
      // Determine if upgrade or downgrade
      const isUpgrade = newPlanCost > currentPlanCost;
      const isDowngrade = newPlanCost < currentPlanCost;
      
      let endpoint = '';
      if (isUpgrade) {
        endpoint = '/payments/upgrade-plan';
      } else if (isDowngrade) {
        endpoint = '/payments/downgrade-plan';
      } else {
        // Same price - just update in database
      const { error } = await supabase
        .from('companies')
        .update({ selected_plan: selectedNewPlan })
        .eq('company_id', company.company_id);

      if (error) throw error;

      setCompany(prev => ({ ...prev, selected_plan: selectedNewPlan }));
      setPlan(selectedPlanData);
      setPlanChangeOpen(false);
      setSelectedNewPlan('');
      
      toast({
        title: "Plan Updated",
        description: `Successfully updated to ${selectedNewPlan} plan.`,
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
          toast({
            title: "Plan Upgraded",
            description: result.message || `Successfully upgraded to ${selectedNewPlan} plan. Credit covers full amount - no payment required.`,
          });
          setPlanChangeOpen(false);
          setSelectedNewPlan('');
          setChangingPlan(false);
          await loadCompanyData();
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
            description: `Upgrade to ${selectedNewPlan} plan${result.credit_applied > 0 ? ` (Credit ₹${result.credit_applied} applied)` : ''}`,
            prefill: {
              name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
              email: user?.email || "",
              contact: ""
            },
            notes: {
              company_id: company.company_id,
              plan_name: selectedNewPlan,
              action: 'upgrade'
            },
            theme: {
              color: "#1A56DB"
            },
            handler: async function (response: any) {
              try {
                // Wait a moment for webhook to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Refresh company data after successful payment
                await loadCompanyData();
                
                toast({
                  title: "Plan Upgraded",
                  description: result.message || `Successfully upgraded to ${selectedNewPlan} plan. Payment completed. Subscription will be created automatically.`,
                });
                
                setPlanChangeOpen(false);
                setSelectedNewPlan('');
              } catch (error: any) {
                console.error('Error processing payment:', error);
                toast({
                  title: "Payment Error",
                  description: error.message || "An error occurred. Please contact support.",
                  variant: "destructive",
                });
              } finally {
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
      } else if (!isUpgrade) {
        // Downgrade: User pays full plan cost, credit stored for next cycle
        
        // If order_id exists, proceed with payment
        if (result.order_id && result.key_id) {
          // Check if Razorpay is loaded
          if (typeof window === 'undefined' || !(window as any).Razorpay) {
            throw new Error('Razorpay SDK not loaded. Please refresh the page.');
          }

          const options = {
            key: result.key_id,
            amount: result.net_payment * 100,  // Convert to paise (full plan cost)
            currency: 'INR',
            order_id: result.order_id,
            name: "aitamate",
            description: `Downgrade to ${selectedNewPlan} plan${result.credit_stored > 0 ? ` (Credit ₹${result.credit_stored} will be applied to next cycle)` : ''}`,
            prefill: {
              name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
              email: user?.email || "",
              contact: ""
            },
            notes: {
              company_id: company.company_id,
              plan_name: selectedNewPlan,
              action: 'downgrade'
            },
            theme: {
              color: "#1A56DB"
            },
            handler: async function (response: any) {
              try {
                // Wait a moment for webhook to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Refresh company data after successful payment
                await loadCompanyData();
                
                toast({
                  title: "Plan Downgraded",
                  description: result.message || `Successfully downgraded to ${selectedNewPlan} plan. Payment completed. ${result.credit_stored > 0 ? `Credit ₹${result.credit_stored} will be applied to next billing cycle.` : ''}`,
                });
                
                setPlanChangeOpen(false);
                setSelectedNewPlan('');
              } catch (error: any) {
                console.error('Error processing payment:', error);
                toast({
                  title: "Payment Error",
                  description: error.message || "An error occurred. Please contact support.",
                  variant: "destructive",
                });
              } finally {
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
          // If no order_id returned (shouldn't happen, but handle gracefully)
          await loadCompanyData();
          setPlanChangeOpen(false);
          setSelectedNewPlan('');
          
          toast({
            title: "Plan Downgraded",
            description: result.message || `Successfully downgraded to ${selectedNewPlan} plan.`,
          });
          setChangingPlan(false);
        }
      } else {
        // If no order_id/subscription_id returned (shouldn't happen, but handle gracefully)
        await loadCompanyData();
        setPlanChangeOpen(false);
        setSelectedNewPlan('');
        
        toast({
          title: isUpgrade ? "Plan Upgraded" : "Plan Downgraded",
          description: result.message || `Successfully ${isUpgrade ? 'upgraded' : 'downgraded'} to ${selectedNewPlan} plan.`,
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

  const handleCVRecharge = async () => {
    if (!user?.profile?.company_id || !plan) {
      toast({
        title: "Error",
        description: "Missing company or plan information.",
        variant: "destructive",
      });
      return;
    }

    try {
      setRechargingCVs(true);
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      
      // Create CV recharge order
      const response = await fetch(`${API_BASE_URL}/payments/recharge-cvs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: user.profile.company_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create CV recharge order');
      }

      const orderData = await response.json();
      
      // Check if Razorpay is loaded
      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      // Open Razorpay checkout for one-time payment
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "aitamate",
        description: `CV Recharge - Add ${orderData.cvs_to_add} CVs`,
        order_id: orderData.order_id,
        prefill: {
          name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
          email: user?.email || "",
          contact: ""
        },
        notes: {
          company_id: user.profile.company_id,
          plan_name: plan.plan_name,
          recharge_type: 'cv_topup'
        },
        theme: {
          color: "#1A56DB"
        },
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyResponse = await fetch(`${API_BASE_URL}/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: user.profile.company_id,
                plan_id: plan.plan_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!verifyResponse.ok) {
              throw new Error('Payment verification failed');
            }

            toast({
              title: "CV Recharge Successful",
              description: `${orderData.cvs_to_add} CVs added. Cycle date unchanged.`,
            });
            
            // Refresh company data
            await loadCompanyData();
          } catch (error: any) {
            console.error('Error processing CV recharge:', error);
            toast({
              title: "CV Recharge Error",
              description: error.message || "An error occurred. Please contact support.",
              variant: "destructive",
            });
          } finally {
            setRechargingCVs(false);
          }
        },
        modal: {
          ondismiss: function() {
            setRechargingCVs(false);
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
        setRechargingCVs(false);
      });
      
      rzp1.open();
      
    } catch (error: any) {
      console.error('Error initiating CV recharge:', error);
      toast({
        title: "CV Recharge Error",
        description: error.message || "Failed to initiate CV recharge. Please try again.",
        variant: "destructive",
      });
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
        throw new Error(errorData.error || 'Failed to change cycle date');
      }

      const result = await response.json();
      
      // Refresh company data
      await loadCompanyData();
      
      setCycleDateOpen(false);
      setNewCycleDay(1);
      
      toast({
        title: "Cycle Date Changed",
        description: result.message || `Billing cycle date changed to ${newCycleDay} (weekly cycle).`,
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
    if (!user?.profile?.company_id || !plan) {
      toast({
        title: "Error",
        description: "Missing company or plan information.",
        variant: "destructive",
      });
      return;
    }

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
        description: `Subscription for ${plan.plan_name}`,
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
          color: "#1A56DB"
        },
        handler: async function (response: any) {
          try {
            setLoading(true);
            
            toast({
              title: "Subscription Activated",
              description: subscriptionData.is_existing 
                ? "Using your existing subscription. Payments will continue automatically."
                : "Your subscription has been activated. Payments will be charged automatically every 7 days.",
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

  // Only render UI if admin
  if (!isAdmin) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <div className="text-sm text-muted-foreground mt-1">
          {plan ? (
            <>
              Plan: <b>{plan.plan_name}</b> | Max Users: <b>{maxUsers}</b> | Slots Left: <b>{slotsLeft}</b>
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
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-lg">Company Users</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRecharge} disabled={loading}>Recharge</Button>
            <Button variant="outline" onClick={handleCVRecharge} disabled={rechargingCVs || !plan}>
              {rechargingCVs ? 'Processing...' : 'Recharge CVs'}
            </Button>
            <Dialog open={cycleDateOpen} onOpenChange={setCycleDateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Cycle Date</Button>
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a day (1-31) for your new billing cycle start date. You can only prepone the date, not postpone it. Cycles are 7 days.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={newCycleDay}
                    onChange={(e) => setNewCycleDay(parseInt(e.target.value) || 1)}
                    placeholder="Day (1-31) - weekly cycle"
                  />
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
                      Current Plan: <strong>{plan?.plan_name || 'None'}</strong>
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
                        <SelectItem key={availablePlan.plan_name} value={availablePlan.plan_name}>
                          <div className="flex flex-col">
                            <span className="font-medium">{availablePlan.plan_name}</span>
                            <span className="text-xs text-muted-foreground">
                              ₹{availablePlan.plan_cost}/week • Max {availablePlan.max_users} users
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-t">
                  <td className="p-2">{u.first_name} {u.last_name}</td>
                  <td className="p-2 capitalize">{u.role}</td>
                  <td className="p-2 capitalize">{u.user_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
} 