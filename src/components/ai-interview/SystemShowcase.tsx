import React, { useState, useEffect } from 'react';
import {
  Mic,
  Video,
  Brain,
  MessageSquare,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Camera,
  User,
  Bot,
  CheckCircle,
  Clock,
  BarChart3,
  FileText,
  Zap,
  Headphones,
  Languages,
  Settings
} from 'lucide-react';

const SystemShowcase = () => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const features = [
    {
      id: 0,
      title: "AI-Powered Interview Assistant",
      description: "Intelligent AI interviewer that adapts questions based on candidate responses and provides real-time feedback.",
      icon: <Bot className="w-12 h-12 text-blue-500" />,
      animation: "ai-interview",
      duration: 4000
    },
    {
      id: 1,
      title: "Individual Question Video Recording",
      description: "Record each question-answer pair separately for efficient storage and easy review.",
      icon: <Video className="w-12 h-12 text-red-500" />,
      animation: "video-recording",
      duration: 4000
    },
    {
      id: 2,
      title: "Real-time Speech Transcription",
      description: "Advanced speech-to-text with 99% accuracy across multiple languages.",
      icon: <Mic className="w-12 h-12 text-green-500" />,
      animation: "transcription",
      duration: 4000
    },
    {
      id: 3,
      title: "Multi-language Translation",
      description: "Instant translation to 50+ languages for global candidate accessibility.",
      icon: <Languages className="w-12 h-12 text-purple-500" />,
      animation: "translation",
      duration: 4000
    },
    {
      id: 4,
      title: "Custom Parameter Assessment",
      description: "Evaluate candidates on specific skills and competencies with AI-powered scoring.",
      icon: <BarChart3 className="w-12 h-12 text-orange-500" />,
      animation: "assessment",
      duration: 4000
    },
    {
      id: 5,
      title: "Comprehensive Results Dashboard",
      description: "Detailed analytics, video playback, and performance insights for informed hiring decisions.",
      icon: <FileText className="w-12 h-12 text-indigo-500" />,
      animation: "dashboard",
      duration: 4000
    }
  ];

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentFeature((prev) => (prev + 1) % features.length);
      }, features[currentFeature].duration);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentFeature, features]);

  const playShowcase = () => {
    setIsPlaying(true);
  };

  const pauseShowcase = () => {
    setIsPlaying(false);
  };

  const nextFeature = () => {
    setCurrentFeature((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setCurrentFeature((prev) => (prev - 1 + features.length) % features.length);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const renderAnimation = (animationType) => {
    switch (animationType) {
      case "ai-interview":
        return (
          <div className="relative w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl overflow-hidden">
            {/* AI Interviewer */}
            <div className="absolute top-8 left-8 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div className="bg-white rounded-lg p-3 shadow-lg animate-bounce">
                <p className="text-sm font-medium">Hello! Let's begin your interview.</p>
              </div>
            </div>
            
            {/* Candidate */}
            <div className="absolute bottom-8 right-8 flex items-center gap-4">
              <div className="bg-white rounded-lg p-3 shadow-lg">
                <p className="text-sm">Thank you, I'm ready!</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-blue-400 rounded-full animate-bounce opacity-60"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${30 + i * 10}%`,
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: '2s'
                  }}
                />
              ))}
            </div>
          </div>
        );

      case "video-recording":
        return (
          <div className="relative w-full h-64 bg-gradient-to-br from-red-50 to-pink-100 rounded-xl overflow-hidden">
            {/* Video Recording Interface */}
            <div className="absolute inset-4 bg-black rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse mb-4">
                  <Video className="w-10 h-10 text-white" />
                </div>
                <div className="text-white text-sm font-medium">Recording Question 1</div>
                <div className="text-red-400 text-xs mt-1">00:00:15</div>
              </div>
            </div>
            
            {/* Recording indicator */}
            <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              REC
            </div>

            {/* Video chunks */}
            <div className="absolute bottom-4 left-4 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-6 bg-gray-700 rounded border border-gray-600 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        );

      case "transcription":
        return (
          <div className="relative w-full h-64 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl overflow-hidden">
            {/* Transcription Interface */}
            <div className="absolute inset-4 bg-white rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Mic className="w-4 h-4 text-white" />
                </div>
                <div className="text-sm font-medium text-gray-700">Live Transcription</div>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-green-400 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 20 + 10}px`,
                        animationDelay: `${i * 0.1}s`
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="bg-gray-100 rounded p-2 text-sm animate-pulse">
                  "I have experience with React and Node.js..."
                </div>
                <div className="bg-gray-100 rounded p-2 text-sm animate-pulse" style={{animationDelay: '0.5s'}}>
                  "I've worked on several full-stack projects..."
                </div>
                <div className="bg-green-100 rounded p-2 text-sm animate-pulse" style={{animationDelay: '1s'}}>
                  "My strongest skill is problem-solving..."
                </div>
              </div>
            </div>
          </div>
        );

      case "translation":
        return (
          <div className="relative w-full h-64 bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl overflow-hidden">
            {/* Translation Interface */}
            <div className="absolute inset-4 bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium">Translation</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Spanish</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">English</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-purple-50 rounded p-3">
                  <div className="text-xs text-purple-600 mb-1">Original (Spanish)</div>
                  <div className="text-sm">"Tengo experiencia en desarrollo web..."</div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="bg-green-50 rounded p-3 animate-pulse">
                  <div className="text-xs text-green-600 mb-1">Translated (English)</div>
                  <div className="text-sm">"I have experience in web development..."</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "assessment":
        return (
          <div className="relative w-full h-64 bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl overflow-hidden">
            {/* Assessment Interface */}
            <div className="absolute inset-4 bg-white rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-orange-500" />
                <span className="text-sm font-medium">AI Assessment</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Technical Skills</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="w-12 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <span className="text-sm font-medium">8/10</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Communication</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="w-14 h-2 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                    </div>
                    <span className="text-sm font-medium">9/10</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Problem Solving</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="w-10 h-2 bg-orange-500 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
                    </div>
                    <span className="text-sm font-medium">7/10</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <div className="text-xs text-blue-600 mb-1">AI Feedback</div>
                <div className="text-sm">"Strong technical foundation with excellent communication skills..."</div>
              </div>
            </div>
          </div>
        );

      case "dashboard":
        return (
          <div className="relative w-full h-64 bg-gradient-to-br from-indigo-50 to-blue-100 rounded-xl overflow-hidden">
            {/* Dashboard Interface */}
            <div className="absolute inset-4 bg-white rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-indigo-500" />
                <span className="text-sm font-medium">Results Dashboard</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded p-3">
                  <div className="text-xs text-indigo-600 mb-1">Overall Score</div>
                  <div className="text-2xl font-bold text-indigo-700">8.5/10</div>
                </div>
                
                <div className="bg-green-50 rounded p-3">
                  <div className="text-xs text-green-600 mb-1">Questions</div>
                  <div className="text-2xl font-bold text-green-700">5/5</div>
                </div>
                
                <div className="bg-purple-50 rounded p-3">
                  <div className="text-xs text-purple-600 mb-1">Duration</div>
                  <div className="text-lg font-bold text-purple-700">12:34</div>
                </div>
                
                <div className="bg-orange-50 rounded p-3">
                  <div className="text-xs text-orange-600 mb-1">Videos</div>
                  <div className="text-2xl font-bold text-orange-700">5</div>
                </div>
              </div>
              
              <div className="mt-3 flex gap-2">
                <div className="flex-1 bg-gray-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-600">View Videos</div>
                </div>
                <div className="flex-1 bg-gray-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-600">Download Report</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">AI Interview System Showcase</h2>
            <p className="text-blue-100 mt-1">Experience the future of intelligent interviewing</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={prevFeature}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button
                onClick={isPlaying ? pauseShowcase : playShowcase}
                className="p-3 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              
              <button
                onClick={nextFeature}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-100 h-1">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-1 transition-all duration-300 ease-out"
          style={{ width: `${((currentFeature + 1) / features.length) * 100}%` }}
        />
      </div>

      {/* Animation Area - Now at the top */}
      <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-3xl mx-auto">
          {renderAnimation(features[currentFeature].animation)}
        </div>
      </div>

      {/* Feature Display - Now below the animation */}
      <div className="p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          {/* Feature Info */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              {features[currentFeature].icon}
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {features[currentFeature].title}
                </h3>
                <p className="text-sm text-gray-500">
                  Feature {currentFeature + 1} of {features.length}
                </p>
              </div>
            </div>
            
            <p className="text-gray-600 leading-relaxed mb-6 max-w-lg mx-auto">
              {features[currentFeature].description}
            </p>
            
            {/* Feature Indicators */}
            <div className="flex gap-2 justify-center">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentFeature(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentFeature 
                      ? 'bg-blue-500' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 p-6 border-t">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>Real-time</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-500" />
              <span>Customizable</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Auto-play: {isPlaying ? 'On' : 'Off'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemShowcase;
