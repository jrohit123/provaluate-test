import { useSearchParams } from 'react-router-dom';

export const WORKFLOW_STEPS = [
  { label: 'Job Description', key: 'job-upload' },
  { label: 'Evaluation Criteria', key: 'evaluation-criteria' },
  { label: 'Resume Upload', key: 'resume-upload' },
  { label: 'Match Scorecard', key: 'match-scorecard' }
];

/** Interview workflow: Setup → Send Interview → Interview Dashboard */
export const INTERVIEW_WORKFLOW_STEPS = [
  { label: 'Interview Setup', key: 'setup' },
  { label: 'Send Interview', key: 'ai-interview' },
  { label: 'Interview Dashboard', key: 'interview-dashboard' }
];

export const useCurrentStep = () => {
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'job-upload';
  const currentIndex = WORKFLOW_STEPS.findIndex(step => step.key === section);
  return currentIndex >= 0 ? currentIndex : 0;
};

export const useNavigateToStep = () => {
  const [, setSearchParams] = useSearchParams();
  
  return (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < WORKFLOW_STEPS.length) {
      setSearchParams({ section: WORKFLOW_STEPS[stepIndex].key });
    }
  };
};

/** Current step index for interview workflow (setup / ai-interview / interview-dashboard). */
export const useInterviewCurrentStep = () => {
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'setup';
  const currentIndex = INTERVIEW_WORKFLOW_STEPS.findIndex(step => step.key === section);
  return currentIndex >= 0 ? currentIndex : 0;
};

export const useInterviewNavigateToStep = () => {
  const [, setSearchParams] = useSearchParams();
  return (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < INTERVIEW_WORKFLOW_STEPS.length) {
      setSearchParams({ section: INTERVIEW_WORKFLOW_STEPS[stepIndex].key });
    }
  };
};
