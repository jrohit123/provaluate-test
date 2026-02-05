// Interview Type Definitions

export interface Question {
  id: string;
  question_text: string;
  question_order: number;
  parameter_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Answer {
  id: string;
  interview_id: string;
  question_id: string;
  question_order: number;
  transcript: string;
  feedback?: string;
  score?: number;
  created_at: string;
  updated_at?: string;
}

export interface JobDescription {
  id: string;
  jd_id: string;
  title: string;
  content: string;
  extracted_text: string;
  jd_file: string;
  created_at: string;
  updated_at?: string;
}

export interface StructuredQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  timeLimit: number; // in minutes
  difficulty: 'Easy' | 'Regular' | 'Expert';
  category: string;
  scoringCriteria: string[];
  created_at?: string;
  updated_at?: string;
}

export interface InterviewData {
  interviewId: string;
  position: string;
  duration: number;
  totalQuestions: number;
  currentQuestion?: Question;
  questions?: Question[];
  answers?: Answer[];
  candidateName?: string;
  candidateEmail?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomParameter {
  name: string;
  description: string;
  weight: number;
  min_questions: number;
  max_questions: number;
  max_time: number;
  scoring_criteria: string[];
  assigned_questions?: number;
  level?: 'Easy' | 'Regular' | 'Expert';
  /** When true/false, overrides keyword-based detection for written-answer (e.g. SQL/code) scenarios. */
  requires_written_answer?: boolean;
}

export interface CustomParameters {
  [key: string]: CustomParameter;
}

export interface InterviewState {
  isSubmitting: boolean;
  isProcessing: boolean;
  currentQuestionIndex: number;
  submitError: string | null;
  retryCount: number;
  maxRetries: number;
}

export interface CreatedInterview {
  id: string;
  position: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  created_at: string;
  totalQuestions: number;
  duration: number;
}

export interface Interview {
  id: string;
  position: string;
  candidate_name: string;
  candidate_email: string;
  status: 'pending' | 'in_progress' | 'completed' | 'terminated';
  total_questions: number;
  duration: number;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  total_score?: number;
  parameters?: CustomParameter[];
}

export interface SaveState {
  [key: string]: 'idle' | 'saving' | 'saved' | 'error';
}

export interface ReminderState {
  [key: string]: 'idle' | 'sending' | 'sent' | 'error';
}

export interface LocalDecision {
  [key: string]: string;
}

export interface LocalComment {
  [key: string]: string;
}

export interface SavedDecision {
  [key: string]: string;
}

export interface SavedComment {
  [key: string]: string;
}

export interface ExpandedComment {
  [key: string]: boolean;
}
