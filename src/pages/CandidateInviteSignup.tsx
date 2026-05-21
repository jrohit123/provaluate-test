import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/utils/sessionManager';
import { useAuthContext } from '@/contexts/AuthContext';
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import { Loader2 } from 'lucide-react';
import { buildCandidateRazorpayOptions, openCandidateRazorpayCheckout } from '@/utils/candidateRazorpayCheckout';

type Plan = {
  id: string;
  plan_name: string;
  jd_count: number;
  cost: number;
  interview_count: number;
  is_free: boolean;
};

type InvitePayload = {
  first_name: string;
  last_name: string;
  college_email: string;
  college_name: string;
  college_code?: string;
  course_name: string;
  discount_percentage: number;
  valid_until?: string;
  mobile?: string | null;
};

const STEPS = { ACCOUNT: 1, PLAN: 2 } as const;

export default function CandidateInviteSignup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { refreshUser } = useAuthContext();

  const [step, setStep] = useState<(typeof STEPS)[keyof typeof STEPS]>(STEPS.ACCOUNT);
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pricingPreview, setPricingPreview] = useState<{
    list_price: number;
    projected_amount_payable_with_max_credits: number;
    college_discount_percentage: number;
  } | null>(null);
  const [finishingPayment, setFinishingPayment] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('invalid_token');
      setLoading(false);
      return;
    }
    void (async () => {
      const res = await fetch(
        `${buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_INVITE_VALIDATE)}?token=${encodeURIComponent(token)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTokenError(String(data.error || 'invalid_token'));
        setLoading(false);
        return;
      }
      setInvite(data as InvitePayload);
      setFirstName(String(data.first_name || ''));
      setLastName(String(data.last_name || ''));
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (step !== STEPS.PLAN) return;
    void (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (u?.email) setSessionEmail(u.email);
    })();
  }, [step]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  };

  const finishToDashboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    const sessionData = await SessionManager.createSession(user.id);
    if (!sessionData) return;
    await SessionManager.endAllOtherSessions(user.id, sessionData.session_id);
    localStorage.setItem('recruitai_auth', 'true');
    await refreshUser();
    navigate('/candidate-dashboard', { replace: true });
  };

  const goToPlans = async () => {
    const plansRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_PLANS));
    const plansData = await plansRes.json().catch(() => ({}));
    if (plansRes.ok && Array.isArray(plansData?.plans)) {
      setPlans(plansData.plans);
      const free = plansData.plans.find((p: Plan) => p.is_free);
      if (free) setSelectedPlanId(free.id);
    }
    setStep(STEPS.PLAN);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !password.trim()) {
      setError('First name and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_INVITE_ACTIVATE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Activation failed');
      if (!data.access_token || !data.refresh_token) {
        throw new Error('No session returned from server');
      }
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      await refreshUser();
      if (data.college_name) {
        setInvite((prev) => ({
          ...(prev || {
            first_name: firstName,
            last_name: lastName,
            college_email: '',
            college_name: '',
            course_name: '',
            discount_percentage: 0,
          }),
          college_name: data.college_name,
          college_code: data.college_code,
          course_name: data.course_name || prev?.course_name || '',
          discount_percentage: Number(data.discount_percentage) || 0,
          valid_until: data.valid_until,
        }));
      }
      await goToPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setSubmitting(false);
  };

  useEffect(() => {
    if (step !== STEPS.PLAN || !selectedPlanId) return;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan || plan.is_free) {
      setPricingPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_PLAN_PRICING)}?plan_id=${encodeURIComponent(selectedPlanId)}`,
        { headers }
      );
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setPricingPreview({
        list_price: Number(data.list_price ?? plan.cost),
        projected_amount_payable_with_max_credits: Number(
          data.projected_amount_payable_with_max_credits ?? data.amount_after_college ?? plan.cost
        ),
        college_discount_percentage: Number(
          data.college_discount_percentage ?? invite?.discount_percentage ?? 0
        ),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selectedPlanId, plans, invite?.discount_percentage]);

  const handlePlanSelectAndPay = async () => {
    if (!selectedPlanId) {
      setError('Please select a plan.');
      return;
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;

    if (plan.is_free) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser?.id) {
        await finishToDashboard();
      }
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
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
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const options = buildCandidateRazorpayOptions({
        key: key_id,
        amount,
        currency,
        order_id,
        description: plan.plan_name,
        prefill: {
          ...(authUser?.email && { email: authUser.email }),
        },
        onDismiss: () => setSubmitting(false),
        onSuccess: async (response) => {
          setFinishingPayment(true);
          setSubmitting(false);
          try {
            const verifyRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_VERIFY_PAYMENT), {
              method: 'POST',
              headers,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id || order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
              setFinishingPayment(false);
              setError(verifyData?.error || 'Payment verification failed.');
              return;
            }
            await finishToDashboard();
          } catch (err) {
            setFinishingPayment(false);
            setError(err instanceof Error ? err.message : 'Payment verification failed.');
          }
        },
      });
      if (!openCandidateRazorpayCheckout(options, (msg) => {
        setError(msg);
        setSubmitting(false);
      })) {
        setError('Payment gateway could not be loaded.');
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (tokenError) {
    const msg =
      tokenError === 'token_expired'
        ? 'This invite link has expired.'
        : tokenError === 'already_used'
          ? 'This invite has already been used.'
          : 'This invite link is invalid.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{msg}</p>
            <Link to="/candidate-login" className="text-sky-600 hover:underline">
              Go to candidate login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (finishingPayment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 px-4">
        <Loader2 className="h-12 w-12 animate-spin text-sky-600 mb-4" aria-hidden />
        <p className="text-lg font-semibold text-gray-900 text-center">Finishing payment…</p>
        <p className="text-sm text-gray-600 mt-2 text-center max-w-sm">
          Setting up your account. You&apos;ll be redirected to your dashboard in a moment.
        </p>
      </div>
    );
  }

  const collegeBanner = invite ? (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 space-y-1">
      <p className="font-semibold">{invite.college_name}</p>
      <p>{invite.course_name}</p>
      {invite.college_code ? <p className="font-mono text-xs">code: {invite.college_code}</p> : null}
      <p className="text-emerald-800">
        {invite.discount_percentage}% student discount applies at checkout
        {invite.valid_until
          ? ` (valid through ${new Date(invite.valid_until).toLocaleDateString()})`
          : '.'}
      </p>
    </div>
  ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-3 sm:p-4">
      <Card className="w-full max-w-lg shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">
            {step === STEPS.ACCOUNT ? 'Activate your account' : 'Choose a plan'}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {step === STEPS.ACCOUNT
              ? 'Your college email is pre-filled. Set a password to continue.'
              : 'Your college enrollment is confirmed. Select a plan to finish.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {collegeBanner}

          {step === STEPS.ACCOUNT && (
            <form className="space-y-4" onSubmit={handleActivate}>
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>College email</Label>
                <Input value={invite?.college_email || ''} readOnly className="bg-slate-100" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={submitting}>
                {submitting ? 'Activating…' : 'Activate & continue'}
              </Button>
            </form>
          )}

          {step === STEPS.PLAN && (
            <div className="space-y-4">
              {sessionEmail && (
                <div className="rounded-md bg-sky-50 border border-sky-100 px-3 py-2 text-sm text-gray-800">
                  <span className="text-gray-600">Signed in as </span>
                  <span className="font-mono text-xs sm:text-sm break-all">{sessionEmail}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Plan</Label>
                <select
                  className="w-full min-h-[44px] h-11 text-base border rounded-md px-3 bg-background touch-manipulation"
                  value={selectedPlanId || ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                  disabled={submitting}
                >
                  <option value="">Select a plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} – {p.is_free ? 'Free' : `₹${p.cost}`} ({p.interview_count} interviews,{' '}
                      {p.jd_count} JD{p.jd_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>
              {pricingPreview && (
                <p className="text-sm text-emerald-800">
                  List ₹{pricingPreview.list_price} → You pay ₹
                  {pricingPreview.projected_amount_payable_with_max_credits} (
                  {pricingPreview.college_discount_percentage}% college discount)
                </p>
              )}
              <Button
                type="button"
                className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation"
                disabled={submitting || !selectedPlanId}
                onClick={handlePlanSelectAndPay}
              >
                {submitting
                  ? 'Please wait...'
                  : plans.find((p) => p.id === selectedPlanId)?.is_free
                    ? 'Continue to dashboard'
                    : 'Pay & continue'}
              </Button>
              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            </div>
          )}

          {error && step === STEPS.ACCOUNT && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
