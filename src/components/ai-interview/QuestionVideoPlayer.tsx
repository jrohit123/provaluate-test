import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, Eye, Clock, FileText } from 'lucide-react';

const QuestionVideoPlayer = ({ 
  videoData, 
  questionText, 
  answerText, 
  score, 
  feedback, 
  competencyName,
  onVideoClick 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Autoplay video when component mounts or video source changes
  useEffect(() => {
    if (videoRef.current && videoData.video_url) {
      // Set muted to true for autoplay to work (browser requirement)
      videoRef.current.muted = true;
      setIsMuted(true);
      
      // Attempt to autoplay
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.log('Autoplay prevented:', error);
            // If autoplay fails, we'll keep the play button visible
            setIsPlaying(false);
          });
      }
    }
  }, [videoData.video_url]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Control functions
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        } else if (containerRef.current.webkitRequestFullscreen) {
          containerRef.current.webkitRequestFullscreen();
        } else if (containerRef.current.msRequestFullscreen) {
          containerRef.current.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    }
  };

  const downloadVideo = () => {
    if (videoData.video_url) {
      const link = document.createElement('a');
      link.href = videoData.video_url;
      link.download = `question_${videoData.question_order + 1}_video.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Format time for display
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div 
      ref={containerRef}
      className="question-video-player bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
    >
      {/* Video Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-600">
              {videoData.question_order + 1}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Question {videoData.question_order + 1}
            </h3>
            <p className="text-sm text-gray-600">
              {competencyName || 'Technical Assessment'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`text-lg font-bold ${getScoreColor(score)}`}>
            {score}/100
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative">
        <video
          ref={videoRef}
          src={videoData.video_url}
          className="w-full h-64 bg-black object-cover"
          autoPlay
          muted
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onClick={onVideoClick}
        />
        
        {/* Video Overlay Controls */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all duration-200"
            >
              <Play className="w-8 h-8 text-gray-800 ml-1" />
            </button>
          )}
        </div>

        {/* Video Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center space-x-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            {/* Progress Bar */}
            <div className="flex-1 bg-gray-600 bg-opacity-50 rounded-full h-1">
              <div 
                className="bg-white h-1 rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            {/* Time Display */}
            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Volume Control */}
            <button
              onClick={toggleMute}
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <Maximize2 className="w-5 h-5" />
            </button>

            {/* Download Button */}
            <button
              onClick={downloadVideo}
              className="text-white hover:text-gray-300 transition-colors"
              title="Download video"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Question and Answer Details */}
      {showDetails && (
        <div className="p-4 space-y-4">
          {/* Question */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h4 className="font-semibold text-gray-800">Question</h4>
            </div>
            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
              {questionText}
            </p>
          </div>

          {/* Answer */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-green-600" />
              <h4 className="font-semibold text-gray-800">Answer</h4>
              <span className="text-sm text-gray-500">
                ({formatTime(videoData.duration || duration)})
              </span>
            </div>
            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
              {answerText || 'No transcript available'}
            </p>
          </div>

          {/* Feedback */}
          {feedback && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Feedback</h4>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-gray-700 text-sm">{feedback}</p>
              </div>
            </div>
          )}

          {/* Video Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Video Size:</span> 
              <span className="ml-2">
                {videoData.video_size ? `${(videoData.video_size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium">Format:</span> 
              <span className="ml-2">{videoData.video_format || 'webm'}</span>
            </div>
            <div>
              <span className="font-medium">Quality:</span> 
              <span className="ml-2">{videoData.video_quality || 'medium'}</span>
            </div>
            <div>
              <span className="font-medium">Recorded:</span> 
              <span className="ml-2">
                {videoData.created_at ? new Date(videoData.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionVideoPlayer;
