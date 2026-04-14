import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Wrench, Upload, BarChart3, ArrowRight } from 'lucide-react';
import { ActiveSection } from '@/pages/Dashboard';

interface CVScreeningGuidedTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (section: ActiveSection) => void;
}

export const CVScreeningGuidedTour = ({ 
  open, 
  onOpenChange,
  onNavigate 
}: CVScreeningGuidedTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: {
    id: number;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    section: ActiveSection;
    primaryCta: string;
    bullets: string[];
  }[] = [
    {
      id: 1,
      title: 'Job Description',
      subtitle: 'Pick a role so every resume is scored against the right expectations.',
      icon: FileText,
      section: 'job-upload',
      primaryCta: 'Go to Job Upload',
      bullets: [
        'Select an existing JD or create one: upload PDF/DOCX/TXT or use the editor.',
        'System extracts skills, experience, qualifications. Review and edit the resolved data.',
        'Process the job, then manage and activate JDs per your plan limit.',
      ],
    },
    {
      id: 2,
      title: 'Evaluation Criteria',
      subtitle: 'Turn your ideal profile into a scoring grid (weights must total 100%).',
      icon: Wrench,
      section: 'evaluation-criteria',
      primaryCta: 'Go to Evaluation Criteria',
      bullets: [
        'Add parameters: skills, experience, education, soft skills. Set weight % for each.',
        'Save grids with a name for reuse. Use Excel/CSV upload for bulk or add manually.',
      ],
    },
    {
      id: 3,
      title: 'Resume Upload',
      subtitle: 'Once JD and criteria are set, upload resumes and we score them.',
      icon: Upload,
      section: 'resume-upload',
      primaryCta: 'Go to Resume Upload',
      bullets: [
        'Select JD and criteria above. Upload multiple resumes (PDF, DOCX, TXT).',
        'Click Pro-Valuate to run. Progress and scorecards appear as analysis completes.',
      ],
    },
    {
      id: 4,
      title: 'Match Scorecard',
      subtitle: 'Ranked candidates with filters and full scorecards.',
      icon: BarChart3,
      section: 'match-scorecard',
      primaryCta: 'View All Results',
      bullets: [
        'Candidates ranked by score. Click a row for full scorecard and breakdown.',
        'Filter by recommendation (Strong/Good/Review/No Match). Sort by score or criteria.',
      ],
    },
  ];

  const totalSteps = steps.length;
  const activeStep = steps[currentStep];

  const handleNavigate = (section: ActiveSection) => {
    if (onNavigate) {
      onNavigate(section);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-primary-800">
            CV Screening Guide
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base mt-2">
            Follow the key steps to go from a fresh role to a ranked shortlist. Move one step at a time—no scrolling required.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="mt-3 flex items-center justify-between text-xs sm:text-sm text-gray-600">
          <span className="font-medium">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-1.5">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={[
                  'h-1.5 w-4 rounded-full transition-colors',
                  index === currentStep ? 'bg-[#0d6ea3]' : 'bg-gray-200',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        {/* Active step content */}
        <div className="mt-4 border border-[#0d6ea3]/20 rounded-xl p-4 sm:p-5 bg-[#0d6ea3]/5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm border border-[#0d6ea3]/20 flex-shrink-0">
              <activeStep.icon className="w-4 h-4 text-[#0d6ea3]" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="text-sm sm:text-base font-semibold text-[#042C53]">
                {activeStep.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                {activeStep.subtitle}
              </p>
            </div>
          </div>

          <ul className="mt-2 space-y-1.5 text-xs sm:text-sm text-gray-700 ml-5 list-disc">
            {activeStep.bullets.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>

          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto flex items-center justify-center gap-2 border-[#0d6ea3]/35 text-[#0d6ea3] hover:bg-[#0d6ea3]/10 hover:text-[#042C53]"
              onClick={() => handleNavigate(activeStep.section)}
            >
              {activeStep.primaryCta}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="mt-4 sm:mt-5 pt-3 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto text-gray-600"
            onClick={() => onOpenChange(false)}
          >
            Skip tour for now
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none border-[#0d6ea3]/25"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none text-white shadow-[0_4px_18px_rgba(13,110,163,0.28)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
              onClick={() => {
                if (currentStep < totalSteps - 1) {
                  setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
                } else {
                  onOpenChange(false);
                }
              }}
            >
              {currentStep < totalSteps - 1 ? 'Next step' : 'Finish'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
