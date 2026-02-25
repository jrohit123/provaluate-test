import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { buildApiUrl, API_CONFIG } from '@/constants/api';
import {
  UserPlus,
  Copy,
  Send,
  FileText,
  Plus,
  Trash2,
  Save,
  Target,
  Loader2,
  Link,
  ChevronDown,
  ChevronUp,
  Upload,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import { useInterviewCurrentStep, useInterviewNavigateToStep, INTERVIEW_WORKFLOW_STEPS } from '@/hooks/useWorkflowNavigation';

/** When provided, JDs are loaded from this list (e.g. candidate's jd_candidates) instead of company tables. Recruiter flow unchanged when omitted. */
export type InjectedJD = { jd_id: string; title: string | null; extracted_text?: string | null; jd_file?: string | null; created_at?: string };

interface HRInterviewCreatorProps {
  onSectionReady?: () => void;
  /** Optional: use these JDs instead of loading from jd_for_interview + job_descriptions (e.g. for candidate dashboard from jd_candidates). */
  injectedJobDescriptions?: InjectedJD[];
  /** Optional: called when JDs should be refreshed. Used when injectedJobDescriptions is provided. */
  injectedLoadJobDescriptions?: () => Promise<void>;
  /** Optional: when set, creates interview in candidate flow (sends candidate_id, null user_id/company_id). */
  candidateId?: string;
}

interface Candidate {
  name: string;
  email: string;
}

interface FormData {
  candidates: Candidate[];
  position: string;
  duration: number;
  totalQuestions: number;
  customInstructions: string;
  interviewType: string;
  interviewMode: 'ai' | 'structured';
  personalizedQuestionsEnabled: boolean;
  personalizedQuestions: Array<{question: string, timeLimit: number}>;
}

interface CustomParameter {
  name: string;
  description: string;
  weight: number;
  min_questions: number;
  max_questions: number;
  max_time: number;
  level: 'Easy' | 'Regular' | 'Expert';
  scoring_criteria: string[];
}

interface CreatedInterview {
  interview_id: string;
  candidate_name: string;
  candidate_email: string;
}

interface CustomParameters {
  [key: string]: CustomParameter;
}

const HRInterviewCreator = ({ onSectionReady, injectedJobDescriptions, injectedLoadJobDescriptions, candidateId }: HRInterviewCreatorProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const interviewCurrentStep = useInterviewCurrentStep();
  const interviewNavigateToStep = useInterviewNavigateToStep();
  const pathname = location.pathname;
  const isCandidateFlow = !!candidateId;
  const candidateWorkflowPaths = ['/candidate-dashboard/jds/configure', '/candidate-dashboard/jds/create', '/candidate-dashboard/interviews'] as const;
  const candidateCurrentStep = pathname.includes('/jds/create') ? 1 : pathname.includes('/interviews') ? 2 : 0;
  const candidateNavigateToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < candidateWorkflowPaths.length) {
      navigate(candidateWorkflowPaths[stepIndex]);
    }
  };
  const currentStep = isCandidateFlow ? candidateCurrentStep : interviewCurrentStep;
  const navigateToStep = isCandidateFlow ? candidateNavigateToStep : interviewNavigateToStep;

  const [formData, setFormData] = useState<FormData>({
    candidates: [{ name: '', email: '' }],
    position: '',
    duration: 30,
    totalQuestions: 1,
    customInstructions: '',
    interviewType: 'mixed',
    interviewMode: 'ai',
    personalizedQuestionsEnabled: false,
    personalizedQuestions: []
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createdInterviews, setCreatedInterviews] = useState<CreatedInterview[]>([]);
  const [customParameters, setCustomParameters] = useState<CustomParameters>({});
  const [isLoadingParameters, setIsLoadingParameters] = useState(true);
  const [isSavingParameters, setIsSavingParameters] = useState(false);
  const [parametersSaved, setParametersSaved] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [expandedParameters, setExpandedParameters] = useState(new Set());
  const [structuredQuestions, setStructuredQuestions] = useState<any[]>([]);
  const [sendingEmails, setSendingEmails] = useState(new Set());
  /** When candidateId is set: logged-in candidate from candidates table (name, email) for creating interview for self. */
  const [loggedInCandidate, setLoggedInCandidate] = useState<{ name: string; email: string } | null>(null);
  const [loggedInCandidateLoading, setLoggedInCandidateLoading] = useState(false);

  // Effective JD list: use injected (candidate jd_candidates) or internal (recruiter company JDs)
  const effectiveJobDescriptions = injectedJobDescriptions ?? jobDescriptions;

  // Fetch logged-in candidate profile when in candidate flow (for name/email in create)
  useEffect(() => {
    if (!candidateId) {
      setLoggedInCandidate(null);
      return;
    }
    let cancelled = false;
    setLoggedInCandidateLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('candidates')
          .select('first_name, last_name, email')
          .eq('candidate_id', candidateId)
          .single();
        if (cancelled) return;
        if (error || !data) {
          setLoggedInCandidate(null);
          return;
        }
        const first = (data.first_name ?? '').trim();
        const last = (data.last_name ?? '').trim();
        const name = [first, last].filter(Boolean).join(' ') || 'Candidate';
        const email = (data.email ?? '').trim();
        setLoggedInCandidate({ name, email });
      } finally {
        if (!cancelled) setLoggedInCandidateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [candidateId]);

  // Check for selected candidates from View All Results (recruiter flow only)
  useEffect(() => {
    if (candidateId) return;
    const selectedCandidates = sessionStorage.getItem('selectedCandidatesForInterview');
    if (selectedCandidates) {
      try {
        const candidateData = JSON.parse(selectedCandidates);
        if (Array.isArray(candidateData) && candidateData.length > 0) {
          // Handle new format: array of objects with name and email
          const candidates = candidateData.map(candidate => ({
            name: candidate.name ? candidate.name.trim() : '',
            email: candidate.email ? candidate.email.trim() : ''
          }));
          setFormData(prev => ({ ...prev, candidates }));
          // Clear the sessionStorage after using it
          sessionStorage.removeItem('selectedCandidatesForInterview');
        }
      } catch (error) {
        console.error('Error parsing selected candidates:', error);
        // Fallback to old single candidate format
        const selectedCandidate = sessionStorage.getItem('selectedCandidateForInterview');
        if (selectedCandidate) {
          setFormData(prev => ({ 
            ...prev, 
            candidates: [{ name: selectedCandidate, email: '' }] 
          }));
          sessionStorage.removeItem('selectedCandidateForInterview');
        }
      }
    }
  }, []);



  // Load job descriptions from both CV screening and AI interview tables
  const loadJobDescriptions = async () => {
    if (!user?.profile?.company_id) return;
    
    let allJobDescriptions = [];
    
    try {
      // Load from jd_for_interview table (AI interview) - FIRST
      const { data: interviewData, error: interviewError } = await supabase
        .from('jd_for_interview')
        .select('id, title, jd_file, created_at, extracted_text')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
      
      if (interviewError) {
        console.error('Error loading AI interview JDs:', interviewError);
      } else {
        console.log('AI interview JDs loaded:', interviewData?.length || 0, interviewData);
        // Map id to jd_id for consistency
        const mappedInterviewData = (interviewData || []).map(item => ({
          ...item,
          jd_id: item.id
        }));
        allJobDescriptions = [...allJobDescriptions, ...mappedInterviewData];
      }
    } catch (error) {
      console.error('Error loading AI interview JDs:', error);
    }
    
    try {
      // Load from job_descriptions table (CV screening) - SECOND
      const { data: cvData, error: cvError } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, jd_file, created_at, status')
        .eq('company_id', user.profile.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (cvError) {
        console.error('Error loading CV screening JDs:', cvError);
      } else {
        console.log('CV screening JDs loaded:', cvData?.length || 0, cvData);
        allJobDescriptions = [...allJobDescriptions, ...(cvData || [])];
      }
    } catch (error) {
      console.error('Error loading CV screening JDs:', error);
    }
    
    setJobDescriptions(allJobDescriptions);
    console.log('Loaded job descriptions:', allJobDescriptions);
  };

  // Handle job description selection
  const handleJobDescriptionSelect = async (jdId: string) => {
    const selectedJD = effectiveJobDescriptions.find((jd: { jd_id: string }) => jd.jd_id === jdId);
    if (selectedJD) {
      // Set the role name from the selected JD title
      setFormData(prev => ({ ...prev, position: selectedJD.title }));
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'duration') {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue >= 5 && numValue <= 120) {
        setFormData(prev => ({ ...prev, duration: numValue }));
        calculateQuestionsFromDuration(numValue);
      }
    } else if (name === 'totalQuestions') {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 30) {
        setFormData(prev => ({ ...prev, totalQuestions: numValue }));
        calculateDurationFromQuestions(numValue);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle candidate name/email changes
  const handleCandidateChange = (index: number, field: 'name' | 'email', value: string) => {
    setFormData(prev => ({
      ...prev,
      candidates: prev.candidates.map((candidate, i) => 
        i === index ? { ...candidate, [field]: value } : candidate
      )
    }));
  };

  // Add new candidate
  const addCandidate = () => {
    setFormData(prev => ({
      ...prev,
      candidates: [...prev.candidates, { name: '', email: '' }]
    }));
  };

  // Remove candidate
  const removeCandidate = (index: number) => {
    if (formData.candidates.length > 1) {
      setFormData(prev => ({
        ...prev,
        candidates: prev.candidates.filter((_, i) => i !== index)
      }));
    }
  };

  // Import candidates from Excel/CSV
  const handleImportCandidates = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      
      // Dynamic import of XLSX library
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(data, { type: 'array' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in workbook');
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      console.log('Import data parsed:', jsonData);
      
      if (jsonData.length < 2) {
        toast({
          title: "Invalid File",
          description: "File must contain at least a header row and one data row",
          variant: "destructive"
        });
        return;
      }

      const headers = jsonData[0] as string[];
      console.log('Headers found:', headers);
      
      const nameColIndex = headers.findIndex(h => 
        h?.toString().toLowerCase().includes('name') || 
        h?.toString().toLowerCase().includes('candidate')
      );
      const emailColIndex = headers.findIndex(h => 
        h?.toString().toLowerCase().includes('email') || 
        h?.toString().toLowerCase().includes('mail')
      );

      console.log('Column indices - Name:', nameColIndex, 'Email:', emailColIndex);

      if (nameColIndex === -1) {
        toast({
          title: "Missing Name Column",
          description: "File must contain a 'Candidate Name' or 'Name' column. Found columns: " + headers.join(', '),
          variant: "destructive"
        });
        return;
      }

      const importedCandidates: Candidate[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        const name = row[nameColIndex]?.toString().trim();
        const email = emailColIndex !== -1 ? row[emailColIndex]?.toString().trim() || '' : '';
        
        if (name && name !== 'Unknown Candidate') {
          importedCandidates.push({ name, email });
        }
      }

      console.log('Imported candidates:', importedCandidates);

      if (importedCandidates.length === 0) {
        toast({
          title: "No Valid Data",
          description: "No valid candidate data found in file",
          variant: "destructive"
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        candidates: importedCandidates
      }));

      toast({
        title: "Import Successful",
        description: `Imported ${importedCandidates.length} candidates successfully`,
      });

    } catch (error) {
      console.error('Error importing file:', error);
      toast({
        title: "Import Failed",
        description: `Failed to parse the file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };



  const loadParameters = useCallback(async () => {
    if (!formData.position) {
      setCustomParameters({});
      setParametersSaved(false);
      setStructuredQuestions([]);
      return;
    }
    
    // Clear all parameters when loading new position
    setCustomParameters({});
    setParametersSaved(false);
    setStructuredQuestions([]);
    
    setIsLoadingParameters(true);
    try {
      console.log('🔄 Loading parameters for position:', formData.position, 'mode:', formData.interviewMode);
      
      // Try to load from custom_role_parameters table - FETCH interview_type!
      const { data, error } = await supabase
        .from('custom_role_parameters')
        .select('custom_parameters, structured_questions, personalized_questions, interview_type')
        .eq('role_name', formData.position)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const record = data[0];
        const customParams = record.custom_parameters;
        const structuredQuestions = record.structured_questions;
        const personalizedQuestions = record.personalized_questions;
        const interviewType = record.interview_type;
        
        console.log(`📋 Loaded from DB - interview_type: ${interviewType}`);
        
        // Determine interview mode based on what exists in database
        // Priority: structured_questions > custom_parameters
        const hasValidStructuredQuestions = structuredQuestions && 
          (Array.isArray(structuredQuestions) ? structuredQuestions.length > 0 : 
           typeof structuredQuestions === 'string' ? structuredQuestions !== '{}' && structuredQuestions !== '[]' :
           Object.keys(structuredQuestions).length > 0);
        const hasValidCustomParams = customParams && 
          (typeof customParams === 'string' ? customParams !== '{}' : Object.keys(customParams).length > 0);
        
        // Auto-update interview mode based on what exists
        // Priority: If only one type exists, use that. If both exist, prefer structured.
        let detectedMode: 'ai' | 'structured' = 'ai'; // Default to AI
        if (hasValidStructuredQuestions && !hasValidCustomParams) {
          detectedMode = 'structured';
        } else if (hasValidCustomParams && !hasValidStructuredQuestions) {
          detectedMode = 'ai';
        } else if (hasValidStructuredQuestions && hasValidCustomParams) {
          // Both exist - prefer structured (since structured is more specific)
          detectedMode = 'structured';
        }
        
        // Set the interview type, mode, and personalized questions FIRST
        if (interviewType && ['functional', 'behavioral', 'mixed'].includes(interviewType)) {
          console.log(`✅ Setting interview_type from database: ${interviewType}`);
        }
        
        // Clear opposite type's data when switching modes
        if (detectedMode === 'ai') {
          setStructuredQuestions([]);
        } else if (detectedMode === 'structured') {
          setCustomParameters({});
        }
        
        setFormData(prev => ({
          ...prev,
          interviewType: (interviewType && ['functional', 'behavioral', 'mixed'].includes(interviewType)) ? interviewType : prev.interviewType,
          interviewMode: detectedMode, // Auto-update mode based on database content
          personalizedQuestionsEnabled: !!personalizedQuestions,
          personalizedQuestions: personalizedQuestions || []
        }));
        
        if (detectedMode === 'ai') {
          // Load AI interview parameters
          if (customParams && Object.keys(customParams).length > 0) {
            setCustomParameters(customParams);
            setParametersSaved(true);
            
            // Calculate duration and questions - if personalized questions exist, use the combined function
            if (personalizedQuestions && personalizedQuestions.length > 0) {
              // Use the combined function that handles both technical and personalized questions
              recalculateDurationWithPersonalizedQuestions(personalizedQuestions, customParams);
            } else {
              // Only technical questions, use the regular calculation
              calculateDuration(customParams);
            }
            // Log the interview type being used
            console.log(`✅ Using interview_type: ${interviewType || 'not set'}`);
            
            // Removed toast - parameters load silently to avoid spam
          } else if (structuredQuestions && Array.isArray(structuredQuestions) && structuredQuestions.length > 0) {
            // No AI parameters but structured questions exist - suggest switching mode
            setCustomParameters({});
            setParametersSaved(false);
            // Removed toast - UI state is clear enough without notification
          } else {
            setCustomParameters({});
            setParametersSaved(false);
          }
        } else if (detectedMode === 'structured') {
          // Load structured interview questions
          // Parse structured_questions if it's a string
          let parsedStructuredQuestions = structuredQuestions;
          if (typeof structuredQuestions === 'string') {
            try {
              parsedStructuredQuestions = JSON.parse(structuredQuestions);
            } catch (e) {
              console.error('Error parsing structured_questions:', e);
              parsedStructuredQuestions = [];
            }
          }
          
          const questionsArray = Array.isArray(parsedStructuredQuestions) 
            ? parsedStructuredQuestions 
            : (parsedStructuredQuestions && Object.keys(parsedStructuredQuestions).length > 0 ? Object.values(parsedStructuredQuestions) : []);
          
          if (questionsArray.length > 0) {
            // For structured interviews, we don't need custom parameters
            setCustomParameters({});
            setParametersSaved(true);
            setStructuredQuestions(questionsArray);
            
            // Calculate duration from structured questions
            calculateDurationFromStructuredQuestions(questionsArray);
            
            // Removed toast - parameters load silently to avoid spam
          } else if (customParams && Object.keys(customParams).length > 0) {
            // No structured questions but AI parameters exist - suggest switching mode
            setCustomParameters({});
            setParametersSaved(false);
            // Removed toast - UI state is clear enough without notification
          } else {
            setCustomParameters({});
            setParametersSaved(false);
            setStructuredQuestions([]);
          }
        }
      } else {
        // No existing data found
        setCustomParameters({});
        setParametersSaved(false);
        setStructuredQuestions([]);
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
      setCustomParameters({});
      setParametersSaved(false);
      setStructuredQuestions([]);
    } finally {
      setIsLoadingParameters(false);
    }
  }, [formData.position, formData.interviewMode]);

  const calculateDuration = (parameters: CustomParameters) => {
    if (!parameters || Object.keys(parameters).length === 0) {
      setFormData(prev => ({ ...prev, duration: 30, totalQuestions: 1 })); // Default fallback - minimum 1 question
      return;
    }

    let totalQuestions = 0; // Will be calculated and rounded to whole number

    // Calculate questions per parameter: (min + max) ÷ 2, then round to nearest whole number
    Object.values(parameters).forEach((param, index) => {
      let minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      let maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      
      // Fix: Ensure question counts are reasonable (1-8 questions)
      if (isNaN(minQuestions) || minQuestions < 1 || minQuestions > 8) minQuestions = 1;
      if (isNaN(maxQuestions) || maxQuestions < 1 || maxQuestions > 8) maxQuestions = 3;
      if (maxQuestions < minQuestions) maxQuestions = minQuestions + 2; // Ensure max is at least min + 2

      const questionsPerParam = (minQuestions + maxQuestions) / 2;
      totalQuestions += questionsPerParam;
      
      console.log(`🔍 Parameter ${index + 1}: min=${minQuestions}, max=${maxQuestions}, calculated=${questionsPerParam}, running total=${totalQuestions}`);
    });

    // Round to nearest whole number for interview questions (no decimals)
    totalQuestions = Math.round(totalQuestions);
    
    // Ensure minimum of 1 question
    totalQuestions = Math.max(1, totalQuestions);
    
    console.log(`🎯 Final totalQuestions calculation: ${totalQuestions} questions`);
    
    // Calculate duration based on answer time + reading time for each parameter
    let calculatedDuration = 0;
    Object.values(parameters).forEach(param => {
      let minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      let maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      
      // Fix: Ensure question counts are reasonable (1-8 questions)
      if (isNaN(minQuestions) || minQuestions < 1 || minQuestions > 8) minQuestions = 1;
      if (isNaN(maxQuestions) || maxQuestions < 1 || maxQuestions > 8) maxQuestions = 3;
      if (maxQuestions < minQuestions) maxQuestions = minQuestions + 2;

      const avgQuestions = (minQuestions + maxQuestions) / 2;
      // Answer time per question (user configurable) - ensure it's a reasonable value
      let answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
      
      // Fix: Ensure answerTime is reasonable (1-10 minutes)
      if (isNaN(answerTime) || answerTime < 1 || answerTime > 10) {
        answerTime = 3; // Default to 3 minutes if invalid
      }
      
      // Reading time per question (fixed at 30 seconds = 0.5 minutes)
      const readingTime = 0.5;
      // Total time per question = answer time + reading time
      const totalTimePerQuestion = answerTime + readingTime;
      const paramDuration = avgQuestions * totalTimePerQuestion;
      calculatedDuration += paramDuration;
    });
    
    // Add 2 minutes buffer
    calculatedDuration += 2;
    
    // Ensure duration is within reasonable bounds (5-120 minutes) and round to whole minutes
    const finalDuration = Math.round(Math.max(5, Math.min(120, calculatedDuration)));
    
    setFormData(prev => ({ 
      ...prev, 
      duration: finalDuration,
      totalQuestions: totalQuestions
    }));
  };

  const recalculateDurationWithPersonalizedQuestions = (personalizedQuestions: Array<{question: string, timeLimit: number}>, parameters?: CustomParameters) => {
    // Calculate personalized questions duration
    const personalizedDuration = personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0);
    
    // Use provided parameters or fall back to current customParameters state
    const paramsToUse = parameters || customParameters;
    
    // Get base duration from parameters (without personalized questions)
    let baseDuration = 30; // Default fallback
    if (Object.keys(paramsToUse).length > 0) {
      let calculatedDuration = 0;
      Object.values(paramsToUse).forEach(param => {
        const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
        const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
        const avgQuestions = (minQuestions + maxQuestions) / 2;
        const answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
        const readingTime = 0.5; // 30 seconds per question
        const totalTimePerQuestion = answerTime + readingTime;
        calculatedDuration += avgQuestions * totalTimePerQuestion;
      });
      calculatedDuration += 2; // Add buffer
      baseDuration = Math.round(Math.max(5, Math.min(120, calculatedDuration)));
    }
    
    // Calculate total questions (technical + personalized) - use same logic as AIsetup
    let functionalQuestions = 0;
    Object.values(paramsToUse).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const questionsPerParam = (minQuestions + maxQuestions) / 2;
      functionalQuestions += questionsPerParam;
    });
    
    // Round to nearest whole number for technical questions (no decimals)
    functionalQuestions = Math.round(functionalQuestions);
    
    // Ensure minimum of 1 technical question
    functionalQuestions = Math.max(1, functionalQuestions);
    
    const totalQuestions = functionalQuestions + personalizedQuestions.length;
    
    // Total duration = base duration + personalized questions duration
    const totalDuration = baseDuration + personalizedDuration;
    
    console.log('🔄 HRInterviewCreator Duration recalculation:', {
      personalizedQuestions: personalizedQuestions.length,
      personalizedDuration,
      baseDuration,
      totalDuration,
      functionalQuestions,
      totalQuestions,
      usingProvidedParams: !!parameters
    });
    
    setFormData(prev => ({
      ...prev,
      duration: Math.round(totalDuration),
      totalQuestions: totalQuestions
    }));
  };

  const calculateDurationFromQuestions = (questions: number) => {
    // Calculate duration when user manually edits question count
    const calculatedDuration = Math.round(questions * 4 + 2);
    const finalDuration = Math.max(5, Math.min(120, calculatedDuration));
    setFormData(prev => ({ ...prev, duration: finalDuration }));
  };

  const calculateDurationFromStructuredQuestions = (structuredQuestions: any[]) => {
    // Calculate duration from structured questions' timeLimit values
    let totalDuration = 0;
    
    structuredQuestions.forEach(question => {
      const timeLimit = question.timeLimit || 3; // Default to 3 minutes if not set
      totalDuration += timeLimit;
    });
    
    // Add reading time (30 seconds per question)
    const readingTime = structuredQuestions.length * 0.5;
    
    // Add 2 minutes buffer
    const buffer = 2;
    
    // Total duration = question time + reading time + buffer
    const finalDuration = totalDuration + readingTime + buffer;
    
    console.log(`📊 Structured interview duration calculation:`, {
      questionTime: totalDuration,
      readingTime: readingTime,
      buffer: buffer,
      total: finalDuration
    });
    
    setFormData(prev => ({ 
      ...prev, 
      duration: Math.round(finalDuration), // Whole minutes only (match AIsetup)
      totalQuestions: structuredQuestions.length
    }));
  };

  const calculateQuestionsFromDuration = (duration: number) => {
    // Calculate questions when user manually edits duration
    const calculatedQuestions = (duration - 2) / 4;
    // Round to nearest whole number for interview questions
    const finalQuestions = Math.max(1, Math.min(30, Math.round(calculatedQuestions)));
    setFormData(prev => ({ ...prev, totalQuestions: finalQuestions }));
  };


  // Load job descriptions on component mount (recruiter only; candidate uses injected list)
  useEffect(() => {
    if (injectedJobDescriptions != null) return;
    if (user?.profile?.company_id) {
      loadJobDescriptions();
    }
  }, [user?.profile?.company_id, injectedJobDescriptions]);

  useEffect(() => {
    if (formData.position) {
      loadParameters();
    }
  }, [formData.position, formData.interviewMode, loadParameters]);

  // Clear parameters when switching modes
  useEffect(() => {
    if (formData.interviewMode === 'structured') {
      setCustomParameters({});
      setParametersSaved(false);
    } else if (formData.interviewMode === 'ai') {
      setStructuredQuestions([]);
    }
  }, [formData.interviewMode]);

  // Clear all data when position changes
  useEffect(() => {
    setCustomParameters({});
    setParametersSaved(false);
    setStructuredQuestions([]);
  }, [formData.position]);


  const saveParameters = async () => {
    if (!formData.position || Object.keys(customParameters).length === 0) {
      toast({
        title: "Configuration Required",
        description: "Please configure parameters before saving",
      });
      return;
    }

    const totalWeight = Object.values(customParameters).reduce((acc, p) => acc + (Number(p?.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast({
        title: "Invalid total weight",
        description: `Total weight must equal 100%. Current total: ${totalWeight}%. Adjust parameter weights so they sum to exactly 100.`,
      });
      return;
    }
    
    setIsSavingParameters(true);
    try {
      console.log('🔄 Saving parameters for role:', formData.position, customParameters);
      
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CUSTOM_PARAMETERS), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: formData.position,
          custom_parameters: customParameters
        })
      });

      if (response.ok) {
        setParametersSaved(true);
        toast({
          title: "Parameters Saved",
          description: "Parameters saved successfully!",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save parameters');
      }
    } catch (error) {
      console.error('Error saving parameters:', error);
      const message = error instanceof Error ? error.message : 'Failed to save parameters';
      toast({
        title: "Save Failed",
        description: message,
      });
    } finally {
      setIsSavingParameters(false);
    }
  };


  const resetForm = () => {
    setFormData({
      candidates: [{ name: '', email: '' }],
      position: '',
      duration: 30,
      totalQuestions: 1,
      customInstructions: '',
      interviewType: 'mixed',
      interviewMode: 'ai',
      personalizedQuestionsEnabled: false,
      personalizedQuestions: []
    });
    setCreatedInterviews([]);
  };

  const getEmailTemplate = (candidateName: string, interviewType: string, interviewLink?: string) => {
    const baseTemplate = {
      subject: `Interview Invitation - ${formData.position} Position`,
      greeting: `Hello ${candidateName},\n\n`,
      closing: `\n\nBest regards,\nHR Team`
    };

    const link = interviewLink || '{INTERVIEW_LINK}';
    
    switch (interviewType) {
      case 'functional':
        return {
          ...baseTemplate,
          subject: `Technical Interview Invitation - ${formData.position} Position`,
          body: `${baseTemplate.greeting}You have been invited to complete a functional interview for the ${formData.position} position.\n\nThis interview will assess your technical skills and problem-solving abilities. Please ensure you have a stable internet connection and a quiet environment.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
        };
      case 'behavioral':
        return {
          ...baseTemplate,
          subject: `Behavioral Interview Invitation - ${formData.position} Position`,
          body: `${baseTemplate.greeting}You have been invited to complete a behavioral interview for the ${formData.position} position.\n\nThis interview will focus on your past experiences, leadership skills, and cultural fit. Please prepare to share specific examples from your professional background.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
        };
      case 'mixed':
        return {
          ...baseTemplate,
          subject: `Comprehensive Interview Invitation - ${formData.position} Position`,
          body: `${baseTemplate.greeting}You have been invited to complete a comprehensive interview for the ${formData.position} position.\n\nThis interview will cover both functional skills and behavioral competencies. Please ensure you have a stable internet connection and are prepared to discuss your experience and technical knowledge.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
        };
      default:
        return {
          ...baseTemplate,
          body: `${baseTemplate.greeting}You have been invited to complete an interview for the ${formData.position} position.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
        };
    }
  };

  const sendInterviewLink = async () => {
    if (createdInterviews.length > 0) {
      const interviewType = formData.interviewType || 'mixed';
      
      try {
        if (createdInterviews.length === 1) {
          // Single candidate - send individual email
          const interview = createdInterviews[0];
          const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
          
          const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SEND_INTERVIEW_EMAIL), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              candidate_email: interview.candidate_email,
              candidate_name: interview.candidate_name,
              interview_link: interviewLink,
              position: formData.position,
              interview_type: interviewType
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            toast({
              title: "Email Sent Successfully",
              description: `Interview email sent to ${interview.candidate_name} (${interview.candidate_email})`,
            });
          } else {
            toast({
              title: "Email Failed",
              description: result.message || "Failed to send email",
              variant: "destructive",
            });
          }
        } else {
          // Multiple candidates - send individual emails to each
          let successCount = 0;
          let failCount = 0;
          
          for (const interview of createdInterviews) {
            try {
              const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
              
              const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SEND_INTERVIEW_EMAIL), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  candidate_email: interview.candidate_email,
                  candidate_name: interview.candidate_name,
                  interview_link: interviewLink,
                  position: formData.position,
                  interview_type: interviewType
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                successCount++;
              } else {
                failCount++;
              }
              
              // Small delay between emails to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              failCount++;
            }
          }
          
          if (successCount > 0 && failCount === 0) {
            toast({
              title: "All Emails Sent Successfully",
              description: `Interview emails sent to all ${successCount} candidates`,
            });
          } else if (successCount > 0 && failCount > 0) {
            toast({
              title: "Partial Success",
              description: `Sent to ${successCount} candidates, failed for ${failCount} candidates`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Email Failed",
              description: "Failed to send emails to all candidates",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error sending emails:', error);
        toast({
          title: "Email Error",
          description: "Failed to send emails. Please check your connection and try again.",
          variant: "destructive",
        });
      }
    }
  };

  const sendIndividualEmails = async () => {
    if (createdInterviews.length > 0) {
      const interviewType = formData.interviewType || 'mixed';
      
      try {
        let successCount = 0;
        let failCount = 0;
        
        // Send individual emails to each candidate with their specific interview link
        for (const [index, interview] of createdInterviews.entries()) {
          try {
            const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
            
            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SEND_INTERVIEW_EMAIL), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                candidate_email: interview.candidate_email,
                candidate_name: interview.candidate_name,
                interview_link: interviewLink,
                position: formData.position,
                interview_type: interviewType
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
            
            // Stagger emails by 1 second to avoid overwhelming the server
            if (index < createdInterviews.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
          } catch (error) {
            failCount++;
          }
        }
        
        if (successCount > 0 && failCount === 0) {
          toast({
            title: "All Emails Sent Successfully",
            description: `Interview emails sent to all ${successCount} candidates`,
          });
        } else if (successCount > 0 && failCount > 0) {
          toast({
            title: "Partial Success",
            description: `Sent to ${successCount} candidates, failed for ${failCount} candidates`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Email Failed",
            description: "Failed to send emails to all candidates",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error sending individual emails:', error);
        toast({
          title: "Email Error",
          description: "Failed to send emails. Please check your connection and try again.",
          variant: "destructive",
        });
      }
    }
  };

  const copyEmailContent = () => {
    if (createdInterviews.length > 0) {
      const interviewType = formData.interviewType || 'mixed';
      
      if (createdInterviews.length === 1) {
        // Single candidate - copy individual email
        const interview = createdInterviews[0];
        const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
        const template = getEmailTemplate(interview.candidate_name, interviewType, interviewLink);
        
        const emailContent = `To: ${interview.candidate_email}\nSubject: ${template.subject}\n\n${template.body}`;
        navigator.clipboard.writeText(emailContent);
        toast({
          title: "Email Content Copied",
          description: `${interviewType} interview email content has been copied to clipboard!`,
        });
      } else {
        // Multiple candidates - copy bulk email with all links
        const emailList = createdInterviews.map(i => i.candidate_email).join(', ');
        const template = getEmailTemplate('', interviewType);
        const allLinks = createdInterviews.map(interview => 
          `${interview.candidate_name}: ${window.location.origin}/interview/${interview.interview_id}`
        ).join('\n\n');
        const emailBody = template.body.replace('{INTERVIEW_LINK}', allLinks);
        
        const emailContent = `To: ${emailList}\nSubject: ${template.subject}\n\n${emailBody}`;
        navigator.clipboard.writeText(emailContent);
        toast({
          title: "Bulk Email Content Copied",
          description: `${interviewType} interview email content for ${createdInterviews.length} candidates has been copied to clipboard!`,
        });
      }
    }
  };

  const createInterview = async () => {
    // Candidate flow: require loaded profile; recruiter flow: require form candidates
    if (candidateId) {
      if (!loggedInCandidate?.name?.trim() || !loggedInCandidate?.email?.trim()) {
        toast({
          title: "Profile required",
          description: "Your profile is still loading. Please wait or try again.",
          variant: "destructive",
        });
        return;
      }
    } else {
      const hasValidCandidates = formData.candidates.every(candidate =>
        candidate.name.trim() && candidate.email.trim()
      );
      if (!hasValidCandidates || !formData.position) {
        toast({
          title: "Form Validation Error",
          description: "Please fill in all candidate names, emails, and position",
        });
        return;
      }
    }

    if (!formData.position) {
      toast({
        title: "Form Validation Error",
        description: "Please select a role/position",
      });
      return;
    }

    // For AI interviews, check if parameters are configured
    // For structured interviews, check if parameters are saved (indicating structured questions exist)
    if (formData.interviewMode === 'ai' && Object.keys(customParameters).length === 0) {
      toast({
        title: "Parameters Required",
        description: 'Please configure assessment parameters first. Use the "Assessment Parameters" section below to set up parameters for this role.',
      });
      return;
    }
    
    if (formData.interviewMode === 'structured' && !parametersSaved) {
      toast({
        title: "Structured Interview Required",
        description: 'Please create structured interview questions first. Use the "Structured Interview Setup" section to add questions for this role.',
      });
      return;
    }

    setIsCreating(true);

    const candidatesToCreate = candidateId && loggedInCandidate
      ? [{ name: loggedInCandidate.name, email: loggedInCandidate.email }]
      : formData.candidates;
    
    try {
      const createdInterviewsList: CreatedInterview[] = [];
      
      for (const candidate of candidatesToCreate) {
        console.log(`📤 Current formData before API call:`, {
          totalQuestions: formData.totalQuestions,
          duration: formData.duration,
          position: formData.position
        });
        console.log(`📤 Sending to server: total_questions=${formData.totalQuestions}, duration=${formData.duration}`);
        
        const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CREATE_INTERVIEW), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            candidate_name: candidate.name,
            candidate_email: candidate.email,
            position: formData.position,
            duration_minutes: formData.duration != null ? Math.round(Number(formData.duration)) : 30,
            total_questions: formData.totalQuestions,
            custom_instructions: formData.customInstructions,
            interview_type: formData.interviewType,
            interview_mode: formData.interviewMode,
            personalized_questions_enabled: formData.personalizedQuestionsEnabled,
            personalized_questions: formData.personalizedQuestions,
            ...(candidateId
              ? { candidate_id: candidateId, company_id: null, user_id: null }
              : { company_id: user?.profile?.company_id, user_id: user?.id }
            ),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to create interview for ${candidate.name}: ${errorData.error || 'Unknown error'}`);
        }

        const interviewData = await response.json();
        createdInterviewsList.push({
          interview_id: interviewData.interview_id,
          candidate_name: candidate.name,
          candidate_email: candidate.email
        });
      }

      setCreatedInterviews(createdInterviewsList);
      toast({
        title: "Interviews Created",
        description: `Successfully created ${createdInterviewsList.length} interview(s)!`,
      });
    } catch (error) {
      console.error('Error creating interviews:', error);
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create interviews",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyInterviewLink = (interviewId: string) => {
    const interviewLink = `${window.location.origin}/interview/${interviewId}`;
    navigator.clipboard.writeText(interviewLink);
    toast({
      title: "Link Copied",
      description: "Interview link copied to clipboard!",
    });
  };

  const copyAllLinksToClipboard = () => {
    if (createdInterviews.length > 0) {
      const allLinks = createdInterviews.map(interview => 
        `${interview.candidate_name}: ${window.location.origin}/interview/${interview.interview_id}`
      ).join('\n');
      navigator.clipboard.writeText(allLinks);
      toast({
        title: "All Links Copied",
        description: "All interview links copied to clipboard!",
      });
    }
  };

  // Helper function to calculate total weightage
  const calculateTotalWeightage = () => {
    return Object.values(customParameters).reduce((total, param) => {
      return total + (param.weight || 0);
    }, 0);
  };

  // Helper function to get color for weightage distribution chart
  const getWeightageColor = (index: number, weight: number) => {
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#EC4899', // Pink
      '#84CC16', // Lime
      '#6366F1'  // Indigo
    ];
    
    if (weight === 0) return '#E5E7EB'; // Gray for zero weight
    return colors[index % colors.length];
  };

  // Helper function to format description with bullet points
  const formatDescription = (description: string) => {
    // Split by bullet points and format as proper list
    const points = description.split('•').filter(point => point.trim());
    if (points.length <= 1) {
      return description; // Return original if no bullet points
    }
    
    return points.map(point => point.trim()).filter(point => point.length > 0);
  };

  // Helper function to clean description for collapsed view (remove bullet points)
  const cleanDescription = (description: string) => {
    // Remove bullet points and join with spaces for collapsed view
    return description.replace(/•/g, '').replace(/\s+/g, ' ').trim();
  };

  // Toggle parameter expansion
  const toggleParameter = (parameterKey: string) => {
    setExpandedParameters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parameterKey)) {
        newSet.delete(parameterKey);
      } else {
        newSet.add(parameterKey);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const t = setTimeout(() => onSectionReady?.(), 500);
    return () => clearTimeout(t);
  }, [onSectionReady]);

  const isCandidate = !!candidateId;
  const titleClass = isCandidate ? 'text-sky-800' : 'text-primary-800';
  const statBgClass = isCandidate ? 'bg-sky-50 border-sky-200' : 'bg-blue-50 border-blue-200';
  const statNumClass = isCandidate ? 'text-sky-800' : 'text-blue-800';
  const statLabelClass = isCandidate ? 'text-sky-600' : 'text-blue-600';
  const statSubClass = isCandidate ? 'text-sky-500' : 'text-blue-500';

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden">
      <div className="lg:hidden">
        <CompactStepProgress
          current={currentStep}
          total={INTERVIEW_WORKFLOW_STEPS.length}
          steps={INTERVIEW_WORKFLOW_STEPS}
          onStepClick={navigateToStep}
          allowClickAnyStep={isCandidateFlow}
          theme={isCandidateFlow ? 'candidate' : 'default'}
        />
      </div>
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
        <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${titleClass}`}>Final Overview</h2>
        {!candidateId && (
          <p className="text-sm sm:text-base text-muted-foreground">Set up an interview and generate a link for your candidate</p>
        )}
      </div>

      {/* Interview Configuration Section */}
      <Card className="animate-fade-in overflow-hidden" data-tour="ai-interview-area">
        <CardContent className="space-y-6 pt-4 sm:pt-6 px-3 sm:px-6 pb-4 sm:pb-6">
          <div className="space-y-6 min-w-0">
            {/* Candidates Section: recruiter = import/add + name/email inputs; candidate = read-only self */}
            <div className="space-y-4">
              {candidateId ? (
                <>
                  <Label className="text-sm sm:text-base font-semibold">Candidate</Label>
                  {loggedInCandidateLoading ? (
                    <div className="flex items-center gap-2 text-gray-600 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading your profile…
                    </div>
                  ) : loggedInCandidate ? (
                    <p className="text-sm text-gray-700 py-2">
                      Interview for: <span className="font-medium text-gray-900">{loggedInCandidate.name}</span>
                      {loggedInCandidate.email && (
                        <> ({loggedInCandidate.email})</>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 py-2">Unable to load your profile. Please try again or contact support.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <Label className="text-sm sm:text-base font-semibold">Candidates *</Label>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportCandidates}
                        className="hidden"
                        id="import-candidates-file"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('import-candidates-file')?.click()}
                        className="flex items-center gap-2 w-full sm:w-auto"
                      >
                        <Upload className="h-4 w-4" />
                        Import Candidates
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCandidate}
                        className="flex items-center gap-2 w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4" />
                        Add Candidate
                      </Button>
                    </div>
                  </div>
                  {formData.candidates.map((candidate, index) => (
                    <div key={index} className="border rounded-lg p-3 sm:p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium text-gray-700">
                          Candidate {index + 1}
                        </span>
                        {formData.candidates.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCandidate(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`candidate-name-${index}`}>Name *</Label>
                          <Input
                            id={`candidate-name-${index}`}
                            value={candidate.name}
                            onChange={(e) => handleCandidateChange(index, 'name', e.target.value)}
                            placeholder="Enter candidate's full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`candidate-email-${index}`}>Email *</Label>
                          <Input
                            id={`candidate-email-${index}`}
                            type="email"
                            value={candidate.email}
                            onChange={(e) => handleCandidateChange(index, 'email', e.target.value)}
                            placeholder="candidate@example.com"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Select Role Section */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Select Role *</Label>
              <Select onValueChange={handleJobDescriptionSelect}>
                <SelectTrigger className="w-full min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select a role from existing job descriptions..." />
                </SelectTrigger>
                <SelectContent>
                  {effectiveJobDescriptions.map((jd: { jd_id: string; title: string | null }) => (
                    <SelectItem key={jd.jd_id} value={jd.jd_id}>
                      {jd.title ?? 'Untitled'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Instructions Section (recruiter only) */}
            {!candidateId && (
              <div className="space-y-2">
                <Label htmlFor="customInstructions" className="text-sm sm:text-base">Custom Instructions (Optional)</Label>
                <Textarea
                  id="customInstructions"
                  name="customInstructions"
                  value={formData.customInstructions}
                  onChange={handleInputChange}
                  placeholder="Any specific instructions or focus areas for this interview..."
                  rows={3}
                  className="text-sm sm:text-base"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="interviewMode" className="text-sm sm:text-base">Interview Mode *</Label>
              <Select
                value={formData.interviewMode}
                onValueChange={(value: 'ai' | 'structured') => 
                  setFormData(prev => ({ ...prev, interviewMode: value }))
                }
              >
                <SelectTrigger className="w-full min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select interview mode..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai">🤖 AI Interview (Dynamic)</SelectItem>
                  <SelectItem value="structured">📋 Structured Interview (Pre-defined)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                AI Interview: Questions generated dynamically based on candidate responses<br className="hidden sm:block"/>
                Structured Interview: Pre-defined questions set by HR
              </p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Unified Interview Summary Section - Only for AI Interviews */}
      {formData.position && Object.keys(customParameters).length > 0 && formData.interviewMode === 'ai' && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>
              {formData.position}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className={`rounded-lg p-3 sm:p-4 border text-center ${statBgClass}`}>
                <div className={`text-xl sm:text-2xl font-bold ${statNumClass}`}>{formData.totalQuestions || 'Calculating...'}</div>
                <div className={`text-xs sm:text-sm font-medium ${statLabelClass}`}>Total Questions</div>
                <div className={`text-xs ${statSubClass}`}>Based on parameters</div>
              </div>
              <div className={`rounded-lg p-3 sm:p-4 border text-center ${statBgClass}`}>
                <div className={`text-xl sm:text-2xl font-bold ${statNumClass}`}>{formData.duration != null ? Math.round(Number(formData.duration)) : 'Calculating...'} min</div>
                <div className={`text-xs sm:text-sm font-medium ${statLabelClass}`}>Duration</div>
                <div className={`text-xs ${statSubClass}`}>Auto-calculated</div>
              </div>
              <div className={`rounded-lg p-3 sm:p-4 border text-center ${statBgClass}`}>
                <div className={`text-xl sm:text-2xl font-bold ${statNumClass}`}>{Object.keys(customParameters).length}</div>
                <div className={`text-xs sm:text-sm font-medium ${statLabelClass}`}>Parameters</div>
                <div className={`text-xs ${statSubClass}`}>Assessment areas</div>
              </div>
              <div className={`rounded-lg p-3 sm:p-4 border text-center ${statBgClass}`}>
                <div className={`text-xl sm:text-2xl font-bold ${statNumClass}`}>{calculateTotalWeightage()}%</div>
                <div className={`text-xs sm:text-sm font-medium ${statLabelClass}`}>Weightage</div>
                <div className={`text-xs ${statSubClass}`}>Total weightage</div>
              </div>
            </div>

            {/* Parameter Weightage Summary */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Parameter Weightage Summary</h3>
              
              {/* Individual Parameter Cards */}
              <div className="space-y-3">
                {Object.entries(customParameters).map(([key, param], index) => {
                  const isExpanded = expandedParameters.has(key);
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']; // blue, green, orange, red
                  const color = colors[index % colors.length];
                  
                  return (
                    <div key={key} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      {/* Parameter Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: color }}
                          ></div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900 mb-1">
                              {param.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-gray-900">
                            {param.weight}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${param.weight}%`,
                            backgroundColor: color
                          }}
                        ></div>
                      </div>
                      
                      {/* View Details Link */}
                      <div 
                        className="text-blue-600 text-xs font-medium cursor-pointer hover:text-blue-700 transition-colors"
                        onClick={() => toggleParameter(key)}
                      >
                        {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                      </div>
                      
                      {/* Expandable Content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="space-y-4">
                            {/* Full Description */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">Full Description:</h4>
                              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">
                                {(() => {
                                  const formattedDesc = formatDescription(param.description);
                                  if (Array.isArray(formattedDesc)) {
                                    return (
                                      <ul className="list-disc list-inside space-y-2">
                                        {formattedDesc.map((point, idx) => (
                                          <li key={idx}>{point}</li>
                                        ))}
                                      </ul>
                                    );
                                  } else {
                                    return formattedDesc;
                                  }
                                })()}
                              </div>
                            </div>
                            
                            {/* Parameter Details */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">Parameter Details:</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                <div className="text-center">
                                  <div className="text-sm text-gray-500 mb-1">Weight</div>
                                  <div className="text-base font-semibold text-gray-900">{param.weight}%</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm text-gray-500 mb-1">Min Questions</div>
                                  <div className="text-base font-semibold text-gray-900">{param.min_questions}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm text-gray-500 mb-1">Max Questions</div>
                                  <div className="text-base font-semibold text-gray-900">{param.max_questions}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm text-gray-500 mb-1">Time (min)</div>
                                  <div className="text-base font-semibold text-gray-900">{param.max_time || 3}</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Scoring Criteria */}
                            {param.scoring_criteria && Array.isArray(param.scoring_criteria) && param.scoring_criteria.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Scoring Criteria:</h4>
                                <div className="space-y-2">
                                  {param.scoring_criteria.map((criteria, criteriaIndex) => (
                                    <div key={criteriaIndex} className="flex items-start gap-2">
                                      <div 
                                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                      ></div>
                                      <div className="text-sm text-gray-700">{criteria}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>


            {/* Personalized Questions Section */}
            {formData.personalizedQuestionsEnabled && formData.personalizedQuestions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Personalized Questions
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  These personal questions will be asked before functional questions. They are for review only and won't be scored.
                </p>
                
                <div className="space-y-3">
                  {formData.personalizedQuestions.map((question, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Question {index + 1}
                        </Label>
                        <div className="text-xs text-gray-500">
                          {question.timeLimit} min
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                        {question.question}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unified Interview Summary Section - Only for Structured Interviews */}
      {formData.position && structuredQuestions.length > 0 && formData.interviewMode === 'structured' && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Interview Summary for {formData.position}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                <div className="text-2xl font-bold text-green-800">{structuredQuestions.length}</div>
                <div className="text-sm text-green-600 font-medium">Total Questions</div>
                <div className="text-xs text-green-500">Pre-defined questions</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                <div className="text-2xl font-bold text-green-800">{formData.duration != null ? Math.round(Number(formData.duration)) : 'Calculating...'} min</div>
                <div className="text-sm text-green-600 font-medium">Duration</div>
                <div className="text-xs text-green-500">Auto-calculated</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                <div className="text-2xl font-bold text-green-800">Structured</div>
                <div className="text-sm text-green-600 font-medium">Interview Type</div>
                <div className="text-xs text-green-500">Pre-defined format</div>
              </div>
            </div>

            {/* Structured Questions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="h-4 w-4 bg-green-600 rounded flex items-center justify-center">
                  <div className="h-2 w-2 bg-white rounded-full"></div>
                </div>
                Structured Interview Questions
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                These are the pre-defined questions that will be asked during the structured interview.
              </p>
              
              <div className="space-y-3">
                {structuredQuestions.map((question, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-700">
                            Question {index + 1}
                          </div>
                          {question.parameterType && (
                            <div className="text-xs text-green-600 font-medium">
                              {question.parameterType}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                          {question.timeLimit || 3} min
                        </div>
                        {question.difficulty && (
                          <div className={`text-xs px-2 py-1 rounded border ${
                            question.difficulty === 'Easy' ? 'bg-green-100 text-green-700 border-green-200' :
                            question.difficulty === 'Regular' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                            'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {question.difficulty}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                      {question.question}
                    </div>
                    {question.expectedAnswer && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-600 mb-1">Expected Answer:</div>
                        <div className={`text-xs text-gray-600 p-2 rounded border ${isCandidate ? 'bg-sky-50' : 'bg-blue-50'}`}>
                          {question.expectedAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Personalized Questions Section */}
            {formData.personalizedQuestionsEnabled && formData.personalizedQuestions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Personalized Questions
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  These personal questions will be asked before functional questions. They are for review only and won't be scored.
                </p>
                
                <div className="space-y-3">
                  {formData.personalizedQuestions.map((question, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Question {index + 1}
                        </Label>
                        <div className="text-xs text-gray-500">
                          {question.timeLimit} min
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                        {question.question}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Interview Link Button */}
      <div className="flex justify-center">
        <Button
          onClick={createInterview}
          disabled={isCreating || (!!candidateId && (loggedInCandidateLoading || !loggedInCandidate))}
          className={isCandidate ? 'px-6 sm:px-8 py-2 w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white' : 'px-6 sm:px-8 py-2 w-full sm:w-auto'}
          size="default"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Interview Link...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Interview Link
            </>
          )}
        </Button>
      </div>

      {/* Interview Links Section */}
      {createdInterviews.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                {candidateId ? 'Your interview link' : `Interview Links (${createdInterviews.length})`}
              </CardTitle>
              {!candidateId && (
                <Button
                  onClick={async () => {
                    if (sendingEmails.size > 0) return;
                    try {
                      const allInterviewIds = createdInterviews.map(interview => interview.interview_id);
                      setSendingEmails(new Set(allInterviewIds));
                      const interviewType = formData.interviewType || 'mixed';
                      let successCount = 0;
                      let failCount = 0;
                      for (const interview of createdInterviews) {
                        try {
                          const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
                          const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SEND_INTERVIEW_EMAIL), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              candidate_email: interview.candidate_email,
                              candidate_name: interview.candidate_name,
                              interview_link: interviewLink,
                              position: formData.position,
                              interview_type: interviewType
                            })
                          });
                          const result = await response.json();
                          if (result.success) successCount++; else failCount++;
                        } catch { failCount++; }
                      }
                      if (successCount > 0 && failCount === 0) {
                        toast({ title: "All Emails Sent Successfully", description: `Interview emails sent to all ${successCount} candidates` });
                      } else if (successCount > 0 && failCount > 0) {
                        toast({ title: "Partial Success", description: `Sent to ${successCount} candidates, ${failCount} failed`, variant: "destructive" });
                      } else {
                        toast({ title: "All Emails Failed", description: "Failed to send emails to all candidates", variant: "destructive" });
                      }
                    } catch (error) {
                      toast({ title: "Email Error", description: "Failed to send emails. Please try again.", variant: "destructive" });
                    } finally {
                      setSendingEmails(new Set());
                    }
                  }}
                  size="sm"
                  disabled={sendingEmails.size > 0}
                >
                  {sendingEmails.size > 0 ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Send All Emails</>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {createdInterviews.map((interview, index) => {
              const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
              return (
                <div key={interview.interview_id} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  {!candidateId && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                      <p className="text-xs sm:text-sm font-medium text-gray-800 break-words">
                        {interview.candidate_name} ({interview.candidate_email})
                      </p>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Interview {index + 1}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
                    <Input
                      value={interviewLink}
                      readOnly
                      className="font-mono text-xs sm:text-sm flex-1"
                    />
                    {candidateId ? (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
                        onClick={() => window.open(interviewLink, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4 sm:mr-2" />
                        Open in new tab
                      </Button>
                    ) : (
                      <Button
                        onClick={() => copyInterviewLink(interview.interview_id)}
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        <Copy className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Copy</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!candidateId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="font-medium text-blue-800">Total Interviews</p>
                  <p className="text-blue-600 font-mono">{createdInterviews.length}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="font-medium text-green-800">Status</p>
                  <p className="text-green-600">Ready for candidates</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
};

export default HRInterviewCreator;
