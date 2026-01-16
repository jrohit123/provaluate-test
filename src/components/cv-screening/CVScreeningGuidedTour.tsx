import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Wrench, Upload, BarChart3, ArrowRight, CheckCircle } from 'lucide-react';
import { ActiveSection } from '@/pages/Dashboard';

interface CVScreeningGuidedTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (section: ActiveSection) => void;
}

export const CVScreeningGuidedTour = ({ 
  open, 
  onOpenChange,
  onNavigate 
}: CVScreeningGuidedTourProps) => {
  const handleNavigate = (section: ActiveSection) => {
    if (onNavigate) {
      onNavigate(section);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary-800">
            CV Screening Workflow Guide
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Learn how to efficiently evaluate candidates using our CV Screening workflow. 
            Choose the path that fits your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Path 1: New Setup */}
          <div className="border border-blue-200 rounded-lg p-5 bg-blue-50/50">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  New Setup: Configure Job Description & Criteria
                </h3>
                <p className="text-sm text-gray-600">
                  Use this path when you want to set up a new job posting and evaluation criteria from scratch.
                </p>
              </div>
            </div>

            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Step 1: New Job Upload</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('job-upload')}
                      className="text-xs"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload or create a job description. This defines the role requirements.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Wrench className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Step 2: Evaluation Criteria</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('evaluation-criteria')}
                      className="text-xs"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Set up evaluation criteria with parameters and weightages for candidate assessment.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Step 3: Resume Upload</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('resume-upload')}
                      className="text-xs"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload candidate resumes. The system will automatically evaluate them against your JD and criteria.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Step 4: View All Results</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('match-scorecard')}
                      className="text-xs"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Review candidate rankings, scores, and detailed assessments.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-sm font-medium text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Path 2: Quick Assessment */}
          <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Quick Assessment: Use Existing JD & Criteria
                </h3>
                <p className="text-sm text-gray-600">
                  Skip setup steps if you already have a job description and criteria configured. 
                  Go directly to uploading resumes.
                </p>
              </div>
            </div>

            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-green-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Upload className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Go to Resume Upload</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('resume-upload')}
                      className="text-xs bg-green-600 text-white hover:bg-green-700 border-green-600"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <ul className="text-sm text-gray-600 mt-2 space-y-1 ml-4 list-disc">
                    <li>Select an existing Job Description from the dropdown</li>
                    <li>Choose an existing Evaluation Criteria grid</li>
                    <li>Upload candidate resumes</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-green-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">View All Results</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('match-scorecard')}
                      className="text-xs bg-green-600 text-white hover:bg-green-700 border-green-600"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Review candidate rankings, scores, and detailed assessments after resumes are processed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 mb-1">Quick Tips</p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                  <li>You can reuse job descriptions and criteria for multiple candidate evaluations</li>
                  <li>All sections are accessible from the sidebar navigation</li>
                  <li>Green checkmarks (✓) in the sidebar indicate completed steps</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
