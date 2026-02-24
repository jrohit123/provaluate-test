import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  User,
  Clock,
  Video,
  Mic,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Camera,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { buildApiUrl, API_CONFIG } from '@/constants/api';
import { getAdaptiveVideoConstraints } from '@/utils/mediaConstraints';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const CandidateInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  
  // State
  const [interviewData, setInterviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // System checks: 'pending' | 'checking' | 'pass' | 'fail'
  const [browserCheck, setBrowserCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [cameraMicCheck, setCameraMicCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [internetCheck, setInternetCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [permissionsCheck, setPermissionsCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');

  // Run system checks step by step when interview data is ready
  useEffect(() => {
    if (!interviewData) return;

    let cancelled = false;

    let cameraMicOk = false;

    const runChecks = async () => {
      // Step 1: Modern web browser
      setBrowserCheck('checking');
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const hasGetUserMedia = !!(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      );
      setBrowserCheck(hasGetUserMedia ? 'pass' : 'fail');
      if (!hasGetUserMedia) return;
      await new Promise((r) => setTimeout(r, 350));

      // Step 2: Camera & microphone permissions (and working devices)
      setPermissionsCheck('checking');
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;
      try {
        const constraints = getAdaptiveVideoConstraints({
          preferMobile: isMobile,
          preferFrontCamera: isMobile,
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: constraints,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.getTracks().forEach((t) => t.stop());
        cameraMicOk = true;
        setPermissionsCheck('pass');
      } catch {
        setPermissionsCheck('fail');
      }
      await new Promise((r) => setTimeout(r, 350));

      // Step 3: Working camera and microphone (verified by getUserMedia in step 2)
      setCameraMicCheck('checking');
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      setCameraMicCheck(cameraMicOk ? 'pass' : 'fail');
      await new Promise((r) => setTimeout(r, 350));

      // Step 4: Stable internet connection
      setInternetCheck('checking');
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;
      try {
        if (!navigator.onLine) {
          setInternetCheck('fail');
          return;
        }
        const apiUrl = buildApiUrl(API_CONFIG.ENDPOINTS.GET_INTERVIEW);
        const res = await fetch(`${apiUrl}/${interviewId}`, { method: 'HEAD', cache: 'no-store' });
        setInternetCheck(res.ok ? 'pass' : 'fail');
      } catch {
        setInternetCheck('fail');
      }
    };

    runChecks();
    return () => {
      cancelled = true;
    };
  }, [interviewData, interviewId, isMobile]);

  // Load interview data
  useEffect(() => {
    const loadInterviewData = async () => {
      try {
        console.log('🔍 CandidateInterview - Loading interview data for ID:', interviewId);
        const interviewUrl = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewId}`);
        console.log('🔍 CandidateInterview - Full URL:', interviewUrl);
        setIsLoading(true);
        const response = await fetch(interviewUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Interview data received:', data);
          
          // Handle both possible API response formats
          let interviewData, questions, answers;
          
          if (data.status === 'success') {
            // First endpoint format: {status: 'success', interview: {...}, questions: [...], answers: [...]}
            interviewData = data.interview;
            questions = data.questions || [];
            answers = data.answers || [];
          } else {
            // Second endpoint format: {interview: {...}, questions: [...], answers: [...]}
            interviewData = data.interview;
            questions = data.questions || [];
            answers = data.answers || [];
          }
          
          // Flatten the data for frontend components
          const flattenedData = {
            ...interviewData,
            questions: questions,
            answers: answers
          };
          
          console.log('🔍 Flattened interview data keys:', Object.keys(flattenedData));
          console.log('🔍 Interview type in flattened data:', flattenedData.interview_type);
          
          // If interview already completed, terminated, or has completion markers, redirect to completion page
          const status = (flattenedData as any).status;
          const assessmentStatus = (flattenedData as any).assessment_status;
          const completedAt = (flattenedData as any).completed_at;
          console.log('🏁 Completion check → status:', status, 'assessment_status:', assessmentStatus, 'completed_at:', completedAt);
          if (
            status === 'completed' ||
            status === 'terminated' ||
            assessmentStatus === 'completed' ||
            !!completedAt
          ) {
            console.log('➡️ Redirecting to completion page...');
            navigate(`/candidate-completion/${flattenedData.id}` , {
              state: {
                interviewId: flattenedData.id,
                candidateName: flattenedData.candidate_name,
                position: flattenedData.position
              }
            });
            return;
          }

          setInterviewData(flattenedData);
          setIsLoading(false);
          // If logged-in candidate, link this interview to their account for "My Interviews"
          if (interviewId && isCandidate(user) && user.candidate?.candidate_id) {
            supabase
              .from('interviews')
              .update({ candidate_id: user.candidate.candidate_id })
              .eq('id', interviewId)
              .is('candidate_id', null)
              .then(() => {});
          }
        } else if (response.status === 404) {
          console.error('❌ Interview not found (404)');
          setError('Interview not found. Please check your link.');
          setIsLoading(false);
        } else {
          console.error('❌ API Error:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Error details:', errorData);
          setError(errorData.message || 'Failed to load interview. Please try again.');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading interview:', error);
        setError('Failed to load interview. Please check your internet connection and try again.');
        setIsLoading(false);
      }
    };

    if (interviewId) {
      loadInterviewData();
    } else {
      setError('Invalid interview link. Please check your URL.');
      setIsLoading(false);
    }
  }, [interviewId]);

  // Initialize camera for photo capture (adaptive constraints for mobile)
  const initializeCamera = async () => {
    try {
      const videoConstraints = getAdaptiveVideoConstraints({
        preferMobile: isMobile,
        preferFrontCamera: isMobile,
      });
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints,
        audio: false 
      });
      
      // Store stream but DON'T attach yet - video element doesn't exist yet
      streamRef.current = stream;
      setCameraReady(true); // This will trigger React to render the video element
      return true;
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraReady(false);
      return false;
    }
  };

  // Attach stream once video element is rendered (and re-attach after Retake when new stream is ready)
  useEffect(() => {
    if (!cameraReady || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    video.srcObject = stream;
    video.play().catch(err => {
      console.error('Video play error:', err);
    });
  }, [cameraReady, photoCaptured]);

  // Capture photo from video stream
  const capturePhoto = async (): Promise<string | null> => {
    try {
      if (!videoRef.current) return null;
      
      const video = videoRef.current;
      
      // Wait for video to be ready
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
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

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      return photoDataUrl;
    } catch (error) {
      console.error('Error capturing photo:', error);
      return null;
    }
  };

  // Handle photo capture
  const handleCapturePhoto = React.useCallback(async () => {
    setIsCapturingPhoto(true);
    const photo = await capturePhoto();
    
    if (photo && interviewData?.id) {
      setCapturedPhoto(photo);
      setPhotoCaptured(true);
      
      const storageKey = `candidate_photo_${interviewData.id}`;
      const timestamp = Date.now();
      
      // ✅ PRIMARY: Upload photo to server for cross-browser access
      try {
        // Convert data URL to blob for upload
        const response = await fetch(photo);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('photo', blob, `candidate_photo_${interviewData.id}.jpg`);
        formData.append('interview_id', interviewData.id.toString());
        
        const uploadUrl = buildApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_CANDIDATE_PHOTO);
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          console.log('✅ Photo uploaded to server successfully');
        } else {
          console.warn('⚠️ Failed to upload photo to server, using local storage only');
        }
      } catch (uploadError) {
        console.error('❌ Error uploading photo to server:', uploadError);
        // Continue with local storage as fallback
      }
      
      // ✅ FALLBACK: Store photo in localStorage and sessionStorage (for offline/backup)
      try {
        localStorage.setItem(storageKey, photo);
        localStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
        sessionStorage.setItem(storageKey, photo);
        sessionStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
        console.log('✅ Photo stored in local storage:', storageKey);
      } catch (error) {
        console.error('Error storing photo in local storage:', error);
      }
    }
    
    setIsCapturingPhoto(false);
  }, [interviewData?.id]);

  // Handle retake photo: stop current stream, reset state, so init effect requests a new stream and attach effect re-attaches it
  const handleRetakePhoto = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setPhotoCaptured(false);
    setCapturedPhoto(null);
  };

  // Initialize camera when interview data loads (and re-initialize when Retake is clicked)
  useEffect(() => {
    if (interviewData && !photoCaptured) {
      initializeCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [interviewData, photoCaptured]);

  // Manual capture only - no auto-capture

  const startInterview = async () => {
    if (!interviewData) return;
    
    try {
      // Call API to mark interview as started
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.START_INTERVIEW}/${interviewData.id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        console.log('✅ Interview marked as started');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('⚠️ Could not mark interview as started:', errorData.message || 'Unknown error');
      }
    } catch (error) {
      console.warn('⚠️ Error marking interview as started:', error);
    }
    
    // Navigate to the actual interview with the loaded data
    navigate('/conversational-interview', {
      state: {
        interviewId: interviewData.id,
        candidateName: interviewData.candidate_name,
        position: interviewData.position,
        duration: interviewData.duration_minutes,
        currentQuestion: interviewData.questions?.[0],
        functionalWeight: interviewData.functional_weight ?? interviewData.technical_weight,
        softSkillsWeight: interviewData.soft_skills_weight,
        customInstructions: interviewData.custom_instructions,
        interviewType: interviewData.interview_type
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4" />
          <p className="text-base sm:text-lg text-gray-600">Loading your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-6 py-6">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4 flex-shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 break-words">Interview Not Found</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6 break-words">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="min-h-[44px] px-6 py-3 rounded-lg bg-sky-600 text-white text-sm sm:text-base font-medium hover:bg-sky-700 transition-colors touch-manipulation"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Safety net: if interview is already completed/terminated, redirect here as well
  if (interviewData) {
    const status = (interviewData as any).status;
    const assessmentStatus = (interviewData as any).assessment_status;
    const completedAt = (interviewData as any).completed_at;
    if (status === 'completed' || status === 'terminated' || assessmentStatus === 'completed' || !!completedAt) {
      console.log('🏁 (Render guard) Redirecting to completion page...');
      return (
        <Navigate
          to={`/candidate-completion/${(interviewData as any).id}`}
          replace
          state={{
            interviewId: (interviewData as any).id,
            candidateName: (interviewData as any).candidate_name,
            position: (interviewData as any).position
          }}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden lg:overflow-hidden">
      {/* Header: light blue, same as Terms / Privacy Policy; logo size matches Login */}
      <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-3 sm:py-4 lg:py-5">
          <img
            src="/Logo_Transparent_BG.png"
            alt="ProValuate"
            className="h-12 sm:h-16 lg:h-20 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main: on desktop no page scroll; inner area scrolls. On mobile page scrolls. */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden lg:overflow-hidden">
        <div className="flex-1 min-h-0 w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-4 lg:py-6 pb-8 sm:pb-6 lg:pb-6 lg:overflow-y-auto overflow-visible">
        {/* Welcome block */}
        <section className="mb-6 sm:mb-8 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 break-words">
            Welcome, {interviewData.candidate_name}!
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-gray-600 text-sm sm:text-base break-words">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-500" />
              {interviewData.position}
            </span>
            <span className="text-gray-300" aria-hidden>|</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-500" />
              {Math.round(Number(interviewData.duration_minutes) || 30)} minutes
            </span>
          </div>
        </section>

        {/* Two-column layout: stack on mobile, side-by-side on lg */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12">
          {/* Left column */}
          <div className="flex-1 lg:max-w-[50%] order-1 min-w-0">
            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                <Video className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Camera</p>
                  <p className="text-sm sm:text-base font-medium">Required</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                <Mic className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Microphone</p>
                  <p className="text-sm sm:text-base font-medium">Required</p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <section className="mb-4 sm:mb-6">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Instructions</h3>
              <ul className="space-y-2 text-sm sm:text-base text-gray-700 list-disc list-inside pl-1 break-words">
                <li>Capture your photo above first; it is required to start and will be used for your results.</li>
                <li>Ensure your camera and microphone are working and that you allow access when prompted.</li>
                <li>The session runs in fullscreen. Do not exit fullscreen or press ESC during the interview, or it will be terminated.</li>
                <li>Stay on this browser tab; switching tabs can trigger warnings and may end the interview.</li>
                <li>You will be recorded (video and audio). After the AI asks each question, click &quot;Start Recording&quot;, answer clearly, then submit your answer.</li>
                <li>Your speech is transcribed live. You can edit the transcript in the on-screen box or open &quot;Full Transcript - Review & Edit&quot; to correct text before submitting each answer.</li>
                <li>In some questions you will be asked to speak and write. In such cases, <strong>speak first</strong> and record your answer, then <strong>write your query or answer</strong> in the separate text box below the transcription box. First speak, then write.</li>
                <li>Find a quiet environment and speak clearly for the best transcription and evaluation.</li>
              </ul>
            </section>

            {/* Custom Instructions */}
            {interviewData.custom_instructions && (
              <section className="mb-4 sm:mb-6">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Special Instructions</h3>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg min-w-0">
                  <p className="text-amber-900 text-sm sm:text-base break-words">{interviewData.custom_instructions}</p>
                </div>
              </section>
            )}

            {/* System Requirements */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                System Requirements
              </h3>
              <ul className="space-y-3 text-sm sm:text-base text-gray-700 break-words">
                  <li className="flex items-center gap-3 min-w-0">
                    {browserCheck === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    {browserCheck === 'checking' && (
                      <Loader2 className="w-5 h-5 text-sky-600 animate-spin flex-shrink-0" />
                    )}
                    {browserCheck === 'pass' && (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    {browserCheck === 'fail' && (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-relaxed min-w-0">
                      {browserCheck === 'checking' ? 'Checking browser...' : 'Modern web browser'}
                    </span>
                  </li>
                  <li className="flex items-center gap-3 min-w-0">
                    {permissionsCheck === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    {permissionsCheck === 'checking' && (
                      <Loader2 className="w-5 h-5 text-sky-600 animate-spin flex-shrink-0" />
                    )}
                    {permissionsCheck === 'pass' && (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    {permissionsCheck === 'fail' && (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-relaxed min-w-0">
                      {permissionsCheck === 'checking' ? 'Checking camera & microphone permissions...' : 'Camera & microphone permissions'}
                    </span>
                  </li>
                  <li className="flex items-center gap-3 min-w-0">
                    {cameraMicCheck === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    {cameraMicCheck === 'checking' && (
                      <Loader2 className="w-5 h-5 text-sky-600 animate-spin flex-shrink-0" />
                    )}
                    {cameraMicCheck === 'pass' && (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    {cameraMicCheck === 'fail' && (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-relaxed">
                      {cameraMicCheck === 'checking' ? 'Checking camera and microphone...' : 'Working camera and microphone'}
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    {internetCheck === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    {internetCheck === 'checking' && (
                      <Loader2 className="w-5 h-5 text-sky-600 animate-spin flex-shrink-0" />
                    )}
                    {internetCheck === 'pass' && (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    {internetCheck === 'fail' && (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-relaxed min-w-0">
                      {internetCheck === 'checking' ? 'Checking internet connection...' : 'Stable internet connection'}
                    </span>
                  </li>
                </ul>
              </section>
            </div>

            {/* Right: Photo Capture */}
            <div className="flex-1 lg:max-w-[50%] order-2 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 flex items-center justify-center gap-2">
                <Camera className="w-5 h-5 text-sky-600 flex-shrink-0" />
                <span className="break-words">Capture Your Photo</span>
              </h2>
              <p className="text-gray-600 text-sm sm:text-base text-center mb-4 break-words">
                {!photoCaptured
                  ? 'Position yourself in the frame. Required before starting.'
                  : 'Review your photo. You can retake if needed.'}
              </p>

              {!photoCaptured ? (
                <>
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden mb-3 sm:mb-4 aspect-video max-h-[40vh] sm:max-h-[50vh] min-h-[180px] sm:min-h-[200px] border border-gray-200">
                    {!cameraReady ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                        <div className="text-center text-gray-500">
                          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Initializing camera...</p>
                        </div>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Capture Button - touch-friendly min height */}
                  <button
                    onClick={handleCapturePhoto}
                    disabled={isCapturingPhoto || !cameraReady}
                    className="w-full min-h-[44px] sm:min-h-[48px] bg-sky-600 text-white py-3 rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-semibold touch-manipulation"
                  >
                    <Camera className="w-5 h-5" />
                    {isCapturingPhoto ? 'Capturing...' : 'Capture Photo'}
                  </button>
                </>
              ) : (
                <>
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden mb-3 sm:mb-4 aspect-video max-h-[40vh] sm:max-h-[50vh] min-h-[180px] sm:min-h-[200px] border border-gray-200">
                    {capturedPhoto && (
                      <img 
                        src={capturedPhoto} 
                        alt="Captured photo" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Retake Button - touch-friendly min height */}
                  <button
                    onClick={handleRetakePhoto}
                    className="w-full min-h-[44px] sm:min-h-[48px] bg-gray-200 text-gray-800 py-3 rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base font-semibold touch-manipulation"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Retake Photo
                  </button>
                </>
              )}
            </div>
        </div>

        {/* Primary CTA */}
        <section className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
          <button
            onClick={startInterview}
            disabled={!photoCaptured}
            className={`w-full min-h-[48px] py-3 rounded-lg text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 touch-manipulation ${
              photoCaptured
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            Start Interview
          </button>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 text-center px-1">
            {photoCaptured
              ? 'You’re all set. Click above to begin.'
              : 'Capture your photo above to enable Start Interview.'}
          </p>
        </section>
        </div>
      </main>
    </div>
  );
};

export default CandidateInterview;