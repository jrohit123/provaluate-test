import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Joyride, { type CallBackProps } from 'react-joyride';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/cv-screening/AppSidebar';
import { JobUploadSection } from '@/components/cv-screening/JobUploadSection';
import { ResumeUploadSection } from '@/components/cv-screening/ResumeUploadSection';
import { MatchScorecardSection } from '@/components/cv-screening/MatchScorecardSection';
import { Header } from '@/components/cv-screening/Header';
import { MainDashboard } from '@/components/cv-screening/MainDashboard';
import { EvaluationCriteriaSection } from '@/components/cv-screening/EvaluationCriteriaSection';
import AdminUserManagement from '@/components/cv-screening/AdminUserManagement';
import { CareerPortalSection } from '@/components/cv-screening/CareerPortalSection';
import HRInterviewCreator from '@/components/ai-interview/HRInterviewCreator';
import AIsetup from '@/components/ai-interview/AIsetup';
import InterviewDashboard from '@/components/ai-interview/InterviewDashboard';
import { useAuth } from '@/hooks/use-auth';
import { useSession } from '@/contexts/SessionContext';
import { UiAnalyticsService } from '@/services/uiAnalyticsService';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import {
  getMainTourSteps,
  getSectionTourSteps,
  getSectionTourStorageKey,
  getTourSectionsForPlan,
  isSidebarOnlyTarget,
  TOUR_OPEN_SIDEBAR_EVENT,
  TOUR_STORAGE_KEY,
  waitForTarget,
  type PlanType,
} from '@/constants/tour';

