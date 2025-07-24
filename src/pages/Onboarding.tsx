import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Onboarding() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      // Check auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/login');
        return;
      }
      setUser(authUser);
      // Check if user already has a profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', authUser.id)
        .single();
      if (userProfile) {
        navigate('/dashboard');
        return;
      }
      // Fetch active plans (including zero cost)
      const { data: activePlans, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .eq('status', 'Active');
      if (plansError) {
        setError('Failed to load plans.');
        setLoading(false);
        return;
      }
      setPlans(activePlans || []);
      if (activePlans && activePlans.length > 0) setSelectedPlanId(activePlans[0].plan_id);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!firstName || !lastName || !selectedPlanId || !companyName) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      // Get user email and domain
      const email = user.email;
      const domain = email.split('@')[1]?.toLowerCase();
      // Double check company does not exist
      const { data: existingCompanies } = await supabase
        .from('companies')
        .select('company_id')
        .eq('email_domain', domain);
      if (existingCompanies && existingCompanies.length > 0) {
        setError('A company with your email domain already exists. Please contact your company admin to be invited.');
        setLoading(false);
        return;
      }
      // Get selected plan details
      const plan = plans.find(p => p.plan_id === selectedPlanId);
      // Debug logging
      console.log('Selected plan:', plan);
      console.log('typeof plan.duration:', typeof plan?.duration);
      console.log('isNaN(plan.duration):', isNaN(plan?.duration));
      if (!plan || typeof plan.duration !== 'number' || isNaN(plan.duration)) {
        setError('Selected plan is invalid. Please try again.');
        setLoading(false);
        return;
      }
      // Create company
      const now = new Date();
      const subscriptionEnd = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          company_name: companyName,
          email_domain: domain,
          selected_plan: plan.plan_name,
          subscription_status: 'Active',
          subscription_start: now.toISOString(),
          subscription_end: subscriptionEnd.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();
      if (createCompanyError) throw createCompanyError;
      // Create user in users table
      const { error: userDbError } = await supabase
        .from('users')
        .insert({
          user_id: user.id,
          company_id: newCompany.company_id,
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
          user_status: 'active',
          created_at: now.toISOString(),
        });
      if (userDbError) throw userDbError;
      toast.success('Onboarding complete! You can now access your dashboard.');
      localStorage.setItem('onboarding_complete', 'true');
      console.log('User profile created!');
      setTimeout(() => window.location.replace('/dashboard'), 500);
    } catch (err) {
      setError(err.message || 'Onboarding failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary-800">Complete Your Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              placeholder="First Name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
            />
            <Input
              placeholder="Last Name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
            />
            <Input
              placeholder="Company Name"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              required
            />
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a plan..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map(plan => (
                  <SelectItem key={plan.plan_id} value={plan.plan_id}>
                    {plan.plan_name} - ₹{plan.plan_cost}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Submitting...' : 'Complete Onboarding'}
            </Button>
            {error && <div className="text-red-600 text-sm text-center mt-2">{error}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 