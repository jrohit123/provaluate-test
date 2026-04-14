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
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
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

  /** Full-screen after successful Razorpay payment until navigate (removes plan-step flash) */
  const [finishingPayment, setFinishingPayment] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  /** Set after onboarding when email domain matches a college — no manual student verification */
  const [autoCollegeInfo, setAutoCollegeInfo] = useState<{
    college_name: string;
    college_code?: string;
    discount_percentage: number;
    valid_until?: string;
    course_name?: string;
  } | null>(null);
  /** Domain matched college but no courses configured in admin */
  const [autoEnrollNoCoursesMessage, setAutoEnrollNoCoursesMessage] = useState<string | null>(null);
  const [referralMsg, setReferralMsg] = useState('');
  /** College has multiple programs — user must pick one before enrollment is created */
  const [pendingCollegeCourseSelection, setPendingCollegeCourseSelection] = useState<{
    college_name: string;
    college_code?: string;
    discount_percentage: number;
    courses: { id: string; course_name: string; course_code: string | null }[];
  } | null>(null);
  const [selectedCourseIdForEnrollment, setSelectedCourseIdForEnrollment] = useState<string>('');

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

  /** Show sign-in email on plan step */
  useEffect(() => {
    if (step !== STEPS.PLAN) return;
    let cancelled = false;
    void (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (u?.email) {
        setSessionEmail(u.email);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const handleNameMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    setSubmitting(true);
    try {
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
          mobile: null,
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
      setAutoCollegeInfo(null);
      setAutoEnrollNoCoursesMessage(null);
      setReferralMsg('');
      setPendingCollegeCourseSelection(null);
      setSelectedCourseIdForEnrollment('');
      const autoRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_COLLEGE_AUTO_ENROLL), {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const autoData = await autoRes.json().catch(() => ({}));
      if (autoRes.ok && autoData?.matched) {
        if (autoData.error === 'no_courses') {
          setAutoEnrollNoCoursesMessage(
            autoData.message ||
              'Your college is recognized, but courses are not set up yet. You can continue with a referral link if you have one, or complete payment — student pricing can be enabled from your dashboard once your college is fully configured.'
          );
        } else if (autoData.requires_course_selection && Array.isArray(autoData.courses)) {
          setPendingCollegeCourseSelection({
            college_name: String(autoData.college_name || ''),
            college_code: autoData.college_code ? String(autoData.college_code) : undefined,
            discount_percentage: Number(autoData.discount_percentage) || 0,
            courses: autoData.courses.map((c: { id: string; course_name: string; course_code?: string | null }) => ({
              id: String(c.id),
              course_name: String(c.course_name || ''),
              course_code: c.course_code != null ? String(c.course_code) : null,
            })),
          });
          const first = autoData.courses[0];
          if (first?.id) setSelectedCourseIdForEnrollment(String(first.id));
        } else {
          setAutoCollegeInfo({
            college_name: String(autoData.college_name || ''),
            college_code: autoData.college_code ? String(autoData.college_code) : undefined,
            discount_percentage: Number(autoData.discount_percentage) || 0,
            valid_until: autoData.valid_until ? String(autoData.valid_until) : undefined,
            course_name: autoData.course_name ? String(autoData.course_name) : undefined,
          });
        }
      }
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

    // --- Twilio send-OTP + OTP step — restore when mobile field is shown again ---
    // if (!mobile.trim()) {
    //   setError('Mobile number is required.');
    //   return;
    // }
    // setSubmitting(true);
    // try {
    //   const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_SEND_OTP), {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ mobile: mobile.trim() }),
    //   });
    //   const data = await res.json().catch(() => ({}));
    //   if (!res.ok) {
    //     setError(data?.error || 'Failed to send OTP.');
    //     setSubmitting(false);
    //     return;
    //   }
    //   setStep(STEPS.OTP);
    //   setOtp('');
    //   setError('');
    // } catch (err) {
    //   setError(err instanceof Error ? err.message : 'Something went wrong.');
    // }
    // setSubmitting(false);
  };

  const handleConfirmCourseSelection = async () => {
    if (!selectedCourseIdForEnrollment) {
      setError('Please select your program.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_COLLEGE_AUTO_ENROLL), {
        method: 'POST',
        headers,
        body: JSON.stringify({ course_id: selectedCourseIdForEnrollment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Could not confirm your program.');
        setSubmitting(false);
        return;
      }
      if (data?.requires_course_selection) {
        setError('Invalid program selection. Try again.');
        setSubmitting(false);
        return;
      }
      if (data?.matched && data?.error !== 'no_courses') {
        setPendingCollegeCourseSelection(null);
        setAutoCollegeInfo({
          college_name: String(data.college_name || ''),
          college_code: data.college_code ? String(data.college_code) : undefined,
          discount_percentage: Number(data.discount_percentage) || 0,
          valid_until: data.valid_until ? String(data.valid_until) : undefined,
          course_name: data.course_name ? String(data.course_name) : undefined,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm program.');
    }
    setSubmitting(false);
  };

  // --- OTP verify (Twilio) — uncomment when OTP step is shown again ---
  // const handleVerifyOtp = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError('');
  //   if (!otp.trim()) {
  //     setError('Enter the OTP you received.');
  //     return;
  //   }
  //   setSubmitting(true);
  //   try {
  //     const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_VERIFY_OTP), {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ mobile: mobile.trim(), code: otp.trim() }),
  //     });
  //     const data = await res.json().catch(() => ({}));
  //     if (!res.ok) {
  //       setError(data?.error || 'Invalid or expired OTP.');
  //       setSubmitting(false);
  //       return;
  //     }
  //     const authUser = user ?? (await supabase.auth.getUser()).data.user;
  //     if (!authUser?.id || !authUser?.email) {
  //       setError('Session expired. Please sign in again.');
  //       setSubmitting(false);
  //       return;
  //     }
  //     const headers = await getAuthHeaders();
  //     const completeRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_ONBOARDING_COMPLETE), {
  //       method: 'POST',
  //       headers,
  //       body: JSON.stringify({
  //         first_name: firstName.trim(),
  //         last_name: lastName.trim(),
  //         mobile: mobile.trim(),
  //         referral_slug: null,
  //       }),
  //     });
  //     const completeData = await completeRes.json().catch(() => ({}));
  //     if (!completeRes.ok) {
  //       setError(completeData?.error || 'Failed to complete profile.');
  //       setSubmitting(false);
  //       return;
  //     }
  //     await refreshUser();
  //     setStep(STEPS.PLAN);
  //     setError('');
  //     const plansRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_PLANS));
  //     const plansData = await plansRes.json().catch(() => ({}));
  //     if (plansRes.ok && Array.isArray(plansData?.plans)) {
  //       setPlans(plansData.plans);
  //       const free = plansData.plans.find((p: Plan) => p.is_free);
  //       if (free) setSelectedPlanId(free.id);
  //     }
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : 'Something went wrong.');
  //   }
  //   setSubmitting(false);
  // };

  const handlePlanSelectAndPay = async () => {
    if (!selectedPlanId) {
      setError('Please select a plan.');
      return;
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;

    if (!autoCollegeInfo && referralPaste.trim()) {
      setSubmitting(true);
      setError('');
      setReferralMsg('');
      try {
        const headers = await getAuthHeaders();
        const slug = extractReferralSlug(referralPaste);
        if (slug) {
          const refRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_APPLY_REFERRAL), {
            method: 'POST',
            headers,
            body: JSON.stringify({ referral_slug: slug }),
          });
          const refData = await refRes.json().catch(() => ({}));
          if (!refRes.ok) {
            setError(refData?.error || 'Could not apply referral. Fix the link or clear the field to continue.');
            setSubmitting(false);
            return;
          }
          setReferralMsg('Referral applied.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Referral failed');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    if (plan.is_free) {
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
      const digitsOnly = mobile.trim().replace(/\D/g, '');
      const contactForRazorpay =
        digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly.length > 0 ? digitsOnly : '';
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const options: Record<string, unknown> = {
        key: key_id,
        amount,
        currency,
        order_id,
        prefill: {
          ...(contactForRazorpay ? { contact: contactForRazorpay } : {}),
          ...(authUser?.email && { email: authUser.email }),
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
          },
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          setFinishingPayment(true);
          setSubmitting(false);
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
              setFinishingPayment(false);
              setError(verifyData?.error || 'Payment verification failed.');
              return;
            }
            const { data: { user: authUser2 } } = await supabase.auth.getUser();
            if (authUser2?.id) {
              const sessionData = await SessionManager.createSession(authUser2.id);
              if (sessionData) {
                await SessionManager.endAllOtherSessions(authUser2.id, sessionData.session_id);
                localStorage.setItem('recruitai_auth', 'true');
                await refreshUser();
                navigate('/candidate-dashboard', { replace: true });
              }
            }
          } catch (err) {
            setFinishingPayment(false);
            setError(err instanceof Error ? err.message : 'Payment verification failed.');
          }
        },
      };
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
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
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-3 sm:p-4 overflow-x-hidden">
      <Card className="w-full max-w-2xl shadow-lg border-0 mx-2">
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            {step === STEPS.NAME_MOBILE && 'Complete your profile'}
            {step === STEPS.OTP && 'Verify your mobile'}
            {step === STEPS.PLAN && 'Choose a plan'}
          </CardTitle>
          <p className="text-sm sm:text-base text-gray-600">
            {step === STEPS.NAME_MOBILE && 'Enter your name, then choose a plan on the next step.'}
            {step === STEPS.OTP && 'Enter the 6-digit OTP sent to your mobile.'}
            {step === STEPS.PLAN &&
              (pendingCollegeCourseSelection && !autoCollegeInfo
                ? 'Your email matches a partner college. Select your program to activate your student discount.'
                : autoCollegeInfo
                  ? 'Your institutional email is verified for your college. Choose a plan and complete payment.'
                  : 'Pick a plan, then pay. Add a referral link if someone shared one with you.')}
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
              {/* --- Mobile + Twilio OTP — restore with OTP step ---
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
              */}
              <Button type="submit" className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation" disabled={submitting}>
                {submitting ? 'Saving...' : 'Continue'}
              </Button>
              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            </form>
          )}

          {/* --- OTP step (Twilio) — uncomment + restore handleVerifyOtp ---
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
          */}

          {step === STEPS.PLAN && (
            <div className="space-y-4">
              {sessionEmail && (
                <div className="rounded-md bg-sky-50 border border-sky-100 px-3 py-2 text-sm text-gray-800">
                  <span className="text-gray-600">Signed in as </span>
                  <span className="font-mono text-xs sm:text-sm break-all">{sessionEmail}</span>
                </div>
              )}

              {pendingCollegeCourseSelection && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-3 space-y-3 text-sm">
                  <p className="font-semibold text-gray-900">Select your program</p>
                  <p className="text-xs text-gray-600">
                    {pendingCollegeCourseSelection.college_name} offers more than one program. Choose yours so we can
                    apply the correct student discount dates.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Program</Label>
                    <select
                      className="w-full min-h-[44px] h-11 text-base border rounded-md px-3 bg-background"
                      value={selectedCourseIdForEnrollment}
                      onChange={(e) => setSelectedCourseIdForEnrollment(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select a program</option>
                      {pendingCollegeCourseSelection.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.course_name}
                          {c.course_code ? ` (${c.course_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation"
                    disabled={submitting || !selectedCourseIdForEnrollment}
                    onClick={handleConfirmCourseSelection}
                  >
                    {submitting ? 'Confirming…' : 'Confirm program'}
                  </Button>
                </div>
              )}

              {autoCollegeInfo && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 space-y-2">
                  <p className="font-semibold">College email accepted</p>
                  <div className="flex flex-col gap-1 text-emerald-900">
                    <span>{autoCollegeInfo.college_name}</span>
                    {autoCollegeInfo.course_name ? <span>{autoCollegeInfo.course_name}</span> : null}
                    {autoCollegeInfo.college_code ? (
                      <span className="font-mono text-xs sm:text-sm">code : {autoCollegeInfo.college_code}</span>
                    ) : null}
                  </div>
                  <p className="text-emerald-800 pt-1 border-t border-emerald-200/80">
                    {autoCollegeInfo.discount_percentage}% student discount applies at checkout
                    {autoCollegeInfo.valid_until
                      ? ` (valid through ${new Date(autoCollegeInfo.valid_until).toLocaleDateString()})`
                      : '.'}
                  </p>
                </div>
              )}

              {autoEnrollNoCoursesMessage && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {autoEnrollNoCoursesMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Plan</Label>
                <select
                  className="w-full min-h-[44px] h-11 text-base border rounded-md px-3 bg-background"
                  value={selectedPlanId || ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                  disabled={submitting}
                >
                  <option value="">Select a plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} – {p.is_free ? 'Free' : `₹${p.cost}`} ({p.interview_count} interviews, {p.jd_count} JD{p.jd_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {!autoCollegeInfo && !pendingCollegeCourseSelection && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Referral link (optional)</Label>
                <Input
                  placeholder="Paste a friend's referral link — applied when you pay"
                  value={referralPaste}
                  onChange={(e) => setReferralPaste(e.target.value)}
                  className="min-h-[44px] h-11 text-base"
                  disabled={submitting}
                />
                {referralMsg && <p className="text-xs text-emerald-700">{referralMsg}</p>}
              </div>
              )}
              <Button
                type="button"
                className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation"
                disabled={submitting || !selectedPlanId || !!pendingCollegeCourseSelection}
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
