import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, User, CheckCircle, Play, Briefcase, Grid, Loader2, Download, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { MatchScorecardSection } from './MatchScorecardSection';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

interface ResumeData {
  id: string;
  name: string;
  fileName: string;
  status: 'uploading' | 'processed' | 'error';
  summary: string;
  initialScore: number;
  uploadProgress: number;
  fileUrl?: string;
}

interface SelectedFileData {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  errorMessage?: string;
}

interface SavedCriteriaGrid {
  id: string;
  name: string;
  criteria: any[];
}

interface ProcessingState {
  status: 'idle' | 'processing' | 'error' | 'success';
  message: string;
  error?: string;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
//const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx'];
const ALLOWED_FILE_TYPES = ['.pdf'];
//const CV_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook-test/c32aade7-564b-4cc7-a832-b6b094418132";
//const CV_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook/c32aade7-564b-4cc7-a832-b6b094418132";
const CV_WEBHOOK_URL = "https://automations.aitamate.com/webhook/c32aade7-564b-4cc7-a832-b6b094418132";

// Session storage helpers for uploaded files
const getSessionUploadedFiles = (): any[] => {
  try {
    const stored = sessionStorage.getItem('uploadedFiles');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading uploaded files from session:', error);
    return [];
  }
};

const addToSessionUploadedFiles = (fileData: any) => {
  try {
    const existing = getSessionUploadedFiles();
    const updated = [...existing, fileData];
    sessionStorage.setItem('uploadedFiles', JSON.stringify(updated));
    console.log('Added file to session storage:', fileData.candidate_name);
  } catch (error) {
    console.error('Error saving uploaded file to session:', error);
  }
};

const clearSessionUploadedFiles = () => {
  try {
    sessionStorage.removeItem('uploadedFiles');
    console.log('Cleared uploaded files from session storage');
  } catch (error) {
    console.error('Error clearing uploaded files from session:', error);
  }
};

// Add helper function to extract recommendation status (same logic as MatchScorecardSection)
const extractRecommendationStatus = (recommendation: string | undefined): string => {
  if (!recommendation) return 'Under Review';
  
  // Look for specific phrases in the recommendation text
  const lowerCaseRec = recommendation.toLowerCase();
  if (lowerCaseRec.includes('to be interviewed')) return 'To Be Interviewed';
  if (lowerCaseRec.includes('candidature rejected')) return 'Candidature Rejected';
  if (lowerCaseRec.includes('review further')) return 'Review Further';
  
  return 'Under Review';
};

// Add helper function to get status style (same logic as MatchScorecardSection)
const getRecommendationStyle = (status: string): string => {
  switch (status) {
    case 'To Be Interviewed':
      return 'bg-green-100 text-green-700';
    case 'Candidature Rejected':
      return 'bg-red-100 text-red-700';
    case 'Review Further':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

// Keep the old score-based function for fallback if needed
const getMatchStatus = (score: number) => {
  if (score >= 85) return { status: 'excellent', text: 'Excellent Match', className: 'bg-green-100 text-green-700' };
  if (score >= 70) return { status: 'good', text: 'Good Match', className: 'bg-yellow-100 text-yellow-700' };
  return { status: 'nomatch', text: 'No Match', className: 'bg-orange-100 text-orange-700' };
};

export const ResumeUploadSection = () => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileData[]>([]); // Add state for selected files with status
  const [newlyUploadedIds, setNewlyUploadedIds] = useState<Set<string>>(new Set()); // Track newly uploaded resumes
  const [currentlyProcessing, setCurrentlyProcessing] = useState<number>(-1); // Track which file is currently being processed
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>(() => sessionStorage.getItem('selectedJDId') || '');
  const [criteriaGrids, setCriteriaGrids] = useState<SavedCriteriaGrid[]>([]);
  const [selectedCriteriaGridId, setSelectedCriteriaGridId] = useState<string>(() => sessionStorage.getItem('selectedCriteriaGridId') || '');
  const [assessmentReports, setAssessmentReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    message: ''
  });
  const [isWaitingForAssessments, setIsWaitingForAssessments] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [evaluationStartTime, setEvaluationStartTime] = useState<string | null>(null);
  const [expectedResumeCount, setExpectedResumeCount] = useState<number>(0);
  const [lastProgressCount, setLastProgressCount] = useState<number>(0);
  const [initialReportCount, setInitialReportCount] = useState<number>(0);

  // Helper function to calculate and format evaluation time
  const getEvaluationTime = (reportCreatedAt: string): { text: string; colorClass: string } => {
    console.log('🕐 getEvaluationTime called:', { reportCreatedAt, evaluationStartTime });
    
    if (!evaluationStartTime) {
      console.log('❌ No evaluationStartTime set');
      return { text: 'Unknown', colorClass: 'bg-gray-100 text-gray-700' };
    }
    
    try {
      const startTime = new Date(evaluationStartTime);
      const endTime = new Date(reportCreatedAt);
      
      console.log('📅 Time comparison:', { 
        startTime: startTime.toISOString(), 
        endTime: endTime.toISOString(),
        startTimeValid: !isNaN(startTime.getTime()),
        endTimeValid: !isNaN(endTime.getTime())
      });
      
      const timeDiffMs = endTime.getTime() - startTime.getTime();
      
      console.log('⏱️ Time difference:', { timeDiffMs, timeDiffMinutes: timeDiffMs / 60000 });
      
      if (timeDiffMs < 0) {
        console.log('❌ Negative time difference - report created before evaluation started');
        return { text: 'Unknown', colorClass: 'bg-gray-100 text-gray-700' }; // Invalid time difference
      }
      
      const timeDiffSeconds = Math.floor(timeDiffMs / 1000);
      const timeDiffMinutes = Math.floor(timeDiffSeconds / 60);
      const timeDiffHours = Math.floor(timeDiffMinutes / 60);
      
      let timeText = '';
      let colorClass = '';
      
      if (timeDiffHours > 0) {
        const remainingMinutes = timeDiffMinutes % 60;
        timeText = `${timeDiffHours}h ${remainingMinutes}m`;
        colorClass = 'bg-orange-100 text-orange-700'; // Long time - orange
      } else if (timeDiffMinutes > 5) {
        const remainingSeconds = timeDiffSeconds % 60;
        timeText = `${timeDiffMinutes}m ${remainingSeconds}s`;
        colorClass = 'bg-orange-100 text-orange-700'; // >5 minutes - orange
      } else if (timeDiffMinutes > 2) {
        const remainingSeconds = timeDiffSeconds % 60;
        timeText = `${timeDiffMinutes}m ${remainingSeconds}s`;
        colorClass = 'bg-yellow-100 text-yellow-700'; // 2-5 minutes - yellow
      } else if (timeDiffMinutes > 0) {
        const remainingSeconds = timeDiffSeconds % 60;
        timeText = `${timeDiffMinutes}m ${remainingSeconds}s`;
        colorClass = 'bg-green-100 text-green-700'; // 0-2 minutes - green
      } else {
        timeText = `${timeDiffSeconds}s`;
        colorClass = 'bg-green-100 text-green-700'; // <1 minute - green
      }
      
      console.log('✅ Calculated time:', { timeText, colorClass });
      return { text: timeText, colorClass };
    } catch (error) {
      console.error('❌ Error calculating evaluation time:', error);
      return { text: 'Unknown', colorClass: 'bg-gray-100 text-gray-700' };
    }
  };

  // Auto-refresh functions for assessment reports
  const startAutoRefreshAssessments = () => {
    setIsWaitingForAssessments(true);
    setLastProgressCount(0); // Reset progress counter when starting new refresh
    // Note: initialReportCount should already be set by the calling function
    
    // Clear any existing interval
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    // Set up auto-refresh every 15 seconds for up to 5 minutes
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts × 15 seconds = 5 minutes
    
    const interval = setInterval(async () => {
      attempts++;
      console.log(`Auto-refresh assessment reports attempt ${attempts}/${maxAttempts}`);
      
      try {
        // Check if we have the required selections
        if (!selectedJobDescriptionId || !selectedCriteriaGridId) {
          console.log('❌ Missing required selections, stopping refresh');
          stopAutoRefreshAssessments();
          return;
        }

        // Check if we're still waiting for assessments
        if (!isWaitingForAssessments) {
          console.log('❌ No longer waiting for assessments, stopping refresh');
          clearInterval(interval);
          return;
        }

        // Get current assessment reports count before refresh
        const currentCount = assessmentReports.length;
        console.log(`📊 Current assessment reports count: ${currentCount}`);
        
        // Fetch updated assessment reports
        await fetchAssessmentReports();
        
        if (attempts >= maxAttempts) {
          console.log('❌ Max attempts reached, stopping refresh');
          stopAutoRefreshAssessments();
          toast({
            title: "Processing Taking Longer",
            description: "Assessment processing is taking longer than expected. You can manually refresh or try again later.",
            variant: "default",
          });
        }
      } catch (error) {
        console.error('Auto-refresh error:', error);
        if (attempts >= maxAttempts) {
          stopAutoRefreshAssessments();
        }
      }
    }, 15000); // 15 seconds
    
    setAutoRefreshInterval(interval);
  };

  const stopAutoRefreshAssessments = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
    setIsWaitingForAssessments(false);
    setExpectedResumeCount(0);
    setLastProgressCount(0);
    setInitialReportCount(0);
  };

