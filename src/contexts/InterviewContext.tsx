import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { InterviewState } from '@/types/interview';

// Types

type InterviewAction =
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_QUESTION_INDEX'; payload: number }
  | { type: 'SET_SUBMIT_ERROR'; payload: string | null }
  | { type: 'INCREMENT_RETRY' }
  | { type: 'RESET_RETRY' }
  | { type: 'RESET_ERRORS' };

// Initial state
const initialState: InterviewState = {
  isSubmitting: false,
  isProcessing: false,
  currentQuestionIndex: 0,
  submitError: null,
  retryCount: 0,
  maxRetries: 3,
};

// Reducer
function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_QUESTION_INDEX':
      return { ...state, currentQuestionIndex: action.payload };
    case 'SET_SUBMIT_ERROR':
      return { ...state, submitError: action.payload };
    case 'INCREMENT_RETRY':
      return { ...state, retryCount: state.retryCount + 1 };
    case 'RESET_RETRY':
      return { ...state, retryCount: 0 };
    case 'RESET_ERRORS':
      return { ...state, submitError: null, retryCount: 0 };
    default:
      return state;
  }
}

// Context
const InterviewContext = createContext<{
  state: InterviewState;
  dispatch: React.Dispatch<InterviewAction>;
} | null>(null);

// Provider component
export function InterviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  return (
    <InterviewContext.Provider value={{ state, dispatch }}>
      {children}
    </InterviewContext.Provider>
  );
}

// Custom hook to use the context
export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
}

// Action creators for easier usage
export const interviewActions = {
  setSubmitting: (isSubmitting: boolean): InterviewAction => ({
    type: 'SET_SUBMITTING',
    payload: isSubmitting,
  }),
  setProcessing: (isProcessing: boolean): InterviewAction => ({
    type: 'SET_PROCESSING',
    payload: isProcessing,
  }),
  setQuestionIndex: (index: number): InterviewAction => ({
    type: 'SET_QUESTION_INDEX',
    payload: index,
  }),
  setSubmitError: (error: string | null): InterviewAction => ({
    type: 'SET_SUBMIT_ERROR',
    payload: error,
  }),
  incrementRetry: (): InterviewAction => ({
    type: 'INCREMENT_RETRY',
  }),
  resetRetry: (): InterviewAction => ({
    type: 'RESET_RETRY',
  }),
  resetErrors: (): InterviewAction => ({
    type: 'RESET_ERRORS',
  }),
};
