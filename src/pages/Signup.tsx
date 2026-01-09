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
  const [domainBlocked, setDomainBlocked] = useState(false);
  const [domainBlockReason, setDomainBlockReason] = useState('');

  // Fetch plans, check free trial eligibility, and check domain blocking
  useEffect(() => {
    const fetchPlansAndCheckDomain = async () => {
      setLoading(true);
      setError('');
      setDomainBlocked(false);
      setDomainBlockReason('');
      
      try {
        // Fetch all paid plans
        const { data: paidPlans, error: plansError } = await supabase
          .from('plans')
          .select('*')
          .gt('plan_cost', 0);
        if (plansError) throw plansError;
        let plansList = paidPlans || [];

        // Check domain blocking and free trial eligibility if email is entered
        let trialEligible = false;
        if (email) {
          const domain = email.split('@')[1]?.toLowerCase();
          if (domain) {
            // Check if domain is blocked
            const { data: blockedDomains, error: blockedDomainError } = await supabase
              .from('blocked_domains')
              .select('domain, reason')
              .eq('domain', domain)
              .eq('status', 'active');
            
            if (blockedDomainError) {
              console.error('Error checking blocked domains:', blockedDomainError);
            } else if (blockedDomains && blockedDomains.length > 0) {
              const blockedDomain = blockedDomains[0];
              setDomainBlocked(true);
              setDomainBlockReason(blockedDomain.reason || 'This domain is not allowed for registration');
              // Don't check free trial eligibility for blocked domains
            } else {
              // Check if any company with this domain has used any trial plan (FreeTrial-30 or Multi_User_Free)
              const { data: companiesWithTrial, error: trialError } = await supabase
                .from('companies')
                .select('company_id')
                .eq('email_domain', domain)
                .in('selected_plan', ['FreeTrial-30', 'Multi_User_Free']);
              if (trialError) throw trialError;
              trialEligible = !companiesWithTrial || companiesWithTrial.length === 0;
            }
          }
        }
        
        setFreeTrialEligible(trialEligible);
        
        // Fetch both FreeTrial plans if eligible and domain not blocked
        if (trialEligible && !domainBlocked) {
          const { data: freeTrialPlans, error: freeTrialError } = await supabase
            .from('plans')
            .select('*')
            .in('plan_name', ['FreeTrial-30', 'Multi_User_Free']);
          if (freeTrialError) throw freeTrialError;
          if (freeTrialPlans && freeTrialPlans.length > 0) {
            // Add trial plans at the beginning of the list
            plansList = [...freeTrialPlans, ...plansList];
          }
        }
        
        setPlans(plansList);
        if (plansList.length > 0) setSelectedPlanId(plansList[0].plan_id);
      } catch (err: any) {
        setError(err.message || 'Failed to load plans.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlansAndCheckDomain();
    // Only re-run when email changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Prevent submission if domain is blocked
    if (domainBlocked) {
      setError('Cannot register with a blocked domain. Please use a different email address.');
      return;
    }
    
    if (!firstName || !lastName || !email || !password || !companyName || !selectedPlanId) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      // Extract domain
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) throw new Error('Invalid email address.');
      
      // Check if domain is blocked
      const { data: blockedDomains, error: blockedDomainError } = await supabase
        .from('blocked_domains')
        .select('domain, reason')
        .eq('domain', domain)
        .eq('status', 'active');
      
      if (blockedDomainError) {
        console.error('Error checking blocked domains:', blockedDomainError);
        // Continue with signup if we can't check blocked domains (don't block due to system error)
      } else if (blockedDomains && blockedDomains.length > 0) {
        const blockedDomain = blockedDomains[0];
        const reason = blockedDomain.reason || 'This domain is not allowed for registration';
        setError(`Registration not allowed: ${reason}. Please contact support if you believe this is an error.`);
        setLoading(false);
        return;
      }
      
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

      // If paid plan selected, create subscription and open payment
      const isPaidPlan = plan.plan_cost && plan.plan_cost > 0;
      if (isPaidPlan) {
        // Paid plan - create subscription and open Razorpay checkout
        const API_BASE_URL = import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com';
        
        try {
          // Step 1: Create subscription on backend
          const createSubscriptionResponse = await fetch(`${API_BASE_URL}/payments/create-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: newCompany.company_id,
              plan_id: plan.plan_id
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
            description: `Subscription for ${plan.plan_name} - ₹${plan.plan_cost}/month`,
            prefill: {
              name: `${firstName} ${lastName}`.trim() || email.split('@')[0] || "Customer",
              email: email,
              contact: ""
            },
            notes: {
              company_id: newCompany.company_id,
              plan_name: plan.plan_name
            },
            theme: {
              color: "#1A56DB"
            },
            handler: async function (response: any) {
              try {
                toast.success('Subscription activated! Please log in to continue.');
                navigate('/login');
              } catch (error: any) {
                console.error('Error processing subscription:', error);
                toast.error('Subscription activated but an error occurred. Please log in.');
                navigate('/login');
              }
            },
            modal: {
              ondismiss: function() {
                // User closed payment modal - still allow them to login
                // They can use "Recharge" button later to complete payment
                toast.info('Payment cancelled. You can complete payment later from your dashboard.');
                navigate('/login');
              }
            }
          };
          
          const rzp1 = new (window as any).Razorpay(options);
          
          rzp1.on('payment.failed', function (response: any) {
            console.error('Payment failed:', response.error);
            toast.error('Payment failed. You can try again from your dashboard after logging in.');
            navigate('/login');
          });
          
          rzp1.open();
          setLoading(false);
          return; // Don't navigate yet, wait for payment
        } catch (subscriptionError: any) {
          console.error('Error creating subscription:', subscriptionError);
          // If subscription creation fails, still allow signup but show warning
          toast.warning('Account created but subscription setup failed. Please use "Recharge" button after logging in.');
          navigate('/login');
          return;
        }
      } else {
        // FreeTrial - no payment needed, just navigate
        toast.success('Signup successful! Please log in to continue.');
        navigate('/login');
      }
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
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={domainBlocked ? 'border-red-500 focus:border-red-500' : ''}
              />
              {domainBlocked && (
                <div className="text-red-600 text-sm mt-1 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {domainBlockReason}
                </div>
              )}
            </div>
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
                    {plan.plan_name} - ₹{plan.plan_cost}/month
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || domainBlocked}
            >
              {loading ? 'Signing Up...' : domainBlocked ? 'Domain Not Allowed' : 'Sign Up'}
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