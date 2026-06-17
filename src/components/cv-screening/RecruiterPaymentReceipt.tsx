import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

export type RecruiterReceiptPurchase = {
  id: string;
  company_id?: string | null;
  plan_id?: string | null;
  plan_name: string | null;
  gross_amount: number | string | null;
  credits_used: number | string | null;
  amount_paid: number | string | null;
  payment_status: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_date: string | null;
  purchased_at: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RecruiterReceiptDetails = {
  companyName: string;
  billingContactName: string;
  billingContactEmail: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  purchase: RecruiterReceiptPurchase;
};

type RecruiterPlanDetails = {
  active_jobs: number | null;
  max_cvs: number | null;
  max_users: number | null;
  max_interviews: number | null;
  duration: number | null;
  plan_type: string | null;
};

const COMPANY_NAME = 'aitamate Solutions';
const COMPANY_WEBSITE = 'www.aitamate.com';
const SUPPORT_EMAIL = 'sales@aitamate.com';
const COMPANY_ADDRESS_LINES = [
  'D-wing 4th floor, MBC Infotech Park,',
  'Kasarvadavali, Ghodbunder road,',
  'Thane West - 400615',
];
const RECEIPT_LOGO_SRC = `${import.meta.env.BASE_URL}assets/Logo-transparent_bg.png`;

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatReceiptCurrency(value: number | string | null | undefined): string {
  return `Rs ${toNumber(value).toFixed(2)}`;
}

export function formatReceiptDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getReceiptStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'PAID';
  if (normalized === 'pending') return 'PENDING';
  if (normalized === 'failed') return 'FAILED';
  if (normalized === 'refunded') return 'REFUNDED';
  return normalized ? normalized.toUpperCase() : 'UNKNOWN';
}

export function getReceiptReference(purchase: Pick<RecruiterReceiptPurchase, 'id' | 'payment_date' | 'purchased_at'>): string {
  const dateSource = purchase.payment_date || purchase.purchased_at || '';
  const date = new Date(dateSource);
  const yyyy = Number.isNaN(date.getTime()) ? '0000' : String(date.getFullYear());
  const mm = Number.isNaN(date.getTime()) ? '00' : String(date.getMonth() + 1).padStart(2, '0');
  const dd = Number.isNaN(date.getTime()) ? '00' : String(date.getDate()).padStart(2, '0');
  const suffix = String(purchase.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return `RCP-${yyyy}${mm}${dd}-${suffix || 'UNKNOWN'}`;
}

function getPurchaseBreakdown(purchase: RecruiterReceiptPurchase): {
  gross: number;
  credits: number;
  discount: number;
  total: number;
} {
  const gross = toNumber(purchase.gross_amount);
  const credits = toNumber(purchase.credits_used);
  const metadata = purchase.metadata && typeof purchase.metadata === 'object' ? purchase.metadata : null;
  const discount = toNumber(metadata?.discount_amount as number | string | null | undefined);
  const total = toNumber(purchase.amount_paid);
  return { gross, credits, discount, total };
}

async function loadLogoAsDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getCompanyPlanDetails(planId: string | null | undefined): Promise<RecruiterPlanDetails | null> {
  if (!planId) return null;
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('active_jobs, max_cvs, max_users, max_interviews, duration, plan_type')
      .eq('plan_id', planId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      active_jobs: data.active_jobs ?? null,
      max_cvs: data.max_cvs ?? null,
      max_users: data.max_users ?? null,
      max_interviews: data.max_interviews ?? null,
      duration: data.duration ?? null,
      plan_type: data.plan_type ?? null,
    };
  } catch {
    return null;
  }
}

