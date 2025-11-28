
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { SessionManager } from '@/utils/sessionManager';
import { supabase } from '@/integrations/supabase/client';

export const Header = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  /**
   * Delete a cookie by name
   */
  const deleteCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    console.log(`🍪 Cookie deleted: ${name}`);
  };

  const handleLogout = async () => {
    try {
      const sessionId = SessionManager.getCurrentSessionId();
      if (sessionId) {
        await SessionManager.endSession(sessionId);
      }
      SessionManager.clearSession();
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Error signing out:', error);
    }

    // Clear cookies for extension
    deleteCookie('provaluate_user_id');
    deleteCookie('provaluate_company_id');

    localStorage.removeItem('recruitai_auth');
    localStorage.removeItem('onboarding_complete');
    localStorage.removeItem('cv-screening-session');
    try {
      sessionStorage.removeItem('selectedJDId');
      sessionStorage.removeItem('selectedCriteriaGridId');
      sessionStorage.removeItem('uploadedFiles');
      sessionStorage.removeItem('selectedCandidatesForInterview');
      window.dispatchEvent(new Event('session:cleared'));
    } catch (e) {
      // no-op
    }

    toast({
      title: "Logged out successfully",
      description: "You've been logged out of your account.",
    });
    navigate('/login');
  };

  const userName = user?.profile ? `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim() : '';
  const firstName = user?.profile?.first_name || '';
  const companyName = user?.company?.company_name || '';
  const greeting = firstName
    ? `Welcome back, ${firstName}${companyName ? ` (${companyName})` : ''}`
    : 'Welcome back, Recruiter';

  return (
    <header className="bg-[#1e5da8] border-b px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-white" />
        <div>
          <h1 className="text-xl font-semibold text-white">ProValuate</h1>
          <p className="text-sm text-white">Smart Candidate Evaluation Platform</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-white">
          {greeting}
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
};