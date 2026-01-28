import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, User, CheckCircle, Play, Briefcase, Grid, Loader2, Download, X, RefreshCw, AlertTriangle, ArrowRight, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import { useCurrentStep, useNavigateToStep, WORKFLOW_STEPS } from '@/hooks/useWorkflowNavigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { UsageTrackingService, CompanyUsageInfo } from '@/services/usageTrackingService';
import { MatchScorecardSection } from './MatchScorecardSection';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { useSession } from '@/contexts/SessionContext';
import { TrialExpirationWarning } from './TrialExpirationWarning';
import { useSearchParams } from 'react-router-dom'; // ✅ ADD: Import useSearchParams
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { UiAnalyticsService } from '@/services/uiAnalyticsService';

interface ResumeData {
  id: string;
  name: string;
  fileName: string;
  status: 'uploading' | 'processed' | 'error' | 'uploaded';
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
const ALLOWED_FILE_TYPES = ['.pdf', '.docx', '.txt'];
// Import API service instead of using webhooks
import { apiService } from '@/services/api';

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
    console.log('Existing session files:', existing);
    const updated = [...existing, fileData];
    console.log('Updated session files:', updated);
    sessionStorage.setItem('uploadedFiles', JSON.stringify(updated));
    console.log('Added file to session storage:', fileData.candidate_name);
    console.log('Session storage after adding:', sessionStorage.getItem('uploadedFiles'));
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

const normalizeNumericScore = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseReportScores = (scores: any): any[] => {
  if (Array.isArray(scores)) {
    return scores;
  }
  if (typeof scores === 'string') {
    try {
      const parsed = JSON.parse(scores);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Unable to parse report scores', error);
      return [];
    }
  }
  return [];
};

// Keep the old score-based function for fallback if needed
const getMatchStatus = (score: number) => {
  if (score >= 85) return { status: 'excellent', text: 'Excellent Match', className: 'bg-green-100 text-green-700' };
  if (score >= 70) return { status: 'good', text: 'Good Match', className: 'bg-yellow-100 text-yellow-700' };
  return { status: 'nomatch', text: 'No Match', className: 'bg-orange-100 text-orange-700' };
};

interface ResumeUploadSectionProps {
  onSectionReady?: () => void;
}

export const ResumeUploadSection = ({ onSectionReady }: ResumeUploadSectionProps) => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileData[]>([]); // Add state for selected files with status
  const [newlyUploadedIds, setNewlyUploadedIds] = useState<Set<string>>(new Set()); // Track newly uploaded resumes
  const [currentlyProcessing, setCurrentlyProcessing] = useState<number>(-1); // Track which file is currently being processed
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  // ✅ FIX: Initialize state with sessionStorage values (like MatchScorecardSection does)
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>(() => sessionStorage.getItem('selectedJDId') || '');
  const [criteriaGrids, setCriteriaGrids] = useState<SavedCriteriaGrid[]>([]);
  const [selectedCriteriaGridId, setSelectedCriteriaGridId] = useState<string>(() => sessionStorage.getItem('selectedCriteriaGridId') || '');
  const [assessmentReports, setAssessmentReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { setCurrentJobDescription, setCurrentEvaluationCriteria, isSessionComplete } = useSession();
  const [searchParams, setSearchParams] = useSearchParams(); // ✅ ADD: Get search params
  const currentStep = useCurrentStep();
  const navigateToStep = useNavigateToStep();
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    message: ''
  });
  const [isWaitingForAssessments, setIsWaitingForAssessments] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [expectedResumeCount, setExpectedResumeCount] = useState<number>(0);
  const [lastProgressCount, setLastProgressCount] = useState<number>(0);
  const [initialReportCount, setInitialReportCount] = useState<number>(0);

  // Check if analysis is complete (has completed reports)
  const hasCompletedReports = assessmentReports.some(report => 
    report.final_match !== null && 
    report.final_match !== undefined
  );

  const [processingCompleted, setProcessingCompleted] = useState<boolean>(false);
  const [companyUsageInfo, setCompanyUsageInfo] = useState<CompanyUsageInfo | null>(null);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [jdCriteriaMismatch, setJdCriteriaMismatch] = useState<{
    isMismatched: boolean;
    jdTitle: string;
    criteriaName: string;
    reason: string;
  } | null>(null);

  const isProcessingOverlayVisible =
    processingState.status === 'processing' || isWaitingForAssessments;

  // Track completion of a full CV screening run
  useEffect(() => {
    if (processingCompleted) {
      UiAnalyticsService.track({
        name: 'cv_screening_completed',
        area: 'cv_screening_resume_upload',
        metadata: {
          resumeCount: resumes.length,
        },
      });
    }
  }, [processingCompleted, resumes.length]);

  // ✅ ADD: Read directly from URL params on mount (before Dashboard's useEffect runs)
  // This ensures we pick up JD and criteria immediately when opening from extension
  useEffect(() => {
    const jdId = searchParams.get('jdId');
    const criteriaId = searchParams.get('criteriaId');
    
    if (jdId) {
      console.log('✅ ResumeUploadSection: Found JD in URL params:', jdId);
      setSelectedJobDescriptionId(jdId);
      sessionStorage.setItem('selectedJDId', jdId);
    }
    if (criteriaId) {
      console.log('✅ ResumeUploadSection: Found Criteria in URL params:', criteriaId);
      setSelectedCriteriaGridId(criteriaId);
      sessionStorage.setItem('selectedCriteriaGridId', criteriaId);
    }
  }, [searchParams]); // Run when searchParams change

  // Hydrate selections from sessionStorage on mount (keep as fallback)
  useEffect(() => {
    try {
      const storedJD = sessionStorage.getItem('selectedJDId');
      const storedCriteria = sessionStorage.getItem('selectedCriteriaGridId');
      if (storedJD && storedJD !== selectedJobDescriptionId) {
        setSelectedJobDescriptionId(storedJD);
      }
      if (storedCriteria && storedCriteria !== selectedCriteriaGridId) {
        setSelectedCriteriaGridId(storedCriteria);
      }
    } catch (e) {
      console.warn('Unable to read selections from sessionStorage', e);
    }
  }, []); // Only run on mount

  // ✅ ADD: Listen for custom events from Dashboard when URL parameters are set
  // This ensures JD and criteria selected in extension are reflected immediately
  useEffect(() => {
    const checkSessionStorage = () => {
      const jd = sessionStorage.getItem('selectedJDId') || '';
      const grid = sessionStorage.getItem('selectedCriteriaGridId') || '';
      if (jd && jd !== selectedJobDescriptionId) {
        console.log('🔄 Syncing JD from sessionStorage:', jd);
        setSelectedJobDescriptionId(jd);
      }
      if (grid && grid !== selectedCriteriaGridId) {
        console.log('🔄 Syncing Criteria from sessionStorage:', grid);
        setSelectedCriteriaGridId(grid);
      }
    };
    
    // Check immediately on mount
    checkSessionStorage();
    
    // Listen for custom events from Dashboard when URL parameters are set
    const handleJDSelected = (event: CustomEvent) => {
      const jdId = event.detail?.jdId || sessionStorage.getItem('selectedJDId') || '';
      if (jdId && jdId !== selectedJobDescriptionId) {
        console.log('🔄 JD selected from URL parameter:', jdId);
        setSelectedJobDescriptionId(jdId);
      }
    };
    
    const handleCriteriaSelected = (event: CustomEvent) => {
      const criteriaId = event.detail?.criteriaId || sessionStorage.getItem('selectedCriteriaGridId') || '';
      if (criteriaId && criteriaId !== selectedCriteriaGridId) {
        console.log('🔄 Criteria selected from URL parameter:', criteriaId);
        setSelectedCriteriaGridId(criteriaId);
      }
    };
    
    window.addEventListener('jd-selected', handleJDSelected as EventListener);
    window.addEventListener('criteria-selected', handleCriteriaSelected as EventListener);
    
    // Also listen for storage events (when extension updates sessionStorage in another tab)
    window.addEventListener('storage', checkSessionStorage);
    
    // Also check periodically in case extension updated it in same window
    const interval = setInterval(checkSessionStorage, 1000);
    
    return () => {
      window.removeEventListener('jd-selected', handleJDSelected as EventListener);
      window.removeEventListener('criteria-selected', handleCriteriaSelected as EventListener);
      window.removeEventListener('storage', checkSessionStorage);
      clearInterval(interval);
    };
  }, [selectedJobDescriptionId, selectedCriteriaGridId]);

  useEffect(() => {
    if (!selectedJobDescriptionId) {
      setCurrentJobDescription(null);
      return;
    }
    const activeJobDescription = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
    setCurrentJobDescription(activeJobDescription || null);
  }, [jobDescriptions, selectedJobDescriptionId, setCurrentJobDescription]);

  useEffect(() => {
    if (!selectedCriteriaGridId) {
      setCurrentEvaluationCriteria(null);
      return;
    }
    const activeCriteriaGrid = criteriaGrids.find(grid => grid.id === selectedCriteriaGridId);
    setCurrentEvaluationCriteria(activeCriteriaGrid || null);
  }, [criteriaGrids, selectedCriteriaGridId, setCurrentEvaluationCriteria]);

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
          console.log('❌ Debug - isWaitingForAssessments:', isWaitingForAssessments);
          console.log('❌ Debug - expectedResumeCount:', expectedResumeCount);
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
    if (!isWaitingForAssessments || expectedResumeCount <= 0) {
      return;
    }

    try {
      // Count current reports that match our criteria (all completed reports for current JD/criteria)
      const currentSessionReports = assessmentReports.filter(report => 
        report.final_match !== null && 
        report.final_match !== undefined
      );

      // Calculate new reports by subtracting initial count
      const newCompletedCount = Math.max(0, currentSessionReports.length - initialReportCount);
      
      console.log(`📊 Session reports: ${currentSessionReports.length}, Initial: ${initialReportCount}, New: ${newCompletedCount}/${expectedResumeCount}`);
      console.log(`📊 Debug - isWaitingForAssessments: ${isWaitingForAssessments}, lastProgressCount: ${lastProgressCount}`);

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
  }, [assessmentReports, isWaitingForAssessments, expectedResumeCount, initialReportCount, lastProgressCount]);

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
        .select('jd_id, title, jd_file, created_at, status')
        .eq('company_id', user.profile.company_id)
        .eq('status', 'active')
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

  // Load criteria grids from database using grid JSON field, filtered by selected JD
  const loadCriteriaGrids = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log('Loading criteria grids for user:', user.id);
      console.log('Selected JD ID:', selectedJobDescriptionId);
      
      // Build query to filter criteria by selected JD
      let query = supabase
        .from('criteria')
        .select('criteria_id, criteria_name, grid, created_at, jd_id, company_id')
        // ✅ MODIFIED: Include company-specific OR global (company_id IS NULL)
        .or(`company_id.eq.${user.profile?.company_id},company_id.is.null`);
      
      // Filter criteria based on selected JD
      if (selectedJobDescriptionId) {
        // Show criteria for this JD OR default criteria (jd_id is NULL)
        query = query.or(`jd_id.eq.${selectedJobDescriptionId},jd_id.is.null`);
        console.log('Filtering criteria for JD:', selectedJobDescriptionId);
      } else {
        // If no JD selected, show only default criteria
        query = query.is('jd_id', null);
        console.log('No JD selected, showing only default criteria');
      }
      
      const { data: grids, error } = await query
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

      // Sort: Default criteria first (jd_id is null), then JD-specific
      const sortedGrids = formattedGrids.sort((a, b) => {
        const gridA = Object.values(uniqueGrids).find((g: any) => g.criteria_id === a.id) as any;
        const gridB = Object.values(uniqueGrids).find((g: any) => g.criteria_id === b.id) as any;
        const aIsDefault = !gridA?.jd_id;
        const bIsDefault = !gridB?.jd_id;
        if (aIsDefault && !bIsDefault) return -1; // Default first
        if (!aIsDefault && bIsDefault) return 1;
        return 0; // Keep original order for same type
      });

      console.log('Formatted criteria grids:', sortedGrids);
      console.log('Grid IDs that will be sent to CV Analyzer:', sortedGrids.map(g => ({ name: g.name, id: g.id })));
      setCriteriaGrids(sortedGrids);
    } catch (error) {
      console.error('Error loading criteria grids:', error);
      toast({
        title: "Error Loading Criteria Grids",
        description: "Failed to load saved evaluation criteria.",
        variant: "destructive"
      });
    }
  }, [user?.id, user?.profile?.company_id, selectedJobDescriptionId, toast]);

  // Helper function to validate JD-Criteria compatibility
  const validateJdCriteriaCompatibility = async (jdId: string, criteriaId: string): Promise<boolean> => {
    if (!jdId || !criteriaId) return false;
    
    try {
      const { data, error } = await supabase
        .from('criteria')
        .select('criteria_id, criteria_name, jd_id')
        .eq('criteria_id', criteriaId)
        .single();
      
      if (error || !data) return false;
      
      const criteriaJdId = data.jd_id;
      const isGlobalCriteria = criteriaJdId === null;
      const isMatchingJD = criteriaJdId === jdId;
      
      // Valid if criteria is global OR matches the JD
      return isGlobalCriteria || isMatchingJD;
    } catch (error) {
      console.error('Error validating JD-Criteria compatibility:', error);
      return false;
    }
  };

  // Load resumes, job descriptions, and criteria grids when component mounts or user changes
  useEffect(() => {
    if (user?.profile?.company_id) {
      loadResumes();
      loadJobDescriptions();
      loadCriteriaGrids();
      checkCompanyUsageLimits();
      // Clear any stale session data on component mount
      clearSessionUploadedFiles();
      setSelectedFiles([]);
      setNewlyUploadedIds(new Set());
      // Clear evaluation timing on component mount
      setExpectedResumeCount(0);
      setLastProgressCount(0);
      setInitialReportCount(0);
    }
  }, [user?.profile?.company_id, loadResumes, loadJobDescriptions, loadCriteriaGrids]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => onSectionReady?.(), 700);
    return () => clearTimeout(t);
  }, [user, onSectionReady]);

  // Check company's CV processing limits
  const checkCompanyUsageLimits = async () => {
    if (!user?.profile?.company_id) return;
    
    try {
      const usageInfo = await UsageTrackingService.checkCVProcessingLimit(user.profile.company_id);
      setCompanyUsageInfo(usageInfo);
    } catch (error) {
      console.error('Error checking company usage limits:', error);
      toast({
        title: "Usage Check Failed",
        description: "Could not verify your plan limits. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Set default selections from session storage and show success messages
  useEffect(() => {
    if (jobDescriptions.length > 0 && selectedJobDescriptionId) {
      const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
      if (selectedJD) {
        console.log('Selected Job Description:', selectedJD.title);
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

  // ✅ NEW: Validate JD-Criteria compatibility when both are selected
  useEffect(() => {
    const validateExistingSelection = async () => {
      if (selectedJobDescriptionId && selectedCriteriaGridId) {
        const isValid = await validateJdCriteriaCompatibility(selectedJobDescriptionId, selectedCriteriaGridId);
        
        if (!isValid) {
          const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
          const currentCriteria = criteriaGrids.find(grid => grid.id === selectedCriteriaGridId);
          
          // Set persistent mismatch warning
          setJdCriteriaMismatch({
            isMismatched: true,
            jdTitle: selectedJD?.title || 'Selected Job',
            criteriaName: currentCriteria?.name || 'Selected Criteria',
            reason: `The selected criteria "${currentCriteria?.name || 'Unknown'}" was created for a different job description and is not suitable for "${selectedJD?.title || 'this job'}". Please select a compatible criteria.`
          });
        } else {
          // Valid combination - clear mismatch warning
          setJdCriteriaMismatch(null);
        }
      } else {
        // No selection - clear any mismatch
        setJdCriteriaMismatch(null);
      }
    };

    if (selectedJobDescriptionId && selectedCriteriaGridId && criteriaGrids.length > 0) {
      validateExistingSelection();
    }
  }, [selectedJobDescriptionId, selectedCriteriaGridId, criteriaGrids, jobDescriptions]);

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
          console.log(`📄 Report ${report.id}: created_at = ${report.created_at}, updated_at = ${report.updated_at}`);
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
      //return 'Invalid file type. Please upload PDF, DOCX, or TXT files';
      return 'Invalid file type. Please upload PDF, DOCX, or TXT files';
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

    try {
      // Get selected job description and criteria grid from session storage
      const selectedJDId = sessionStorage.getItem('selectedJDId') || '';
      const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId') || '';

      // Validation checks
      if (!selectedJDId) {
        throw new Error('No job description selected. Please select a job description first.');
      }

      if (!selectedCriteriaGridId) {
        throw new Error('No criteria grid selected. Please select an evaluation criteria grid first.');
      }

      // Step 3: Prepare form data for CV Analyzer complete workflow
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jd_id', selectedJDId);
      formData.append('criteria_id', selectedCriteriaGridId);
      formData.append('user_id', user?.id || '');
      formData.append('company_id', user?.profile?.company_id || '');
      formData.append('candidate_name', candidateName);

      // Step 4: Send to CV Analyzer for complete workflow
      console.log(`🚀 Sending to CV Analyzer for complete workflow...`);
      const result = await apiService.uploadResumes(formData) as any;
      
      console.log(`✅ CV Analyzer complete workflow result:`, result);
      console.log(`✅ Upload response structure:`, {
        status: result.status,
        file_url: result.file_url,
        filename: result.filename,
        candidate_name: result.candidate_name,
        jd_id: result.jd_id,
        criteria_id: result.criteria_id,
        resume_id: result.resume_id
      });

      // Step 5: Update UI to completed status
      console.log(`🎉 Setting file ${fileIndex} to completed status`);
      setSelectedFiles(prev => prev.map((fileData, index) => 
        index === fileIndex ? { ...fileData, status: 'completed', progress: 100 } : fileData
      ));

      // Step 6: Add to newly uploaded tracking (generate temporary ID for tracking)
      const tempId = `temp_${Date.now()}_${fileIndex}`;
      setNewlyUploadedIds(prev => new Set(prev).add(tempId));

      // Step 7: Add to session storage for Pro-Valuation
      const sessionFileData = {
        candidate_name: result.candidate_name || candidateName,
        file_name: result.filename || file.name,
        file_url: result.file_url,
        jd_id: result.jd_id,
        criteria_id: result.criteria_id,
        resume_id: result.resume_id,
        uploaded_at: new Date().toISOString()
      };
      console.log('Adding to session storage:', sessionFileData);
      addToSessionUploadedFiles(sessionFileData);

      // Step 8: Update resumes list (pending analysis)
      setResumes(prev => [...prev, {
        id: tempId,
        name: candidateName,
        fileName: file.name,
        status: 'uploaded', // Changed from 'processed' to 'uploaded'
        summary: 'Pending analysis',
        initialScore: 0,
        uploadProgress: 100,
        fileUrl: result.file_url
      }]);

      console.log(`✅ Successfully completed CV Analyzer workflow for file ${fileIndex}: ${file.name}`);

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
    // Reset processing completed flag for new evaluation
    setProcessingCompleted(false);
    
    if (!user?.profile?.company_id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to process resumes.",
        variant: "destructive",
      });
      return;
    }

    // ✅ NEW: Check for mismatch before processing
    if (jdCriteriaMismatch?.isMismatched) {
      toast({
        title: "❌ Cannot Process Resumes",
        description: "There is a mismatch between the selected job description and criteria. Please configure a compatible combination before processing.",
        variant: "destructive",
        duration: 7000,
      });
      return;
    }

    // ✅ NEW: Validate JD-Criteria compatibility
    const selectedJDId = sessionStorage.getItem('selectedJDId') || '';
    const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId') || '';
    
    if (selectedJDId && selectedCriteriaGridId) {
      const isValid = await validateJdCriteriaCompatibility(selectedJDId, selectedCriteriaGridId);
      if (!isValid) {
        const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJDId);
        toast({
          title: "❌ Cannot Process Resumes",
          description: `The selected criteria doesn't match the job description "${selectedJD?.title || 'Unknown'}". Please select a compatible criteria combination.`,
          variant: "destructive",
          duration: 7000,
        });
        return;
      }
    }

    // Check CV processing limits before proceeding
    if (companyUsageInfo && !companyUsageInfo.canProcessCV) {
      setShowRechargeDialog(true);
      toast({
        title: "CV Processing Limit Reached",
        description: `You have reached your plan limit of ${companyUsageInfo.maxCVs} CVs. Please recharge to continue processing.`,
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
      console.log('Session uploaded files:', sessionUploadedFiles);
      console.log('Session uploaded files length:', sessionUploadedFiles.length);
      console.log('Session uploaded files structure:', JSON.stringify(sessionUploadedFiles, null, 2));

      // Check if we have new uploads or existing assessments
      if (sessionUploadedFiles.length === 0 && assessmentReports.length === 0) {
        toast({
          title: "No Resumes to Analyze",
          description: "No new resumes uploaded and no existing assessments found. Please upload some resumes first.",
          variant: "default",
        });
        return;
      }

      // If no new uploads but we have existing assessments, we can still proceed
      if (sessionUploadedFiles.length === 0 && assessmentReports.length > 0) {
        toast({
          title: "Re-analyzing Existing Resumes",
          description: "No new resumes uploaded, but found existing assessments. You can view the results below.",
          variant: "default",
        });
        // Don't return - allow the process to continue to show existing results
      }

      // Determine what to process
      const hasNewUploads = sessionUploadedFiles.length > 0;
      const hasExistingAssessments = assessmentReports.length > 0;
      
      if (hasNewUploads) {
        setProcessingState({
          status: 'processing',
          message: `Preparing to process ${sessionUploadedFiles.length} resume${sessionUploadedFiles.length > 1 ? 's' : ''}...`
        });
        console.log(`🚀 Processing ${sessionUploadedFiles.length} files from session storage:`, sessionUploadedFiles);
      } else if (hasExistingAssessments) {
        setProcessingState({
          status: 'processing',
          message: `Loading ${assessmentReports.length} existing assessment${assessmentReports.length > 1 ? 's' : ''}...`
        });
        console.log(`📊 Loading ${assessmentReports.length} existing assessments`);
      }

      // Use session storage data directly for CV Analyzer (empty array if no new uploads)
      const resumeUrls = sessionUploadedFiles;

              // Send to CV Analyzer with selected JD and criteria
        try {
          if (hasNewUploads) {
            setProcessingState({
              status: 'processing',
              message: 'Sending resumes to CV Analyzer...'
            });
            
            console.log('📊 Setting expected resume count:', resumeUrls.length);
            
            // Capture initial report count for current JD/criteria combination (all completed reports)
            const currentReports = assessmentReports.filter(report => 
              report.final_match !== null && 
              report.final_match !== undefined
            );
            console.log('📊 Initial report count:', currentReports.length);
            
            setExpectedResumeCount(resumeUrls.length);
            setInitialReportCount(currentReports.length);
            setLastProgressCount(0); // Reset progress tracking
            
            await sendResumesToBackend(resumeUrls, selectedJDId, selectedCriteriaGridId, 'provaluate');
          } else {
            // No new uploads, just refresh existing assessments
            setProcessingState({
              status: 'processing',
              message: 'Refreshing existing assessments...'
            });
            
            // Simulate a delay for consistency
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        
                  setProcessingState({
            status: 'success',
            message: hasNewUploads 
              ? `Successfully started CV Analyzer processing for ${resumeUrls.length} resume${resumeUrls.length > 1 ? 's' : ''}`
              : `Successfully loaded ${assessmentReports.length} existing assessment${assessmentReports.length > 1 ? 's' : ''}`
          });

          toast({
            title: hasNewUploads ? "CV Analyzer Processing Started" : "Existing Assessments Loaded",
            description: hasNewUploads 
              ? `Successfully sent ${resumeUrls.length} new resume${resumeUrls.length > 1 ? 's' : ''} to CV Analyzer. Fetching results...`
              : `Successfully loaded ${assessmentReports.length} existing assessment${assessmentReports.length > 1 ? 's' : ''}. You can view the results below.`,
          });

          // Auto-fetch results after a short delay for new uploads
          if (hasNewUploads) {
            setTimeout(async () => {
              console.log('🔄 Auto-fetching assessment reports after processing...');
              await fetchAssessmentReports();
              toast({
                title: "Results Updated",
                description: "Assessment results are now displayed below.",
              });
            }, 5000); // Wait 5 seconds before first auto-fetch
            
            // Then start the regular auto-refresh cycle with 30s delay
            setTimeout(() => {
              if (isWaitingForAssessments) {
                startAutoRefreshAssessments();
              }
            }, 30000);
          }

        // Mark processing as completed
        setProcessingCompleted(true);
        
        // Increment CV processing count for the company
        if (hasNewUploads && user?.profile?.company_id) {
          try {
            await UsageTrackingService.incrementCVCount(user.profile.company_id, {
              resume_count: resumeUrls.length,
              job_description_id: selectedJDId,
              criteria_id: selectedCriteriaGridId,
              processing_date: new Date().toISOString()
            });
            
            // Refresh usage info after incrementing
            await checkCompanyUsageLimits();
          } catch (error) {
            console.error('Error incrementing CV count:', error);
            // Don't fail the entire process if counting fails
          }
        }
        
        // Delay clearing session storage to allow user to see results and potentially re-analyze
        setTimeout(() => {
          // Only clear if we're not in an error state and processing is complete
          if (processingState.status !== 'error' && processingCompleted) {
            clearSessionUploadedFiles();
            setNewlyUploadedIds(new Set());
            setSelectedFiles([]);
            console.log('Cleared session storage after successful processing');
          }
        }, 15000); // Wait 15 seconds before clearing session storage

      } catch (cvAnalyzerError: any) {
        console.error('Error calling CV Analyzer service:', cvAnalyzerError);
        setProcessingState({
          status: 'error',
          message: 'Failed to start CV Analyzer process',
          error: cvAnalyzerError.message || 'Network error occurred while contacting the CV Analyzer service'
        });
        
        // Even if CV Analyzer fails, start auto-refresh in case it processes it later
        startAutoRefreshAssessments();
        
        throw cvAnalyzerError;
      }

    } catch (error: any) {
      console.error('Error during CV Analyzer processing:', error);
      setProcessingState({
        status: 'error',
        message: 'CV Analyzer process failed',
        error: error.message || 'An unexpected error occurred'
      });
      toast({
        title: "CV Analyzer Processing Failed",
        description: error.message || "Failed to start CV Analyzer process.",
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
    // ✅ NEW: Block file upload if JD-Criteria mismatch exists
    if (jdCriteriaMismatch?.isMismatched) {
      toast({
        title: "⚠️ Cannot Upload Files",
        description: "There is a mismatch between the selected job description and criteria. Please configure a compatible combination before uploading files.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Block file upload if trial expired or CVs exhausted
    if (companyUsageInfo && !companyUsageInfo.canProcessCV) {
      toast({
        title: "Cannot Upload Files",
        description: companyUsageInfo.warningMessage || "Your trial has expired or CV quota is exhausted. Please upgrade to continue.",
        variant: "destructive",
      });
      return;
    }
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

  // Start uploading pending files in parallel
  const startPendingUploads = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Starting parallel upload for pending files...');
    
    const pendingFiles = selectedFiles
      .map((fileData, index) => ({ fileData, index }))
      .filter(({ fileData }) => fileData.status === 'pending');
    
    if (pendingFiles.length === 0) {
      console.log('No pending files to upload');
      return;
    }
    
    console.log(`Found ${pendingFiles.length} pending files to upload in parallel`);
    
    try {
      // Set all files to uploading status
      setSelectedFiles(prev => prev.map(fileData => 
        fileData.status === 'pending' ? { ...fileData, status: 'uploading' } : fileData
      ));
      
      // Upload all files in parallel using Promise.all
      const uploadPromises = pendingFiles.map(({ fileData, index }) => {
        console.log(`Starting parallel upload for file at index ${index}: ${fileData.file.name}`);
        return uploadSingleFile(fileData.file, index);
      });
      
      // Wait for all uploads to complete
      await Promise.all(uploadPromises);
      
      setCurrentlyProcessing(-1);
      console.log('✅ All files processed in parallel');
      
      toast({
        title: "Upload Complete", 
        description: `Successfully uploaded ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}`,
      });
      
    } catch (error: any) {
      console.error('Error uploading files in parallel:', error);
      setCurrentlyProcessing(-1);
      toast({
        title: "Upload Error",
        description: error.message || "Error uploading files. Please try again.",
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
  const handleJobDescriptionSelect = async (jdId: string) => {
    setSelectedJobDescriptionId(jdId);
    sessionStorage.setItem('selectedJDId', jdId);
    // Stop any existing auto-refresh when switching job descriptions
    stopAutoRefreshAssessments();
    // Clear evaluation start time for new evaluation
    setExpectedResumeCount(0);
    setLastProgressCount(0);
    setInitialReportCount(0);
    
    const selectedJD = jobDescriptions.find(jd => jd.jd_id === jdId);
    setCurrentJobDescription(selectedJD || null);
    
    // ✅ NEW: Validate current criteria with new JD
    if (selectedCriteriaGridId) {
      const isValid = await validateJdCriteriaCompatibility(jdId, selectedCriteriaGridId);
      
      if (!isValid) {
        const currentCriteria = criteriaGrids.find(grid => grid.id === selectedCriteriaGridId);
        
        // Set persistent mismatch warning
        setJdCriteriaMismatch({
          isMismatched: true,
          jdTitle: selectedJD?.title || 'Selected Job',
          criteriaName: currentCriteria?.name || 'Selected Criteria',
          reason: `The selected criteria "${currentCriteria?.name || 'Unknown'}" was created for a different job description and is not suitable for "${selectedJD?.title || 'this job'}". Please select a compatible criteria.`
        });
        
        // Clear the incompatible criteria selection
        setSelectedCriteriaGridId('');
        sessionStorage.removeItem('selectedCriteriaGridId');
        setCurrentEvaluationCriteria(null);
        
        toast({
          title: "⚠️ Criteria Mismatch Detected",
          description: `The criteria doesn't match the selected job. Please select appropriate criteria from the dropdown.`,
          variant: "destructive",
          duration: 5000,
        });
      } else {
        // Valid combination - clear mismatch warning
        setJdCriteriaMismatch(null);
      }
    } else {
      // No criteria selected - clear any previous mismatch
      setJdCriteriaMismatch(null);
    }
    
    // Reload criteria grids filtered by selected JD
    await loadCriteriaGrids();
    
    toast({
      title: "Job Description Selected",
      description: `Selected: ${selectedJD?.title || 'Unknown Job'}. Showing relevant criteria.`,
    });
  };

  // Handle criteria grid selection
  const handleCriteriaGridSelect = async (gridId: string) => {
    // ✅ NEW: Validate criteria matches selected JD
    if (selectedJobDescriptionId) {
      const isValid = await validateJdCriteriaCompatibility(selectedJobDescriptionId, gridId);
      
      if (!isValid) {
        const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
        const selectedCriteria = criteriaGrids.find(grid => grid.id === gridId);
        
        // Set persistent mismatch warning
        setJdCriteriaMismatch({
          isMismatched: true,
          jdTitle: selectedJD?.title || 'Selected Job',
          criteriaName: selectedCriteria?.name || 'Selected Criteria',
          reason: `The criteria "${selectedCriteria?.name || 'Unknown'}" doesn't match the selected job description "${selectedJD?.title || 'Unknown'}". Please select a compatible criteria.`
        });
        
        toast({
          title: "⚠️ Criteria Mismatch",
          description: `This criteria doesn't match the selected job description. The warning will remain until you select a compatible combination.`,
          variant: "destructive",
          duration: 5000,
        });
        return; // Don't select this criteria
      }
    }
    
    // ✅ Valid combination - clear mismatch warning
    setJdCriteriaMismatch(null);
    
    setSelectedCriteriaGridId(gridId);
    sessionStorage.setItem('selectedCriteriaGridId', gridId);
    // Stop any existing auto-refresh when switching criteria grids
    stopAutoRefreshAssessments();
    // Clear evaluation start time for new evaluation
    setExpectedResumeCount(0);
    setLastProgressCount(0);
    setInitialReportCount(0);
    
    const selectedGrid = criteriaGrids.find(grid => grid.id === gridId);
    setCurrentEvaluationCriteria(selectedGrid || null);
    toast({
      title: "Criteria Grid Selected",
      description: `Selected: ${selectedGrid?.name || 'Unknown Grid'}`,
    });
  };

  // Shared function to send resumes to CV Analyzer backend
  const sendResumesToBackend = async (resumeUrls: any[], selectedJDId: string, selectedCriteriaGridId: string, actionType: string) => {
    if (!user?.profile?.company_id) {
      throw new Error('User company ID not found');
    }

    try {
      // Prepare data for CV Analyzer backend
      // Handle different data structures - session storage vs resume objects
      const resume_urls = resumeUrls.map(resume => {
        // If it's from session storage, it might have different structure
        if (resume.file_url) {
          return resume.file_url; // Session storage format
        } else if (resume.cv_file_url) {
          return resume.cv_file_url;
        } else if (resume.fileUrl) {
          return resume.fileUrl;
        } else if (resume.resume_url) {
          return resume.resume_url;
        } else if (typeof resume === 'string') {
          return resume; // Direct URL string
        } else {
          console.error('Unknown resume data structure:', resume);
          throw new Error('Invalid resume data structure');
        }
      });

      const analysisData = {
        resume_urls: resume_urls,
        jd_id: selectedJDId,
        criteria_id: selectedCriteriaGridId,
        company_id: user?.profile?.company_id,  // Add company_id to request
        user_id: user?.id,  // Add user_id to request for created_by field
        action_type: actionType
      };

      console.log('Sending analysis data to CV Analyzer:', analysisData);

      setProcessingState({
        status: 'processing',
        message: `Processing ${resumeUrls.length} resumes with CV Analyzer...`
      });

      // Send to CV Analyzer Python backend for analysis
      const result = await apiService.analyzeResumes(analysisData) as any;
      
      console.log('CV Analyzer batch processing completed:', result);
      
      setProcessingState({
        status: 'success',
        message: `Successfully processed ${resumeUrls.length} resumes with CV Analyzer`
      });

      return result;
    } catch (error: any) {
      console.error('Error in CV Analyzer batch processing:', error);
      setProcessingState({
        status: 'error',
        message: 'Failed to process resumes with CV Analyzer',
        error: error.message
      });
      throw new Error(error.message || 'Failed to process resumes with CV Analyzer. Please try again or contact support if the issue persists.');
    }
  };

  // Send only newly uploaded resumes (from current session) to CV Analyzer
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
        setIsEvaluating(false);
        return;
      }

      if (!selectedCriteriaGridId) {
        toast({
          title: "No Criteria Grid Selected",
          description: "Please select an evaluation criteria grid from the dropdown above first.",
          variant: "destructive",
        });
        setIsEvaluating(false);
        return;
      }

      // ✅ NEW: Check for mismatch before processing
      if (jdCriteriaMismatch?.isMismatched) {
        toast({
          title: "❌ Cannot Process Resumes",
          description: "There is a mismatch between the selected job description and criteria. Please configure a compatible combination before processing.",
          variant: "destructive",
          duration: 7000,
        });
        setIsEvaluating(false);
        return;
      }

      // ✅ NEW: Double-check validation before processing
      const isValid = await validateJdCriteriaCompatibility(selectedJDId, selectedCriteriaGridId);
      if (!isValid) {
        const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJDId);
        toast({
          title: "❌ Cannot Process Resumes",
          description: `The selected criteria doesn't match the job description "${selectedJD?.title || 'Unknown'}". Please select a compatible criteria combination.`,
          variant: "destructive",
          duration: 7000,
        });
        setIsEvaluating(false);
        return;
      }

      // Format resume data for CV Analyzer
      const resumeUrls = newResumes.map(resume => ({
        resume_id: resume.id,
        candidate_name: resume.name,
        cv_file_url: resume.fileUrl,
        created_at: new Date().toISOString()
      }));

      console.log('📊 Setting expected resume count:', resumeUrls.length);
      
      // Capture initial report count for current JD/criteria combination (all completed reports)
      const currentReports = assessmentReports.filter(report => 
        report.final_match !== null && 
        report.final_match !== undefined
      );
      console.log('📊 Initial report count:', currentReports.length);
      
      setExpectedResumeCount(resumeUrls.length);
      setInitialReportCount(currentReports.length);
      setLastProgressCount(0); // Reset progress tracking
      
      await sendResumesToBackend(resumeUrls, selectedJDId, selectedCriteriaGridId, 'new_resumes');

      // Start auto-refresh to check for assessment reports (with 30s delay)
      setTimeout(() => {
        if (isWaitingForAssessments) {
          startAutoRefreshAssessments();
        }
      }, 30000); // Wait 30 seconds before starting auto-refresh

      toast({
        title: "Processing Started",
        description: `Successfully sent ${resumeUrls.length} new resumes to CV Analyzer for processing.`,
      });

    } catch (error: any) {
      console.error('Error processing new resumes:', error);
      
      // Even if processing fails, start auto-refresh in case CV Analyzer processes it later
      startAutoRefreshAssessments();
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to send new resumes to CV Analyzer.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Send all uploaded resume URLs to CV Analyzer for processing
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

      // Prepare the data for CV Analyzer
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

      console.log('📊 Setting expected resume count:', resumeUrls.length);
      
      // Capture initial report count for current JD/criteria combination (all completed reports)
      const currentReports = assessmentReports.filter(report => 
        report.final_match !== null && 
        report.final_match !== undefined
      );
      console.log('📊 Initial report count:', currentReports.length);
      
      setExpectedResumeCount(resumeUrls.length);
      setInitialReportCount(currentReports.length);
      setLastProgressCount(0); // Reset progress tracking
      
              await sendResumesToBackend(resumeUrls, selectedJDId, selectedCriteriaGridId, 'all_resumes');

      // Start auto-refresh to check for assessment reports (with 30s delay)
      setTimeout(() => {
        if (isWaitingForAssessments) {
          startAutoRefreshAssessments();
        }
      }, 30000); // Wait 30 seconds before starting auto-refresh

      toast({
        title: "Processing Started",
        description: `Successfully sent ${resumeUrls.length} resumes with job description (${selectedJDId}) and criteria grid (${selectedCriteriaGridId}) to CV Analyzer for processing.`,
      });

    } catch (error: any) {
      console.error('Error processing all resumes:', error);
      
      // Even if processing fails, start auto-refresh in case N8N processes it later
      startAutoRefreshAssessments();
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to send resumes to CV Analyzer.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const hasProcessedResumes = resumes.some(resume => resume.status === 'processed');
  const hasResumesInDatabase = resumes.length > 0; // Check if there are any resumes loaded from database
  const sessionFiles = getSessionUploadedFiles();
  const hasCompletedSelectedFiles = selectedFiles.some(f => f.status === 'completed');
  const hasNewlyUploadedResumes = hasCompletedSelectedFiles || sessionFiles.length > 0; // Check for successfully uploaded resumes
  console.log('Debug - selectedFiles:', selectedFiles.map(f => ({ name: f.file.name, status: f.status })));
  console.log('Debug - sessionFiles:', sessionFiles);
  console.log('Debug - hasCompletedSelectedFiles:', hasCompletedSelectedFiles);
  console.log('Debug - hasNewlyUploadedResumes:', hasNewlyUploadedResumes);
  const hasExistingAssessments = assessmentReports.length > 0; // Check if there are existing assessment reports
  const hasResumesToAnalyze = hasNewlyUploadedResumes || hasExistingAssessments; // Enable button if there are new uploads OR existing assessments

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

  const handleViewPdf = (fileUrl: string, candidateName: string) => {
    // Enhanced file viewer that handles PDF, DOC, DOCX, and TXT files
    try {
      // Determine file type from URL
      const fileExtension = fileUrl.split('.').pop()?.toLowerCase() || '';
      const isPdf = fileExtension === 'pdf';
      const isWord = fileExtension === 'doc' || fileExtension === 'docx';
      const isText = fileExtension === 'txt';
      
      // For PDF files, use blob approach for inline viewing
      if (isPdf) {
        fetch(fileUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/pdf,application/octet-stream,*/*'
          }
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.blob();
          })
          .then(blob => {
            // Create blob URL with proper PDF type
            const url = window.URL.createObjectURL(
              new Blob([blob], { type: 'application/pdf' })
            );
            
            // Open in new tab
            const newWindow = window.open(url, '_blank');
            
            // Clean up blob URL after window loads or after timeout
            if (newWindow) {
              newWindow.onload = () => {
                setTimeout(() => window.URL.revokeObjectURL(url), 5000);
              };
            } else {
              setTimeout(() => window.URL.revokeObjectURL(url), 5000);
            }
          })
          .catch(error => {
            console.error('Error loading PDF:', error);
            // Fallback: try direct URL
            window.open(fileUrl, '_blank');
          });
      } 
      // For Word files and text files, open directly (browser will download or use default app)
      else if (isWord || isText) {
        // Direct open - browser will handle it (download or open with default app)
        window.open(fileUrl, '_blank');
      }
      // For other file types, try direct open
      else {
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error('Error in file viewer:', error);
      // Final fallback: try direct URL
      window.open(fileUrl, '_blank');
    }
  };

  // Helper: format possibly-JSON summary/recommendation into readable text for list preview
  const formatPreviewText = (value: any): string => {
    if (!value) return '';
    if (typeof value !== 'string') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    const text = value.trim();
    // If JSON, parse and pick a concise preview
    try {
      if (/^(\s*\{|\s*\[)/.test(text)) {
        const parsed: any = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 3).map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
        }
        if (parsed && typeof parsed === 'object') {
          const preferredOrder = [
            'Summary',
            'Key Strengths',
            'Notable Gaps',
            'Experience Relevance',
            'Overall Fit Assessment',
            'Recommendation'
          ];
          for (const key of preferredOrder) {
            if (key in parsed) {
              const v = parsed[key];
              if (Array.isArray(v)) return v.slice(0, 2).join(' ');
              if (typeof v === 'string') return v;
              return JSON.stringify(v);
            }
          }
          // fallback to first string-like field
          const firstEntry = Object.entries(parsed).find(([, v]) => typeof v === 'string');
          if (firstEntry) return firstEntry[1] as string;
          return JSON.stringify(parsed);
        }
      }
    } catch {}
    return text;
  };

  return (
    <div className="min-h-screen">
      {/* Mobile Navigation Progress Bar */}
      <div className="lg:hidden">
        <CompactStepProgress
          current={currentStep}
          total={WORKFLOW_STEPS.length}
          steps={WORKFLOW_STEPS}
          onStepClick={navigateToStep}
        />
      </div>
      
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Trial Expiration Warning */}
      <TrialExpirationWarning />

      {/* JD-Criteria Mismatch Warning */}
      {jdCriteriaMismatch?.isMismatched && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg shadow-sm animate-fade-in">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700">
                Please select appropriate combination of job description and criteria so as to proceed for CV processing. Please check what criterias are available for your selected JD.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Row: Job Description Selection, Criteria Selection, and Provaluate Button */}
      <Card className="animate-fade-in mb-6" data-tour="resume-upload-area">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-primary-800 mb-2">Resume Uploads</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Upload multiple candidate resumes for evaluation</p>
            </div>
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
              
              {selectedCriteriaGridId && !jdCriteriaMismatch?.isMismatched && (
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
            onDragOver={(e) => {
              e.preventDefault();
            }}
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
                    disabled={(companyUsageInfo && !companyUsageInfo.canProcessCV) || jdCriteriaMismatch?.isMismatched}
                    className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  Drop multiple files here or click to browse (PDF, DOCX, TXT). Select files first, then click "Start Upload".
                </p>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from bubbling to dropzone
                    handleFileSelect();
                  }}
                  disabled={(companyUsageInfo && !companyUsageInfo.canProcessCV) || jdCriteriaMismatch?.isMismatched}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isEvaluating || !selectedJobDescriptionId || !selectedCriteriaGridId || !hasResumesToAnalyze || (companyUsageInfo && !companyUsageInfo.canProcessCV) || jdCriteriaMismatch?.isMismatched}
                  className={`relative w-full ${
                    processingState.status === 'processing' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : processingState.status === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : processingState.status === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : (companyUsageInfo && !companyUsageInfo.canProcessCV)
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-accent-600 hover:bg-accent-700'
                  } text-white disabled:opacity-50`}
                >
                  {processingState.status === 'processing' ? (
                    <div className="flex items-center justify-center gap-2">
                      {/* <Loader2 className="w-4 h-4 animate-spin" /> */}
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
                  ) : (companyUsageInfo && !companyUsageInfo.canProcessCV) ? (
                    <div className="flex items-center justify-center gap-2">
                      <span>Limit Reached - Recharge Required</span>
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
                
                {/* Show usage info */}
                {companyUsageInfo && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-800">Plan: {companyUsageInfo.planName}</span>
                        <span className="text-blue-600">
                          {companyUsageInfo.maxCVs === 0 ? 'Unlimited' : `${companyUsageInfo.currentCVCount}/${companyUsageInfo.maxCVs}`} CVs
                        </span>
                      </div>
                      {companyUsageInfo.maxCVs > 0 && (
                        <div className="text-xs text-blue-600">
                          {companyUsageInfo.remainingCVs > 0 ? `${companyUsageInfo.remainingCVs} remaining` : 'Limit reached'}
                        </div>
                      )}
                    </div>
                    {companyUsageInfo.maxCVs > 0 && (
                      <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, (companyUsageInfo.currentCVCount / companyUsageInfo.maxCVs) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show helper text below button */}
                {/* Status messages removed - nothing shown below the Pro-Valuate button */}
              </div>
            </div>
                </CardContent>
      </Card>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Resume List (now Assessment Reports) */}
      <div className="grid gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-primary-800">
            Candidate Pool ({assessmentReports.length})
          </h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
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
                  if (expectedResumeCount > 0) {
                    try {
                      // Count current session reports (all completed reports with final_match score)
                      const currentSessionReports = assessmentReports.filter(report => 
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
            const normalizedOverallScore = normalizeNumericScore(report.final_match !== null && report.final_match !== undefined ? report.final_match : 0);
            const detailedScores = parseReportScores(report.scores);
            const isProcessingReport = normalizedOverallScore === null && detailedScores.length === 0;

            return (
            <Card 
              key={report.id}
              className="animate-fade-in hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleCandidateClick(report.id)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="bg-primary-100 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm sm:text-base text-primary-800 truncate">{report.candidate_name || 'Unknown'}</h4>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {report.resume_url ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewPdf(report.resume_url, report.candidate_name || 'Unknown');
                            }}
                            className="text-blue-600 hover:text-blue-800 underline hover:underline bg-transparent border-none cursor-pointer p-0"
                          >
                            View Candidate
                          </button>
                        ) : (
                          'No file'
                        )}
                      </p>
                      <p className="text-sm text-gray-700">{formatPreviewText(report.summary || report.recommendation || '')}</p>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto gap-2">
                    <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getRecommendationStyle(recommendationStatus)}`}>
                      {recommendationStatus}
                    </div>
                    {isProcessingReport ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-600">
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="text-base sm:text-lg font-bold text-gray-900">
                        {`${Math.round((normalizedOverallScore ?? 0) * 10)}%`}
                      </div>
                    )}
                  </div>
                </div>
                {/* Optionally, show detailed scores if available */}
                {!isProcessingReport && detailedScores.length > 0 && (
                  <div className="mt-4">
                    {detailedScores
                      .filter((score: any) => score.parameter !== 'Overall Assessment')
                      .map((score: any, idx: number) => {
                      const parameterScore = normalizeNumericScore(score?.score);
                      const percentage = parameterScore !== null ? Math.round(parameterScore * 10) : null;

                      return (
                        <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-2">
                          <div className="w-full sm:w-40 font-medium text-xs sm:text-sm">{score.parameter || 'Parameter'}</div>
                          <div className="flex-1">
                            <div className="relative w-full h-2 sm:h-3 bg-gray-200 rounded-full">
                              <div
                                className="absolute top-0 left-0 h-2 sm:h-3 rounded-full bg-blue-600"
                                style={{ width: `${percentage !== null ? Math.max(0, Math.min(100, percentage)) : 0}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-0 sm:w-12">
                            <div className="text-left sm:text-right font-semibold text-xs sm:text-sm">
                              {percentage !== null ? percentage : '—'}
                            </div>
                            <div className="text-right text-xs text-muted-foreground sm:w-20">
                              W: {score.weightage ?? 0}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isProcessingReport && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
                    {/* <Loader2 className="w-4 h-4 animate-spin" /> */}
                    {/* <span>We're evaluating this resume. Scores will appear soon.</span> */}
                  </div>
                )}
            </CardContent>
          </Card>
          );
        })
      )}
      </div>

      {/* Global processing overlay for long-running evaluation */}
      <LoadingOverlay
        isOpen={isProcessingOverlayVisible}
        contextKey="cv-screening"
        messagesCategory="cv-screening"
        title="Analyzing resumes against your job criteria…"
        subtitle="We’re parsing profiles, aligning them to your JD, and computing match scores."
      />

      {/* Scorecard Dialog */}
      <Dialog open={showScorecard} onOpenChange={setShowScorecard}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] sm:h-[80vh] overflow-y-auto p-3 sm:p-6" aria-describedby="dialog-description">
          <DialogTitle className="sr-only">Candidate Assessment Details</DialogTitle>
          <div id="dialog-description" className="sr-only">Detailed assessment report for the selected candidate</div>
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



      {/* Recharge Dialog */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CV Processing Limit Reached</DialogTitle>
            <DialogDescription>
              You have reached your plan limit of {companyUsageInfo?.maxCVs} CVs processed this month. 
              Please recharge your account to continue processing resumes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-orange-800">Current Usage</span>
              </div>
              <div className="text-sm text-orange-700">
                <p>Plan: {companyUsageInfo?.planName}</p>
                <p>Processed: {companyUsageInfo?.currentCVCount} / {companyUsageInfo?.maxCVs} CVs</p>
                <p>Reset Date: {companyUsageInfo?.resetDate ? new Date(companyUsageInfo.resetDate).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  // Navigate to admin user management for recharge
                  window.location.href = '/dashboard?section=admin-user-management';
                }}
                className="flex-1 bg-[#1A56DB] hover:bg-[#1A56DB]/90"
              >
                Go to Recharge
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowRechargeDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        multiple
        onChange={handleFileChange}
        disabled={companyUsageInfo && !companyUsageInfo.canProcessCV}
        className="hidden"
      />
      </div>
    </div>
  );
};