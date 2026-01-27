import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/cv-screening/AppSidebar';
import { JobUploadSection } from '@/components/cv-screening/JobUploadSection';
import { ResumeUploadSection } from '@/components/cv-screening/ResumeUploadSection';
import { MatchScorecardSection } from '@/components/cv-screening/MatchScorecardSection';
import { Header } from '@/components/cv-screening/Header';
import { MainDashboard } from '@/components/cv-screening/MainDashboard';
import { EvaluationCriteriaSection } from '@/components/cv-screening/EvaluationCriteriaSection';
import AdminUserManagement from '@/components/cv-screening/AdminUserManagement';
import HRInterviewCreator from '@/components/ai-interview/HRInterviewCreator';
import AIsetup from '@/components/ai-interview/AIsetup';
import InterviewDashboard from '@/components/ai-interview/InterviewDashboard';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, ArrowRight, Upload, BarChart3, Wrench, Monitor } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { UiAnalyticsService } from '@/services/uiAnalyticsService';

export type ActiveSection = 'main-dashboard' | 'job-upload' | 'evaluation-criteria' | 'resume-upload' | 'match-scorecard' | 'interview-creation' | 'ai-interview' | 'setup' | 'interview-dashboard' | 'settings';

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isSessionComplete } = useSession();
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

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
        return <MainDashboard onSectionChange={setActiveSection} />;
      case 'job-upload':
        return <JobUploadSection />;
      case 'evaluation-criteria':
        return <EvaluationCriteriaSection />;
      case 'resume-upload':
        return <ResumeUploadSection />;
      case 'match-scorecard':
        return <MatchScorecardSection onCandidateSelect={setSelectedCandidate} />;
      case 'interview-creation':
        return <HRInterviewCreator />;
      case 'ai-interview':
        return <HRInterviewCreator />;
      case 'setup':
        return <AIsetup />;
      case 'interview-dashboard':
        return <InterviewDashboard onSectionChange={setActiveSection} />;
      case 'settings':
        return <AdminUserManagement />;
      default:
        return <MainDashboard onSectionChange={setActiveSection} />;
    }
  };

  return (
    <SidebarProvider>
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
                <a href="#" className="text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap">Privacy Policy</a>
                <span className="hidden sm:inline">|</span>
                <a href="#" className="text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap">Terms</a>
                <span className="hidden sm:inline">|</span>
                <a href="mailto:rj@aitamate.com?&subject=ProValuate&body=Hi,%0D%0A%0D%0AI'd like to know more about ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap">Contact</a>
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