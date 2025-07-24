import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';

export default function AdminUserManagement() {
  // All hooks must be called unconditionally
  const { user } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', role: 'user' });
  const [inviteError, setInviteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allPlans, setAllPlans] = useState<any[]>([]); // Track all plans for warning
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
        // Fetch and log all plans for debugging
        const { data: allPlansData } = await supabase
          .from('plans')
          .select('*');
        setAllPlans(allPlansData || []);
        console.log('All plans:', allPlansData);
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
        {allPlans.length === 0 && (
          <div className="text-yellow-600 text-xs mt-1">Warning: No plans found in the system. Please check your Supabase data and RLS policies.</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-lg">Company Users</div>
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
                  placeholder="Email"
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