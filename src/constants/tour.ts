import type { ReactNode } from 'react';
import type { ActiveSection } from '@/pages/Dashboard';

export const TOUR_STORAGE_KEY = 'provaluate_onboarding_tour_completed';

export const TOUR_SECTION_DONE_PREFIX = 'provaluate_tour_section_';

/** Sections that have their own contextual tour when you first visit. */
export const TOUR_SECTIONS: ActiveSection[] = [
  'job-upload',
  'evaluation-criteria',
  'resume-upload',
  'match-scorecard',
  'settings',
];

export function getSectionTourStorageKey(section: ActiveSection): string {
  return `${TOUR_SECTION_DONE_PREFIX}${section}`;
}

/** Dispatched when tour needs mobile sidebar open before showing a step. AppSidebar listens and opens Sheet. */
export const TOUR_OPEN_SIDEBAR_EVENT = 'tour:open-sidebar';

/** True if step target is inside the sidebar (nav items, session panel). On mobile, sidebar is in Sheet; must open first. */
export function isSidebarOnlyTarget(target: string): boolean {
  return (
    target.includes('section-') ||
    target.includes('session-panel') ||
    target === '[data-tour="sidebar"]'
  );
}

export interface TourStep {
  target: string;
  content: ReactNode;
  title?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
  /** Section to navigate to before showing this step (target must be in that section). */
  navigateToSection?: ActiveSection;
  /** Disable scroll-into-view for this step (use for fixed elements like sidebar). */
  disableScrolling?: boolean;
}

// ----- Main tour (dashboard): welcome → sidebar → quick-actions → browser extension (end) -----

export const MAIN_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard-welcome"]',
    content: "Welcome to ProValuate. This quick tour shows how to go from a job description to a ranked shortlist. Let's go.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar"]',
    content:
      'Use the sidebar to move between CV Screening steps in the following order: Job Upload, Evaluation Criteria, Resume Upload, and View Results. For detailed understanding of each step in CV Screening , visit each step to get step based tour',
    placement: 'right',
    disableScrolling: true,
  },
  {
    target: '[data-tour="quick-actions"]',
    content: 'Or use these buttons to jump to any step. Start with Create Job Descriptions.When you click on any step, you will see a progress tracker, so that you can track your progress properly.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="browser-extension"]',
    content: 'Use our extension to pull JDs and criteria from job boards into ProValuate. The extension will work only in Desktop.',
    placement: 'bottom',
    disableScrolling: false,
  },
];

/** Main tour uses sidebar-trigger on mobile (sidebar is in Sheet). Extension step always included (button always visible). */
export function getMainTourSteps(isMobile: boolean): TourStep[] {
  const steps = MAIN_TOUR_STEPS.map((s) => ({ ...s }));
  const sidebarIdx = steps.findIndex((s) => s.target === '[data-tour="sidebar"]');
  if (sidebarIdx >= 0 && isMobile) {
    steps[sidebarIdx] = { ...steps[sidebarIdx], target: '[data-tour="sidebar-trigger"]' };
  }
  return steps;
}

// ----- Section tours (contextual, when user opens that section) -----

const SECTION_JOB_UPLOAD: TourStep[] = [
  {
    target: '[data-tour="job-upload-area"]',
    content: 'Select an existing job description from the dropdown or create one by writing the name of job first and then uploading a file or using the editor. Finally, press process job button to process the job description. Manage and activate JDs using manage JDs button as per your selected plan.',
    placement: 'right',
  },
];

const SECTION_EVALUATION_CRITERIA: TourStep[] = [
  {
    target: '[data-tour="evaluation-criteria-area"]',
    content: 'Pick a criteria grid or create one. Add parameters and weights (total 100%), then save. Use Excel upload for bulk setup.',
    placement: 'right',
  },
];

const SECTION_RESUME_UPLOAD: TourStep[] = [
  {
    target: '[data-tour="resume-upload-area"]',
    content: 'Choose JD and criteria above, then upload resumes and press the Pro-Valuate button. We score them automatically. Start upload when ready.',
    placement: 'right',
  },
];

const SECTION_MATCH_SCORECARD: TourStep[] = [
  {
    target: '[data-tour="match-scorecard-area"]',
    content: 'View ranked candidates, filter by recommendation, and sort by score. Click a candidate for the full scorecard.',
    placement: 'right',
  },
];

const SECTION_SETTINGS: TourStep[] = [
  {
    target: '[data-tour="settings-user-management"]',
    content: 'Manage company users and invite new team members. Recharge, change plan, or update billing from here.',
    placement: 'bottom',
  },
];

const SECTION_TOUR_MAP: Record<ActiveSection, TourStep[]> = {
  'job-upload': SECTION_JOB_UPLOAD,
  'evaluation-criteria': SECTION_EVALUATION_CRITERIA,
  'resume-upload': SECTION_RESUME_UPLOAD,
  'match-scorecard': SECTION_MATCH_SCORECARD,
  settings: SECTION_SETTINGS,
  'main-dashboard': [],
  'interview-creation': [],
  'ai-interview': [],
  setup: [],
  'interview-dashboard': [],
};

export function getSectionTourSteps(section: ActiveSection): TourStep[] {
  return SECTION_TOUR_MAP[section] ?? [];
}

/** Poll for target element; resolve when found or reject after timeout. */
export function waitForTarget(
  selector: string,
  options: { timeoutMs?: number; intervalMs?: number; initialDelayMs?: number } = {}
): Promise<Element> {
  const { timeoutMs = 3000, intervalMs = 100, initialDelayMs = 150 } = options;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Tour target not found: ${selector}`));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, initialDelayMs);
  });
}
