import { cloneElement, isValidElement, useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster as HotToaster } from 'react-hot-toast';
import './App.css';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { SessionTimeoutDialog } from '@/components/session/SessionTimeoutDialog';
import { SessionManager } from '@/utils/sessionManager';
import { useIsMobile } from '@/hooks/use-mobile';

// Import existing pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ServicesSelection from "./pages/ServicesSelection";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import Impact from "./pages/Impact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CandidateSignUp from "./pages/CandidateSignUp";
import CandidateLogin from "./pages/CandidateLogin";
import CandidatePricing from "./pages/CandidatePricing";
import CandidateOnboarding from "./pages/CandidateOnboarding";
import CandidateDashboard from "./pages/CandidateDashboard";
import TpoLogin from "./pages/TpoLogin";
import TpoDashboard from "./pages/TpoDashboard";
import CoverPage from "./pages/CoverPage";

// Import AI Interview components (now TypeScript)
import InterviewDashboard from "./components/ai-interview/InterviewDashboard";
import AIsetup from "./components/ai-interview/AIsetup";
import HRInterviewCreator from "./components/ai-interview/HRInterviewCreator";
import CandidateInterview from "./components/ai-interview/CandidateInterview";
import FinalResults from "./components/ai-interview/FinalResults";
import ConversationalInterview from "./components/ai-interview/ConversationalInterview";
import CandidateCompletion from "./components/ai-interview/CandidateCompletion";
import CompanyCareerPage from "./pages/CompanyCareerPage";
import CompanyCareerJobPage from "./pages/CompanyCareerJobPage";

import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/contexts/AuthContext";
import { InterviewProvider } from "@/contexts/InterviewContext";
import { SessionProvider } from "@/contexts/SessionContext";
import { API_CONFIG, buildApiUrl } from "@/constants/api";
import './App.css';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const location = useLocation();
  const {
    isTimeoutWarningVisible,
    remainingMinutes,
    continueSession,
    logout,
  } = useSessionTimeout();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 ProtectedRoute: Starting auth check...');
      setLoading(true);

      // Check Supabase Auth session first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('❌ ProtectedRoute: No Supabase user found');
        setIsAuthenticated(false);
        setOnboardingComplete(false);
        setLoading(false);
        return;
      }

      console.log('✅ ProtectedRoute: Supabase user found:', user.id);
      setIsAuthenticated(true);
      
      // Check if user has completed onboarding
      console.log('🔍 ProtectedRoute: Checking onboarding status...');
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('user_id', user.id)
        .single();
      
      // If profile doesn't exist or onboarding not complete, user needs onboarding
      if (profileError || !userProfile) {
        console.log('⚠️ ProtectedRoute: No profile found or error:', profileError);
        setOnboardingComplete(false);
        setLoading(false);
        return;
      }

      console.log('✅ ProtectedRoute: Profile found, onboarding_complete =', userProfile.onboarding_complete);
      setOnboardingComplete(userProfile.onboarding_complete === true);
      
      // Also check localStorage and session for existing users
      const isAuth = localStorage.getItem('recruitai_auth') === 'true';
      console.log('🔍 ProtectedRoute: recruitai_auth in localStorage =', isAuth);
      
      if (isAuth) {
        const sessionId = SessionManager.getCurrentSessionId();
        console.log('🔍 ProtectedRoute: Current session ID =', sessionId);
        
        const isActive = await SessionManager.isCurrentSessionActive();
        console.log('🔍 ProtectedRoute: Session active =', isActive);
        
        if (!isActive) {
          console.log('⚠️ ProtectedRoute: Session NOT active, clearing...');
          SessionManager.clearSession();
          localStorage.removeItem('recruitai_auth');
          setIsAuthenticated(false);
        } else {
          console.log('✅ ProtectedRoute: Session is active!');
        }
      }
      
      setLoading(false);
      console.log('✅ ProtectedRoute: Auth check complete');
    };

    checkAuth();
  }, [location.pathname]);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />;

  return (
    <>
      {children}
      <SessionTimeoutDialog
        isOpen={isTimeoutWarningVisible}
        remainingMinutes={remainingMinutes}
        onContinue={continueSession}
        onLogout={logout}
      />
    </>
  );
};

const CandidateProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setAllowed(false);
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }
      const { data: candidate } = await supabase
        .from('candidates')
        .select('candidate_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      setAllowed(!!candidate);
      setNeedsOnboarding(!candidate);
      setLoading(false);
    };
    check();
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (needsOnboarding) return <Navigate to="/candidate-onboarding" replace />;
  if (!allowed) return <Navigate to="/candidate-login" replace />;
  return <>{children}</>;
};

const TpoProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tpoUser, setTpoUser] = useState<{
    id?: string;
    full_name: string;
    email: string;
    role: 'tpo_admin' | 'tpo_staff';
  } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setAllowed(false);
          setNeedsOnboarding(false);
          setTpoUser(null);
          setLoading(false);
          return;
        }
        const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ME), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAllowed(false);
          setNeedsOnboarding(false);
          setTpoUser(null);
          setLoading(false);
          return;
        }
        if (data?.requires_onboarding) {
          setAllowed(false);
          setNeedsOnboarding(true);
          setTpoUser(null);
          setLoading(false);
          return;
        }
        setAllowed(true);
        setNeedsOnboarding(false);
        setTpoUser(data?.tpo_user ?? null);
      } catch {
        setAllowed(false);
        setNeedsOnboarding(false);
        setTpoUser(null);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (needsOnboarding) return <Navigate to="/tpo-login" replace />;
  if (!allowed) return <Navigate to="/tpo-login" replace />;
  if (isValidElement(children)) {
    return cloneElement(
      children as React.ReactElement<{ initialTpoUser?: typeof tpoUser }>,
      { initialTpoUser: tpoUser }
    );
  }
  return <>{children}</>;
};

// Toast component that adapts to mobile
const AdaptiveToaster = () => {
  const isMobile = useIsMobile();
  
  return (
    <HotToaster 
      position={isMobile ? "top-center" : "top-right"}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1f2937',
          color: '#fff',
          border: '1px solid #374151',
          maxWidth: isMobile ? '90%' : '400px',
        },
        success: {
          icon: '',
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          icon: '',
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <InterviewProvider>
              <SessionProvider>
                <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/candidate-signup" element={<CandidateSignUp />} />
            <Route path="/candidate-login" element={<CandidateLogin />} />
            <Route path="/candidate-login/:referralSlug" element={<Navigate to="/candidate-login" replace />} />
            <Route path="/tpo-login" element={<TpoLogin />} />
            <Route path="/candidate-pricing" element={<CandidatePricing />} />
            <Route path="/candidate-onboarding" element={<CandidateOnboarding />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            
            {/* Services Selection Page - Protected */}
            <Route path="/services" element={
              <ProtectedRoute>
                <ServicesSelection />
              </ProtectedRoute>
            } />
            
            {/* Main Dashboard - Original CV Screening Interface - Protected */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* Candidate Dashboard - Protected (no onboarding) */}
            <Route path="/candidate-dashboard" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/profile" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/jds" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/jds/configure" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/jds/create" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/interviews" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/performance-report" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/personal-interviews" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/campus-interviews" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/referrals" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/candidate-dashboard/resume-builder" element={
              <CandidateProtectedRoute>
                <CandidateDashboard />
              </CandidateProtectedRoute>
            } />
            <Route path="/tpo-dashboard" element={
              <TpoProtectedRoute>
                <TpoDashboard />
              </TpoProtectedRoute>
            } />
            
            {/* AI Interview Routes - Original Interface */}
            <Route path="/ai-interview/dashboard" element={<InterviewDashboard />} />
            <Route path="/ai-interview/setup" element={<AIsetup />} />
            <Route path="/ai-interview/hr/create-interview" element={<HRInterviewCreator />} />
            <Route path="/ai-interview/interview/:interviewId" element={<CandidateInterview />} />
            <Route path="/interview/:interviewId" element={<CandidateInterview />} />
            <Route path="/ai-interview/conversational-interview" element={<ConversationalInterview />} />
            <Route path="/conversational-interview" element={<ConversationalInterview />} />
            <Route path="/ai-interview/candidate-completion" element={<CandidateCompletion />} />
            <Route path="/candidate-completion" element={<CandidateCompletion />} />
            <Route path="/candidate-completion/:interviewId" element={<CandidateCompletion />} />
            <Route path="/ai-interview/final-results/:interviewId" element={<FinalResults />} />
            <Route path="/final-results/:interviewId" element={<FinalResults />} />
            
            {/* Public career page - no auth */}
            <Route path="/careers/:companySlug/job/:jdId" element={<CompanyCareerJobPage />} />
            <Route path="/careers/:companySlug" element={<CompanyCareerPage />} />
            
            {/* Landing: choose recruiter / candidate / TPO sign-in */}
            <Route path="/" element={<CoverPage />} />
            <Route path="*" element={<NotFound />} />
                </Routes>
                {/* Toast Providers */}
                <Toaster />
                <Sonner />
                <AdaptiveToaster />
              </SessionProvider>
            </InterviewProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;