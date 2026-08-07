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
    UPLOAD_QUESTION_MEDIA: '/api/upload-question-media',
    UPLOAD_QUESTION_VIDEO_CHUNK: '/api/upload-question-video-chunk',
    FINALIZE_QUESTION_VIDEO: '/api/finalize-question-video',
    
    // Competency config (API paths unchanged for backend compatibility)
    CUSTOM_PARAMETERS: '/api/custom-parameters',
    GENERATE_DYNAMIC_PARAMETERS: '/api/generate-dynamic-parameters',
    GET_INTERVIEW_COUNT: '/api/get-interview-count',
    
    // Job Description
    EXTRACT_JD_TEXT: '/api/extract-jd-text',
    
    // Structured Interview
    STRUCTURED_INTERVIEW: '/api/structured-interview',
    
    // Results
    GET_FINAL_RESULTS: '/api/get-final-results',
    GET_CANDIDATE_INTERVIEW_PROGRESS: '/api/candidate-interview-progress',
    ANALYZE_SPEECH: '/api/analyze-speech',
    GET_QUESTIONS: '/api/get-questions',
    TRACK_COMPLETION_VIEW: '/api/track-completion-view',
    
    // Candidate Photo (cross-browser storage)
    UPLOAD_CANDIDATE_PHOTO: '/api/upload-candidate-photo',
    GET_CANDIDATE_PHOTO: '/api/get-candidate-photo',
    
    // Interview Configuration
    SAVE_INTERVIEW_CONFIG: '/api/save-interview-config',
    
    // Email
    SEND_INTERVIEW_EMAIL: '/api/send-interview-email',

    // TTS and Conversational Phrases
    TTS: '/api/tts',
    GENERATE_INTERVIEW_PHRASE: '/api/generate-interview-phrase',

    // Candidate: OTP, onboarding, plans, payment, referrals
    CANDIDATE_SEND_OTP: '/api/candidate/send-otp',
    CANDIDATE_VERIFY_OTP: '/api/candidate/verify-otp',
    CANDIDATE_PLANS: '/api/candidate/plans',
    CANDIDATE_CREATE_ORDER: '/api/candidate/create-order',
    CANDIDATE_VERIFY_PAYMENT: '/api/candidate/verify-payment',

    // Recruiter: one-time plan payment
    RECRUITER_PLANS: '/api/plans',
    RECRUITER_CREATE_ORDER: '/payments/create-order',
    RECRUITER_VERIFY_PAYMENT: '/payments/verify',
    RECRUITER_VALIDATE_COUPON: '/payments/validate-coupon',
    RECRUITER_CANCEL_ORDER: '/payments/cancel-order',
    CANDIDATE_ONBOARDING_COMPLETE: '/api/candidate/onboarding/complete',
    CANDIDATE_REFERRAL_LINK_GENERATE: '/api/candidate/referral-link/generate',
    CANDIDATE_REFERRAL_LINK: '/api/candidate/referral-link',
    CANDIDATE_REFERRAL_ADD_MOBILE: '/api/candidate/referral-link/allowed-mobiles',
    CANDIDATE_REFERRAL_DASHBOARD: '/api/candidate/referrals/dashboard',
    CANDIDATE_REFERRAL_SETTINGS: '/api/candidate/referral-settings',
    CANDIDATE_APPLY_REFERRAL: '/api/candidate/apply-referral',
    CANDIDATE_PLAN_PRICING: '/api/candidate/plan-pricing',
    CANDIDATE_COLLEGE_COURSES: '/api/candidate/college/courses',
    CANDIDATE_COLLEGE_VERIFY: '/api/candidate/college/verify',
    CANDIDATE_COLLEGE_AUTO_ENROLL: '/api/candidate/college/auto-enroll-from-email',
    CANDIDATE_COLLEGE_ENROLLMENT: '/api/candidate/college/enrollment',
    CANDIDATE_CAMPUS_INTERVIEWS: '/api/candidate/campus-interviews',
    CANDIDATE_CAMPUS_INTERVIEW_LINK_ATTEMPT: '/api/candidate/campus-interviews/link-attempt',
    CANDIDATE_INVITE_VALIDATE: '/api/candidate/invite/validate',
    CANDIDATE_INVITE_ACTIVATE: '/api/candidate/invite/activate',

    // TPO onboarding and dashboard
    TPO_ME: '/api/tpo/me',
    TPO_ONBOARDING_COMPLETE: '/api/tpo/onboarding/complete',
    TPO_DASHBOARD_STATS: '/api/tpo/dashboard/stats',
    TPO_CAMPUS_INTERVIEWS: '/api/tpo/campus-interviews',
    TPO_CAMPUS_INTERVIEW_ATTEMPTS: '/api/tpo/campus-interviews/attempts',
    TPO_COLLEGE_COURSES: '/api/tpo/college-courses',
    TPO_STUDENTS: '/api/tpo/students',
    TPO_ACTIVITY_COHORT: '/api/tpo/activity/cohort',
    TPO_CAMPUS_ROLE_INVITES: '/api/tpo/campus-role-invites',
    TPO_CAMPUS_ROLE_APPLICATIONS: '/api/tpo/campus-role-applications',
    TPO_ROSTER_UPLOAD: '/api/tpo/roster/upload',
    TPO_ROSTER_LIST: '/api/tpo/roster',
    TPO_ROSTER_SEND_INVITES: '/api/tpo/roster/send-invites',
    CANDIDATE_CAMPUS_OPPORTUNITIES: '/api/candidate/campus-opportunities',
  },
  TIMEOUTS: {
    DEFAULT: 300000, // 30 seconds
    VIDEO_UPLOAD: 180000, // 3 minutes (increased for large video files)
    ANSWER_SUBMISSION: 300000, // 5 minutes
    GENERATE_QUESTION: 120000, // 2 minutes for question generation
    FILE_READER: 15000, // 15 seconds (increased for large audio files)
    HEARTBEAT: 30000, // 30 seconds
    AUDIO_PROCESSING: 120000, // 2 minutes for audio transcription
    TTS: 15000, // 15 seconds for TTS generation
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
