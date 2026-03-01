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
  'career-portal',
  'setup',
  'ai-interview',
  'interview-dashboard',
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

// ----- Main tour (dashboard): short, informative steps -----

export const MAIN_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard-welcome"]',
    content: 'Welcome. This tour shows how to go from job description to ranked shortlist.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar"]',
    content: 'Sidebar: move between CV Screening steps (Job → Criteria → Resumes → Results). Each section has its own short tour.',
    placement: 'right',
    disableScrolling: true,
  },
  {
    target: '[data-tour="quick-actions"]',
    content: 'Jump to any step with these buttons. On mobile you’ll see a step progress bar.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="email-plugin"]',
    content: 'Email plugin: evaluate resumes from Gmail or Outlook. Choose your provider to get the extension or add-in.',
    placement: 'bottom',
    disableScrolling: false,
  },
];

/** Main tour uses sidebar-trigger on mobile (sidebar is in Sheet). Email plugin step always included (button always visible). */
export function getMainTourSteps(isMobile: boolean): TourStep[] {
  const steps = MAIN_TOUR_STEPS.map((s) => ({ ...s }));
  const sidebarIdx = steps.findIndex((s) => s.target === '[data-tour="sidebar"]');
  if (sidebarIdx >= 0 && isMobile) {
    steps[sidebarIdx] = { ...steps[sidebarIdx], target: '[data-tour="sidebar-trigger"]' };
  }
  return steps;
}

// ----- Section tours: short, informative (contextual when user opens section) -----

const SECTION_JOB_UPLOAD: TourStep[] = [
  {
    target: '[data-tour="job-upload-area"]',
    content: 'Pick a JD from the dropdown or create one: enter title, upload file or use editor, then Process. Use Manage JDs to activate per plan.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_EVALUATION_CRITERIA: TourStep[] = [
  {
    target: '[data-tour="evaluation-criteria-area"]',
    content: 'Select or create a criteria grid. Add parameters and weights (must total 100%). Save. Use Excel upload for bulk.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_RESUME_UPLOAD: TourStep[] = [
  {
    target: '[data-tour="resume-upload-area"]',
    content: 'Select JD and criteria above. Upload resumes and click Pro-Valuate to score automatically.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_MATCH_SCORECARD: TourStep[] = [
  {
    target: '[data-tour="match-scorecard-area"]',
    content: 'See ranked candidates. Filter by recommendation, sort by score. Click a row for full scorecard.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_SETTINGS: TourStep[] = [
  {
    target: '[data-tour="settings-user-management"]',
    content: 'Manage users, invite team. Recharge, change plan, or update billing here.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_CAREER_PORTAL: TourStep[] = [
  {
    target: '[data-tour="career-portal-company-details"]',
    content: 'Set career page slug, logo, and text. Slug = public URL (e.g. /careers/yourcompany). Save to apply.',
    placement: 'bottom',
    disableScrolling: true,
  },
  {
    target: '[data-tour="career-portal-jd-list"]',
    content: 'Set default criteria and “Post on career page” per job. Only active JDs with both appear on the public page.',
    placement: 'top',
    disableScrolling: true,
  },
];

// ----- Interview section tours -----

const SECTION_SETUP: TourStep[] = [
  {
    target: '[data-tour="setup-area"]',
    content: 'Configure interview: pick or create a JD, set duration and question count. Choose AI (dynamic) or Structured (pre-defined questions). Save parameters.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_AI_INTERVIEW: TourStep[] = [
  {
    target: '[data-tour="ai-interview-area"]',
    content: 'Add candidates (name + email). Pick position and duration. Create interview, then copy link or send email. Use “Send Interview” for reminders.',
    placement: 'bottom',
    disableScrolling: true,
  },
];

const SECTION_INTERVIEW_DASHBOARD: TourStep[] = [
  {
    target: '[data-tour="interview-dashboard-stats"]',
    content: 'Overview: total, active, completed, terminated. Use “Start New Interview” to create and send a new interview.',
    placement: 'bottom',
    disableScrolling: true,
  },
  {
    target: '[data-tour="interview-dashboard-filters"]',
    content: 'Search by name or email. Filter by status (All, Active, Completed, Terminated).',
    placement: 'bottom',
    disableScrolling: true,
  },
  {
    target: '[data-tour="interview-dashboard-area"]',
    content: 'Sessions list: open a row for details, record decision, send reminder, or copy interview link.',
    placement: 'top',
    disableScrolling: true,
  },
];

const SECTION_TOUR_MAP: Record<ActiveSection, TourStep[]> = {
  'job-upload': SECTION_JOB_UPLOAD,
  'evaluation-criteria': SECTION_EVALUATION_CRITERIA,
  'resume-upload': SECTION_RESUME_UPLOAD,
  'match-scorecard': SECTION_MATCH_SCORECARD,
  settings: SECTION_SETTINGS,
  'career-portal': SECTION_CAREER_PORTAL,
  'main-dashboard': [],
  'interview-creation': SECTION_AI_INTERVIEW,
  'ai-interview': SECTION_AI_INTERVIEW,
  setup: SECTION_SETUP,
  'interview-dashboard': SECTION_INTERVIEW_DASHBOARD,
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
