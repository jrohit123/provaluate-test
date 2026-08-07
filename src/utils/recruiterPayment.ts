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

export type CouponPreviewResult = {
  valid: boolean;
  message: string;
  coupon_id: string | null;
  original_amount: number | null;
  discount_amount: number | null;
  final_amount: number | null;
};

/** Live, read-only price preview — does not reserve or consume the coupon. */
export async function previewCoupon(params: {
  code: string;
  planId: string;
  companyId?: string;
}): Promise<CouponPreviewResult> {
  try {
    const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RECRUITER_VALIDATE_COUPON), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: params.code,
        plan_id: params.planId,
        company_id: params.companyId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      valid: !!data.valid,
      message: data.message || (res.ok ? '' : 'Could not validate coupon'),
      coupon_id: data.coupon_id ?? null,
      original_amount: data.original_amount ?? null,
      discount_amount: data.discount_amount ?? null,
      final_amount: data.final_amount ?? null,
    };
  } catch (err) {
    return {
      valid: false,
      message: err instanceof Error ? err.message : 'Could not validate coupon',
      coupon_id: null,
      original_amount: null,
      discount_amount: null,
      final_amount: null,
    };
  }
}

async function releaseCouponReservation(orderId: string | undefined) {
  if (!orderId) return;
  try {
    await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RECRUITER_CANCEL_ORDER), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: orderId }),
    });
  } catch {
    // Best-effort only — the 30-minute staleness window in reserve_coupon covers this.
  }
}

export async function startRecruiterPlanCheckout(params: {
  companyId: string;
  planId: string;
  planName: string;
  couponCode?: string;
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
      coupon_code: params.couponCode || undefined,
    }),
  });
  const orderData = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    params.onError(orderData?.error || 'Failed to create payment order.');
    return false;
  }

  const { order_id, amount, currency, key_id } = orderData;

  const handleDismiss = () => {
    void releaseCouponReservation(order_id);
    params.onDismiss?.();
  };

  const handleFailure = (message: string) => {
    void releaseCouponReservation(order_id);
    params.onError(message);
  };

  const options = buildCandidateRazorpayOptions({
    key: key_id,
    amount,
    currency,
    order_id,
    description: `${params.planName} — one-time plan`,
    prefill: params.prefill,
    themeColor: '#094D7B',
    onDismiss: handleDismiss,
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

  return openCandidateRazorpayCheckout(options, handleFailure);
}
