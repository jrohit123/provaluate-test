import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Wrench, Upload, BarChart3, ArrowRight, CheckCircle, Type, FileUp, Settings, RefreshCw, SlidersHorizontal, Smartphone, ArrowLeftRight } from 'lucide-react';
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
      title: 'Create or pick a Job Description',
      subtitle: 'Tell ProValuate what role you are hiring for so every resume is evaluated against the right expectations.',
      icon: FileText,
      section: 'job-upload',
      primaryCta: 'Go to Job Upload',
      bullets: [
        'Select an existing job description from your saved list, or create a new one by uploading a file or using the text editor.',
        'Upload your JD in PDF, DOCX, or TXT format—the system automatically extracts key information like skills, experience, and qualifications.',
        'Review and edit the AI-resolved structured data to ensure all job requirements are accurately captured and standardized.',
        'Activate or deactivate job descriptions as needed—manage your active JD limit based on your plan.',
      ],
    },
    {
      id: 2,
      title: 'Define your Evaluation Criteria',
      subtitle: 'Convert your ideal candidate profile into a structured, repeatable scoring grid.',
      icon: Wrench,
      section: 'evaluation-criteria',
      primaryCta: 'Go to Evaluation Criteria',
      bullets: [
        'Define evaluation parameters such as technical skills, years of experience, domain expertise, education, certifications, and soft skills.',
        'Assign percentage weightages to each parameter (must total 100%) to indicate their relative importance in the scoring algorithm.',
        'Save criteria grids with descriptive names for easy reuse—create role-specific or default criteria that work across multiple job descriptions.',
        'Upload criteria from Excel/CSV files for bulk setup, or manually add/edit parameters with calculation notes for transparency.',
      ],
    },
    {
      id: 3,
      title: 'Upload resumes for this role',
      subtitle: 'Drop in resumes once your JD and criteria are ready—ProValuate does the heavy lifting.',
      icon: Upload,
      section: 'resume-upload',
      primaryCta: 'Go to Resume Upload',
      bullets: [
        'First, select the job description and evaluation criteria grid you want to use for this batch of resumes.',
        'Upload multiple candidate resumes simultaneously—supports PDF, DOCX, DOC, and TXT file formats for bulk processing.',
        'The system automatically parses each resume, extracts relevant information, and evaluates candidates against your criteria in the background.',
        'Monitor real-time progress as resumes are processed—you\'ll see completion status and can view individual candidate scorecards once analysis is done.',
      ],
    },
    {
      id: 4,
      title: 'Review match scores and shortlist',
      subtitle: 'See a ranked list of candidates and dive into the details for confident decisions.',
      icon: BarChart3,
      section: 'match-scorecard',
      primaryCta: 'View All Results',
      bullets: [
        'Browse all candidates ranked by their overall match score—see who best fits your job requirements at a glance.',
        'Click on any candidate to view their detailed scorecard with parameter-wise breakdowns, AI-generated explanations, and resume highlights.',
        'Use the recommendation system (Strong Match, Good Match, Review, No Match) to quickly identify top candidates and make informed shortlisting decisions.',
        'Filter and sort candidates by score, recommendation status, or specific criteria to find the perfect fit for your role.',
      ],
    },
    {
      id: 0,
      title: 'Mobile Navigation: Swipe to Move Between Steps',
      subtitle: 'On mobile devices, you can quickly navigate between CV screening steps using swipe gestures.',
      icon: Smartphone,
      section: 'main-dashboard',
      primaryCta: 'Got it, continue',
      bullets: [
        'Swipe left → to move forward to the next step (e.g., from Job Description to Evaluation Criteria, or from Resume Upload to View Results).',
        'Swipe right ← to go back to the previous step (available from all sections—Evaluation Criteria, Resume Upload, and View Results).',
        'Swipe gestures only work on mobile devices—desktop users can use the sidebar or buttons to navigate.',
        'You can swipe freely between all 4 steps at any time, regardless of completion status—no restrictions!',
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
                  index === currentStep ? 'bg-primary-600' : 'bg-gray-200',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        {/* Active step content */}
        <div className="mt-4 border border-blue-100 rounded-xl p-4 sm:p-5 bg-blue-50/40 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm border border-blue-100 flex-shrink-0">
              <activeStep.icon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">
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
            {activeStep.id === 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
                onClick={() => onOpenChange(false)}
              >
                {activeStep.primaryCta}
                <ArrowRight className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
                onClick={() => handleNavigate(activeStep.section)}
              >
                {activeStep.primaryCta}
                <ArrowRight className="w-3 h-3" />
              </Button>
            )}
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
              className="flex-1 sm:flex-none"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
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
