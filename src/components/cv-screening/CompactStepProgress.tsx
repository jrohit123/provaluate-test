import React from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CompactStepProgressProps {
  current: number; // 0-based index
  total: number;
  steps: Array<{ label: string; key: string }>;
  onStepClick?: (index: number) => void;
  /** When true, any step is clickable (e.g. candidate can jump to any step). When false, only completed steps are clickable. */
  allowClickAnyStep?: boolean;
  /** Theme controls primary brand color for the progress bar + nav buttons. */
  theme?: 'recruiter' | 'candidate' | 'tpo' | 'default';
  className?: string;
}

export const CompactStepProgress: React.FC<CompactStepProgressProps> = ({
  current,
  total,
  steps,
  onStepClick,
  allowClickAnyStep = false,
  theme = 'recruiter',
  className = ''
}) => {
  const themeConfig =
    theme === 'candidate'
      ? {
          btnActiveClass:
            'text-white [background:linear-gradient(135deg,#1a9fd6,#2563eb)] hover:[background:linear-gradient(135deg,#1490c0,#1d4ed8)]',
          barActiveClass: 'bg-[#2563eb]',
          labelTextClass: 'text-[#2563eb]',
        }
      : theme === 'tpo'
        ? {
            btnActiveClass:
              'text-white [background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)]',
            barActiveClass: 'bg-[#042C53]',
            labelTextClass: 'text-[#042C53]',
          }
      : {
          btnActiveClass: 'bg-[#094D7B] text-white hover:bg-[#094D7B]/90',
          barActiveClass: 'bg-[#094D7B]',
          labelTextClass: 'text-[#094D7B]',
        };

  const btnActiveClass = themeConfig.btnActiveClass;
  const barActiveClass = themeConfig.barActiveClass;
  const handlePrevious = () => {
    if (current > 0 && onStepClick) {
      onStepClick(current - 1);
    }
  };

  const handleNext = () => {
    if (current < total - 1 && onStepClick) {
      onStepClick(current + 1);
    }
  };

  const canGoPrevious = current > 0;
  const canGoNext = current < total - 1;

  return (
    <div 
      className={`sticky top-0 z-50 bg-white border-b shadow-sm px-2 sm:px-3 py-2 sm:py-3 ${className}`}
      role="navigation"
      aria-label="Step progress"
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Previous Button - touch-friendly */}
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          className={`
            min-w-[44px] min-h-[44px] w-10 h-10 sm:w-9 sm:h-9 rounded-full flex items-center justify-center
            transition-all duration-200 flex-shrink-0 touch-manipulation
            ${canGoPrevious 
              ? `${btnActiveClass} cursor-pointer` 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
          aria-label="Previous step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Bar-type progress + Step label */}
        <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0 max-w-[min(100%,280px)] sm:max-w-none">
          {/* Segmented bar */}
          <div className="flex gap-0.5 sm:gap-1 w-full rounded-full overflow-hidden bg-gray-200">
            {steps.slice(0, total).map((step, index) => {
              const isActive = index === current;
              const isCompleted = index < current;
              const isClickable = (allowClickAnyStep ? !!onStepClick : (isCompleted && !!onStepClick));

              return (
                <button
                  type="button"
                  key={step.key}
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={`
                    flex-1 min-w-0 h-2 sm:h-2.5 transition-all duration-300 touch-manipulation
                    ${index === 0 ? 'rounded-l-full' : ''}
                    ${index === total - 1 ? 'rounded-r-full' : ''}
                    ${isActive 
                      ? `${barActiveClass} cursor-default` 
                      : isCompleted
                      ? 'bg-green-500 ' + (isClickable ? 'hover:bg-green-600 cursor-pointer' : 'cursor-default')
                      : 'bg-gray-300 ' + (isClickable ? 'hover:bg-gray-400 cursor-pointer' : 'cursor-default')
                    }
                  `}
                  aria-label={`${step.label}${isCompleted ? ' (completed)' : isActive ? ' (current)' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  title={step.label}
                />
              );
            })}
          </div>
          <div className="flex flex-col items-center sm:items-start min-w-0">
            <span className={`text-xs font-medium whitespace-nowrap ${themeConfig.labelTextClass}`}>
              Step {current + 1} of {total}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-500 truncate w-full text-center sm:text-left max-w-[140px] sm:max-w-[200px]" title={steps[current]?.label}>
              {steps[current]?.label}
            </span>
          </div>
        </div>

        {/* Next Button - touch-friendly */}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          className={`
            min-w-[44px] min-h-[44px] w-10 h-10 sm:w-9 sm:h-9 rounded-full flex items-center justify-center
            transition-all duration-200 flex-shrink-0 touch-manipulation
            ${canGoNext 
              ? `${btnActiveClass} cursor-pointer` 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
          aria-label="Next step"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Alternative: Even more compact version for very tight spaces
export const MiniStepProgress: React.FC<CompactStepProgressProps> = ({
  current,
  total,
  steps,
  onStepClick,
  theme = 'recruiter',
  className = ''
}) => {
  const themeConfig = {
    recruiter: { active: 'bg-[#094D7B]' },
    candidate: { active: 'bg-[#2563eb]' },
    tpo: { active: 'bg-[#042C53]' },
  };
  const activeClass = themeConfig[theme as keyof typeof themeConfig]?.active ?? themeConfig.recruiter.active;

  return (
    <div 
      className={`sticky top-0 z-50 bg-white border-b px-4 py-2 ${className}`}
      role="navigation"
      aria-label="Step progress"
    >
      <div className="flex items-center justify-between">
        {/* Minimal dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((step, index) => {
            const isActive = index === current;
            const isCompleted = index < current;
            const isClickable = isCompleted && onStepClick;

            return (
              <button
                key={step.key}
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`
                  transition-all duration-200
                  ${isActive 
                    ? `w-6 h-1.5 ${activeClass} rounded-full`
                    : isCompleted
                    ? 'w-1.5 h-1.5 bg-green-500 rounded-full'
                    : 'w-1.5 h-1.5 bg-gray-300 rounded-full'
                  }
                  ${isClickable ? 'cursor-pointer hover:scale-125' : 'cursor-default'}
                `}
                aria-label={step.label}
              />
            );
          })}
        </div>
        
        {/* Compact counter */}
        <span className="text-xs text-gray-500 font-medium">
          {current + 1}/{total}
        </span>
      </div>
    </div>
  );
};
