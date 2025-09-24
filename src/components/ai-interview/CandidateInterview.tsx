import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Clock,
  Video,
  Mic,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

const CandidateInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [interviewData, setInterviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load interview data
  useEffect(() => {
    const loadInterviewData = async () => {
      try {
        console.log('🔍 CandidateInterview - Loading interview data for ID:', interviewId);
        console.log('🔍 CandidateInterview - Full URL:', `http://localhost:5003/api/get-interview/${interviewId}`);
        setIsLoading(true);
        const response = await fetch(`http://localhost:5003/api/get-interview/${interviewId}`, {
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

  const startInterview = async () => {
    if (!interviewData) return;
    
    try {
      // Call API to mark interview as started
      const response = await fetch(`http://localhost:5003/api/start-interview/${interviewData.id}`, {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome, {interviewData.candidate_name}!
          </h1>
          <p className="text-gray-600 text-lg">
            You're about to begin your {interviewData.position} interview
          </p>
        </div>

        {/* Interview Details */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="text-blue-600" />
            Interview Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-600" />
                             <div>
                 <p className="text-sm text-gray-500">Position</p>
                 <p className="font-medium">{interviewData.position}</p>
               </div>
             </div>
             
             <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
               <Clock className="w-5 h-5 text-gray-600" />
               <div>
                 <p className="text-sm text-gray-500">Duration</p>
                 <p className="font-medium">{interviewData.duration_minutes} minutes</p>
               </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Video className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-500">Camera Required</p>
                <p className="font-medium">Yes</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mic className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-500">Microphone Required</p>
                <p className="font-medium">Yes</p>
              </div>
            </div>
          </div>


          {/* Instructions */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">Instructions</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Please ensure your camera and microphone are working</p>
              <p>• Find a quiet environment for the interview</p>
              <p>• Speak clearly when answering questions</p>
            </div>
          </div>

                     {/* Custom Instructions */}
           {interviewData.custom_instructions && (
             <div className="mb-6">
               <h3 className="font-medium text-gray-800 mb-2">Special Instructions</h3>
               <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                 <p className="text-yellow-800">{interviewData.custom_instructions}</p>
               </div>
             </div>
           )}
        </div>

        {/* Requirements Check */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-600" />
            System Requirements
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Modern web browser (Chrome, Firefox, Safari, Edge)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Working camera and microphone</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Stable internet connection</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Permission to access camera and microphone</span>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <button
            onClick={startInterview}
            className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold flex items-center gap-3 mx-auto"
          >
            <CheckCircle className="w-6 h-6" />
            Start Interview
          </button>
          <p className="text-sm text-gray-500 mt-3">
            Click to begin your interview. Good luck!
          </p>
        </div>
      </div>
    </div>
  );
};

export default CandidateInterview;
