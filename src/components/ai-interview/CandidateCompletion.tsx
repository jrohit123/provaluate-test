import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { buildApiUrl, API_CONFIG } from '@/constants/api';

const CandidateCompletion = () => {
  const location = useLocation();
  const params = useParams();
  const [candidateName, setCandidateName] = useState<string | undefined>((location.state as any)?.candidateName);
  const [position, setPosition] = useState<string | undefined>((location.state as any)?.position);
  const [interviewStatus, setInterviewStatus] = useState<'completed' | 'terminated' | 'loading'>('loading');
  const [terminationReason, setTerminationReason] = useState<string | undefined>(undefined);
  const interviewId = (location.state as any)?.interviewId || params.interviewId;

  // Track completion page view and hydrate details when opened directly
  useEffect(() => {
    const run = async () => {
      if (!interviewId) return;
      
      try {
        await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TRACK_COMPLETION_VIEW}/${interviewId}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('✅ Completion page view tracked');
      } catch (error) {
        console.warn('⚠️ Could not track completion view:', error);
      }

      // Fetch interview details to check status and get candidate info
        try {
          const resp = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewId}`));
          if (resp.ok) {
            const data = await resp.json();
            const interview = data.interview || data; // support both formats
          
          // Set candidate info
          if (!candidateName) setCandidateName(interview.candidate_name);
          if (!position) setPosition(interview.position);
          
          // Check interview status
          const status = interview.status;
          if (status === 'terminated') {
            setInterviewStatus('terminated');
            setTerminationReason(interview.termination_reason || 'Interview was terminated');
          } else {
            setInterviewStatus('completed');
          }
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch interview details for completion page');
        // Default to completed if we can't fetch (for backward compatibility)
        setInterviewStatus('completed');
      }
    };
    run();
  }, [interviewId, candidateName, position]);

  // Show loading state
  if (interviewStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interview details...</p>
        </div>
      </div>
    );
  }

  const isTerminated = interviewStatus === 'terminated';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${isTerminated ? 'from-red-50 to-orange-50' : 'from-green-50 to-blue-50'} flex items-center justify-center p-6`}>
      <div className="max-w-2xl mx-auto text-center">
        {/* Icon - Success or Warning */}
        <div className="mb-8">
          <div className={`w-24 h-24 ${isTerminated ? 'bg-red-500' : 'bg-green-500'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {isTerminated ? (
              <XCircle className="w-12 h-12 text-white" />
            ) : (
            <CheckCircle className="w-12 h-12 text-white" />
            )}
          </div>
        </div>

        {/* Main Message */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className={`text-3xl font-bold mb-4 ${isTerminated ? 'text-red-800' : 'text-gray-800'}`}>
            {isTerminated ? 'Interview Terminated' : 'Interview Completed!'}
          </h1>
          
          <p className="text-xl text-gray-600 mb-6">
            {isTerminated ? (
              <>
                We're sorry, <span className="font-semibold text-red-600">{candidateName}</span>.
              </>
            ) : (
              <>
            Thank you, <span className="font-semibold text-blue-600">{candidateName}</span>!
              </>
            )}
          </p>
          
          <div className={`${isTerminated ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6 mb-6`}>
            {isTerminated ? (
              <div>
                <p className={`${isTerminated ? 'text-red-800' : 'text-blue-800'} text-lg mb-3`}>
                  Your interview for the <span className="font-semibold">{position}</span> position has been terminated.
                </p>
                {terminationReason && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-sm font-semibold text-red-700 mb-1">Reason:</p>
                    <p className="text-sm text-red-600">{terminationReason}</p>
                  </div>
                )}
              </div>
            ) : (
            <p className="text-blue-800 text-lg">
              You have successfully completed your <span className="font-semibold">{position}</span> interview.
            </p>
            )}
          </div>
          
          {isTerminated ? (
            <div className="text-left">
              <p className="text-gray-600 leading-relaxed mb-4">
                Unfortunately, your interview was terminated due to a violation of the interview guidelines. 
                This may include actions such as:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4 ml-4">
                <li>Switching tabs or windows during the interview</li>
                <li>Turning off the camera</li>
                <li>Exiting fullscreen mode</li>
                <li>Other policy violations</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                If you believe this was an error, please contact the hiring team for assistance.
              </p>
            </div>
          ) : (
          <p className="text-gray-600 leading-relaxed">
            We appreciate your time and thoughtful responses today. Our team will carefully review your interview 
            and get back to you with next steps in the hiring process.
          </p>
          )}
        </div>

        {/* Next Steps - Only show for completed interviews */}
        {!isTerminated && (
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center justify-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            What Happens Next?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 font-semibold">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Review Process</h3>
                <p className="text-gray-600 text-sm">
                  Our team will review your interview responses and evaluate your qualifications.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 font-semibold">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Follow-up</h3>
                <p className="text-gray-600 text-sm">
                  If you are selected for the next round, you will receive an email within 3-5 business days with further steps.
                </p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            {isTerminated 
              ? 'If you have questions, please contact the hiring team.' 
              : 'Thank you for your interest in joining our team!'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default CandidateCompletion;
