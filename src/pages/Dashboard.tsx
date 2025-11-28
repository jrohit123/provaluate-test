import { useState, useEffect } from 'react';
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

export type ActiveSection = 'main-dashboard' | 'job-upload' | 'evaluation-criteria' | 'resume-upload' | 'match-scorecard' | 'interview-creation' | 'ai-interview' | 'setup' | 'interview-dashboard' | 'settings';

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isSessionComplete } = useSession();

  // Get activeSection from URL parameter, default to 'main-dashboard'
  const activeSection = (searchParams.get('section') as ActiveSection) || 'main-dashboard';

  // Function to update the active section and URL
  const setActiveSection = (section: ActiveSection) => {
    setSearchParams({ section });
  };

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
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-auto">
            {renderMainContent()}
          </main>
          <footer className="bg-white border-t px-6 py-4 text-center text-sm text-muted-foreground">
            © ProValuate 2025 | Privacy Policy | Terms | <a href="mailto:rj@aitamate.com?&subject=ProValuate&body=Hi,%0D%0A%0D%0AI'd like to know more about ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="text-indigo-600 hover:text-indigo-800 transition-colors">Contact</a> | Powered by <a href="http://aitamate.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">aitamate</a>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;