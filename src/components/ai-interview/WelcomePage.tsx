import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, Shield, Star,
  Play, Sparkles, Globe, Headphones,
  Languages, Users, Settings, Award,
  X, Video, MessageSquare, CheckCircle,
  ChevronDown, ChevronUp, Mic, BarChart3, Pause
} from 'lucide-react';
import AitamateLogo from './AitamateLogo';
import SystemShowcase from './SystemShowcase';

const WelcomePage = () => {
  const navigate = useNavigate();

  const [openFaq, setOpenFaq] = useState(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const walkthroughSteps = [
    {
      id: 1,
      title: "Welcome to AitamateAI",
      description: "Start your journey with our AI-powered interview system. Click 'Dashboard' to begin creating your first interview.",
      target: "dashboard-button",
      position: "bottom",
      action: "Click the Dashboard button to proceed"
    },
    {
      id: 2,
      title: "Create New Interview",
      description: "Set up your interview by entering candidate details, position, and custom parameters. Our system will generate relevant questions automatically.",
      target: "create-interview",
      position: "right",
      action: "Fill in the interview details"
    },
    {
      id: 3,
      title: "Customize Parameters",
      description: "Choose from predefined parameters or create custom ones. Each parameter will generate specific questions to assess the candidate's skills.",
      target: "parameters-section",
      position: "left",
      action: "Select your assessment parameters"
    },
    {
      id: 4,
      title: "AI Interview Session",
      description: "Watch as our AI conducts the interview in real-time. Each question is asked naturally, and responses are recorded individually.",
      target: "interview-session",
      position: "top",
      action: "Observe the AI interview process"
    },
    {
      id: 5,
      title: "Individual Video Recording",
      description: "Our unique feature: Each question-answer pair is recorded separately. No long session videos - just clean, individual recordings for easy review.",
      target: "video-recording",
      position: "bottom",
      action: "See individual question videos"
    },
    {
      id: 6,
      title: "Real-time Transcription",
      description: "Watch as speech is converted to text in real-time. Support for 50+ languages with instant translation capabilities.",
      target: "transcription",
      position: "left",
      action: "Experience real-time transcription"
    },
    {
      id: 7,
      title: "AI Assessment Results",
      description: "Get comprehensive results with detailed scores for each parameter. Review individual question videos and assessment feedback.",
      target: "results-dashboard",
      position: "right",
      action: "Review assessment results"
    },
    {
      id: 8,
      title: "Complete!",
      description: "You've seen how AitamateAI works! Ready to create your first interview? Click 'Dashboard' to get started.",
      target: "finish",
      position: "center",
      action: "Start using AitamateAI"
    }
  ];

  const faqs = [
    {
      id: 1,
      question: "How does the individual question video recording work?",
      answer: "Our system records each question-answer pair separately. When the AI asks a question, recording starts automatically. It captures the candidate's complete response with facial expressions and body language, then stops when they submit their answer. This creates clean, individual videos for each question without any welcome messages or feedback included."
    },
    {
      id: 2,
      question: "What languages are supported for transcription and translation?",
      answer: "We support 50+ languages for real-time transcription and translation. You can speak in your native language and get instant English translation, or vice versa. This makes it perfect for international candidates and global companies."
    },
    {
      id: 3,
      question: "How accurate is the AI assessment and feedback?",
      answer: "Our AI provides highly accurate assessments based on multiple parameters including communication skills, technical knowledge, problem-solving abilities, and cultural fit. The system analyzes speech patterns, response quality, and provides detailed feedback with scores for each parameter."
    },
    {
      id: 4,
      question: "Can I customize the interview parameters and questions?",
      answer: "Yes! HR can create custom interview parameters based on specific job requirements. The system automatically generates relevant questions for each parameter, and you can also add custom questions. This ensures interviews are tailored to your exact needs."
    },
    {
      id: 5,
      question: "How secure is the interview data and video recordings?",
      answer: "All interview data is encrypted and stored securely. Video recordings are stored in private cloud storage with access controls. We comply with GDPR and other privacy regulations. Only authorized users can access the interview results."
    },
    {
      id: 6,
      question: "What makes this different from other interview platforms?",
      answer: "Our unique individual question video recording system sets us apart. Instead of one long session video, you get separate videos for each question-answer pair, making it much easier to review specific responses. Combined with real-time translation, AI assessment, and custom parameters, we provide the most comprehensive interview solution available."
    }
  ];
  const nextStep = () => {
    if (currentStep < walkthroughSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowWalkthrough(false);
      setCurrentStep(0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const startWalkthrough = () => {
    setShowWalkthrough(true);
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="scale-150">
              <AitamateLogo size="xlarge" showTagline={false} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Globe className="w-4 h-4" />
                  <span>Real-time Translation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Secure & Private</span>
                </div>
              </div>
              <button 
                onClick={() => navigate('/why-aitamate')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all"
              >
                Why Aitamate
              </button>

              <button 
                onClick={() => navigate('/dashboard')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        
        {/* Interactive Walkthrough Overlay */}
        {showWalkthrough && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
            {/* Walkthrough Content */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Step {currentStep + 1} of {walkthroughSteps.length}</span>
                    <button 
                      onClick={() => setShowWalkthrough(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentStep + 1) / walkthroughSteps.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Step Content */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">{currentStep + 1}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {walkthroughSteps[currentStep].title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-4">
                    {walkthroughSteps[currentStep].description}
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-800 font-medium">
                      💡 {walkthroughSteps[currentStep].action}
                    </p>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentStep === 0 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Previous
                  </button>
                  
                  <button
                    onClick={nextStep}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all"
                  >
                    {currentStep === walkthroughSteps.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>


              </div>
            </div>

            {/* Background Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/30"></div>
            </div>
          </div>
        )}
        

        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Where every word
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"> becomes magic</span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Where words become opportunities and every interview tells a story of success. 
            Real-time transcription captures your voice, instant translation breaks barriers, 
            and AI practice turns nerves into confidence.
          </p>
          
          <div className="flex items-center justify-center mb-8">
            <button
              onClick={() => navigate('/hr/create-interview')}
              className="bg-blue-600 hover:bg-blue-700 
                       text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 
                       shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center gap-3 text-lg"
            >
              <Users className="w-6 h-6" />
              HR - Create Interview
            </button>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span>✓ Real-time transcription</span>
            <span>✓ 50+ languages supported</span>
            <span>✓ AI-powered feedback</span>
          </div>
          

        </div>

        {/* Demo Section */}
        <div className="mb-16">
          {/* Animated Showcase */}
          <SystemShowcase />
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="group bg-white rounded-3xl p-8 shadow-lg border border-blue-200 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:border-blue-300">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Headphones className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Individual Video Recording</h3>
            <p className="text-gray-600 leading-relaxed">
              Individual question video recording system that captures each Q&A pair separately. Records candidate responses with facial expressions and body language for comprehensive review.
            </p>
          </div>

          <div className="group bg-white rounded-3xl p-8 shadow-lg border border-blue-200 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:border-blue-300">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Languages className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Real-time Transcription & Translation</h3>
            <p className="text-gray-600 leading-relaxed">
              Real-time transcription and translation in 50+ languages. Speak in your native language and get instant English translation, perfect for international candidates and global companies.
            </p>
          </div>

          <div className="group bg-white rounded-3xl p-8 shadow-lg border border-blue-200 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:border-blue-300">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">AI Assessment & Custom Parameters</h3>
            <p className="text-gray-600 leading-relaxed">
              AI assessment with custom parameters for technical knowledge, communication skills, problem-solving, and cultural fit. Get detailed scores and feedback for each parameter.
            </p>
          </div>
        </div>

        {/* Success Stories */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Trusted by Global Professionals</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-blue-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">Software Engineer</div>
                  <div className="text-gray-500 text-sm">Tech Company</div>
                </div>
              </div>
              <p className="text-gray-600 italic leading-relaxed">
                "AitamateAI helped me practice technical interviews in English while thinking in my native language. The real-time translation feature was a game-changer!"
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-blue-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">Product Manager</div>
                  <div className="text-gray-500 text-sm">Startup</div>
                </div>
              </div>
              <p className="text-gray-600 italic leading-relaxed">
                "The AI feedback on my speaking pace and confidence level helped me improve significantly. Landed my dream job after 2 weeks of practice!"
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Frequently Asked Questions</h2>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                    className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-gray-800 pr-4">{faq.question}</h3>
                    {openFaq === faq.id ? (
                      <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === faq.id && (
                    <div className="px-8 pb-6">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>




    </div>
  );
};

export default WelcomePage;

