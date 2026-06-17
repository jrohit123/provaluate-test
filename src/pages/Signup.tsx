import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startRecruiterPlanCheckout } from '@/utils/recruiterPayment';

interface Plan {
  plan_id: string;
  plan_name: string;
  plan_cost: number;
  duration: number; // in days
  plan_type: string;
  max_cvs?: number | null;
  max_interviews?: number | null;
  max_users?: number | null;
  active_jobs?: number | null;
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
  const [selectedPlanType, setSelectedPlanType] = useState<'cv' | 'interview' | 'combo' | ''>('');
  const [selectedTier, setSelectedTier] = useState('');
  const [useFreeTrialPlan, setUseFreeTrialPlan] = useState(false);
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
        // Fetch all active paid plans
        const { data: paidPlans, error: plansError } = await supabase
          .from('plans')
          .select('*')
          .eq('status', 'Active')
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
              // Get plan names for free/trial plans (plan_cost = 0)
              const { data: freePlanRows, error: freePlanNamesError } = await supabase
                .from('plans')
                .select('plan_name')
                .eq('plan_cost', 0);
              if (freePlanNamesError) throw freePlanNamesError;
              const freePlanNames = (freePlanRows || []).map((p: { plan_name: string }) => p.plan_name);
              // Check if any company with this domain has used a free/trial plan
              if (freePlanNames.length === 0) {
                trialEligible = true;
              } else {
                const { data: companiesWithTrial, error: trialError } = await supabase
                  .from('companies')
                  .select('company_id')
                  .eq('email_domain', domain)
                  .in('selected_plan', freePlanNames);
                if (trialError) throw trialError;
                trialEligible = !companiesWithTrial || companiesWithTrial.length === 0;
              }
            }
          }
        }
        
        setFreeTrialEligible(trialEligible);
        
        // Fetch active free/trial plans (plan_cost = 0) if eligible and domain not blocked
        if (trialEligible && !domainBlocked) {
          const { data: freeTrialPlans, error: freeTrialError } = await supabase
            .from('plans')
            .select('*')
            .eq('plan_cost', 0)
            .eq('status', 'Active');
          if (freeTrialError) throw freeTrialError;
          if (freeTrialPlans && freeTrialPlans.length > 0) {
            // Add trial plans at the beginning of the list
            plansList = [...freeTrialPlans, ...plansList];
          }
        }
        
        setPlans(plansList);
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

  useEffect(() => {
    if (useFreeTrialPlan) {
      const freePlan = plans.find((p: any) => Number(p.plan_cost) === 0);
      if (freePlan) setSelectedPlanId(freePlan.plan_id);
      return;
    }
    if (selectedPlanType && selectedTier) {
      const match = plans.find(
        (p: any) =>
          p.plan_type === selectedPlanType &&
          p.plan_name === selectedTier &&
          Number(p.plan_cost) > 0
      );
      setSelectedPlanId(match ? match.plan_id : '');
    } else {
      setSelectedPlanId('');
    }
  }, [selectedPlanType, selectedTier, useFreeTrialPlan, plans]);

  const paidPlans = plans.filter((p: any) => Number(p.plan_cost) > 0);
  const freePlan = plans.find((p: any) => Number(p.plan_cost) === 0);

  const availablePlanTypes = Array.from(new Set(paidPlans.map((p: any) => p.plan_type))) as string[];

  const availableTiers = selectedPlanType
    ? Array.from(new Set(paidPlans.filter((p: any) => p.plan_type === selectedPlanType).map((p: any) => p.plan_name))) as string[]
    : [];

  const selectedPlanObj = selectedPlanId
    ? plans.find((p: any) => p.plan_id === selectedPlanId) ?? null
    : null;

  const planTypeLabel = (pt: string) =>
    pt === 'cv' ? 'CV Only' : pt === 'interview' ? 'Interviews Only' : 'Combo';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Prevent submission if domain is blocked
    if (domainBlocked) {
      setError('Cannot register with a blocked domain. Please use a different email address.');
      return;
    }
    
    if (!firstName || !lastName || !email || !password || !companyName) {
      setError('All fields are required.');
      return;
    }
    const planId = selectedPlanId;
    if (!planId) {
      setError('Please select a plan.');
      setLoading(false);
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
      // Forever Free (duration 0) or null: no expiry; otherwise set subscription_end from duration
      const isForever = plan.duration === 0 || plan.duration == null;
      const subscriptionEnd = isForever ? null : new Date(now.getTime() + (plan.duration ?? 30) * 24 * 60 * 60 * 1000);
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          company_name: companyName,
          email_domain: domain,
          selected_plan: plan.plan_name,
          plan_type: plan.plan_type, // cv / interview / combo
          subscription_status: 'active',
          subscription_start: now.toISOString(),
          subscription_end: subscriptionEnd ? subscriptionEnd.toISOString() : null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();
      if (createCompanyError) throw createCompanyError;
      // Create user in Supabase Auth
      const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}login`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
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
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
          user_status: 'active',
          created_at: now.toISOString(),
        });
      if (userDbError) throw userDbError;

      // If paid plan selected, create order and open one-time payment
      const isPaidPlan = plan.plan_cost && plan.plan_cost > 0;
      if (isPaidPlan) {
        try {
          setLoading(false);
          const opened = await startRecruiterPlanCheckout({
            companyId: newCompany.company_id,
            planId: plan.plan_id,
            planName: plan.plan_name,
            prefill: {
              name: `${firstName} ${lastName}`.trim() || email.split('@')[0] || 'Customer',
              email,
            },
            onSuccess: () => {
              toast.success('Payment successful! Please log in to continue.');
              navigate('/login');
            },
            onError: (message) => {
              toast.error(message);
            },
            onDismiss: () => {
              toast.info('Payment cancelled. You can complete payment later from your dashboard.');
              navigate('/login');
            },
          });
          if (!opened) {
            toast.warning('Payment gateway could not be loaded. You can pay from your dashboard after logging in.');
            navigate('/login');
          }
          return;
        } catch (paymentError: any) {
          console.error('Error starting payment:', paymentError);
          toast.warning('Account created but payment setup failed. Please use Purchase Plan after logging in.');
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
            {/* When domain is blocked, hide the plan selector entirely */}
            {!domainBlocked && (
              <>
                {/* Free Tier option (only if eligible) */}
                {freeTrialEligible && freePlan && (
                  <div
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      useFreeTrialPlan
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-gray-50 hover:border-green-400'
                    }`}
                    onClick={() => {
                      setUseFreeTrialPlan(!useFreeTrialPlan);
                      if (!useFreeTrialPlan) {
                        setSelectedPlanType('');
                        setSelectedTier('');
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        readOnly
                        checked={useFreeTrialPlan}
                        className="w-4 h-4 accent-green-600 pointer-events-none"
                      />
                      <div>
                        <div className="font-semibold text-green-700 text-sm">Start with Free Tier</div>
                        <div className="text-xs text-green-600 mt-0.5">
                          {freePlan.max_cvs ?? 0} CVs · {freePlan.max_interviews ?? 0} Interviews · {freePlan.max_users} User · No expiry
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Paid plan selector */}
                {!useFreeTrialPlan && (
                  <>
                    {/* Dropdown 1: Plan Type */}
                    <Select
                      value={selectedPlanType}
                      onValueChange={(val) => {
                        setSelectedPlanType(val as any);
                        setSelectedTier(''); // reset tier when type changes
                      }}
                      required={!useFreeTrialPlan}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select plan type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlanTypes.map((pt) => (
                          <SelectItem key={pt} value={pt}>
                            {planTypeLabel(pt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Dropdown 2: Tier (only when type is selected) */}
                    {selectedPlanType && (
                      <Select
                        value={selectedTier}
                        onValueChange={setSelectedTier}
                        required={!useFreeTrialPlan}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select tier..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTiers.map((tier) => (
                            <SelectItem key={tier} value={tier}>
                              {tier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Read-only plan details (only when both are selected) */}
                    {selectedPlanObj && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2.5 font-semibold text-gray-800 text-sm">
                          ₹{selectedPlanObj.plan_cost} for {selectedPlanObj.max_cvs ?? 0} CVs and {selectedPlanObj.max_interviews ?? 0} IVs
                        </div>
                        <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 italic">
                          Valid for 365 days from date of purchase
                        </div>
                        <div className="bg-gray-50 px-4 pb-2 text-xs text-gray-400">
                          Max Users: {selectedPlanObj.max_users} · Active JDs: {selectedPlanObj.active_jobs === 0 ? 'Unlimited' : selectedPlanObj.active_jobs}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Free Tier details */}
                {useFreeTrialPlan && freePlan && (
                  <div className="border border-green-200 rounded-lg overflow-hidden">
                    <div className="bg-green-50 px-4 py-2.5 font-semibold text-green-800 text-sm">
                      Free — {freePlan.max_cvs ?? 0} CVs and {freePlan.max_interviews ?? 0} IVs
                    </div>
                    <div className="bg-green-50 px-4 py-2 text-xs text-green-600 italic border-t border-green-200">
                      Forever free with limited usage
                    </div>
                  </div>
                )}
              </>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || domainBlocked || (!selectedPlanId)}
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