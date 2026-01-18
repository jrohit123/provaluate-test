import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SessionManager } from '@/utils/sessionManager';

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
              name: `${firstName} ${lastName}`.trim() || user.email.split('@')[0] || "Customer",
              email: user.email,
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
                toast.success('Onboarding complete! Subscription activated. Redirecting to dashboard...');
                // Changed from window.location.replace to navigate
                setTimeout(() => navigate('/dashboard?section=main-dashboard'), 1000);
              } catch (error: any) {
                console.error('Error processing subscription:', error);
                toast.success('Onboarding complete! Redirecting to dashboard...');
                setTimeout(() => navigate('/dashboard?section=main-dashboard'), 1000);
              }
            },
            modal: {
              ondismiss: function() {
                // User closed payment modal - still allow them to proceed
                // They can use "Recharge" button later to complete payment
                toast.info('Payment cancelled. You can complete payment later from your dashboard.');
                // Changed from window.location.replace to navigate
                setTimeout(() => navigate('/dashboard?section=main-dashboard'), 1000);
              }
            }
          };
          
          const rzp1 = new (window as any).Razorpay(options);
          
          rzp1.on('payment.failed', function (response: any) {
            console.error('Payment failed:', response.error);
            toast.warning('Payment failed. You can try again from your dashboard.');
            // Changed from window.location.replace to navigate
            setTimeout(() => navigate('/dashboard?section=main-dashboard'), 1000);
          });
          
          rzp1.open();
          setLoading(false);
          return; // Don't navigate yet, wait for payment
        } catch (subscriptionError: any) {
          console.error('Error creating subscription:', subscriptionError);
          // If subscription creation fails, still allow onboarding but show warning
          toast.warning('Onboarding complete but subscription setup failed. Please use "Recharge" button to complete payment.');
          setTimeout(() => navigate('/dashboard?section=main-dashboard'), 1000);
          return;
        }
      } else {
        // FreeTrial - no payment needed, just navigate
        toast.success('Onboarding complete! Redirecting to your dashboard.');
        console.log('User profile created!');
        // Changed from window.location.replace to navigate
        setTimeout(() => navigate('/dashboard?section=main-dashboard'), 500);
      }
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