function buildPlanDetailText(planDetails: RecruiterPlanDetails | null): string | null {
  if (!planDetails) return null;
  const parts: string[] = [];
  
  if (planDetails.plan_type === 'cv') {
    if (planDetails.active_jobs != null) {
      parts.push(`${planDetails.active_jobs} active job${planDetails.active_jobs === 1 ? '' : 's'}`);
    }
    if (planDetails.max_cvs != null) {
      parts.push(`${planDetails.max_cvs} CV${planDetails.max_cvs === 1 ? '' : 's'}`);
    }
    if (planDetails.max_users != null) {
      parts.push(`${planDetails.max_users} user${planDetails.max_users === 1 ? '' : 's'}`);
    }
  } else if (planDetails.plan_type === 'interview') {
    if (planDetails.active_jobs != null) {
      parts.push(`${planDetails.active_jobs} active job${planDetails.active_jobs === 1 ? '' : 's'}`);
    }
    if (planDetails.max_interviews != null) {
      parts.push(`${planDetails.max_interviews} interview${planDetails.max_interviews === 1 ? '' : 's'}`);
    }
    if (planDetails.max_users != null) {
      parts.push(`${planDetails.max_users} user${planDetails.max_users === 1 ? '' : 's'}`);
    }
  } else if (planDetails.plan_type === 'combo') {
    if (planDetails.active_jobs != null) {
      parts.push(`${planDetails.active_jobs} active job${planDetails.active_jobs === 1 ? '' : 's'}`);
    }
    if (planDetails.max_cvs != null) {
      parts.push(`${planDetails.max_cvs} CV${planDetails.max_cvs === 1 ? '' : 's'}`);
    }
    if (planDetails.max_interviews != null) {
      parts.push(`${planDetails.max_interviews} interview${planDetails.max_interviews === 1 ? '' : 's'}`);
    }
    if (planDetails.max_users != null) {
      parts.push(`${planDetails.max_users} user${planDetails.max_users === 1 ? '' : 's'}`);
    }
  }
  
  if (planDetails.duration != null && planDetails.duration > 0) {
    parts.push(`${planDetails.duration} days`);
  }
  
  return parts.length ? parts.join(', ') : null;
}

