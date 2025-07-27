import { useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { JobUploadSection } from '@/components/JobUploadSection';
import { ResumeUploadSection } from '@/components/ResumeUploadSection';
import { MatchScorecardSection } from '@/components/MatchScorecardSection';
import { Header } from '@/components/Header';
import AdminUserManagement from '@/components/AdminUserManagement';
import { useAuth } from '@/hooks/use-auth';

export type ActiveSection = 'job-upload' | 'resume-upload' | 'match-scorecard' | 'settings';

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('job-upload');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { user } = useAuth();

  const renderMainContent = () => {
    switch (activeSection) {
      case 'job-upload':
        return <JobUploadSection />;
      case 'resume-upload':
        return <ResumeUploadSection />;
      case 'match-scorecard':
        return <MatchScorecardSection onCandidateSelect={setSelectedCandidate} />;
      case 'settings':
        return (
          <div className="p-6">
            <AdminUserManagement />
            <h2 className="text-2xl font-bold mb-4 text-primary-800">Settings</h2>
            <p className="text-muted-foreground">Configure your preferences and scoring logic here.</p>
          </div>
        );
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
