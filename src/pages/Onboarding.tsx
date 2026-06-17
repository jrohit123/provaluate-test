import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/utils/sessionManager';
import { startRecruiterPlanCheckout } from '@/utils/recruiterPayment';

export default function Onboarding() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedPlanType, setSelectedPlanType] = useState<'cv' | 'interview' | 'combo' | ''>('');
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedPath, setSelectedPath] = useState<'free' | 'paid' | ''>('');
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
      // Check if user already has completed onboarding
      const { data: userProfile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('user_id', authUser.id)
        .single();
      if (userProfile && userProfile.onboarding_complete) {
        navigate('/services');
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
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPath === 'free') {
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
  }, [selectedPlanType, selectedTier, selectedPath, plans]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedPath) {
      setError('Please choose how you want to get started.');
      return;
    }
    const planId = selectedPlanId;
    if (!planId) {
      setError('Please select a plan.');
      setLoading(false);
      return;
    }
    setLoading(true);
    let willNavigate = false;
    try {
      // Get user email and validate it exists
      const email = user?.email;
      if (!email) {
        setError('Email not found in your account. Please log out and log back in.');
        setLoading(false);
        return;
      }
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) {
        setError('Invalid email address format.');
        setLoading(false);
        return;
      }
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
      if (!plan) {
        setError('Selected plan is invalid. Please try again.');
        setLoading(false);
        return;
      }
      // Duration can be 0 (Forever Free) or a number; reject only if invalid number
      const durationNum = plan.duration != null ? Number(plan.duration) : 0;
      if (durationNum < 0 || (plan.duration != null && isNaN(durationNum))) {
        setError('Selected plan is invalid. Please try again.');
        setLoading(false);
        return;
      }
      // Create company: Forever Free (duration 0) = no subscription_end; otherwise set end from duration
      const now = new Date();
      const isForever = durationNum === 0;
      const subscriptionEnd = isForever ? null : new Date(now.getTime() + durationNum * 24 * 60 * 60 * 1000);
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          company_name: companyName,
          email_domain: domain,
          selected_plan: plan.plan_name,
          plan_type: plan.plan_type, // cv / interview / combo
          subscription_status: 'Active',
          subscription_start: now.toISOString(),
          subscription_end: subscriptionEnd ? subscriptionEnd.toISOString() : null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();
      if (createCompanyError) throw createCompanyError;
      // Create user in users table
      console.log('🔍 EMAIL DEBUG - Email variable:', email);
      console.log('🔍 EMAIL DEBUG - Email type:', typeof email);
      console.log('🔍 EMAIL DEBUG - Email length:', email?.length);
      console.log('🔍 EMAIL DEBUG - User.email:', user?.email);
      
      const insertData = {
        user_id: user.id,
        company_id: newCompany.company_id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        user_status: 'active',
        onboarding_complete: true,
        created_at: now.toISOString(),
      };
      
      console.log('🔍 EMAIL DEBUG - Insert data email field:', insertData.email);
      console.log('🔍 EMAIL DEBUG - Full insert data:', JSON.stringify(insertData, null, 2));
      
      const { data: insertedUser, error: userDbError } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single();
      
      if (userDbError) {
        console.error('❌ User insert error:', userDbError);
        console.error('❌ Error details:', JSON.stringify(userDbError, null, 2));
        throw userDbError;
      }
      
      console.log('✅ EMAIL DEBUG - Inserted user email:', insertedUser?.email);
      console.log('✅ EMAIL DEBUG - Full inserted user:', JSON.stringify(insertedUser, null, 2));

      console.log('✅ Step 1: User profile created with onboarding_complete = true');

      // 🔥 ADD SESSION CREATION HERE
      console.log('🔄 Step 2: Creating session...');
      const sessionData = await SessionManager.createSession(user.id);
      if (!sessionData) {
        console.error('❌ Failed to create session');
        throw new Error('Failed to create session');
      }
      console.log('✅ Step 2: Session created:', sessionData.session_id);

      // End other sessions
      console.log('🔄 Step 3: Ending other sessions...');
      await SessionManager.endAllOtherSessions(user.id, sessionData.session_id);
      console.log('✅ Step 3: Other sessions ended');

      // Set auth flag
      localStorage.setItem('recruitai_auth', 'true');
      console.log('✅ Step 4: Auth flag set in localStorage');

      // If paid plan selected, create order and open one-time payment
      const isPaidPlan = plan.plan_cost && plan.plan_cost > 0;
      if (isPaidPlan) {
        try {
          const opened = await startRecruiterPlanCheckout({
            companyId: newCompany.company_id,
            planId: plan.plan_id,
            planName: plan.plan_name,
            prefill: {
              name: `${firstName} ${lastName}`.trim() || user.email.split('@')[0] || 'Customer',
              email: user.email,
            },
            onSuccess: () => {
              willNavigate = true;
              window.location.href = '/dashboard?section=main-dashboard';
            },
            onError: () => {
              willNavigate = true;
              window.location.href = '/dashboard?section=main-dashboard';
            },
            onDismiss: () => {
              willNavigate = true;
              window.location.href = '/dashboard?section=main-dashboard';
            },
          });
          if (!opened) {
            willNavigate = true;
            window.location.href = '/dashboard?section=main-dashboard';
          }
          return;
        } catch (paymentError: any) {
          console.error('Error starting payment:', paymentError);
          willNavigate = true;
          window.location.href = '/dashboard?section=main-dashboard';
          return;
        }
      } else {
        // FreeTrial - no payment needed, just navigate
        console.log('User profile created!');
        willNavigate = true;
        // Navigate immediately - keep loading true so form doesn't show again
        window.location.href = '/dashboard?section=main-dashboard';
      }
    } catch (err) {
      setError(err.message || 'Onboarding failed.');
      setLoading(false);
    } finally {
      // Only set loading to false if we're not navigating
      // If we're navigating, keep loading true to prevent form from showing
      if (!willNavigate) {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Choose how to get started
            </p>

            {/* ── Free path card ── */}
            {freePlan && (
              <div
                onClick={() => {
                  setSelectedPath('free');
                  setSelectedPlanType('');
                  setSelectedTier('');
                }}
                className={`border rounded-lg p-3.5 cursor-pointer transition-colors ${
                  selectedPath === 'free'
                    ? 'border-primary-700 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedPath === 'free' ? 'border-primary-700' : 'border-gray-300'
                  }`}>
                    {selectedPath === 'free' && (
                      <div className="w-2 h-2 rounded-full bg-primary-700" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-black">Start free</span>
                    </div>
                    <p className="text-xs text-black">
                      {freePlan.max_cvs ?? 0} CVs · {freePlan.max_interviews ?? 0} interviews · {freePlan.max_users} user · No expiry
                    </p>
                    <p className="text-xs text-black italic mt-1">
                      Upgrade anytime from Admin Settings
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Paid path card ── */}
            <div
              onClick={() => setSelectedPath('paid')}
              className={`border rounded-lg p-3.5 cursor-pointer transition-colors ${
                selectedPath === 'paid'
                  ? 'border-primary-700 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPath === 'paid' ? 'border-primary-700' : 'border-gray-300'
                }`}>
                  {selectedPath === 'paid' && (
                    <div className="w-2 h-2 rounded-full bg-primary-700" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-black">Choose a plan</span>
                  <p className="text-xs text-black mt-1">
                    CV only · Interviews only · Combo — from ₹2,500
                  </p>

                  {selectedPath === 'paid' && (
                    <div
                      className="mt-3 pt-3 border-t border-gray-200 space-y-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <Select
                        value={selectedPlanType}
                        onValueChange={(val) => {
                          setSelectedPlanType(val as any);
                          setSelectedTier('');
                        }}
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

                      {selectedPlanType && (
                        <Select value={selectedTier} onValueChange={setSelectedTier}>
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

                      {selectedPlanObj && (
                        <div className="border rounded-lg overflow-hidden mt-1">
                          <div className="bg-gray-100 px-4 py-2.5 font-semibold text-black text-sm">
                            ₹{selectedPlanObj.plan_cost} for {selectedPlanObj.max_cvs ?? 0} CVs and {selectedPlanObj.max_interviews ?? 0} IVs
                          </div>
                          <div className="bg-gray-50 px-4 py-2 text-xs text-black italic font-semibold">
                            Valid for 365 days from date of purchase
                          </div>
                          <div className="bg-gray-50 px-4 pb-2 text-xs text-black font-semibold">
                            Max Users: {selectedPlanObj.max_users} · Active JDs: {selectedPlanObj.active_jobs === 0 ? 'Unlimited' : selectedPlanObj.active_jobs}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-black italic font-semibold">
                        Can't decide? You can always start free instead.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
