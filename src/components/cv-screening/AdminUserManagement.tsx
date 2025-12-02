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
    if (!selectedNewPlan || !company) {
      toast({
        title: "Error",
        description: "Please select a plan to change to.",
        variant: "destructive",
      });
      return;
    }

    setChangingPlan(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ selected_plan: selectedNewPlan })
        .eq('company_id', company.company_id);

      if (error) throw error;

      // Update local state
      setCompany(prev => ({ ...prev, selected_plan: selectedNewPlan }));
      
      // Fetch updated plan data
      const selectedPlanData = availablePlans.find(p => p.plan_name === selectedNewPlan);
      setPlan(selectedPlanData);
      
      setPlanChangeOpen(false);
      setSelectedNewPlan('');
      
      toast({
        title: "Plan Updated",
        description: `Successfully updated to ${selectedNewPlan} plan.`,
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast({
        title: "Error",
        description: "Failed to update plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChangingPlan(false);
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
      
      // Step 1: Create order on backend
      const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
      const createOrderResponse = await fetch(`${API_BASE_URL}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: user.profile.company_id,
          plan_id: plan.plan_id
        })
      });

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.error || 'Failed to create payment order');
      }

      const orderData = await createOrderResponse.json();
      
      // Step 2: Check if Razorpay is loaded
      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      // Step 3: Open Razorpay checkout
      const options = {
        key: orderData.key_id, // Use key from backend response
        amount: orderData.amount.toString(),
        currency: orderData.currency,
        name: "aitamate",
        description: `Subscription renewal for ${plan.plan_name}`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            setLoading(true);
            
            // Step 4: Verify payment on backend
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
              const errorData = await verifyResponse.json();
              throw new Error(errorData.error || 'Payment verification failed');
            }

            const verifyData = await verifyResponse.json();
            
            toast({
              title: "Payment Successful",
              description: "Your subscription has been renewed successfully.",
            });
            
            // Refresh company data
            await loadCompanyData();
            
          } catch (error: any) {
            console.error('Error verifying payment:', error);
            toast({
              title: "Payment Verification Failed",
              description: error.message || "Payment was successful but verification failed. Please contact support.",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || "Customer",
          email: user?.email || "",
          contact: ""
        },
        notes: {
          company_id: company?.company_id || "",
          user_id: user?.id || "",
          plan_name: plan.plan_name
        },
        theme: {
          color: "#1A56DB"
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
      console.error('Error initiating payment:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initiate payment. Please try again.",
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
            <Button variant="outline" onClick={handleRecharge}>Recharge</Button>
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
                              INR {availablePlan.plan_cost}/month • Max {availablePlan.max_users} users
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