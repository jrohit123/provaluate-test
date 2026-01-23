import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Wrench, Upload, BarChart3, ArrowRight, CheckCircle, Type, FileUp, Settings, RefreshCw, SlidersHorizontal } from 'lucide-react';
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-primary-800">
            CV Screening Workflow Guide
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base mt-2">
            Learn how to efficiently evaluate candidates using our CV Screening workflow. 
            Choose the path that fits your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-4">
          {/* Path 1: New Setup */}
          <div className="border border-blue-200 rounded-lg p-3 sm:p-5 bg-blue-50/50">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="bg-blue-600 text-white rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-sm sm:text-base">
                1
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  New Setup: Configure Job Description & Criteria
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Use this path when you want to set up a new job posting and evaluation criteria from scratch.
                </p>
              </div>
            </div>

            <div className="space-y-3 ml-0 sm:ml-11">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Step 1: New Job Upload</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('job-upload')}
                      className="text-xs w-full sm:w-auto"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 mb-2">
                    Upload or create a job description. This defines the role requirements.
                  </p>
                  
                  {/* Detailed Sub-steps */}
                  <div className="ml-2 sm:ml-4 mt-3 space-y-2 border-l-2 border-blue-200 pl-3 sm:pl-4">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                      <div>
                        <p className="text-xs font-medium text-gray-800">Select Existing JD</p>
                        <p className="text-xs text-gray-600">Choose from previously uploaded job descriptions in the dropdown</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                      <div>
                        <p className="text-xs font-medium text-gray-800">Create New JD</p>
                        <p className="text-xs text-gray-600">Enter a job title and choose between file upload or text editor</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <FileUp className="w-3 h-3 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">File Upload Tab</p>
                        <p className="text-xs text-gray-600">Upload PDF, DOCX, or TXT files. Text is automatically extracted</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <Type className="w-3 h-3 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">Text Editor Tab</p>
                        <p className="text-xs text-gray-600">
                          Rich text editor with formatting tools: bold, italic, headings, lists, and highlight important sections
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <SlidersHorizontal className="w-3 h-3 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">View Glider</p>
                        <p className="text-xs text-gray-600">
                          After selecting a JD, use the glider to switch between "Resolved Data" (AI-analyzed) and "Extracted Text" (raw text)
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <Settings className="w-3 h-3 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">Manage Job Descriptions</p>
                        <p className="text-xs text-gray-600">
                          Click the "Manage" button (top-right) to enable/disable JDs and view capacity status
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Step 2: Evaluation Criteria</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('evaluation-criteria')}
                      className="text-xs w-full sm:w-auto"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Set up evaluation criteria with parameters and weightages for candidate assessment.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Step 3: Resume Upload</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('resume-upload')}
                      className="text-xs w-full sm:w-auto"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Upload candidate resumes. The system will automatically evaluate them against your JD and criteria.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <div className="bg-white border-2 border-blue-600 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Step 4: View All Results</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('match-scorecard')}
                      className="text-xs w-full sm:w-auto"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
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
          <div className="border border-green-200 rounded-lg p-3 sm:p-5 bg-green-50/50">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="bg-green-600 text-white rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-sm sm:text-base">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  Quick Assessment: Use Existing JD & Criteria
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Skip setup steps if you already have a job description and criteria configured. 
                  Go directly to uploading resumes.
                </p>
              </div>
            </div>

            <div className="space-y-3 ml-0 sm:ml-11">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="bg-white border-2 border-green-600 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Go to Resume Upload</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('resume-upload')}
                      className="text-xs bg-green-600 text-white hover:bg-green-700 border-green-600 w-full sm:w-auto"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <ul className="text-xs sm:text-sm text-gray-600 mt-2 space-y-1 ml-4 list-disc">
                    <li>Select an existing Job Description from the dropdown</li>
                    <li>Use the glider to view resolved data (default) or extracted text</li>
                    <li>Choose an existing Evaluation Criteria grid</li>
                    <li>Upload candidate resumes</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <div className="bg-white border-2 border-green-600 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">View All Results</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNavigate('match-scorecard')}
                      className="text-xs bg-green-600 text-white hover:bg-green-700 border-green-600 w-full sm:w-auto"
                    >
                      Go to Section
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Review candidate rankings, scores, and detailed assessments after resumes are processed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 mb-1 text-sm sm:text-base">Quick Tips</p>
                <ul className="text-xs sm:text-sm text-gray-600 space-y-1 ml-4 list-disc">
                  <li>You can reuse job descriptions and criteria for multiple candidate evaluations</li>
                  <li>Use the text editor to format and highlight important parts of your job description</li>
                  <li>The glider automatically shows resolved data when you select a JD - slide it to see extracted text</li>
                  <li>All sections are accessible from the sidebar navigation</li>
                  <li>Green checkmarks (✓) in the sidebar indicate completed steps</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4 sm:mt-6 pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
