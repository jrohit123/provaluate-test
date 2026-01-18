
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
    <header className="bg-[#1e5da8] border-b px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <SidebarTrigger className="text-white flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold text-white truncate">ProValuate</h1>
          <p className="text-xs sm:text-sm text-white hidden sm:block">Smart Candidate Evaluation Platform</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <div className="text-xs sm:text-sm text-white hidden sm:block">
          {greeting}
        </div>
        <Button variant="outline" onClick={handleLogout} className="text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-10">
          <span className="hidden sm:inline">Logout</span>
          <span className="sm:hidden">Out</span>
        </Button>
      </div>
    </header>
  );
};