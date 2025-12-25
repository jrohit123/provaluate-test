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
  RotateCcw
} from 'lucide-react';

const CandidateInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  
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

  // Load interview data
  useEffect(() => {
    const loadInterviewData = async () => {
      try {
        console.log('🔍 CandidateInterview - Loading interview data for ID:', interviewId);
        console.log('🔍 CandidateInterview - Full URL:', `https://devprovaluate_py.aitamate.com/api/get-interview/${interviewId}`);
        setIsLoading(true);
        const response = await fetch(`https://devprovaluate_py.aitamate.com/api/get-interview/${interviewId}`, {
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

  // Initialize camera for photo capture
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
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

  // Attach stream once video element is rendered
  useEffect(() => {
    if (cameraReady && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => {
        console.error('Video play error:', err);
      });
    }
  }, [cameraReady]);

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
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
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
    
    if (photo) {
      setCapturedPhoto(photo);
      setPhotoCaptured(true);
      
      // Store photo in localStorage and sessionStorage
      if (interviewData?.id) {
        const storageKey = `candidate_photo_${interviewData.id}`;
        const timestamp = Date.now();
        
        try {
          localStorage.setItem(storageKey, photo);
          localStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
          sessionStorage.setItem(storageKey, photo);
          sessionStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
          console.log('✅ Photo stored:', storageKey);
        } catch (error) {
          console.error('Error storing photo:', error);
        }
      }
    }
    
    setIsCapturingPhoto(false);
  }, [interviewData?.id]);

  // Handle retake photo
  const handleRetakePhoto = () => {
    setPhotoCaptured(false);
    setCapturedPhoto(null);
  };

  // Initialize camera when interview data loads
  useEffect(() => {
    if (interviewData && !photoCaptured) {
      initializeCamera();
    }
    
    return () => {
      // Cleanup stream
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
      const response = await fetch(`https://devprovaluate_py.aitamate.com/api/start-interview/${interviewData.id}`, {
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
        technicalWeight: interviewData.technical_weight,
        softSkillsWeight: interviewData.soft_skills_weight,
        customInstructions: interviewData.custom_instructions,
        interviewType: interviewData.interview_type
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Interview Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Unified Card Layout */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          {/* Header Section */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <h1 className="text-3xl font-bold text-gray-800 mb-3">
              Welcome, {interviewData.candidate_name}!
            </h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span className="flex items-center gap-1 text-sm">
                <User className="w-4 h-4" />
                {interviewData.position}
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-sm">
                <Clock className="w-4 h-4" />
                {interviewData.duration_minutes} minutes
              </span>
            </div>
          </div>

          <div className="md:flex">
            {/* Left Side: Interview Details */}
            <div className="p-6 md:w-1/2">
              <h2 className="text-2xl font-semibold text-gray-800 mb-5 flex items-center gap-3">
                <User className="text-blue-600 w-6 h-6" />
                Interview Details
              </h2>
              
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Video className="w-4 h-4 text-gray-600" />
                  <div>
                    <p className="text-xs text-gray-500">Camera</p>
                    <p className="text-sm font-medium">Required</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Mic className="w-4 h-4 text-gray-600" />
                  <div>
                    <p className="text-xs text-gray-500">Microphone</p>
                    <p className="text-sm font-medium">Required</p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 text-base">Instructions</h3>
                <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                  <li className="leading-relaxed">Please ensure your camera and microphone are working.</li>
                  <li className="leading-relaxed">You will be recorded throughout the session.</li>
                  <li className="leading-relaxed">You need to first capture your photo, as it will be used for results</li>
                  <li className="leading-relaxed">Without image capture , you cannot start the interview</li>
                  <li className="leading-relaxed">Find a quiet environment for the interview</li>
                  <li className="leading-relaxed">Speak clearly when answering questions</li>
                </ul>
              </div>

              {/* Custom Instructions */}
              {interviewData.custom_instructions && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">Special Instructions</h3>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-xs">{interviewData.custom_instructions}</p>
                  </div>
                </div>
              )}

              {/* System Requirements */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 mb-3 text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  System Requirements
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1.5"></div>
                    <span className="leading-relaxed">Modern web browser</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1.5"></div>
                    <span className="leading-relaxed">Working camera and microphone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1.5"></div>
                    <span className="leading-relaxed">Stable internet connection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1.5"></div>
                    <span className="leading-relaxed">Camera & microphone permissions</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Side: Photo Capture */}
            <div className="p-6 md:w-1/2">
              {!photoCaptured ? (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800 text-center mb-3">
                    📸 Capture Your Photo
                  </h2>
                  <p className="text-gray-600 text-center mb-5 text-base">
                    Position yourself in the frame
                  </p>
                  
                  {/* Video Preview */}
                  <div className="relative bg-gray-200 rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '4/3' }}>
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
                  
                  {/* Capture Button */}
                  <button
                    onClick={handleCapturePhoto}
                    disabled={isCapturingPhoto || !cameraReady}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
                  >
                    <Camera className="w-5 h-5" />
                    {isCapturingPhoto ? 'Capturing...' : 'Capture Photo'}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800 text-center mb-3">
                    ✅ Photo Captured
                  </h2>
                  <p className="text-gray-600 text-center mb-5 text-base">
                    Review your photo
                  </p>
                  
                  {/* Photo Preview */}
                  <div className="relative bg-gray-200 rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '4/3' }}>
                    {capturedPhoto && (
                      <img 
                        src={capturedPhoto} 
                        alt="Captured photo" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Retake Button */}
                  <button
                    onClick={handleRetakePhoto}
                    className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 font-semibold"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Retake Photo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Start Interview Button - Full Width Below Cards */}
        <button
          onClick={startInterview}
          disabled={!photoCaptured}
          className={`w-full py-5 rounded-xl transition-colors text-xl font-semibold flex items-center justify-center gap-3 ${
            photoCaptured
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
          }`}
        >
          <CheckCircle className="w-6 h-6" />
          Start Interview
        </button>
        
        <p className="text-sm text-gray-500 mt-3 text-center">
          {photoCaptured 
            ? 'Click to begin your interview. Good luck!'
            : 'Please capture your photo first to continue'}
        </p>
      </div>
    </div>
  );
};

export default CandidateInterview;