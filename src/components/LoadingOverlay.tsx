import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type MessageCategory = 'progress' | 'motivational' | 'process' | 'onboarding' | 'cv-screening';

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isOpen: boolean;
  /** Optional title shown above the rotating messages */
  title?: string;
  /** Optional smaller subtitle */
  subtitle?: string;
  /** Logical context key (used purely for analytics / debugging) */
  contextKey?: string;
  /** What "tone" of messages to show */
  messagesCategory?: MessageCategory;
  /** Whether to show step numbers (e.g., "Step 1 of 3") in messages */
  showStepNumbers?: boolean;
}

const MESSAGE_CATALOG: Record<MessageCategory, string[]> = {
  progress: [
    'Step 1 of 3 — We’re lining things up for you…',
    'Step 2 of 3 — Crunching the latest data behind the scenes.',
    'Final step — Making sure everything looks sharp and accurate.',
  ],
  motivational: [
    'Step 1 of 3 — Great hiring starts with this step—nice move.',
    'Step 2 of 3 — You’re turning hours of manual review into minutes.',
    'Final step — Good things take a moment—your shortlist is on the way.',
  ],
  process: [
    'Step 1 of 3 — Parsing data and normalizing fields…',
    'Step 2 of 3 — Mapping everything against your configured rules…',
    'Final step — Scoring and packaging results for you…',
  ],
  onboarding: [
    'Step 1 of 3 — Setting up your hiring workspace…',
    'Step 2 of 3 — Warming up your plan limits and access…',
    'Final step — Getting everything ready for your first evaluation.',
  ],
  'cv-screening': [
    'Step 1 of 3 — Scanning resumes into the system…',
    'Step 2 of 3 — Matching skills and experience to your JD and criteria…',
    'Final step — Scoring candidates so your top matches pop to the top.',
  ],
};

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isOpen,
  title,
  subtitle,
  contextKey,
  messagesCategory = 'progress',
  showStepNumbers = true,
}) => {
  const [index, setIndex] = useState(0);

  const messages = useMemo(() => {
    const base = MESSAGE_CATALOG[messagesCategory] ?? MESSAGE_CATALOG.progress;
    const rawMessages = base.length > 0 ? base : MESSAGE_CATALOG.progress;
    
    // Strip step prefixes if showStepNumbers is false
    if (!showStepNumbers) {
      return rawMessages.map((msg) => {
        // Remove "Step X of 3 — " or "Final step — " prefixes
        return msg.replace(/^(Step \d+ of \d+ — |Final step — )/i, '').trim();
      });
    }
    
    return rawMessages;
  }, [messagesCategory, showStepNumbers]);

  useEffect(() => {
    if (!isOpen || messages.length <= 1) return;

    // Reset to the first message whenever we show the overlay
    setIndex(0);

    // Walk forward through the messages once, then stop on the last one
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      if (current >= messages.length) {
        window.clearInterval(id);
        return;
      }
      setIndex(current);
    }, 3500);

    return () => window.clearInterval(id);
  }, [isOpen, messages.length, contextKey]);

  if (!isOpen) return null;

  const effectiveTitle = title ?? 'Hang tight, we’re on it.';
  const effectiveSubtitle =
    subtitle ?? 'We’re processing your data and keeping the experience smooth.';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="max-w-md w-[90%] rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
            <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
            <Sparkles className="absolute -bottom-1 -right-1 h-4 w-4 text-amber-500" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-slate-900">{effectiveTitle}</h2>
            <p className="text-xs text-slate-500">{effectiveSubtitle}</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-3 border border-slate-100">
          <p className={cn('text-sm text-slate-700 leading-relaxed')}>
            {messages[index]}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>ProValuate • Smart candidate evaluation</span>
          {contextKey && <span className="uppercase tracking-wide">{contextKey}</span>}
        </div>
      </div>
    </div>
  );
};

