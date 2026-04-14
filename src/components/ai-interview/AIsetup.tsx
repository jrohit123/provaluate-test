import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { API_CONFIG, buildApiUrl, apiCall } from '@/constants/api';
import { INTERVIEW_CONSTANTS } from '@/constants/interview';
import { JobDescription, StructuredQuestion, CustomCompetencies, type CustomCompetency } from '@/types/interview';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Target,
  Brain,
  Loader2,
  X,
  Upload,
  Maximize2,
  HelpCircle,
  Settings
} from 'lucide-react';
import { UsageTrackingService } from '@/services/usageTrackingService';
import type { JobDescriptionLimitInfo } from '@/services/usageTrackingService';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import StructuredInterviewSetup from './StructuredInterviewSetup';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import {
  useInterviewCurrentStep,
  useInterviewNavigateToStep,
  INTERVIEW_WORKFLOW_STEPS,
  TPO_DASHBOARD_WORKFLOW_STEPS,
} from '@/hooks/useWorkflowNavigation';

/** When provided, JDs are loaded from this list (e.g. candidate's jd_candidates) instead of company tables. Recruiter flow unchanged when omitted. */
export type InjectedJD = {
  jd_id: string;
  title: string | null;
  extracted_text?: string | null;
  jd_file?: string | null;
  created_at?: string;
  custom_role_parameters_id?: string | null;
  interview_mode?: 'ai' | 'structured' | null;
  interview_type?: 'functional' | 'behavioral' | 'mixed' | 'technical' | null;
};

interface AIsetupProps {
  onSectionReady?: () => void;
  /** Optional: use these JDs instead of loading from jd_for_interview + job_descriptions (e.g. for candidate dashboard from jd_candidates). */
  injectedJobDescriptions?: InjectedJD[];
  /** Optional: called when JDs should be refreshed (e.g. refetch jd_candidates). Used when injectedJobDescriptions is provided. */
  injectedLoadJobDescriptions?: () => Promise<void>;
  /** When set, uploads go to jd_candidates (candidate_id) instead of jd_for_interview (company_id). Use for candidate dashboard. */
  candidateId?: string;
  /** TPO: persist JD upload to campus_interview_templates via POST /api/tpo/campus-interviews (do not set candidateId for this path). */
  tpoCampusTemplatePersist?: boolean;
  /** TPO embedded dashboard: candidate-style step bar; use with onTpoWorkflowStepClick. */
  tpoWorkflowStepIndex?: number;
  onTpoWorkflowStepClick?: (stepIndex: number) => void;
}

interface FormData {
  position: string;
  newRole: string;
  jobDescription: string;
  duration: number;
  totalQuestions: number;
  interviewType: 'functional' | 'behavioral' | 'mixed';
  interviewMode: 'ai' | 'structured';
  personalizedQuestionsEnabled: boolean;
  personalizedQuestions: Array<{question: string, timeLimit: number}>;
}


const CANDIDATE_WORKFLOW_PATHS = ['/candidate-dashboard/jds/configure', '/candidate-dashboard/jds/create', '/candidate-dashboard/performance-report'] as const;

const normalizeInterviewTypeForForm = (
  type: InjectedJD['interview_type']
): FormData['interviewType'] => {
  if (type === 'functional' || type === 'behavioral' || type === 'mixed') return type;
  return 'mixed';
};