  // Monitor assessment reports changes to stop auto-refresh when ALL expected resumes are processed
  useEffect(() => {
    // Skip if not actively waiting for assessments
    if (!isWaitingForAssessments || expectedResumeCount <= 0 || !user?.id) {
      return;
    }

    try {
      // Count current reports that match our criteria (created by current user for current JD/criteria)
      const currentSessionReports = assessmentReports.filter(report => 
        report.created_by === user.id && 
        report.final_match !== null && 
        report.final_match !== undefined
      );

      // Calculate new reports by subtracting initial count
      const newCompletedCount = Math.max(0, currentSessionReports.length - initialReportCount);
      
      console.log(`📊 Session reports: ${currentSessionReports.length}, Initial: ${initialReportCount}, New: ${newCompletedCount}/${expectedResumeCount}`);

      // Only update if we have a new completion count
      if (newCompletedCount > lastProgressCount) {
        console.log(`📈 Progress update: ${newCompletedCount} (previous: ${lastProgressCount})`);
        setLastProgressCount(newCompletedCount);

        // Show progress toast
        toast({
          title: "Processing Update",
          description: `${newCompletedCount} of ${expectedResumeCount} resume${expectedResumeCount === 1 ? '' : 's'} completed.`,
        });

        // If all expected resumes are processed
        if (newCompletedCount >= expectedResumeCount) {
          console.log('✅ All expected resumes processed! Stopping auto-refresh.');
          stopAutoRefreshAssessments();
          toast({
            title: "All Resumes Processed!",
            description: `Successfully processed all ${expectedResumeCount} resume${expectedResumeCount === 1 ? '' : 's'}.`,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in assessment monitoring:', error);
    }
  }, [assessmentReports, isWaitingForAssessments, expectedResumeCount, user?.id, initialReportCount, lastProgressCount, stopAutoRefreshAssessments]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

  // Load existing resumes from database
  const loadResumes = useCallback(async () => {
    if (!user?.profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedResumes: ResumeData[] = (data || []).map(resume => ({
        id: resume.resume_id,
        name: resume.candidate_name || 'Unknown',
        fileName: resume.cv_file ? resume.cv_file.split('/').pop() || 'Unknown' : 'Unknown',
        status: 'processed',
        summary: resume.evaluation_scores?.summary || '',
        initialScore: resume.evaluation_scores?.overall_score || 0,
        uploadProgress: 100,
        fileUrl: resume.cv_file
      }));

      setResumes(formattedResumes);
    } catch (error) {
      console.error('Error loading resumes:', error);
    }
  }, [user?.profile?.company_id]);

  // Load job descriptions from database
  const loadJobDescriptions = useCallback(async () => {
    if (!user?.profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, jd_file, created_at')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setJobDescriptions(data || []);
    } catch (error) {
      console.error('Error loading job descriptions:', error);
      toast({
        title: 'Error Loading Job Descriptions',
        description: 'Failed to load job descriptions from the database.',
        variant: 'destructive',
      });
    }
  }, [user?.profile?.company_id, toast]);

  // Load criteria grids from database using grid JSON field
  const loadCriteriaGrids = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log('Loading criteria grids for user:', user.id);
      
      // Get unique criteria grids by criteria_name with their grid JSON data and criteria_id
      const { data: grids, error } = await supabase
        .from('criteria')
        .select('criteria_id, criteria_name, grid, created_at')
        .eq('created_by', user.id)
        .eq('company_id', user.profile?.company_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching criteria grids:', error);
        throw error;
      }

      console.log('Fetched criteria grids:', grids);
      
      if (!grids || grids.length === 0) {
        console.log('No criteria grids found');
        setCriteriaGrids([]);
        return;
      }

      // Get unique grids by criteria_name (latest entry for each name)
      const uniqueGrids = grids.reduce((acc: { [key: string]: any }, curr) => {
        if (!acc[curr.criteria_name] || new Date(curr.created_at) > new Date(acc[curr.criteria_name].created_at)) {
          acc[curr.criteria_name] = curr;
        }
        return acc;
      }, {});

      console.log('Unique criteria grids:', uniqueGrids);

      // Convert to SavedCriteriaGrid format using grid JSON data
      const formattedGrids: SavedCriteriaGrid[] = Object.values(uniqueGrids).map((grid: any) => {
        let criteria: any[] = [];
        
        // Parse grid JSON data
        if (grid.grid && Array.isArray(grid.grid)) {
          criteria = grid.grid.map((item: any, index: number) => ({
            id: `${Date.now()}_${index}`, // Generate unique ID
            parameter: item.parameter || '',
            weightage: item.weightage || 0,
            notes: item.calc_note || ''
          }));
        }

        return {
          id: grid.criteria_id, // Use actual criteria_id from database
          name: grid.criteria_name,
          criteria
        };
      });

      console.log('Formatted criteria grids:', formattedGrids);
      console.log('Grid IDs that will be sent to webhook:', formattedGrids.map(g => ({ name: g.name, id: g.id })));
      setCriteriaGrids(formattedGrids);
    } catch (error) {
      console.error('Error loading criteria grids:', error);
      toast({
        title: "Error Loading Criteria Grids",
        description: "Failed to load saved evaluation criteria.",
        variant: "destructive"
      });
    }
  }, [user?.id, user?.profile?.company_id, toast]);

  // Load resumes, job descriptions, and criteria grids when component mounts or user changes
  useEffect(() => {
    if (user?.profile?.company_id) {
      loadResumes();
      loadJobDescriptions();
      loadCriteriaGrids();
      // Clear any stale session data on component mount
      clearSessionUploadedFiles();
      setSelectedFiles([]);
      setNewlyUploadedIds(new Set());
      // Clear evaluation timing on component mount
      console.log('🔄 Clearing evaluation start time (component mount)');
      setEvaluationStartTime(null);
      setExpectedResumeCount(0);
      setLastProgressCount(0);
      setInitialReportCount(0);
    }
  }, [user?.profile?.company_id, loadResumes, loadJobDescriptions, loadCriteriaGrids]);

  // Set default selections from session storage and show success messages
  useEffect(() => {
    if (jobDescriptions.length > 0 && selectedJobDescriptionId) {
      const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
      if (selectedJD) {
        console.log('Auto-selected Job Description from session:', selectedJD.title);
      }
    }
  }, [jobDescriptions, selectedJobDescriptionId, toast]);

  useEffect(() => {
    if (criteriaGrids.length > 0 && selectedCriteriaGridId) {
      const selectedGrid = criteriaGrids.find(grid => grid.id === selectedCriteriaGridId);
      if (selectedGrid) {
        console.log('Auto-selected Criteria Grid from session:', selectedGrid.name);
      }
    }
  }, [criteriaGrids, selectedCriteriaGridId, toast]);

  // Fetch assessment reports filtered by selected JD and criteria
  const fetchAssessmentReports = useCallback(async () => {
    if (!user?.profile?.company_id || !selectedJobDescriptionId || !selectedCriteriaGridId) {
      console.log('❌ Missing required data for fetching reports');
      setAssessmentReports([]);
      return;
    }
    setLoadingReports(true);
    try {
      // First, get the resolved_jd_id for the selected job description
      console.log('🔍 Looking for JD with ID:', selectedJobDescriptionId);
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .select('jd_file')
        .eq('jd_id', selectedJobDescriptionId)
        .single();

      if (jdError || !jdData?.jd_file) {
        console.log('❌ No JD file found for ID:', selectedJobDescriptionId);
        setAssessmentReports([]);
        setLoadingReports(false);
        return;
      }

      console.log('✅ Found JD file URL:', jdData.jd_file);

      // Then get the resolved_jd_id using the file URL
      const { data: resolvedJdData, error: resolvedJdError } = await supabase
        .from('resolved_jd')
        .select('resolved_jd_id')
        .eq('referenced_jd', jdData.jd_file)
        .single();

      if (resolvedJdError || !resolvedJdData?.resolved_jd_id) {
        console.log('❌ No resolved JD found for file URL:', jdData.jd_file);
        setAssessmentReports([]);
        setLoadingReports(false);
        return;
      }

      console.log('✅ Found resolved_jd_id:', resolvedJdData.resolved_jd_id);
      console.log('🔍 Using criteria_id:', selectedCriteriaGridId);

      // Finally, fetch assessment reports using resolved_jd_id and criteria_id
      const { data, error } = await supabase
        .from('assessment_reports')
        .select('*')
        .eq('resolved_jd_id', resolvedJdData.resolved_jd_id)
        .eq('criteria_id', selectedCriteriaGridId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const previousCount = assessmentReports.length;
      const newCount = data?.length || 0;
      console.log(`📊 Assessment reports: ${previousCount} → ${newCount}`);
      
      if (data) {
        // Log the timestamps of all reports
        data.forEach(report => {
          console.log(`📄 Report ${report.id}: created_at = ${report.created_at}`);
        });
      }
      
      setAssessmentReports(data || []);
    } catch (err) {
      console.error('❌ Error fetching assessment reports:', err);
      setAssessmentReports([]);
      // No error toast - this is normal when no reports exist yet
    } finally {
      setLoadingReports(false);
    }
  }, [user?.profile?.company_id, selectedJobDescriptionId, selectedCriteriaGridId, assessmentReports.length]);

  useEffect(() => {
    fetchAssessmentReports();
  }, [fetchAssessmentReports]);

  // Handle manual refresh of assessment reports
  const handleRefreshReports = async () => {
    console.log('🔄 Manual refresh triggered');
    toast({
      title: "Refreshing...",
      description: "Checking for updated evaluation results.",
    });
    await fetchAssessmentReports();
    toast({
      title: "Refreshed",
      description: `Found ${assessmentReports.length} candidate${assessmentReports.length === 1 ? '' : 's'}.`,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-accent-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-accent-100';
    if (score >= 75) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 3MB limit';
    }
    
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(extension)) {
      //return 'Invalid file type. Please upload PDF, DOC, or DOCX files';
      return 'Invalid file type. Please upload PDF files only';
    }
    
    return null;
  };

  const handleFileUpload = async (files: FileList, append: boolean = false) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload resumes.",
        variant: "destructive",
      });
      return;
    }

