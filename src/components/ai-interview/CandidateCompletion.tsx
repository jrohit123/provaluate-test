import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, Clock, User } from 'lucide-react';

const CandidateCompletion = () => {
  const location = useLocation();
  const { candidateName, position, interviewId } = location.state || {};

  // Track completion page view
  useEffect(() => {
    const trackCompletionView = async () => {
      if (interviewId) {
        try {
          await fetch(`http://localhost:5000/api/track-completion-view/${interviewId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          console.log('✅ Completion page view tracked');
        } catch (error) {
          console.warn('⚠️ Could not track completion view:', error);
        }
      }
    };

    trackCompletionView();
  }, [interviewId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Completion Message */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Interview Completed!
          </h1>
          
          <p className="text-xl text-gray-600 mb-6">
            Thank you, <span className="font-semibold text-blue-600">{candidateName}</span>!
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <p className="text-blue-800 text-lg">
              You have successfully completed your <span className="font-semibold">{position}</span> interview.
            </p>
          </div>
          
          <p className="text-gray-600 leading-relaxed">
            We appreciate your time and thoughtful responses today. Our team will carefully review your interview 
            and get back to you with next steps in the hiring process.
          </p>
        </div>

        {/* Next Steps */}
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
                  You'll receive an email within 3-5 business days with next steps.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center justify-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            Questions?
          </h2>
          
          <p className="text-gray-600 mb-4">
            If you have any questions about your interview or the hiring process, please don't hesitate to reach out.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700">
              <strong>Contact:</strong> hr@company.com<br />
              <strong>Subject:</strong> Interview Follow-up - {candidateName}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Thank you for your interest in joining our team!
          </p>
        </div>
      </div>
    </div>
  );
};

export default CandidateCompletion;
