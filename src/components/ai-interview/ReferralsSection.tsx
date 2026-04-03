import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Loader2, Share2, Settings2, ArrowRight } from 'lucide-react';

type ReferralRow = { name: string; plan_purchased: number | null; referral_amount: number | null };
type AsReferred = { referrer_name: string; plan_purchased: number | null; referral_amount: number | null } | null;
type ActivityItem = { type: string; amount: number; description: string; date: string };
type CurrentPlan = { plan_id: string; plan_name: string; cost: number; id?: string };
type Plan = { id: string; plan_name: string; jd_count: number; cost: number; interview_count: number; is_free: boolean };
type ReferralSettings = { referral_credit_percentage: number; max_credit_usage_percentage: number };

export function ReferralsSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [asReferrer, setAsReferrer] = useState<ReferralRow[]>([]);
  const [asReferred, setAsReferred] = useState<AsReferred>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [planSettingsOpen, setPlanSettingsOpen] = useState(false);
  const [planStep, setPlanStep] = useState<'choose' | 'current' | 'change'>('choose');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [planError, setPlanError] = useState('');
  const [candidateMobile, setCandidateMobile] = useState('');
  const [settings, setSettings] = useState<ReferralSettings>({
    referral_credit_percentage: 20,
    max_credit_usage_percentage: 50
  });
  const isCurrentPlanFree = Boolean(
    currentPlan &&
    ((Number(currentPlan.cost) || 0) <= 0 || /free/i.test(String(currentPlan.plan_name || '')))
  );
  const { toast } = useToast();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const loadSettings = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_REFERRAL_SETTINGS), { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error('Failed to load referral settings:', e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const [linkRes, dashRes] = await Promise.all([
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_REFERRAL_LINK), { headers }),
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_REFERRAL_DASHBOARD), { headers }),
      ]);
      const linkData = await linkRes.json().catch(() => ({}));
      const dashData = await dashRes.json().catch(() => ({}));
      if (linkRes.ok && linkData.url) setUrl(linkData.url);
      else setUrl(null);
      if (dashRes.ok) {
        setBalance(dashData.balance ?? 0);
        setTotalEarned(dashData.total_earned ?? dashData.balance ?? 0);
        setActivity(Array.isArray(dashData.activity) ? dashData.activity : []);
        setCurrentPlan(dashData.current_plan ?? null);
        setCandidateMobile(dashData.candidate_mobile ?? '');
        setAsReferrer(Array.isArray(dashData.as_referrer) ? dashData.as_referrer : []);
        setAsReferred(dashData.as_referred ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSettings();
  }, [loadData, loadSettings]);

  const handleGenerateLink = async () => {
    setGenerating(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_REFERRAL_LINK_GENERATE), {
        method: 'POST',
        headers,
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setUrl(data.url);
        loadData();
      } else setError(data?.error || 'Failed to generate link');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate link');
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchPlans = useCallback(async () => {
    const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_PLANS));
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data?.plans) ? data.plans : Array.isArray(data) ? data : [];
    if (res.ok && list.length > 0) {
      setPlans(list.filter((p: Plan) => !p.is_free));
    }
  }, []);

  const openPlanSettings = (step: 'current' | 'change') => {
    setPlanStep(step);
    setPlanError('');
    if (step === 'change') {
      setSelectedPlanId(null);
      fetchPlans();
    }
  };

  const handlePlanPay = async () => {
    const planToUse = planStep === 'current' ? currentPlan : plans.find((p) => p.id === selectedPlanId);
    if (!planToUse) {
      setPlanError(planStep === 'current' ? 'Current plan not found.' : 'Please select a plan.');
      return;
    }
    const cost = 'cost' in planToUse ? planToUse.cost : 0;
    const planId = 'plan_id' in planToUse ? (planToUse as CurrentPlan).plan_id : (planToUse as Plan).id;
    const maxCredits = Math.min(balance * (settings.max_credit_usage_percentage / 100), cost);
    const creditsToUse = Math.round(maxCredits * 100) / 100;
    const amountToPay = cost - creditsToUse;
    if (amountToPay <= 0) {
      setPlanError('No amount to charge. Use a plan with cost greater than the credit applied.');
      return;
    }
    setPlanSubmitting(true);
    setPlanError('');
    try {
      const headers = await getAuthHeaders();
      const orderRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_CREATE_ORDER), {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan_id: planId, credits_to_use: creditsToUse }),
      });
      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        setPlanError(orderData?.error || 'Failed to create order.');
        setPlanSubmitting(false);
        return;
      }
      const { order_id, amount, currency, key_id } = orderData;
      const rzp = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!rzp) {
        setPlanError('Payment gateway could not be loaded. Refresh the page.');
        setPlanSubmitting(false);
        return;
      }
      const digitsOnly = (candidateMobile || '').trim().replace(/\D/g, '');
      const contactForRazorpay = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const prefill: Record<string, string> = {};
      if (contactForRazorpay) prefill.contact = contactForRazorpay;
      if (authUser?.email) prefill.email = authUser.email;
      const rzpInstance = new rzp({
        key: key_id,
        amount,
        currency: currency || 'INR',
        order_id,
        ...(Object.keys(prefill).length > 0 && { prefill }),
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_VERIFY_PAYMENT), {
              method: 'POST',
              headers: await getAuthHeaders(),
              body: JSON.stringify({
                razorpay_order_id: order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
              setPlanError(verifyData?.error || 'Payment verification failed.');
              setPlanSubmitting(false);
              return;
            }
            toast({
              title: 'Payment successful',
              description: creditsToUse > 0
                ? `₹${creditsToUse.toFixed(2)} was applied from your referral balance. Your plan has been updated.`
                : 'Your plan has been updated.',
            });
            setPlanSettingsOpen(false);
            setPlanStep('choose');
            loadData();
          } catch (e) {
            setPlanError(e instanceof Error ? e.message : 'Verification failed.');
          }
          setPlanSubmitting(false);
        },
      });
      rzpInstance.open();
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setPlanSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Referrals</h2>
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Referral link
            </CardTitle>
            <p className="text-sm text-gray-600">
              Share this link with anyone. When they sign up and paste it on the plan step, then purchase a plan, you earn {settings.referral_credit_percentage}% as credit.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {url ? (
              <div className="flex gap-2">
                <Input readOnly value={url} className="font-mono text-sm flex-1 min-w-0" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copy">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <Button onClick={handleGenerateLink} disabled={generating} className="bg-sky-600 hover:bg-sky-700">
                {generating ? 'Generating...' : 'Generate my referral link'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Credit balance</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 text-white border-sky-600"
                onClick={() => {
                  setPlanStep('choose');
                  setPlanError('');
                  setPlanSettingsOpen(true);
                }}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Plan settings
              </Button>
            </div>
            <p className="text-2xl font-semibold text-sky-700">₹{Number(balance).toFixed(2)}</p>
            <p className="text-sm text-gray-600">
              You can use up to {settings.max_credit_usage_percentage}% of your balance on your next plan purchase.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
              <span className="text-gray-600">Original credits:</span>
              <span className="font-medium">₹{Number(totalEarned).toFixed(2)}</span>
              <span className="text-gray-600">Consumed credits:</span>
              <span className="font-medium">₹{(Number(totalEarned) - Number(balance)).toFixed(2)}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who used my link & activity</CardTitle>
          <p className="text-sm text-gray-600">Referrals, who used your link, and your credit activity in one place.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {asReferred && (
            <div className="p-3 bg-sky-50 rounded-md">
              <p className="text-sm font-medium text-gray-700">Referred by {asReferred.referrer_name}</p>
              {asReferred.plan_purchased != null && (
                <p className="text-xs text-gray-600">
                  Your first purchase: ₹{asReferred.plan_purchased} → you earned ₹{asReferred.referral_amount ?? 0} credit.
                </p>
              )}
            </div>
          )}

          {asReferrer.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Who used your link</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4 font-medium">User</th>
                      <th className="py-2 pr-4 font-medium">Credits gained</th>
                      <th className="py-2 font-medium">Plan selected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asReferrer.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 pr-4">{r.name}</td>
                        <td className="py-2 pr-4">{r.referral_amount != null ? `₹${r.referral_amount}` : '–'}</td>
                        <td className="py-2">{r.plan_purchased != null ? `₹${r.plan_purchased}` : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Cumulative total credits: ₹{asReferrer.reduce((s, r) => s + (r.referral_amount ?? 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Activity</p>
            {activity.length === 0 && asReferrer.length === 0 && !asReferred ? (
              <p className="text-sm text-gray-500">No referral activity yet. Share your link to earn credits.</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-gray-500">No credit transactions yet.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 border rounded-md border-gray-100 p-2">
                {activity.map((a, i) => (
                  <div key={i} className="text-sm flex justify-between items-start gap-2 border-b border-gray-100 pb-1.5 last:border-0">
                    <span className={a.amount >= 0 ? 'text-green-700' : 'text-gray-700'}>
                      {a.amount >= 0 ? `Earned ₹${Math.abs(a.amount).toFixed(2)}${a.description ? ` – ${a.description}` : ''}` : `Used ₹${Math.abs(a.amount).toFixed(2)} for ${a.description}`}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {a.date ? new Date(a.date).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={planSettingsOpen}
        onOpenChange={(open) => {
          setPlanSettingsOpen(open);
          if (!open) setPlanStep('choose');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plan settings</DialogTitle>
            <DialogDescription>
              {isCurrentPlanFree
                ? 'Switch to a different paid plan. Up to ' + settings.max_credit_usage_percentage + '% of your referral balance can be applied.'
                : 'Choose your current plan or switch to a different plan. Up to ' + settings.max_credit_usage_percentage + '% of your referral balance can be applied.'}
            </DialogDescription>
          </DialogHeader>
          {planError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {planError}
            </div>
          )}
          {planStep === 'choose' && (
            <div className="space-y-3">
              {currentPlan && !isCurrentPlanFree && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => openPlanSettings('current')}
                >
                  Choose current plan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => openPlanSettings('change')}
              >
                Change plan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {planStep === 'current' && currentPlan && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 rounded-md">
                <p className="font-medium text-gray-900">{currentPlan.plan_name}</p>
                <p className="text-sm text-gray-600">Cost: ₹{currentPlan.cost.toFixed(2)}</p>
              </div>
              <div className="text-sm">
                <p>Credits to use: ₹{Math.min(balance * (settings.max_credit_usage_percentage / 100), currentPlan.cost).toFixed(2)}</p>
                <p>Amount to pay: ₹{(currentPlan.cost - Math.min(balance * (settings.max_credit_usage_percentage / 100), currentPlan.cost)).toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPlanStep('choose')}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="bg-sky-600 hover:bg-sky-700"
                  disabled={planSubmitting}
                  onClick={handlePlanPay}
                >
                  {planSubmitting ? 'Opening payment...' : 'Pay now'}
                </Button>
              </div>
            </div>
          )}
          {planStep === 'change' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select a plan</label>
                <select
                  className="w-full min-h-[44px] border rounded-md px-3 bg-background text-sm"
                  value={selectedPlanId || ''}
                  onChange={(e) => setSelectedPlanId(e.target.value || null)}
                >
                  <option value="">Select plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} – ₹{p.cost} ({p.interview_count} interviews, {p.jd_count} JD{p.jd_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>
              {selectedPlanId && (() => {
                const plan = plans.find((p) => p.id === selectedPlanId);
                if (!plan) return null;
                const creditsToUse = Math.min(balance * (settings.max_credit_usage_percentage / 100), plan.cost);
                const amountToPay = plan.cost - creditsToUse;
                return (
                  <div className="text-sm p-3 bg-gray-50 rounded-md">
                    <p>Credits to use: ₹{creditsToUse.toFixed(2)}</p>
                    <p>Amount to pay: ₹{amountToPay.toFixed(2)}</p>
                  </div>
                );
              })()}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPlanStep('choose')}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="bg-sky-600 hover:bg-sky-700"
                  disabled={planSubmitting || !selectedPlanId}
                  onClick={handlePlanPay}
                >
                  {planSubmitting ? 'Opening payment...' : 'Pay now'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
