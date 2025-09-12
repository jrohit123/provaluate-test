import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster as HotToaster } from 'react-hot-toast';
import './App.css';

// Import existing pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ServicesSelection from "./pages/ServicesSelection";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

// Import AI Interview components (now TypeScript)
import InterviewDashboard from "./components/ai-interview/InterviewDashboard";
import AIsetup from "./components/ai-interview/AIsetup";
import WelcomePage from "./components/ai-interview/WelcomePage";
import WhyAitamatePage from "./components/ai-interview/WhyAitamatePage";
import HRInterviewCreator from "./components/ai-interview/HRInterviewCreator";
import CandidateInterview from "./components/ai-interview/CandidateInterview";
import FinalResults from "./components/ai-interview/FinalResults";
import ConversationalInterview from "./components/ai-interview/ConversationalInterview";
import CandidateCompletion from "./components/ai-interview/CandidateCompletion";
import CustomParameterManager from "./components/ai-interview/CustomParameterManager";

import { supabase } from "@/integrations/supabase/client";
import { InterviewProvider } from "@/contexts/InterviewContext";
import './App.css';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      // Check if user is authenticated using localStorage (simplified for current setup)
      const isAuth = localStorage.getItem('recruitai_auth') === 'true';
      setIsAuthenticated(isAuth);
      setLoading(false);
    };
    
    checkAuth();
  }, [location.pathname]);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <InterviewProvider>
            <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            
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
            
            {/* Direct Job Upload Section - Protected */}
            <Route path="/cv-screening/job-upload" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* AI Interview Routes - Original Interface */}
            <Route path="/ai-interview" element={<WelcomePage />} />
            <Route path="/ai-interview/dashboard" element={<InterviewDashboard />} />
            <Route path="/ai-interview/setup" element={<AIsetup />} />
            <Route path="/ai-interview/why-aitamate" element={<WhyAitamatePage />} />
            <Route path="/ai-interview/hr/create-interview" element={<HRInterviewCreator />} />
            <Route path="/ai-interview/parameters" element={<CustomParameterManager roleName="" onParametersUpdated={() => {}} />} />
            <Route path="/ai-interview/interview/:interviewId" element={<CandidateInterview />} />
            <Route path="/interview/:interviewId" element={<CandidateInterview />} />
            <Route path="/ai-interview/conversational-interview" element={<ConversationalInterview />} />
            <Route path="/conversational-interview" element={<ConversationalInterview />} />
            <Route path="/ai-interview/candidate-completion" element={<CandidateCompletion />} />
            <Route path="/candidate-completion" element={<CandidateCompletion />} />
            <Route path="/ai-interview/final-results/:interviewId" element={<FinalResults />} />
            <Route path="/final-results/:interviewId" element={<FinalResults />} />
            
            {/* Default route - redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
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