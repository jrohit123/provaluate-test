// Interview Constants
export const INTERVIEW_CONSTANTS = {
  // Time-related constants
  TIMEOUTS: {
    COMPLETION_NAVIGATION: 8000, // 8 seconds
    RECORDING_VERIFICATION: 100, // 100ms
    INITIALIZATION_DELAY: 200, // 200ms
    AUTO_FINISH_DELAY: 2000, // 2 seconds
    SPEECH_DELAY: 3000, // 3 seconds
    UI_UPDATE_DELAY: 1000, // 1 second
    CHUNK_INTERVAL: 15000, // 15 seconds
  },
  
  // UI-related constants
  UI: {
    WARNING_TIME: 120, // 2 minutes in seconds
    CRITICAL_TIME: 60, // 1 minute in seconds
    MIN_TRANSCRIPT_LENGTH: 20, // Minimum characters for transcript
    MIN_BLOB_SIZE: 500, // Minimum blob size in bytes
    MAX_FILE_SIZE: 3 * 1024 * 1024, // 3MB in bytes
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
  },
  
  // Question-related constants
  QUESTIONS: {
    MIN_QUESTIONS: 1,
    MAX_QUESTIONS: 50,
    DEFAULT_QUESTIONS: 5,
  },
  
  // Weight-related constants
  WEIGHTS: {
    MIN_WEIGHT: 0,
    MAX_WEIGHT: 100,
    BALANCED_WEIGHT: 100,
  },
  
  // Audio/Video constants
  MEDIA: {
    CHUNK_SIZE: 8192, // For base64 conversion
    AUDIO_QUALITY: 'very_low',
    VIDEO_QUALITY: 'very_low',
    MIN_AUDIO_DURATION: 1000, // 1 second
    MAX_AUDIO_DURATION: 300000, // 5 minutes
    AUDIO_BITRATE: 128000, // 128 kbps
    VIDEO_BITRATE: 300000, // 400 kbps – smaller files, faster uploads; good for talking-head interview (desktop + mobile)
    TIME_SLICE: 5000, // stream in 5s chunks — smaller blast radius per chunk failure, retries stay cheap
  },
  
  // Retry constants
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_BASE: 1000, // 1 second
  },
  
  // Status constants
  STATUS: {
    IDLE: 'idle',
    UPLOADING: 'uploading',
    PROCESSING: 'processing',
    SUBMITTED: 'submitted',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
  },
  
  // Error messages
  ERRORS: {
    NO_TRANSCRIPT: 'Please provide an answer before submitting',
    NO_AUDIO: 'No audio recording found. Please record your answer first.',
    EMPTY_AUDIO: 'Audio recording is empty. Please record again.',
    FILE_TOO_LARGE: 'File size must be less than 3MB',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT_ERROR: 'Request timed out. Please try again.',
  },
  
  // Success messages
  SUCCESS: {
    ANSWER_SUBMITTED: 'Answer submitted successfully!',
    QUESTION_GENERATED: 'Next question generated!',
    INTERVIEW_COMPLETED: 'Interview completed successfully!',
    COMPETENCIES_SAVED: 'Competencies saved successfully!',
  },
};
