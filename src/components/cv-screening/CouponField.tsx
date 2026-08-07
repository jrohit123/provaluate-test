import { useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { previewCoupon, type CouponPreviewResult } from '@/utils/recruiterPayment';

interface CouponFieldProps {
  planId: string | null;
  planCost: number | null;
  companyId?: string;
  /** Fires with the (uppercased) code and pricing whenever the applied/removed state changes.
   *  `pricing` is null when there is no currently-applied, valid coupon. */
  onChange: (code: string, pricing: CouponPreviewResult | null) => void;
}

export function CouponField({ planId, planCost, companyId, onChange }: CouponFieldProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [pricing, setPricing] = useState<CouponPreviewResult | null>(null);
  const requestSeq = useRef(0);

  const handleApply = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !planId) return;
    const seq = ++requestSeq.current;
    setChecking(true);
    const result = await previewCoupon({ code: trimmed, planId, companyId });
    if (seq !== requestSeq.current) return; // a newer request superseded this one
    setPricing(result);
    setChecking(false);
    onChange(trimmed, result.valid ? result : null);
  }, [code, planId, companyId, onChange]);

  const handleClear = () => {
    setCode('');
    setPricing(null);
    onChange('', null);
  };

  // Don't render for free plans
  if (!planId || !planCost || planCost <= 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          placeholder="Have a coupon code?"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (pricing) setPricing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleApply();
            }
          }}
          className="uppercase"
          disabled={checking || !!pricing?.valid}
        />
        {pricing?.valid ? (
          <Button type="button" variant="outline" onClick={handleClear}>
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleApply()}
            disabled={checking || !code.trim()}
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
          </Button>
        )}
      </div>
      {pricing && (
        <div
          className={`flex items-center gap-1.5 text-xs ${
            pricing.valid ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {pricing.valid ? (
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          {pricing.valid
            ? `Coupon applied — ₹${pricing.discount_amount} off, you pay ₹${pricing.final_amount}`
            : pricing.message}
        </div>
      )}
    </div>
  );
}
