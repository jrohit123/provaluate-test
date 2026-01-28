import React from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface CompactStepProgressProps {
  current: number; // 0-based index
  total: number;
  steps: Array<{ label: string; key: string }>;
  onStepClick?: (index: number) => void;
  className?: string;
}

export const CompactStepProgress: React.FC<CompactStepProgressProps> = ({
  current,
  total,
  steps,
  onStepClick,
  className = ''
}) => {
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
      className={`sticky top-0 z-50 bg-white border-b shadow-sm px-3 py-3 ${className}`}
      role="navigation"
      aria-label="Step progress"
    >
      <div className="flex items-center justify-between">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-200 flex-shrink-0
            ${canGoPrevious 
              ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
          aria-label="Previous step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Step dots and text - centered */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          {/* Step dots */}
          <div className="flex items-center gap-2">
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
                    relative transition-all duration-300 flex items-center justify-center
                    ${isActive 
                      ? 'w-8 h-2 bg-blue-600 rounded-full' 
                      : isCompleted
                      ? 'w-5 h-5 bg-green-500 rounded-full hover:bg-green-600'
                      : 'w-2 h-2 bg-gray-300 rounded-full'
                    }
                    ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                  `}
                  aria-label={`${step.label}${isCompleted ? ' (completed)' : isActive ? ' (current)' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Step counter and label - close to dots */}
          <div className="flex flex-col items-start flex-shrink-0 ml-2">
            <span className="text-xs font-medium text-gray-900">
              Step {current + 1}/{total}
            </span>
            <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
              {steps[current]?.label}
            </span>
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-200 flex-shrink-0
            ${canGoNext 
              ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer' 
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
  className = ''
}) => {
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
                    ? 'w-6 h-1.5 bg-blue-600 rounded-full' 
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
