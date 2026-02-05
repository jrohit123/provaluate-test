import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import RecordRTC from 'recordrtc';
import { useInterview, interviewActions } from '@/contexts/InterviewContext';

// Extend the global Window interface to include Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    isFinal: boolean;
    [key: number]: {
      transcript: string;
    };
  }[];
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: () => void;
  onaudiostart: () => void;
  onsoundstart: () => void;
  onspeechstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onspeechend: () => void;
  onsoundend: () => void;
  onaudioend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
import { useTimer } from '@/hooks/useTimer';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAdaptiveVideoConstraints } from '@/utils/mediaConstraints';
import { API_CONFIG, buildApiUrl, apiCall } from '@/constants/api';
import { INTERVIEW_CONSTANTS } from '@/constants/interview';
import { supabase } from '@/integrations/supabase/client';
import { Socket } from 'socket.io-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Send,
  Clock,
  User,
  Volume2,
  VolumeX,
  AlertTriangle,
  Camera,
  X,
  ChevronUp,
  ChevronDown,
  Expand,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Fetch conversational phrase from backend
const fetchInterviewPhrase = async (
  phraseType: 'welcome' | 'transition' | 'completion' | 'question_intro',
  candidateName: string,
  position: string,
  questionIndex?: number,
  totalQuestions?: number
): Promise<string> => {
  try {
    const response = await apiCall(API_CONFIG.ENDPOINTS.GENERATE_INTERVIEW_PHRASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phrase_type: phraseType,
        candidate_name: candidateName,
        position,
        ...(questionIndex != null && { question_index: questionIndex }),
        ...(totalQuestions != null && { total_questions: totalQuestions }),
      }),
    }, 10000);
    if (response.ok) {
      const data = await response.json();
      return data.phrase || '';
    }
  } catch (e) {
    console.warn('Phrase fetch failed, using fallback:', e);
  }
  return '';
};

// Fallback phrases when API fails
const FALLBACK_PHRASES = {
  welcome: (name: string, pos: string) =>
    `Hello ${name}! Welcome to your ${pos} interview. I'm excited to learn more about you. Let's begin with our first question.`,
  transition: () => "Let's move to the next question.",
  completion: (name: string, pos: string) =>
    `Thank you, ${name}! You've successfully completed your ${pos} interview. We appreciate your time. Our team will review and get back to you soon. Good luck!`,
};

// Add transcription validation function
const isCorruptedTranscription = (transcript) => {
  if (!transcript || transcript.trim().length === 0) {
    return false; // Empty transcript is handled separately
  }
  
  // Check for repeated patterns that indicate corruption
  const corruptionPatterns = [
    /tabletabletable+/, // Repeated "table" pattern
    /(\b\w+\b)(?:\s+\1){5,}/, // Any word repeated 6+ times with spaces
    /…etabletable+/, // Ellipsis followed by repeated "table"
    /(\b\w{1,4}\b)(?:\s+\1){8,}/, // Short words repeated 9+ times
  ];
  
  return corruptionPatterns.some(pattern => pattern.test(transcript));
};

// Add function to clean corrupted transcriptions
const cleanTranscription = (transcript) => {
  if (!transcript) return '';
  
  // Remove corrupted patterns
  let cleaned = transcript
    .replace(/tabletabletable+/g, '') // Remove repeated "table"
    .replace(/…etabletable+.*$/g, '') // Remove ellipsis + repeated "table" and everything after
    .replace(/(\b\w+\b)(?:\s+\1){5,}/g, '$1') // Replace 6+ repetitions with single occurrence
    .replace(/(\b\w{1,4}\b)(?:\s+\1){8,}/g, '$1'); // Replace 9+ repetitions of short words
  
  return cleaned.trim();
};

// Analyze text and create realistic speech patterns
const createSpeechPattern = (text: string) => {
  const words = text.toLowerCase().split(/\s+/);
  const pattern: number[] = [];
  
  words.forEach(word => {
    const wordLength = word.length;
    const hasPunctuation = /[.!?,;:]/.test(word);
    const isQuestion = word.includes('?');
    const isExclamation = word.includes('!');
    
    // Base height for normal speech
    let baseHeight = 42;
    
    // Adjust based on word characteristics
    if (wordLength <= 3) {
      // Short words (articles, prepositions) - lower
      baseHeight = 38;
    } else if (wordLength >= 7) {
      // Long words - higher
      baseHeight = 48;
    }
    
    // Punctuation effects
    if (isExclamation) {
      baseHeight += 8; // Emphasis
    } else if (isQuestion) {
      baseHeight += 6; // Slight emphasis
    } else if (hasPunctuation) {
      baseHeight += 2; // Minor emphasis
    }
    
    // Add some variation
    const variation = (Math.random() - 0.5) * 4;
    const finalHeight = Math.max(35, Math.min(55, baseHeight + variation));
    
    // Create multiple pattern points for each word (simulate syllables)
    const syllables = Math.max(1, Math.floor(wordLength / 3));
    for (let i = 0; i < syllables; i++) {
      pattern.push(finalHeight);
    }
    
    // Add pause after punctuation
    if (hasPunctuation) {
      pattern.push(35); // Pause
      pattern.push(35); // Longer pause
    }
  });
  
  return pattern;
};