    if (!user.profile?.company_id) {
      toast({
        title: "Profile Error",
        description: "Company profile is not properly set up.",
        variant: "destructive",
      });
      return;
    }

    // Set selected files for display with initial status
    const fileArray = Array.from(files);
    const newSelectedFileData: SelectedFileData[] = fileArray.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));
    
    // Get the starting index BEFORE updating selectedFiles
    const startIndex = append ? selectedFiles.length : 0;
    
    // Either append to existing files or replace them
    if (append && selectedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newSelectedFileData]);
    } else {
      setSelectedFiles(newSelectedFileData);
    }

    console.log(`Files added to queue. startIndex: ${startIndex}. Use 'Start Upload' button to begin processing.`);
    
    // Don't auto-upload, let user control when to start
    // This prevents confusion and duplicate uploads
  };

  // Upload a single file with proper status tracking and session storage
  const uploadSingleFile = async (file: File, fileIndex: number) => {
    console.log(`📤 Starting upload for file ${fileIndex}: ${file.name}`);
    
    // Step 1: Validate file
    const error = validateFile(file);
    if (error) {
      console.log(`❌ File validation failed: ${error}`);
      setSelectedFiles(prev => prev.map((fileData, index) => 
        index === fileIndex ? { ...fileData, status: 'error', errorMessage: error } : fileData
      ));
      return;
    }

    // Step 2: Set uploading status
    console.log(`⏳ Setting file ${fileIndex} to uploading status`);
    setSelectedFiles(prev => prev.map((fileData, index) => 
      index === fileIndex ? { ...fileData, status: 'uploading' } : fileData
    ));

    const candidateName = file.name.split('.')[0];
    const timestamp = Date.now() + fileIndex;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user?.profile?.company_id}/${timestamp}_${safeFileName}`;

    try {
      // Step 3: Upload to Supabase Storage
      console.log(`🗄️ Uploading to storage: ${filePath}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type
        });

      if (uploadError) {
        console.log(`❌ Storage upload failed:`, uploadError);
        throw uploadError;
      }

      // Step 4: Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(uploadData.path);
      const fileUrl = publicUrlData.publicUrl;
      console.log(`🔗 Generated public URL: ${fileUrl}`);

      // Step 5: Save to database
      console.log(`💾 Saving to database...`);
      const { data: resumeRecord, error: dbError } = await supabase
        .from('resumes')
        .insert({
          candidate_name: candidateName,
          cv_file: fileUrl,
          user_id: user?.id,
          company_id: user?.profile?.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.log(`❌ Database save failed:`, dbError);
        throw dbError;
      }

      console.log(`✅ Database record created with ID: ${resumeRecord.resume_id}`);

      // Step 6: Save to session storage for webhook
      const sessionData = {
        resume_id: resumeRecord.resume_id,
        candidate_name: candidateName,
        cv_file_url: fileUrl,
        created_at: resumeRecord.created_at
      };
      addToSessionUploadedFiles(sessionData);

      // Step 7: Update UI to completed status
      console.log(`🎉 Setting file ${fileIndex} to completed status`);
      setSelectedFiles(prev => prev.map((fileData, index) => 
        index === fileIndex ? { ...fileData, status: 'completed', progress: 100 } : fileData
      ));

      // Step 8: Add to newly uploaded tracking
      setNewlyUploadedIds(prev => new Set(prev).add(resumeRecord.resume_id));

      // Step 9: Update resumes list
      setResumes(prev => [...prev, {
        id: resumeRecord.resume_id,
        name: candidateName,
        fileName: file.name,
        status: 'processed',
        summary: '',
        initialScore: 0,
        uploadProgress: 100,
        fileUrl: fileUrl
      }]);

      console.log(`✅ Successfully completed upload for file ${fileIndex}: ${file.name}`);

    } catch (error: any) {
      console.log(`❌ Upload failed for file ${fileIndex}:`, error.message);
      
      setSelectedFiles(prev => prev.map((fileData, index) => 
        index === fileIndex ? { 
          ...fileData, 
          status: 'error', 
          errorMessage: error.message || "Upload failed" 
        } : fileData
      ));

      toast({
        title: `Error uploading ${file.name}`,
        description: error.message || "An error occurred during upload.",
        variant: "destructive",
      });
    }
  };

  const handleEvaluation = async () => {
    if (!user?.profile?.company_id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to process resumes.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsEvaluating(true);
      setProcessingState({
        status: 'processing',
        message: 'Starting Pro-Valuation process...'
      });

      // Get selected job description and criteria grid from session storage
      const selectedJDId = sessionStorage.getItem('selectedJDId') || '';
      const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId') || '';

      // Validation checks
      if (!selectedJDId) {
        toast({
          title: "No Job Description Selected",
          description: "Please select a job description from the dropdown above first.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedCriteriaGridId) {
        toast({
          title: "No Criteria Grid Selected",
          description: "Please select an evaluation criteria grid from the dropdown above first.",
          variant: "destructive",
        });
        return;
      }

      // Get uploaded files from session storage
      const sessionUploadedFiles = getSessionUploadedFiles();

      if (sessionUploadedFiles.length === 0) {
        toast({
          title: "No New Resumes",
          description: "No new resumes found to process. Upload some resumes first.",
          variant: "default",
        });
        return;
      }

      setProcessingState({
        status: 'processing',
        message: `Preparing to process ${sessionUploadedFiles.length} resume${sessionUploadedFiles.length > 1 ? 's' : ''}...`
      });

      console.log(`🚀 Processing ${sessionUploadedFiles.length} files from session storage:`, sessionUploadedFiles);

      // Use session storage data directly for webhook
      const resumeUrls = sessionUploadedFiles;

      // Send to N8N webhook with selected JD and criteria
      try {
        setProcessingState({
          status: 'processing',
          message: 'Sending resumes to Pro-Valuation service...'
        });
        
        // Record the start time for evaluation timing and initial report count
        const startTime = new Date().toISOString();
        console.log('🚀 Setting evaluation start time (handleEvaluation):', startTime);
        console.log('📊 Setting expected resume count:', resumeUrls.length);
        
        // Capture initial report count for current user/JD/criteria combination
        const currentReports = assessmentReports.filter(report => 
          report.created_by === user.id && 
          report.final_match !== null && 
          report.final_match !== undefined
        );
        console.log('📊 Initial report count:', currentReports.length);
        
        setEvaluationStartTime(startTime);
        setExpectedResumeCount(resumeUrls.length);
        setInitialReportCount(currentReports.length);
        setLastProgressCount(0); // Reset progress tracking
        
        await sendResumesToWebhook(resumeUrls, selectedJDId, selectedCriteriaGridId, 'provaluate');
        
        setProcessingState({
          status: 'success',
          message: `Successfully started Pro-Valuation for ${resumeUrls.length} resume${resumeUrls.length > 1 ? 's' : ''}`
        });

        toast({
          title: "Pro-Valuation Started",
          description: `Successfully sent ${resumeUrls.length} new resume${resumeUrls.length > 1 ? 's' : ''} for Pro-Valuation. Wait for the results, it might take a while.`,
        });

        // Start auto-refresh to check for assessment reports every 15 seconds
        startAutoRefreshAssessments();

        // Clear session storage after successful processing
        clearSessionUploadedFiles();
        
        // Clear newly uploaded IDs after successful processing
        setNewlyUploadedIds(new Set());

      } catch (webhookError: any) {
        console.error('Error calling Pro-Valuation service:', webhookError);
        setProcessingState({
          status: 'error',
          message: 'Failed to start Pro-Valuation process',
          error: webhookError.message || 'Network error occurred while contacting the service'
        });
        
        // Even if webhook fails, start auto-refresh in case N8N processes it later
        startAutoRefreshAssessments();
        
        throw webhookError;
      }

    } catch (error: any) {
      console.error('Error during Pro-Valuation:', error);
      setProcessingState({
        status: 'error',
        message: 'Pro-Valuation process failed',
        error: error.message || 'An unexpected error occurred'
      });
      toast({
        title: "Pro-Valuation Failed",
        description: error.message || "Failed to start evaluation process.",
        variant: "destructive",
      });
    } finally {
      // Keep the success/error state visible for a moment before resetting
      setTimeout(() => {
        setIsEvaluating(false);
        if (processingState.status !== 'error') {
          setProcessingState({
            status: 'idle',
            message: ''
          });
        }
      }, 1500);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const append = selectedFiles.length > 0; // Append if there are existing files
      handleFileUpload(files, append);
    }
    // Reset the input value to allow selecting the same files again
    if (event.target) {
      event.target.value = '';
    }
  };

  // Remove a file from the selected files list
  const handleRemoveFile = (indexToRemove: number) => {
    const fileToRemove = selectedFiles[indexToRemove];
    console.log(`Removing file at index ${indexToRemove}: ${fileToRemove.file.name}`);
    
    // Remove from selectedFiles
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    
    // If the file was already uploaded, remove it from session storage and database
    if (fileToRemove.status === 'completed') {
      const sessionFiles = getSessionUploadedFiles();
      const updatedSessionFiles = sessionFiles.filter(sessionFile => 
        sessionFile.candidate_name !== fileToRemove.file.name.split('.')[0]
      );
      sessionStorage.setItem('uploadedFiles', JSON.stringify(updatedSessionFiles));
      console.log(`Removed uploaded file from session storage: ${fileToRemove.file.name}`);
    }
    
    // If no files left, clear everything
    if (selectedFiles.length === 1) {
      clearSessionUploadedFiles();
      setNewlyUploadedIds(new Set());
      console.log('Cleared all session data - no files remaining');
    }
  };

  // Start uploading pending files without duplicating them
  const startPendingUploads = async (e: React.MouseEvent) => {
    // Prevent event from bubbling up to the dropzone
    e.stopPropagation();
    console.log('Starting upload for pending files...');
    
    // Find all pending files
    const pendingFiles = selectedFiles
      .map((fileData, index) => ({ fileData, index }))
      .filter(({ fileData }) => fileData.status === 'pending');
    
    if (pendingFiles.length === 0) {
      console.log('No pending files to upload');
      return;
    }
    
    console.log(`Found ${pendingFiles.length} pending files to upload`);
    
    try {
      // Process each pending file by its index
      for (const { fileData, index } of pendingFiles) {
        setCurrentlyProcessing(index);
        console.log(`Processing pending file at index ${index}: ${fileData.file.name}`);
        
        await uploadSingleFile(fileData.file, index);
        
        // Small delay between files
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      setCurrentlyProcessing(-1);
      console.log('✅ All pending files processed');
      
      toast({
        title: "Upload Complete", 
        description: `Successfully uploaded ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}`,
      });
      
    } catch (error: any) {
      console.error('Error uploading pending files:', error);
      setCurrentlyProcessing(-1);
      toast({
        title: "Upload Error",
        description: "Error uploading files. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCandidateClick = (candidateId: string) => {
    // Find the selected candidate's data from assessmentReports
    const selectedReport = assessmentReports.find(report => report.id === candidateId);
    if (selectedReport) {
      setSelectedCandidate(candidateId);
      setShowScorecard(true);
    }
  };

  // Handle job description selection
  const handleJobDescriptionSelect = (jdId: string) => {
    setSelectedJobDescriptionId(jdId);
    sessionStorage.setItem('selectedJDId', jdId);
    // Stop any existing auto-refresh when switching job descriptions
    stopAutoRefreshAssessments();
    // Clear evaluation start time for new evaluation
    console.log('🔄 Clearing evaluation start time (job description change)');
    setEvaluationStartTime(null);
    setExpectedResumeCount(0);
    setLastProgressCount(0);
    setInitialReportCount(0);
    
    const selectedJD = jobDescriptions.find(jd => jd.jd_id === jdId);
    toast({
      title: "Job Description Selected",
      description: `Selected: ${selectedJD?.title || 'Unknown Job'}`,
    });
  };

  // Handle criteria grid selection
  const handleCriteriaGridSelect = (gridId: string) => {
    setSelectedCriteriaGridId(gridId);
    sessionStorage.setItem('selectedCriteriaGridId', gridId);
    // Stop any existing auto-refresh when switching criteria grids
    stopAutoRefreshAssessments();
    // Clear evaluation start time for new evaluation
    console.log('🔄 Clearing evaluation start time (criteria grid change)');
    setEvaluationStartTime(null);
    setExpectedResumeCount(0);
    setLastProgressCount(0);
    setInitialReportCount(0);
    
    const selectedGrid = criteriaGrids.find(grid => grid.id === gridId);
    toast({
      title: "Criteria Grid Selected",
      description: `Selected: ${selectedGrid?.name || 'Unknown Grid'}`,
    });
  };

  // Shared function to send resumes to webhook
  const sendResumesToWebhook = async (resumeUrls: any[], selectedJDId: string, selectedCriteriaGridId: string, actionType: string) => {
    // Prepare GET request with optimized parameters for n8n
    let action = 'process_all_resumes'; // default
    if (actionType === 'new_resumes') {
      action = 'process_new_resumes';
    } else if (actionType === 'provaluate') {
      action = 'provaluate_resumes';
    }

    const params = new URLSearchParams({
      action: action,
      company_id: user?.profile?.company_id || '',
      user_id: user?.id || '',
      job_description_id: selectedJDId,
      criteria_grid_id: selectedCriteriaGridId,
      resume_count: resumeUrls.length.toString(),
      timestamp: new Date().toISOString()
    });

    // Check if we have too many resumes for a single GET request
    const maxResumesPerRequest = 5; // Safe limit to avoid URL length issues
    
    try {
      if (resumeUrls.length > maxResumesPerRequest) {
        // Send in batches
        console.log(`Too many resumes (${resumeUrls.length}). Sending in batches of ${maxResumesPerRequest}.`);
        
        for (let i = 0; i < resumeUrls.length; i += maxResumesPerRequest) {
          const batch = resumeUrls.slice(i, i + maxResumesPerRequest);
          const batchNumber = Math.floor(i / maxResumesPerRequest) + 1;
          const totalBatches = Math.ceil(resumeUrls.length / maxResumesPerRequest);
          
          setProcessingState({
            status: 'processing',
            message: `Processing batch ${batchNumber}/${totalBatches}...`
          });
          
          console.log(`Sending batch ${batchNumber}/${totalBatches} with ${batch.length} resumes`);
          
          const batchParams = new URLSearchParams({
            action: 'process_resume_batch',
            company_id: user?.profile?.company_id || '',
            user_id: user?.id || '',
            job_description_id: selectedJDId,
            criteria_grid_id: selectedCriteriaGridId,
            batch_number: batchNumber.toString(),
            total_batches: totalBatches.toString(),
            resume_count: batch.length.toString(),
            batch_type: actionType,
            timestamp: new Date().toISOString()
          });

          // Add only this batch's resume data
          batch.forEach((resume, index) => {
            batchParams.append(`resume_${index}_id`, resume.resume_id);
            batchParams.append(`resume_${index}_name`, resume.candidate_name);
            batchParams.append(`resume_${index}_url`, resume.cv_file_url);
          });

          const batchUrl = `${CV_WEBHOOK_URL}?${batchParams.toString()}`;
          console.log(`Batch ${batchNumber} URL length:`, batchUrl.length);

          try {
            const batchResponse = await fetch(batchUrl, {
              method: 'GET',
              mode: 'no-cors', // Avoid CORS preflight
            });

            // Since we're using no-cors, we can't access the response status
            // We'll consider network-level failures only
            console.log(`Batch ${batchNumber} sent successfully (no-cors mode)`);
            
          } catch (batchError) {
            throw new Error(`Failed to process batch ${batchNumber}/${totalBatches}: Network error`);
          }
          
          // Small delay between batches to avoid overwhelming the server
          if (i + maxResumesPerRequest < resumeUrls.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        console.log('All batches sent successfully');
        
      } else {
        // Send all resumes in a single request (small number)
        resumeUrls.forEach((resume, index) => {
          params.append(`resume_${index}_id`, resume.resume_id);
          params.append(`resume_${index}_name`, resume.candidate_name);
          params.append(`resume_${index}_url`, resume.cv_file_url);
        });

        const fullUrl = `${CV_WEBHOOK_URL}?${params.toString()}`;
        
        console.log('Sending resumes to webhook via GET:', {
          webhookUrl: CV_WEBHOOK_URL,
          resumeCount: resumeUrls.length,
          actionType,
          jobDescriptionId: selectedJDId,
          criteriaGridId: selectedCriteriaGridId,
          urlLength: fullUrl.length
        });

        // Check URL length and warn if it might be too long
        if (fullUrl.length > 8000) {
          console.warn('URL is very long:', fullUrl.length, 'characters. This might cause issues.');
          throw new Error(`URL too long (${fullUrl.length} chars). Please reduce the number of resumes or contact support.`);
        }

        try {
          const response = await fetch(fullUrl, {
            method: 'GET',
            mode: 'no-cors', // Avoid CORS preflight
          });

          // Since we're using no-cors, we can't access the response status
          // We'll consider network-level failures only
          console.log('Resumes sent successfully (no-cors mode)');
          
        } catch (fetchError) {
          throw new Error('Failed to contact the Pro-Valuation service. Please check your network connection and try again.');
        }
      }
    } catch (error: any) {
      console.error('Error in sendResumesToWebhook:', error);
      // Rethrow with a more user-friendly message if needed
      throw new Error(error.message || 'Failed to process resumes. Please try again or contact support if the issue persists.');
    }
  };

  // Send only newly uploaded resumes (from current session) to n8n webhook
  const handleProcessNewResumes = async () => {
    if (!user?.profile?.company_id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to process resumes.",
        variant: "destructive",
      });
      return;
    }

    // Get only resumes that were uploaded in this session
    const newResumes = resumes.filter(resume => newlyUploadedIds.has(resume.id) && resume.fileUrl);

    if (newResumes.length === 0) {
      toast({
        title: "No New Resumes",
        description: "No new resumes found to process. Upload some resumes first.",
        variant: "default",
      });
      return;
    }

    try {
      setIsEvaluating(true);

      // Get selected job description and criteria grid from session storage
      const selectedJDId = sessionStorage.getItem('selectedJDId') || '';
      const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId') || '';

      // Validation checks
      if (!selectedJDId) {
        toast({
          title: "No Job Description Selected",
          description: "Please select a job description from the dropdown above first.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedCriteriaGridId) {
        toast({
          title: "No Criteria Grid Selected",
          description: "Please select an evaluation criteria grid from the dropdown above first.",
          variant: "destructive",
        });
        return;
      }

      // Format resume data for webhook
      const resumeUrls = newResumes.map(resume => ({
        resume_id: resume.id,
        candidate_name: resume.name,
        cv_file_url: resume.fileUrl,
        created_at: new Date().toISOString()
      }));

      // Record the start time for evaluation timing and initial report count
      const startTime = new Date().toISOString();
      console.log('🚀 Setting evaluation start time (handleProcessNewResumes):', startTime);
      console.log('📊 Setting expected resume count:', resumeUrls.length);
      
      // Capture initial report count for current user/JD/criteria combination
      const currentReports = assessmentReports.filter(report => 
        report.created_by === user.id && 
        report.final_match !== null && 
        report.final_match !== undefined
      );
      console.log('📊 Initial report count:', currentReports.length);
      
      setEvaluationStartTime(startTime);
      setExpectedResumeCount(resumeUrls.length);
      setInitialReportCount(currentReports.length);
      setLastProgressCount(0); // Reset progress tracking
      
      await sendResumesToWebhook(resumeUrls, selectedJDId, selectedCriteriaGridId, 'new_resumes');

      // Start auto-refresh to check for assessment reports
      startAutoRefreshAssessments();

      toast({
        title: "Processing Started",
        description: `Successfully sent ${resumeUrls.length} new resumes to n8n for processing.`,
      });

    } catch (error: any) {
      console.error('Error processing new resumes:', error);
      
      // Even if processing fails, start auto-refresh in case N8N processes it later
      startAutoRefreshAssessments();
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to send new resumes to n8n webhook.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Send all uploaded resume URLs to n8n webhook for processing
  const handleProcessAllResumes = async () => {
    if (!user?.profile?.company_id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to process resumes.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get all resumes from database for this company
      const { data: resumesData, error } = await supabase
        .from('resumes')
        .select('resume_id, candidate_name, cv_file, created_at')
        .eq('company_id', user.profile.company_id)
        .not('cv_file', 'is', null); // Only get resumes with files

      if (error) throw error;

      if (!resumesData || resumesData.length === 0) {
        toast({
          title: "No Resumes Found",
          description: "No uploaded resumes found to process.",
          variant: "default",
        });
        return;
      }

      setIsEvaluating(true);

      // Prepare the data for the webhook
      const resumeUrls = resumesData.map(resume => ({
        resume_id: resume.resume_id,
        candidate_name: resume.candidate_name,
        cv_file_url: resume.cv_file,
        created_at: resume.created_at
      }));

      // Get selected job description and criteria grid from session storage
      const selectedJDId = sessionStorage.getItem('selectedJDId') || '';
      const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId') || '';

      // Warn if no job description is selected
      if (!selectedJDId) {
        toast({
          title: "No Job Description Selected",
          description: "Please select a job description from the dropdown above first.",
          variant: "destructive",
        });
        return;
      }

      // Warn if no criteria grid is selected
      if (!selectedCriteriaGridId) {
        toast({
          title: "No Criteria Grid Selected",
          description: "Please select an evaluation criteria grid from the dropdown above first.",
          variant: "destructive",
        });
        return;
      }

      // Record the start time for evaluation timing and initial report count
      const startTime = new Date().toISOString();
      console.log('🚀 Setting evaluation start time (handleProcessAllResumes):', startTime);
      console.log('📊 Setting expected resume count:', resumeUrls.length);
      
      // Capture initial report count for current user/JD/criteria combination
      const currentReports = assessmentReports.filter(report => 
        report.created_by === user.id && 
        report.final_match !== null && 
        report.final_match !== undefined
      );
      console.log('📊 Initial report count:', currentReports.length);
      
      setEvaluationStartTime(startTime);
      setExpectedResumeCount(resumeUrls.length);
      setInitialReportCount(currentReports.length);
      setLastProgressCount(0); // Reset progress tracking
      
      await sendResumesToWebhook(resumeUrls, selectedJDId, selectedCriteriaGridId, 'all_resumes');

      // Start auto-refresh to check for assessment reports
      startAutoRefreshAssessments();

      toast({
        title: "Processing Started",
        description: `Successfully sent ${resumeUrls.length} resumes with job description (${selectedJDId}) and criteria grid (${selectedCriteriaGridId}) to n8n for processing.`,
      });

    } catch (error: any) {
      console.error('Error processing all resumes:', error);
      
      // Even if processing fails, start auto-refresh in case N8N processes it later
      startAutoRefreshAssessments();
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to send resumes to n8n webhook.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const hasProcessedResumes = resumes.some(resume => resume.status === 'processed');
  const hasResumesInDatabase = resumes.length > 0; // Check if there are any resumes loaded from database
  const hasNewlyUploadedResumes = selectedFiles.some(f => f.status === 'completed') || getSessionUploadedFiles().length > 0; // Check for successfully uploaded resumes

  // Export assessment reports to Excel
  const handleExportReport = () => {
    if (assessmentReports.length === 0) {
      toast({
        title: "No Data to Export",
        description: "No assessment reports found to export.",
        variant: "default",
      });
      return;
    }

    try {
      // First, collect all unique parameters across all candidates
      const allParameters = new Set<string>();
      assessmentReports.forEach((report) => {
        if (report.scores && Array.isArray(report.scores)) {
          report.scores.forEach((score: any) => {
            if (score.parameter) {
              allParameters.add(score.parameter);
            }
          });
        }
      });

      // Convert to array and sort for consistent column order
      const parameterColumns = Array.from(allParameters).sort();

      // Prepare data for Excel export - one row per candidate
      const exportData: any[] = [];

      assessmentReports.forEach((report) => {
        const candidateName = report.candidate_name || 'Unknown';
        const summary = report.summary || '';
        const recommendation = report.recommendation || '';
        
        // Create a single row for this candidate
        const candidateRow: any = {
          'Candidate Name': candidateName
        };

        // Add parameter scores as individual columns
        if (report.scores && Array.isArray(report.scores)) {
          // Create a map of parameter -> score for quick lookup
          const scoreMap: { [key: string]: number } = {};
          report.scores.forEach((score: any) => {
            if (score.parameter && score.score !== undefined) {
              scoreMap[score.parameter] = score.score;
            }
          });

          // Add each parameter as a column
          parameterColumns.forEach((parameter) => {
            candidateRow[parameter] = scoreMap[parameter] || 0;
          });
        } else {
          // If no scores, set all parameters to 0
          parameterColumns.forEach((parameter) => {
            candidateRow[parameter] = 0;
          });
        }

        // Add summary and recommendation at the end
        candidateRow['Summary'] = summary;
        candidateRow['Recommendation'] = recommendation;

        exportData.push(candidateRow);
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 20 }, // Candidate Name
        ...parameterColumns.map(() => ({ wch: 15 })), // Parameter columns
        { wch: 40 }, // Summary
        { wch: 40 }  // Recommendation
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessment Report');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `Assessment_Report_${timestamp}.xlsx`;

      // Write and download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Assessment report exported as ${filename}`,
      });

    } catch (error: any) {
      console.error('Error exporting report:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export assessment report.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Resume Uploads</h2>
        <p className="text-muted-foreground">Upload multiple candidate resumes for evaluation</p>
      </div>

      {/* Top Row: Job Description Selection, Criteria Selection, and Provaluate Button */}
      <Card className="animate-fade-in mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Job Description Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-primary-600" />
                <h3 className="font-medium text-gray-900">Job Description</h3>
              </div>
              <Select value={selectedJobDescriptionId} onValueChange={handleJobDescriptionSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select job description..." />
                </SelectTrigger>
                <SelectContent>
                  {jobDescriptions.map(jd => (
                    <SelectItem key={jd.jd_id} value={jd.jd_id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{jd.title}</span>
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(jd.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedJobDescriptionId && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-green-800">Selected</span>
                  </div>
                </div>
              )}
              
              {jobDescriptions.length === 0 && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <p className="text-yellow-800">
                    No job descriptions found. Create one in Job Upload section.
                  </p>
                </div>
              )}
            </div>

            {/* Criteria Grid Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Grid className="w-4 h-4 text-primary-600" />
                <h3 className="font-medium text-gray-900">Evaluation Criteria</h3>
              </div>
              <Select value={selectedCriteriaGridId} onValueChange={handleCriteriaGridSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select criteria..." />
                </SelectTrigger>
                <SelectContent>
                  {criteriaGrids.map(grid => (
                    <SelectItem key={grid.id} value={grid.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{grid.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {grid.criteria.length} parameters
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedCriteriaGridId && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-green-800">Selected</span>
                  </div>
                </div>
              )}
              
              {criteriaGrids.length === 0 && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <p className="text-yellow-800">
                    No criteria found. Create one in Job Upload section.
                  </p>
                </div>
              )}
            </div>

            
          </div>
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Upload Area */}
      <Card className="animate-fade-in">
        <CardContent className="p-6">
          <div 
            className="border-2 border-dashed border-primary-200 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onClick={(e) => {
              // Only trigger file select if clicking directly on the dropzone, not on buttons
              if (e.target === e.currentTarget) {
                handleFileSelect();
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                const append = selectedFiles.length > 0; // Append if there are existing files
                handleFileUpload(files, append);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {selectedFiles.length > 0 ? (
              <>
                <FileText className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-green-700">
                  {selectedFiles.length} Resume{selectedFiles.length > 1 ? 's' : ''} Selected
                </h3>
                <div className="space-y-2 mb-4">
                  {selectedFiles.map((fileData, index) => (
                    <div key={index} className={`flex items-center justify-between gap-2 text-sm p-2 rounded ${
                      currentlyProcessing === index ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className={`w-4 h-4 ${
                          fileData.status === 'completed' ? 'text-green-600' :
                          fileData.status === 'error' ? 'text-red-600' :
                          fileData.status === 'uploading' ? 'text-blue-600' : 'text-muted-foreground'
                        }`} />
                        <span className="truncate max-w-xs">{fileData.file.name}</span>
                        <span className="text-xs">({(fileData.file.size / 1024 / 1024).toFixed(1)} MB)</span>
                        
                        <div className="flex items-center gap-1">
                          {fileData.status === 'pending' && currentlyProcessing !== index && (
                            <span className="text-xs text-gray-500">Waiting...</span>
                          )}
                          {fileData.status === 'uploading' || currentlyProcessing === index && fileData.status === 'pending' && (
                            <div className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                              <span className="text-xs text-blue-600">Uploading...</span>
                            </div>
                          )}
                          {fileData.status === 'completed' && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              <span className="text-xs text-green-600">Uploaded</span>
                            </div>
                          )}
                          {fileData.status === 'error' && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600">✗ Failed</span>
                              {fileData.errorMessage && (
                                <span className="text-xs text-red-500">({fileData.errorMessage})</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Remove button - only show if not currently uploading */}
                      {fileData.status !== 'uploading' && currentlyProcessing !== index && (
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="ml-2 p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors"
                          title="Remove file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className={`mb-4 ${
                  selectedFiles.every(f => f.status === 'completed') ? 'text-green-600' :
                  selectedFiles.some(f => f.status === 'error') ? 'text-red-600' :
                  selectedFiles.some(f => f.status === 'uploading') ? 'text-blue-600' :
                  'text-gray-700'
                }`}>
                  {selectedFiles.every(f => f.status === 'completed') ? 'All files uploaded successfully! You can add more files or proceed with evaluation.' :
                   selectedFiles.some(f => f.status === 'error') ? 'Some files failed to upload. You can remove failed files and try again.' :
                   selectedFiles.some(f => f.status === 'uploading') ? 'Files are being uploaded...' :
                   selectedFiles.some(f => f.status === 'pending') ? 'Files are ready. Click "Start Upload" to begin uploading.' :
                   'Files ready for upload. You can add more files or start uploading.'}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={handleFileSelect}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    Add More Files
                  </Button>
                  
                  {/* Show Start Upload button if there are pending files */}
                  {selectedFiles.some(f => f.status === 'pending') && (
                    <Button 
                      onClick={startPendingUploads}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      type="button" // Prevent form submission
                    >
                      Start Upload
                    </Button>
                  )}
                  
                                     {selectedFiles.length > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSelectedFiles([]);
                        clearSessionUploadedFiles();
                        setNewlyUploadedIds(new Set());
                        setCurrentlyProcessing(-1);
                        // Clear evaluation timing when clearing files
                        console.log('🔄 Clearing evaluation start time (clear all files)');
                        setEvaluationStartTime(null);
                        setExpectedResumeCount(0);
                        setLastProgressCount(0);
                        setInitialReportCount(0);
                        stopAutoRefreshAssessments();
                      }}
                      className="text-sm"
                    >
                      Clear All
                    </Button>
                  )}

                </div>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Upload Candidate Resumes</h3>
                <p className="text-muted-foreground mb-4">
                  Drop multiple PDF files here or click to browse. Select files first, then click "Start Upload".
                </p>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from bubbling to dropzone
                    handleFileSelect();
                  }}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  Select Files
                </Button>
              </>
            )}
          </div>
          {/* Provaluate Button */}
          <div className="flex flex-col justify-end h-full">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  {/*<Play className="w-4 h-4 text-accent-600" /> */}
                  {/*<h3 className="font-medium text-gray-900">Action</h3>*/}
                </div>
                
                <Button
                  onClick={handleEvaluation}
                  disabled={isEvaluating || !selectedJobDescriptionId || !selectedCriteriaGridId || !hasNewlyUploadedResumes}
                  className={`relative w-full ${
                    processingState.status === 'processing' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : processingState.status === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : processingState.status === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-accent-600 hover:bg-accent-700'
                  } text-white disabled:opacity-50`}
                >
                  {processingState.status === 'processing' ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{processingState.message}</span>
                    </div>
                  ) : processingState.status === 'error' ? (
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-4 h-4" />
                      <span>{processingState.message}</span>
                    </div>
                  ) : processingState.status === 'success' ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>{processingState.message}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" />
                      <span>Pro-Valuate</span>
                    </div>
                  )}
                </Button>
                
                {/* Show error message if any */}
                {processingState.status === 'error' && processingState.error && (
                  <div className="p-2 mt-2 text-sm text-red-800 bg-red-100 rounded-md">
                    {processingState.error}
                  </div>
                )}
                
                {/* Show helper text below button */}
                {processingState.status === 'idle' && (
                  <div className="text-center mt-2">
                    <p className="text-xs text-muted-foreground">
                      {!selectedJobDescriptionId || !selectedCriteriaGridId 
                        ? "Select job description and criteria above"
                        : !hasNewlyUploadedResumes
                        ? "Upload resumes to get started"
                        : "Ready to evaluate resumes"}
                    </p>
                    {(selectedJobDescriptionId && selectedCriteriaGridId && !hasNewlyUploadedResumes) && (
                      <p className="text-xs text-gray-500 italic mt-1">
                        Disclaimer: AI can make mistakes. Please use the tool judiciously.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
                </CardContent>
      </Card>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Resume List (now Assessment Reports) */}
      <div className="grid gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary-800">
            Candidate Pool ({assessmentReports.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshReports}
              disabled={loadingReports}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingReports ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            {isWaitingForAssessments && (
              <div className="flex items-center text-xs text-blue-600">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                {(() => {
                  if (expectedResumeCount > 0 && user?.id) {
                    try {
                      // Count current session reports (created by current user with final_match score)
                      const currentSessionReports = assessmentReports.filter(report => 
                        report.created_by === user.id && 
                        report.final_match !== null && 
                        report.final_match !== undefined
                      );
                      
                      // Calculate new reports by subtracting initial count
                      const newCompletedCount = Math.max(0, currentSessionReports.length - initialReportCount);
                      
                      return `Processing CV... (${newCompletedCount}/${expectedResumeCount})`;
                    } catch (error) {
                      return `Processing CV... (0/${expectedResumeCount})`;
                    }
                  }
                  return 'Processing CV...';
                })()}
              </div>
            )}
          </div>
        </div>
        {loadingReports ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            <span className="ml-2 text-muted-foreground">Loading assessment reports...</span>
          </div>
        ) : assessmentReports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No candidates found for the selected Job Description and Criteria.
          </div>
        ) : (
          assessmentReports.map((report) => {
            // Extract recommendation status for this report
            const recommendationStatus = extractRecommendationStatus(report.recommendation);
            
            return (
            <Card 
              key={report.id}
              className="animate-fade-in hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleCandidateClick(report.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-primary-100 p-2 rounded-lg">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-primary-800">{report.candidate_name || 'Unknown'}</h4>
                          {report.created_at && evaluationStartTime && (() => {
                            // Only show timing for reports created after the current evaluation started
                            const reportTime = new Date(report.created_at);
                            const evalStartTime = new Date(evaluationStartTime);
                            
                            if (reportTime >= evalStartTime) {
                              const evaluationTime = getEvaluationTime(report.created_at);
                              if (evaluationTime.text !== 'Unknown') {
                                return (
                                  <span className={`text-xs ${evaluationTime.colorClass} px-2 py-1 rounded-full`}>
                                    Evaluated in {evaluationTime.text}
                                  </span>
                                );
                              }
                            }
                            return null;
                          })()}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {report.resume_url ? (
                          <a 
                            href={report.resume_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline hover:underline"
                          >
                            View Candidate
                          </a>
                        ) : (
                          'No file'
                        )}
                      </p>
                        <p className="text-sm text-gray-700">{report.summary || report.recommendation || ''}</p>
                      </div>
                        </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${getRecommendationStyle(recommendationStatus)}`}>
                        {recommendationStatus}
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {report.final_match ? `${Math.round(report.final_match * 10)}%` : 'No Score'}
                      </div>
                    </div>
                  </div>
                {/* Optionally, show detailed scores if available */}
                {report.scores && Array.isArray(report.scores) && report.scores.length > 0 && (
                  <div className="mt-4">
                    {report.scores.map((score: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 mb-2">
                        <div className="w-40 font-medium">{score.parameter}</div>
                        <div className="flex-1">
                          <div className="relative w-full h-3 bg-gray-200 rounded-full">
                            <div
                              className="absolute top-0 left-0 h-3 rounded-full bg-blue-600"
                              style={{ width: `${score.score}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-12 text-right font-semibold">{score.score}%</div>
                        <div className="w-20 text-right text-xs text-muted-foreground">Weight: {score.weightage}%</div>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
          );
          })
        )}
      </div>

      {/* Scorecard Dialog */}
      <Dialog open={showScorecard} onOpenChange={setShowScorecard}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
          {selectedCandidate && (
            <MatchScorecardSection
              onCandidateSelect={() => {}}
              selectedCandidateId={selectedCandidate}
              selectedCandidateData={assessmentReports.find(report => report.id === selectedCandidate)}
              onClose={() => setShowScorecard(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        //accept=".pdf,.doc,.docx"
        accept=".pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
