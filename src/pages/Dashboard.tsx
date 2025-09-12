import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/cv-screening/AppSidebar';
import { JobUploadSection } from '@/components/cv-screening/JobUploadSection';
import { ResumeUploadSection } from '@/components/cv-screening/ResumeUploadSection';
import { MatchScorecardSection } from '@/components/cv-screening/MatchScorecardSection';
import { Header } from '@/components/cv-screening/Header';
import AdminUserManagement from '@/components/cv-screening/AdminUserManagement';
import HRInterviewCreator from '@/components/ai-interview/HRInterviewCreator';
import AIsetup from '@/components/ai-interview/AIsetup';
import InterviewDashboard from '@/components/ai-interview/InterviewDashboard';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, ArrowRight } from 'lucide-react';

export type ActiveSection = 'job-upload' | 'resume-upload' | 'match-scorecard' | 'interview-creation' | 'ai-interview' | 'setup' | 'interview-dashboard' | 'settings';

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('job-upload');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're on the direct job upload route or if we have navigation state
  useEffect(() => {
    if (location.pathname === '/cv-screening/job-upload') {
      setActiveSection('job-upload');
    } else if (location.state?.activeSection) {
      setActiveSection(location.state.activeSection);
    }
  }, [location.pathname, location.state]);

  const renderMainContent = () => {
    switch (activeSection) {
      case 'job-upload':
        return <JobUploadSection />;
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
        return <JobUploadSection />;
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
            © Provaluate 2025 | Privacy Policy | Terms | Contact | Powered by <a href="http://aitamate.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">aitamate</a>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
