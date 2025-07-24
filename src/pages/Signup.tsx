import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Plan {
  plan_id: string;
  plan_name: string;
  plan_cost: number;
  duration: number; // in days
}

export default function Signup() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [freeTrialEligible, setFreeTrialEligible] = useState(false);

  // Fetch plans and check free trial eligibility
  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all paid plans
        const { data: paidPlans, error: plansError } = await supabase
          .from('plans')
          .select('*')
          .gt('plan_cost', 0);
        if (plansError) throw plansError;
        let plansList = paidPlans || [];

        // Check free trial eligibility if email is entered
        let trialEligible = false;
        if (email) {
          const domain = email.split('@')[1]?.toLowerCase();
          if (domain) {
            // Check if any company with this domain has used FreeTrial-30
            const { data: companiesWithTrial, error: trialError } = await supabase
              .from('companies')
              .select('company_id')
              .eq('email_domain', domain)
              .eq('selected_plan', 'FreeTrial-30');
            if (trialError) throw trialError;
            trialEligible = !companiesWithTrial || companiesWithTrial.length === 0;
          }
        }
        setFreeTrialEligible(trialEligible);
        // Fetch FreeTrial-30 plan if eligible
        if (trialEligible) {
          const { data: freeTrialPlan, error: freeTrialError } = await supabase
            .from('plans')
            .select('*')
            .eq('plan_name', 'FreeTrial-30')
            .single();
          if (freeTrialError) throw freeTrialError;
          if (freeTrialPlan) plansList = [freeTrialPlan, ...plansList];
        }
        setPlans(plansList);
        if (plansList.length > 0) setSelectedPlanId(plansList[0].plan_id);
      } catch (err: any) {
        setError(err.message || 'Failed to load plans.');
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
    // Only re-run when email changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName || !lastName || !email || !password || !companyName || !selectedPlanId) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      // Extract domain
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) throw new Error('Invalid email address.');
      // Check if company exists by domain
      const { data: existingCompanies, error: companyError } = await supabase
        .from('companies')
        .select('company_id')
        .eq('email_domain', domain);
      if (companyError) throw companyError;
      if (existingCompanies && existingCompanies.length > 0) {
        setError('A company with your email domain already exists. Please contact your company admin to be invited.');
        setLoading(false);
        return;
      }
      // Get selected plan details
      const plan = plans.find(p => p.plan_id === selectedPlanId);
      if (!plan) throw new Error('Invalid plan selection.');
      // Create company
      const now = new Date();
      const subscriptionEnd = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          company_name: companyName,
          email_domain: domain,
          selected_plan: plan.plan_name,
          subscription_status: 'active',
          subscription_start: now.toISOString(),
          subscription_end: subscriptionEnd.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();
      if (createCompanyError) throw createCompanyError;
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_id: newCompany.company_id,
            company_name: companyName,
            role: 'admin',
          },
        },
      });
      if (authError) throw authError;
      // Create user in users table
      const { error: userDbError } = await supabase
        .from('users')
        .insert({
          user_id: authData.user?.id,
          company_id: newCompany.company_id,
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
          user_status: 'active',
          created_at: now.toISOString(),
        });
      if (userDbError) throw userDbError;
      toast.success('Signup successful! Please log in to continue.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary-800">Create Your Company Account</CardTitle>
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
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
                    {plan.plan_name} ({plan.duration} days) - ₹{plan.plan_cost}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing Up...' : 'Sign Up'}
            </Button>
            {error && <div className="text-red-600 text-sm text-center mt-2">{error}</div>}
            <div className="text-center text-sm mt-2">
              Already have an account?{' '}
              <span
                className="text-primary-700 underline cursor-pointer"
                onClick={() => navigate('/login')}
              >
                Login
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 