export async function downloadRecruiterReceiptPdf(details: RecruiterReceiptDetails): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadLogoAsDataUrl(RECEIPT_LOGO_SRC);
  const planDetails = await getCompanyPlanDetails(details.purchase.plan_id);
  const planDetailText = buildPlanDetailText(planDetails);
  const { gross, credits, discount, total } = getPurchaseBreakdown(details.purchase);
  const receiptDate = formatReceiptDate(details.purchase.payment_date || details.purchase.purchased_at);
  const status = getReceiptStatusLabel(details.purchase.payment_status);
  const reference = getReceiptReference(details.purchase);
  const subscriptionValid = details.subscriptionStart && details.subscriptionEnd
    ? `${formatReceiptDate(details.subscriptionStart)} - ${formatReceiptDate(details.subscriptionEnd)}`
    : 'N/A';

  let y = 16;
  if (logo) {
    doc.addImage(logo, 'PNG', pageWidth - 56, y - 2, 42, 22);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(10, 48, 94);
  doc.text('PAYMENT RECEIPT', 14, y + 4);

  y = 48;
  doc.setDrawColor(220, 227, 235);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 48);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt Reference:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(reference, 48, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date Paid:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(receiptDate, 35, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(status, 28, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Subscription Valid:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(subscriptionValid, 60, y);
  y += 10;

  const sellerBlockX = 14;
  const buyerBlockX = 112;
  const sectionTitleY = y;
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_NAME, sellerBlockX, sectionTitleY);
  doc.text('BILLED TO', buyerBlockX, sectionTitleY);
  y += 6;
  doc.setFont('helvetica', 'normal');
  COMPANY_ADDRESS_LINES.forEach((line, index) => {
    doc.text(line, sellerBlockX, y + index * 5);
  });
  doc.text(COMPANY_WEBSITE, sellerBlockX, y + COMPANY_ADDRESS_LINES.length * 5);

  doc.text(`${details.companyName || 'Company'}`, buyerBlockX, y);
  doc.text(`${details.billingContactName || 'Admin'}`, buyerBlockX, y + 5);
  doc.text(`${details.billingContactEmail || 'N/A'}`, buyerBlockX, y + 10);
  const sellerBottomY = y + COMPANY_ADDRESS_LINES.length * 5;
  const buyerBottomY = y + 10;
  y = Math.max(sellerBottomY, buyerBottomY) + 20;

  const tableX = 14;
  const tableW = pageWidth - 28;
  const tablePad = 4;
  const colDescriptionW = 80;
  const colQtyW = 18;
  const colUnitPriceW = 28;
  const colCreditsW = 30;
  const colAmountW = tableW - colDescriptionW - colQtyW - colUnitPriceW - colCreditsW;
  const col1X = tableX;
  const col2X = col1X + colDescriptionW;
  const col3X = col2X + colQtyW;
  const col4X = col3X + colUnitPriceW;
  const col5X = col4X + colCreditsW;
  doc.setFillColor(240, 247, 255);
  doc.roundedRect(tableX, y, tableW, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Description', col1X + tablePad, y + 6.5);
  doc.text('Qty', col2X + colQtyW / 2, y + 6.5, { align: 'center' });
  doc.text('Unit Price', col3X + colUnitPriceW / 2, y + 6.5, { align: 'center' });
  doc.text('Credits Used', col4X + colCreditsW / 2, y + 6.5, { align: 'center' });
  doc.text('Amount', col5X + colAmountW - tablePad, y + 6.5, { align: 'right' });
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const description = `Recruiter Plan - ${details.purchase.plan_name || 'Selected Plan'}`;
  const detailLines = planDetailText ? doc.splitTextToSize(planDetailText, colDescriptionW - tablePad * 2) : [];
  const descLines = doc.splitTextToSize(description, colDescriptionW - tablePad * 2);
  doc.text(descLines, col1X + tablePad, y);
  if (detailLines.length) {
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(detailLines, col1X + tablePad, y + descLines.length * 5);
    doc.setFontSize(10.5);
    doc.setTextColor(40, 40, 48);
  }
  doc.text('1', col2X + colQtyW / 2, y, { align: 'center' });
  doc.text(formatReceiptCurrency(gross), col3X + colUnitPriceW / 2, y, { align: 'center' });
  doc.text(formatReceiptCurrency(credits), col4X + colCreditsW / 2, y, { align: 'center' });
  doc.text(formatReceiptCurrency(total), col5X + colAmountW - tablePad, y, { align: 'right' });
  y += Math.max(8, (descLines.length + detailLines.length) * 5 + 3);

  doc.setDrawColor(228, 232, 238);
  doc.line(tableX, y, tableX + tableW, y);
  y += 8;

  const summaryXLabel = 126;
  const summaryXValue = 190;
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', summaryXLabel, y);
  doc.text(formatReceiptCurrency(gross), summaryXValue, y, { align: 'right' });
  y += 6;
  if (discount > 0) {
    doc.text('Discount', summaryXLabel, y);
    doc.text(`-${formatReceiptCurrency(discount)}`, summaryXValue, y, { align: 'right' });
    y += 6;
  }
  doc.text('Discount Applied', summaryXLabel, y);
  doc.text(`-${formatReceiptCurrency(credits)}`, summaryXValue, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Paid', summaryXLabel, y);
  doc.text(formatReceiptCurrency(total), summaryXValue, y, { align: 'right' });
  y += 14;

  const pageHeight = doc.internal.pageSize.getHeight();
  const supportFooterY = pageHeight - 18;
  const thankYouY = supportFooterY - 50;
  const centerX = pageWidth / 2;
  const thankYouText = 'Thank you for your purchase.';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 48);
  const thankYouW = doc.getTextWidth(thankYouText);
  doc.text(thankYouText, centerX - thankYouW / 2, thankYouY);

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 100);
  const supportLabel = 'For Support :';
  const supportValue = ` ${SUPPORT_EMAIL}`;
  doc.setFont('helvetica', 'bold');
  const labelW = doc.getTextWidth(supportLabel);
  doc.setFont('helvetica', 'normal');
  const valueW = doc.getTextWidth(supportValue);
  const lineStartX = centerX - (labelW + valueW) / 2;
  doc.setFont('helvetica', 'bold');
  doc.text(supportLabel, lineStartX, supportFooterY);
  doc.setFont('helvetica', 'normal');
  doc.text(supportValue, lineStartX + labelW, supportFooterY);

  doc.save(`${reference}.pdf`);
}

export function RecruiterPaymentReceipt({ companyName, billingContactName, billingContactEmail, subscriptionStart, subscriptionEnd, purchase }: RecruiterReceiptDetails) {
  const { gross, credits, discount, total } = getPurchaseBreakdown(purchase);
  const reference = getReceiptReference(purchase);
  const status = getReceiptStatusLabel(purchase.payment_status);
  const datePaid = formatReceiptDate(purchase.payment_date || purchase.purchased_at);
  const subscriptionValid = subscriptionStart && subscriptionEnd
    ? `${formatReceiptDate(subscriptionStart)} - ${formatReceiptDate(subscriptionEnd)}`
    : 'N/A';
  const [planDetails, setPlanDetails] = useState<RecruiterPlanDetails | null>(null);

  useEffect(() => {
    let active = true;
    getCompanyPlanDetails(purchase.plan_id).then((data) => {
      if (active) setPlanDetails(data);
    });
    return () => {
      active = false;
    };
  }, [purchase.plan_id]);

  const planDetailText = buildPlanDetailText(planDetails);

  return (
    <div className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-[#0a305e]">PAYMENT RECEIPT</h1>
          </div>
          <div className="flex flex-col items-start gap-4 sm:items-end">
            <img
              src={RECEIPT_LOGO_SRC}
              alt="aitamate Solutions"
              className="h-16 w-auto rounded-md object-contain sm:h-20"
            />
            <div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="mt-2 space-y-1 text-slate-700">
                  <p><span className="font-semibold">Receipt Reference:</span> {reference}</p>
                  <p><span className="font-semibold">Date Paid:</span> {datePaid}</p>
                  <p><span className="font-semibold">Status:</span> {status}</p>
                  <p><span className="font-semibold">Subscription Valid:</span> {subscriptionValid}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[720px] flex-col px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-5">
            <div className="text-xs font-semibold tracking-[0.08em] text-slate-500">{COMPANY_NAME}</div>
            <div className="mt-2 grid gap-1 text-sm text-slate-700">
              {COMPANY_ADDRESS_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>{COMPANY_WEBSITE}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-5">
            <div className="text-xs font-semibold tracking-[0.08em] text-slate-500">BILLED TO</div>
            <div className="mt-2 grid gap-1 text-sm text-slate-700">
              <p>{companyName || 'Company'}</p>
              <p>{billingContactName || 'Admin'}</p>
              <p>{billingContactEmail || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[minmax(0,3.1fr)_0.8fr_1.1fr_1.25fr_1fr] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-slate-600">
              <div className="min-w-0 pr-3">Description</div>
              <div className="min-w-0 text-center">Qty</div>
              <div className="min-w-0 pr-2 text-right">Unit Price</div>
              <div className="min-w-0 pr-2 text-right">Credits Used</div>
              <div className="min-w-0 text-right">Amount</div>
            </div>
            <div className="grid grid-cols-[minmax(0,3.1fr)_0.8fr_1.1fr_1.25fr_1fr] items-start border-t border-slate-200 bg-white px-4 py-5 text-sm text-slate-800">
              <div className="break-words pr-6 font-medium leading-relaxed">
                <div>Recruiter Plan - {purchase.plan_name || 'Selected Plan'}</div>
                {planDetailText ? (
                  <div className="mt-1 text-xs font-normal tracking-normal text-slate-500">
                    {planDetailText}
                  </div>
                ) : null}
              </div>
              <div className="pt-0.5 text-center">1</div>
              <div className="pr-2 text-right">{formatReceiptCurrency(gross)}</div>
              <div className="pr-2 text-right">{formatReceiptCurrency(credits)}</div>
              <div className="text-right font-semibold">{formatReceiptCurrency(total)}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span>Subtotal</span>
              <span>{formatReceiptCurrency(gross)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between text-slate-700">
                <span>Discount</span>
                <span>-{formatReceiptCurrency(discount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-slate-700">
              <span>Discount Applied</span>
              <span>-{formatReceiptCurrency(credits)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total Paid</span>
              <span>{formatReceiptCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-700">
          <div className="text-xs font-semibold tracking-[0.08em] text-slate-500">PAYMENT REFERENCE</div>
          <div className="mt-2 space-y-1">
            <p><span className="font-medium">Razorpay Order ID:</span> {purchase.razorpay_order_id || 'N/A'}</p>
            <p><span className="font-medium">Razorpay Payment ID:</span> {purchase.razorpay_payment_id || 'N/A'}</p>
          </div>
        </div>

        <div className="mt-auto pt-12 text-center">
          <div className="text-base font-semibold text-slate-700">
            Thank you for your purchase.
          </div>
          <div className="mt-6 text-sm text-slate-600">
            <span className="font-semibold">For Support :</span> {SUPPORT_EMAIL}
          </div>
        </div>
      </div>
    </div>
  );
}
