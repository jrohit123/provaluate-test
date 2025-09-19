import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Video, VideoOff, Loader2, CheckCircle, AlertCircle, Play, Pause, Square } from 'lucide-react';
import RecordRTC from 'recordrtc';
import toast from 'react-hot-toast';

const QuestionVideoRecorder = ({ 
  interviewId, 
  questionOrder, 
  questionText, 
  onVideoUploaded, 
  onRecordingComplete,
  isRecording = false,
  onRecordingStateChange 
}) => {
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const videoRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoStreamRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // Initialize video stream
  useEffect(() => {
    const initializeVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1280,
            height: 720,
            frameRate: 24
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });
        
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasVideoStream(true);
        console.log('✅ Video stream initialized for question recording');
      } catch (error) {
        console.error('❌ Error initializing video stream:', error);
        toast.error('Failed to access camera/microphone');
        setHasVideoStream(false);
      }
    };

    if (!videoStreamRef.current) {
      initializeVideo();
    }

    return () => {
      // Cleanup video stream
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start recording individual question video
  const startRecording = useCallback(async () => {
    if (!videoStreamRef.current) {
      toast.error('Video stream not available');
      return;
    }

    try {
      console.log('🎥 Starting question video recording...');
      
      // Create video recorder for individual question
      const recorder = new RecordRTC(videoStreamRef.current, {
        type: 'video',
        mimeType: 'video/webm',
        recorderType: RecordRTC.MediaStreamRecorder,
        quality: 3,                    // Medium quality for smaller files
        frameRate: 15,                 // 15fps for smaller files
        disableLogs: false,
        videoBitsPerSecond: 400000,    // 400 Kbps for smaller files
        timeSlice: 10000,              // 10-second chunks
        ondataavailable: function(blob) {
          console.log('🎥 Video chunk available:', blob.type, blob.size);
        }
      });

      videoRecorderRef.current = recorder;
      recorder.startRecording();
      
      // Start duration timer
      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);

      setIsVideoRecording(true);
      setRecordingDuration(0);
      setVideoBlob(null);
      setVideoUrl(null);
      
      // Notify parent component
      if (onRecordingStateChange) {
        onRecordingStateChange(true);
      }
      
      console.log('✅ Question video recording started');
      toast.success('Question video recording started');
      
    } catch (error) {
      console.error('❌ Error starting video recording:', error);
      toast.error('Failed to start video recording');
    }
  }, [onRecordingStateChange]);

  // Stop recording individual question video
  const stopRecording = useCallback(async () => {
    if (!videoRecorderRef.current) {
      return;
    }

    try {
      console.log('🎥 Stopping question video recording...');
      
      // Stop recording
      videoRecorderRef.current.stopRecording(() => {
        const blob = videoRecorderRef.current.getBlob();
        console.log('🎥 Question video recording completed:', blob.size, 'bytes');
        
        // Create video URL for preview
        const url = URL.createObjectURL(blob);
        setVideoBlob(blob);
        setVideoUrl(url);
        
        // Stop duration timer
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        
        setIsVideoRecording(false);
        
        // Notify parent component
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
        
        if (onRecordingComplete) {
          onRecordingComplete(blob, recordingDuration);
        }
        
        console.log('✅ Question video recording stopped');
        toast.success('Question video recording completed');
      });
      
    } catch (error) {
      console.error('❌ Error stopping video recording:', error);
      toast.error('Failed to stop video recording');
      setIsVideoRecording(false);
    }
  }, [recordingDuration, onRecordingStateChange, onRecordingComplete]);

  // Upload question video to server
  const uploadQuestionVideo = useCallback(async () => {
    if (!videoBlob) {
      toast.error('No video to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('📤 Uploading question video...');
      
      // Convert blob to base64
      const arrayBuffer = await videoBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Data = btoa(String.fromCharCode(...uint8Array));
      
      // Prepare upload data
      const uploadData = {
        interview_id: interviewId,
        question_order: questionOrder,
        question_text: questionText,
        video_data: base64Data,
        video_format: 'webm',
        video_quality: 'medium'
      };

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload to server
      const response = await fetch('http://localhost:5003/api/upload-question-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Question video uploaded successfully:', result.video_url);
        toast.success('Question video uploaded successfully');
        
        // Notify parent component
        if (onVideoUploaded) {
          onVideoUploaded({
            video_url: result.video_url,
            video_filename: result.video_filename,
            question_order: questionOrder,
            question_text: questionText,
            duration: recordingDuration
          });
        }
        
        // Reset state
        setVideoBlob(null);
        setVideoUrl(null);
        setRecordingDuration(0);
        
      } else {
        throw new Error(result.error || 'Upload failed');
      }
      
    } catch (error) {
      console.error('❌ Error uploading question video:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [videoBlob, interviewId, questionOrder, questionText, recordingDuration, onVideoUploaded]);

  // Format duration for display
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="question-video-recorder bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Camera className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            Question {questionOrder + 1} Video
          </h3>
        </div>
        
        {isVideoRecording && (
          <div className="flex items-center space-x-2 text-red-600">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              Recording {formatDuration(recordingDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Video Preview */}
      <div className="relative mb-4">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-48 bg-gray-900 rounded-lg object-cover"
        />
        
        {!hasVideoStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
            <div className="text-center text-white">
              <VideoOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Camera not available</p>
            </div>
          </div>
        )}
        
        {videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <video
              src={videoUrl}
              controls
              className="w-full h-full rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Question Text */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700 line-clamp-2">
          {questionText}
        </p>
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!isVideoRecording && !videoBlob && (
            <button
              onClick={startRecording}
              disabled={!hasVideoStream || isRecording}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Video className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          )}
          
          {isVideoRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              <span>Stop Recording</span>
            </button>
          )}
          
          {videoBlob && !isUploading && (
            <button
              onClick={uploadQuestionVideo}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Upload Video</span>
            </button>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">
              Uploading... {uploadProgress}%
            </span>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {videoBlob && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">
              Video recorded ({formatDuration(recordingDuration)}) - Ready to upload
            </span>
          </div>
        </div>
      )}
      
      {!hasVideoStream && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2 text-yellow-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              Camera access required for video recording
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionVideoRecorder;
