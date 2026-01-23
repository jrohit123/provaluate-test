import { useEffect, useState } from 'react';
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

// Import existing pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ServicesSelection from "./pages/ServicesSelection";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import Impact from "./pages/Impact";

// Import AI Interview components (now TypeScript)
import InterviewDashboard from "./components/ai-interview/InterviewDashboard";
import AIsetup from "./components/ai-interview/AIsetup";
import HRInterviewCreator from "./components/ai-interview/HRInterviewCreator";
import CandidateInterview from "./components/ai-interview/CandidateInterview";
import FinalResults from "./components/ai-interview/FinalResults";
import ConversationalInterview from "./components/ai-interview/ConversationalInterview";
import CandidateCompletion from "./components/ai-interview/CandidateCompletion";


import { supabase } from "@/integrations/supabase/client";
import { InterviewProvider } from "@/contexts/InterviewContext";
import { SessionProvider } from "@/contexts/SessionContext";
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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <InterviewProvider>
            <SessionProvider>
              <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/impact" element={<Impact />} />
            
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
            
            {/* Default route - redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
            </SessionProvider>
          </InterviewProvider>
          
          {/* Toast Providers */}
          <Toaster />
          <Sonner />
          <HotToaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1f2937',
                color: '#fff',
                border: '1px solid #374151',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;