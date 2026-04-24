import React from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  resumeCount: number;
  currentStepIndex: number; // 0-3, controlled by parent
  isComplete: boolean;
}

const STEPS = [
  { id: 1, label: 'Extracting resume content' },
  { id: 2, label: 'Analysing with AI' },
  { id: 3, label: 'Scoring against criteria' },
  { id: 4, label: 'Saving results' },
];

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  isVisible,
  resumeCount,
  currentStepIndex,
  isComplete,
}) => {
  if (!isVisible) return null;

  const subtext =
    resumeCount === 1
      ? 'Processing your resume'
      : resumeCount > 1
        ? `Processing ${resumeCount} resumes` 
        : 'Processing resumes';

  return createPortal(
    <>
      <style>{`
        @keyframes processingOverlayCardIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)     scale(1);   }
        }
      `}</style>

      {/* Scrim */}
      <div className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm" />

      {/* Card */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className="w-full max-w-[420px] font-sans antialiased opacity-0
            animate-[processingOverlayCardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_forwards]
            rounded-2xl border border-slate-200/90 bg-white p-6
            shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
        >
          {/* Subtitle */}
          <p className="mb-5 text-xs font-medium tracking-[0.03em] text-[#1a5070] sm:text-[13px]">
            {subtext}
          </p>

          {/* Steps */}
          <div className="space-y-4">
            {STEPS.map((step, index) => {
              const isDone   = isComplete || index < currentStepIndex;
              const isActive = !isComplete && index === currentStepIndex;

              return (
                <div key={step.id} className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isDone ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#042C53] text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : isActive ? (
                      <Loader2
                        className="h-6 w-6 shrink-0 animate-spin text-[#0d6ea3]"
                        strokeWidth={2.25}
                      />
                    ) : (
                      <span className="block h-6 w-6 shrink-0 rounded-full border-2 border-slate-300 bg-slate-50" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-sm font-semibold leading-6 transition-colors duration-300 sm:text-base ${
                      isDone
                        ? 'text-[#042C53]/80'
                        : isActive
                          ? 'text-[#0d6ea3]'
                          : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <p className="mt-5 text-xs font-medium tracking-[0.03em] text-[#1a5070] sm:text-[13px]">
            {isComplete
              ? 'All done  loading your results'
              : `Step ${currentStepIndex + 1} of ${STEPS.length}`}
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
};