const ConversationalInterview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const interviewData = useMemo(() => location.state || {}, [location.state]);
  
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true); // Camera must stay on
  const [transcript, setTranscript] = useState('');
  const [interviewTimerSeconds, setInterviewTimerSeconds] = useState(() => {
    const duration = Number(interviewData.duration) || 0;
    return Math.max(duration * 60, 0);
  });
  const [isInterviewTimerActive, setIsInterviewTimerActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [currentQuestion, setCurrentQuestion] = useState(interviewData.currentQuestion);
  
  // Use centralized interview state
  const { state: interviewState, dispatch } = useInterview();
  const { isSubmitting, currentQuestionIndex } = interviewState;
  const [submissionStatus, setSubmissionStatus] = useState('idle'); // 'idle', 'uploading', 'processing', 'submitted'
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [videoRecorder, setVideoRecorder] = useState(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [questionVideoBlob, setQuestionVideoBlob] = useState(null);
  const [questionVideoDuration, setQuestionVideoDuration] = useState(0);
  const audioStreamRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const completionTimerRef = useRef(null);
  const [isCreatingInterview] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  
  // AI Assistant states
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiTTSLoading, setAiTTSLoading] = useState(false);
  const [aiAudioEnabled, setAiAudioEnabled] = useState(true);
  const [isInterviewInitialized, setIsInterviewInitialized] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiPlaceholder, setAiPlaceholder] = useState<'welcome' | 'generating_first' | 'generating_next' | ''>('');
  const [loadingDots, setLoadingDots] = useState(0); // 0→1 dot, 1→2 dots, 2→3 dots (cycles)
  const [isWelcomeMessage, setIsWelcomeMessage] = useState(false);
  const [spokenQuestions, setSpokenQuestions] = useState(new Set());
  const [spokenFeedback, setSpokenFeedback] = useState(new Set());
  const [questionFinishedSpeaking, setQuestionFinishedSpeaking] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [answerTimer, setAnswerTimer] = useState(0);
  const [isAnswerTimerActive, setIsAnswerTimerActive] = useState(false);
  const [hasRequestedCameraPermissions, setHasRequestedCameraPermissions] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>([]);
  const [speechPattern, setSpeechPattern] = useState<number[]>([]);
  const [patternIndex, setPatternIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenAttempts, setFullscreenAttempts] = useState(0);
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState(''); // For questions that require SQL/code/calculation in a separate box
  const transcriptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Per-question timer states
  const [questionTimerSeconds, setQuestionTimerSeconds] = useState(0);
  const [currentQuestionMaxTime, setCurrentQuestionMaxTime] = useState(0);
  const [isQuestionTimerActive, setIsQuestionTimerActive] = useState(false);
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioWorkletStreamRef = useRef<MediaStream | null>(null);
  const speakQueueRef = useRef<{ text: string; onEnd?: () => void; onAudioStart?: () => void }[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isTerminatedRef = useRef(false);
  const handleSubmitAnswerRef = useRef<(() => Promise<void>) | null>(null);
  const stopQuestionRecordingRef = useRef<(() => void) | null>(null);
  /** When true, submit runs from timer expiry; submit whatever transcript + written answer we have (don't block on empty written box) */
  const forceSubmitOnTimerExpiryRef = useRef(false);
  /** When true, do not reset question timer (user stopped recording on written question; timer must keep counting down) */
  const writtenQuestionTimerLockedRef = useRef(false);
  const lastInterviewWarningRef = useRef<number | null>(null);
  const lastQuestionWarningRef = useRef<number | null>(null);
  const cameraWarningShownRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasSpokenWelcomeRef = useRef(false);
  const hasSpokenFirstQuestionRef = useRef(false);
  const firstQuestionRef = useRef<{ question?: string; question_text?: string } | null>(null);
  const hasSpokenCompletionRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const finishInterviewRef = useRef<(() => Promise<void>) | null>(null);
  const speakWithAIRef = useRef<((text: string) => void) | null>(null);
  const ttsFallbackToastShownRef = useRef(false);

  const terminateInterview = useCallback(async (reason) => {
    // Use consistent toast ID to prevent duplicate messages
    const terminationToastId = 'interview-terminated';

    // Stop all TTS/speech immediately so voice does not keep speaking after termination
    isTerminatedRef.current = true;
    speakQueueRef.current.length = 0;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setAiTTSLoading(false);
    setAiSpeaking(false);

    try {
      console.log('🚫 Terminating interview due to:', reason);
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.TERMINATE_INTERVIEW}/${interviewData.interviewId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('✅ Interview status updated to terminated');
        toast.error(`Interview terminated: ${reason}`, { id: terminationToastId });
      } else {
        console.error('❌ Failed to update interview status');
        toast.error(`Interview terminated: ${reason}`, { id: terminationToastId });
      }
    } catch (error) {
      console.error('❌ Error terminating interview:', error);
      toast.error(`Interview terminated: ${reason}`, { id: terminationToastId });
    }

    // Navigate to candidate completion page (which handles terminated interviews)
    navigate(`/candidate-completion/${interviewData.interviewId}`, {
      state: {
        interviewId: interviewData.interviewId,
        candidateName: interviewData.candidateName,
        position: interviewData.position
      }
    });
  }, [navigate, interviewData?.interviewId, interviewData?.candidateName, interviewData?.position]);

  const tabChangeCountRef = useRef(0);
  const tabWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const escTerminateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTabViolationRef = useRef(0);
  const isFullscreenRef = useRef(false);
  const MAX_TAB_CHANGES = 2;

  const handleTabViolation = useCallback((reason: string) => {
    const now = Date.now();
    // Debounce: Only show one toast per 2 seconds to prevent spam
    if (now - lastTabViolationRef.current < 2000) {
      return;
    }
    lastTabViolationRef.current = now;
    tabChangeCountRef.current += 1;
    const currentCount = tabChangeCountRef.current;
    console.log(`⚠️ Tab change detected via ${reason} (${currentCount}/${MAX_TAB_CHANGES})`);

    // Show only one warning message per tab switch
    if (currentCount <= MAX_TAB_CHANGES) {
      toast('Warning: Stay on this tab during the interview!', {
        id: 'tab-switch-warning',
        duration: 3000,
      });
    } else if (currentCount > MAX_TAB_CHANGES) {
      console.log('🚫 Too many tab changes, terminating interview');
      toast.error('Interview terminated due to tab switching', { id: 'tab-switch-terminated' });
      terminateInterview('Candidate switched tabs multiple times during interview');
    }

    if (tabWarningTimeoutRef.current) {
      clearTimeout(tabWarningTimeoutRef.current);
      tabWarningTimeoutRef.current = null;
    }
  }, [terminateInterview]);
  
  // Browser detection utility - properly distinguishes Chrome and Edge
  const detectBrowser = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    // Edge detection must come first since Edge contains "chrome" in user agent
    const isEdge = /edg/.test(userAgent) || /edgios/.test(userAgent);
    // Chrome: contains "chrome" but NOT "edg" (Edge is Chromium-based)
    const isChrome = /chrome/.test(userAgent) && !isEdge && !/opr/.test(userAgent) && !/brave/.test(userAgent);
    
    console.log('🔍 [BROWSER DETECTION]', {
      userAgent: userAgent.substring(0, 100),
      isChrome,
      isEdge,
      detected: isChrome ? 'Chrome (OpenAI)' : isEdge ? 'Edge (Web Speech)' : 'Other'
    });
    
    return { isChrome, isEdge, userAgent };
  }, []);

  // Web Speech Refs - Single source of truth
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const webSpeechActiveRef = useRef(false);
  const accumulatedTranscriptRef = useRef(''); // Permanent storage for the current question
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // OpenAI Whisper API refs (for Chrome)
  const openAIAudioRecorderRef = useRef<any>(null);
  const openAIAudioStreamRef = useRef<MediaStream | null>(null);
  const openAITranscriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const openAIAudioChunksRef = useRef<Blob[]>([]);
  const transcriptionModeRef = useRef<'web-speech' | 'openai' | null>(null);
  const lastTranscriptionTimeRef = useRef<number>(0);

  // Deduplication function to remove overlapping text
  const cleanTranscript = useCallback((newText: string, existingText: string): string => {
    if (!newText) return existingText;
    
    // Remove common duplicates at word boundaries
    const words = newText.trim().split(/\s+/);
    const existingWords = existingText.trim().split(/\s+/);
    
    // Find overlap - check if start of new text matches end of existing
    let overlapIndex = 0;
    for (let i = 1; i <= Math.min(words.length, existingWords.length); i++) {
      const newStart = words.slice(0, i).join(' ');
      const existingEnd = existingWords.slice(-i).join(' ');
      if (newStart.toLowerCase() === existingEnd.toLowerCase()) {
        overlapIndex = i;
      }
    }
    
    // Remove overlapping portion from new text
    const uniqueWords = words.slice(overlapIndex);
    return existingText + (existingText ? ' ' : '') + uniqueWords.join(' ');
  }, []);

  // Check if audio chunk has sufficient volume (silence detection)
  const checkAudioVolume = async (blob: Blob): Promise<boolean> => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Calculate RMS (volume)
      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);

      await audioContext.close();
      return rms >= 0.01; // Threshold for non-silent audio
    } catch (error) {
      console.warn('⚠️ [OPENAI] Could not check audio volume, proceeding anyway:', error);
      return true; // If we can't check, assume it's valid
    }
  };

  // OpenAI Whisper API Implementation (for Chrome) - Optimized
  const initOpenAISpeech = useCallback(async () => {
    // ✅ Safety check: Only initialize if mode is set to OpenAI
    if (transcriptionModeRef.current !== 'openai') {
      console.warn('⚠️ [OPENAI] Transcription mode is not "openai", skipping initialization');
      return;
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file.');
      toast.error('OpenAI API key not configured.');
      return;
    }

    console.log('🎯 [OPENAI] Initializing OpenAI Whisper API for Chrome...');

    try {
      // Get microphone stream with optimized settings for Whisper
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // ✅ Whisper's native sample rate
          channelCount: 1
        }
      });

      openAIAudioStreamRef.current = stream;

      // Create RecordRTC recorder for audio chunks with optimized settings
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm', // ✅ Better compression than WAV
        numberOfAudioChannels: 1,
        desiredSampRate: 16000, // ✅ Match Whisper's native rate
        recorderType: RecordRTC.StereoAudioRecorder,
        timeSlice: 3000, // ✅ 3-second chunks: balance between responsiveness and phonetic context
        ondataavailable: async (blob: Blob) => {
          // ✅ Safety check: Only process if still in OpenAI mode
          if (transcriptionModeRef.current !== 'openai') {
            console.log('⏭️ [OPENAI] Mode changed, stopping processing');
            return;
          }

          if (!webSpeechActiveRef.current || blob.size < 1000) {
            console.log('⏭️ [OPENAI] Skipping tiny/inactive chunk');
            return;
          }

          // Rate limiting protection - prevent API spam
          // Adjusted to match 3-second chunks (allow processing every 2.5s minimum)
          const now = Date.now();
          if (now - lastTranscriptionTimeRef.current < 2500) {
            console.log('⏭️ [OPENAI] Rate limit protection - skipping');
            return;
          }

          console.log('🎤 [OPENAI] Processing audio chunk:', blob.size, 'bytes');

          // Optional: Silence detection (skip silent chunks)
          const hasVolume = await checkAudioVolume(blob);
          if (!hasVolume) {
            console.log('⏭️ [OPENAI] Skipping silent chunk');
            return;
          }

          lastTranscriptionTimeRef.current = now;

          // Send to OpenAI Whisper API
          try {
            // ✅ Get context from previous transcriptions for better accuracy
            // Use last 150-200 characters to provide context without overwhelming the prompt
            const previousContext = accumulatedTranscriptRef.current.trim();
            const contextPrompt = previousContext.length > 0
              ? previousContext.slice(-200).trim() // Last ~200 characters for context
              : '';

            const formData = new FormData();
            formData.append('file', blob, 'audio.webm');
            formData.append('model', 'whisper-1');
            formData.append('language', 'en');
            formData.append('response_format', 'text'); // ✅ Plain text, no JSON overhead
            formData.append('temperature', '0'); // ✅ More deterministic for accurate transcription
            
            // ✅ CRITICAL: Add prompt with previous context for continuity
            // This helps Whisper understand context and correctly transcribe words
            // that might be cut off at the beginning of a new chunk
            if (contextPrompt) {
              formData.append('prompt', contextPrompt);
              console.log('📝 [OPENAI] Using context prompt:', contextPrompt.slice(-50) + '...');
            }

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              body: formData,
            });

            if (!response.ok) {
              console.error('❌ [OPENAI] API error:', response.status);
              return;
            }

            // ✅ Direct text response (no JSON parsing needed)
            const transcribedText = (await response.text()).trim();

            if (transcribedText && transcribedText.length > 0) {
              // ✅ Deduplicate before appending (less aggressive since prompt helps with context)
              // The prompt parameter reduces the need for aggressive deduplication
              accumulatedTranscriptRef.current = cleanTranscript(
                transcribedText,
                accumulatedTranscriptRef.current
              );
              
              setTranscript(accumulatedTranscriptRef.current.trim());
              console.log('✅ [OPENAI] Transcribed:', transcribedText);
              console.log('📊 [OPENAI] Total transcript length:', accumulatedTranscriptRef.current.length);
            }
          } catch (error: any) {
            console.error('❌ [OPENAI] Transcription error:', error.message);
            // Don't stop on error, continue recording
          }
        }
      });

      openAIAudioRecorderRef.current = recorder;
      recorder.startRecording();
      console.log('🎯 [OPENAI] Audio recording started for transcription');
    } catch (error: any) {
      console.error('❌ [OPENAI] Failed to initialize:', error);
      toast.error('Failed to start OpenAI transcription. Please check microphone permissions.');
      webSpeechActiveRef.current = false;
    }
  }, [cleanTranscript]);

  // Web Speech Implementation - Edge Browser (Fixed for continuous speech)
  const initWebSpeech = useCallback(() => {
    // ✅ Safety check: Only initialize if mode is set to web-speech
    if (transcriptionModeRef.current !== 'web-speech') {
      console.warn('⚠️ [WEB SPEECH] Transcription mode is not "web-speech", skipping initialization');
      return;
    }

    if (recognitionRef.current) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser.');
      toast.error('Live transcription not supported in this browser.');
      return;
    }
    
    console.log('🎯 [WEB SPEECH] Initializing Web Speech API for Edge...');
    
    const recognition = new SpeechRecognition();
    
    // CRITICAL: Match Chrome demo settings exactly
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    // Track state - session-specific variables
    let startTimestamp = 0;
    let restartCount = 0;

    // Silence watchdog: Forces restart if no audio for 10 seconds
    const resetWatchdog = () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }
      watchdogTimerRef.current = setTimeout(() => {
        if (webSpeechActiveRef.current && recognitionRef.current) {
          console.log('🐕 [WATCHDOG] Silence detected, refreshing session...');
          try {
            recognitionRef.current.stop(); // Forces onend -> restart cycle
          } catch (e) {
            console.warn('⚠️ [WATCHDOG] Error stopping recognition:', e);
          }
        }
      }, 10000); // 10 second threshold
    };

    recognition.onstart = () => {
      startTimestamp = Date.now();
      restartCount++;
      console.log('🎤 [SPEECH START] Recognition started at', new Date().toISOString());
      console.log('📊 [SPEECH START] Restart count:', restartCount);
      console.log('📊 [SPEECH START] Current final transcript length:', accumulatedTranscriptRef.current.length);
      resetWatchdog(); // Reset watchdog on start
    };

    recognition.onaudiostart = () => {
      console.log('🔊 [AUDIO START] Microphone audio detected');
    };

    recognition.onsoundstart = () => {
      console.log('🔉 [SOUND START] Sound detected');
    };

    recognition.onspeechstart = () => {
      console.log('🗣️ [SPEECH DETECT] Speech detected');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // ✅ Safety check: Only process if still in web-speech mode
      if (transcriptionModeRef.current !== 'web-speech') {
        console.log('⏭️ [WEB SPEECH] Mode changed, stopping processing');
        return;
      }

      const now = Date.now();
      const elapsed = ((now - startTimestamp) / 1000).toFixed(1);
      
      let interimTranscript = '';
      
      // CHROME DEMO PATTERN: Process from resultIndex, but handle final results specially
      // Final results are permanent and should be accumulated in the ref
      // Interim results should replace each other
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          // Append new final text to the permanent ref
          accumulatedTranscriptRef.current += transcript + ' ';
          console.log('✅ [FINAL]', transcript, `(accumulated: ${accumulatedTranscriptRef.current.length} chars)`);
        } else {
          // Interim results just get appended to interim string
          interimTranscript += transcript;
        }
      }
      
      // UI updates with the cumulative text
      const fullText = (accumulatedTranscriptRef.current + interimTranscript).trim();
      setTranscript(fullText);
      
      console.log(`📊 [TRANSCRIPT] Final: ${accumulatedTranscriptRef.current.length}ch, Interim: ${interimTranscript.length}ch, Total: ${fullText.length}ch`);
      
      resetWatchdog(); // Reset watchdog on any result
    };

    recognition.onspeechend = () => {
      console.log('🔇 [SPEECH END] Speech ended (but recognition continues)');
    };

    recognition.onsoundend = () => {
      console.log('🔕 [SOUND END] Sound ended');
    };

    recognition.onaudioend = () => {
      console.log('🔇 [AUDIO END] Audio ended');
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      const errorType = e?.error || 'unknown';
      const now = Date.now();
      const elapsed = ((now - startTimestamp) / 1000).toFixed(1);
      
      console.error(`❌ [ERROR] Type: "${errorType}", after ${elapsed}s`);
      console.error(`❌ [ERROR] Message:`, e.message);
      
      // Handle fatal errors
      if (errorType === 'not-allowed') {
        console.error('🚫 [FATAL] Microphone permission denied');
        toast.error('Microphone permission denied.');
        webSpeechActiveRef.current = false;
        return;
      }
      
      if (errorType === 'audio-capture') {
        console.error('🚫 [FATAL] No microphone detected');
        toast.error('No microphone detected. Please check your settings.');
        webSpeechActiveRef.current = false;
        return;
      }
      
      // Log but continue for non-fatal errors
      if (errorType === 'no-speech') {
        console.warn('⏸️ [WARNING] No speech detected - will continue');
      }
      
      if (errorType === 'network') {
        console.warn('🌐 [WARNING] Network error - will restart');
      }
      
      if (errorType === 'aborted') {
        console.warn('⚠️ [WARNING] Recognition aborted');
      }
    };

    recognition.onend = () => {
      // Clear watchdog on end
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      
      const now = Date.now();
      const elapsed = ((now - startTimestamp) / 1000).toFixed(1);
      
      console.log('🛑 [RECOGNITION END]');
      console.log(`⏱️ [RECOGNITION END] Session lasted ${elapsed}s`);
      console.log(`🔄 [RECOGNITION END] Restart count: ${restartCount}`);
      console.log(`🎯 [RECOGNITION END] webSpeechActiveRef: ${webSpeechActiveRef.current}`);
      console.log(`📊 [RECOGNITION END] Final transcript preserved: ${accumulatedTranscriptRef.current.length} chars`);
      
      // Auto-restart if still supposed to be active
      if (webSpeechActiveRef.current) {
        console.log('🔄 [RESTART] Attempting immediate restart...');
        
        // CRITICAL: Use requestAnimationFrame for smoother restart
        requestAnimationFrame(() => {
          if (!webSpeechActiveRef.current) {
            console.log('⏹️ [RESTART] Cancelled - no longer active');
            return;
          }
          
          try {
            recognition.start();
            console.log(`✅ [RESTART] Successfully restarted (attempt #${restartCount})`);
          } catch (error: any) {
            console.error('❌ [RESTART ERROR]', error.message);
            
            if (error.message?.includes('already started')) {
              console.log('✅ [RESTART] Already running - good!');
            } else {
              // Retry with setTimeout as fallback - increased delay for stability
              console.log('🔄 [RESTART] Retrying with 300ms delay...');
              setTimeout(() => {
                if (webSpeechActiveRef.current) {
                  try {
                    recognition.start();
                    console.log('✅ [RESTART RETRY] Success');
                  } catch (retryError: any) {
                    console.error('❌ [RESTART RETRY] Failed:', retryError.message);
                  }
                }
              }, 300); // Increased from 100ms to 300ms for more reliable reconnection
            }
          }
        });
      } else {
        console.log('⏹️ [NO RESTART] webSpeechActiveRef is false');
        // IMPORTANT: Don't reset accumulatedTranscriptRef here - it should persist until manually cleared
      }
    };

    recognitionRef.current = recognition;
    console.log('🎯 [INIT] Speech recognition object created and configured');
  }, []);

  const startWebSpeech = useCallback(async () => {
    const browser = detectBrowser();
    webSpeechActiveRef.current = true;

    // ✅ CHROME: Use OpenAI Whisper API
    if (browser.isChrome) {
      console.log('🌐 [BROWSER] ✅ Detected Chrome - using OpenAI Whisper API');
      transcriptionModeRef.current = 'openai';
      
      // Ensure Web Speech is not running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {
          console.warn('⚠️ [CHROME] Cleaned up Web Speech instance');
        }
      }
      
      await initOpenAISpeech();
      return;
    }

    // ✅ EDGE: Use Web Speech API
    if (browser.isEdge) {
      console.log('🌐 [BROWSER] ✅ Detected Edge - using Web Speech API');
      transcriptionModeRef.current = 'web-speech';
      
      // Ensure OpenAI is not running
      if (openAIAudioRecorderRef.current) {
        try {
          openAIAudioRecorderRef.current.stopRecording();
          openAIAudioRecorderRef.current = null;
        } catch (e) {
          console.warn('⚠️ [EDGE] Cleaned up OpenAI instance');
        }
      }
      if (openAIAudioStreamRef.current) {
        openAIAudioStreamRef.current.getTracks().forEach(track => track.stop());
        openAIAudioStreamRef.current = null;
      }
      
      initWebSpeech();
      if (!recognitionRef.current) {
        console.error('❌ [EDGE] Web Speech recognition object not created');
        return;
      }
      
      try {
        recognitionRef.current.start();
        console.log('✅ [EDGE] Web Speech API started successfully');
      } catch (error: any) {
        if (!error.message?.includes('already started')) {
          console.error('❌ [EDGE] Failed to start Web Speech:', error);
          toast.error('Failed to start transcription in Edge browser.');
        }
      }
      return;
    }

    // ⚠️ FALLBACK: Unknown browser - try Web Speech first, then OpenAI
    console.log('🌐 [BROWSER] ⚠️ Unknown browser - trying Web Speech API first');
    transcriptionModeRef.current = 'web-speech';
    initWebSpeech();
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        console.log('✅ Web Speech started successfully (fallback)');
      } catch (error: any) {
        if (!error.message?.includes('already started')) {
          console.error('❌ Failed to start Web Speech, trying OpenAI...');
          transcriptionModeRef.current = 'openai';
          await initOpenAISpeech();
        }
      }
    } else {
      // No Web Speech API, try OpenAI
      console.log('⚠️ Web Speech API not available, trying OpenAI...');
      transcriptionModeRef.current = 'openai';
      await initOpenAISpeech();
    }
  }, [initWebSpeech, initOpenAISpeech, detectBrowser]);

  const stopWebSpeech = useCallback(() => {
    webSpeechActiveRef.current = false;
    
    // Stop based on current transcription mode
    if (transcriptionModeRef.current === 'openai') {
      // Stop OpenAI transcription
      if (openAIAudioRecorderRef.current) {
        try {
          openAIAudioRecorderRef.current.stopRecording(() => {
            console.log('✅ OpenAI audio recording stopped');
          });
        } catch (error) {
          console.warn('⚠️ Error stopping OpenAI recorder:', error);
        }
        openAIAudioRecorderRef.current = null;
      }

      // Stop audio stream
      if (openAIAudioStreamRef.current) {
        openAIAudioStreamRef.current.getTracks().forEach(track => track.stop());
        openAIAudioStreamRef.current = null;
      }

      // Clear transcription interval
      if (openAITranscriptionIntervalRef.current) {
        clearInterval(openAITranscriptionIntervalRef.current);
        openAITranscriptionIntervalRef.current = null;
      }

      // Clear audio chunks
      openAIAudioChunksRef.current = [];
      console.log('✅ OpenAI transcription stopped');
    } else {
      // Stop Web Speech API (Edge)
      // Clear watchdog timer
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      
      try {
        recognitionRef.current?.stop();
        console.log('✅ Web Speech stopped successfully');
      } catch (error) {
        console.warn('⚠️ Error stopping Web Speech:', error);
      }
    }

    transcriptionModeRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebSpeech();
    };
  }, [stopWebSpeech]);

  const handleInterviewTimerEnd = useCallback(() => {
    console.log('⏰ Interview duration completed, finishing interview immediately...');
    setIsInterviewTimerActive(false);

    // Stop any ongoing recording immediately
    if (isRecording || isVideoRecording) {
      console.log('⏰ Time expired, stopping recording immediately');
      if (stopQuestionRecordingRef.current) {
        stopQuestionRecordingRef.current();
      }
    }

    // Stop Web Speech immediately
    stopWebSpeech();

    // Stop all media streams immediately
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    // Camera stream cleanup is handled by videoStreamRef

    toast.success('Interview time completed! Finishing interview...', { id: 'interview-time-completed', duration: 1500 });

    // CRITICAL FIX: Immediate finalization with minimal delay
    setTimeout(() => {
      const finalizeInterview = async () => {
        try {
          if (finishInterviewRef.current) {
            await finishInterviewRef.current();
          }
        } catch (error) {
          console.error('❌ Error auto-finishing interview:', error);
          toast.error('Failed to finish interview', { id: 'auto-finish-error' });
          // Force navigation even on error
          navigate('/dashboard');
        }
      };

      finalizeInterview();
    }, 500);

  }, [isRecording, isVideoRecording, navigate, stopWebSpeech]);

  const handleQuestionTimerEnd = useCallback(() => {
    console.log('⏰ Question timer expired, auto-advancing...');
    setIsQuestionTimerActive(false);
    setQuestionTimerSeconds(0);

    if (isSubmitting || answerSubmitted) return;

    // Stop recording first if still recording, then auto-submit (transcript + any written answer)
    if (isRecording) {
      console.log('🔄 Question time expired - stopping recording and auto-submitting');
      forceSubmitOnTimerExpiryRef.current = true;
      if (stopQuestionRecordingRef.current) stopQuestionRecordingRef.current();
      setTimeout(() => {
        if (handleSubmitAnswerRef.current) handleSubmitAnswerRef.current();
      }, 1500);
      return;
    }

    // Recording already stopped: submit whatever we have (transcript + written answer in box)
    // For written questions this runs when timer expires while user is typing in the box
    if (!isRecording && (audioBlob || currentQuestion?.requires_written_answer)) {
      console.log('🔄 Timer expired while writing or after recording - submitting transcript + written answer');
      forceSubmitOnTimerExpiryRef.current = true;
      if (handleSubmitAnswerRef.current) handleSubmitAnswerRef.current();
      return;
    }

    console.log('⏰ Timer expired but no valid state to submit');
  }, [isSubmitting, answerSubmitted, isRecording, audioBlob, currentQuestion?.requires_written_answer]);

  const interviewTimeRemaining = useCountdownTimer(
    interviewTimerSeconds,
    isInterviewTimerActive,
    { onEnd: handleInterviewTimerEnd }
  );

  const questionTimeRemaining = useTimer(
    questionTimerSeconds,
    isQuestionTimerActive,
    { onEnd: handleQuestionTimerEnd }
  );

  const timeRemaining = interviewTimeRemaining;
  
  // Debug function to log current state
  const logSpokenState = useCallback(() => {
    console.log('🔍 Current spoken state:');
    console.log('  - Welcome spoken:', hasSpokenWelcomeRef.current);
    console.log('  - First question spoken:', hasSpokenFirstQuestionRef.current);
    console.log('  - Completion spoken:', hasSpokenCompletionRef.current);
    console.log('  - Spoken questions:', Array.from(spokenQuestions));
    console.log('  - Spoken feedback:', Array.from(spokenFeedback));
  }, [spokenQuestions, spokenFeedback]);

  // Initialize interview - SINGLE TIME ONLY
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!interviewData.interviewId) {
      console.log('❌ No interview ID found, redirecting to setup');
      navigate('/setup');
      return;
    }
    
    // STRONG prevention of multiple initializations
    if (hasInitializedRef.current || isInterviewInitialized) {
      console.log('🚀 Already initialized, skipping...');
      return;
    }
    
    console.log('🚀 Initializing conversational interview with data:', interviewData);
    hasInitializedRef.current = true;
    setIsInterviewInitialized(true);
    
    // Reset question finished speaking state on initialization
    setQuestionFinishedSpeaking(false);
    setRecordingCountdown(0);
    setAnswerTimer(0);
    setIsAnswerTimerActive(false);
    writtenQuestionTimerLockedRef.current = false;
    // Reset answer submitted state for new interview
    setAnswerSubmitted(false);
    setSubmissionStatus('idle');
    // Reset camera permissions flag for new interview
    setHasRequestedCameraPermissions(false);
    
         // Use a more robust initialization approach
     const initializeInterview = async () => {
       try {
         // Load interview data first
         await loadInterviewData();
         // Initialize camera (this will request camera permissions)
         console.log('🎥 Initializing camera before interview starts...');
         await initializeCamera();
         setCameraPermissionGranted(true);
         setHasRequestedCameraPermissions(true);
        // Initialize audio worklet
        await initializeAudio();
         // Start welcome message after camera is ready (minimal delay for stability)
         setTimeout(() => {
           if (!hasSpokenWelcomeRef.current) {
             console.log('🎤 Starting welcome message and requesting fullscreen...');
             requestFullscreen();
             setAiPlaceholder('welcome');
             const welcomeMessage = FALLBACK_PHRASES.welcome(
               interviewData.candidateName || 'there',
               interviewData.position || 'this role'
             );
             if (aiAudioEnabled && 'speechSynthesis' in window) {
               console.log('🎤 Starting welcome message (question text only in display)');
               const pattern = createSpeechPattern(welcomeMessage);
               setSpeechPattern(pattern);
               setPatternIndex(0);
               speakWithAI(welcomeMessage, {
                 onAudioStart: () => setAiPlaceholder(''),
                 onEnd: () => {
                   console.log('🎤 Welcome message finished, starting first question...');
                   hasSpokenWelcomeRef.current = true;
                   setIsInterviewTimerActive(true);
                   const firstQ = firstQuestionRef.current;
                   if (firstQ && (firstQ.question || firstQ.question_text)) {
                     const questionText = firstQ.question || firstQ.question_text;
                     const questionMessage = `Question 1: ${questionText}`;
                     console.log('📝 FIRST: Speaking question, will show text when audio starts');
                     setAiPlaceholder('generating_first');
                     setIsWelcomeMessage(false);
                     hasSpokenFirstQuestionRef.current = true;
                     speakWithAI(questionMessage, {
                       onAudioStart: () => {
                         setAiMessage(questionText);
                         setAiPlaceholder('');
                       }
                     });
                   } else {
                     apiCall(API_CONFIG.ENDPOINTS.GENERATE_QUESTION, {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({
                         interview_id: interviewData.interviewId,
                         current_question_index: 0
                       })
                     }, API_CONFIG.TIMEOUTS.GENERATE_QUESTION)
                       .then(async (r) => {
                         if (!r.ok || !r) return;
                         const data = await r.json();
                         if (data.completed) {
                           if (finishInterviewRef.current) finishInterviewRef.current();
                           return;
                         }
                         const q = data.question;
                         const questionText = (typeof q === 'string' ? q : q?.question_text || q?.question) || '';
                         if (!questionText) return;
                         setCurrentQuestion(typeof q === 'object' ? q : { question_text: questionText });
                         setCurrentQuestionMaxTime(((data.max_time || 3) * 60));
                         setQuestionTimerSeconds((data.max_time || 3) * 60);
                         setIsWelcomeMessage(false);
                         hasSpokenFirstQuestionRef.current = true;
                         setAiPlaceholder('generating_first');
                         speakWithAI(`Question 1: ${questionText}`, {
                           onAudioStart: () => {
                             setAiMessage(questionText);
                             setAiPlaceholder('');
                           }
                         });
                       })
                       .catch((e) => {
                         console.warn('Failed to fetch first question:', e);
                         toast.error('Could not load first question. Please refresh and try again.');
                       });
                   }
                 },
               });
             } else {
               console.log('🎤 Speech synthesis unavailable or disabled, skipping audio welcome');
               setAiSpeaking(false);
               setAiMessage('');
               setAiPlaceholder('');
               hasSpokenWelcomeRef.current = true;
               setIsInterviewTimerActive(true);
             }
           }
         }, 100);
         // Log state for debugging
         logSpokenState();
       } catch (error) {
         console.error('❌ Error during interview initialization:', error);
       }
     };
    
    // Use a longer delay to ensure all functions are properly defined
    const initTimer = setTimeout(initializeInterview, INTERVIEW_CONSTANTS.TIMEOUTS.INITIALIZATION_DELAY);
    
    // Cleanup function to reset flags when component unmounts
    return () => {
      clearTimeout(initTimer);
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
      hasInitializedRef.current = false;
      hasSpokenWelcomeRef.current = false;
      hasSpokenFirstQuestionRef.current = false;
      hasSpokenCompletionRef.current = false;
      firstQuestionRef.current = null;
      ttsFallbackToastShownRef.current = false;
      setAiPlaceholder('');
      setSpokenQuestions(new Set());
      setSpokenFeedback(new Set());
    };
  }, [interviewData.interviewId]); // Simplified - functions defined below

  // AI Text-to-Speech: OpenAI TTS with Web Speech API fallback
  const speakWithAI = useCallback(
    (text: string, options?: { onEnd?: () => void; onAudioStart?: () => void }) => {
      if (!text) return;

      if (!aiAudioEnabled) {
        console.log('❌ AI audio is disabled, not speaking');
        return;
      }

      const hasSpeechSynthesis = 'speechSynthesis' in window;
      if (!hasSpeechSynthesis) {
        console.log('❌ Speech synthesis not available');
        setAiSpeaking(false);
        setQuestionFinishedSpeaking(false);
        return;
      }

      const queue = speakQueueRef.current;
      queue.push({ text, onEnd: options?.onEnd, onAudioStart: options?.onAudioStart });

      const processNext = () => {
        const item = queue[0];
        if (!item) return;

        const isQuestion = /question/i.test(item.text);
        const isWelcome = /(welcome|hello)/i.test(item.text);
        const isCompletion = /(thank you|completed|appreciate)/i.test(item.text);

        const handlePlaybackEnd = () => {
          item.onEnd?.();
          queue.shift();
          setAiSpeaking(false);
          setAiTTSLoading(false);
          // Only set questionFinishedSpeaking when the *actual question* (e.g. "Question 2: ...") finished, not the transition phrase (e.g. "Let's move to the next question")
          const isActualQuestionMessage = /^Question\s+\d+:/i.test((item.text || '').trim());
          if (isActualQuestionMessage && !isWelcome && !isCompletion) {
            setQuestionFinishedSpeaking(true);
          } else {
            setQuestionFinishedSpeaking(false);
          }
          if (socketRef.current?.connected) {
            socketRef.current.emit('ai_stopped_speaking', { interview_id: interviewData.interviewId });
          }
          if (queue.length > 0) processNext();
        };

        setAiTTSLoading(true);
        if (isQuestion) setQuestionFinishedSpeaking(false);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUTS.TTS || 15000);

        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TTS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.text }),
          signal: controller.signal,
        })
          .then((r) => {
            clearTimeout(timeoutId);
            if (!r.ok) throw new Error('TTS failed');
            return r.blob();
          })
          .then((blob) => {
            if (isTerminatedRef.current) {
              return;
            }
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            currentAudioRef.current = audio;
            audio.onended = () => {
              currentAudioRef.current = null;
              URL.revokeObjectURL(url);
              handlePlaybackEnd();
            };
            audio.onerror = () => {
              currentAudioRef.current = null;
              URL.revokeObjectURL(url);
              handlePlaybackEnd();
            };
            audio.onplaying = () => {
              setAiTTSLoading(false);
              setAiSpeaking(true);
              item.onAudioStart?.();
            };
            if (isTerminatedRef.current) {
              currentAudioRef.current = null;
              URL.revokeObjectURL(url);
              handlePlaybackEnd();
              return;
            }
            return audio.play();
          })
          .catch(() => {
            clearTimeout(timeoutId);
            if (!hasSpeechSynthesis) {
              if (!ttsFallbackToastShownRef.current) {
                ttsFallbackToastShownRef.current = true;
                toast.error('Audio playback unavailable', { id: 'tts-error', duration: 3000 });
              }
              setAiPlaceholder('');
              handlePlaybackEnd();
              return;
            }
            if (!ttsFallbackToastShownRef.current) {
              ttsFallbackToastShownRef.current = true;
              toast('Using fallback voice', { id: 'tts-fallback', duration: 2000 });
            }
            const utterance = new SpeechSynthesisUtterance(item.text);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            utterance.onstart = () => {
              setAiTTSLoading(false);
              setAiSpeaking(true);
              item.onAudioStart?.();
            };
            utterance.onend = handlePlaybackEnd;
            utterance.onerror = handlePlaybackEnd;
            window.speechSynthesis.speak(utterance);
          });
      };

      if (queue.length === 1) processNext();
    },
    [aiAudioEnabled, interviewData.interviewId]
  );

  // Web Speech API implementation is located at the top of the component


  const finishInterview = useCallback(async () => {
    try {
      // Stop any ongoing question recording
      if (isRecording) {
        console.log('🎥 Stopping ongoing question recording for interview completion...');
        stopQuestionRecording();
      }
      
      // Stop video stream
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
        setIsVideoRecording(false);
        console.log('🎥 Video stream stopped for interview completion');
      }
      
      // Reset question finished speaking state
      setQuestionFinishedSpeaking(false);
      setRecordingCountdown(0);
      setAnswerTimer(0);
      setIsAnswerTimerActive(false);
      // Reset camera permissions flag
      setHasRequestedCameraPermissions(false);
      
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.FINISH_INTERVIEW}/${interviewData.interviewId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const totalQuestions = result.total_questions ?? currentQuestionIndex + 1;
        const completionPhrase = await fetchInterviewPhrase(
          'completion',
          interviewData.candidateName || 'there',
          interviewData.position || 'this interview',
          currentQuestionIndex + 1,
          totalQuestions
        );
        const completionMessage = completionPhrase || FALLBACK_PHRASES.completion(
          interviewData.candidateName || 'there',
          interviewData.position || 'this interview'
        );
        
        let hasNavigated = false;
        const navigateToCompletion = () => {
          if (hasNavigated) return;
          hasNavigated = true;
          if (completionTimerRef.current) {
            clearTimeout(completionTimerRef.current);
            completionTimerRef.current = null;
          }
          toast.success(INTERVIEW_CONSTANTS.SUCCESS.INTERVIEW_COMPLETED, { id: 'interview-completed' });
          hasInitializedRef.current = false;
          navigate('/candidate-completion', {
            state: {
              interviewId: interviewData.interviewId,
              candidateName: interviewData.candidateName,
              position: interviewData.position
            }
          });
        };
        
        if (!hasSpokenCompletionRef.current) {
          console.log('🎤 Speaking completion message:', completionMessage);
          hasSpokenCompletionRef.current = true;
          const safetyTimer = setTimeout(() => {
            console.log('🏁 Completion safety timeout, navigating...');
            navigateToCompletion();
          }, 15000);
          completionTimerRef.current = safetyTimer as unknown as NodeJS.Timeout;
          try {
            const speak = speakWithAIRef.current || speakWithAI;
            speak(completionMessage, {
              onEnd: () => {
                clearTimeout(completionTimerRef.current as NodeJS.Timeout);
                completionTimerRef.current = null;
                console.log('🏁 Completion message finished, navigating...');
                navigateToCompletion();
              }
            });
          } catch (speechError) {
            console.error('❌ Error speaking completion message:', speechError);
            clearTimeout(completionTimerRef.current as NodeJS.Timeout);
            completionTimerRef.current = null;
            navigateToCompletion();
          }
        } else {
          navigateToCompletion();
        }
      }
    } catch (error) {
      console.error('Error finishing interview:', error);
      toast.error('Failed to finish interview', { id: 'finish-interview-error' });
    }
     }, [interviewData.interviewId, navigate, interviewData.candidateName, interviewData.position, speakWithAI, isRecording, currentQuestionIndex]);

  const generateNextQuestion = useCallback(async (simplifyQuestion = false) => {
    if (isGeneratingQuestion) {
      console.log('⚠️ Already generating question, skipping');
      return;
    }
    
    setIsGeneratingQuestion(true);
    
    try {
      console.log('🔄 Generating next question for index:', currentQuestionIndex + 1, simplifyQuestion ? '(simpler question)' : '');
      console.log('🔍 Interview ID:', interviewData.interviewId);
      console.log('🔍 Current question index:', currentQuestionIndex);
      
      const response = await apiCall(API_CONFIG.ENDPOINTS.GENERATE_QUESTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_id: interviewData.interviewId,
          current_question_index: currentQuestionIndex + 1,
          ...(simplifyQuestion && { simplify_question: true })
        })
      }, API_CONFIG.TIMEOUTS.GENERATE_QUESTION);

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Full response data:', data);
        console.log('🔍 Max time from response:', data.max_time);
        console.log('🔍 Question from response:', data.question);
        
        // Check if interview is completed
        if (data.completed) {
          console.log('🏁 Interview completed, finishing...');
          // No longer extending the interview time - let it end naturally
          if (finishInterviewRef.current) {
            await finishInterviewRef.current();
          } else {
            console.log('⚠️ finishInterviewRef not ready, using direct call');
            await finishInterview();
          }
          return;
        }
        
        console.log('📊 Question object:', data.question);
        console.log('📊 Question text:', data.question?.question_text);
        
        const newQuestionIndex = currentQuestionIndex + 1;
        dispatch(interviewActions.setQuestionIndex(newQuestionIndex));
        setCurrentQuestion(data.question);
        // Show "Loading next question..." until new question text is spoken; hide old question and input boxes
        setAiPlaceholder('generating_next');
        setAiMessage('');

        // CRITICAL FIX: Reset transcript and transcription accumulator before next question starts
        setTranscript('');
        setWrittenAnswer(''); // Reset written-answer box for new question
        accumulatedTranscriptRef.current = ''; // CRITICAL: Wipe the "memory" for the new question
        stopWebSpeech();
        
        // Clear Web Speech API refs (Edge)
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {
            console.log('⚠️ Error aborting recognition:', e);
          }
          recognitionRef.current = null;
        }
        
        // Clear OpenAI refs (Chrome)
        if (openAIAudioRecorderRef.current) {
          try {
            openAIAudioRecorderRef.current.stopRecording();
          } catch (e) {
            console.log('⚠️ Error stopping OpenAI recorder:', e);
          }
          openAIAudioRecorderRef.current = null;
        }
        if (openAIAudioStreamRef.current) {
          openAIAudioStreamRef.current.getTracks().forEach(track => track.stop());
          openAIAudioStreamRef.current = null;
        }
        if (openAITranscriptionIntervalRef.current) {
          clearInterval(openAITranscriptionIntervalRef.current);
          openAITranscriptionIntervalRef.current = null;
        }
        openAIAudioChunksRef.current = [];
        
        webSpeechActiveRef.current = false;
        transcriptionModeRef.current = null;
        
        // Clear watchdog timer
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }

        console.log('🔄 Transcript and Web Speech fully reset for new question');

        // Reset all question-related states for new question
        setQuestionFinishedSpeaking(false);
        setRecordingCountdown(0);
        setAnswerTimer(0);
        setIsAnswerTimerActive(false);
        setAnswerSubmitted(false);
        setSubmissionStatus('idle');
        
        // Clear previous audio/video blobs
        setAudioBlob(null);
        setQuestionVideoBlob(null);
        setQuestionVideoDuration(0);
        
        console.log('🔄 Reset all states for new question');
        writtenQuestionTimerLockedRef.current = false; // Allow timer to be set for the new question

        // Store timer values but don't start timer yet - wait for recording to start
        console.log('🔍 API response data:', data);
        if (data.max_time) {
          const questionTimeInSeconds = data.max_time * 60;
          setCurrentQuestionMaxTime(questionTimeInSeconds);
          setQuestionTimerSeconds(questionTimeInSeconds);
          setIsQuestionTimerActive(false); // Don't start timer yet!
          
          console.log('⏰ Timer values set for new question:', questionTimeInSeconds, 'seconds for', data.max_time, 'min answer time');
          console.log('🔍 Using API response - max_time:', data.max_time, 'level:', data.level);
          console.log('⏰ Timer will start when recording begins');
        } else {
          console.log('⏰ No max_time in API response, timer will be initialized when question is spoken');
          console.log('🔍 Available data keys:', Object.keys(data));
        }
        
        // Keep camera permissions state - don't reset this
        
        // Clean up question text and speak the question (only if not already spoken)
        let cleanQuestionText = '';
        let questionMessage = '';
        let questionId = `q${newQuestionIndex}`;
        
        // Safely extract question text with proper error checking
        if (data.question && data.question.question_text) {
          cleanQuestionText = data.question.question_text.replace(/^Question:\s*/i, '').trim();
          questionMessage = `Question ${newQuestionIndex + 1}: ${cleanQuestionText}`;
          questionId = data.question.id || `q${newQuestionIndex}`;
        } else if (data.question && typeof data.question === 'string') {
          // Handle case where question is just a string
          cleanQuestionText = data.question.replace(/^Question:\s*/i, '').trim();
          questionMessage = `Question ${newQuestionIndex + 1}: ${cleanQuestionText}`;
        } else {
          // Fallback for missing question data
          console.error('❌ Question data is missing or malformed:', data.question);
          questionMessage = `Question ${newQuestionIndex + 1}: Question data unavailable`;
          cleanQuestionText = 'Question data unavailable';
        }
        
        console.log('🎤 Question ID:', questionId, 'Already spoken:', spokenQuestions.has(questionId));
        console.log('🎤 Clean question text:', cleanQuestionText);
        
        // Use conversational transition phrase from API or fallback (do not display - question text only)
        const transitionPhrase = data.transition_phrase || FALLBACK_PHRASES.transition();
        
        // Only speak if this question hasn't been spoken before and we have valid text
        if (!spokenQuestions.has(questionId) && cleanQuestionText && cleanQuestionText !== 'Question data unavailable') {
          // Timer will be initialized when recording starts, not when question is spoken
          console.log('⏰ Timer will start when recording begins');
          
          // Set question finished speaking to false initially
          setQuestionFinishedSpeaking(false);
          
          // Speak transition immediately, then show and speak question when transition ends
          console.log('🎤 Speaking transition message...');
          speakWithAI(transitionPhrase, {
            onEnd: () => {
              console.log('🎤 Transition finished, speaking question (text when audio starts)');
              setAiPlaceholder('generating_next');
              setSpokenQuestions(prev => {
                const newSet = new Set([...prev, questionId]);
                console.log('📝 Updated spoken questions:', Array.from(newSet));
                return newSet;
              });
              speakWithAI(questionMessage, {
                onAudioStart: () => {
                  setAiMessage(cleanQuestionText);
                  setAiPlaceholder('');
                }
              });
            },
          });
        } else {
          console.log('⚠️ Question already spoken or invalid, skipping speech');
          // If question already spoken, set finished speaking to true
          setQuestionFinishedSpeaking(true);
        }
        
        logSpokenState(); // Debug current state
        // Removed toast for smoother experience
        
      } else {
        // Check if the response indicates interview completion or an error
        const errorData = await response.json().catch(() => ({}));
        console.log('📊 Non-OK response data:', errorData);
        
        if (response.status === 404) {
          // Interview completed or not found
          console.log('🏁 Interview completed or not found, finishing...');
          if (finishInterviewRef.current) {
            await finishInterviewRef.current();
          } else {
            console.log('⚠️ finishInterviewRef not ready, using direct call');
            await finishInterview();
          }
        } else {
          // Other error
          console.error('❌ Error generating question:', response.status, errorData);
          toast.error(`Failed to generate next question: ${errorData.message || 'Server error'}`, { id: 'question-generate-error' });
        }
      }
      
    } catch (error) {
      console.error('Error generating question:', error);
      toast.error('Failed to generate next question', { id: 'question-generate-error-2' });
    } finally {
      setIsGeneratingQuestion(false);
    }
  }, [interviewData.interviewId, currentQuestionIndex, isGeneratingQuestion]);

     const handleSubmitAnswer = useCallback(async () => {
       console.log('🔍 Submit button clicked!');
       console.log('🔍 Current state:', {
         transcript: transcript,
         transcriptLength: transcript?.length,
         audioBlob: audioBlob,
         audioBlobSize: audioBlob?.size,
         isVideoOn: isVideoOn,
         isSubmitting: isSubmitting,
         currentQuestion: currentQuestion,
         currentQuestionId: currentQuestion?.id,
         currentQuestionQuestionId: currentQuestion?.question_id
       });
       
       // Prevent multiple submissions
       if (isSubmitting) {
         console.log('⚠️ Already submitting, ignoring duplicate click');
         return;
       }

       const isForceSubmitOnTimerExpiry = forceSubmitOnTimerExpiryRef.current;
       if (isForceSubmitOnTimerExpiry) forceSubmitOnTimerExpiryRef.current = false;
       
       // Check for corrupted transcription
       if (transcript && isCorruptedTranscription(transcript)) {
         console.log('❌ Corrupted transcription detected:', transcript);
         toast.error('Audio quality issue detected. Please re-record your answer with clearer speech and minimal background noise.');
         return;
       }
       
       // Clean transcript if it has minor corruption
       let cleanedTranscript = transcript;
       if (transcript && transcript.includes('tabletabletable')) {
         cleanedTranscript = cleanTranscription(transcript);
         console.log('🧹 Cleaned corrupted transcript:', cleanedTranscript);
         
         // If cleaned transcript is too short, ask user to re-record
         if (cleanedTranscript.length < 20) {
           toast.error('Audio quality too poor. Please re-record your answer.');
           return;
         }
       }
       
      // Require transcript from Web Speech API (unless timer expired—then submit whatever we have)
      if (!cleanedTranscript || !cleanedTranscript.trim()) {
        if (isForceSubmitOnTimerExpiry) {
          cleanedTranscript = '';
        } else {
          toast.error('No speech captured. Please speak your answer before submitting.');
          return;
        }
      }

      // When question requires a written answer (e.g. SQL/code), require it before submit (unless timer expired—then submit whatever is in the box)
      const requiresWritten = currentQuestion?.requires_written_answer === true;
      if (requiresWritten && (!writtenAnswer || !writtenAnswer.trim()) && !isForceSubmitOnTimerExpiry) {
        toast.error('This question requires a written answer (e.g. SQL or code). Please write your answer in the box below, then submit.');
        return;
      }

       if (!isVideoOn) {
         toast.error('Camera must be on to submit answer');
         return;
       }

       dispatch(interviewActions.setSubmitting(true));
       setSubmissionStatus('uploading');
       
       try {
          // Upload question video if available
           let questionVideoUrl = null;
           console.log('🔍 Checking for question video blob:', questionVideoBlob);
           console.log('🔍 Video blob size:', questionVideoBlob?.size);
           console.log('🔍 Video blob type:', questionVideoBlob?.type);
           
           if (questionVideoBlob) {
             try {
               console.log('📤 Uploading question video...');
               // Keep uploading status for video upload
               
               // Use FormData for efficient file upload instead of base64
               const formData = new FormData();
               formData.append('interview_id', interviewData.interviewId);
               formData.append('question_order', currentQuestionIndex.toString());
               formData.append('question_text', JSON.stringify(currentQuestion));
               formData.append('video_file', questionVideoBlob, `question_${currentQuestionIndex}.webm`);
               formData.append('video_format', 'webm');
               formData.append('video_quality', 'very_low'); // Optimized for faster uploads

               // Add timeout handling for video upload (optimized for faster processing)
               const videoController = new AbortController();
               const videoTimeout = setTimeout(() => videoController.abort(), API_CONFIG.TIMEOUTS.VIDEO_UPLOAD);
               
               try {
                 const videoResponse = await apiCall(API_CONFIG.ENDPOINTS.UPLOAD_QUESTION_VIDEO, {
                   method: 'POST',
                   body: formData,
                   signal: videoController.signal
                 });
                 
                 clearTimeout(videoTimeout);
                 
                 if (videoResponse.ok) {
                   const videoResult = await videoResponse.json();
                   questionVideoUrl = videoResult.video_url;
                   console.log('✅ Question video uploaded:', questionVideoUrl);
                 } else {
                   console.warn('⚠️ Question video upload failed, continuing without video');
                 }
               } catch (videoError) {
                 clearTimeout(videoTimeout);
                 if (videoError.name === 'AbortError') {
                   console.warn('⚠️ Video upload timed out, continuing without video');
                 } else {
                   console.warn('⚠️ Question video upload error:', videoError);
                 }
               }
             } catch (videoError) {
               console.warn('⚠️ Question video upload error:', videoError);
             }
           }
           
           // Submit answer with cleaned transcript (from Web Speech)
           console.log('🔄 Starting answer submission...');
           setSubmissionStatus('processing');
           const answerController = new AbortController();
           const answerTimeout = setTimeout(() => answerController.abort(), API_CONFIG.TIMEOUTS.ANSWER_SUBMISSION);
           
           // Retry mechanism for first question submission
           const maxRetries = 2;
           let retryCount = 0;
           
           const attemptSubmission = async () => {
             try {
               // Ensure we have a valid transcript
               const finalTranscript = cleanedTranscript && cleanedTranscript.trim() !== "" 
                 ? cleanedTranscript 
                 : "No transcript provided";
             
             console.log('🔍 Final submission data:');
             console.log('🔍 interview_id:', interviewData.interviewId);
             console.log('🔍 transcript:', finalTranscript);
             console.log('🔍 question_video_url:', questionVideoUrl);
             
             // Ensure we have valid question_id for first question
             const questionId = currentQuestion?.id || currentQuestion?.question_id || `q${currentQuestionIndex}`;
             
             // Validate required fields before submission
             if (!interviewData.interviewId) {
               throw new Error('Interview ID is missing');
             }
             if (!questionId) {
               throw new Error('Question ID is missing');
             }
             if (!finalTranscript || finalTranscript.trim() === '') {
               throw new Error('Transcript is empty');
             }

             console.log('🔍 Submission validation passed:');
             console.log('🔍 interview_id:', interviewData.interviewId);
             console.log('🔍 question_id:', questionId);
             console.log('🔍 question_order:', currentQuestionIndex);
             console.log('🔍 transcript length:', finalTranscript.length);

            // Prepare payload including audio blob (base64) and skip_transcription flag
            let audioDataBase64: string | null = null;
            if (audioBlob) {
              audioDataBase64 = await new Promise<string>((resolve, reject) => {
                try {
                  const r = new FileReader();
                  r.onload = () => resolve(String(r.result));
                  r.onerror = reject;
                  r.readAsDataURL(audioBlob);
                } catch (e) {
                  reject(e);
                }
              });
            }

            const response = await apiCall(API_CONFIG.ENDPOINTS.SUBMIT_ANSWER, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 interview_id: interviewData.interviewId,
                 question_id: questionId,
                 question_order: currentQuestionIndex,
                 transcript: finalTranscript, // Use final transcript
                 ...(currentQuestion?.requires_written_answer === true ? { written_answer: (writtenAnswer || '').trim() } : (writtenAnswer?.trim() ? { written_answer: writtenAnswer.trim() } : {})),
                 audio_data: audioDataBase64, // Send audio for storage (not for transcription)
                 skip_transcription: true,
                 question_video_url: questionVideoUrl
               }),
               signal: answerController.signal
             });
             
             clearTimeout(answerTimeout);

             if (response.ok) {
               const result = await response.json();
               
               // Check if interview is completed
               if (result.interview_completed) {
                 console.log('🏁 Interview completed after answer submission!');
                 // No longer extending the interview time - let it end naturally
                 if (finishInterviewRef.current) {
                   await finishInterviewRef.current();
                 } else {
                   console.log('⚠️ finishInterviewRef not ready, using direct call');
                   await finishInterview();
                 }
                 return;
               }
               
               // "I don't know" flow: speak TTS phrase then generate simpler question (same timer)
               if (result.suggest_simpler && result.tts_phrase) {
                 console.log('🎤 Suggest simpler: speaking TTS phrase then generating simpler question');
                 setQuestionVideoBlob(null);
                 setQuestionVideoDuration(0);
                 setAnswerSubmitted(true);
                 setSubmissionStatus('submitted');
                 dispatch(interviewActions.setSubmitting(false));
                 // Show "Loading next question..." and hide old question + input boxes until new question is displayed
                 setAiPlaceholder('generating_next');
                 setAiMessage('');
                 speakWithAI(result.tts_phrase, {
                   onEnd: async () => {
                     await generateNextQuestion(true);
                     setTimeout(() => {
                       setAnswerSubmitted(false);
                       setSubmissionStatus('idle');
                       dispatch(interviewActions.setSubmitting(false));
                     }, 1000);
                   }
                 });
                 return;
               }
               
               // Conversation history removed to reduce complexity
               
               // Reset question video after successful submission
               setQuestionVideoBlob(null);
               setQuestionVideoDuration(0);
               
               // Set answer submitted state so button shows "Submitted" before toast
               console.log('✅ Setting answerSubmitted to true');
               setAnswerSubmitted(true);
               setSubmissionStatus('submitted');
               dispatch(interviewActions.setSubmitting(false));

               // Show toast after button has updated to "Submitted" (defer so user sees "Submitted" first)
               setTimeout(() => {
                 toast.success('Answer submitted successfully!', {
                   id: 'answer-submitted',
                   duration: 2000,
                 });
               }, 0);

               // Show "Loading next question..." and hide question + input boxes until new question is displayed
               setAiPlaceholder('generating_next');
               setAiMessage('');
               // Generate next question immediately (no delays for smooth transition)
               console.log('🔄 Generating next question immediately...');
               await generateNextQuestion();
               
               // Reset submission states after next question is generated with a small delay
               setTimeout(() => {
                 setAnswerSubmitted(false);
                 setSubmissionStatus('idle');
                 dispatch(interviewActions.setSubmitting(false));
               }, 1000); // 1 second delay to show the submitted state
               
             } else {
               console.error('❌ Answer submission failed with status:', response.status);
               const errorText = await response.text();
               console.error('❌ Error response:', errorText);
               
               // Retry logic for first question
               if (retryCount < maxRetries && currentQuestionIndex === 0) {
                 retryCount++;
                 console.log(`🔄 Retrying submission (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                 toast.error(`Submission failed, retrying... (${retryCount}/${maxRetries})`, { id: 'answer-retry' });
                 
                 // Wait a bit before retry
                 await new Promise(resolve => setTimeout(resolve, 1000));
                 return attemptSubmission();
               } else {
                 toast.error('Failed to submit answer', { id: 'answer-submit-error' });
                 // Reset states on failure
                 dispatch(interviewActions.setSubmitting(false));
                 setSubmissionStatus('idle');
               }
             }
           } catch (fetchError) {
             clearTimeout(answerTimeout);
             if (fetchError.name === 'AbortError') {
               console.error('❌ Answer submission timed out');
               toast.error('Submission timed out. Please try again.');
             } else {
               console.error('❌ Error during answer submission:', fetchError);
               
               // Retry logic for first question
               if (retryCount < maxRetries && currentQuestionIndex === 0) {
                 retryCount++;
                 console.log(`🔄 Retrying submission after error (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                 toast.error(`Submission error, retrying... (${retryCount}/${maxRetries})`);
                 
                 // Wait a bit before retry
                 await new Promise(resolve => setTimeout(resolve, 1000));
                 return attemptSubmission();
               } else {
                 toast.error('Failed to submit answer. Please try again.');
               }
             }
             // Reset states on error
             dispatch(interviewActions.setSubmitting(false));
             setSubmissionStatus('idle');
           }
           };
           
           // Start the submission attempt
           await attemptSubmission();
         
       } catch (error) {
         console.error('Error submitting answer:', error);
         toast.error('Failed to submit answer');
         // Reset states on error
         dispatch(interviewActions.setSubmitting(false));
         setSubmissionStatus('idle');
       }
     }, [transcript, audioBlob, isVideoOn, currentQuestion, currentQuestionIndex, interviewData.interviewId, spokenFeedback, generateNextQuestion, interviewData.candidateName, isSubmitting, questionVideoBlob, speakWithAI, writtenAnswer]);

  // Assign refs after functions are defined
  useEffect(() => {
    speakWithAIRef.current = speakWithAI;
    finishInterviewRef.current = finishInterview;
  }, [speakWithAI, finishInterview]);

  useEffect(() => {
    handleSubmitAnswerRef.current = handleSubmitAnswer;
  }, [handleSubmitAnswer]);

  // Animate dots (1 → 2 → 3 → 1) when showing "Generating your first/next question"
  useEffect(() => {
    const isGenerating = aiPlaceholder === 'generating_first' || aiPlaceholder === 'generating_next';
    if (!isGenerating) return;
    const id = setInterval(() => {
      setLoadingDots((prev) => (prev + 1) % 3);
    }, 450);
    return () => clearInterval(id);
  }, [aiPlaceholder]);

  useEffect(() => {
    if (!isInterviewTimerActive) {
      return;
    }

    if (timeRemaining > 60 && lastInterviewWarningRef.current !== null) {
      lastInterviewWarningRef.current = null;
    }

    if (timeRemaining <= 0) {
      lastInterviewWarningRef.current = null;
      return;
    }

    if (timeRemaining <= 30 && lastInterviewWarningRef.current !== 30) {
      toast('30 seconds remaining! Please finish your current response.', {
        id: 'interview-warning-30',
      });
      lastInterviewWarningRef.current = 30;
    } else if (timeRemaining <= 60 && lastInterviewWarningRef.current !== 60) {
      toast('1 minute remaining in your interview!', {
        id: 'interview-warning-60',
      });
      lastInterviewWarningRef.current = 60;
    } else if (timeRemaining <= 120 && timeRemaining > 0) {
      console.log(`⏰ Time remaining: ${timeRemaining}s - approaching completion`);
    }
  }, [timeRemaining, isInterviewTimerActive]);

  useEffect(() => {
    if (!isQuestionTimerActive) {
      lastQuestionWarningRef.current = null;
      return;
    }

    if (questionTimeRemaining > 60) {
      lastQuestionWarningRef.current = null;
    }

    if (questionTimeRemaining <= 0) {
      lastQuestionWarningRef.current = null;
      return;
    }

    // Prioritize 30-second warning - check this first
    if (questionTimeRemaining <= 30 && lastQuestionWarningRef.current !== 30) {
      toast('Less than 30 seconds remaining! Answer will auto-submit soon.', {
        id: 'question-warning-30',
      });
      lastQuestionWarningRef.current = 30;
    } else if (questionTimeRemaining > 30 && questionTimeRemaining <= 60 && lastQuestionWarningRef.current !== 60) {
      toast('1 minute remaining for this question.', {
        id: 'question-warning-60',
      });
      lastQuestionWarningRef.current = 60;
    }
  }, [isQuestionTimerActive, questionTimeRemaining]);
  useEffect(() => {
    if (!isVideoOn && !cameraWarningShownRef.current) {
      cameraWarningShownRef.current = true;
      toast.error('Camera must remain on during the interview!', {
        id: 'camera-warning',
        duration: 5000
      });
      const timer = setTimeout(() => {
        if (!isVideoOn) {
          terminateInterview('Camera turned off');
        }
        cameraWarningShownRef.current = false; // Reset after timeout
      }, 5000);

      return () => clearTimeout(timer);
    } else if (isVideoOn) {
      cameraWarningShownRef.current = false; // Reset when camera is back on
    }
  }, [isVideoOn, terminateInterview, videoRef]);

  // Handle browser close/navigation away
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isRecording || isVideoRecording) {
        // Show warning to user
        event.preventDefault();
        event.returnValue = 'Interview is in progress. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    const handleUnload = () => {
      // Terminate interview when user leaves the page
      if (interviewData?.interview_id) {
        // Use sendBeacon for more reliable delivery during page unload
        const data = JSON.stringify({
          reason: 'Browser closed/navigated away',
          timestamp: new Date().toISOString()
        });
        
        try {
          navigator.sendBeacon(`/api/terminate-interview/${interviewData.interview_id}`, data);
        } catch (error) {
          console.error('Failed to send termination beacon:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [isRecording, isVideoRecording, interviewData?.interview_id]);

  // Tab change detection and termination
  useEffect(() => {
    if (!isInterviewTimerActive) {
      tabChangeCountRef.current = 0;
      if (tabWarningTimeoutRef.current) {
        clearTimeout(tabWarningTimeoutRef.current);
        tabWarningTimeoutRef.current = null;
      }
      lastTabViolationRef.current = 0;
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabViolation('visibilitychange');
      } else if (tabChangeCountRef.current > 0 && tabChangeCountRef.current <= MAX_TAB_CHANGES) {
        console.log('✅ Candidate returned to interview tab');

        if (tabWarningTimeoutRef.current) {
          clearTimeout(tabWarningTimeoutRef.current);
        }

        tabWarningTimeoutRef.current = setTimeout(() => {
          if (!document.hidden) {
            console.log('✅ Resetting tab change count - candidate stayed on tab');
            tabChangeCountRef.current = 0;
          }
        }, 30000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (tabWarningTimeoutRef.current) {
        clearTimeout(tabWarningTimeoutRef.current);
        tabWarningTimeoutRef.current = null;
      }
    };
  }, [isInterviewTimerActive, handleTabViolation]);

  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  // Additional: Detect new window/tab opening attempts via focus loss
  useEffect(() => {
    if (!isInterviewTimerActive) {
      return;
    }

    const handleWindowBlur = () => {
      if (!isInterviewTimerActive) {
        return;
      }

      console.log('⚠️ Window lost focus - possible tab/window switch');
      // Removed duplicate toast - handleTabViolation will show the warning toast
      
      handleTabViolation('window blur');
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isInterviewTimerActive, handleTabViolation]);

  // Fullscreen change monitoring
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreen(isCurrentlyFullscreen);

      if (!isInterviewTimerActive) {
        return;
      }

      if (!isCurrentlyFullscreen) {
        console.log('🚫 Fullscreen exited - terminating interview');
        toast.error('Interview terminated: Fullscreen mode exited');
        terminateInterview('Candidate exited fullscreen mode during interview');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [isInterviewTimerActive, terminateInterview]);

  // ESC key detection warning
  useEffect(() => {
    if (!isInterviewTimerActive) {
      if (escTerminateTimeoutRef.current) {
        clearTimeout(escTerminateTimeoutRef.current);
        escTerminateTimeoutRef.current = null;
      }
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Escape' || event.keyCode === 27) && isFullscreenRef.current) {
        toast('STOP! Pressing ESC will exit fullscreen and terminate your interview!', {
          duration: 2000,
        });

        if (escTerminateTimeoutRef.current) {
          clearTimeout(escTerminateTimeoutRef.current);
        }

        escTerminateTimeoutRef.current = setTimeout(() => {
          terminateInterview('ESC key pressed during interview');
        }, 300);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (escTerminateTimeoutRef.current) {
        clearTimeout(escTerminateTimeoutRef.current);
        escTerminateTimeoutRef.current = null;
      }
    };
  }, [isInterviewTimerActive, terminateInterview]);

  const startRecordingRef = useRef<(() => Promise<void>) | null>(null);
  
    const startQuestionRecording = async () => {
    try {
      console.log('🎥 Starting camera video recording...');
      console.log('🔍 Current state - isRecording:', isRecording, 'isVideoOn:', isVideoOn, 'cameraPermissionGranted:', cameraPermissionGranted, 'hasRequestedCameraPermissions:', hasRequestedCameraPermissions);
      
      // Check if camera permissions are already granted and camera stream is available
      if (!cameraPermissionGranted || !streamRef.current || !isVideoOn) {
        toast.error('Camera permissions required. Please allow camera access first.');
        return;
      }
      
      // Start timer for current question (skip if timer is locked — e.g. written question, user already stopped)
      if (currentQuestionMaxTime > 0 && !writtenQuestionTimerLockedRef.current) {
        console.log('⏰ Starting timer for current question:', currentQuestionMaxTime, 'seconds');
        setQuestionTimerSeconds(currentQuestionMaxTime);
        setIsQuestionTimerActive(true);
      } else if (currentQuestionMaxTime > 0 && writtenQuestionTimerLockedRef.current) {
        // Timer already running for written question; just ensure active
        setIsQuestionTimerActive(true);
      } else {
        // Initialize timer if not set
          if (interviewData?.interview_mode === 'structured') {
          console.log('⏰ Structured interview - timer should come from API response');
          } else {
            initializeTimerForExistingQuestion(interviewData.position, currentQuestionIndex);
        }
      }
      
      console.log('✅ Using camera stream for recording');
      
      // Get camera video stream (already initialized)
      const cameraStream = streamRef.current;
      if (!cameraStream) {
        toast.error('Camera stream not available. Please refresh and try again.');
        return;
      }
      
      // Re-enable microphone recording ONLY to capture audio blob for upload (not for transcription)
      let audioRecorder = null;
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          }
        });
        audioRecorder = new RecordRTC(micStream, {
          type: 'audio',
          mimeType: 'audio/wav',
          numberOfAudioChannels: 1,
          desiredSampRate: 44100,
          recorderType: RecordRTC.StereoAudioRecorder,
          quality: 10
        });
        audioStreamRef.current = micStream;
      } catch (micErr) {
        console.warn('⚠️ Failed to acquire microphone stream for audio blob:', micErr);
        audioRecorder = null;
      }
      const combinedStream = new MediaStream();
      
      // Add video tracks from camera stream
      cameraStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      if (micStream) {
        micStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }
      
      console.log('🎬 Combined stream created with video tracks:', combinedStream.getVideoTracks().length);
      console.log('🎤 Combined stream created with audio tracks:', combinedStream.getAudioTracks().length);
      
      // Create recorder using the combined stream (video + audio); lower bitrate/quality for smaller files
      const videoBitsPerSecond = isMobile ? 400000 : INTERVIEW_CONSTANTS.MEDIA.VIDEO_BITRATE;
      const questionVideoRecorder = new RecordRTC(combinedStream, {
        type: 'video',
        mimeType: 'video/webm',
        recorderType: RecordRTC.MediaStreamRecorder,
        quality: 3,
        frameRate: 10,
        disableLogs: false,
        videoBitsPerSecond,
        timeSlice: INTERVIEW_CONSTANTS.MEDIA.TIME_SLICE,
        ondataavailable: function(blob) {
          console.log('🎥 Combined video+audio chunk available:', blob.type, blob.size);
        }
      });
      
      // Start video recorder
      questionVideoRecorder.startRecording();
      console.log('🎥 Video recording started');
      
      // Start browser Web Speech recognition for live transcript
      startWebSpeech();
      // Start audio recorder if available (for upload only, not transcription)
      if (audioRecorder) {
        audioRecorder.startRecording();
      }
      
      // Store references
      setMediaRecorder(audioRecorder);
      setVideoRecorder(questionVideoRecorder);
      
      // Initialize timer for first question when recording actually starts (after permissions are granted)
      if (!hasRequestedCameraPermissions) {
        console.log('⏰ Starting timer for first question - recording is about to begin');
        // Only initialize timer if we don't already have correct values from API response
        if (currentQuestionMaxTime === 0) {
          // For structured interviews, don't initialize timer here - it should come from API response
          if (interviewData?.interview_mode === 'structured') {
            console.log('⏰ Structured interview - timer should come from API response, not parameter initialization');
          } else {
            initializeTimerForExistingQuestion(interviewData.position, currentQuestionIndex);
          }
        } else {
          console.log('⏰ Timer already set from API response, skipping initialization');
        }
      }
      
      setIsRecording(true);
      setIsVideoRecording(true);
      setAudioBlob(null);
      setQuestionVideoBlob(null);
      
      // Reset countdown when recording starts
      setRecordingCountdown(0);
      
      // Answer timer removed - will be handled dynamically based on parameter max_time
      
      // DON'T clear transcript when starting recording - keep live transcription working
      // setTranscript('');
      
      // Reset question finished speaking state since we're starting a new recording
      setQuestionFinishedSpeaking(false);
      
      // Show recording status
      // toast.success('🖥️ Screen + Camera recording with your microphone audio started!'); // Screen recording start message commented out
      
      // Web Speech is active for voice capture; no separate audio recorder toast
      
      // Do not use socket transcription; Web Speech handles transcription
      
    } catch (error) {
      console.error('❌ Automatic camera recording start error:', error);
      toast.error('Failed to start camera recording. Please refresh and try again.');
    }
  };
  
  // Store the function in ref for use in useEffect
  startRecordingRef.current = startQuestionRecording;

  // Function to start recording countdown
  const startRecordingCountdown = useCallback(() => {
    setRecordingCountdown(3);
    const countdownInterval = setInterval(() => {
      setRecordingCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Automatically start recording when countdown reaches 0
          if (!isRecording && isVideoOn && !isSubmitting) {
            console.log('🎥 Auto-starting recording after countdown');
            startQuestionRecording().catch(error => {
              console.error('❌ Error auto-starting recording:', error);
              toast.error('Failed to start recording automatically. Please try manually.');
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isRecording, isVideoOn, isSubmitting, startQuestionRecording]);

  const loadInterviewData = useCallback(async () => {
    // STRONG prevention of multiple calls
    if (hasSpokenWelcomeRef.current || aiSpeaking) {
      console.log('⚠️ Welcome already spoken or AI is speaking, skipping loadInterviewData');
      return;
    }
    
    try {
      console.log('🔍 Loading interview data for ID:', interviewData.interviewId);
      console.log('🔍 hasSpokenWelcomeRef.current:', hasSpokenWelcomeRef.current);
      console.log('🔍 hasSpokenFirstQuestionRef.current:', hasSpokenFirstQuestionRef.current);
      
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewData.interviewId}`);
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Interview data received:', data);
        
        // The API returns nested structure: {interview: {...}, questions: [...], answers: [...]}
        // We need to flatten it like we did in CandidateInterview
        const flattenedData = {
          ...data.interview,
          questions: data.questions || [],
          answers: data.answers || []
        };
        
        // Set current question from interview data or first question
        const firstQuestion = interviewData.currentQuestion || flattenedData.questions?.[0];
        firstQuestionRef.current = firstQuestion;
        console.log('🎯 Setting current question:', firstQuestion);
        console.log('🎯 Interview data currentQuestion:', interviewData.currentQuestion);
        console.log('🎯 Data questions:', flattenedData.questions);
        setCurrentQuestion(firstQuestion);
        
        // Initialize timer for first question if we have the data
        if (firstQuestion && firstQuestion.max_time) {
          const questionTimeInSeconds = firstQuestion.max_time * 60;
          setCurrentQuestionMaxTime(questionTimeInSeconds);
          setQuestionTimerSeconds(questionTimeInSeconds);
          setIsQuestionTimerActive(false); // Don't start timer yet!
          
          console.log('⏰ Timer initialized for first question:', questionTimeInSeconds, 'seconds for', firstQuestion.max_time, 'min answer time');
          console.log('🔍 Using first question data - max_time:', firstQuestion.max_time, 'level:', firstQuestion.level);
        } else {
          console.log('⏰ No max_time in first question data, timer will be initialized when question is spoken');
        }
        
        // Clean up question text (remove "Question:" prefix if present)
        let cleanQuestionText = '';
        if (firstQuestion && firstQuestion.question_text) {
          cleanQuestionText = firstQuestion.question_text
            .replace(/^Question:\s*/i, '') // Remove "Question:" prefix
            .replace(/\n+/g, ' ') // Replace multiple newlines with single space
            .trim(); // Remove leading/trailing whitespace
          console.log('🎯 Clean question text:', cleanQuestionText);
        } else if (interviewData.currentQuestion) {
          // If firstQuestion.question_text is undefined, try using interviewData.currentQuestion directly
          cleanQuestionText = interviewData.currentQuestion
            .replace(/^Question:\s*/i, '') // Remove "Question:" prefix
            .replace(/\n+/g, ' ') // Replace multiple newlines with single space
            .trim(); // Remove leading/trailing whitespace
          console.log('🎯 Clean question text from interviewData:', cleanQuestionText);
        }
        
        // Welcome message and first question will be handled after camera access is granted
        console.log('🔍 Interview data loaded, waiting for camera access to start welcome message');
        
      } else {
        console.error('❌ Failed to load interview data:', response.status);
        toast.error('Failed to load interview data');
      }
    } catch (error) {
      console.error('❌ Error loading interview data:', error);
      toast.error('Failed to load interview data');
    }
  }, [interviewData, setCurrentQuestion, setAiMessage, aiSpeaking, isRecording, isVideoOn]);

  // Function to initialize timer for existing questions by fetching parameter data
  const initializeTimerForExistingQuestion = useCallback(async (position, questionIndex) => {
    try {
      console.log('🔍 Fetching parameter data for position:', position, 'question index:', questionIndex);
      
      // Fetch parameter configuration from Supabase
      console.log('🔍 Fetching parameters for role:', position);
      const { data: paramData, error } = await supabase
        .from('custom_role_parameters')
        .select('custom_parameters')
        .eq('role_name', position)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      console.log('🔍 Supabase query result:', { paramData, error });
      
      if (error) {
        console.error('❌ Error fetching parameter data:', error);
        // Fallback to default 3 minutes (answer time only)
        const questionTimeInSeconds = 3 * 60;
        setCurrentQuestionMaxTime(questionTimeInSeconds);
        setQuestionTimerSeconds(questionTimeInSeconds);
        setIsQuestionTimerActive(true);
        return;
      }
      
      if (paramData && paramData.length > 0 && paramData[0].custom_parameters) {
        const customParams = paramData[0].custom_parameters;
        console.log('🔍 Found parameter configuration:', Object.keys(customParams));
        console.log('🔍 Full custom parameters:', customParams);
        
        // Get the current question data from interview data
        const currentQuestion = interviewData?.questions?.[questionIndex];
        if (currentQuestion && currentQuestion.parameter_key && customParams[currentQuestion.parameter_key]) {
          const paramKey = currentQuestion.parameter_key;
          const paramConfig = customParams[paramKey];
          
          // Use max_time from question data (which comes from database)
          const questionMaxTime = currentQuestion.max_time || paramConfig.max_time || 3;
          // Use only answer time (no reading buffer since timer starts when recording begins)
          const questionTimeInSeconds = questionMaxTime * 60;
          
          setCurrentQuestionMaxTime(questionTimeInSeconds);
          setQuestionTimerSeconds(questionTimeInSeconds);
          setIsQuestionTimerActive(true);
          
          console.log('⏰ Timer initialized for existing question:', questionTimeInSeconds, 'seconds for', questionMaxTime, 'min answer time');
          console.log('🔍 Using parameter from question data:', paramKey, 'with max_time:', questionMaxTime);
          console.log('🔍 Question data:', currentQuestion);
        } else if (Object.keys(customParams).length > 0) {
          // Fallback: use round-robin if no parameter_key in question data
          const paramKeys = Object.keys(customParams);
          const paramIndex = questionIndex % paramKeys.length;
          const paramKey = paramKeys[paramIndex];
          const paramConfig = customParams[paramKey];
          
          // Parse max_time (handle both string and number values)
          const questionMaxTime = typeof paramConfig.max_time === 'string' 
            ? parseFloat(paramConfig.max_time) || 3 
            : (paramConfig.max_time || 3);
          // Use only answer time (no reading buffer since timer starts when recording begins)
          const questionTimeInSeconds = questionMaxTime * 60;
          
          setCurrentQuestionMaxTime(questionTimeInSeconds);
          setQuestionTimerSeconds(questionTimeInSeconds);
          setIsQuestionTimerActive(true);
          
          console.log('⏰ Timer initialized for existing question (fallback):', questionTimeInSeconds, 'seconds for', questionMaxTime, 'min answer time');
          console.log('🔍 Using parameter (fallback):', paramKey, 'with max_time:', questionMaxTime);
          console.log('🔍 Parameter config:', paramConfig);
        } else {
          // No parameters found, use default (answer time only)
          const questionTimeInSeconds = 3 * 60;
          setCurrentQuestionMaxTime(questionTimeInSeconds);
          setQuestionTimerSeconds(questionTimeInSeconds);
          setIsQuestionTimerActive(true);
          console.log('⏰ No parameters found, using default 3 minutes');
        }
      } else {
        // No parameter data found, use default (answer time only)
        const questionTimeInSeconds = 3 * 60;
        setCurrentQuestionMaxTime(questionTimeInSeconds);
        setQuestionTimerSeconds(questionTimeInSeconds);
        setIsQuestionTimerActive(true);
        console.log('⏰ No parameter data found, using default 3.5 minutes');
      }
    } catch (error) {
      console.error('❌ Error initializing timer for existing question:', error);
      // Fallback to default (answer time only)
      const questionTimeInSeconds = 3 * 60;
      setCurrentQuestionMaxTime(questionTimeInSeconds);
      setQuestionTimerSeconds(questionTimeInSeconds);
      setIsQuestionTimerActive(true);
    }
  }, [interviewData]);

  // Initialize and animate waveform heights
  useEffect(() => {
    // Initialize with consistent heights
    setWaveformHeights(Array(15).fill(0).map(() => Math.random() * 20 + 40));
  }, []);

  // Animate waveform when AI is speaking - using speech patterns
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (aiSpeaking && speechPattern.length > 0) {
      interval = setInterval(() => {
        setWaveformHeights(prev => {
          const newHeights = [...prev];
          
          // Get current pattern value
          const currentHeight = speechPattern[patternIndex] || 42;
          
          // Update 3-5 bars with the current pattern height
          const barsToUpdate = Math.floor(Math.random() * 3) + 3;
          const indices = [...Array(15)].map((_, i) => i).sort(() => 0.5 - Math.random()).slice(0, barsToUpdate);
          
          indices.forEach(index => {
            // Add slight variation to make it look natural
            const variation = (Math.random() - 0.5) * 6;
            newHeights[index] = Math.max(35, Math.min(55, currentHeight + variation));
          });
          
          return newHeights;
        });
        
        // Move to next pattern point
        setPatternIndex(prev => (prev + 1) % speechPattern.length);
      }, 300); // Faster updates for smoother speech rhythm
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [aiSpeaking, aiMessage, speechPattern, patternIndex]);

  // Start timer when recording begins (only once; do not reset when timer is already running or when user stopped to write)
  useEffect(() => {
    if (writtenQuestionTimerLockedRef.current) return; // Never reset timer after user stopped to write (written question)
    if (isRecording && currentQuestionMaxTime > 0 && !isQuestionTimerActive) {
      console.log('⏰ Recording started, starting question timer');
      setQuestionTimerSeconds(currentQuestionMaxTime);
      setIsQuestionTimerActive(true);
    }
  }, [isRecording, currentQuestionMaxTime, isQuestionTimerActive]);

  // Refs for cleanup
  const recordingDelayTimeoutRef = useRef<number | null>(null);
  const recordingCountdownIntervalRef = useRef<number | null>(null);

  // Lint-safe effect: starts countdown only after AI fully finished speaking
  useEffect(() => {
    // Written question and user already stopped to write (timer already running): do not reset timer or restart countdown
    if (currentQuestion?.requires_written_answer === true && !isRecording && isQuestionTimerActive) {
      writtenQuestionTimerLockedRef.current = true;
      return;
    }
    // Only run when question just finished speaking and we're about to start recording (timer not yet active).
    if (questionFinishedSpeaking && !aiSpeaking && !isRecording && !isSubmitting && !isQuestionTimerActive) {
      // Small stabilization delay to avoid React batching/race issues
      recordingDelayTimeoutRef.current = window.setTimeout(() => {
        if (writtenQuestionTimerLockedRef.current) return; // User already stopped to write — do not reset timer
        console.log('✅ AI finished speaking (stable) — starting 3s countdown');

        // Do NOT start the question timer here — start it only when recording actually begins,
        // so "1 min remaining" and timer don't appear before the user can answer.
        if (currentQuestionMaxTime > 0) {
          setQuestionTimerSeconds(currentQuestionMaxTime);
        }

        // Initialize visual countdown
        setRecordingCountdown(3);

        // Start interval for countdown
        recordingCountdownIntervalRef.current = window.setInterval(() => {
          setRecordingCountdown(prev => {
            if (prev <= 1) {
              // Clear interval safely
              if (recordingCountdownIntervalRef.current) {
                window.clearInterval(recordingCountdownIntervalRef.current);
                recordingCountdownIntervalRef.current = null;
              }

              console.log('🎥 Countdown finished — auto-start recording');
              // start recording via ref (safe: ref is stable)
              try {
                startRecordingRef.current?.();
              } catch (err) {
                console.error('❌ startRecordingRef.current threw:', err);
                toast.error('Failed to start recording automatically.');
              }

              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, 200); // 200ms stabilization delay
    }

    // Cleanup when dependencies change/unmount
    return () => {
      if (recordingDelayTimeoutRef.current) {
        window.clearTimeout(recordingDelayTimeoutRef.current);
        recordingDelayTimeoutRef.current = null;
      }
      if (recordingCountdownIntervalRef.current) {
        window.clearInterval(recordingCountdownIntervalRef.current);
        recordingCountdownIntervalRef.current = null;
      }
    };
  }, [
    questionFinishedSpeaking,
    aiSpeaking,
    isRecording,
    isSubmitting,
    isQuestionTimerActive,
    currentQuestionMaxTime,
    currentQuestion?.requires_written_answer,
    startRecordingRef
  ]);

  const initializeAudio = useCallback(async () => {
    if (audioContextRef.current) {
      console.log('🎧 Audio context already initialized');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioWorkletStreamRef.current = stream;

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported in this browser.');
      }

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule('/worklets/MyProcessor.js');
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'my-processor');
      audioWorkletNodeRef.current = workletNode;

      source.connect(workletNode);

      workletNode.port.onmessage = (event) => {
        const samples = event.data;
        // TODO: feed samples into transcription/recording logic
        void samples;
      };

      console.log('✅ AudioWorklet initialized');
    } catch (error) {
      console.error('❌ Audio init failed:', error);
      /*toast.error('Failed to initialize audio. Please check microphone permissions.');*/
    }
  }, []);

  const initializeCamera = useCallback(async () => {
    try {
      const videoConstraints = getAdaptiveVideoConstraints({
        preferMobile: isMobile,
        preferFrontCamera: isMobile,
      });
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      streamRef.current = stream;
      videoStreamRef.current = stream;
      setIsVideoOn(true);
      setCameraPermissionGranted(true);
      setHasRequestedCameraPermissions(true);
      
      // Monitor camera status
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        setIsVideoOn(false);
        setCameraPermissionGranted(false);
        toast.error('Camera access lost. Interview may be affected.');
      };
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraPermissionGranted(false);
      setHasRequestedCameraPermissions(false);
      toast.error('Camera access required for interview');
      navigate('/setup');
    }
  }, [navigate, isMobile]);

  // Capture candidate photo from video stream
  const captureCandidatePhoto = useCallback(async (): Promise<string | null> => {
    try {
      if (!videoRef.current) {
        console.warn('⚠️ Video element not available for photo capture');
        return null;
      }

      const video = videoRef.current;
      
      // Wait for video to be ready and have valid dimensions
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        // Wait for video to load
        await new Promise<void>((resolve) => {
          const checkReady = () => {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              resolve();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      }

      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('❌ Failed to get canvas context');
        return null;
      }

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 JPEG (quality 0.85 for good balance)
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      console.log('✅ Candidate photo captured successfully');
      return photoDataUrl;
    } catch (error) {
      console.error('❌ Error capturing candidate photo:', error);
      return null;
    }
  }, []);

  // Photo capture is now done before interview starts in CandidateInterview component
  // Commented out automatic capture during interview
  // useEffect(() => {
  //   if (isInterviewTimerActive && videoRef.current && interviewData?.interviewId) {
  //     // Wait 2.5 seconds for video to stabilize before capturing
  //     const captureTimer = setTimeout(async () => {
  //       try {
  //         const photoDataUrl = await captureCandidatePhoto();
  //         if (photoDataUrl && interviewData.interviewId) {
  //           const storageKey = `candidate_photo_${interviewData.interviewId}`;
  //           const timestamp = Date.now();
  //           
  //           // Store in both localStorage (persistent) and sessionStorage (backup)
  //           try {
  //             // Primary storage: localStorage (persists across sessions)
  //             localStorage.setItem(storageKey, photoDataUrl);
  //             localStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
  //             console.log('✅ Candidate photo stored in localStorage:', storageKey);
  //           } catch (localStorageError) {
  //             console.warn('⚠️ localStorage full or unavailable, using sessionStorage only');
  //           }
  //           
  //           try {
  //             // Backup storage: sessionStorage (same session)
  //             sessionStorage.setItem(storageKey, photoDataUrl);
  //             sessionStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
  //             console.log('✅ Candidate photo stored in sessionStorage:', storageKey);
  //           } catch (sessionStorageError) {
  //             console.warn('⚠️ sessionStorage unavailable');
  //           }
  //         }
  //       } catch (error) {
  //         console.error('❌ Failed to capture/store candidate photo:', error);
  //       }
  //     }, 2500); // Wait 2.5 seconds for video to stabilize

  //     return () => clearTimeout(captureTimer);
  //   }
  // }, [isInterviewTimerActive, captureCandidatePhoto, interviewData?.interviewId]);

  const requestFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement;

      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }

      setIsFullscreen(true);
      console.log('✅ Fullscreen mode activated');
      toast.success('Interview started in fullscreen mode');
    } catch (error) {
      console.error('❌ Fullscreen request failed:', error);
      const attempts = fullscreenAttempts + 1;
      setFullscreenAttempts(attempts);

      if (attempts < 3) {
        toast('Please allow fullscreen for the interview', {
          duration: 4000,
        });
      } else {
        toast.error('Fullscreen is required. Interview will be terminated.');
        setTimeout(() => {
          terminateInterview('Fullscreen permission denied multiple times');
        }, 2000);
      }
    }
  }, [fullscreenAttempts, terminateInterview]);

  // Camera permissions are handled in initializeCamera function

  useEffect(() => {
    const socket = io(API_CONFIG.BASE_URL, {
      transports: ['websocket', 'polling'], // Fallback to polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: false, // Don't force new connection
      // pingTimeout: 30000, // Not a valid socket.io option
      // pingInterval: 10000 // Not a valid socket.io option
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setConnectionStatus('connected');
      socket.emit('get_current_transcription');
      
      // Start transcription for this interview
      if (interviewData?.interviewId) {
        console.log('🎤 Starting transcription for interview:', interviewData.interviewId);
        socket.emit('start_transcription', {
          interview_id: interviewData.interviewId
        });
      }
    });

    // ✅ CRITICAL: Listen for real-time transcription updates
    socket.on('transcription_update', (data) => {
      console.log('📡 Received transcription segment:', data.segment);
      
      if (data && data.segment && data.segment.trim().length > 0) {
        setTranscript(prevTranscript => {
          const segment = data.segment.trim();
          
          // ✅ Avoid duplicates - check if segment is already at the end
          if (prevTranscript.endsWith(segment)) {
            console.log('📝 Skipping duplicate segment at end:', segment);
            return prevTranscript;
          }
          
          // ✅ Append new segment
          const newTranscript = prevTranscript 
            ? `${prevTranscript} ${segment}` 
            : segment;
          
          console.log('✅ Transcript updated:', newTranscript);
          return newTranscript;
        });
      } else if (data && data.text && data.text.trim().length > 0) {
        // Fallback for 'text' key (backward compatibility)
        setTranscript(prevTranscript => {
          const segment = data.text.trim();
          
          if (prevTranscript.endsWith(segment)) {
            return prevTranscript;
          }
          
          const newTranscript = prevTranscript 
            ? `${prevTranscript} ${segment}` 
            : segment;
          
          console.log('✅ Transcript updated (text key):', newTranscript);
          return newTranscript;
        });
      } else {
        console.log('📝 Skipping empty/short segment');
      }
    });

    socket.on('transcription_error', (data) => {
      console.error('❌ Transcription error:', data);
      if (data && data.error) {
        toast.error(`Transcription error: ${data.error}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      setConnectionStatus('disconnected');
      
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (socketRef.current && !socketRef.current.connected) {
          console.log('🔄 Attempting to reconnect...');
          socketRef.current.connect();
        }
      }, 3000);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Connection error:', error);
      setConnectionStatus('error');
    });

    return () => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    };
  }, []);

  // Auto-scroll transcript to bottom when content updates during recording
  useEffect(() => {
    if (transcriptTextareaRef.current && isRecording) {
      const textarea = transcriptTextareaRef.current;
      // Scroll to bottom
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [transcript, isRecording]);

  // Disable socket-started transcription; Web Speech is the single source of truth

  // Camera stream cleanup is handled by videoStreamRef and streamRef

  useEffect(() => {
    return () => {
      if (audioWorkletNodeRef.current) {
        try {
          audioWorkletNodeRef.current.port.postMessage({ type: 'stop' });
        } catch (error) {
          console.warn('⚠️ Error signaling audio worklet stop:', error);
        }
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }

      if (audioWorkletStreamRef.current) {
        audioWorkletStreamRef.current.getTracks().forEach(track => track.stop());
        audioWorkletStreamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch((error) => {
          console.warn('⚠️ Error closing audio context:', error);
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  const stopQuestionRecording = () => {
    // For written-answer questions, keep the timer running so the user sees time remaining while typing
    const isWrittenQuestion = currentQuestion?.requires_written_answer === true;
    if (!isWrittenQuestion) {
      console.log('⏰ Stopping question timer - recording stopped manually');
      setIsQuestionTimerActive(false);
      setQuestionTimerSeconds(0);
      writtenQuestionTimerLockedRef.current = false;
    } else {
      console.log('⏰ Written question: keeping timer running so user can see time while writing');
      writtenQuestionTimerLockedRef.current = true; // Block any effect from resetting timer to full
    }

    if (!mediaRecorder && !videoRecorder) {
      setIsRecording(false);
      setIsVideoRecording(false);
      return;
    }
    
    let audioBlobRetrieved = false;
    let videoBlobRetrieved = false;
    
    // Stop Web Speech recognition
    stopWebSpeech();
    
    // Stop audio recording and capture blob for upload
    if (mediaRecorder && mediaRecorder.stopRecording) {
      try {
        mediaRecorder.stopRecording(() => {
          try {
            const blob = mediaRecorder.getBlob();
            if (blob && blob.size > 0) {
              setAudioBlob(blob);
            }
          } catch (e) {
            console.error('❌ Error retrieving audio blob:', e);
          }
        });
      } catch (e) {
        console.error('❌ Error stopping audio recorder:', e);
      }
    }
    
    // Stop question video recording
    if (videoRecorder && videoRecorder.stopRecording) {
      try {
        videoRecorder.stopRecording(() => {
                  try {
          const videoBlob = videoRecorder.getBlob();
          console.log('🎥 Retrieved camera video blob:', videoBlob);
          console.log('🎥 Video blob size:', videoBlob?.size);
          console.log('🎥 Video blob type:', videoBlob?.type);
            
            if (videoBlob && videoBlob.size > 0) {
              setQuestionVideoBlob(videoBlob);
              videoBlobRetrieved = true;
              console.log('✅ Camera video blob set successfully');
              toast.success(`Camera recording saved! (${(videoBlob.size / 1024 / 1024).toFixed(1)} MB)`);
            } else {
              console.log('❌ Video blob is empty or null');
            }
          } catch (blobError) {
            console.error('❌ Error getting video blob:', blobError);
            toast.error('Error processing video recording');
          }
        });
      } catch (stopError) {
        console.error('❌ Error stopping video recording:', stopError);
      }
    }
    
    // Ensure no lingering mic tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    // Don't stop videoStreamRef.current here as it's the camera stream
    
    // No audio fallback needed
    
    // Fallback for video
    setTimeout(() => {
      if (!videoBlobRetrieved && videoRecorder && videoRecorder.getBlob) {
        try {
          const fallbackBlob = videoRecorder.getBlob();
          if (fallbackBlob && fallbackBlob.size > 0) {
            setQuestionVideoBlob(fallbackBlob);
          }
        } catch (fallbackError) {
          console.error('❌ Fallback video blob retrieval failed:', fallbackError);
        }
      }
    }, 2000);
    
    setIsRecording(false);
    setIsVideoRecording(false);
    
    // Answer timer cleanup removed - will be handled dynamically
  };

  useEffect(() => {
    stopQuestionRecordingRef.current = stopQuestionRecording;
  }, [stopQuestionRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleVideo = async () => {
    if (!isVideoOn) {
      // Try to turn camera back on (adaptive constraints for mobile)
      try {
        const videoConstraints = getAdaptiveVideoConstraints({
          preferMobile: isMobile,
          preferFrontCamera: isMobile,
        });
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsVideoOn(true);
        toast.success('Camera turned back on');
      } catch (error) {
        toast.error('Failed to turn camera back on');
      }
    } else {
      // Don't allow turning camera off
      toast.error('Camera must remain on during the interview!');
    }
  };

  const toggleAIAudio = () => {
    setAiAudioEnabled(!aiAudioEnabled);
    if (aiAudioEnabled) {
      speechSynthesis.cancel();
      setAiTTSLoading(false);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
    }
    toast.success(`AI audio ${aiAudioEnabled ? 'disabled' : 'enabled'}`);
  };

  if (isCreatingInterview) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating Your Interview</h2>
          <p className="text-gray-600 text-lg">Setting up your conversational interview session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-x-hidden flex flex-col">
      {/* Header - same style as Dashboard (bg #1e5da8) */}
      <header className="flex-shrink-0 bg-[#1e5da8] border-b relative z-10">
        <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
            <div className="min-w-0 flex-shrink-0 text-left">
              <h1 className="text-lg sm:text-xl font-semibold text-white truncate">ProValuate</h1>
              <p className="text-xs sm:text-sm text-white/90 hidden sm:block">Smart Interview Assessment Platform</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8 text-base sm:text-lg flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 text-white">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-white/90 flex-shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[220px] font-medium">{interviewData.candidateName}</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-white">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white/90 flex-shrink-0" />
                <span className={`font-semibold tabular-nums ${
                  timeRemaining <= 60 ? 'text-red-200 animate-pulse' : timeRemaining <= 120 ? 'text-yellow-200' : ''
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Time Warning Banner - readable on narrow screens */}
      {timeRemaining <= 120 && (
        <div className={`flex-shrink-0 w-full py-3 sm:py-4 px-4 sm:px-6 text-center transition-all duration-500 ${
          timeRemaining <= 60 
            ? 'bg-gradient-to-r from-red-600 to-red-700 text-white animate-pulse' 
            : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
        }`}>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <div className="font-semibold text-sm sm:text-lg break-words">
              {timeRemaining <= 60 
                ? '⚠️ INTERVIEW ENDING SOON! Please finish your current response.' 
                : '⚠️ Less than 2 minutes remaining in your interview!'}
            </div>
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
          </div>
          {timeRemaining <= 30 && (
            <div className="mt-2 text-sm opacity-90">
              Interview will automatically end in {timeRemaining} seconds
            </div>
          )}
        </div>
      )}

      {/* Main Interview Interface - fixed height on mobile so no page scroll; full-width camera on mobile */}
      <div className="flex-1 min-h-0 w-full min-w-0 px-0 py-1 sm:px-1 relative z-10 flex flex-col overflow-hidden bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-1 mb-1 flex-shrink-0 lg:mb-2">
          {/* AI Assistant Panel - fixed height on mobile so question never pushes content down */}
          <div className="lg:col-span-2 rounded-none sm:rounded-2xl overflow-hidden min-h-0 h-[26vh] max-h-[26vh] lg:h-[450px] lg:max-h-none lg:min-h-[450px] w-full">
            <div className="bg-sky-100 rounded-none sm:rounded-xl p-1 sm:p-1 h-full min-h-0 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Volume Button - hidden on mobile */}
              <button
                onClick={toggleAIAudio}
                className="absolute top-3 right-3 min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors z-20 hidden sm:flex items-center justify-center bg-[#1e5da8]/20 text-[#1e5da8] hover:bg-[#1e5da8]/30"
              >
                {aiAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <div className="w-full min-h-0 flex-1 flex items-center justify-center px-2 py-2 overflow-hidden">
                {aiPlaceholder ? (
                  <div className="w-full h-full min-h-0 flex items-center justify-center overflow-y-auto overflow-x-hidden">
                    <div className="w-full max-w-full bg-sky-100 rounded-lg px-3 py-2 sm:px-4 sm:py-3 my-auto max-h-[22vh] sm:max-h-[38vh] overflow-y-auto overflow-x-hidden">
                      <p className="text-black font-medium leading-relaxed break-words text-base sm:text-lg text-center">
                        {aiPlaceholder === 'welcome' && 'Welcome to Provaluate interview platform. Have a great interview!'}
                        {aiPlaceholder === 'generating_first' && `Generating your first question${'.'.repeat(loadingDots + 1)}`}
                        {aiPlaceholder === 'generating_next' && `Generating your next question${'.'.repeat(loadingDots + 1)}`}
                      </p>
                    </div>
                  </div>
                ) : aiSpeaking && aiMessage ? (
                  <div className="text-center w-full h-full min-h-0 flex items-center justify-center overflow-y-auto overflow-x-hidden">
                    <div className="inline-block text-left bg-sky-100 rounded-lg px-3 py-2 sm:px-4 sm:py-3 w-full max-w-full my-auto max-h-[22vh] sm:max-h-[38vh] overflow-y-auto overflow-x-hidden">
                      <p className="text-gray-900 font-medium leading-relaxed break-words text-base sm:text-lg">
                        {aiMessage}
                      </p>
                    </div>
                  </div>
                ) : aiSpeaking && !aiMessage ? (
                  <div className="text-center w-full">
                    <div className="flex items-end justify-center gap-1 mb-4 h-20">
                      {[...Array(15)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-gradient-to-t from-blue-400 to-blue-600 rounded-full transition-all duration-500 ease-in-out"
                          style={{ height: `${waveformHeights[i] || 42}px` }}
                        />
                      ))}
                    </div>
                    <div className="text-blue-700 text-base sm:text-lg font-medium mt-4">AI is speaking...</div>
                  </div>
                ) : aiMessage ? (
                  <div className="text-center w-full h-full min-h-0 flex items-center justify-center overflow-y-auto overflow-x-hidden">
                    <div className="inline-block text-left bg-sky-100 rounded-lg px-3 py-2 sm:px-4 sm:py-3 w-full max-w-full my-auto max-h-[22vh] sm:max-h-[38vh] overflow-y-auto overflow-x-hidden">
                      <p className="text-gray-900 font-medium leading-relaxed break-words text-base sm:text-lg">
                        {aiMessage}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Candidate Panel - Camera Video Card - full width on mobile, fixed height */}
          <div className="lg:col-span-3 rounded-none sm:rounded-2xl overflow-hidden min-h-0 h-[26vh] max-h-[26vh] lg:h-[450px] lg:max-h-none lg:min-h-[450px] w-full">
            <div className="bg-white rounded-none sm:rounded-xl p-0 sm:p-1 h-full min-h-0 w-full flex items-center justify-center overflow-hidden relative aspect-video lg:aspect-auto">
              {/* Camera Button - hidden on mobile */}
              <button
                onClick={toggleVideo}
                className="absolute top-3 right-3 min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors z-20 hidden sm:flex items-center justify-center bg-[#1e5da8]/20 text-[#1e5da8] hover:bg-[#1e5da8]/30"
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              
              {/* Camera Required Warning - Top Left Corner */}
              {!isVideoOn && (
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs z-20">
                  <AlertTriangle className="w-3 h-3" />
                  Camera Required
                </div>
              )}
              {isVideoOn ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full min-h-[180px] object-cover rounded-none sm:rounded-lg shadow-md lg:transform lg:scale-105 lg:hover:scale-110 transition-transform duration-300"
                  />
                  
                  {/* Countdown Overlay */}
                  {recordingCountdown > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 rounded-lg">
                      <div className="text-white text-9xl font-bold animate-ping">
                        {recordingCountdown}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <VideoOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <p className="text-red-700 font-medium">Camera is required</p>
                  <p className="text-gray-500 text-sm">Please turn on your camera to continue</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transcription - show only when new question is displayed (not while loading next question) */}
        {aiPlaceholder !== 'generating_next' && (
        <div className="relative mb-1 flex-shrink-0">
          <textarea
            ref={transcriptTextareaRef}
            value={transcript}
            onChange={(e) => {
              if (!answerSubmitted && !aiSpeaking) {
                setTranscript(e.target.value);
              }
            }}
            placeholder="Start speaking to see real-time transcription here..."
            disabled={answerSubmitted || aiSpeaking}
            className={`w-full rounded-xl p-3 pr-12 transition-all duration-300 text-base sm:text-lg leading-relaxed resize-none bg-sky-100 border border-sky-200 text-black placeholder:text-black ${
              aiSpeaking
                ? 'cursor-not-allowed opacity-90'
                : answerSubmitted 
                  ? 'cursor-not-allowed opacity-80'
                  : 'cursor-text focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200'
            } min-h-[90px] max-h-[120px] sm:min-h-[140px] sm:max-h-[180px]`}
            style={{ fontFamily: 'inherit' }}
          />
          <button
            onClick={() => setIsTranscriptDialogOpen(true)}
            className="absolute top-3 right-3 min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-sky-200 text-sky-800 hover:bg-sky-300 flex items-center justify-center transition-colors"
            title="View full transcript"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        )}

        {/* Written answer box (SQL/code/calculation) - show only when new question is displayed and requires it */}
        {aiPlaceholder !== 'generating_next' && currentQuestion?.requires_written_answer && (
          <div className="mb-2 flex-shrink-0">
            <label className="block text-sm font-medium text-sky-700 mb-1">
              Write your answer here (query, code, or calculation)
            </label>
            <textarea
              value={writtenAnswer}
              onChange={(e) => {
                if (!answerSubmitted && !aiSpeaking && !isRecording) setWrittenAnswer(e.target.value);
              }}
              placeholder={isRecording ? "Stop recording first, then write your query or answer here." : "Paste or type your SQL query, code snippet, or calculation. Speak first, then write here before submitting."}
              disabled={answerSubmitted || aiSpeaking || isRecording}
              className={`w-full rounded-xl p-3 text-base font-mono border text-black placeholder:text-sky-600 min-h-[100px] max-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed ${
                answerSubmitted || aiSpeaking || isRecording
                  ? 'bg-gray-100 border-gray-300 opacity-90'
                  : 'bg-sky-50 border-sky-200 focus:border-sky-400'
              }`}
            />
          </div>
        )}

        {/* Transcript Dialog - solid, no transparency */}
        <Dialog open={isTranscriptDialogOpen} onOpenChange={setIsTranscriptDialogOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[80vh] overflow-hidden bg-white border border-sky-200 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Full Transcript - Review & Edit</DialogTitle>
            </DialogHeader>
            <div className="p-4 bg-white border border-sky-200 rounded-lg">
              <textarea
                value={transcript}
                onChange={(e) => {
                  if (!answerSubmitted && !aiSpeaking) {
                    setTranscript(e.target.value);
                  }
                }}
                disabled={answerSubmitted || aiSpeaking}
                className={`w-full rounded-lg p-4 transition-all duration-300 text-base sm:text-lg leading-relaxed resize-none bg-sky-100 border border-sky-200 text-black placeholder:text-black ${
                  aiSpeaking
                    ? 'cursor-not-allowed opacity-90'
                    : answerSubmitted 
                      ? 'cursor-not-allowed opacity-80'
                      : 'cursor-text focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200'
                } min-h-[400px] max-h-[500px]`}
                style={{ fontFamily: 'inherit' }}
              />
              <div className="mt-3 text-xs text-center text-black">
                {aiSpeaking
                  ? 'AI is speaking. Transcript will be editable during your answer.'
                  : answerSubmitted 
                    ? 'Answer has been submitted.'
                    : 'You can edit your transcript in this expanded view.'
                }
              </div>
            </div>
          </DialogContent>
        </Dialog>





                 {/* Reserved space for question timer - flex-shrink-0; smaller on mobile so buttons stay visible */}
         <div className="min-h-[60px] sm:min-h-[120px] mb-1 flex-shrink-0 flex items-center justify-center">
           {!answerSubmitted && isQuestionTimerActive && questionTimeRemaining > 0 && (isRecording || currentQuestion?.requires_written_answer) && (
             <div className="w-full max-w-[88%] sm:max-w-2xl mx-auto">
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                   <Clock className="w-4 h-4 text-sky-500" />
                   <span className="text-sm font-medium text-sky-600">
                     Question Time: {formatTime(questionTimeRemaining)} / {formatTime(currentQuestionMaxTime)}
                   </span>
                 </div>
                 <span className="text-xs text-sky-600">
                   {Math.round((questionTimeRemaining / currentQuestionMaxTime) * 100)}% remaining
                 </span>
               </div>
               <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                 <div 
                   className="h-full transition-all duration-1000 ease-linear bg-gradient-to-r from-sky-500 to-sky-600"
                   style={{ 
                     width: `${(questionTimeRemaining / currentQuestionMaxTime) * 100}%`,
                     transition: 'width 1s linear'
                   }}
                 />
               </div>
               {questionTimeRemaining <= 30 && (
                 <div className="mt-2 text-sky-600 text-sm font-medium animate-pulse">
                   Time running out! Answer will auto-submit in {questionTimeRemaining} seconds
                 </div>
               )}
               {questionTimeRemaining <= 60 && questionTimeRemaining > 30 && (
                 <div className="mt-2 text-sky-600 text-sm font-medium">
                   Less than 1 minute remaining for this question
                 </div>
               )}
             </div>
           )}
         </div>



                 {/* Controls - flex-shrink-0 so always visible; no page scroll needed */}
         <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-3 sm:gap-4 py-2 sm:py-3 lg:py-0 lg:pb-2 bg-white border-t border-gray-200 px-2 sm:-mx-1 sm:px-2">
           
                                           {/* Stop Recording Button - only show when recording */}
             {isRecording && (
               <button
                 onClick={stopQuestionRecording}
                 disabled={!isVideoOn || isSubmitting}
                 className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-3 bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white rounded-xl font-medium transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <MicOff className="w-5 h-5" />
                 Stop Recording
               </button>
             )}
           
                       <button
              onClick={handleSubmitAnswer}
              disabled={!audioBlob || isSubmitting || !isVideoOn || answerSubmitted || (currentQuestion?.requires_written_answer === true && !writtenAnswer?.trim())}
              className={`flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                answerSubmitted || submissionStatus === 'submitted'
                  ? 'bg-[#1e5da8] text-white cursor-default animate-pulse'
                  : isSubmitting
                    ? 'bg-[#1e5da8]/80 text-white cursor-wait'
                    : 'bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white'
              }`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
              {answerSubmitted 
                ? 'Submitted' 
                : isSubmitting 
                  ? submissionStatus === 'uploading' 
                    ? 'Uploading...' 
                    : submissionStatus === 'processing'
                      ? 'Processing...'
                      : submissionStatus === 'submitted'
                        ? 'Submitted'
                        : 'Submitting...'
                  : 'Submit Answer'
              }
              {(!audioBlob || isSubmitting || !isVideoOn) && !answerSubmitted && (
                <span className="text-xs ml-2">
                  {!audioBlob ? '(No audio)' : !isVideoOn ? '(Camera off)' : ''}
                </span>
              )}
            </button>
            
            
            {/* End Interview Button - same colour as Submit */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to end the interview? This action cannot be undone.')) {
                  terminateInterview('Manual termination by candidate willingly');
                }
              }}
              className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-3 bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white rounded-xl font-medium transition-all"
            >
              <X className="w-5 h-5" />
              End Interview
            </button>

         </div>

      </div>
    </div>
  );
};

export default ConversationalInterview;