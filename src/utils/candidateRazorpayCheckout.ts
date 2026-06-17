/** Razorpay Standard Checkout methods for candidate one-time plan orders */
export const CANDIDATE_RAZORPAY_CHECKOUT_METHODS = {
  netbanking: true,
  card: true,
  upi: true,
  wallet: true,
} as const;

export type CandidateRazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type BuildOptionsParams = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  name?: string;
  description?: string;
  themeColor?: string;
  onDismiss?: () => void;
  onSuccess: (response: CandidateRazorpaySuccess) => void | Promise<void>;
};

export function buildCandidateRazorpayOptions(
  params: BuildOptionsParams
): Record<string, unknown> {
  return {
    key: params.key,
    amount: params.amount,
    currency: params.currency || 'INR',
    order_id: params.order_id,
    name: params.name ?? 'aitamate Solutions',
    ...(params.description ? { description: params.description } : {}),
    method: { ...CANDIDATE_RAZORPAY_CHECKOUT_METHODS },
    ...(params.prefill && Object.keys(params.prefill).length > 0
      ? { prefill: params.prefill }
      : {}),
    theme: { color: params.themeColor ?? '#094D7B' },
    modal: {
      ondismiss: () => params.onDismiss?.(),
    },
    handler: params.onSuccess,
  };
}

export function openCandidateRazorpayCheckout(
  options: Record<string, unknown>,
  onFailed?: (message: string) => void
): boolean {
  const RazorpayCtor = (
    window as unknown as {
      Razorpay?: new (o: Record<string, unknown>) => {
        open: () => void;
        on: (
          event: string,
          cb: (r: { error?: { description?: string } }) => void
        ) => void;
      };
    }
  ).Razorpay;

  if (!RazorpayCtor) return false;

  const rzp = new RazorpayCtor(options);
  rzp.on('payment.failed', (response) => {
    onFailed?.(
      response?.error?.description || 'Payment could not be completed.'
    );
  });
  rzp.open();
  return true;
}