const HRInterviewCreator = ({
  onSectionReady,
  injectedJobDescriptions,
  injectedLoadJobDescriptions,
  candidateId,
  tpoCampusTemplatePersist,
  tpoWorkflowStepIndex,
  onTpoWorkflowStepClick,
}: AIsetupProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const interviewCurrentStep = useInterviewCurrentStep();
  const interviewNavigateToStep = useInterviewNavigateToStep();
  const pathname = location.pathname;
  const tpoEmbeddedWorkflow = typeof tpoWorkflowStepIndex === 'number' && !!onTpoWorkflowStepClick;
  const embeddedInterviewWorkflowSteps = tpoEmbeddedWorkflow
    ? TPO_DASHBOARD_WORKFLOW_STEPS
    : INTERVIEW_WORKFLOW_STEPS;
  const isCandidateFlow = !!candidateId || tpoEmbeddedWorkflow;
  const candidateCurrentStep = tpoEmbeddedWorkflow
    ? tpoWorkflowStepIndex!
    : pathname.includes('/jds/create')
      ? 1
      : pathname.includes('/interviews')
        ? 2
        : 0;
  const candidateNavigateToStep = (stepIndex: number) => {
    if (tpoEmbeddedWorkflow) {
      onTpoWorkflowStepClick!(stepIndex);
      return;
    }
    if (stepIndex >= 0 && stepIndex < CANDIDATE_WORKFLOW_PATHS.length) {
      navigate(CANDIDATE_WORKFLOW_PATHS[stepIndex]);
    }
  };
  const currentStep = isCandidateFlow ? candidateCurrentStep : interviewCurrentStep;
  const navigateToStep = isCandidateFlow ? candidateNavigateToStep : interviewNavigateToStep;
  
  const [formData, setFormData] = useState<FormData>({
    position: '',
    newRole: '',
    jobDescription: '',
    duration: 30,
    totalQuestions: 1,
    interviewType: 'mixed',
    interviewMode: 'ai',
    personalizedQuestionsEnabled: false,
    personalizedQuestions: []
  });

  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  // Effective JD list: use injected (candidate jd_candidates) or internal (recruiter company JDs)
  const effectiveJobDescriptions = injectedJobDescriptions ?? jobDescriptions;
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [customCompetencies, setCustomCompetencies] = useState<CustomCompetencies>({});
  const [structuredQuestions, setStructuredQuestions] = useState<StructuredQuestion[]>([]);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(false);
  const [isSavingCompetencies, setIsSavingCompetencies] = useState(false);
  const [competenciesSaved, setCompetenciesSaved] = useState(false);
  const [isExpandDialogOpen, setIsExpandDialogOpen] = useState(false);
  const [loadedPositions, setLoadedPositions] = useState<Set<string>>(new Set());
  const [expandedCompetencies, setExpandedCompetencies] = useState<Set<string>>(new Set());
  /** Per-competency max_time before "Requires written answer" was checked; restored when unchecked */
  const [writtenAnswerPrevMaxTime, setWrittenAnswerPrevMaxTime] = useState<Record<string, number>>({});
  const [roleNameCheckState, setRoleNameCheckState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [roleNameCheckMessage, setRoleNameCheckMessage] = useState('');

  // Interview JD limit + manage (jd_for_interview) – recruiter only
  const [interviewJdLimitInfo, setInterviewJdLimitInfo] = useState<JobDescriptionLimitInfo | null>(null);
  const [interviewJobDescriptions, setInterviewJobDescriptions] = useState<Array<{
    id: string;
    title: string;
    created_at?: string;
    updated_at?: string;
    is_active: boolean;
  }>>([]);
  const [updatingInterviewStatus, setUpdatingInterviewStatus] = useState<string | null>(null);
  const [isManageInterviewSectionExpanded, setIsManageInterviewSectionExpanded] = useState(false);

  // CV screening JDs for manage dialog (job_descriptions – all statuses)
  const [cvJobDescriptionsForManage, setCvJobDescriptionsForManage] = useState<Array<{
    jd_id: string;
    title: string;
    status: string;
    created_at?: string;
    updated_at?: string;
  }>>([]);
  const [updatingCvStatus, setUpdatingCvStatus] = useState<string | null>(null);
  const [tpoCollegeId, setTpoCollegeId] = useState<string | null>(null);
  const companyId = user?.profile?.company_id as string | undefined;
  const crpScopePayload = tpoCampusTemplatePersist && tpoCollegeId
    ? { parameter_pack_origin: 'college' as const, college_id: tpoCollegeId }
    : companyId && !candidateId && !tpoCampusTemplatePersist
      ? { parameter_pack_origin: 'company' as const, company_id: companyId }
      : { parameter_pack_origin: 'personal' as const, user_id: user?.id };

  useEffect(() => {
    if (!tpoCampusTemplatePersist) return;
    let cancelled = false;
    const loadTpoCollegeScope = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;
        const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ME), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({} as {
          tpo_user?: { college?: { id?: string } };
        }));
        const cid = data?.tpo_user?.college?.id;
        if (!cancelled && cid) setTpoCollegeId(cid);
      } catch {
        // Keep existing fallback scope behavior if TPO context cannot be loaded.
      }
    };
    loadTpoCollegeScope();
    return () => {
      cancelled = true;
    };
  }, [tpoCampusTemplatePersist]);

  // Load job descriptions from both CV screening and AI interview tables
  const loadJobDescriptions = async () => {
    if (!user?.profile?.company_id) return;
    
    let allJobDescriptions: Array<{ jd_id: string; title: string | null; [key: string]: unknown }> = [];
    
    try {
      setInterviewJobDescriptions([]);
      // Load from jd_for_interview table (AI interview) - FIRST
      const { data: interviewData, error: interviewError } = await supabase
        .from('jd_for_interview')
        .select('id, title, jd_file, created_at, extracted_text, is_active, updated_at')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
      
      if (interviewError) {
        console.error('Error loading AI interview JDs:', interviewError);
      } else {
        console.log('AI interview JDs loaded:', interviewData?.length || 0, interviewData);
        const mappedInterviewData = (interviewData || []).map(item => ({
          ...item,
          jd_id: item.id
        }));
        allJobDescriptions = [...allJobDescriptions, ...mappedInterviewData];
        setInterviewJobDescriptions((interviewData || []).map(item => ({
          id: item.id,
          title: item.title ?? 'Untitled',
          created_at: item.created_at,
          updated_at: item.updated_at,
          is_active: item.is_active ?? true
        })));
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

  const checkInterviewJDLimit = async () => {
    if (!user?.profile?.company_id || isCandidateFlow) return;
    try {
      const limitInfo = await UsageTrackingService.checkInterviewJDLimit(user.profile.company_id);
      setInterviewJdLimitInfo(limitInfo);
    } catch (error) {
      console.error('Error checking interview JD limit:', error);
    }
  };

  const getInterviewJDStatusConfig = (info: JobDescriptionLimitInfo | null) => {
    if (!info) return 'healthy';
    const { remainingJDs, maxActiveJDs, currentActiveJDCount } = info;
    if (maxActiveJDs === 0) return 'healthy';
    const usagePercentage = (currentActiveJDCount / maxActiveJDs) * 100;
    if (remainingJDs <= 0) return 'critical';
    if (remainingJDs <= 2 || usagePercentage >= 90) return 'warning';
    if (remainingJDs <= 5 || usagePercentage >= 70) return 'caution';
    return 'healthy';
  };

  const interviewJdStatusConfig = getInterviewJDStatusConfig(interviewJdLimitInfo);
  const interviewJdStatusMap = {
    healthy: { border: 'border-emerald-200', bg: 'bg-emerald-50/40', text: 'text-emerald-800', iconColor: 'text-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-800', progressColor: 'bg-emerald-500', message: `${interviewJdLimitInfo?.remainingJDs ?? 0} slots available` },
    caution: { border: 'border-yellow-200', bg: 'bg-yellow-50/40', text: 'text-yellow-800', iconColor: 'text-yellow-500', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800', progressColor: 'bg-yellow-500', message: `${interviewJdLimitInfo?.remainingJDs ?? 0} slots remaining` },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50/40', text: 'text-amber-800', iconColor: 'text-amber-500', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800', progressColor: 'bg-amber-500', message: `Only ${interviewJdLimitInfo?.remainingJDs ?? 0} slot(s) remaining` },
    critical: { border: 'border-red-200', bg: 'bg-red-50/40', text: 'text-red-800', iconColor: 'text-red-500', badgeBg: 'bg-red-100', badgeText: 'text-red-800', progressColor: 'bg-red-500', message: 'You must disable an interview JD to add new ones' }
  };
  const currentInterviewJdStatus = interviewJdStatusMap[interviewJdStatusConfig as keyof typeof interviewJdStatusMap] ?? interviewJdStatusMap.healthy;

  const toggleInterviewJDStatus = async (id: string, currentIsActive: boolean) => {
    if (!user?.profile?.company_id) return;
    const newActive = !currentIsActive;
    if (newActive) {
      const limitInfo = await UsageTrackingService.checkInterviewJDLimit(user.profile.company_id);
      if (!limitInfo.canCreateJD && limitInfo.maxActiveJDs > 0) {
        toast.error(`You have reached your plan limit of ${limitInfo.maxActiveJDs} active interview JDs. Please disable another one first.`);
        return;
      }
    }
    setUpdatingInterviewStatus(id);
    try {
      const { error } = await supabase
        .from('jd_for_interview')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Interview JD ${newActive ? 'enabled' : 'disabled'} successfully.`);
      await loadJobDescriptions();
      await checkInterviewJDLimit();
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Failed to update interview JD status.');
    } finally {
      setUpdatingInterviewStatus(null);
    }
  };

  const loadCVJobDescriptionsForManage = async () => {
    if (!user?.profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, status, created_at, updated_at')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCvJobDescriptionsForManage((data || []).map((row) => ({
        jd_id: row.jd_id,
        title: row.title ?? 'Untitled',
        status: row.status ?? 'active',
        created_at: row.created_at,
        updated_at: row.updated_at
      })));
    } catch (err) {
      console.error('Error loading CV JDs for manage:', err);
      setCvJobDescriptionsForManage([]);
    }
  };

  const toggleCVJDStatus = async (jdId: string, currentStatus: string) => {
    if (!user?.profile?.company_id) return;
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    if (newStatus === 'active') {
      const limitInfo = await UsageTrackingService.checkInterviewJDLimit(user.profile.company_id);
      if (!limitInfo.canCreateJD && limitInfo.maxActiveJDs > 0) {
        toast.error(`You have reached your plan limit of ${limitInfo.maxActiveJDs} active JDs. Please disable another one first.`);
        return;
      }
    }
    setUpdatingCvStatus(jdId);
    try {
      const { error } = await supabase
        .from('job_descriptions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('jd_id', jdId);
      if (error) throw error;
      toast.success(`CV JD ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully.`);
      await loadJobDescriptions();
      await loadCVJobDescriptionsForManage();
      await checkInterviewJDLimit();
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Failed to update CV JD status.');
    } finally {
      setUpdatingCvStatus(null);
    }
  };

  // Helper function to convert resolved_jd attributes to plain text
  const convertResolvedJDToText = (jdPayload: any): string => {
    if (!jdPayload || !jdPayload.attributes) {
      return '';
    }

    const attributes = jdPayload.attributes;
    let text = '';

    // Convert each attribute category to readable text
    Object.entries(attributes).forEach(([key, value]: [string, any]) => {
      const categoryName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      text += `${categoryName}:\n`;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.entries(value).forEach(([subKey, subValue]: [string, any]) => {
          const subCategoryName = subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (Array.isArray(subValue)) {
            text += `  ${subCategoryName}: ${subValue.join(', ')}\n`;
          } else {
            text += `  ${subCategoryName}: ${subValue}\n`;
          }
        });
      } else if (Array.isArray(value)) {
        text += `  ${value.join(', ')}\n`;
      } else {
        text += `  ${value}\n`;
      }
      text += '\n';
    });

    // Add attributes_summary if available
    if (jdPayload.attributes_summary) {
      text += `\nSummary:\n${jdPayload.attributes_summary}\n`;
    }

    return text.trim();
  };

  // Helper function to show JD loaded toast (consolidated)
  const showJDLoadedToast = (jdTitle: string) => {
    const normalizedTitle = jdTitle.trim().toLowerCase();
    if (!loadedPositions.has(normalizedTitle)) {
      toast.success('Job description loaded successfully', { 
        id: `jd-loaded-${normalizedTitle}`,
        duration: 2000 
      });
      setLoadedPositions(prev => new Set(prev).add(normalizedTitle));
    }
  };

  /** Template has configured interview variant (saved with competencies). Until then mode/type stay null client-side. */
  const templateHasSavedInterviewVariant = (jd: InjectedJD) =>
    !!(jd.custom_role_parameters_id || jd.interview_mode || jd.interview_type);

  // Handle job description selection from both CV screening and AI interview
  const handleJobDescriptionSelect = async (jdId: string) => {
    const selectedJD = effectiveJobDescriptions.find((jd: InjectedJD) => jd.jd_id === jdId);
    if (selectedJD) {
      setSelectedTemplateId(jdId);
      const selectedTitle = selectedJD.title ?? '';
      const configured = templateHasSavedInterviewVariant(selectedJD);
      // TPO campus: keep interview mode/type from form until template row has saved variant.
      setFormData(prev => ({
        ...prev,
        position: selectedTitle,
        ...(configured
          ? {
              interviewMode:
                selectedJD.interview_mode === 'structured'
                  ? 'structured'
                  : selectedJD.interview_mode === 'ai'
                    ? 'ai'
                    : prev.interviewMode,
              interviewType:
                selectedJD.interview_type != null
                  ? normalizeInterviewTypeForForm(selectedJD.interview_type)
                  : prev.interviewType,
            }
          : {}),
      }));
      const modeForLoad = configured
        ? selectedJD.interview_mode === 'structured'
          ? 'structured'
          : selectedJD.interview_mode === 'ai'
            ? 'ai'
            : formData.interviewMode
        : formData.interviewMode;
      const typeForLoad = configured
        ? selectedJD.interview_type != null
          ? normalizeInterviewTypeForForm(selectedJD.interview_type)
          : formData.interviewType
        : formData.interviewType;
      
      // Check if this is from jd_for_interview table (has extracted_text)
      if (selectedJD.extracted_text) {
        // Use the already extracted text from jd_for_interview table
        setFormData(prev => ({ ...prev, jobDescription: selectedJD.extracted_text }));
        showJDLoadedToast(selectedTitle);
        
        // Load existing competencies for this role (if any)
        console.log('🔄 Role selection: Loading competencies for:', selectedJD.title);
        await loadCompetenciesForPosition(
          selectedTitle,
          modeForLoad,
          typeForLoad,
          selectedJD.custom_role_parameters_id || undefined
        );
        return;
      }
      
      // For CV screening JDs, check if it's a .doc file and use resolved_jd if available
      const fileExtension = selectedJD.jd_file?.split('.').pop()?.toLowerCase() || '';
      const isDocFile = fileExtension === 'doc';

      // For .doc files, try to use resolved_jd data first
      if (isDocFile) {
        try {
          console.log('📄 .doc file detected, checking for resolved_jd data...');
          
          // Get resolved_jd data using the JD file URL
          const { data: resolvedJDData, error: resolvedError } = await supabase
            .from('resolved_jd')
            .select('parameter')
            .eq('referenced_jd', selectedJD.jd_file)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!resolvedError && resolvedJDData?.parameter) {
            console.log('✅ Found resolved_jd data, converting to text...');
            
            // Convert resolved_jd attributes to plain text
            const plainText = convertResolvedJDToText(resolvedJDData.parameter);
            
            if (plainText && plainText.length > 50) { // Ensure we have meaningful text
              setFormData(prev => ({ ...prev, jobDescription: plainText }));
              showJDLoadedToast(selectedTitle);
              
          // Load existing competencies for this role (if any)
              await loadCompetenciesForPosition(
                selectedTitle,
                modeForLoad,
                typeForLoad,
                selectedJD.custom_role_parameters_id || undefined
              );
              return; // Skip file extraction
            } else {
              console.log('⚠️ Resolved JD text too short, falling back to extraction');
            }
          } else {
            console.log('⚠️ No resolved_jd found, falling back to extraction');
          }
        } catch (error) {
          console.log('⚠️ Error checking resolved_jd, falling back to extraction:', error);
          // Continue to extraction fallback below
        }
      }

      // Fallback: For non-.doc files or if resolved_jd not available, use extraction
       try {
         // Extract file path from URL if it's a full URL
         let filePath = selectedJD.jd_file;
         if (filePath.startsWith('http')) {
           // Extract path from URL: /storage/v1/object/public/job-descriptions/path/to/file.pdf
           const urlParts = filePath.split('/storage/v1/object/public/job-descriptions/');
           if (urlParts.length > 1) {
             filePath = urlParts[1];
           }
         }
         
         console.log('Downloading CV screening JD:', filePath);
         const { data: fileData, error: fileError } = await supabase.storage
           .from('job-descriptions')
           .download(filePath);

         if (fileError) {
           console.error('Storage download error:', fileError);
           throw fileError;
         }

         console.log('File downloaded successfully, size:', fileData.size);
         
         // Extract original file extension from the file path
         const originalExtension = filePath.split('.').pop()?.toLowerCase() || 'pdf';
         const fileNameWithExtension = `${selectedTitle || 'Untitled'}.${originalExtension}`;
         
         console.log('Original file extension detected:', originalExtension);
         console.log('Using filename:', fileNameWithExtension);
         
         // Send file data directly to backend without creating File object
         const formDataForUpload = new FormData();
         formDataForUpload.append('file', fileData, fileNameWithExtension);
         formDataForUpload.append('title', selectedTitle);

         console.log(`Sending ${originalExtension.toUpperCase()} file to backend for text extraction...`);
         const response = await apiCall(API_CONFIG.ENDPOINTS.EXTRACT_JD_TEXT, {
           method: 'POST',
           body: formDataForUpload,
         });

         if (response.ok) {
           const { extractedText } = await response.json();
           console.log('Text extracted successfully, length:', extractedText.length);
           setFormData(prev => ({ ...prev, jobDescription: extractedText }));
          showJDLoadedToast(selectedTitle);
           
          // Load existing competencies for this role (if any)
           await loadCompetenciesForPosition(
             selectedTitle,
             modeForLoad,
             typeForLoad,
             selectedJD.custom_role_parameters_id || undefined
           );
         } else {
           console.error('Backend extraction failed:', response.status, response.statusText);
           // Fallback to title if extraction fails
           setFormData(prev => ({ ...prev, jobDescription: selectedTitle }));
          toast.error('Failed to extract text from file', { id: 'jd-extraction-error' });
         }
       } catch (error) {
         console.error('Error loading JD file:', error);
         // Fallback to title if there's an error
         setFormData(prev => ({ ...prev, jobDescription: selectedTitle }));
        toast.error('Error loading JD: ' + (error as Error).message, { id: 'jd-load-error' });
       }
    }
  };


  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type - support PDF, DOCX, TXT (DOC not supported)
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const allowedExtensions = ['.pdf', '.docx', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        toast.error('Please upload a PDF, DOCX, or TXT file. DOC files are not supported - please convert to DOCX first.');
        return;
      }
      
      // Check file size (3MB limit)
      if (file.size > 3 * 1024 * 1024) {
        toast.error('File size must be less than 3MB');
        return;
      }
      
      setUploadedFile(file);
      
      // Extract text from PDF and upload to storage
      await extractTextAndUploadJD(file);
    }
  };

  // Extract text from PDF and upload directly to Supabase (like CV screening)
  const extractTextAndUploadJD = async (file: File) => {
    if (!formData.newRole.trim()) {
      toast.error('Please enter a new role before uploading');
      return;
    }

    console.log('🔄 Starting PDF upload and text extraction for role:', formData.newRole);
    console.log('🔄 File details:', { name: file.name, size: file.size, type: file.type });

    setIsExtractingText(true);
    setIsUploading(true);
    
    try {
      // Upload file to job-descriptions storage bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      console.log('🔄 Uploading file to storage:', fileName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-descriptions')
        .upload(fileName, file);

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      console.log('✅ File uploaded to storage successfully:', uploadData.path);

      // Extract text from PDF using the interview server
      console.log('🔄 Extracting text from PDF...');
      const formDataForExtraction = new FormData();
      formDataForExtraction.append('file', file);
      formDataForExtraction.append('title', formData.newRole);

      const response = await apiCall(API_CONFIG.ENDPOINTS.EXTRACT_JD_TEXT, {
        method: 'POST',
        body: formDataForExtraction,
      });

      console.log('🔄 Text extraction response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Text extraction failed:', errorText);
        throw new Error(`Failed to extract text from PDF: ${errorText}`);
      }

      const { extractedText } = await response.json();
      console.log('✅ Text extracted successfully, length:', extractedText.length);
      console.log('🔄 Extracted text preview:', extractedText.substring(0, 200) + '...');

      // Clean the extracted text to remove binary data corruption while preserving line breaks
      const cleanedText = extractedText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, (ch) => (ch === '\n' || ch === '\r' ? ch : '')) // Remove control chars, keep newlines
        .replace(/\\u[0-9A-Fa-f]{4}/g, '') // Remove Unicode escape sequences
        .replace(/\\n/g, '\n') // Literal \n -> real newline
        .replace(/\\r/g, '\r')
        .replace(/\\[tbf]/g, ' ') // Tab, backspace, form feed -> space
        .replace(/[^\x20-\x7E\u00A0-\u00FF\n\r]/g, '') // Remove non-printable, keep newlines
        .replace(/[&]{2,}/g, ' ') // Remove multiple ampersands
        .replace(/[0-9]{6,}/g, '') // Remove long sequences of numbers
        .replace(/[ \t]+/g, ' ') // Collapse spaces/tabs only (preserve newlines)
        .replace(/\r\n|\r/g, '\n') // Normalize line endings to \n
        .replace(/\n{3,}/g, '\n\n') // At most 2 consecutive newlines
        .trim();

      console.log('🔄 Cleaned text length:', cleanedText.length);

      const roleNameForSave = formData.newRole;

      // Save JD: TPO → campus_interview_templates API; candidate → jd_candidates; recruiter → jd_for_interview
      if (tpoCampusTemplatePersist) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_CAMPUS_INTERVIEWS), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          // Mode/type stay null until competencies are saved (matches candidate JD flow).
          body: JSON.stringify({
            title: roleNameForSave,
            position: roleNameForSave,
            jd_file: uploadData.path,
            extracted_jd_text: cleanedText,
            status: 'draft',
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || 'Failed to save campus interview template');
        }
        if (injectedLoadJobDescriptions) await injectedLoadJobDescriptions();
      } else if (candidateId) {
        console.log('🔄 Saving JD record to jd_candidates (candidate)...');
        const { data: jdData, error: jdError } = await supabase
          .from('jd_candidates')
          .insert({
            candidate_id: candidateId,
            title: roleNameForSave,
            jd_file: uploadData.path,
            extracted_text: cleanedText
          })
          .select()
          .single();
        if (jdError) {
          console.error('❌ jd_candidates insert error:', jdError);
          throw new Error(`Database insert failed: ${jdError.message}`);
        }
        console.log('✅ JD record saved to jd_candidates:', jdData);
        if (injectedLoadJobDescriptions) await injectedLoadJobDescriptions();
      } else {
        if (interviewJdLimitInfo && !interviewJdLimitInfo.canCreateJD && interviewJdLimitInfo.maxActiveJDs > 0) {
          toast.error(`You have reached your limit of ${interviewJdLimitInfo.maxActiveJDs} active interview JDs. Please disable one from Manage Interview JDs to add a new one.`);
          setIsExtractingText(false);
          setIsUploading(false);
          return;
        }
        console.log('🔄 Saving JD record to jd_for_interview (recruiter)...');
        const { data: jdData, error: jdError } = await supabase
          .from('jd_for_interview')
          .insert({
            title: roleNameForSave,
            jd_file: uploadData.path,
            extracted_text: cleanedText,
            company_id: user?.profile?.company_id
          })
          .select()
          .single();
        if (jdError) {
          console.error('❌ Database insert error:', jdError);
          throw new Error(`Database insert failed: ${jdError.message}`);
        }
        console.log('✅ JD record saved to database:', jdData);
        await loadJobDescriptions();
        await checkInterviewJDLimit();
      }
      console.log('✅ Job descriptions reloaded');
      
      // Load existing competencies for this role (if any)
      if (roleNameForSave) {
        await loadCompetenciesForPosition(roleNameForSave);
        console.log('✅ Competencies loaded for role:', roleNameForSave);
      }
      
      // Reset local form so flow matches candidate UX:
      // show success, then let user select the new role from dropdown.
      setFormData(prev => ({ ...prev, newRole: '', jobDescription: '' }));
      
      toast.success('JD uploaded and text extracted successfully!', { id: 'jd-upload-success' });
      console.log('🎉 Upload and extraction completed successfully!');
      
    } catch (error) {
      console.error('❌ Error uploading JD:', error);
      toast.error('Error uploading JD: ' + (error as Error).message, { id: 'jd-upload-error' });
    } finally {
      setIsExtractingText(false);
      setIsUploading(false);
    }
  };

  // Remove uploaded file
  const removeUploadedFile = () => {
    setUploadedFile(null);
    setFormData(prev => ({ ...prev, jobDescription: '' }));
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Support PDF, DOCX, TXT files (DOC not supported)
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const allowedExtensions = ['.pdf', '.docx', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        if (file.size <= 3 * 1024 * 1024) {
          setUploadedFile(file);
          
          // Extract text from file and upload to storage
          await extractTextAndUploadJD(file);
        } else {
          toast.error('File size must be less than 3MB');
        }
      } else {
        toast.error('Please upload a PDF, DOC, DOCX, or TXT file');
      }
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
      
      // Trigger competency loading when newRole changes and we're in AI mode
      // Only trigger if the value is substantial and user has stopped typing
      if (name === 'newRole' && formData.interviewMode === 'ai' && value.trim().length > 3) {
        // Clear any existing timeout
        if ((window as any).newRoleTimeout) {
          clearTimeout((window as any).newRoleTimeout);
        }
        // Add a delay to prevent loading while user is still typing
        (window as any).newRoleTimeout = setTimeout(() => {
          if (formData.newRole === value) { // Only load if the value hasn't changed
            loadCompetenciesForPosition(value.trim());
          }
        }, 1500);
      }
    }
  };



  const loadCompetenciesForPosition = async (
    position: string,
    modeOverride?: 'ai' | 'structured',
    typeOverride?: 'functional' | 'behavioral' | 'mixed',
    preferredCrpId?: string
  ) => {
    const modeToUse = modeOverride || formData.interviewMode;
    const typeToUse = typeOverride || formData.interviewType;
    console.log('🔍 loadCompetenciesForPosition called with:', { position, interviewMode: modeToUse, interviewType: typeToUse, isLoadingCompetencies });
    
    if (!position) {
      console.log('🔄 No position provided, clearing competencies');
      setCustomCompetencies({});
      setCompetenciesSaved(false);
      return;
    }
    
    // Only prevent if we're already loading the same position
    // Temporarily disabled to debug
    // if (isLoadingCompetencies) {
    //   console.log('🔄 Already loading competencies, skipping duplicate call for:', position);
    //   return;
    // }
    
    console.log('🔄 Starting to load competencies for:', position);
    setIsLoadingCompetencies(true);
    try {
      console.log('🔄 Loading competencies for position:', position);
      console.log('🔄 Current customCompetencies before loading:', Object.keys(customCompetencies));
      
      // Prefer template-linked CRP id for TPO flow; otherwise fallback to role/mode/type lookup.
      let query = supabase
        .from('custom_role_parameters')
        .select('custom_parameters, interview_type, interview_mode, structured_questions, personalized_questions')
        .eq('is_active', true)
        .limit(1);
      if (preferredCrpId) {
        query = query.eq('id', preferredCrpId);
      } else {
        query = query
          .eq('role_name', position)
          .eq('interview_mode', modeToUse)
          .eq('interview_type', typeToUse)
          .order('created_at', { ascending: false });
        if (crpScopePayload.parameter_pack_origin === 'company') {
          query = query.eq('parameter_pack_origin', 'company').eq('company_id', crpScopePayload.company_id as string);
        } else if (crpScopePayload.parameter_pack_origin === 'college') {
          query = query.eq('parameter_pack_origin', 'college').eq('college_id', crpScopePayload.college_id as string);
        } else {
          query = query.eq('parameter_pack_origin', 'personal').eq('user_id', (crpScopePayload.user_id as string) || '');
        }
      }
      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log('🔄 Database query result:', data);
      
      if (data && data.length > 0) {
        const record = data[0];
        const customParams = record.custom_parameters;
        const interviewType = record.interview_type || 'mixed';
        const structuredQuestions = record.structured_questions;
        const personalizedQuestions = record.personalized_questions;
        
        console.log('🔄 Found existing record:', { interviewType, hasCustomParams: !!customParams, hasStructuredQuestions: !!structuredQuestions, hasPersonalizedQuestions: !!personalizedQuestions });
        
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
        
        // Set the interview type, mode, and personalized questions
        setFormData(prev => ({ 
          ...prev, 
          interviewType: interviewType,
          interviewMode: detectedMode, // Auto-update mode based on database content
          personalizedQuestionsEnabled: !!personalizedQuestions,
          personalizedQuestions: personalizedQuestions || []
        }));
        
        // Clear opposite type's data when switching modes
        if (detectedMode === 'ai') {
          setStructuredQuestions([]);
        } else if (detectedMode === 'structured') {
          setCustomCompetencies({});
        }
        
        if (customParams && Object.keys(customParams).length > 0 && detectedMode === 'ai') {
          // Load AI interview competencies and ensure they have max_time and level values
          const competenciesWithDefaultsFromDb = Object.keys(customParams).reduce((acc, key) => {
            acc[key] = {
              ...customParams[key],
              max_time: customParams[key].max_time || 3, // Default to 3 minutes if not set
              level: customParams[key].level || 'Regular', // Default to Regular if not set
              requires_written_answer: customParams[key].requires_written_answer
            };
            return acc;
          }, {} as CustomCompetencies);
          
          console.log('🔄 Setting customCompetencies to:', competenciesWithDefaultsFromDb);
          setCustomCompetencies(competenciesWithDefaultsFromDb);
          setCompetenciesSaved(true);
          
          // Calculate duration and questions - if personalized questions exist, use the combined function
          if (personalizedQuestions && personalizedQuestions.length > 0) {
            // Use the combined function that handles both technical and personalized questions
            recalculateDurationWithPersonalizedQuestions(personalizedQuestions, competenciesWithDefaultsFromDb);
          } else {
            // Only technical questions, use the regular calculation
            calculateDuration(competenciesWithDefaultsFromDb);
          }
          
          // Only show toast if we haven't loaded this position before (silent auto-load)
          const normalizedPosition = position.trim().toLowerCase();
          console.log('🔍 Toast check:', { position, normalizedPosition, loadedPositions: Array.from(loadedPositions), hasPosition: loadedPositions.has(normalizedPosition) });
          // Removed toast - competencies load silently to avoid spam
            setLoadedPositions(prev => new Set(prev).add(normalizedPosition));
          console.log('✅ Loaded existing AI competencies for', position);
        } else if (hasValidStructuredQuestions && detectedMode === 'structured') {
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
          
          console.log('🔄 Found structured interview questions:', questionsArray.length);
          setStructuredQuestions(questionsArray);
          setCompetenciesSaved(true);
          
          // Only show toast if we haven't loaded this position before (silent auto-load)
          const normalizedPosition = position.trim().toLowerCase();
          // Removed toast - competencies load silently to avoid spam
            setLoadedPositions(prev => new Set(prev).add(normalizedPosition));
          console.log('✅ Loaded existing structured interview for', position);
        } else {
          console.log('🔄 Existing record found but no valid data, clearing state');
          setCustomCompetencies({});
          setCompetenciesSaved(false);
        }
      } else {
        // No existing competencies found, start with empty competencies
        console.log('🔄 No existing competencies found for', position, '- clearing state');
        setCustomCompetencies({});
        setCompetenciesSaved(false);
        // Removed toast - UI state is clear enough without notification
      }
    } catch (error) {
      console.error('Error loading competencies:', error);
      setCustomCompetencies({});
      setCompetenciesSaved(false);
    } finally {
      setIsLoadingCompetencies(false);
    }
  };

  const calculateDuration = (competencies: CustomCompetencies) => {
    if (!competencies || Object.keys(competencies).length === 0) {
      setFormData(prev => ({ ...prev, duration: 30, totalQuestions: 1 })); // Default fallback - minimum 1 question
      return;
    }

    let functionalQuestions = 0; // Will be calculated and rounded to whole number

    // Calculate questions per competency: (min + max) ÷ 2, then round to nearest whole number
    Object.values(competencies).forEach(comp => {
      const minQuestions = typeof comp.min_questions === 'string' ? parseFloat(comp.min_questions) : comp.min_questions;
      const maxQuestions = typeof comp.max_questions === 'string' ? parseFloat(comp.max_questions) : comp.max_questions;
      const questionsPerParam = (minQuestions + maxQuestions) / 2;
      functionalQuestions += questionsPerParam;
    });

    // Round to nearest whole number for technical questions (no decimals)
    functionalQuestions = Math.round(functionalQuestions);
    
    // Ensure minimum of 1 technical question
    functionalQuestions = Math.max(1, functionalQuestions);
    
    // Add personalized questions to total
    const personalizedQuestionsCount = formData.personalizedQuestionsEnabled ? formData.personalizedQuestions.length : 0;
    const totalQuestions = functionalQuestions + personalizedQuestionsCount;
    
    console.log('🔍 calculateDuration debug:', {
      functionalQuestions,
      personalizedQuestionsEnabled: formData.personalizedQuestionsEnabled,
      personalizedQuestions: formData.personalizedQuestions,
      personalizedQuestionsCount,
      totalQuestions,
      formDataPersonalizedQuestions: formData.personalizedQuestions
    });
    
    // Calculate duration based on answer time + reading time for each competency
    let calculatedDuration = 0;
    Object.values(competencies).forEach(param => {
      let minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      let maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      
      // Fix: Ensure question counts are reasonable (1-8 questions)
      if (isNaN(minQuestions) || minQuestions < 1 || minQuestions > 8) minQuestions = 1;
      if (isNaN(maxQuestions) || maxQuestions < 1 || maxQuestions > 8) maxQuestions = 3;
      if (maxQuestions < minQuestions) maxQuestions = minQuestions + 2;
      
      const avgQuestions = (minQuestions + maxQuestions) / 2;
      // Answer time per question (user configurable) - ensure it's a reasonable value
      let answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
      
      // Fix: Ensure answerTime is 1, 2, or 3 minutes only
      if (isNaN(answerTime) || answerTime < 1 || answerTime > 3) {
        answerTime = 3; // Default to 3 minutes if invalid
      }
      
      console.log(`🔄 Debug max_time for ${param.name}:`, { 
        original: param.max_time, 
        type: typeof param.max_time, 
        parsed: answerTime,
        isValid: !isNaN(answerTime) && answerTime >= 1 && answerTime <= 3
      });
      // Reading time per question (fixed at 30 seconds = 0.5 minutes)
      const readingTime = 0.5;
      // Total time per question = answer time + reading time
      const totalTimePerQuestion = answerTime + readingTime;
      const paramDuration = avgQuestions * totalTimePerQuestion;
      calculatedDuration += paramDuration;
      
      console.log(`🔄 Competency "${param.name}": ${avgQuestions} questions × ${totalTimePerQuestion} min = ${paramDuration} min`);
    });
    
    // Add 4 minutes buffer
    calculatedDuration += 4;
    
    // Ensure duration is within reasonable bounds (5-120 minutes) and round to whole minutes
    const finalDuration = Math.round(Math.max(5, Math.min(120, calculatedDuration)));
    
    console.log('🔄 Duration calculation summary:', {
      competencies: Object.keys(competencies).length,
      functionalQuestions,
      personalizedQuestionsCount,
      totalQuestions,
      calculatedDuration: calculatedDuration.toFixed(2),
      buffer: 4,
      finalDuration,
      breakdown: {
        answerTime: (calculatedDuration - 4).toFixed(2),
        readingTime: (functionalQuestions * 0.5).toFixed(2),
        buffer: 4
      },
      competencyDetails: Object.values(competencies).map(p => ({
          name: p.name,
        max_time: p.max_time,
        max_time_type: typeof p.max_time,
        min_questions: p.min_questions,
        max_questions: p.max_questions
      }))
    });
    
    console.log('🔄 Setting form data:', {
      previousDuration: formData.duration,
      calculatedDuration: finalDuration,
      functionalQuestions,
      personalizedQuestionsCount,
      totalQuestions
    });
    
    setFormData(prev => ({ 
      ...prev, 
      duration: finalDuration,
      totalQuestions: totalQuestions
    }));
  };

  const calculateDurationFromQuestions = (questions: number) => {
    // Calculate duration based on answer time + reading time from parameters
    let calculatedDuration = 0;
    Object.values(customCompetencies).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const avgQuestions = (minQuestions + maxQuestions) / 2;
      const answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
      const readingTime = 0.5; // 30 seconds per question
      const totalTimePerQuestion = answerTime + readingTime;
      calculatedDuration += avgQuestions * totalTimePerQuestion;
    });
    
    // Add 4 minutes buffer
    calculatedDuration += 4;
    
    const finalDuration = Math.round(Math.max(5, Math.min(120, calculatedDuration)));
    // FIXED: Replace duration instead of adding to it
    setFormData(prev => ({ ...prev, duration: finalDuration, totalQuestions: questions }));
  };

  const calculateQuestionsFromDuration = (duration: number) => {
    // Calculate questions based on answer time + reading time from parameters
    if (!customCompetencies || Object.keys(customCompetencies).length === 0) {
      // Fallback to old logic if no parameters
      const calculatedQuestions = (duration - 4) / 4;
      const finalQuestions = Math.max(1, Math.min(30, Math.round(calculatedQuestions)));
      // FIXED: Replace both duration and totalQuestions instead of just totalQuestions
      setFormData(prev => ({ ...prev, duration: duration, totalQuestions: finalQuestions }));
      return;
    }
    
    // Calculate total time needed for all parameters
    let totalTimeForAllQuestions = 0;
    Object.values(customCompetencies).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
      const readingTime = 0.5; // 30 seconds per question
      const timePerQuestion = answerTime + readingTime;
      const avgQuestions = (minQuestions + maxQuestions) / 2;
      totalTimeForAllQuestions += avgQuestions * timePerQuestion;
    });
    
    // Calculate average time per question across all parameters
    const totalQuestions = Object.values(customCompetencies).reduce((sum, param) => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      return sum + (minQuestions + maxQuestions) / 2;
    }, 0);
    
    const avgTimePerQuestion = totalTimeForAllQuestions / totalQuestions;
    const calculatedQuestions = (duration - 4) / avgTimePerQuestion;
    const finalQuestions = Math.max(1, Math.min(30, Math.round(calculatedQuestions)));
    // FIXED: Replace both duration and totalQuestions instead of just totalQuestions
    setFormData(prev => ({ ...prev, duration: duration, totalQuestions: finalQuestions }));
  };

  const generateDynamicCompetencies = async (forceFresh = false) => {
    if (!formData.position && !formData.newRole) {
      toast.error('Please select a position or enter a new role first');
      return;
    }

    if (!formData.jobDescription) {
      toast.error('Please provide a job description first');
      return;
    }

    // Check if competencies already exist - if so, warn user
    if (Object.keys(customCompetencies).length > 0) {
      const confirmGenerate = window.confirm(
        'You already have competencies set. Generating AI competencies will enhance your existing competencies with AI-generated descriptions and scoring criteria, while preserving your manual settings (timing, questions, weights). Continue?'
      );
      if (!confirmGenerate) {
        return;
      }
    }
    
    setIsLoadingCompetencies(true);
    try {
      const roleName = formData.newRole || formData.position;
      console.log('🔄 Generating dynamic competencies for role:', roleName);
      
      // First get the interview count for this role
      const countResponse = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW_COUNT}/${encodeURIComponent(roleName)}`);
      const countData = await countResponse.json();
      const interviewCount = countData.interview_count || 1;

      // Generate dynamic competencies using the backend API with JD text
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.GENERATE_DYNAMIC_PARAMETERS), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: roleName,
          job_description: formData.jobDescription,
          interview_count: interviewCount,
          interview_type: formData.interviewType,
          existing_parameters: customCompetencies // API key unchanged: existing competency config
        })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedCompetencies = data.parameters || {};
        
        // Preserve existing manual settings and only use AI for missing fields.
        // Use backend weight as-is (1-100) so total stays 100%; avoid clamping to 10-40 here.
        const competencyKeys = Object.keys(generatedCompetencies);
        const defaultWeight = competencyKeys.length > 0 ? Math.round(100 / competencyKeys.length) : 25;
        const competenciesWithDefaults = competencyKeys.reduce((acc, key) => {
          const existingComp = customCompetencies[key];
          const aiComp = generatedCompetencies[key];
          const rawWeight = existingComp?.weight ?? aiComp?.weight;
          const weight = typeof rawWeight === 'number' && rawWeight >= 1 && rawWeight <= 100 ? rawWeight : defaultWeight;

          acc[key] = {
            ...aiComp,
            // Preserve manual settings if they exist, otherwise use reasonable defaults
            max_time: existingComp?.max_time || (aiComp.max_time && aiComp.max_time >= 1 && aiComp.max_time <= 3 ? aiComp.max_time : 3),
            level: existingComp?.level || aiComp.level || 'Regular',
            min_questions: existingComp?.min_questions || (aiComp.min_questions && aiComp.min_questions >= 1 && aiComp.min_questions <= 8 ? aiComp.min_questions : 2),
            max_questions: existingComp?.max_questions || (aiComp.max_questions && aiComp.max_questions >= 1 && aiComp.max_questions <= 8 ? aiComp.max_questions : 5),
            weight,
            requires_written_answer: existingComp?.requires_written_answer ?? aiComp?.requires_written_answer
          };
          
          console.log(`🔄 Competency ${key} settings:`, {
            name: acc[key].name,
            max_time: acc[key].max_time,
            level: acc[key].level,
            min_questions: acc[key].min_questions,
            max_questions: acc[key].max_questions,
            weight: acc[key].weight
          });
          
          return acc;
        }, {} as CustomCompetencies);
        
        setCustomCompetencies(competenciesWithDefaults);
        setCompetenciesSaved(false);
        calculateDuration(competenciesWithDefaults);
        
        const method = data.cached ? 'cached' : 'fresh';
        toast.success(`Generated ${method} competencies for ${roleName} (Interview #${interviewCount})`, { id: 'params-generated' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate competencies');
      }
    } catch (error) {
      console.error('Error generating dynamic competencies:', error);
      toast.error('Failed to generate dynamic competencies', { id: 'params-generate-error' });
    } finally {
      setIsLoadingCompetencies(false);
    }
  };

  // Auto-generate and save competencies when job description is selected
  const autoGenerateAndSaveCompetencies = async (jobDescriptionText: string) => {
    const roleName = formData.newRole || formData.position;
    if (!roleName || !jobDescriptionText) {
      return;
    }

    setIsLoadingCompetencies(true);
    try {
      console.log('🔄 Auto-generating and saving competencies for role:', roleName);
      
      // First get the interview count for this role
      const countResponse = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW_COUNT}/${encodeURIComponent(roleName)}`);
      const countData = await countResponse.json();
      const interviewCount = countData.interview_count || 1;

      // Generate dynamic competencies using the backend API with JD text
      const response = await fetch('API_CONFIG.ENDPOINTS.GENERATE_DYNAMIC_PARAMETERS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: roleName,
          job_description: jobDescriptionText,
          interview_count: interviewCount
        })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedCompetenciesAuto = data.parameters || {};
        
        console.log('🔄 Received competencies from backend:', generatedCompetenciesAuto);
        console.log('🔄 Competency keys:', Object.keys(generatedCompetenciesAuto));
        Object.entries(generatedCompetenciesAuto).forEach(([key, param]) => {
          const paramObj = param as any;
          console.log(`  ${key}:`, {
            name: paramObj.name,
            min_questions: paramObj.min_questions,
            max_questions: paramObj.max_questions,
            max_time: paramObj.max_time,
            weight: paramObj.weight
          });
        });
        
        // Save competency config to custom_role_parameters (DB column name unchanged)
        const insertPayload: Record<string, unknown> = {
          role_name: roleName,
          custom_parameters: generatedCompetenciesAuto,
          interview_mode: formData.interviewMode,
          interview_type: formData.interviewType,
          parameter_pack_origin: crpScopePayload.parameter_pack_origin,
        };
        if (crpScopePayload.parameter_pack_origin === 'company') {
          insertPayload.company_id = crpScopePayload.company_id;
        } else if (crpScopePayload.parameter_pack_origin === 'college') {
          insertPayload.college_id = crpScopePayload.college_id;
        } else {
          insertPayload.user_id = crpScopePayload.user_id;
        }
        const { error: saveError } = await supabase
          .from('custom_role_parameters')
          .insert(insertPayload);

        if (saveError) {
          console.error('Error saving competencies:', saveError);
          toast.error('Failed to save competencies', { id: 'params-save-error-2' });
        } else {
          setCustomCompetencies(generatedCompetenciesAuto);
          setCompetenciesSaved(true);
          calculateDuration(generatedCompetenciesAuto);
          
          const method = data.cached ? 'cached' : 'AI-generated';
          toast.success(`Auto-generated and saved ${method} competencies for ${roleName} (Interview #${interviewCount})`, { id: 'params-auto-saved' });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate competencies');
      }
    } catch (error) {
      console.error('Error auto-generating competencies:', error);
      toast.error('Failed to auto-generate competencies', { id: 'params-auto-error' });
    } finally {
      setIsLoadingCompetencies(false);
    }
  };

  // Load job descriptions on component mount (recruiter only; candidate uses injected list)
  useEffect(() => {
    if (injectedJobDescriptions != null) return; // Candidate: no company load
    if (user?.profile?.company_id) {
      loadJobDescriptions(); // Load existing JDs from CV screening and AI interview
    }
  }, [user?.profile?.company_id, injectedJobDescriptions]);

  // Interview JD limit – fetch on mount (recruiter only) and when manage dialog opens
  useEffect(() => {
    if (injectedJobDescriptions != null || !user?.profile?.company_id) return;
    checkInterviewJDLimit();
  }, [user?.profile?.company_id, injectedJobDescriptions]);

  useEffect(() => {
    // Immediately clear competencies when position changes to prevent showing old competencies
    console.log('🔄 Position changed to:', formData.position);
    setCustomCompetencies({});
    setCompetenciesSaved(false);
    
    if (formData.position) {
      // Call loadCompetenciesForPosition directly to avoid dependency issues
      loadCompetenciesForPosition(formData.position);
    }
  }, [formData.position]);

  // Debug: Monitor customCompetencies state changes
  useEffect(() => {
    console.log('🔄 customCompetencies state changed:', Object.keys(customCompetencies).length, 'competencies');
    if (Object.keys(customCompetencies).length > 0) {
      console.log('🔄 Competency keys:', Object.keys(customCompetencies));
    }
  }, [customCompetencies]);

  // Clear data when switching interview modes
  useEffect(() => {
    console.log('🔍 Mode useEffect triggered:', { 
      interviewMode: formData.interviewMode
    });
    
    if (formData.interviewMode === 'ai') {
      // Clear structured questions when switching to AI mode
      setStructuredQuestions([]);
    } else if (formData.interviewMode === 'structured') {
      // Clear custom competencies when switching to structured mode
      setCustomCompetencies({});
    }
    
    // Clear loaded positions to allow fresh toasts for new mode
    setLoadedPositions(new Set());
  }, [formData.interviewMode]);

  // Load competencies when position/type/mode changes (AI mode)
  useEffect(() => {
    console.log('🔍 Position useEffect triggered:', { 
      position: formData.position, 
      interviewMode: formData.interviewMode 
    });
    
    if (formData.position && formData.interviewMode === 'ai') {
      console.log('🔄 Position useEffect: Loading competencies for position:', formData.position);
      loadCompetenciesForPosition(formData.position, formData.interviewMode, formData.interviewType);
    }
  }, [formData.position, formData.interviewMode, formData.interviewType]);

  useEffect(() => {
    const roleName = (formData.newRole || '').trim();
    if (roleName.length < 2) {
      setRoleNameCheckState('idle');
      setRoleNameCheckMessage('');
      return;
    }
    let cancelled = false;
    setRoleNameCheckState('checking');
    setRoleNameCheckMessage('Checking role name availability...');
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          role_name: roleName,
          interview_mode: formData.interviewMode,
          interview_type: formData.interviewType,
          parameter_pack_origin: crpScopePayload.parameter_pack_origin,
        });
        if (crpScopePayload.parameter_pack_origin === 'company' && crpScopePayload.company_id) {
          params.set('company_id', String(crpScopePayload.company_id));
        } else if (crpScopePayload.parameter_pack_origin === 'college' && crpScopePayload.college_id) {
          params.set('college_id', String(crpScopePayload.college_id));
        } else if (crpScopePayload.user_id) {
          params.set('user_id', String(crpScopePayload.user_id));
        }
        const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.CUSTOM_PARAMETERS}/check-name?${params.toString()}`));
        const data = await res.json().catch(() => ({} as { available?: boolean; error?: string }));
        if (cancelled) return;
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Check failed');
        const available = Boolean((data as { available?: boolean }).available);
        if (available) {
          setRoleNameCheckState('available');
          setRoleNameCheckMessage('Name is available for selected mode and type.');
        } else {
          setRoleNameCheckState('taken');
          setRoleNameCheckMessage('This role name is already used for selected mode and type in your workspace.');
        }
      } catch (_e) {
        if (cancelled) return;
        setRoleNameCheckState('idle');
        setRoleNameCheckMessage('');
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formData.newRole, formData.interviewMode, formData.interviewType, crpScopePayload.parameter_pack_origin, crpScopePayload.company_id, crpScopePayload.user_id]);

  const saveCompetencies = async () => {
    const roleName = formData.newRole || formData.position;
    
    if (!roleName || Object.keys(customCompetencies).length === 0) {
      toast.error('Please configure competencies before saving', { id: 'params-configure-required' });
      return;
    }

    const totalWeight = Object.values(customCompetencies).reduce((acc, p) => acc + (Number(p?.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast.error(`Total weight must equal 100%. Current total: ${totalWeight}%. Adjust competency weights so they sum to exactly 100.`, { id: 'params-weight-invalid' });
      return;
    }
    if (formData.newRole.trim() && roleNameCheckState === 'taken') {
      toast.error('This role name is already used for selected mode and type. Try a different name.', { id: 'params-role-name-taken' });
      return;
    }
    
    setIsSavingCompetencies(true);
    try {
      console.log('🔄 Saving competencies for role:', roleName, customCompetencies);
      
      // First check if competencies already exist for this role
      let existingQuery = supabase
        .from('custom_role_parameters')
        .select('id')
        .eq('role_name', roleName)
        .eq('interview_mode', formData.interviewMode)
        .eq('interview_type', formData.interviewType)
        .eq('is_active', true);
      if (crpScopePayload.parameter_pack_origin === 'company') {
        existingQuery = existingQuery.eq('parameter_pack_origin', 'company').eq('company_id', crpScopePayload.company_id as string);
      } else if (crpScopePayload.parameter_pack_origin === 'college') {
        existingQuery = existingQuery.eq('parameter_pack_origin', 'college').eq('college_id', crpScopePayload.college_id as string);
      } else {
        existingQuery = existingQuery.eq('parameter_pack_origin', 'personal').eq('user_id', (crpScopePayload.user_id as string) || '');
      }
      const { data: existingData, error: checkError } = await existingQuery.single();

      let data, error;
      
      // If existingData exists (no error), update; otherwise insert new
      if (existingData && !checkError) {
        // Update existing record
        console.log('🔄 Updating existing competencies for role:', roleName);
        const result = await supabase
          .from('custom_role_parameters')
          .update({
            custom_parameters: customCompetencies,
            interview_mode: formData.interviewMode,
            interview_type: formData.interviewType,
            structured_questions: {}, // Clear structured questions for AI interviews
            personalized_questions: formData.personalizedQuestionsEnabled ? formData.personalizedQuestions : null,
            parameter_pack_origin: crpScopePayload.parameter_pack_origin,
            company_id: crpScopePayload.parameter_pack_origin === 'company' ? crpScopePayload.company_id : null,
            college_id: crpScopePayload.parameter_pack_origin === 'college' ? crpScopePayload.college_id : null,
            user_id: crpScopePayload.parameter_pack_origin === 'personal' ? crpScopePayload.user_id : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Insert new record
        console.log('🔄 Creating new competencies for role:', roleName);
        const insertPayload: Record<string, unknown> = {
          role_name: roleName,
          custom_parameters: customCompetencies,
          interview_mode: formData.interviewMode,
          interview_type: formData.interviewType,
          structured_questions: {}, // No structured questions for AI interviews
          personalized_questions: formData.personalizedQuestionsEnabled ? formData.personalizedQuestions : null,
          is_active: true,
          parameter_pack_origin: crpScopePayload.parameter_pack_origin,
        };
        if (crpScopePayload.parameter_pack_origin === 'company') {
          insertPayload.company_id = crpScopePayload.company_id;
        } else if (crpScopePayload.parameter_pack_origin === 'college') {
          insertPayload.college_id = crpScopePayload.college_id;
        } else {
          insertPayload.user_id = crpScopePayload.user_id;
        }
        const result = await supabase
          .from('custom_role_parameters')
          .insert(insertPayload)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      setCompetenciesSaved(true);

      if (tpoCampusTemplatePersist && data?.id && selectedTemplateId) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          const patchRes = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_CAMPUS_INTERVIEWS}/${selectedTemplateId}`), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              custom_role_parameters_id: data.id,
              interview_mode: formData.interviewMode,
              interview_type: formData.interviewType,
            }),
          });
          if (!patchRes.ok) {
            console.warn('TPO template competency link failed:', await patchRes.text());
          }
        } catch (e) {
          console.warn('TPO template competency link error:', e);
        }
      } else if (tpoCampusTemplatePersist && data?.id && !selectedTemplateId) {
        toast.error('Please select a role template before saving competencies.', { id: 'tpo-template-select-required' });
      }
      
      // Don't recalculate duration after saving - keep the current duration
      // The duration should remain the same as what was calculated before saving
      
      toast.success('Competencies saved successfully!', { id: 'params-saved' });
      console.log('✅ Competencies saved/updated for role:', roleName);
    } catch (error) {
      console.error('Error saving competencies:', error);
      const message = error instanceof Error ? error.message : 'Failed to save competencies';
      toast.error(message.includes('already exists') ? message : 'Failed to save competencies', { id: 'params-save-error' });
    } finally {
      setIsSavingCompetencies(false);
    }
  };

  const addCompetency = () => {
    const newKey = `param_${Object.keys(customCompetencies).length + 1}`;
    setCustomCompetencies(prev => {
      const updated = {
        ...prev,
        [newKey]: {
          name: '',
          description: '',
          weight: 25,
          min_questions: 2,
          max_questions: 5,
          max_time: 3,
          level: 'Regular' as 'Easy' | 'Regular' | 'Expert',
          requires_written_answer: undefined,
          scoring_criteria: [
            'Excellent (9-10): Demonstrates exceptional understanding and application',
            'Good (7-8): Shows strong competency with minor areas for improvement',
            'Average (5-6): Meets basic requirements with some gaps in knowledge',
            'Below Average (1-4): Shows significant gaps and needs improvement'
          ]
        }
      };
      
      // Recalculate duration when adding new competency
      setTimeout(() => calculateDuration(updated), INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      return updated;
    });
  };

  const updateCompetency = (key: string, field: keyof CustomCompetency, value: string | number | string[] | boolean) => {
    let processedValue: string | number | string[] | boolean = value;
    if (field === 'weight' || field === 'min_questions' || field === 'max_questions') {
      const numValue = parseInt(value.toString());
      processedValue = isNaN(numValue) ? 0 : numValue;
    }
    
    setCustomCompetencies(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: processedValue
        }
      };
      
      // Recalculate duration and questions for any competency change
      setTimeout(() => calculateDuration(updated), INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      
      return updated;
    });
    setCompetenciesSaved(false);
  };

  const deleteCompetency = (key: string) => {
    setCustomCompetencies(prev => {
      const newParams = { ...prev };
      delete newParams[key];
      
      // Recalculate duration when deleting competency
      setTimeout(() => calculateDuration(newParams), INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      return newParams;
    });
    setCompetenciesSaved(false);
  };

  const resetForm = () => {
    setFormData({
      position: '',
      newRole: '',
      jobDescription: '',
      duration: 30,
      totalQuestions: 1,
      interviewType: 'mixed',
      interviewMode: 'ai',
      personalizedQuestionsEnabled: false,
      personalizedQuestions: []
    });
  };

  const recalculateDurationWithPersonalizedQuestions = (personalizedQuestions: Array<{question: string, timeLimit: number}>, competencyMap?: CustomCompetencies) => {
    // Calculate personalized questions duration
    const personalizedDuration = personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0);
    
    // Use provided map or fall back to current customCompetencies state
    const competenciesToUse = competencyMap || customCompetencies;
    
    // Get base duration from competencies (without personalized questions)
    let baseDuration = 30; // Default fallback
    if (Object.keys(competenciesToUse).length > 0) {
      let calculatedDuration = 0;
      Object.values(competenciesToUse).forEach(param => {
        const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
        const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
        const avgQuestions = (minQuestions + maxQuestions) / 2;
        const answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
        const readingTime = 0.5; // 30 seconds per question
        const totalTimePerQuestion = answerTime + readingTime;
        calculatedDuration += avgQuestions * totalTimePerQuestion;
      });
      calculatedDuration += 4; // Add buffer
      baseDuration = Math.round(Math.max(5, Math.min(120, calculatedDuration)));
    }
    
    // Total duration = base duration + personalized questions duration (whole minutes)
    const totalDuration = Math.round(baseDuration + personalizedDuration);
    
    // Calculate total questions (technical + personalized) - use same logic as calculateDuration
    let functionalQuestions = 0;
    Object.values(competenciesToUse).forEach(param => {
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
    
    console.log('🔄 Duration recalculation:', {
      personalizedQuestions: personalizedQuestions.length,
      personalizedDuration,
      baseDuration,
      totalDuration,
      functionalQuestions,
      totalQuestions,
      usingProvidedCompetencyMap: !!competencyMap
    });
    
    setFormData(prev => ({
      ...prev,
      duration: totalDuration,
      totalQuestions: totalQuestions
    }));
  };

  const saveInterviewConfiguration = async () => {
    const roleName = formData.newRole || formData.position;
    
    if (!roleName) {
      toast.error('Please select or enter a role name');
      return;
    }
    
    if (!formData.jobDescription) {
      toast.error('Please provide a job description');
      return;
    }
    
    try {
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SAVE_INTERVIEW_CONFIG), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `${roleName} Interview Configuration`,
          description: `Interview configuration for ${roleName} position`,
          duration: formData.duration != null ? Math.round(Number(formData.duration)) : formData.duration,
          difficulty: 'medium', // Default difficulty
          position: roleName,
          skills: [], // Could be extracted from job description
          custom_questions: [], // No custom questions in this component
          personalized_questions_enabled: formData.personalizedQuestionsEnabled,
          personalized_questions: formData.personalizedQuestions,
          total_duration: (formData.duration != null ? Math.round(Number(formData.duration)) : 0) + (formData.personalizedQuestionsEnabled ?
            formData.personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0) : 0),
          job_description: formData.jobDescription,
          interview_type: formData.interviewType,
          interview_mode: formData.interviewMode,
          custom_parameters: customCompetencies
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Interview configuration saved:', result);
        
        // Show success message and stay on the same page
        toast.success('Interview configuration saved successfully!', { id: 'config-saved' });
        console.log('Interview configuration saved with ID:', result.interview_id);
      } else {
        const errorData = await response.json();
        console.error('Failed to save interview configuration:', errorData);
        toast.error('Failed to save interview configuration: ' + (errorData.message || 'Unknown error'), { id: 'config-save-error' });
      }
    } catch (error) {
      console.error('Error saving interview configuration:', error);
      toast.error('Error saving interview configuration: ' + (error as Error).message, { id: 'config-error' });
    }
  };




  // Helper function to calculate total weightage
  const calculateTotalWeightage = () => {
    return Object.values(customCompetencies).reduce((total, param) => {
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

  // Function to toggle competency expansion
  const toggleCompetency = (key: string) => {
    setExpandedCompetencies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const t = setTimeout(() => onSectionReady?.(), 500);
    return () => clearTimeout(t);
  }, [onSectionReady]);

  const isCandidate = !!candidateId || tpoEmbeddedWorkflow || !!tpoCampusTemplatePersist;
  const titleClass = isCandidate ? 'text-sky-800' : 'text-primary-800';

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden">
      {/* Mobile step progress (interview workflow) */}
      <div className="lg:hidden">
        <CompactStepProgress
          current={currentStep}
          total={embeddedInterviewWorkflowSteps.length}
          steps={embeddedInterviewWorkflowSteps}
          onStepClick={navigateToStep}
          allowClickAnyStep={isCandidateFlow}
          theme={isCandidateFlow ? 'candidate' : 'default'}
        />
      </div>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${titleClass}`}>Interview Competencies Setup</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Select the role and configure the interview settings</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 rounded-full h-10 w-10" aria-label="Help">
              <HelpCircle className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto" align="end" side="bottom">
            <div className="space-y-4 text-sm">
              <h3 className="font-semibold text-base border-b pb-2">Interview Competencies – Quick Help</h3>

              {/* 1. Always start by saving a JD */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Create a new role (first time)</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Type the role name in <strong>New Role</strong> and upload the JD file.</li>
                  <li>After upload, pick that role in <strong>Select Role</strong> to see the extracted JD text.</li>
                </ol>
              </div>

              {/* 2. Explain modes and types */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Modes &amp; types</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><strong>AI Interview:</strong> AI generates questions from the JD and candidate answers.</li>
                  <li><strong>Structured Interview:</strong> You define a fixed set of questions.</li>
                  <li><strong>Functional / Behavioral / Mixed:</strong> For AI mode, choose what the AI should focus on.</li>
                </ul>
              </div>

              {/* 3. How to set up each mode */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Set up AI Interview</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Select your role in <strong>Select Role</strong>.</li>
                  <li>Choose <strong>AI Interview</strong> and an <strong>Interview Type</strong>.</li>
                  <li>Click <strong>Generate AI Competencies</strong>, adjust questions / weights (total 100%), then <strong>Save Competencies</strong>.</li>
                </ol>
                <p className="mt-1 text-gray-600">
                  Optionally turn on <strong>Personalized Questions</strong> to add a few must‑ask questions on top of the AI‑generated ones.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Set up Structured Interview</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Select your role in <strong>Select Role</strong>.</li>
                  <li>Choose <strong>Structured Interview</strong>.</li>
                  <li>Add or edit questions, sections, and timing as needed, then <strong>Save Competencies</strong>.</li>
                </ol>
                <p className="mt-1 text-gray-600">
                  You can also enable <strong>Personalized Questions</strong> here to define extra time‑boxed questions for this role.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Interview Configuration Section */}
      <Card className="animate-fade-in overflow-hidden" data-tour="setup-area">
        <CardContent className="space-y-6 pt-4 sm:pt-6 px-3 sm:px-6 pb-4 sm:pb-6">
          {/* Manage Interview JDs – recruiter only */}
          {!isCandidateFlow && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                {interviewJdLimitInfo && (
                  <p className={`text-xs font-medium ${
                    interviewJdStatusConfig === 'critical' ? 'text-red-600' :
                    interviewJdStatusConfig === 'warning' ? 'text-amber-600' :
                    interviewJdStatusConfig === 'caution' ? 'text-yellow-600' : 'text-emerald-600'
                  }`}>
                    {interviewJdStatusConfig === 'critical'
                      ? `Limit Reached: ${interviewJdLimitInfo.currentActiveJDCount}/${interviewJdLimitInfo.maxActiveJDs} active`
                      : interviewJdStatusConfig === 'warning'
                      ? `Almost Full: ${interviewJdLimitInfo.currentActiveJDCount}/${interviewJdLimitInfo.maxActiveJDs} active, ${interviewJdLimitInfo.remainingJDs} remaining`
                      : interviewJdStatusConfig === 'caution'
                      ? `Getting Full: ${interviewJdLimitInfo.currentActiveJDCount}/${interviewJdLimitInfo.maxActiveJDs} active, ${interviewJdLimitInfo.remainingJDs} remaining`
                      : `${interviewJdLimitInfo.currentActiveJDCount}/${interviewJdLimitInfo.maxActiveJDs} active, ${interviewJdLimitInfo.remainingJDs} available`}
                  </p>
                )}
              </div>
              <Dialog open={isManageInterviewSectionExpanded} onOpenChange={(open) => {
                setIsManageInterviewSectionExpanded(open);
                if (open) {
                  loadJobDescriptions();
                  loadCVJobDescriptionsForManage();
                  checkInterviewJDLimit();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
                    <Settings className="h-4 w-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">Manage Job Descriptions</span>
                    <span className="sm:hidden">Manage Jobs</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Manage Job Descriptions</DialogTitle>
                    <DialogDescription>
                      Enable or disable JDs from CV screening and Interview. Active JDs count toward your plan limit and appear in the role dropdown.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className={`rounded-lg border-2 ${currentInterviewJdStatus.border} ${currentInterviewJdStatus.bg} p-4`}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-3">
                        <div className={`p-1.5 rounded-full ${currentInterviewJdStatus.bg.replace('/40', '')} border ${currentInterviewJdStatus.border} flex-shrink-0`}>
                          <span className={`text-lg ${currentInterviewJdStatus.iconColor}`}>📋</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-gray-900">Status</h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentInterviewJdStatus.badgeBg} ${currentInterviewJdStatus.badgeText}`}>
                              {interviewJdStatusConfig === 'healthy' ? 'Available' : interviewJdStatusConfig === 'caution' ? 'Getting Full' : interviewJdStatusConfig === 'warning' ? 'Almost Full' : 'Limit Reached'}
                            </span>
                          </div>
                          {interviewJdLimitInfo && interviewJdLimitInfo.maxActiveJDs > 0 && (
                            <>
                              <div className="mt-2 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${currentInterviewJdStatus.progressColor} transition-all duration-500`}
                                  style={{ width: `${Math.min(100, (interviewJdLimitInfo.currentActiveJDCount / interviewJdLimitInfo.maxActiveJDs) * 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                <p className="text-xs text-gray-600">
                                  {interviewJdLimitInfo.currentActiveJDCount} of {interviewJdLimitInfo.maxActiveJDs} active
                                </p>
                                <p className={`text-xs font-medium ${currentInterviewJdStatus.text}`}>
                                  {currentInterviewJdStatus.message}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* CV screening JDs (job_descriptions) */}
                    {(cvJobDescriptionsForManage.length > 0) && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">CV screening JDs</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {cvJobDescriptionsForManage.map((jd) => {
                            const isActive = jd.status === 'active';
                            const isDisabled = updatingCvStatus === jd.jd_id || (!isActive && (interviewJdLimitInfo?.remainingJDs ?? 0) <= 0 && (interviewJdLimitInfo?.maxActiveJDs ?? 0) > 0);
                            return (
                              <div
                                key={jd.jd_id}
                                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg transition-colors gap-3 ${
                                  isActive ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-100'
                                } ${isDisabled ? 'opacity-70' : 'hover:shadow-sm'}`}
                              >
                                <div className="flex-1 min-w-0 w-full sm:w-auto">
                                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{jd.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Last updated: {new Date(jd.updated_at || jd.created_at || 0).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 ml-0 sm:ml-2 w-full sm:w-auto justify-between sm:justify-start">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {isActive ? 'Active' : 'Inactive'}
                                  </span>
                                  <Switch
                                    checked={isActive}
                                    onCheckedChange={() => !isDisabled && toggleCVJDStatus(jd.jd_id, jd.status)}
                                    disabled={isDisabled}
                                    className={`${isDisabled ? 'opacity-50' : ''} ${isActive ? 'data-[state=checked]:bg-green-500' : ''}`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Interview JDs (jd_for_interview) */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Interview JDs</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {interviewJobDescriptions.map((jd) => {
                          const isActive = jd.is_active;
                          const isDisabled = updatingInterviewStatus === jd.id || (!isActive && (interviewJdLimitInfo?.remainingJDs ?? 0) <= 0 && (interviewJdLimitInfo?.maxActiveJDs ?? 0) > 0);
                          return (
                            <div
                              key={jd.id}
                              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg transition-colors gap-3 ${
                                isActive ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-100'
                              } ${isDisabled ? 'opacity-70' : 'hover:shadow-sm'}`}
                            >
                              <div className="flex-1 min-w-0 w-full sm:w-auto">
                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{jd.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Last updated: {new Date(jd.updated_at || jd.created_at || 0).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 ml-0 sm:ml-2 w-full sm:w-auto justify-between sm:justify-start">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={() => !isDisabled && toggleInterviewJDStatus(jd.id, jd.is_active)}
                                  disabled={isDisabled}
                                  className={`${isDisabled ? 'opacity-50' : ''} ${isActive ? 'data-[state=checked]:bg-green-500' : ''}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {(interviewJdLimitInfo?.remainingJDs ?? 0) <= 0 && (interviewJdLimitInfo?.maxActiveJDs ?? 0) > 0 && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                        <div className="flex">
                          <span className="text-red-400 mr-2 flex-shrink-0">⚠️</span>
                          <div>
                            <h4 className="text-sm font-medium text-red-800">Active JD Limit Reached</h4>
                            <p className="text-xs text-red-700 mt-0.5">
                              You've reached your limit of {interviewJdLimitInfo.maxActiveJDs} active JDs. Deactivate one above (CV or Interview) to activate another or add a new one.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column */}
            <div className="space-y-4 min-w-0">
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Select Role *</Label>
                <Select value={selectedTemplateId} onValueChange={handleJobDescriptionSelect}>
                  <SelectTrigger className="w-full min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Select a role from existing job descriptions..." />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveJobDescriptions.map((jd: InjectedJD) => (
                      <SelectItem key={jd.jd_id} value={jd.jd_id}>
                        {jd.title ?? 'Untitled'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newRole" className="text-sm sm:text-base">New Role *</Label>
                <Input
                  id="newRole"
                  name="newRole"
                  value={formData.newRole}
                  onChange={handleInputChange}
                  placeholder="Enter new role name if creating a new position"
                  className="text-sm sm:text-base"
                />
                {roleNameCheckState !== 'idle' && (
                  <p className={`text-xs ${roleNameCheckState === 'taken' ? 'text-red-600' : roleNameCheckState === 'available' ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {roleNameCheckMessage}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interviewMode" className="text-sm sm:text-base">Interview Mode *</Label>
                <Select 
                  value={formData.interviewMode} 
                  onValueChange={(value: 'ai' | 'structured') => 
                    setFormData(prev => ({ ...prev, interviewMode: value }))
                  }
                >
                  <SelectTrigger className="w-full min-h-[44px] h-12 sm:h-14 touch-manipulation">
                    <SelectValue placeholder="Select interview mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">
                      <div className="flex items-center gap-3">
                        <span>🤖</span>
                        <div>
                          <div className="font-medium text-sm sm:text-base">AI Interview (Dynamic)</div>
                          <div className="text-xs sm:text-sm text-gray-500">Questions generated based on candidate answers</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="structured">
                      <div className="flex items-center gap-3">
                        <span>📝</span>
                        <div>
                          <div className="font-medium text-sm sm:text-base">Structured Interview (Pre-defined)</div>
                          <div className="text-xs sm:text-sm text-gray-500">HR writes custom questions and competencies</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.interviewMode === 'ai' && (
                <div className="space-y-2">
                  <Label htmlFor="interviewType" className="text-sm sm:text-base">Interview Type *</Label>
                  <Select 
                    value={formData.interviewType} 
                    onValueChange={async (value: 'functional' | 'behavioral' | 'mixed') => {
                      setFormData(prev => ({ ...prev, interviewType: value }));
                      // Load using the newly selected value (avoid stale state race)
                      if (formData.position) {
                        await loadCompetenciesForPosition(formData.position, formData.interviewMode, value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full min-h-[44px] touch-manipulation">
                      <SelectValue placeholder="Select interview type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="functional">Functional</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="mixed">Mixed (Functional + Behavioral)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}


            </div>

            {/* Right Column */}
            <div className="space-y-4">



              {/* Drag and Drop Upload Area */}
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Upload New Job Description</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
                    isDragOver 
                      ? (isCandidate ? 'border-sky-500 bg-sky-50' : 'border-primary-500 bg-primary-50')
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mb-2" />
                  <p className="text-xs sm:text-sm font-medium text-gray-900 mb-1">
                    Drop files here or click to browse (PDF, DOCX, TXT)
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Maximum file size: 3MB
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isUploading || isExtractingText}
                    className="w-full sm:w-auto"
                  >
                    {isExtractingText ? 'Extracting Text...' : isUploading ? 'Uploading...' : 'Choose File'}
                  </Button>
                </div>

                {/* Uploaded File Display */}
                {uploadedFile && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeUploadedFile}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Job Description Field */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <Label htmlFor="jobDescription" className="text-sm sm:text-base">Job Description *</Label>
                  {formData.jobDescription && (
                    <Dialog open={isExpandDialogOpen} onOpenChange={setIsExpandDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 w-full sm:w-auto"
                        >
                          <Maximize2 className="h-4 w-4" />
                          Expand
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-hidden">
                        <DialogHeader>
                          <DialogTitle className="text-lg sm:text-xl">Job Description - Full Text</DialogTitle>
                          <DialogDescription className="text-sm sm:text-base">
                            View the complete job description text that was extracted from the uploaded PDF file.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="overflow-y-auto max-h-[60vh]">
                          <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed p-3 sm:p-4 bg-gray-50 rounded-lg border">
                            {formData.jobDescription}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <Textarea
                  id="jobDescription"
                  name="jobDescription"
                  value={formData.jobDescription}
                  onChange={handleInputChange}
                  placeholder="Job description will be auto-filled when you select a role above..."
                  rows={4}
                  className="resize-none text-sm sm:text-base"
                  readOnly
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interview Summary Section */}
            {formData.position && Object.keys(customCompetencies).length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {/*<div className="w-2 h-2 bg-blue-500 rounded-full"></div>*/}
              Interview Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-sm mb-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium text-xs sm:text-sm">Total Questions</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-800">{formData.totalQuestions || 'Calculating...'}</div>
                <div className="text-xs text-blue-600">Based on competencies</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium text-xs sm:text-sm">Duration</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-800">{formData.duration != null ? Math.round(Number(formData.duration)) : 'Calculating...'} min</div>
                <div className="text-xs text-blue-600">Auto-calculated</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium text-xs sm:text-sm">Competencies</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-800">{Object.keys(customCompetencies).length}</div>
                <div className="text-xs text-blue-600">Assessment areas</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium text-xs sm:text-sm">Weightage</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-800">
                  {Object.values(customCompetencies).reduce((total, param) => total + (param.weight || 0), 0)}%
                </div>
                <div className="text-xs text-blue-600">Total weightage</div>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* Conditional Rendering based on Interview Mode */}
      {formData.interviewMode === 'ai' ? (
        <div>

        {/* AI Interview - Competencies Section */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
          {/* Always show Save Configuration button, show other buttons conditionally */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 sm:mb-6 gap-3">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {/* Show Generate button only when creating new competencies */}
              {(!competenciesSaved || Object.keys(customCompetencies).length === 0) && (
                <Button
                  onClick={() => generateDynamicCompetencies(true)} // Always force fresh generation
                  disabled={isLoadingCompetencies || !formData.position}
                  className={isCandidate ? 'flex items-center gap-2 w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white' : 'flex items-center gap-2 w-full sm:w-auto'}
                  title="Generate completely new competencies, ignoring any cached versions"
                >
                  {isLoadingCompetencies ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm sm:text-base">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      <span className="text-sm sm:text-base">Generate AI Competencies</span>
                    </>
                  )}
                </Button>
              )}
              
              {/* Show Save Competencies button only when competencies exist but not yet saved */}
              {Object.keys(customCompetencies).length > 0 && !competenciesSaved && (
                <Button
                  onClick={saveCompetencies}
                  disabled={isSavingCompetencies || Math.abs(calculateTotalWeightage() - 100) > 0.01}
                  className={isCandidate ? 'flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white w-full sm:w-auto' : 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto'}
                >
                  {isSavingCompetencies ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm sm:text-base">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span className="text-sm sm:text-base">Save Competencies</span>
                    </>
                  )}
                </Button>
              )}
              
              {/* Show "Competencies Saved" indicator and Edit button when competencies are saved */}
              {Object.keys(customCompetencies).length > 0 && competenciesSaved && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg border border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Competencies Saved</span>
                  </div>
                  <Button
                    onClick={() => setCompetenciesSaved(false)}
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400"
                  >
                    Edit Competencies
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* Show Clear button only when competencies exist */}
              {Object.keys(customCompetencies).length > 0 && (
                <Button
                  onClick={() => {
                    setCustomCompetencies({});
                    setCompetenciesSaved(false);
                    toast.success('Competencies cleared successfully!', { id: 'params-cleared' });
                  }}
                  variant="destructive"
                  className="flex items-center gap-2"
                  title="Clear all current competencies"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {Object.keys(customCompetencies).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(customCompetencies).map(([key, param], index) => {
                const isExpanded = expandedCompetencies.has(key);
                const color = getWeightageColor(index, param.weight);
                
                return (
                  <Card key={key} className="bg-gray-50">
                    <CardContent className="pt-6">
                      {competenciesSaved ? (
                        <div className="space-y-3">
                          {/* Competency header with circle bullet and percentage */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {/* Circle bullet point */}
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
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${param.weight}%`,
                                backgroundColor: color
                              }}
                            ></div>
                          </div>
                          
                          {/* View Details Link */}
                          <div className="flex items-center justify-between">
                            <div 
                              className="text-blue-600 text-xs font-medium cursor-pointer hover:text-blue-700 transition-colors"
                              onClick={() => toggleCompetency(key)}
                            >
                              {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCompetency(key)}
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="w-full">
                              <Label>Competency Name</Label>
                              <Input
                                type="text"
                                value={param.name}
                                onChange={(e) => updateCompetency(key, 'name', e.target.value)}
                                placeholder="Enter competency name..."
                                className="w-full"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCompetency(key)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    
                      {/* Expandable content - only when competencies are saved and expanded */}
                      {competenciesSaved && isExpanded && (
                        <div className="space-y-4">
                          {/* Description */}
                          <div className="w-full p-3 bg-white rounded border text-gray-700 whitespace-pre-line">
                            {param.description}
                          </div>
                          
                          {/* Competency details grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Weight (%)</Label>
                              <div className="text-base sm:text-lg font-semibold text-gray-900">
                                {param.weight}%
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Min Questions</Label>
                              <div className="text-base sm:text-lg font-semibold text-gray-900">
                                {param.min_questions}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Max Questions</Label>
                              <div className="text-base sm:text-lg font-semibold text-gray-900">
                                {param.max_questions}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm" title="Time allocated for candidate to answer (question reading time is additional)">Answer Time (minutes)</Label>
                              <div className="text-base sm:text-lg font-semibold text-gray-900">
                                {param.max_time}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Level</Label>
                              <div className="text-base sm:text-lg font-semibold text-gray-900">
                                {param.level}
                              </div>
                            </div>
                          </div>
                          
                          {/* Scoring Criteria Section */}
                          {param.scoring_criteria && Array.isArray(param.scoring_criteria) && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <Label>Scoring Criteria</Label>
                              </div>
                              <div className="space-y-2">
                                {param.scoring_criteria.map((criteria, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <div className="flex-1 text-sm text-gray-700 bg-white p-2 rounded border">
                                      {criteria}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Editable content - only when competencies are not saved */}
                      {!competenciesSaved && (
                        <div className="space-y-4">
                          <div className="w-full mb-4">
                            <Label>Description</Label>
                            <Textarea
                              value={param.description}
                              onChange={(e) => updateCompetency(key, 'description', e.target.value)}
                              placeholder="Enter competency description in bullet points..."
                              rows={4}
                              className="resize-none"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs sm:text-sm">Weight (%)</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={param.weight}
                                onChange={(e) => updateCompetency(key, 'weight', e.target.value)}
                                className="text-sm sm:text-base"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Min Questions</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={param.min_questions}
                                onChange={(e) => updateCompetency(key, 'min_questions', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Questions</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={param.max_questions}
                                onChange={(e) => updateCompetency(key, 'max_questions', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label title="Time allocated for candidate to answer (question reading time is additional)">Answer Time (minutes)</Label>
                              <Input
                                type="number"
                                min="1"
                                max={param.requires_written_answer ? 5 : 3}
                                value={param.max_time}
                                onChange={(e) => {
                                const maxAllowed = param.requires_written_answer ? 5 : 3;
                                const raw = e.target.value === '' ? maxAllowed : parseInt(e.target.value, 10);
                                const clamped = isNaN(raw) ? 3 : Math.min(maxAllowed, Math.max(1, raw));
                                updateCompetency(key, 'max_time', clamped);
                              }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Level</Label>
                              <Select
                                value={param.level || 'Regular'}
                                onValueChange={(value: 'Easy' | 'Regular' | 'Expert') => updateCompetency(key, 'level', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Easy">Easy</SelectItem>
                                  <SelectItem value="Regular">Regular</SelectItem>
                                  <SelectItem value="Expert">Expert</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                              <Checkbox
                                id={`${key}-requires-written`}
                                checked={param.requires_written_answer === true}
                                onCheckedChange={(checked) => {
                                  updateCompetency(key, 'requires_written_answer', checked === true);
                                  const currentMax = typeof param.max_time === 'number' ? param.max_time : (parseInt(String(param.max_time), 10) || 3);
                                  if (checked === true) {
                                    // Remember current max_time so we can restore it when unchecking
                                    setWrittenAnswerPrevMaxTime(prev => ({ ...prev, [key]: currentMax }));
                                    // When enabling written answer, allow up to 5 min (speaking + writing takes more time)
                                    const suggested = 5;
                                    if (currentMax < suggested) {
                                      updateCompetency(key, 'max_time', suggested);
                                    }
                                  } else {
                                    // When unchecking, revert to the value before we checked (capped at 3 for speaking only)
                                    const restoreMax = Math.min(3, writtenAnswerPrevMaxTime[key] ?? 3);
                                    updateCompetency(key, 'max_time', restoreMax);
                                    setWrittenAnswerPrevMaxTime(prev => {
                                      const next = { ...prev };
                                      delete next[key];
                                      return next;
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`${key}-requires-written`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Requires written answer (e.g. SQL/code)
                              </Label>
                            </div>
                          </div>
                          
                          {/* Scoring Criteria Section */}
                          {param.scoring_criteria && Array.isArray(param.scoring_criteria) && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <Label>Scoring Criteria</Label>
                                <Button
                                  onClick={() => {
                                    const newCriteria = [...param.scoring_criteria, ''];
                                    updateCompetency(key, 'scoring_criteria', newCriteria);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Criteria
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {param.scoring_criteria.map((criteria, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      value={criteria}
                                      onChange={(e) => {
                                        const newCriteria = [...param.scoring_criteria];
                                        newCriteria[index] = e.target.value;
                                        updateCompetency(key, 'scoring_criteria', newCriteria);
                                      }}
                                      placeholder={`Criteria ${index + 1}`}
                                      className="flex-1 text-sm"
                                    />
                                    {param.scoring_criteria.length > 1 && (
                                      <Button
                                        onClick={() => {
                                          const newCriteria = param.scoring_criteria.filter((_, i) => i !== index);
                                          updateCompetency(key, 'scoring_criteria', newCriteria);
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-700 p-1"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Add Competency button - only when competencies are not saved */}
              {!competenciesSaved && (
                <Button
                  variant="outline"
                  onClick={addCompetency}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Competency
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
            <div className="text-center py-8">
              <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No assessment competencies configured yet.</p>
              <p className="text-gray-400">Select a position and generate AI competencies to get started.</p>
            </div>
                    
          <Button
            variant="outline"
            onClick={addCompetency}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Competency
          </Button>
            </div>
          )}

          {/* Personalized Questions Section - Only for AI Interviews */}
          {formData.interviewMode === 'ai' && (
            <div className="space-y-4">
              {/* Visual Separator */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-bold">👤</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Personalized Questions (Optional)</h3>
                </div>
                
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="personalizedQuestionsEnabled"
                      checked={formData.personalizedQuestionsEnabled}
                      onChange={(e) => {
                        if (competenciesSaved) return; // Prevent changes when saved
                        const enabled = e.target.checked;
                        setFormData(prev => {
                          const newQuestions = enabled ? prev.personalizedQuestions : [];
                          return { 
                            ...prev, 
                            personalizedQuestionsEnabled: enabled,
                            personalizedQuestions: newQuestions
                          };
                        });
                        
                        // Recalculate duration when enabling/disabling personalized questions
                        if (enabled) {
                          recalculateDurationWithPersonalizedQuestions(formData.personalizedQuestions);
                        } else {
                          recalculateDurationWithPersonalizedQuestions([]);
                        }
                      }}
                      disabled={competenciesSaved}
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                        competenciesSaved ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <Label htmlFor="personalizedQuestionsEnabled" className={`text-sm font-medium text-blue-800 ${
                      competenciesSaved ? 'opacity-50' : ''
                    }`}>
                      Enable Personalized Questions
                    </Label>
                  </div>
                  
                  {formData.personalizedQuestionsEnabled && (
                    <div className="space-y-3">
                      <p className="text-xs text-blue-600">
                        Add 1-2 personal questions that will be asked before functional questions. These are for review only and won't be scored.
                      </p>
                      
                      {formData.personalizedQuestions.map((question, index) => (
                        <div key={index} className="space-y-2 p-3 bg-white rounded border">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-700">
                              Question {index + 1}
                            </Label>
                            {!competenciesSaved && formData.personalizedQuestions.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newQuestions = formData.personalizedQuestions.filter((_, i) => i !== index);
                                  setFormData(prev => ({ ...prev, personalizedQuestions: newQuestions }));
                                  // Recalculate duration when removing a question
                                  recalculateDurationWithPersonalizedQuestions(newQuestions);
                                }}
                                className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {competenciesSaved ? (
                            <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                              {question.question}
                            </div>
                          ) : (
                            <Textarea
                              value={question.question}
                              onChange={(e) => {
                                const newQuestions = [...formData.personalizedQuestions];
                                newQuestions[index].question = e.target.value;
                                setFormData(prev => ({ ...prev, personalizedQuestions: newQuestions }));
                                // Recalculate duration when changing question text (though time doesn't change)
                                recalculateDurationWithPersonalizedQuestions(newQuestions);
                              }}
                              placeholder="Enter your personal question here..."
                              rows={2}
                              className="resize-none"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-600">Time Limit (minutes):</Label>
                            {competenciesSaved ? (
                              <div className="text-sm font-semibold text-gray-900">
                                {question.timeLimit}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min="1"
                                max="3"
                                value={question.timeLimit}
                                onChange={(e) => {
                                  const newQuestions = [...formData.personalizedQuestions];
                                  const raw = parseInt(e.target.value, 10);
                                  const clamped = isNaN(raw) ? 3 : Math.min(3, Math.max(1, raw));
                                  newQuestions[index].timeLimit = clamped;
                                  setFormData(prev => ({ ...prev, personalizedQuestions: newQuestions }));
                                  // Recalculate duration when changing time limit
                                  recalculateDurationWithPersonalizedQuestions(newQuestions);
                                }}
                                className="w-20 h-8 text-sm"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {!competenciesSaved && formData.personalizedQuestions.length < 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newQuestion = { question: '', timeLimit: 3 };
                            const newQuestions = [...formData.personalizedQuestions, newQuestion];
                            setFormData(prev => ({
                              ...prev,
                              personalizedQuestions: newQuestions
                            }));
                            // Recalculate duration when adding a question
                            recalculateDurationWithPersonalizedQuestions(newQuestions);
                          }}
                          className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Personal Question
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


        </CardContent>
      </Card>

        </div>
      ) : (
        /* Structured Interview Section */
        <StructuredInterviewSetup
          position={formData.position || formData.newRole}
          existingQuestions={structuredQuestions}
          onSave={async (questions, duration) => {
            try {
              const roleName = formData.newRole || formData.position;
              if (!roleName) {
                toast.error('Please select or enter a role name', { id: 'role-name-required' });
                return;
              }

              const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STRUCTURED_INTERVIEW}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  role_name: roleName,
                  questions: questions,
                  duration: duration,
                  interview_mode: 'structured',
                  interview_type: formData.interviewType,
                  ...crpScopePayload
                })
              });

              if (response.ok) {
                const data = await response.json();
                toast.success(`Structured interview saved successfully! ${data.questions_count} questions, ${data.duration} minutes`, { id: 'structured-saved' });
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save structured interview');
              }
            } catch (error) {
              console.error('Error saving structured interview:', error);
              toast.error('Failed to save structured interview: ' + (error as Error).message, { id: 'structured-save-error' });
            }
          }}
        />
      )}

      </div>
    </div>
  );
};

export default HRInterviewCreator;