export type ActiveSection = 'main-dashboard' | 'job-upload' | 'evaluation-criteria' | 'resume-upload' | 'match-scorecard' | 'career-portal' | 'interview-creation' | 'ai-interview' | 'setup' | 'interview-dashboard' | 'settings';

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { user } = useAuth();
  const { isSessionComplete } = useSession();
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  // Guided tour state
  const [tourRun, setTourRun] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourMode, setTourMode] = useState<'main' | 'section'>('main');
  const [tourSection, setTourSection] = useState<ActiveSection | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [pendingMainTour, setPendingMainTour] = useState(false);
  const [sectionReadyMap, setSectionReadyMap] = useState<Partial<Record<ActiveSection, boolean>>>({});
  const prevSectionRef = useRef<ActiveSection | null>(null);

  const isAdmin = user?.profile?.role === 'admin' || user?.profile?.role === 'superadmin';

  // Resolve effective plan type for plan-aware tour steps.
  // Missing/empty plan_type => 'combo' (free tier behavior).
  const [effectivePlanType, setEffectivePlanType] = useState<PlanType | null>(null);
  useEffect(() => {
    const cid = user?.profile?.company_id;
    if (!cid) {
      setEffectivePlanType(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('plan_type')
          .eq('company_id', cid)
          .single();
        if (!alive) return;
        if (error) {
          console.warn('Could not load plan_type for tour:', error);
          setEffectivePlanType('combo');
          return;
        }
        const raw = data?.plan_type;
        const resolved =
          raw != null && String(raw).trim() !== ''
            ? (String(raw).toLowerCase() as PlanType)
            : 'combo';
        setEffectivePlanType(resolved);
      } catch (e) {
        if (!alive) return;
        console.warn('Unexpected error loading plan_type for tour:', e);
        setEffectivePlanType('combo');
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.profile?.company_id]);

  const tourSteps = useMemo(() => {
    if (tourMode === 'section' && tourSection) return getSectionTourSteps(tourSection);
    if (!effectivePlanType) return [];
    return getMainTourSteps(isMobile, effectivePlanType);
  }, [tourMode, tourSection, isMobile, effectivePlanType]);

  const joyrideSteps = useMemo(
    () =>
      tourSteps.map((s) => ({
        target: s.target,
        content: s.content,
        title: s.title,
        placement: s.placement,
        disableBeacon: true,
        ...(s.disableScrolling != null && { disableScrolling: s.disableScrolling }),
      })),
    [tourSteps]
  );

  // Get activeSection from URL parameter, default to 'main-dashboard'
  const activeSection = (searchParams.get('section') as ActiveSection) || 'main-dashboard';

  // ✅ ADD: Read JD and criteria from URL parameters (from extension) and set in sessionStorage
  useEffect(() => {
    const jdId = searchParams.get('jdId');
    const criteriaId = searchParams.get('criteriaId');
    
    if (jdId) {
      sessionStorage.setItem('selectedJDId', jdId);
      console.log('✅ Set JD from URL parameter:', jdId);
      // Trigger a custom event so MatchScorecardSection can pick it up
      window.dispatchEvent(new CustomEvent('jd-selected', { detail: { jdId } }));
    }
    if (criteriaId) {
      sessionStorage.setItem('selectedCriteriaGridId', criteriaId);
      console.log('✅ Set Criteria from URL parameter:', criteriaId);
      // Trigger a custom event so MatchScorecardSection can pick it up
      window.dispatchEvent(new CustomEvent('criteria-selected', { detail: { criteriaId } }));
    }
    
    // Remove parameters from URL after reading them (clean URL)
    if (jdId || criteriaId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('jdId');
      newParams.delete('criteriaId');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Function to update the active section and URL
  const setActiveSection = (section: ActiveSection) => {
    setSearchParams({ section });
  };

  const handleDashboardReady = useCallback(() => setDashboardReady(true), []);

  const handleSectionReady = useCallback((section: ActiveSection) => {
    setSectionReadyMap((m) => ({ ...m, [section]: true }));
  }, []);

  const endTour = useCallback(() => {
    try {
      if (tourMode === 'section' && tourSection) {
        localStorage.setItem(getSectionTourStorageKey(tourSection), 'true');
      } else {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      }
    } catch {
      /* ignore */
    }
    setTourRun(false);
    setTourStepIndex(0);
    setTourMode('main');
    setTourSection(null);
  }, [tourMode, tourSection]);

  const startMainTour = useCallback(
    (ignoreCompleted = false) => {
      if (!ignoreCompleted && localStorage.getItem(TOUR_STORAGE_KEY) === 'true') return;
      // Wait until plan type is resolved to avoid showing wrong (CV vs interview) steps.
      if (!effectivePlanType) {
        setPendingMainTour(true);
        setSearchParams({ section: 'main-dashboard' }, { replace: true });
        return;
      }
      setTourStepIndex(0);
      setTourMode('main');
      setTourSection(null);
      setSearchParams({ section: 'main-dashboard' }, { replace: true });
      if (activeSection === 'main-dashboard' && dashboardReady) {
        setTourRun(true);
      } else {
        setPendingMainTour(true);
      }
    },
    [activeSection, dashboardReady, setSearchParams, effectivePlanType]
  );

  const startSectionTour = useCallback((section: ActiveSection) => {
    if (localStorage.getItem(getSectionTourStorageKey(section)) === 'true') return;
    if (section === 'settings' && !isAdmin) return;
    setTourStepIndex(0);
    setTourMode('section');
    setTourSection(section);
    setTourRun(true);
  }, [isAdmin]);

  const goToNextStep = useCallback(
    async (fromIndex: number) => {
      const nextIndex = fromIndex + 1;
      if (nextIndex >= tourSteps.length) {
        endTour();
        return;
      }
      const nextStep = tourSteps[nextIndex];
      const navSection = nextStep?.navigateToSection;

      if (navSection && activeSection !== navSection) {
        setSearchParams({ section: navSection });
        try {
          await waitForTarget(nextStep.target, { timeoutMs: 4000, intervalMs: 150 });
        } catch {
          /* skip step if target not found */
        }
      }

      if (isMobile && nextStep && isSidebarOnlyTarget(nextStep.target)) {
        window.dispatchEvent(new CustomEvent(TOUR_OPEN_SIDEBAR_EVENT));
        await new Promise((r) => setTimeout(r, 350));
      }

      // Scroll next target into view so step 4 (extension) is visible before we advance
      const el = document.querySelector(nextStep.target);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        await new Promise((r) => setTimeout(r, 350));
      }

      setTourStepIndex(nextIndex);
    },
    [activeSection, endTour, setSearchParams, tourSteps]
  );

  const handleTourCallback = useCallback(
    async (data: CallBackProps) => {
      const { action, index, status, type } = data;
      const isSkip = action === 'skip' || status === 'skipped';
      const isClose = action === 'close';
      const isFinish = status === 'finished';

      if (isSkip || isClose || isFinish) {
        endTour();
        return;
      }

      if (type === 'error:target_not_found') {
        console.warn('[Tour] Target not found for step', index, '- ending tour.');
        endTour();
        return;
      }

      // Only advance on user-initiated Next/Back (step:after). Ignore tour:status etc. to prevent
      // fast-forward when we programmatically update stepIndex.
      if (type !== 'step:after') return;

      if (action === 'prev') {
        setTourStepIndex(Math.max(0, index - 1));
        return;
      }

      if (action === 'next') {
        await goToNextStep(index);
      }
    },
    [endTour, goToNextStep, joyrideSteps.length]
  );

  // Reset dashboard ready when leaving main-dashboard; clear pending tour
  useEffect(() => {
    if (activeSection !== 'main-dashboard') {
      setDashboardReady(false);
      setPendingMainTour(false);
    }
  }, [activeSection]);

  // Clear section ready when leaving that section (so we wait again on next visit)
  useEffect(() => {
    const prev = prevSectionRef.current;
    if (prev && prev !== activeSection) {
      setSectionReadyMap((m) => ({ ...m, [prev]: false }));
    }
    prevSectionRef.current = activeSection;
  }, [activeSection]);

  // Start main tour when pending and dashboard is ready (e.g. manual Guided Tour before load)
  useEffect(() => {
    if (
      activeSection !== 'main-dashboard' ||
      !dashboardReady ||
      !pendingMainTour ||
      !effectivePlanType ||
      tourRun
    )
      return;
    setPendingMainTour(false);
    setTourRun(true);
  }, [activeSection, dashboardReady, pendingMainTour, tourRun, effectivePlanType]);

  // Auto-start main tour only after dashboard (with stats) has fully loaded and user has seen it
  useEffect(() => {
    if (activeSection !== 'main-dashboard' || tourRun || pendingMainTour) return;
    if (localStorage.getItem(TOUR_STORAGE_KEY) === 'true') return;
    if (!dashboardReady) return;
    const t = setTimeout(() => startMainTour(false), 1200);
    return () => clearTimeout(t);
  }, [activeSection, tourRun, pendingMainTour, dashboardReady, startMainTour]);

  // Auto-start section tour when first visiting a tour-enabled section, only after that section has loaded
  useEffect(() => {
    if (!effectivePlanType) return;
    const allowedSections = getTourSectionsForPlan(effectivePlanType);
    if (!allowedSections.includes(activeSection) || tourRun) return;
    if (activeSection === 'settings' && !isAdmin) return;
    if (localStorage.getItem(getSectionTourStorageKey(activeSection)) === 'true') return;
    if (!sectionReadyMap[activeSection]) return;
    const t = setTimeout(() => startSectionTour(activeSection), 400);
    return () => clearTimeout(t);
  }, [activeSection, tourRun, isAdmin, sectionReadyMap, startSectionTour, effectivePlanType]);

  // Track which section the recruiter is viewing
  useEffect(() => {
    UiAnalyticsService.track({
      name: 'dashboard_section_viewed',
      area: 'cv_screening_dashboard',
      metadata: { section: activeSection },
    });
  }, [activeSection]);

  // Track scroll depth on the main dashboard content area
  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container) return;

    const thresholds = [0.25, 0.5, 0.75, 1];
    const seen = new Set<number>();

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const depth =
        scrollHeight <= clientHeight
          ? 1
          : (scrollTop + clientHeight) / scrollHeight;

      thresholds.forEach((t) => {
        if (!seen.has(t) && depth >= t) {
          seen.add(t);
          UiAnalyticsService.track({
            name: 'dashboard_scroll_depth',
            area: 'cv_screening_dashboard',
            metadata: { depth: t, section: activeSection },
          });
        }
      });
    };

    container.addEventListener('scroll', handleScroll);
    // Trigger once on mount to capture short pages
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [activeSection]);

  const renderMainContent = () => {
    switch (activeSection) {
      case 'main-dashboard':
        return (
          <MainDashboard
            onSectionChange={setActiveSection}
            onStartTour={() => startMainTour(true)}
            onDashboardReady={handleDashboardReady}
          />
        );
      case 'job-upload':
        return <JobUploadSection onSectionReady={() => handleSectionReady('job-upload')} />;
      case 'evaluation-criteria':
        return <EvaluationCriteriaSection onSectionReady={() => handleSectionReady('evaluation-criteria')} />;
      case 'resume-upload':
        return <ResumeUploadSection onSectionReady={() => handleSectionReady('resume-upload')} />;
      case 'match-scorecard':
        return (
          <MatchScorecardSection
            onCandidateSelect={setSelectedCandidate}
            onSectionReady={() => handleSectionReady('match-scorecard')}
          />
        );
      case 'career-portal':
        return <CareerPortalSection onSectionReady={() => handleSectionReady('career-portal')} />;
      case 'interview-creation':
        return <HRInterviewCreator onSectionReady={() => handleSectionReady('ai-interview')} />;
      case 'ai-interview':
        return <HRInterviewCreator onSectionReady={() => handleSectionReady('ai-interview')} />;
      case 'setup':
        return <AIsetup onSectionReady={() => handleSectionReady('setup')} />;
      case 'interview-dashboard':
        return <InterviewDashboard onSectionChange={setActiveSection} onSectionReady={() => handleSectionReady('interview-dashboard')} />;
      case 'settings':
        return <AdminUserManagement onSectionReady={() => handleSectionReady('settings')} />;
      default:
        return (
          <MainDashboard
            onSectionChange={setActiveSection}
            onStartTour={() => startMainTour(true)}
            onDashboardReady={handleDashboardReady}
          />
        );
    }
  };

  return (
    <SidebarProvider>
      <Joyride
        run={tourRun}
        steps={joyrideSteps}
        stepIndex={tourStepIndex}
        callback={handleTourCallback}
        continuous
        showProgress
        showSkipButton
        disableOverlayClose={true}
        scrollToFirstStep={false}
        spotlightPadding={8}
        locale={{ skip: 'Skip tour', back: 'Back', next: 'Next', last: 'Finish' }}
        styles={{
          options: {
            primaryColor: 'hsl(220, 100%, 40%)',
            zIndex: 10000,
            arrowColor: '#fff',
            backgroundColor: '#fff',
            overlayColor: 'rgba(0,0,0,0.5)',
            textColor: '#1f2937',
          },
          tooltip: {
            borderRadius: 8,
            padding: 16,
            maxWidth: isMobile
              ? (typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.92, 360) : 360)
              : 400,
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonNext: {
            minHeight: 44,
          },
          buttonBack: {
            minHeight: 44,
          },
          buttonSkip: {
            minHeight: 44,
          },
        }}
      />
      <div className="flex w-full bg-gray-50 min-h-screen">
        <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main ref={mainScrollRef} className="flex-1">
            {renderMainContent()}
            <footer className="bg-white border-t px-4 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm text-muted-foreground mt-auto">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0 sm:space-x-2">
                <span>© ProValuate 2025</span>
                <span className="hidden sm:inline">|</span>
                <Link to="/privacy" className="text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap">Privacy Policy</Link>
                <span className="hidden sm:inline">|</span>
                <Link to="/terms" className="text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap">Terms</Link>
                <span className="hidden sm:inline">|</span>
                <a href="mailto:sales@aitamate.com?&subject=ProValuate&body=Hi,%0D%0A%0D%0AI'd like to know more about ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap">Contact</a>
                <span className="hidden sm:inline">|</span>
                <span className="whitespace-nowrap">Powered by <a href="http://aitamate.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">aitamate</a></span>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;