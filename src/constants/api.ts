// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com',
  ENDPOINTS: {
    // Interview Management
    CREATE_INTERVIEW: '/api/create-interview',
    GET_INTERVIEW: '/api/get-interview',
    GET_ALL_INTERVIEWS: '/api/get-all-interviews',
    UPDATE_INTERVIEW_DECISION: '/api/update-interview-decision',
    FINISH_INTERVIEW: '/api/finish-interview',
    TERMINATE_INTERVIEW: '/api/terminate-interview',
    START_INTERVIEW: '/api/start-interview',
    
    // Question Management
    GENERATE_QUESTION: '/api/generate-question',
    SUBMIT_ANSWER: '/api/submit-answer',
    UPLOAD_QUESTION_VIDEO: '/api/upload-question-video',
    
    // Parameter Management
    CUSTOM_PARAMETERS: '/api/custom-parameters',
    GENERATE_DYNAMIC_PARAMETERS: '/api/generate-dynamic-parameters',
    GET_INTERVIEW_COUNT: '/api/get-interview-count',
    
    // Job Description
    EXTRACT_JD_TEXT: '/api/extract-jd-text',
    
    // Structured Interview
    STRUCTURED_INTERVIEW: '/api/structured-interview',
    
    // Results
    GET_FINAL_RESULTS: '/api/get-final-results',
    GET_QUESTIONS: '/api/get-questions',
    TRACK_COMPLETION_VIEW: '/api/track-completion-view',
    
    // Interview Configuration
    SAVE_INTERVIEW_CONFIG: '/api/save-interview-config',
    
    // Email
    SEND_INTERVIEW_EMAIL: '/api/send-interview-email',
  },
  TIMEOUTS: {
    DEFAULT: 300000, // 30 seconds
    VIDEO_UPLOAD: 180000, // 3 minutes (increased for large video files)
    ANSWER_SUBMISSION: 300000, // 5 minutes
    GENERATE_QUESTION: 120000, // 2 minutes for question generation
    FILE_READER: 15000, // 15 seconds (increased for large audio files)
    HEARTBEAT: 30000, // 30 seconds
    AUDIO_PROCESSING: 120000, // 2 minutes for audio transcription
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MULTIPLIER: 1000, // 1 second base
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function for API calls with timeout
export const apiCall = async (
  endpoint: string, 
  options: RequestInit = {}, 
  timeout: number = API_CONFIG.TIMEOUTS.DEFAULT
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(buildApiUrl(endpoint), {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};
