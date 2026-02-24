import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, Mail, FileText, List } from 'lucide-react';
import { buildApiUrl, API_CONFIG } from '@/constants/api';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';

const CandidateCompletion = () => {
  const location = useLocation();
  const params = useParams();
  const { user } = useAuthContext();
  const isCandidateUser = isCandidate(user);
  const [candidateName, setCandidateName] = useState<string | undefined>((location.state as any)?.candidateName);
  const [position, setPosition] = useState<string | undefined>((location.state as any)?.position);
  const [interviewStatus, setInterviewStatus] = useState<'completed' | 'terminated' | 'loading'>('loading');
  const [terminationReason, setTerminationReason] = useState<string | undefined>(undefined);
  const interviewId = (location.state as any)?.interviewId || params.interviewId;

  useEffect(() => {
    const run = async () => {
      if (!interviewId) return;

      try {
        await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TRACK_COMPLETION_VIEW}/${interviewId}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        // ignore
      }

      try {
        const resp = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewId}`));
        if (resp.ok) {
          const data = await resp.json();
          const interview = data.interview || data;
          if (!candidateName) setCandidateName(interview.candidate_name);
          if (!position) setPosition(interview.position);
          const status = interview.status;
          // Only show "Interview Completed" when backend explicitly marks as completed.
          // Show "Interview Terminated" for: end interview, tab switching, escape, or any other termination.
          if (status === 'terminated') {
            setInterviewStatus('terminated');
            setTerminationReason(interview.termination_reason || 'Interview was terminated');
          } else if (status === 'completed') {
            setInterviewStatus('completed');
          } else {
            // status is 'active', undefined, or anything else – do not show completion
            setInterviewStatus('terminated');
            setTerminationReason(interview.termination_reason || 'Interview ended.');
          }
        } else {
          setInterviewStatus('terminated');
          setTerminationReason('Unable to verify interview status. Please contact support if you believe this is an error.');
        }
      } catch {
        setInterviewStatus('terminated');
        setTerminationReason('Unable to verify interview status. Please contact support if you believe this is an error.');
      }
    };
    run();
  }, [interviewId, candidateName, position]);

  if (interviewStatus === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-3 sm:py-4 lg:py-5">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-12 sm:h-16 lg:h-20 w-auto object-contain"
            />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e5da8] mx-auto mb-4" />
            <p className="text-base sm:text-lg text-gray-600">Loading interview details...</p>
          </div>
        </div>
      </div>
    );
  }

  const isTerminated = interviewStatus === 'terminated';

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      {/* Header - same as CandidateInterview */}
      <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-3 sm:py-4 lg:py-5">
          <img
            src="/Logo_Transparent_BG.png"
            alt="ProValuate"
            className="h-12 sm:h-16 lg:h-20 w-auto object-contain"
          />
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 lg:py-10">
        {/* Status icon - same blue as Contact Sales */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-[#1e5da8]/10">
            {isTerminated ? (
              <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#1e5da8]" />
            ) : (
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#1e5da8]" />
            )}
          </div>
        </div>

        {/* Main content - no border */}
        <div className="mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 text-center">
              {isTerminated ? 'Interview Terminated' : 'Interview Completed'}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-6 text-center">
              {isTerminated ? (
                <>
                  We're sorry, <span className="font-semibold text-gray-900">{candidateName || 'there'}</span>.
                </>
              ) : (
                <>
                  Thank you, <span className="font-semibold text-gray-900">{candidateName || 'there'}</span>.
                </>
              )}
            </p>

            <div className="rounded-lg border border-[#1e5da8]/20 bg-[#1e5da8]/5 p-4 sm:p-6 mb-6">
              {isTerminated ? (
                <div>
                  <p className="text-gray-800 text-sm sm:text-base mb-3">
                    Your interview for the <span className="font-semibold">{position}</span> position has been
                    terminated.
                  </p>
                  {terminationReason && (
                    <div className="mt-3 pt-3 border-t border-[#1e5da8]/20">
                      <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">Reason</p>
                      <p className="text-xs sm:text-sm text-gray-700">{terminationReason}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-800 text-sm sm:text-base">
                  You have successfully completed your <span className="font-semibold">{position}</span> interview.
                </p>
              )}
            </div>

            {isTerminated ? (
              <div className="text-left space-y-3">
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  Your interview was terminated due to a violation of the interview guidelines. This may include:
                </p>
                <ul className="list-disc list-inside text-gray-600 text-sm sm:text-base space-y-1.5 pl-1">
                  <li>Switching tabs or windows during the interview</li>
                  <li>Turning off the camera</li>
                  <li>Exiting fullscreen mode</li>
                  <li>Other policy violations</li>
                </ul>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
                  If you believe this was an error, please contact the hiring team or use Contact Sales above.
                </p>
              </div>
            ) : (
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed text-center">
                Our team will review your interview and get back to you with next steps in the hiring process.
              </p>
            )}
          </div>
        </div>

        {/* Next steps - completed only, no border */}
        {!isTerminated && (
          <div className="mb-6 sm:mb-8">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#1e5da8] flex-shrink-0" />
                What Happens Next?
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 text-left">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#1e5da8] font-semibold text-sm">1</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Review Process</h3>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                      Our team will review your interview responses and evaluate your qualifications.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#1e5da8] font-semibold text-sm">2</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Follow-up</h3>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                      If selected for the next round, you will receive an email within 3–5 business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View report (completed) + My Interviews (candidate) + Contact Sales */}
        <div className="text-center space-y-4">
          {!isTerminated && interviewId && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to={`/final-results/${interviewId}`}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 sm:px-6 py-3 rounded-lg bg-[#1e5da8] text-white text-sm sm:text-base font-medium hover:bg-[#1e5da8]/90 transition-colors touch-manipulation"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                View report
              </Link>
              {isCandidateUser && (
                <Link
                  to="/candidate-dashboard/interviews"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 sm:px-6 py-3 rounded-lg border border-[#1e5da8] text-[#1e5da8] text-sm sm:text-base font-medium hover:bg-[#1e5da8]/5 transition-colors touch-manipulation"
                >
                  <List className="w-4 h-4 sm:w-5 sm:h-5" />
                  My Interviews
                </Link>
              )}
            </div>
          )}
          <p className="text-gray-500 text-xs sm:text-sm mb-3">
            {isTerminated
              ? 'For questions or to discuss your application, contact our team.'
              : 'Thank you for your interest in joining our team.'}
          </p>
          <a
            href="mailto:sales@aitamate.com"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 sm:px-6 py-3 rounded-lg bg-[#1e5da8] text-white text-sm sm:text-base font-medium hover:bg-[#1e5da8]/90 transition-colors touch-manipulation"
          >
            <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
            Contact Sales
          </a>
        </div>
      </main>
    </div>
  );
};

export default CandidateCompletion;
