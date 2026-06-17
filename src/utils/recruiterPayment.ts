import {
  buildCandidateRazorpayOptions,
  openCandidateRazorpayCheckout,
  type CandidateRazorpaySuccess,
} from '@/utils/candidateRazorpayCheckout';
import { API_CONFIG, buildApiUrl } from '@/constants/api';

export type RecruiterCheckoutPrefill = {
  name?: string;
  email?: string;
  contact?: string;
};

export async function startRecruiterPlanCheckout(params: {
  companyId: string;
  planId: string;
  planName: string;
  prefill?: RecruiterCheckoutPrefill;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
  onDismiss?: () => void;
}): Promise<boolean> {
  const orderRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RECRUITER_CREATE_ORDER), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: params.companyId,
      plan_id: params.planId,
    }),
  });
  const orderData = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    params.onError(orderData?.error || 'Failed to create payment order.');
    return false;
  }

  const { order_id, amount, currency, key_id } = orderData;
  const options = buildCandidateRazorpayOptions({
    key: key_id,
    amount,
    currency,
    order_id,
    description: `${params.planName} — one-time plan`,
    prefill: params.prefill,
    themeColor: '#094D7B',
    onDismiss: params.onDismiss,
    onSuccess: async (response: CandidateRazorpaySuccess) => {
      try {
        const verifyRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RECRUITER_VERIFY_PAYMENT), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: params.companyId,
            plan_id: params.planId,
            razorpay_order_id: response.razorpay_order_id || order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok) {
          params.onError(verifyData?.error || 'Payment verification failed.');
          return;
        }
        await params.onSuccess();
      } catch (err) {
        params.onError(err instanceof Error ? err.message : 'Payment verification failed.');
      }
    },
  });

  return openCandidateRazorpayCheckout(options, params.onError);
}

