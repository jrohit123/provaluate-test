import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import RecordRTC from 'recordrtc';
import { useInterview, interviewActions } from '@/contexts/InterviewContext';
import { API_CONFIG, apiCall } from '@/constants/api';
import { INTERVIEW_CONSTANTS } from '@/constants/interview';
import { supabase } from '@/integrations/supabase/client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Send,
  Clock,
  User,
  Bot,
  Volume2,
  VolumeX,
  AlertTriangle,
  Camera,
  CheckCircle,
  X
} from 'lucide-react';

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
  const [screenStream, setScreenStream] = useState(null);
  const [screenPermissionGranted, setScreenPermissionGranted] = useState(false);
  
  // AI Assistant states
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiAudioEnabled, setAiAudioEnabled] = useState(true);
  const [isInterviewInitialized, setIsInterviewInitialized] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [isWelcomeMessage, setIsWelcomeMessage] = useState(false);
  const [spokenQuestions, setSpokenQuestions] = useState(new Set());
  const [spokenFeedback, setSpokenFeedback] = useState(new Set());
  const [questionFinishedSpeaking, setQuestionFinishedSpeaking] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [answerTimer, setAnswerTimer] = useState(0);
  const [isAnswerTimerActive, setIsAnswerTimerActive] = useState(false);
  const [hasRequestedScreenPermissions, setHasRequestedScreenPermissions] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>([]);
  const [speechPattern, setSpeechPattern] = useState<number[]>([]);
  const [patternIndex, setPatternIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  
  const getVoiceId = useCallback(
    (voice: SpeechSynthesisVoice) => `${voice.name || 'unknown'}::${voice.lang || 'unknown'}`,
    []
  );

  const selectedVoice = useMemo(
    () => (selectedVoiceId ? availableVoices.find((voice) => getVoiceId(voice) === selectedVoiceId) || null : null),
    [availableVoices, selectedVoiceId, getVoiceId]
  );

  const assignVoiceToUtterance = useCallback(
    (utterance: SpeechSynthesisUtterance) => {
      if (!utterance) return;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        return;
      }
      if (availableVoices.length > 0 && !utterance.voice) {
        utterance.voice = availableVoices[0];
      }
    },
    [availableVoices, selectedVoice]
  );

  // Per-question timer states
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(0);
  const [currentQuestionMaxTime, setCurrentQuestionMaxTime] = useState(0);
  const [isQuestionTimerActive, setIsQuestionTimerActive] = useState(false);
  
  // Refs
  const intervalRef = useRef(null);
  const answerTimerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const hasSpokenWelcomeRef = useRef(false);
  const hasSpokenFirstQuestionRef = useRef(false);
  const hasSpokenCompletionRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const finishInterviewRef = useRef(null);
  const speakWithAIRef = useRef(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedVoiceId = window.localStorage.getItem('selectedAiVoiceId');
      if (storedVoiceId) {
        setSelectedVoiceId(storedVoiceId);
      }
    } catch (error) {
      console.warn('Unable to read stored AI voice selection:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    lastTabViolationRef.current = now;
    tabChangeCountRef.current += 1;
    const currentCount = tabChangeCountRef.current;
    console.log(`⚠️ Tab change detected via ${reason} (${currentCount}/${MAX_TAB_CHANGES})`);

    if (currentCount === 1) {
      toast('⚠️ Warning: Stay on this tab during the interview!', {
        icon: '⚠️',
        duration: 4000,
        style: {
          background: '#fbbf24',
          color: '#92400e',
        },
      });
    } else if (currentCount === 2) {
      toast('🚨 Final Warning: Do not switch tabs! Interview will be terminated.', {
        icon: '🚨',
        duration: 4000,
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
    } else if (currentCount > MAX_TAB_CHANGES) {
      console.log('🚫 Too many tab changes, terminating interview');
      toast.error('Interview terminated due to tab switching');
      terminateInterview('Candidate switched tabs multiple times during interview');
    }

    if (tabWarningTimeoutRef.current) {
      clearTimeout(tabWarningTimeoutRef.current);
      tabWarningTimeoutRef.current = null;
    }
  }, [terminateInterview]);
  
  // Web Speech Refs - Single source of truth
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const webSpeechActiveRef = useRef(false);

  // Web Speech Implementation
  const initWebSpeech = useCallback(() => {
    if (recognitionRef.current) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser.');
      toast.error('Live transcription not supported in this browser.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    // Chrome-specific optimizations
    if ('webkitSpeechRecognition' in window) {
      recognition.interimResults = true;
      recognition.continuous = true;
    }

    let accumulatedFinal = '';
    let restartTimeout: NodeJS.Timeout | null = null;
    let lastRestartTime = 0;
    const MIN_RESTART_INTERVAL = 100;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          accumulatedFinal += res[0].transcript + ' ';
          console.log('✅ Final transcript segment:', res[0].transcript);
        } else {
          interim += res[0].transcript;
        }
      }
      const liveText = (accumulatedFinal + interim).trim();
      setTranscript(liveText);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      const errorType = e?.error || 'unknown';
      console.warn('SpeechRecognition error:', errorType, e);
      
      switch (errorType) {
        case 'network':
          console.log('🔄 Network error - will attempt restart');
          break;
        case 'no-speech':
          console.log('⏸️ No speech detected - recognition will continue');
          break;
        case 'aborted':
          console.log('⚠️ Recognition aborted - will restart if still active');
          break;
        case 'audio-capture':
          console.error('❌ Audio capture error - microphone issue');
          toast.error('Microphone error. Please check your microphone permissions.');
          webSpeechActiveRef.current = false;
          break;
        case 'not-allowed':
          console.error('❌ Microphone permission denied');
          toast.error('Microphone permission denied. Please allow microphone access.');
          webSpeechActiveRef.current = false;
          break;
        default:
          console.warn('⚠️ Unknown speech recognition error:', errorType);
      }
    };

      setSelectedVoiceId((currentId) => {
        if (currentId && sortedVoices.some((voice) => getVoiceId(voice) === currentId)) {
          return currentId;
        }

        let storedId = '';
        try {
          storedId = window.localStorage.getItem('selectedAiVoiceId') || '';
        } catch (error) {
          console.warn('Unable to access stored AI voice selection:', error);
          storedId = '';
        }

        if (storedId && sortedVoices.some((voice) => getVoiceId(voice) === storedId)) {
          return storedId;
        }

        return sortedVoices.length > 0 ? getVoiceId(sortedVoices[0]) : currentId;
      });
    };

    // Add periodic health check
    const healthCheckInterval = setInterval(() => {
      if (webSpeechActiveRef.current) {
        console.log('🏥 Health check - recognition active:', webSpeechActiveRef.current);
      }
    }, 5000);

    // Store health check interval for cleanup
    (recognition as any)._healthCheckInterval = healthCheckInterval;

    recognitionRef.current = recognition;
  }, []);

  const startWebSpeech = useCallback(() => {
    initWebSpeech();
    if (!recognitionRef.current) return;
    
    try {
      webSpeechActiveRef.current = true;
      
      // Reset any previous state
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore if already stopped
        }
      }
      
      // Small delay to ensure clean start
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
          console.log('✅ Web Speech started successfully');
        } catch (error: any) {
          if (!error.message?.includes('already started')) {
            console.error('❌ Failed to start Web Speech:', error);
          }
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error starting Web Speech:', error);
    }
  }, [initWebSpeech]);

  const stopWebSpeech = useCallback(() => {
    webSpeechActiveRef.current = false;
    
    // Clean up health check interval
    if (recognitionRef.current && (recognitionRef.current as any)._healthCheckInterval) {
      clearInterval((recognitionRef.current as any)._healthCheckInterval);
      (recognitionRef.current as any)._healthCheckInterval = null;
    }
    
    try {
      recognitionRef.current?.stop();
      console.log('✅ Web Speech stopped successfully');
    } catch (error) {
      console.warn('⚠️ Error stopping Web Speech:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebSpeech();
    };
  }, [getVoiceId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
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
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }

    toast.success('⏰ Interview time completed! Finishing interview...', { duration: 1500 });

    // CRITICAL FIX: Immediate finalization with minimal delay
    setTimeout(() => {
      const finalizeInterview = async () => {
        try {
          if (finishInterviewRef.current) {
            await finishInterviewRef.current();
          }
        } catch (error) {
          console.error('❌ Error auto-finishing interview:', error);
          toast.error('Failed to finish interview');
          // Force navigation even on error
          navigate('/dashboard');
        }
      };

      finalizeInterview();
    }, 500);

  }, [isRecording, isVideoRecording, navigate, screenStream, stopWebSpeech]);

  const handleQuestionTimerEnd = useCallback(() => {
    console.log('⏰ Question timer expired, auto-advancing...');
    setIsQuestionTimerActive(false);
    setQuestionTimerSeconds(0);

    // CRITICAL FIX: Stop recording first, then auto-submit
    if (!isSubmitting && !answerSubmitted && isRecording) {
      console.log('🔄 Question time expired - stopping recording and auto-submitting');

      // Stop recording first
      if (stopQuestionRecordingRef.current) {
        stopQuestionRecordingRef.current();
      }
    } catch (error) {
      console.warn('Unable to persist AI voice selection:', error);
    }
  }, [selectedVoiceId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'selectedAiVoiceId') {
        setSelectedVoiceId(event.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
    // Reset answer submitted state for new interview
    setAnswerSubmitted(false);
    setSubmissionStatus('idle');
    // Reset screen permissions flag for new interview
    setHasRequestedScreenPermissions(false);
    
         // Use a more robust initialization approach
     const initializeInterview = async () => {
       try {
         // Load interview data first
         await loadInterviewData();
         // Initialize camera
         await initializeCamera();
        // Initialize audio worklet
        await initializeAudio();
         // Request screen permissions immediately - before welcome message
         console.log('🖥️ Requesting screen permissions before interview starts...');
         await requestScreenPermissions();
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
      // Reset spoken tracking
      setSpokenQuestions(new Set());
      setSpokenFeedback(new Set());
    };
  }, [interviewData.interviewId]); // Simplified - functions defined below

  // AI Text-to-Speech
  const speakWithAI = useCallback(
    (text: string) => {
      if (!text) {
        return;
      }

      console.log('🎤 speakWithAI called with text:', text);
      console.log('🎤 aiAudioEnabled:', aiAudioEnabled);

      if (!aiAudioEnabled) {
        console.log('❌ AI audio is disabled, not speaking');
        return;
      }

      if (!('speechSynthesis' in window)) {
        console.log('❌ Speech synthesis not available');
        setAiSpeaking(false);
        setQuestionFinishedSpeaking(false);
        return;
      }

      const isQuestion = /question/i.test(text);
      const isWelcome = /(welcome|hello)/i.test(text);
      const isCompletion = /(thank you|completed|appreciate)/i.test(text);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      utterance.onstart = () => {
        console.log(
          '🎤 Speech started for:',
          text.slice(0, 50) + (text.length > 50 ? '...' : '')
        );
        setAiSpeaking(true);
        if (isQuestion) {
          setQuestionFinishedSpeaking(false);
        }
      };

      utterance.onend = () => {
        console.log(
          '🎤 Speech ended for:',
          text.slice(0, 50) + (text.length > 50 ? '...' : '')
        );
        setAiSpeaking(false);

        if (isQuestion && !isWelcome && !isCompletion) {
          console.log('🎯 Question finished speaking — countdown can start');
          setQuestionFinishedSpeaking(true);
        } else {
          setQuestionFinishedSpeaking(false);
        }

        const queue = speakQueueRef.current;
        queue.shift();
        if (queue.length > 0) {
          window.speechSynthesis.speak(queue[0]);
        }
      };

      utterance.onerror = (event) => {
        console.error('❌ Speech synthesis error:', event);
        setAiSpeaking(false);
        setQuestionFinishedSpeaking(false);

        const queue = speakQueueRef.current;
        queue.shift();
        if (queue.length > 0) {
          window.speechSynthesis.speak(queue[0]);
        }

        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('ai_stopped_speaking', {
            interview_id: interviewData.interviewId
          });
          console.log('📡 Emitted ai_stopped_speaking event (error case)');
        }
      };
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
      console.log('🗣️ Speech synthesis started for:', text.slice(0, 50) + (text.length > 50 ? '...' : ''));
    } else {
      console.log('❌ Speech synthesis not available');
      // Fallback: just show the message
      setAiSpeaking(false);
    }
  }, [aiAudioEnabled, aiSpeaking, assignVoiceToUtterance]);

      const queue = speakQueueRef.current;
      queue.push(utterance);

      if (queue.length === 1) {
        window.speechSynthesis.speak(utterance);
        console.log(
          '🗣️ Speech synthesis started for:',
          text.slice(0, 50) + (text.length > 50 ? '...' : '')
        );
      } else {
        console.log('🗂️ Queued speech synthesis item. Queue length:', queue.length);
      }
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
      // Reset screen permissions flag
      setHasRequestedScreenPermissions(false);
      
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.FINISH_INTERVIEW}/${interviewData.interviewId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // Simple completion message for candidates (no scores)
        const completionMessage = `Thank you, ${interviewData.candidateName}! You have successfully completed your ${interviewData.position} interview. We appreciate your time and thoughtful responses today. Our team will review your interview and get back to you soon. Good luck with your application!`;
        
        // Only speak completion message once
        if (!hasSpokenCompletionRef.current) {
          console.log('🎤 Speaking completion message:', completionMessage);
          try {
            if (speakWithAIRef.current) {
              speakWithAIRef.current(completionMessage);
            } else {
              console.log('⚠️ speakWithAIRef not ready, using direct call');
              speakWithAI(completionMessage);
            }
          } catch (speechError) {
            console.error('❌ Error speaking completion message:', speechError);
            // Fallback: just show the message without speaking
          }
          hasSpokenCompletionRef.current = true;
          
          // Wait for completion message to finish before navigating
          const completionTimer = setTimeout(() => {
            console.log('🏁 Navigating to completion page after completion message...');
            toast.success(INTERVIEW_CONSTANTS.SUCCESS.INTERVIEW_COMPLETED);
            
            // Reset initialization flag for next interview
            hasInitializedRef.current = false;
            
            // Navigate to simple completion page (no scores)
            navigate('/candidate-completion', {
              state: {
                interviewId: interviewData.interviewId,
                candidateName: interviewData.candidateName,
                position: interviewData.position
              }
            });
          }, INTERVIEW_CONSTANTS.TIMEOUTS.COMPLETION_NAVIGATION);
          
          // Store timer reference for cleanup
          completionTimerRef.current = completionTimer;
                  } else {
                      // If already spoken, navigate immediately (no scores shown to candidate)
          toast.success(INTERVIEW_CONSTANTS.SUCCESS.INTERVIEW_COMPLETED);
          hasInitializedRef.current = false;
          navigate('/candidate-completion', {
            state: {
              interviewId: interviewData.interviewId,
              candidateName: interviewData.candidateName,
              position: interviewData.position
            }
          });
        }
      }
    } catch (error) {
      console.error('Error finishing interview:', error);
      toast.error('Failed to finish interview');
    }
     }, [interviewData.interviewId, navigate, interviewData.candidateName, interviewData.position, speakWithAI, isRecording]);

  const generateNextQuestion = useCallback(async () => {
    // Prevent multiple calls if already generating or AI is speaking
    if (isGeneratingQuestion || aiSpeaking) {
      console.log('⚠️ Already generating question or AI is speaking, skipping');
      return;
    }
    
    setIsGeneratingQuestion(true);
    
    try {
      console.log('🔄 Generating next question for index:', currentQuestionIndex + 1);
      console.log('🔍 Interview ID:', interviewData.interviewId);
      console.log('🔍 Current question index:', currentQuestionIndex);
      
      const response = await apiCall(API_CONFIG.ENDPOINTS.GENERATE_QUESTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_id: interviewData.interviewId,
          current_question_index: currentQuestionIndex + 1
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

        // CRITICAL FIX: Reset transcript and Web Speech accumulator before next question starts
        setTranscript('');
        stopWebSpeech();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {
            console.log('⚠️ Error aborting recognition:', e);
          }
          recognitionRef.current = null;
        }
        webSpeechActiveRef.current = false;

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
        
        // Keep screen permissions state - don't reset this
        
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
        
        // Set transition message first
        setAiMessage("Let's move to the next question...");
        
        // Only speak if this question hasn't been spoken before and we have valid text
        if (!spokenQuestions.has(questionId) && cleanQuestionText && cleanQuestionText !== 'Question data unavailable') {
          // Timer will be initialized when recording starts, not when question is spoken
          console.log('⏰ Timer will start when recording begins');
          
          // Set question finished speaking to false initially
          setQuestionFinishedSpeaking(false);
          
          // First speak transition message, then show question and speak it
          setTimeout(() => {
            console.log('🎤 Speaking transition message...');
            speakWithAI("Let's move to the next question...");
            
            // After transition message, show question and speak it
            setTimeout(() => {
              console.log('🎤 Showing question and speaking:', questionMessage);
              setAiMessage(questionMessage);
              speakWithAI(questionMessage);
              setSpokenQuestions(prev => {
                const newSet = new Set([...prev, questionId]);
                console.log('📝 Updated spoken questions:', Array.from(newSet));
                return newSet;
              });
            }, 2000); // 2 seconds after transition message
          }, 500); // 500ms delay to ensure smooth transition
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
          toast.error(`Failed to generate next question: ${errorData.message || 'Server error'}`);
        }
      }
      
    } catch (error) {
      console.error('Error generating question:', error);
      toast.error('Failed to generate next question');
    } finally {
      setIsGeneratingQuestion(false);
    }
  }, [interviewData.interviewId, currentQuestionIndex, aiSpeaking, isGeneratingQuestion]);

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
       
      // Require transcript from Web Speech API
      if (!cleanedTranscript || !cleanedTranscript.trim()) {
        toast.error('No speech captured. Please speak your answer before submitting.');
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
               
               // Conversation history removed to reduce complexity
               
               // Reset question video after successful submission
               setQuestionVideoBlob(null);
               setQuestionVideoDuration(0);
               
               // Set answer submitted state briefly for visual feedback
               console.log('✅ Setting answerSubmitted to true');
               setAnswerSubmitted(true);
               setSubmissionStatus('submitted');
               
               // Show brief success toast for user feedback
               toast.success('✅ Answer submitted successfully!', {
                 duration: 2000,
                 style: {
                   background: '#10B981',
                   color: 'white',
                   fontSize: '14px',
                   fontWeight: '500'
                 }
               });
               
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
                 toast.error(`Submission failed, retrying... (${retryCount}/${maxRetries})`);
                 
                 // Wait a bit before retry
                 await new Promise(resolve => setTimeout(resolve, 1000));
                 return attemptSubmission();
               } else {
                 toast.error('Failed to submit answer');
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
     }, [transcript, audioBlob, isVideoOn, currentQuestion, currentQuestionIndex, interviewData.interviewId, spokenFeedback, generateNextQuestion, interviewData.candidateName, isSubmitting, questionVideoBlob]);

  // Assign refs after functions are defined
  useEffect(() => {
    speakWithAIRef.current = speakWithAI;
    finishInterviewRef.current = finishInterview;
  }, [speakWithAI, finishInterview]);

  useEffect(() => {
    handleSubmitAnswerRef.current = handleSubmitAnswer;
  }, [handleSubmitAnswer]);

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
      toast('⚠️ 30 seconds remaining! Please finish your current response.', {
        icon: '⚠️',
        style: {
          background: '#fbbf24',
          color: '#92400e'
        }
      });
      lastInterviewWarningRef.current = 30;
    } else if (timeRemaining <= 60 && lastInterviewWarningRef.current !== 60) {
      toast('⚠️ 1 minute remaining in your interview!', {
        icon: '⚠️',
        style: {
          background: '#fbbf24',
          color: '#92400e'
        }
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

    if (questionTimeRemaining <= 30 && lastQuestionWarningRef.current !== 30) {
      toast('⚠️ Time running out! Answer will auto-submit soon.', {
        icon: '⚠️',
        style: {
          background: '#fbbf24',
          color: '#92400e'
        }
      });
      lastQuestionWarningRef.current = 30;
    } else if (questionTimeRemaining <= 60 && lastQuestionWarningRef.current !== 60) {
      toast('⚠️ 1 minute remaining for this question.', {
        icon: '⚠️',
        style: {
          background: '#fbbf24',
          color: '#92400e'
        }
      });
      lastQuestionWarningRef.current = 60;
    }
  }, [isQuestionTimerActive, questionTimeRemaining]);
  useEffect(() => {
    if (!isVideoOn) {
      toast.error('Camera must remain on during the interview!');
      const timer = setTimeout(() => {
        if (!isVideoOn) {
          terminateInterview('Camera turned off');
        }
      }, 5000);

      return () => clearTimeout(timer);
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
      toast('⚠️ Stay focused on the interview window!', {
        icon: '⚠️',
        duration: 3000,
        style: {
          background: '#fbbf24',
          color: '#92400e',
        },
      });

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
        toast('🚨 STOP! Pressing ESC will exit fullscreen and terminate your interview!', {
          icon: '🚨',
          duration: 2000,
          style: {
            background: '#ef4444',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 'bold',
          },
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
      console.log('🖥️ Starting screen recording...');
      console.log('🔍 Current state - isRecording:', isRecording, 'isVideoOn:', isVideoOn, 'screenPermissionGranted:', screenPermissionGranted, 'hasRequestedScreenPermissions:', hasRequestedScreenPermissions);
      
      // Check if screen permissions are already granted
      if (!screenPermissionGranted || !screenStream) {
        toast.error('❌ Screen recording permissions required. Please allow screen access first.');
        return;
      }
      
      // Start timer for current question
      if (currentQuestionMaxTime > 0) {
        console.log('⏰ Starting timer for current question:', currentQuestionMaxTime, 'seconds');
        setQuestionTimerSeconds(currentQuestionMaxTime);
        setIsQuestionTimerActive(true);
      } else {
        // Initialize timer if not set
          if (interviewData?.interview_mode === 'structured') {
          console.log('⏰ Structured interview - timer should come from API response');
          } else {
            initializeTimerForExistingQuestion(interviewData.position, currentQuestionIndex);
        }
      }
      
      console.log('✅ Using approved screen stream for recording');
      
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
      
      // Add video tracks from screen stream
      screenStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      if (micStream) {
        micStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }
      
      console.log('🎬 Combined stream created with video tracks:', combinedStream.getVideoTracks().length);
      console.log('🎤 Combined stream created with audio tracks:', combinedStream.getAudioTracks().length);
      
      // Create recorder using the combined stream (video + audio)
      const questionVideoRecorder = new RecordRTC(combinedStream, {
        type: 'video',
        mimeType: 'video/webm',
        recorderType: RecordRTC.MediaStreamRecorder,
        quality: 7,                    // Balanced quality for recordings
        frameRate: 20,                 // Balanced 20fps for smooth recording
        disableLogs: false,
        videoBitsPerSecond: INTERVIEW_CONSTANTS.MEDIA.VIDEO_BITRATE,
        timeSlice: INTERVIEW_CONSTANTS.MEDIA.TIME_SLICE,
        ondataavailable: function(blob) {
          console.log('🖥️ Combined video+audio chunk available:', blob.type, blob.size);
        }
      });
      
      // Start video recorder
      questionVideoRecorder.startRecording();
      console.log('🖥️ Video recording started');
      
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
      if (!hasRequestedScreenPermissions) {
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
      toast.success('🖥️ Screen + Camera recording with your microphone audio started!');
      
      // Web Speech is active for voice capture; no separate audio recorder toast
      
      // Do not use socket transcription; Web Speech handles transcription
      
    } catch (error) {
      console.error('❌ Automatic screen recording start error:', error);
      toast.error('❌ Failed to start screen recording. Please refresh and try again.');
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
        
        // Welcome message and first question will be handled after screen access is granted
        console.log('🔍 Interview data loaded, waiting for screen access to start welcome message');
        
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
    
    if (aiSpeaking && !aiMessage?.includes('Question') && speechPattern.length > 0) {
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

  // Start timer when recording begins
  useEffect(() => {
    if (isRecording && currentQuestionMaxTime > 0 && !isQuestionTimerActive) {
      console.log('⏰ Recording started, starting question timer');
      console.log('⏰ Timer values - maxTime:', currentQuestionMaxTime, 'remaining:', questionTimeRemaining);
      
      // CRITICAL FIX: Ensure timer starts with fresh values
      if (questionTimeRemaining !== currentQuestionMaxTime) {
        console.log('⏰ Resetting timer to max time before starting');
        setQuestionTimerSeconds(currentQuestionMaxTime);
      }
      
      setIsQuestionTimerActive(true);
    }
  }, [isRecording, currentQuestionMaxTime, isQuestionTimerActive, questionTimeRemaining]);

  // Refs for cleanup
  const recordingDelayTimeoutRef = useRef<number | null>(null);
  const recordingCountdownIntervalRef = useRef<number | null>(null);

  // Lint-safe effect: starts countdown only after AI fully finished speaking
  useEffect(() => {
    // Only run when questionFinishedSpeaking flips to true AND aiSpeaking is false
    if (questionFinishedSpeaking && !aiSpeaking && !isRecording && !isSubmitting) {
      // Small stabilization delay to avoid React batching/race issues
      recordingDelayTimeoutRef.current = window.setTimeout(() => {
        console.log('✅ AI finished speaking (stable) — starting 3s countdown');

        // Start the per-question timer once (if you want it to start immediately)
        if (currentQuestionMaxTime > 0) {
          setQuestionTimerSeconds(currentQuestionMaxTime);
          setIsQuestionTimerActive(true);
          console.log('⏰ Question timer set to', currentQuestionMaxTime);
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
    currentQuestionMaxTime,
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      streamRef.current = stream;
      setIsVideoOn(true);
      
      // Monitor camera status
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        setIsVideoOn(false);
      };
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Camera access required for interview');
      navigate('/setup');
    }
  }, [navigate]);

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
        toast('⚠️ Please allow fullscreen for the interview', {
          icon: '⚠️',
          duration: 4000,
          style: {
            background: '#fbbf24',
            color: '#92400e',
          },
        });
      } else {
        toast.error('Fullscreen is required. Interview will be terminated.');
        setTimeout(() => {
          terminateInterview('Fullscreen permission denied multiple times');
        }, 2000);
      }
    }
  }, [fullscreenAttempts, terminateInterview]);

  // Request screen sharing permissions once at the start
  const requestScreenPermissions = useCallback(async () => {
    try {
      console.log('🖥️ Requesting screen sharing permissions...');

      const displayMediaOptions: any = {
        video: {
          displaySurface: 'browser',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true,
        preferCurrentTab: false
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      console.log('✅ Screen stream obtained successfully');
      setScreenStream(stream);
      setScreenPermissionGranted(true);
      setHasRequestedScreenPermissions(true);

      toast.success('✅ Screen access granted! Starting interview...');

      // Start welcome message after screen access is granted
      setTimeout(() => {
        if (!hasSpokenWelcomeRef.current) {
          console.log('🎤 Starting welcome message and requesting fullscreen...');

          requestFullscreen();

          const welcomeMessage = `Hello ${interviewData.candidateName}! Welcome to your ${interviewData.position} interview. I'm excited to meet you today and learn more about your experience and skills. This is a great opportunity to showcase your talents, so take a deep breath and remember - you've got this! I'll be your AI interviewer today, and I'm here to make this experience as comfortable as possible for you. All the best for your interview! Let's begin with our first question.`;

          // Speak welcome message
          if (aiAudioEnabled && 'speechSynthesis' in window) {
            console.log('🎤 Setting aiSpeaking to true and aiMessage to welcome message');

            // Create speech pattern for the welcome message
            const pattern = createSpeechPattern(welcomeMessage);
            setSpeechPattern(pattern);
            setPatternIndex(0);

            setAiSpeaking(true);
            setAiMessage(welcomeMessage);
            const utterance = new SpeechSynthesisUtterance(welcomeMessage);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;

            utterance.onend = () => {
              console.log('🎤 Welcome message finished, starting first question...');
              setAiSpeaking(false);
              setAiMessage('');
              hasSpokenWelcomeRef.current = true;
              setIsInterviewTimerActive(true);

              // Start first question after welcome
              setTimeout(() => {
                if (currentQuestion && (currentQuestion.question || currentQuestion.question_text)) {
                  const questionText = currentQuestion.question || currentQuestion.question_text;
                  const questionMessage = `Question 1: ${questionText}`;

                  console.log('📝 FIRST: Displaying question and keeping it visible:', questionMessage);
                  setAiMessage(questionMessage);
                  setIsWelcomeMessage(false);

                  hasSpokenFirstQuestionRef.current = true;

                  setTimeout(() => {
                    console.log('🎤 THEN: Speaking question after display');
                    speakWithAI(questionMessage);
                  }, 500);
                }
              }, 1000);
            };

            utterance.onerror = (error) => {
              console.error('❌ Error speaking welcome message:', error);
              setAiSpeaking(false);
              hasSpokenWelcomeRef.current = true;
              setIsInterviewTimerActive(true);
            };

            speechSynthesis.speak(utterance);
          } else {
            console.log('🎤 Speech synthesis unavailable or disabled, skipping audio welcome');
            setAiSpeaking(false);
            setAiMessage('');
            hasSpokenWelcomeRef.current = true;
            setIsInterviewTimerActive(true);
          }
        }
      }, 1000);

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('⚠️ User stopped screen sharing');
          setScreenPermissionGranted(false);
          setScreenStream(null);
          setIsFullscreen(false);
          toast('⚠️ Screen sharing stopped. Interview will be terminated.', {
            icon: '⚠️',
            style: {
              background: '#fbbf24',
              color: '#92400e',
            },
          });

          // IMPROVEMENT: Auto-terminate if screen sharing stops
          setTimeout(() => {
            terminateInterview('Screen sharing stopped by candidate');
          }, 3000);
        };
      }

    } catch (error: any) {
      console.error('❌ Screen sharing permission denied:', error);
      setScreenPermissionGranted(false);
      setScreenStream(null);
      if (error?.name === 'NotAllowedError') {
        toast.error('❌ Screen sharing permission denied. Interview cannot proceed.');
        setTimeout(() => {
          terminateInterview('Screen sharing permission denied');
        }, 2000);
      } else {
        toast.error('❌ Screen sharing not supported in this browser.');
      }
    }
  }, [aiAudioEnabled, currentQuestion, interviewData, requestFullscreen, speakWithAI, terminateInterview]);

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

  // Disable socket-started transcription; Web Speech is the single source of truth

  // Cleanup effect for screen stream when component unmounts
  useEffect(() => {
    return () => {
      // Clean up screen stream when component unmounts
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
        setScreenPermissionGranted(false);
      }
    };
  }, [screenStream]);

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
    // Stop the question timer immediately when recording stops
    console.log('⏰ Stopping question timer - recording stopped manually');
    setIsQuestionTimerActive(false);
    
    // CRITICAL FIX: Reset timer values to prevent carryover to next question
    console.log('⏰ Resetting timer values for next question');
    setQuestionTimerSeconds(0); // Reset to 0 so next question starts fresh
    
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
          console.log('🖥️ Retrieved screen video blob:', videoBlob);
          console.log('🖥️ Video blob size:', videoBlob?.size);
          console.log('🖥️ Video blob type:', videoBlob?.type);
            
            if (videoBlob && videoBlob.size > 0) {
              setQuestionVideoBlob(videoBlob);
              videoBlobRetrieved = true;
              console.log('✅ Screen video blob set successfully');
              toast.success(`✅ Screen recording saved! (${(videoBlob.size / 1024 / 1024).toFixed(1)} MB)`);
            } else {
              console.log('❌ Video blob is empty or null');
            }
          } catch (blobError) {
            console.error('❌ Error getting video blob:', blobError);
            toast.error('❌ Error processing video recording');
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
    // The screen stream is managed separately and should persist
    
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
      // Try to turn camera back on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
      speechSynthesis.cancel(); // Stop current speech
    }
    toast.success(`AI audio ${aiAudioEnabled ? 'disabled' : 'enabled'}`);
  };

  if (isCreatingInterview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Creating Your Interview</h2>
          <p className="text-gray-300 text-lg">Setting up your conversational interview session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Header */}
      <div className="glass border-b border-white/10 relative z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center animate-pulse shadow-lg">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Conversational AI Interview</h1>
                  <p className="text-blue-200 text-sm">Live AI Assistant Interview Session</p>
                </div>
              </div>
              
              <div className="hidden lg:flex items-center gap-8 text-sm">
                <div className="flex items-center gap-3 text-gray-200">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">{interviewData.candidateName}</div>
                    <div className="text-xs text-gray-400">Candidate</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-200">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    timeRemaining <= 60 
                      ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' 
                      : timeRemaining <= 120 
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                  }`}>
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className={`font-semibold transition-all duration-300 ${
                      timeRemaining <= 60 
                        ? 'text-red-300 animate-pulse' 
                        : timeRemaining <= 120 
                          ? 'text-yellow-300' 
                          : 'text-white'
                    }`}>
                      {formatTime(timeRemaining)}
                    </div>
                    <div className="text-xs text-gray-400">Time Remaining</div>
                    {/* Time warning indicators */}
                    {timeRemaining <= 60 && (
                      <div className="text-xs text-red-400 font-medium animate-pulse">
                        ⚠️ Time running out!
                      </div>
                    )}
                    {timeRemaining <= 120 && timeRemaining > 60 && (
                      <div className="text-xs text-yellow-400 font-medium">
                        ⚠️ Less than 2 minutes
                      </div>
                    )}
                    
                    {/* Time progress bar */}
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          timeRemaining <= 60 
                            ? 'bg-red-500' 
                            : timeRemaining <= 120 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ 
                          width: `${Math.max(0, (timeRemaining / (interviewData.duration * 60)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Answer Timer Display */}
                  {isAnswerTimerActive && answerTimer > 0 && (
                    <div className="flex items-center gap-3 text-gray-200">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                        answerTimer <= 30 
                          ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' 
                          : answerTimer <= 60 
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                            : 'bg-gradient-to-r from-green-500 to-emerald-500'
                      }`}>
                        <Mic className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Recording
                        </div>
                        <div className="text-xs text-gray-400">Recording Status</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {isInterviewTimerActive && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                  isFullscreen ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isFullscreen ? 'bg-green-400' : 'bg-red-400 animate-pulse'
                  }`}></div>
                  {isFullscreen ? 'Fullscreen' : 'Exit = Terminate'}
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                connectionStatus === 'connected' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </div>
              
              {/* Mobile Answer Timer Display */}
              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">
                  <Mic className="w-3 h-3" />
                  <span className="font-medium">Recording</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Time Warning Banner */}
      {timeRemaining <= 120 && (
        <div className={`w-full py-4 px-6 text-center transition-all duration-500 ${
          timeRemaining <= 60 
            ? 'bg-gradient-to-r from-red-600 to-red-700 text-white animate-pulse' 
            : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
        }`}>
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            <div className="font-semibold text-lg">
              {timeRemaining <= 60 
                ? '⚠️ INTERVIEW ENDING SOON! Please finish your current response.' 
                : '⚠️ Less than 2 minutes remaining in your interview!'}
            </div>
            <AlertTriangle className="w-6 h-6" />
          </div>
          {timeRemaining <= 30 && (
            <div className="mt-2 text-sm opacity-90">
              Interview will automatically end in {timeRemaining} seconds
            </div>
          )}
        </div>
      )}

      {/* Main Interview Interface */}
      <div className="w-full px-1 py-1 relative z-10">
                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-1 mb-2">
          {/* AI Assistant Panel - Question Card */}
          <div className="lg:col-span-2 glass rounded-2xl p-1 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">AI Interviewer</h3>
                  <p className="text-sm text-gray-300">Your AI Assistant</p>
                </div>
              </div>
              
              <button
                onClick={toggleAIAudio}
                className={`absolute top-3 right-3 p-2 rounded-lg transition-colors z-10 backdrop-blur-sm ${
                  aiAudioEnabled ? 'bg-green-500/30 text-green-300 hover:bg-green-500/40' : 'bg-red-500/30 text-red-300 hover:bg-red-500/40'
                }`}
              >
                {aiAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>
            
                         <div className="bg-gray-800/50 rounded-xl p-1 h-[520px] flex items-center justify-center">
              {aiSpeaking && !aiMessage?.includes('Question') ? (
                <div className="text-center w-full">
                  {/* Animated AI Speaking - Clean waveform only */}
                  
                  {/* Audio Waveform */}
                  <div className="flex items-end justify-center gap-1 mb-4 h-20">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-blue-400 via-purple-400 to-pink-400 rounded-full transition-all duration-500 ease-in-out"
                        style={{
                          height: `${waveformHeights[i] || 42}px`
                        }}
                      ></div>
                    ))}
                  </div>
                  
                  {/* Speaking Text */}
                  <div className="text-blue-300 text-lg font-medium mt-4">
                    🤖 AI is speaking...
                  </div>
                </div>
              ) : (
                <div className="text-center w-full">
                   {/* Submission Status Indicator */}
                   {answerSubmitted && (
                     <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-3 mb-3 animate-pulse">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                         <p className="text-green-300 text-sm font-medium">✅ Answer submitted successfully! Moving to next question...</p>
                       </div>
                     </div>
                   )}

                   {/* AI Message - clean during question reading */}
                  {!isWelcomeMessage && (
                    <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
                      <p className="text-white text-xl font-medium leading-relaxed">{aiMessage}</p>
                      {currentQuestionMaxTime > 0 && (
                        <p className="mt-2 text-sm text-blue-200">
                          Time to answer: {formatTime(currentQuestionMaxTime)}
                        </p>
                      )}
                    </div>
                    
                  )}
                   
                   {/* Status Indicator - only show when AI is not speaking */}
                   {!aiSpeaking && (
                     <div className="flex items-center justify-center gap-2 mb-3">
                       <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                       <p className="text-gray-300 text-sm">Ready to speak</p>
                     </div>
                   )}
                   
                   {/* Auto-start interview */}
                   {!hasSpokenWelcomeRef.current && !aiSpeaking && (
                     <div className="text-center">
                       <div className="animate-pulse">
                         <div className="w-4 h-4 bg-blue-400 rounded-full mx-auto mb-2"></div>
                         <p className="text-blue-300 text-sm">Starting interview automatically...</p>
                       </div>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>

          {/* Candidate Panel - Camera/Screen Sharing Card */}
          <div className="lg:col-span-3 glass rounded-2xl p-1 border border-white/10">
                         <div className="bg-gray-800/50 rounded-xl p-1 h-[450px] flex items-center justify-center overflow-hidden relative border border-gray-600/30">
              {/* Camera Button - Top Right Corner */}
              <button
                onClick={toggleVideo}
                className="absolute top-3 right-3 p-2 rounded-lg transition-colors z-20 backdrop-blur-sm bg-red-500/30 text-red-300 hover:bg-red-500/40"
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              
              {/* Camera Required Warning - Top Left Corner */}
              {!isVideoOn && (
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-red-500/30 text-red-300 rounded-full text-xs z-20 backdrop-blur-sm">
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
                    className="w-full h-full object-cover rounded-lg shadow-2xl transform scale-105 hover:scale-110 transition-transform duration-300"
                    style={{ height: '430px', width: '100%' }}
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
                  <VideoOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <p className="text-red-300 font-medium">Camera is required</p>
                  <p className="text-gray-400 text-sm">Please turn on your camera to continue</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Editable Transcription Card - Full Width */}
        <div className="glass rounded-2xl p-4 border border-white/10 mb-2">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Start speaking to see real-time transcription here. You can edit the text as needed..."
            className="w-full bg-gray-800/50 text-white rounded-lg p-3 min-h-[120px] max-h-[180px] resize-y border border-gray-600/30 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm leading-relaxed"
            style={{
              fontFamily: 'inherit'
            }}
          />
        </div>





                 {/* Instructions */}
         <div className="glass rounded-2xl p-4 border border-white/10 mb-6">
           <div className="text-center">
              {!screenPermissionGranted ? (
                <div className="text-blue-300 text-sm transition-all duration-500 ease-in-out">
                  <p>🖥️ Setting up screen access for interview security...</p>
                  <div className="mt-2 text-xs text-gray-400">
                    Screen sharing is required and will be requested automatically
                  </div>
                </div>
              ) : recordingCountdown > 0 ? (
                <div className="text-blue-300 text-sm transition-all duration-500 ease-in-out">
                  <p>🎥 Recording will start in {recordingCountdown}...</p>
                  <div className="mt-1 text-xs text-gray-400">
                    {/*Get ready to answer the question*/}
                  </div>
                </div>
              ) : !questionFinishedSpeaking && !isRecording ? (
                <div className="text-gray-300 text-sm transition-all duration-500 ease-in-out">
                  {/*<p>🎤 Listen carefully to the question...</p>*/}
                </div>
              ) : questionFinishedSpeaking && !isRecording ? (
               <div className="text-green-300 text-sm transition-all duration-500 ease-in-out">
                 <div>
                   <p>✅ Question finished! Click "Start Recording" to begin recording your answer.</p>
                   <div className="mt-2 text-xs text-green-400">
                     🎥 Screen access already granted - ready to record
                   </div>
                 </div>
               </div>
             ) : isRecording ? (
               <div>
                 {/* Original Long Timer Bar */}
                 {isQuestionTimerActive && questionTimeRemaining > 0 && (
                   <div className="mt-2 w-full max-w-2xl mx-auto">
                     <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <Clock className={`w-4 h-4 ${
                           questionTimeRemaining <= 30 
                             ? 'text-red-400' 
                             : questionTimeRemaining <= 60 
                               ? 'text-yellow-400' 
                               : 'text-green-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           questionTimeRemaining <= 30 
                             ? 'text-red-400' 
                             : questionTimeRemaining <= 60 
                               ? 'text-yellow-400' 
                               : 'text-green-400'
                         }`}>
                           Question Time: {formatTime(questionTimeRemaining)} / {formatTime(currentQuestionMaxTime)}
                         </span>
                       </div>
                       <span className="text-xs text-gray-500">
                         {Math.round((questionTimeRemaining / currentQuestionMaxTime) * 100)}% remaining
                       </span>
                     </div>
                     
                     {/* Progress Bar */}
                     <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                       <div 
                         className={`h-full transition-all duration-1000 ease-linear ${
                           questionTimeRemaining <= 30 
                             ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' 
                             : questionTimeRemaining <= 60 
                               ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
                               : 'bg-gradient-to-r from-green-500 to-green-600'
                         }`}
                         style={{ 
                           width: `${(questionTimeRemaining / currentQuestionMaxTime) * 100}%`,
                           transition: 'width 1s linear'
                         }}
                       ></div>
                     </div>
                     
                     {/* Warning Messages */}
                     {questionTimeRemaining <= 30 && (
                       <div className="mt-2 text-red-400 text-sm font-medium animate-pulse flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" />
                         ⚠️ Time running out! Answer will auto-submit in {questionTimeRemaining} seconds
                       </div>
                     )}
                     {questionTimeRemaining <= 60 && questionTimeRemaining > 30 && (
                       <div className="mt-2 text-yellow-400 text-sm font-medium flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" />
                         ⚠️ Less than 1 minute remaining for this question
                       </div>
                     )}
                   </div>
                 )}
               </div>
             ) : answerSubmitted ? (
               <div className="text-green-300 text-sm">
                 <div className="text-center">
                   <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-3 flex items-center justify-center">
                     <CheckCircle className="w-8 h-8 text-green-400" />
                   </div>
                   <p className="text-lg font-semibold text-green-300 mb-2">✅ Answer Submitted Successfully!</p>
                   <p className="text-sm text-green-200">
                     {isGeneratingQuestion ? 'Generating next question...' : 'Loading next question...'}
                   </p>
                   <div className="mt-3 flex justify-center">
                     <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 </div>
               </div>
             ) : null}
           </div>
         </div>



                 {/* Controls */}
         <div className="flex items-center justify-center gap-4">
           
                                           {/* Stop Recording Button - only show when recording */}
             {isRecording && (
               <button
                 onClick={stopQuestionRecording}
                 disabled={!isVideoOn || isSubmitting}
                 className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <MicOff className="w-5 h-5" />
                 Stop Recording
               </button>
             )}
           
                       <button
              onClick={handleSubmitAnswer}
              disabled={!audioBlob || isSubmitting || !isVideoOn || answerSubmitted}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                answerSubmitted || submissionStatus === 'submitted'
                  ? 'bg-green-600 text-white cursor-default animate-pulse' 
                  : isSubmitting 
                    ? submissionStatus === 'uploading' 
                      ? 'bg-blue-500 text-white cursor-wait'
                      : submissionStatus === 'processing'
                        ? 'bg-yellow-500 text-white cursor-wait'
                        : 'bg-yellow-500 text-white cursor-wait'
                    : 'bg-green-500 hover:bg-green-600 text-white'
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
            
            
            {/* End Interview Button - always visible */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to end the interview? This action cannot be undone.')) {
                  terminateInterview('Manual termination by candidate willingly');
                }
              }}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all"
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
