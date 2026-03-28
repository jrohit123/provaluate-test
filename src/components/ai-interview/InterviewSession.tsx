import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, 
  User, Clock, HelpCircle, 
  Target, 
  Camera, FileText,
  Loader2, Save, X, Sparkles,
  Lightbulb, CheckCircle,
  Activity, Wifi, WifiOff, Volume2,
  AlertTriangle
} from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import RecordRTC from 'recordrtc';
import AitamateLogo from './AitamateLogo';
import { useInterview, interviewActions } from '@/contexts/InterviewContext';
import { API_CONFIG, buildApiUrl, apiCall } from '@/constants/api';
import { INTERVIEW_CONSTANTS } from '@/constants/interview';
import { Question, Answer, InterviewData } from '@/types/interview';


const InterviewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const interviewData: InterviewData = location.state || {} as InterviewData;
  
  // Debug: Log the received data
  console.log('🔍 InterviewSession received data:', interviewData);
  console.log('🔍 Interview ID:', interviewData.interviewId);
  
  // Use centralized interview state
  const { state: interviewState, dispatch } = useInterview();
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(interviewData.duration * 60);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | string>(interviewData.currentQuestion || 'Loading question...');
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isCreatingInterview] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasPersonalizedQuestions, setHasPersonalizedQuestions] = useState(false);
  const [personalizedQuestions, setPersonalizedQuestions] = useState([]);
  const [currentPersonalizedQuestionIndex, setCurrentPersonalizedQuestionIndex] = useState(0);
  const [isPersonalizedQuestionPhase, setIsPersonalizedQuestionPhase] = useState(false);
  
  // Per-question timer states
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(0);
  const [currentQuestionMaxTime, setCurrentQuestionMaxTime] = useState(0);
  const [isQuestionTimerActive, setIsQuestionTimerActive] = useState(false);
  
  // Use centralized state
  const { isSubmitting, isProcessing, currentQuestionIndex, submitError, retryCount, maxRetries } = interviewState;
  
  const intervalRef = useRef(null);
  const questionTimerRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const analyserRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const lastRecordingToastRef = useRef<string | null>(null);
  const lastConnectionToastRef = useRef<string | null>(null);
  const priorAnswerKeyphrasesRef = useRef<string[]>([]);



  // Socket connection
  useEffect(() => {
    const socket = io(API_CONFIG.BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      forceNew: true,
      // pingTimeout: 60000, // Not a valid socket.io option
      // pingInterval: 25000 // Not a valid socket.io option
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setConnectionStatus('connected');
      const toastId = 'connection-connected';
      if (lastConnectionToastRef.current !== toastId) {
        toast.success('Connected to transcription service', { id: toastId });
        lastConnectionToastRef.current = toastId;
      }
      socket.emit('get_current_transcription');
      
      // Start transcription for this interview
      if (interviewData?.interviewId) {
        console.log('🎤 Starting transcription for interview:', interviewData.interviewId);
        socket.emit('start_transcription', {
          interview_id: interviewData.interviewId
        });
      }
    });

    socket.on('connection_confirmed', (data) => {
      console.log('✅ Connection confirmed by server:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      setConnectionStatus('disconnected');
      
      // Only show error for unexpected disconnections
      if (reason !== 'io client disconnect' && reason !== 'transport close') {
        toast.error(`Connection lost: ${reason}`);
      }
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Connection error:', error);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
      const toastId = 'connection-reconnected';
      if (lastConnectionToastRef.current !== toastId) {
        toast.success('Reconnected to transcription service', { id: toastId });
        lastConnectionToastRef.current = toastId;
      }
    });

    socket.on('transcription_update', (data) => {
      console.log('📝 TRANSCRIPTION RECEIVED:', data);
      if (data && data.text) {
        setTranscript(data.text);
        

      } else {
        console.warn('⚠️ Received empty or invalid transcription data:', data);
      }
    });

    socket.on('recording_started', (data) => {
      console.log('🎤 Recording started');
      setIsRecording(true);
      const toastId = 'recording-started';
      if (lastRecordingToastRef.current !== toastId) {
        toast.success('Recording started', { id: toastId });
        lastRecordingToastRef.current = toastId;
      }
      startAudioVisualization();
    });

    socket.on('recording_stopped', (data) => {
      console.log('⏹️ Recording stopped');
      setIsRecording(false);
      const toastId = 'recording-stopped';
      if (lastRecordingToastRef.current !== toastId) {
        toast.success('Recording stopped', { id: toastId });
        lastRecordingToastRef.current = toastId;
      }
      stopAudioVisualization();
    });

    socket.on('pong_test', (data) => {
      console.log('💓 Heartbeat response received:', data.message);
    });

    // Add heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping_test');
      }
    }, 30000); // Every 30 seconds

    return () => {
      console.log('🧹 Cleaning up socket connection...');
      clearInterval(heartbeatInterval);
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load welcome message when interview ID is available
  useEffect(() => {
    const loadWelcomeMessage = async () => {
      if (interviewData.interviewId) {
        try {
          const response = await fetch(`/api/get-welcome-message/${interviewData.interviewId}`);
          const data = await response.json();
          if (data.status === 'success') {
            setWelcomeMessage(data.welcome_message);
            setHasPersonalizedQuestions(data.has_personalized_questions);
            if (data.personalized_questions) {
              setPersonalizedQuestions(data.personalized_questions);
            }
          }
        } catch (error) {
          console.error('Error loading welcome message:', error);
        }
      }
    };
    
    loadWelcomeMessage();
  }, [interviewData.interviewId]);

  // Start transcription when interview ID is available
  useEffect(() => {
    if (interviewData?.interviewId && socketRef.current?.connected) {
      console.log('🎤 Starting transcription for interview:', interviewData.interviewId);
      socketRef.current.emit('start_transcription', {
        interview_id: interviewData.interviewId
      });
    }
  }, [interviewData?.interviewId]);

  // Load questions and answers on mount
  useEffect(() => {
    loadInterviewData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer effect
  useEffect(() => {
    if (timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else {
      // Time's up - auto-submit if there's a transcript
      if (transcript && transcript.trim() && !isSubmitting) {
        // Use a flag to prevent infinite recursion
        handleSubmitAnswer();
      }
    }
    
    return () => {
      clearInterval(intervalRef.current);
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
    };
  }, [timeRemaining, transcript, isSubmitting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading state while creating interview
  if (isCreatingInterview) {
    return (
              <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Creating Your Interview</h2>
            <p className="text-gray-600 text-lg">Setting up your personalized interview session...</p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sky-600">
            <Target className="w-5 h-5" />
            <span>{location.state?.roleName || 'Role'}</span>
          </div>
        </div>
      </div>
    );
  }





  const startAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average);
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
    } catch (error) {
      console.error('Error starting audio visualization:', error);
    }
  };

  const stopAudioVisualization = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const loadInterviewData = async () => {
    try {
      console.log('🔍 Loading interview data for ID:', interviewData.interviewId);
      console.log('🔍 Full interviewData object:', interviewData);
      
      if (!interviewData.interviewId) {
        console.error('❌ No interview ID found in interviewData');
        setCurrentQuestion('Error: No interview ID found. Please try again.');
        return;
      }
      
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewData.interviewId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Interview data received:', data);
        
        setQuestions(data.questions || []);
        setAnswers(data.answers || []);
        
        // Set current question based on answers count (next question to answer)
        if (data.questions && data.questions.length > 0) {
          const nextQuestionIndex = data.answers ? data.answers.length : 0; // Next question to answer
          
          if (nextQuestionIndex < data.questions.length) {
            // Show the next question to answer
            const currentQ = data.questions[nextQuestionIndex];
            setCurrentQuestion(currentQ.question_text);
            dispatch(interviewActions.setQuestionIndex(nextQuestionIndex));
            console.log('📝 Loaded questions:', data.questions.length, 'Answers:', data.answers ? data.answers.length : 0, 'Next question index:', nextQuestionIndex);
            console.log('📝 Current question set to:', currentQ.question_text);
          } else {
            // All questions answered, show the last question
            const lastQ = data.questions[data.questions.length - 1];
            setCurrentQuestion(lastQ.question_text);
            dispatch(interviewActions.setQuestionIndex(data.questions.length - 1));
            console.log('📝 All questions answered, showing last question');
          }
        } else {
          console.log('❌ No questions found in interview data');
          setCurrentQuestion('No questions available. Please contact support.');
        }
      } else {
        console.error('❌ Failed to load interview data:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error details:', errorData);
      }
    } catch (error) {
      console.error('❌ Error loading interview data:', error);
    }
  };

    const startRecording = async () => {
    try {
      console.log('🎤 Starting recording process...');
      
      // Start socket recording for transcription
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('start_recording');
      }
      
      // Get audio stream with robust error handling
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      if (!stream) {
        throw new Error('No audio stream received');
      }
      
      console.log('🎤 Audio stream obtained successfully');
      streamRef.current = stream;
      
      // Create RecordRTC recorder with WAV configuration (more reliable)
      console.log('🎤 Initializing RecordRTC for WAV recording...');
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        numberOfAudioChannels: 1,
        desiredSampRate: 44100,
        recorderType: RecordRTC.StereoAudioRecorder,
        quality: 10,
        frameRate: 44100,
        timeSlice: 1000, // Record in 1-second chunks
        disableLogs: false,
        // Use WAV format for better compatibility
        audioBitsPerSecond: 128000,
        // Ensure WAV output
        ondataavailable: function(blob) {
          console.log('🎵 WAV data available:', blob.type, blob.size);
        }
      });
      
      // Start recording with validation
      console.log('🎤 Starting RecordRTC recording...');
      recorder.startRecording();
      
      // Verify recording started
      const recordingTimer = setTimeout(() => {
        if (recorder.state === 'recording') {
          console.log('✅ Recording confirmed active');
        } else {
          console.warn('⚠️ Recording may not have started properly');
        }
      }, INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      
      // Store timer reference for cleanup
      recordingTimerRef.current = recordingTimer;
      
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioBlob(null);
      
      console.log('✅ Recording started successfully');
      toast.success('Recording started!');
      
    } catch (error) {
      console.error('❌ Recording start error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone permission denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error(`Recording failed: ${error.message}`);
      }
    }
  };

  const stopRecording = () => {
    console.log('⏹️ Stopping recording...');
    
    if (!mediaRecorder) {
      console.warn('⚠️ No mediaRecorder found');
      setIsRecording(false);
      return;
    }
    
    // Stop socket recording
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('stop_recording');
    }
    
    let blobRetrieved = false;
    
    // Stop recording with multiple fallback attempts
    try {
      console.log('⏹️ Stopping RecordRTC recording...');
      
      mediaRecorder.stopRecording(() => {
        console.log('✅ RecordRTC callback executed');
        
        try {
          const blob = mediaRecorder.getBlob();
          console.log('🎵 Blob retrieved:', { size: blob?.size, type: blob?.type });
          console.log('🎵 Expected MP3 format, actual format:', blob?.type);
          
          if (blob && blob.size > 0) {
            setAudioBlob(blob);
            blobRetrieved = true;
            console.log('✅ Audio blob set successfully');
            console.log('🔍 Current audioBlob state after setting:', blob);
            console.log('🎵 Audio format confirmed:', blob.type);
            toast.success(`Audio recorded! (${(blob.size / 1024).toFixed(1)} KB) - ${blob.type}`);
          } else {
            console.error('❌ Blob is empty or null');
            toast.error('No audio captured. Please try again.');
          }
        } catch (blobError) {
          console.error('❌ Error getting blob:', blobError);
          toast.error('Failed to get audio recording. Please try again.');
        }
        
        // Stop audio tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          console.log('🎵 Audio tracks stopped');
        }
      });
      
      // Fallback: try to get blob after a delay if callback doesn't work
      setTimeout(() => {
        if (!blobRetrieved) {
          console.log('🔄 Fallback: trying to get blob directly...');
          try {
            const fallbackBlob = mediaRecorder.getBlob();
            if (fallbackBlob && fallbackBlob.size > 0) {
              setAudioBlob(fallbackBlob);
              console.log('✅ Fallback blob retrieved successfully');
              console.log('🔍 Current audioBlob state after fallback:', fallbackBlob);
              toast.success(`Audio recorded! (${(fallbackBlob.size / 1024).toFixed(1)} KB)`);
            } else {
              console.error('❌ Fallback blob also failed');
              toast.error('Failed to capture audio. Please try again.');
            }
          } catch (fallbackError) {
            console.error('❌ Fallback blob retrieval failed:', fallbackError);
            toast.error('Audio recording failed. Please try again.');
          }
        }
      }, 2000); // 2 second fallback
      
    } catch (stopError) {
      console.error('❌ Error stopping recording:', stopError);
      toast.error('Failed to stop recording. Please try again.');
    }
    
    setIsRecording(false);
  };

  const toggleVideo = async () => {
    try {
      if (!isVideoOn) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
      }
      setIsVideoOn(!isVideoOn);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitAnswer = async () => {
    if (!transcript || !transcript.trim()) {
      toast.error(INTERVIEW_CONSTANTS.ERRORS.NO_TRANSCRIPT);
      return;
    }

    if (!audioBlob || audioBlob.size === 0) {
      toast.error(INTERVIEW_CONSTANTS.ERRORS.NO_AUDIO);
      return;
    }

    dispatch(interviewActions.setSubmitting(true));
    try {
      // Get current question ID
      console.log('📝 Questions array:', questions);
      console.log('📝 Current question index:', currentQuestionIndex);
      
      // Ensure currentQuestionIndex is within bounds
      const safeIndex = Math.min(currentQuestionIndex, questions.length - 1);
      const currentQuestionData = questions[safeIndex];
      console.log('📝 Safe index:', safeIndex, 'Current question data:', currentQuestionData);
      
      // Check if we already have an answer for this question order
      const existingAnswer = answers.find(answer => answer.question_order === safeIndex);
      if (existingAnswer) {
        console.log('⚠️ Answer already exists for question order', safeIndex, 'skipping submission');
        toast.success('Answer already submitted for this question. Continuing to next question...');
        
        // Move to next question
        if (currentQuestionIndex < (interviewData.totalQuestions || 1) - 1) {
          await generateNextQuestion();
        } else {
          await finishInterview();
        }
        return;
      }
      
      if (!currentQuestionData) {
        console.error('❌ No question data found for index:', safeIndex);
        console.error('❌ Available questions:', questions);
        toast.error('Question data not found. Please refresh and try again.');
        return;
      }
      
      // Convert audio blob to base64 with robust error handling
      let audioData = null;
      
      if (audioBlob) {
        console.log('🎵 Converting audio blob to base64:', {
          blobSize: audioBlob.size,
          blobType: audioBlob.type
        });
        
        // Validate blob before conversion
        if (audioBlob.size === 0) {
          console.error('❌ Audio blob is empty');
          toast.error(INTERVIEW_CONSTANTS.ERRORS.EMPTY_AUDIO);
          dispatch(interviewActions.setSubmitting(false));
          return;
        }
        
        try {
          // Method 1: FileReader with timeout
          const reader = new FileReader();
          const base64Promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('FileReader timeout'));
            }, API_CONFIG.TIMEOUTS.FILE_READER);
            
            reader.onload = () => {
              clearTimeout(timeout);
              resolve(reader.result);
            };
            reader.onerror = (error) => {
              clearTimeout(timeout);
              reject(error);
            };
          });
          
          reader.readAsDataURL(audioBlob);
          audioData = await base64Promise;
          
          console.log('🎵 Audio conversion successful:', {
            audioDataLength: audioData.length,
            audioDataStartsWith: audioData.substring(0, 50)
          });
          
        } catch (error) {
          console.error('❌ Primary conversion method failed:', error);
          
          // Method 2: Alternative conversion using ArrayBuffer
          try {
            console.log('🔄 Trying alternative conversion method...');
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Convert to base64 manually
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.slice(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, chunk);
            }
            
            const base64 = btoa(binary);
            audioData = `data:${audioBlob.type};base64,${base64}`;
            
            console.log('✅ Alternative conversion successful:', {
              audioDataLength: audioData.length
            });
            
          } catch (altError) {
            console.error('❌ Alternative conversion also failed:', altError);
            toast.error('Failed to process audio file. Please try again.');
            dispatch(interviewActions.setSubmitting(false));
            return;
          }
        }
      } else {
        console.error('❌ No audio blob available for conversion');
        toast.error('No audio recording found. Please record your answer first.');
        dispatch(interviewActions.setSubmitting(false));
        return;
      }
      
      // Submit answer to server
      console.log('🎵 Submitting answer with audio data:', {
        hasAudioData: !!audioData,
        audioDataLength: audioData ? audioData.length : 0,
        audioDataType: typeof audioData
      });
      
      const response = await apiCall(API_CONFIG.ENDPOINTS.SUBMIT_ANSWER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interview_id: interviewData.interviewId,
          question_id: currentQuestionData.id,
          question_order: safeIndex,
          transcript: transcript,
          audio_data: audioData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const result = await response.json();
      priorAnswerKeyphrasesRef.current = Array.isArray((result as { keyphrases?: string[] }).keyphrases)
        ? (result as { keyphrases: string[] }).keyphrases
        : [];
      
      // Add answer to local state
      const newAnswer: Answer = {
        id: Date.now().toString(), // Convert to string
        interview_id: interviewData.interviewId,
        question_id: currentQuestionData.id,
        question_order: safeIndex,
        transcript: transcript,
        feedback: result.feedback,
        created_at: new Date().toISOString()
      };
      
      setAnswers(prev => [...prev, newAnswer]);
      
      // Set submitted state
      setAnswerSubmitted(true);
      
      toast.success(INTERVIEW_CONSTANTS.SUCCESS.ANSWER_SUBMITTED);
      
      // Clear audio blob after submission
      setAudioBlob(null);
      
      // Check if we should continue or finish
      if (currentQuestionIndex < (interviewData.totalQuestions || 1) - 1) { // Dynamic question limit
        await generateNextQuestion();
      } else {
        await finishInterview();
      }
      
    } catch (error) {
      const errorMsg = error.message || 'An unexpected error occurred';
      console.error('❌ Submit error:', error);
      dispatch(interviewActions.setSubmitError(errorMsg));
      dispatch(interviewActions.incrementRetry());
      toast.error(`Failed to submit answer: ${errorMsg}`);
    } finally {
      dispatch(interviewActions.setSubmitting(false));
    }
  };

  // Question timer effect - per-question countdown with auto-advance
  useEffect(() => {
    if (isQuestionTimerActive && questionTimeRemaining > 0) {
      questionTimerRef.current = setInterval(() => {
        setQuestionTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // Auto-advance to next question when timer expires
            console.log('⏰ Question timer expired, auto-advancing...');
            setIsQuestionTimerActive(false);
            if (questionTimerRef.current) {
              clearInterval(questionTimerRef.current);
              questionTimerRef.current = null;
            }
            // Auto-submit current answer and move to next question
            if (!isSubmitting && !answerSubmitted && transcript && transcript.trim()) {
              console.log('🔄 Auto-submitting answer due to timer expiry');
              handleSubmitAnswer();
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    } else if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    
    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
    };
  }, [isQuestionTimerActive, questionTimeRemaining, isSubmitting, answerSubmitted, transcript, handleSubmitAnswer]);

  const generateNextQuestion = async () => {
    dispatch(interviewActions.setProcessing(true));
    setIsTransitioning(true);
    
    try {
      const kp = priorAnswerKeyphrasesRef.current;
      const response = await apiCall(API_CONFIG.ENDPOINTS.GENERATE_QUESTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interview_id: interviewData.interviewId,
          current_question_index: currentQuestionIndex + 1,
          ...(Array.isArray(kp) && kp.length > 0 ? { prior_answer_keyphrases: kp } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate question');
      }

      priorAnswerKeyphrasesRef.current = [];
      const data = await response.json();
      
      // First, increment the question index
      dispatch(interviewActions.setQuestionIndex(currentQuestionIndex + 1));
      
      // Then update the current question with the newly generated question
      setCurrentQuestion(data.question);
      setTranscript('');
      setTimeRemaining(interviewData.duration * 60);
      setAnswerSubmitted(false); // Reset submitted state for new question
      
      // Initialize question timer (default to 3 minutes if no max_time specified)
      const questionMaxTime = data.max_time || 3;
      const questionTimeInSeconds = (questionMaxTime + 0.5) * 60; // answer time + 30s reading
      setCurrentQuestionMaxTime(questionTimeInSeconds);
      setQuestionTimeRemaining(questionTimeInSeconds);
      setIsQuestionTimerActive(true);
      console.log('⏰ Question timer initialized:', questionTimeInSeconds, 'seconds for', questionMaxTime, 'min answer time');
      
      // Reload interview data to get updated questions array, but don't override the current question
      const response2 = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewData.interviewId}`);
      if (response2.ok) {
        const interviewData = await response2.json();
        setQuestions(interviewData.questions);
        setAnswers(interviewData.answers);
      }
      
      toast.success(INTERVIEW_CONSTANTS.SUCCESS.QUESTION_GENERATED);
      
      // Add a small delay for smooth transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 500);
      
    } catch (error) {
      const errorMsg = error.message || 'Failed to generate next question';
      console.error('❌ Generate question error:', error);
      dispatch(interviewActions.setSubmitError(`Question generation failed: ${errorMsg}`));
      toast.error(`Failed to generate next question: ${errorMsg}`);
      setIsTransitioning(false);
    } finally {
      dispatch(interviewActions.setProcessing(false));
    }
  };

  const finishInterview = async () => {
    try {
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.FINISH_INTERVIEW}/${interviewData.interviewId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to finish interview');
      }

      const result = await response.json();
      
      toast.success(`Interview completed! Final score: ${result.total_score.toFixed(1)}/10`);
      
      // Fetch the latest answers from the server to ensure we have all answers
      const answersResponse = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewData.interviewId}`);
      let latestAnswers = answers;
      if (answersResponse.ok) {
        const interviewData = await answersResponse.json();
        latestAnswers = interviewData.answers;
      }
      
      // Navigate to results page with interview data
      navigate('/results', {
        state: {
          interviewId: interviewData.interviewId,
          totalScore: result.total_score,
          totalQuestions: result.total_questions,
          answers: latestAnswers
        }
      });
      
    } catch (error) {
      console.error('Error finishing interview:', error);
      toast.error('Failed to finish interview');
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'disconnected': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      default: return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  const startPersonalizedQuestions = () => {
    if (personalizedQuestions.length > 0) {
      setIsPersonalizedQuestionPhase(true);
      setShowWelcome(false);
      setCurrentQuestion(personalizedQuestions[0].question);
      setCurrentPersonalizedQuestionIndex(0);
      
      // Set timer for personalized question
      const timeLimit = personalizedQuestions[0].timeLimit || 3;
      const questionTimeInSeconds = timeLimit * 60;
      setCurrentQuestionMaxTime(questionTimeInSeconds);
      setQuestionTimeRemaining(questionTimeInSeconds);
      setIsQuestionTimerActive(true);
      
      console.log('🎯 Starting personalized questions phase:', personalizedQuestions.length, 'questions');
    }
  };

  const handlePersonalizedQuestionSubmit = async () => {
    if (!transcript || !transcript.trim()) {
      toast.error('Please record your answer before submitting');
      return;
    }

    if (!audioBlob || audioBlob.size === 0) {
      toast.error('No audio recording found. Please record your answer first.');
      return;
    }

    dispatch(interviewActions.setSubmitting(true));
    try {
      // Submit personalized question answer (no scoring)
      const response = await apiCall(API_CONFIG.ENDPOINTS.SUBMIT_ANSWER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interview_id: interviewData.interviewId,
          question_id: `personalized_${currentPersonalizedQuestionIndex}`,
          question_order: currentPersonalizedQuestionIndex,
          transcript: transcript,
          audio_data: audioBlob,
          is_personalized: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit personalized answer');
      }

      toast.success('Personal question answered successfully!');
      
      // Clear audio blob after submission
      setAudioBlob(null);
      setTranscript('');
      
      // Move to next personalized question or start functional questions
      if (currentPersonalizedQuestionIndex < personalizedQuestions.length - 1) {
        const nextIndex = currentPersonalizedQuestionIndex + 1;
        setCurrentPersonalizedQuestionIndex(nextIndex);
        setCurrentQuestion(personalizedQuestions[nextIndex].question);
        
        // Set timer for next personalized question
        const timeLimit = personalizedQuestions[nextIndex].timeLimit || 3;
        const questionTimeInSeconds = timeLimit * 60;
        setCurrentQuestionMaxTime(questionTimeInSeconds);
        setQuestionTimeRemaining(questionTimeInSeconds);
        setIsQuestionTimerActive(true);
      } else {
        // All personalized questions answered, start functional questions
        setIsPersonalizedQuestionPhase(false);
        await loadInterviewData(); // Load functional questions
      }
      
    } catch (error) {
      console.error('Error submitting personalized answer:', error);
      toast.error('Failed to submit personalized answer');
    } finally {
      dispatch(interviewActions.setSubmitting(false));
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sky-300 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-2000"></div>
      </div>

              {/* Header */}
        <div className="bg-white border-b border-slate-200 relative z-10 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <AitamateLogo size="default" showTagline={false} variant="default" />
                                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">Live Interview Session</h1>
                    <p className="text-sky-600 text-sm">Powered by AitamateAI</p>
                  </div>
              </div>
              
              <div className="hidden lg:flex items-center gap-8 text-sm">
                <div className="flex items-center gap-3 text-slate-600 hover:text-sky-600 transition-colors cursor-pointer group">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{interviewData.candidateName}</div>
                    <div className="text-xs text-slate-500">Candidate</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-slate-600 hover:text-sky-600 transition-colors cursor-pointer group">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Target className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{interviewData.position}</div>
                    <div className="text-xs text-slate-500">Position</div>
                  </div>
                </div>
                
                <div className={`flex items-center gap-3 transition-colors cursor-pointer group ${getConnectionStatusColor()}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                    connectionStatus === 'connected' ? 'bg-green-100' : 
                    connectionStatus === 'disconnected' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    {getConnectionStatusIcon()}
                  </div>
                  <div>
                    <div className="font-semibold capitalize text-slate-800">{connectionStatus}</div>
                    <div className="text-xs text-slate-500">Connection</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group border border-slate-200">
                <Clock className="w-5 h-5 text-sky-600 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-slate-800 font-bold text-lg">{formatTime(timeRemaining)}</div>
                  <div className="text-sky-600 text-xs">Time Remaining</div>
                </div>
              </div>
              

            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Feed */}
            <div className="bg-white rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-300 border border-slate-200 shadow-lg">
                              <div className="aspect-video bg-gradient-to-br from-slate-50 to-slate-100 relative group border border-slate-200 rounded-lg">
                {isVideoOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center group-hover:scale-105 transition-transform duration-300">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-slate-200 transition-all duration-300">
                          <Camera className="w-12 h-12 text-slate-600 group-hover:text-slate-700 transition-colors" />
                        </div>
                        <p className="text-slate-600 group-hover:text-slate-700 transition-colors text-lg font-medium">Camera is off</p>
                        <p className="text-slate-500 text-sm mt-2">Click the camera button to enable video</p>
                      </div>
                    </div>
                )}
                
                {/* Video Controls */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
                  <button
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl ${
                      isVideoOn ? 'bg-sky-600 hover:bg-sky-700 border border-sky-200' : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {isVideoOn ? <Video className="w-7 h-7 text-white" /> : <VideoOff className="w-7 h-7 text-white" />}
                  </button>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl ${
                      isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
                  </button>
                </div>

                {/* Audio Level Indicator */}
                {isRecording && (
                  <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm rounded-xl p-3 border border-sky-200 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="w-4 h-4 text-sky-600" />
                      <span className="text-gray-800 text-sm font-medium">Audio Level</span>
                    </div>
                    <div className="w-32 h-2 bg-sky-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-sky-600 rounded-full transition-all duration-100"
                        style={{ width: `${(audioLevel / 255) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Welcome Message */}
            {showWelcome && welcomeMessage && (
              <div className="bg-white rounded-3xl p-8 hover:shadow-2xl transition-all duration-300 border border-slate-200 shadow-lg mb-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="w-8 h-8 text-sky-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Welcome to Your Interview!</h2>
                  <p className="text-slate-600 text-lg leading-relaxed mb-6">
                    {welcomeMessage}
                  </p>
                  
                  {hasPersonalizedQuestions && personalizedQuestions.length > 0 && (
                    <div className="mb-6 p-4 bg-sky-50 rounded-xl border border-sky-200">
                      <p className="text-sky-800 text-sm mb-2">
                        This interview includes {personalizedQuestions.length} personal question{personalizedQuestions.length > 1 ? 's' : ''} that will be asked before the functional assessment.
                      </p>
                      <p className="text-sky-600 text-xs">
                        These questions are for review only and won't be scored.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-4 justify-center">
                    {hasPersonalizedQuestions && personalizedQuestions.length > 0 ? (
                      <button
                        onClick={startPersonalizedQuestions}
                        className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-3 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 active:scale-95"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Start with Personal Questions
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowWelcome(false)}
                        className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-3 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 active:scale-95"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Start Interview
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Question Panel */}
            {!showWelcome && (<>
              <div className="bg-white rounded-3xl p-8 hover:shadow-2xl transition-all duration-300 border border-slate-200 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center animate-pulse ${
                    isPersonalizedQuestionPhase ? 'bg-sky-100' : 'bg-sky-100'
                  }`}>
                    <HelpCircle className="w-6 h-6 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">
                      {isPersonalizedQuestionPhase 
                        ? `Personal Question ${currentPersonalizedQuestionIndex + 1} of ${personalizedQuestions.length}`
                        : `Question ${currentQuestionIndex + 1} of ${interviewData.totalQuestions || 1}`
                      }
                    </h3>
                    <p className="text-slate-600 text-sm">
                      {isPersonalizedQuestionPhase 
                        ? 'Personal Question (Review Only)'
                        : 'AI-Generated Dynamic Question'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setTranscript('')}
                    disabled={!transcript || isSubmitting}
                    className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-300 disabled:cursor-not-allowed text-slate-700 px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 active:scale-95 disabled:hover:scale-100 border border-slate-200"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      console.log('🔍 Submit button clicked!');
                      console.log('🔍 Current state:', {
                        transcript: transcript,
                        transcriptTrimmed: transcript?.trim(),
                        isSubmitting: isSubmitting,
                        isProcessing: isProcessing,
                        audioBlob: audioBlob,
                        audioBlobSize: audioBlob?.size,
                        isPersonalizedQuestionPhase: isPersonalizedQuestionPhase,
                        buttonDisabled: !transcript || !transcript.trim() || isSubmitting || isProcessing || !audioBlob
                      });
                      
                      if (isPersonalizedQuestionPhase) {
                        handlePersonalizedQuestionSubmit();
                      } else {
                        handleSubmitAnswer();
                      }
                    }}
                    disabled={!transcript || !transcript.trim() || isSubmitting || isProcessing || !audioBlob || answerSubmitted}
                    className={`px-6 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 active:scale-95 disabled:hover:scale-100 shadow-lg ${
                      answerSubmitted
                        ? 'bg-green-600 text-white cursor-default'
                        : !audioBlob 
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                          : isSubmitting || isProcessing
                            ? 'bg-sky-500 text-white cursor-wait'
                            : isPersonalizedQuestionPhase
                              ? 'bg-sky-600 hover:bg-sky-700 text-white'
                              : 'bg-sky-600 hover:bg-sky-700 text-white'
                    }`}
                  >
                    {answerSubmitted ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Answer Submitted
                      </>
                    ) : isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {isPersonalizedQuestionPhase 
                          ? (currentPersonalizedQuestionIndex < personalizedQuestions.length - 1 ? 'Next Personal Question' : 'Start Technical Questions')
                          : (currentQuestionIndex < (interviewData.totalQuestions - 1) ? 'Submit & Continue' : 'Finish Interview')
                        }
                        {audioBlob && (
                          <span className="text-xs ml-1">
                            ({(audioBlob.size / 1024).toFixed(1)} KB)
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  
                  {/* Error Display */}
                  {submitError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-red-800">Submission Error</h3>
                          <p className="mt-1 text-sm text-red-700">{submitError}</p>
                          {retryCount > 0 && (
                            <p className="mt-1 text-xs text-red-600">
                              Retry attempts: {retryCount}/{maxRetries}
                            </p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => {
                                dispatch(interviewActions.resetErrors());
                                handleSubmitAnswer();
                              }}
                              disabled={isSubmitting || retryCount >= maxRetries}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {retryCount >= maxRetries ? 'Max Retries Reached' : 'Retry'}
                            </button>
                            <button
                              onClick={() => {
                                dispatch(interviewActions.resetErrors());
                              }}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className={`bg-white rounded-2xl p-6 hover:bg-sky-50 transition-all duration-500 border border-sky-200 shadow-lg ${
                isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    {isTransitioning ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                        <p className="text-gray-600 text-lg">Generating next question...</p>
                      </div>
                    ) : (
                      <p className="text-gray-800 text-lg leading-relaxed font-medium transition-all duration-300">
                        {typeof currentQuestion === 'string' 
                          ? (currentQuestion || 'Loading question...') 
                          : (currentQuestion?.question_text || 'Loading question...')
                        }
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2 text-sky-600">
                        <Sparkles className="w-4 h-4" />
                        <span>AI Generated</span>
                      </div>
                      <div className="flex items-center gap-2 text-sky-600">
                        <Target className="w-4 h-4" />
                        <span>{interviewData.position}</span>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
            </>)}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Recording Status */}
            <div className="bg-white rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 border border-slate-200 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-4 h-4 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-sky-400'} transition-all duration-300`}></div>
                <h3 className="text-xl font-bold text-slate-800">
                  {isRecording ? 'Recording...' : 'Ready to Record'}
                </h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                {isRecording 
                  ? 'Speak naturally and take your time to answer. Your response will be transcribed after submission.' 
                  : 'Click the microphone button to start recording your response. Speak clearly for best results.'
                }
              </p>
              
              {isRecording && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-red-300 text-sm">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span>Live transcription active</span>
                  </div>
                </div>
              )}
              
              {audioBlob && !isRecording && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-green-300 text-sm">
                    <Save className="w-4 h-4" />
                    <span>Audio recorded successfully ({(audioBlob.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}
            </div>



            {/* Transcript */}
            <div className="bg-white rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 border border-slate-200 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl flex items-center justify-center animate-pulse">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Transcript</h3>
                  <p className="text-slate-600 text-sm">Your response will appear here after submission</p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 h-48 overflow-y-auto hover:bg-slate-100 transition-colors duration-300 border border-slate-200">
                {transcript ? (
                                      <p className="text-slate-800 text-sm leading-relaxed">{transcript}</p>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Mic className="w-6 h-6 text-slate-600" />
                      </div>
                      <p className="text-slate-600 italic text-sm">Your response will appear here...</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="hover:text-sky-600 transition-colors cursor-pointer">
                    Words: {transcript.split(' ').filter(w => w.length > 0).length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hover:text-sky-600 transition-colors cursor-pointer">
                    Duration: {isRecording ? '00:30' : '00:00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Per-Question Timer Progress Bar */}
            {isQuestionTimerActive && questionTimeRemaining > 0 && (
              <div className="mt-6 w-full max-w-2xl mx-auto">
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

          </div>
        </div>
      </div>
  );
};

export default InterviewSession;