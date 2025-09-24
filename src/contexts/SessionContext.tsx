import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SessionContextType {
  currentJobDescription: any | null;
  currentEvaluationCriteria: any | null;
  setCurrentJobDescription: (jobDescription: any | null) => void;
  setCurrentEvaluationCriteria: (criteria: any | null) => void;
  clearSession: () => void;
  isSessionComplete: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentJobDescription, setCurrentJobDescription] = useState<any | null>(null);
  const [currentEvaluationCriteria, setCurrentEvaluationCriteria] = useState<any | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('cv-screening-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setCurrentJobDescription(session.jobDescription || null);
        setCurrentEvaluationCriteria(session.evaluationCriteria || null);
      } catch (error) {
        console.error('Error loading session:', error);
      }
    }
  }, []);

  // Save session to localStorage whenever it changes
  useEffect(() => {
    const session = {
      jobDescription: currentJobDescription,
      evaluationCriteria: currentEvaluationCriteria,
    };
    localStorage.setItem('cv-screening-session', JSON.stringify(session));
  }, [currentJobDescription, currentEvaluationCriteria]);

  const clearSession = () => {
    setCurrentJobDescription(null);
    setCurrentEvaluationCriteria(null);
    localStorage.removeItem('cv-screening-session');
  };

  const isSessionComplete = currentJobDescription !== null && currentEvaluationCriteria !== null;

  return (
    <SessionContext.Provider
      value={{
        currentJobDescription,
        currentEvaluationCriteria,
        setCurrentJobDescription,
        setCurrentEvaluationCriteria,
        clearSession,
        isSessionComplete,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
