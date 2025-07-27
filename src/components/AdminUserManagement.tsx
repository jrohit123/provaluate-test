import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (!isAdmin) return; // Only fetch if admin
    setLoading(true);
    const fetchData = async () => {
      try {
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
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
    try {
      const session = await supabase.auth.getSession();
      const jwt = session.data.session?.access_token;
      if (!jwt) {
        setInviteError('You must be logged in.');
        setLoading(false);
        return;
      }
      const res = await fetch('/functions/v1/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ email: inviteForm.email, role: inviteForm.role }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteSuccess('Invitation sent!');
        setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
        setInviteOpen(false);
        // Optionally refresh users/invitations here
      } else {
        setInviteError(data.error || 'Failed to send invitation.');
      }
    } catch (err) {
      setInviteError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
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
            <Dialog open={planChangeOpen} onOpenChange={setPlanChangeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Plan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Company Plan</DialogTitle>
                </DialogHeader>
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
                      {availablePlans.map(availablePlan => (
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
              </DialogHeader>
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