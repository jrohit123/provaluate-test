import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/utils/sessionManager';
import { useAuthContext } from '@/contexts/AuthContext';
import { API_CONFIG, buildApiUrl } from '@/constants/api';

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      order_id: string;
      handler: (r: { razorpay_payment_id: string; razorpay_signature: string }) => void;
    }) => { open: () => void };
  }
}

type Plan = { id: string; plan_name: string; jd_count: number; cost: number; interview_count: number; is_free: boolean };

const STEPS = { NAME_MOBILE: 1, OTP: 2, PLAN: 3 } as const;

function extractReferralSlug(pasted: string): string | null {
  const raw = pasted.trim();
  if (!raw) return null;
  if (raw.includes('/candidate-login/')) {
    const slug = raw.split('/candidate-login/')[1]?.split('?')[0]?.trim().replace(/\/$/, '');
    return slug || null;
  }
  return raw;
}

export default function CandidateOnboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthContext();

  const [step, setStep] = useState<typeof STEPS[keyof typeof STEPS]>(STEPS.NAME_MOBILE);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [referralPaste, setReferralPaste] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/candidate-login');
        return;
      }
      const { data: candidateRow } = await supabase
        .from('candidates')
        .select('candidate_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (candidateRow) {
        navigate('/candidate-dashboard');
        return;
      }
      setLoading(false);
    };
    run();
  }, [navigate]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const handleNameMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!mobile.trim()) {
      setError('Mobile number is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_SEND_OTP), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to send OTP.');
        setSubmitting(false);
        return;
      }
      setStep(STEPS.OTP);
      setOtp('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Enter the OTP you received.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_VERIFY_OTP), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), code: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Invalid or expired OTP.');
        setSubmitting(false);
        return;
      }
      const authUser = user ?? (await supabase.auth.getUser()).data.user;
      if (!authUser?.id || !authUser?.email) {
        setError('Session expired. Please sign in again.');
        setSubmitting(false);
        return;
      }
      const headers = await getAuthHeaders();
      const completeRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_ONBOARDING_COMPLETE), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          mobile: mobile.trim(),
          referral_slug: null,
        }),
      });
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        setError(completeData?.error || 'Failed to complete profile.');
        setSubmitting(false);
        return;
      }
      await refreshUser();
      setStep(STEPS.PLAN);
      setError('');
      const plansRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_PLANS));
      const plansData = await plansRes.json().catch(() => ({}));
      if (plansRes.ok && Array.isArray(plansData?.plans)) {
        setPlans(plansData.plans);
        const free = plansData.plans.find((p: Plan) => p.is_free);
        if (free) setSelectedPlanId(free.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setSubmitting(false);
  };

  const handlePlanSelectAndPay = async () => {
    if (!selectedPlanId) {
      setError('Please select a plan.');
      return;
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    if (plan.is_free) {
      const headers = await getAuthHeaders();
      const slug = extractReferralSlug(referralPaste);
      if (slug) {
        await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_APPLY_REFERRAL), {
          method: 'POST',
          headers,
          body: JSON.stringify({ referral_slug: slug }),
        });
      }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id) {
        const sessionData = await SessionManager.createSession(authUser.id);
        if (sessionData) {
          await SessionManager.endAllOtherSessions(authUser.id, sessionData.session_id);
          localStorage.setItem('recruitai_auth', 'true');
          await refreshUser();
          navigate('/candidate-dashboard');
        }
      }
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const slug = extractReferralSlug(referralPaste);
      if (slug) {
        await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_APPLY_REFERRAL), {
          method: 'POST',
          headers,
          body: JSON.stringify({ referral_slug: slug }),
        });
      }
      const orderRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_CREATE_ORDER), {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan_id: selectedPlanId, credits_to_use: 0 }),
      });
      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        setError(orderData?.error || 'Failed to create order.');
        setSubmitting(false);
        return;
      }
      const { order_id, amount, currency, key_id } = orderData;
      setRazorpayKeyId(key_id);
      const digitsOnly = mobile.trim().replace(/\D/g, '');
      const contactForRazorpay = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const options = {
        key: key_id,
        amount,
        currency,
        order_id,
        prefill: {
          contact: contactForRazorpay,
          ...(authUser?.email && { email: authUser.email }),
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_VERIFY_PAYMENT), {
              method: 'POST',
              headers,
              body: JSON.stringify({
                razorpay_order_id: order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
              setError(verifyData?.error || 'Payment verification failed.');
              setSubmitting(false);
              return;
            }
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser?.id) {
              const sessionData = await SessionManager.createSession(authUser.id);
              if (sessionData) {
                await SessionManager.endAllOtherSessions(authUser.id, sessionData.session_id);
                localStorage.setItem('recruitai_auth', 'true');
                await refreshUser();
                navigate('/candidate-dashboard');
              }
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed.');
          }
          setSubmitting(false);
        },
      };
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        setError('Payment gateway could not be loaded.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setSubmitting(false);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-3 sm:p-4 overflow-x-hidden">
      <Card className="w-full max-w-md shadow-lg border-0 mx-2">
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            {step === STEPS.NAME_MOBILE && 'Complete your profile'}
            {step === STEPS.OTP && 'Verify your mobile'}
            {step === STEPS.PLAN && 'Choose a plan'}
          </CardTitle>
          <p className="text-sm sm:text-base text-gray-600">
            {step === STEPS.NAME_MOBILE && 'Enter your name and mobile number. We’ll send you an OTP to verify.'}
            {step === STEPS.OTP && 'Enter the 6-digit OTP sent to your mobile.'}
            {step === STEPS.PLAN && 'Select a plan to get started. You can pay securely via Razorpay.'}
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          {step === STEPS.NAME_MOBILE && (
            <form className="space-y-4" onSubmit={handleNameMobileSubmit}>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">First name</Label>
                <Input
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Last name</Label>
                <Input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Mobile number</Label>
                <Input
                  placeholder="e.g. 9876543210 or +919876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={submitting}
                />
              </div>
              <Button type="submit" className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation" disabled={submitting}>
                {submitting ? 'Sending OTP...' : "Let's move forward"}
              </Button>
              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            </form>
          )}

          {step === STEPS.OTP && (
            <form className="space-y-4" onSubmit={handleVerifyOtp}>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">OTP</Label>
                <Input
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="min-h-[44px] h-11 text-base touch-manipulation text-center tracking-widest"
                  disabled={submitting}
                />
              </div>
              <Button type="submit" className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify'}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-sky-600 hover:text-sky-800"
                onClick={() => setStep(STEPS.NAME_MOBILE)}
                disabled={submitting}
              >
                Change mobile number
              </button>
              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            </form>
          )}

          {step === STEPS.PLAN && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Plan</Label>
                <select
                  className="w-full min-h-[44px] h-11 text-base border rounded-md px-3 bg-background"
                  value={selectedPlanId || ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                >
                  <option value="">Select a plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} – {p.is_free ? 'Free' : `₹${p.cost}`} ({p.interview_count} interviews, {p.jd_count} JD{p.jd_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Referral link (optional)</Label>
                <Input
                  placeholder="Paste the link shared by a friend"
                  value={referralPaste}
                  onChange={(e) => setReferralPaste(e.target.value)}
                  className="min-h-[44px] h-11 text-base"
                  disabled={submitting}
                />
              </div>
              <Button
                type="button"
                className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation"
                disabled={submitting || !selectedPlanId}
                onClick={handlePlanSelectAndPay}
              >
                {submitting ? 'Please wait...' : plans.find((p) => p.id === selectedPlanId)?.is_free ? 'Continue to dashboard' : 'Pay & continue'}
              </Button>
              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
