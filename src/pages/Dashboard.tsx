import { useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { JobUploadSection } from '@/components/JobUploadSection';
import { ResumeUploadSection } from '@/components/ResumeUploadSection';
import { MatchScorecardSection } from '@/components/MatchScorecardSection';
import { CandidateDeepDive } from '@/components/CandidateDeepDive';
import { SmartInsights } from '@/components/SmartInsights';
import { Header } from '@/components/Header';
import { ContractsSection } from '@/components/ContractsSection';

export type ActiveSection = 'job-upload' | 'resume-upload' | 'match-scorecard' | 'candidate-dive' | 'insights' | 'settings' | 'contracts';

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('job-upload');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const renderMainContent = () => {
    switch (activeSection) {
      case 'job-upload':
        return <JobUploadSection />;
      case 'resume-upload':
        return <ResumeUploadSection />;
      case 'match-scorecard':
        return <MatchScorecardSection onCandidateSelect={setSelectedCandidate} />;
      case 'candidate-dive':
        return <CandidateDeepDive candidateId={selectedCandidate} />;
      case 'insights':
        return <SmartInsights />;
      case 'settings':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-primary-800">Settings</h2>
            <p className="text-muted-foreground">Configure your preferences and scoring logic here.</p>
          </div>
        );
      case 'contracts':
        return <ContractsSection />;
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
            © Provaluate 2025 | Privacy Policy | Terms | Contact | Powered by AI
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
