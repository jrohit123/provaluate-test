import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Edit, RefreshCw, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from '@/integrations/supabase/db';
import { useAuth } from '@/hooks/use-auth';
import { useSession } from '@/contexts/SessionContext';
import { UsageTrackingService } from '@/services/usageTrackingService';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

interface ResolvedJD {
  attributes?: {
    [key: string]: any;
  };
  attributes_summary?: string;
  //ai_provider?: string;
  //analysis_timestamp?: string;
  //status?: string;
  //original_length?: number;
  //cleaned_length?: number;
  //jd_file_url?: string;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.txt'];
// Backend service URLs for integration - Uses environment variables
const BACKEND_URLS = {
  UNIFIED_SERVICE: import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com',      // app.py - unified backend service
  AI_ANALYZER_SERVICE: import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com',  // jd_analyzer.py - handles AI analysis (using same URL)
  CV_ANALYZER_SERVICE: import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com',  // cv_analyzer.py - handles CV analysis (using same URL)
  RESUME_SERVICE: import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com',       // app.py - handles uploads
};

// Legacy webhook URL (kept for compatibility)
//const JD_WEBHOOK_URL = "https://automations.aitamate.com/webhook/61646fe6-09c4-4276-aeb0-3fd7bb6b367e";
export const JobUploadSection = () => {
  const { user, loading, error } = useAuth();
  const { currentJobDescription, setCurrentJobDescription } = useSession();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>(() => {
    // Initialize from sessionStorage first
    const stored = sessionStorage.getItem('selectedJDId');
    if (stored) return stored;
    // Then try to get from SessionContext
    return '';
  });
  const [selectedJDContent, setSelectedJDContent] = useState<string>('');
  const [selectedJDFileType, setSelectedJDFileType] = useState<string>('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobTitleInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [resolvedJD, setResolvedJD] = useState<ResolvedJD | null>(null);
  const [isEditingResolvedJD, setIsEditingResolvedJD] = useState(false);
  const [resolvedJDId, setResolvedJDId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isWaitingForResolvedJD, setIsWaitingForResolvedJD] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [jdLimitInfo, setJdLimitInfo] = useState<{
    canCreateJD: boolean;
    currentActiveJDCount: number;
    maxActiveJDs: number;
    remainingJDs: number;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [isManageSectionExpanded, setIsManageSectionExpanded] = useState(false);

  // Get JD status configuration based on usage
  const getJDStatusConfig = (jdLimitInfo: any) => {
    if (!jdLimitInfo) return 'healthy';
    
    const { remainingJDs, maxActiveJDs, currentActiveJDCount } = jdLimitInfo;
    const usagePercentage = (currentActiveJDCount / maxActiveJDs) * 100;
    
    if (remainingJDs === 0) return 'critical';
    if (remainingJDs <= 2 || usagePercentage >= 90) return 'warning';
    if (remainingJDs <= 5 || usagePercentage >= 70) return 'caution';
    return 'healthy';
  };
  
  const statusConfig = jdLimitInfo ? getJDStatusConfig(jdLimitInfo) : 'healthy';
  
  // Status configuration mapping
  const statusMap = {
    healthy: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/40',
      text: 'text-emerald-800',
      icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      progressColor: 'bg-emerald-500',
      message: `${jdLimitInfo?.remainingJDs} slots available`
    },
    caution: {
      border: 'border-yellow-200',
      bg: 'bg-yellow-50/40',
      text: 'text-yellow-800',
      icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 13.5h.008v.008H12v-.008z',
      iconColor: 'text-yellow-500',
      badgeBg: 'bg-yellow-100',
      badgeText: 'text-yellow-800',
      progressColor: 'bg-yellow-500',
      message: `${jdLimitInfo?.remainingJDs} slots remaining`
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-amber-50/40',
      text: 'text-amber-800',
      icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
      iconColor: 'text-amber-500',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      progressColor: 'bg-amber-500',
      message: `Only ${jdLimitInfo?.remainingJDs} slot${jdLimitInfo?.remainingJDs !== 1 ? 's' : ''} remaining`
    },
    critical: {
      border: 'border-red-200',
      bg: 'bg-red-50/40',
      text: 'text-red-800',
      icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
      iconColor: 'text-red-500',
      badgeBg: 'bg-red-100',
      badgeText: 'text-red-800',
      progressColor: 'bg-red-500',
      message: 'You must disable a JD to create new ones'
    }
  };
  
  const currentStatus = statusMap[statusConfig as keyof typeof statusMap] || statusMap.healthy;


  // Auto-refresh functions
  const startAutoRefresh = (jdId: string) => {
    setIsWaitingForResolvedJD(true);
    
    // Clear any existing interval
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    // Set up auto-refresh every 15 seconds for up to 5 minutes
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts × 15 seconds = 5 minutes
    
    const interval = setInterval(async () => {
      attempts++;
      console.log(`Auto-refresh attempt ${attempts}/${maxAttempts} for JD: ${jdId}`);
      
      try {
        // Check if resolved JD exists
        const { data: jdData, error: jdError } = await supabase
          .from('job_descriptions')
          .select('jd_file')
          .eq('jd_id', jdId)
          .single();

        if (jdError || !jdData?.jd_file) {
          if (attempts >= maxAttempts) {
            stopAutoRefresh();
          }
          return;
        }

        // Fetch multiple records and filter in JavaScript to avoid URL encoding issues
        const { data, error } = await supabase
          .from('resolved_jd')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        // Filter in JavaScript to find the matching record
        const matchingData = data?.find(item => item.referenced_jd === jdData.jd_file);
        
        if (matchingData) {
          // Found resolved JD data
          setResolvedJD(matchingData.parameter);
          setResolvedJDId(matchingData.resolved_jd_id);
          stopAutoRefresh();
          
          // Refresh the job descriptions dropdown in case the title was updated during processing
          loadJobDescriptions();
          
          toast({
            title: "Resolved JD Data Updated",
            description: "Job description has been processed and analyzed.",
          });
        } else if (attempts >= maxAttempts) {
          // Max attempts reached, stop trying
          stopAutoRefresh();
          toast({
            title: "Processing Taking Longer",
            description: "JD processing is taking longer than expected. You can manually refresh or try again later.",
            variant: "default",
          });
        }
      } catch (error) {
        console.error('Auto-refresh error:', error);
        if (attempts >= maxAttempts) {
          stopAutoRefresh();
        }
      }
    }, 15000); // 15 seconds
    
    setAutoRefreshInterval(interval);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
    setIsWaitingForResolvedJD(false);
  };

  const handleManualRefresh = async () => {
    if (!selectedJobDescriptionId) {
      toast({
        title: "No Job Description Selected",
        description: "Please select a job description first.",
        variant: "destructive",
      });
      return;
    }
    
    await loadResolvedJD(selectedJobDescriptionId);
    // loadResolvedJD already calls loadJobDescriptions() when data is found
    toast({
      title: "Refreshed",
      description: "Checked for updated resolved JD data.",
    });
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

  // Additional cleanup on unmount to ensure auto-refresh is stopped
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, []); // Empty dependency array to ensure cleanup only runs on unmount

  useEffect(() => {
    console.log('JobUploadSection - User state:', { user, loading, error });
    console.log('User object details:', user);
    if (user?.id) {
      loadJobDescriptions();
      checkJDLimit();
    }
  }, [user, loading, error]);

  // Sync selectedJobDescriptionId from SessionContext when it changes
  useEffect(() => {
    if (currentJobDescription) {
      // currentJobDescription can have either 'id' or 'jd_id' property
      const jdId = currentJobDescription.id || currentJobDescription.jd_id;
      if (jdId && jdId !== selectedJobDescriptionId) {
        console.log('🔄 Syncing JD from SessionContext:', jdId);
        setSelectedJobDescriptionId(jdId);
        sessionStorage.setItem('selectedJDId', jdId);
      }
    }
  }, [currentJobDescription]);

  // Also sync from sessionStorage on mount (fallback)
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedJDId');
    if (stored && stored !== selectedJobDescriptionId && !currentJobDescription) {
      setSelectedJobDescriptionId(stored);
    }
  }, []); // Only on mount

  // Load resolved JD when a JD is selected
  useEffect(() => {
    console.log('Selected JD ID changed:', selectedJobDescriptionId);
    if (selectedJobDescriptionId) {
      loadResolvedJD(selectedJobDescriptionId);
    } else {
      setResolvedJD(null);
      setResolvedJDId(null);
    }
  }, [selectedJobDescriptionId]);

  useEffect(() => {
    if (selectedJobDescriptionId && jobDescriptions.length > 0) {
      const jd = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
      if (jd && jd.jd_file) {
        const ext = jd.jd_file.split('.').pop().toLowerCase();
        setSelectedJDFileType(ext);
        if (ext === 'pdf') {
          setSelectedJDContent(jd.jd_file); // store URL for PDF
        } else {
          fetch(jd.jd_file)
            .then(async (res) => {
              const contentType = res.headers.get('Content-Type') || '';
              if (contentType.includes('text') || jd.jd_file.endsWith('.txt')) {
                return res.text();
              } else if (jd.jd_file.endsWith('.doc') || jd.jd_file.endsWith('.docx')) {
                return '[Preview not available for DOC/DOCX files]';
              } else {
                return '[Preview not available for this file type]';
              }
            })
            .then(setSelectedJDContent)
            .catch(() => setSelectedJDContent('[Unable to load file content]'));
        }
      } else {
        setSelectedJDContent('');
      }
    } else {
      setSelectedJDContent('');
    }
  }, [selectedJobDescriptionId, jobDescriptions]);


  const loadJobDescriptions = async () => {
    if (!user?.profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, jd_file, created_at, status')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const jobDescriptions = data || [];
      setJobDescriptions(jobDescriptions);
      
    } catch (error) {
      toast({
        title: 'Error Loading Job Descriptions',
        description: 'Failed to load job descriptions from the database.',
        variant: 'destructive',
      });
    }
  };

  const checkJDLimit = async () => {
    if (!user?.profile?.company_id) return;
    
    try {
      const limitInfo = await UsageTrackingService.checkJDProcessingLimit(user.profile.company_id);
      setJdLimitInfo(limitInfo);
    } catch (error) {
      console.error('Error checking JD limit:', error);
    }
  };

  const toggleJDStatus = async (jdId: string, currentStatus: string) => {
    if (!user?.profile?.company_id) return;
    
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    
    // If enabling, check if limit allows it
    if (newStatus === 'active') {
      const limitInfo = await UsageTrackingService.checkJDProcessingLimit(user.profile.company_id);
      if (!limitInfo.canCreateJD && limitInfo.maxActiveJDs > 0) {
        toast({
          title: "Cannot Enable JD",
          description: `You have reached your plan limit of ${limitInfo.maxActiveJDs} active job descriptions. Please disable another JD first.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setUpdatingStatus(jdId);
    
    try {
      const { error } = await supabase
        .from('job_descriptions')
        .update({ status: newStatus })
        .eq('jd_id', jdId);
      
      if (error) throw error;
      
      toast({
        title: `JD ${newStatus === 'active' ? 'Enabled' : 'Disabled'}`,
        description: `Job description has been ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully.`,
      });
      
      // Refresh lists
      await loadJobDescriptions();
      await checkJDLimit();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update JD status.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const loadResolvedJD = async (jdId: string) => {
    try {
      console.log('🔍 loadResolvedJD called with jdId:', jdId);
      
      // First get the JD file URL from job_descriptions table
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .select('jd_file')
        .eq('jd_id', jdId)
        .single();

      console.log('📄 JD Data from database:', jdData);
      console.log('❌ JD Error:', jdError);

      if (jdError || !jdData?.jd_file) {
        console.log('❌ No JD file found for ID:', jdId);
        setResolvedJD(null);
        setResolvedJDId(null);
        return;
      }

      console.log('🔗 Looking for resolved JD with file URL:', jdData.jd_file);

      // Then look up resolved JD by file URL - fetch multiple and filter in JS
      const { data, error } = await supabase
        .from('resolved_jd')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Increased limit to get more records
      
      console.log('📊 All resolved_jd records:', data);
      console.log('❌ Resolved JD Error:', error);
      
      // Debug: Show all referenced_jd values
      if (data) {
        console.log('🔍 All referenced_jd values:');
        data.forEach((item, index) => {
          console.log(`  ${index}: ${item.referenced_jd}`);
          console.log(`    - ID: ${item.resolved_jd_id}`);
          console.log(`    - Created: ${item.created_at}`);
        });
      }
      
      // Try exact match first
      let matchingData = data?.find(item => item.referenced_jd === jdData.jd_file);
      
      // If no exact match, try filename matching
      if (!matchingData && data) {
        const fileName = jdData.jd_file.split('/').pop(); // Get filename from URL
        console.log('🔍 Looking for filename:', fileName);
        
        matchingData = data?.find(item => {
          const itemFileName = item.referenced_jd?.split('/').pop();
          console.log(`  Comparing: "${itemFileName}" with "${fileName}"`);
          return itemFileName === fileName;
        });
      }
      
      // If still no match, try a direct database query for this specific file
      if (!matchingData) {
        console.log('🔍 Trying direct database query for specific file...');
        const { data: specificData, error: specificError } = await supabase
          .from('resolved_jd')
          .select('*')
          .eq('referenced_jd', jdData.jd_file)
          .limit(1);
        
        if (specificData && specificData.length > 0) {
          matchingData = specificData[0];
          console.log('✅ Found via direct query:', matchingData);
        } else {
          console.log('❌ No match found via direct query');
        }
      }
      
      console.log('🎯 Matching resolved JD data:', matchingData);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading resolved JD:', error);
        throw error;
      }

      if (matchingData) {
        console.log('✅ Found resolved JD, setting state...');
        console.log('📄 Parameter data:', matchingData.parameter);
        setResolvedJD(matchingData.parameter); // parameter field contains the JSON data
        setResolvedJDId(matchingData.resolved_jd_id);
        console.log('✅ Loaded resolved JD:', matchingData);
        // Stop auto-refresh if it's running since we found the data
        stopAutoRefresh();
        
        // Refresh the job descriptions dropdown to ensure it's up to date
        loadJobDescriptions();
      } else {
        console.log('❌ No resolved JD found for file URL:', jdData.jd_file);
        setResolvedJD(null);
        setResolvedJDId(null);
        
        // Start auto-refresh to wait for resolved JD data
        startAutoRefresh(jdId);
      }
    } catch (error) {
      console.error('❌ Error loading resolved JD:', error);
      // Don't show toast for missing resolved JD, it's normal
    }
  };

  const updateResolvedJD = async () => {
    if (!resolvedJDId || !resolvedJD || !user?.id) {
      toast({
        title: "Update Error",
        description: "Cannot update resolved JD. Missing required data.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('resolved_jd')
        .update({
          parameter: resolvedJD,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('resolved_jd_id', resolvedJDId);

      if (error) throw error;

      toast({
        title: "Resolved JD Updated",
        description: "Your changes have been saved successfully.",
      });

      setIsEditingResolvedJD(false);
    } catch (error: any) {
      console.error('Error updating resolved JD:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update resolved JD.",
        variant: "destructive",
      });
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 3MB limit';
    }
    
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(extension)) {
      //return 'Invalid file type. Please upload PDF, DOC, or DOCX files';
      return 'Invalid file type. Please upload PDF files';
    }
    
    return null;
  };



  const handleJobDescriptionUpload = () => {
    toast({
      title: "Job Description Uploaded",
      description: "Your job description has been processed successfully.",
    });
  };


  // Drag and drop handlers for job description
  const handleJobDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      // setJobTitle('');
      // setIsJobFieldsDisabled(true); // Removed as per edit hint
    }
  };
  const handleJobDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleJobDescriptionClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
      // setJobTitle('');
      // setIsJobFieldsDisabled(true); // Removed as per edit hint
    }
  };


  const handleProcessJobDescription = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to process job descriptions.",
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

    if (!jobTitle.trim()) {
      toast({
        title: "Job Title Required",
        description: "Please enter a job title before processing the job description.",
        variant: "destructive",
      });
      jobTitleInputRef.current?.focus();
      return;
    }

    if (!uploadedFile) {
      toast({
        title: "File Required",
        description: "Please select a job description file before processing.",
        variant: "destructive",
      });
      return;
    }

    // Check JD limit before processing
    if (jdLimitInfo && !jdLimitInfo.canCreateJD) {
      toast({
        title: "JD Limit Reached",
        description: `You have reached your plan limit of ${jdLimitInfo.maxActiveJDs} active job descriptions. Please disable an existing JD to upload a new one.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingStatus('processing');

      // Process through AI Analyzer service directly (complete workflow)
      try {
        console.log('Processing job description through AI Analyzer service...');

        // Create FormData for the complete upload workflow
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('title', jobTitle);
        formData.append('user_id', user.id);
        formData.append('company_id', user.profile.company_id);

        console.log('Sending complete workflow request to AI Analyzer...');
        console.log('Backend URL:', `${BACKEND_URLS.UNIFIED_SERVICE}/upload`);
        console.log('FormData contents:', Array.from(formData.entries()));
        
        // Test backend connectivity first
        try {
          const healthCheck = await fetch(`${BACKEND_URLS.UNIFIED_SERVICE}/health`);
          console.log('Backend health check status:', healthCheck.status);
          if (healthCheck.ok) {
            const healthData = await healthCheck.json();
            console.log('Backend health data:', healthData);
          }
        } catch (healthError) {
          console.error('Backend health check failed:', healthError);
          throw new Error(`Cannot connect to backend: ${healthError.message}`);
        }
        
        let response;
        try {
          response = await fetch(`${BACKEND_URLS.UNIFIED_SERVICE}/upload`, {
            method: 'POST',
            body: formData,
          });
          
          console.log('Response status:', response.status);
          console.log('Response headers:', response.headers);
        } catch (fetchError) {
          console.error('Fetch error details:', fetchError);
          console.error('Error name:', fetchError.name);
          console.error('Error message:', fetchError.message);
          console.error('Error stack:', fetchError.stack);
          throw new Error(`Network error: ${fetchError.message}`);
        }

        if (!response.ok) {
          throw new Error(`Upload workflow failed: ${await response.text()}`);
        }

        const result = await response.json();
        console.log('🎯 AI Analyzer complete workflow result:', result);
        console.log('🎯 Result jd_id:', result.jd_id);
        console.log('🎯 Result analysis:', result.analysis);
        
        // Update the JD ID with the one returned from the AI Analyzer
        if (result.jd_id) {
          console.log('✅ Setting selectedJobDescriptionId to:', result.jd_id);
          setSelectedJobDescriptionId(result.jd_id);
          sessionStorage.setItem('selectedJDId', result.jd_id);
        } else {
          console.log('❌ No jd_id in result');
        }
        
        // Wait a moment then reload resolved JD from database
        setTimeout(() => {
          console.log('⏰ Timeout triggered, calling loadResolvedJD with:', result.jd_id);
          loadResolvedJD(result.jd_id);
        }, 2000); // Wait 2 seconds for backend to save to database
        
        // Start auto-refresh to check for resolved JD data every 15 seconds
        startAutoRefresh(result.jd_id);

        setProcessingStatus('completed');
        
        toast({
          title: "Upload & Analysis Completed",
          description: "Job description uploaded, analyzed, and saved successfully.",
        });

        // Refresh the job descriptions dropdown to show the newly added JD
        await loadJobDescriptions();
        await checkJDLimit();

        // Reset form after a short delay to show success message
        setTimeout(() => {
          setJobTitle('');
          setUploadedFile(null);
          setProcessingStatus('idle');
        }, 2000); // Show success for 2 seconds before resetting
      } catch (backendError) {
        console.error('AI Analyzer service error:', backendError);
        setProcessingStatus('failed');
        toast({
          title: "Processing Error",
          description: "Failed to process job description. Please try again.",
          variant: "destructive",
        });
        
        // Reset to idle after showing error for a bit
        setTimeout(() => {
          setProcessingStatus('idle');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Error processing job description:', err);
      setProcessingStatus('failed');
      toast({
        title: "Error Saving Job Description",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
      
      // Reset to idle after showing error
      setTimeout(() => {
        setProcessingStatus('idle');
      }, 3000);
    }
  };



  // When a JD is selected from dropdown, automatically set in session
  const handleJDSelect = (jdId: string) => {
    setSelectedJobDescriptionId(jdId);
    sessionStorage.setItem('selectedJDId', jdId);
    // Stop any existing auto-refresh when switching to a different JD
    stopAutoRefresh();
    
    // Automatically set in session context
    const selectedJD = jobDescriptions.find(jd => jd.jd_id === jdId);
    if (selectedJD) {
      setCurrentJobDescription({
        id: selectedJD.jd_id,
        title: selectedJD.title,
        file: selectedJD.jd_file
      });
      
      toast({
        title: "Job Description Selected",
        description: `"${selectedJD.title}" set for current session`
      });
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  return (
    <div className="p-6 space-y-6">
      

      {/* Job Description Upload */}
      <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Job Description
            </CardTitle>
            <CardDescription>
              Upload your job description file OR select an existing one from the dropdown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Select Job Description */}
            <div className="mb-3">
              <div className="rounded-lg border border-primary-200 bg-primary-50/40 p-4">
                <label className="mb-2 block text-sm font-medium text-primary-700">
                  Select an existing job description
                </label>
                <Select value={selectedJobDescriptionId} onValueChange={handleJDSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose job description" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobDescriptions.map(jd => (
                      <SelectItem key={jd.jd_id} value={jd.jd_id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{jd.title}</span>
                          <span className={`ml-2 text-xs ${jd.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                            {jd.status === 'active' ? '● Active' : '○ Disabled'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Manage Job Descriptions */}
            {jobDescriptions.length > 0 && (
              <div className={`mb-3 rounded-lg border-2 ${currentStatus.border} ${currentStatus.bg} transition-all duration-200 shadow-sm hover:shadow-md`}>
                <button
                  onClick={() => setIsManageSectionExpanded(!isManageSectionExpanded)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors rounded-t-md ${isManageSectionExpanded ? 'border-b border-gray-200' : ''}`}
                >
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${currentStatus.bg.replace('/40', '')} border ${currentStatus.border} shadow-inner`}>
                        <svg className={`h-5 w-5 ${currentStatus.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentStatus.icon} />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Manage Job Descriptions
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentStatus.badgeBg} ${currentStatus.badgeText}`}>
                            {statusConfig === 'healthy' ? 'Available' : 
                             statusConfig === 'caution' ? 'Getting Full' :
                             statusConfig === 'warning' ? 'Almost Full' : 'Limit Reached'}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        {jdLimitInfo && (
                          <div className="mt-2 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${currentStatus.progressColor} transition-all duration-500`}
                              style={{
                                width: `${Math.min(100, (jdLimitInfo.currentActiveJDCount / jdLimitInfo.maxActiveJDs) * 100)}%`
                              }}
                            ></div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-xs text-gray-600">
                            {jdLimitInfo ? (
                              <>{jdLimitInfo.currentActiveJDCount} of {jdLimitInfo.maxActiveJDs} active</>
                            ) : null}
                          </p>
                          <p className={`text-xs font-medium ${currentStatus.text}`}>
                            {currentStatus.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <svg 
                    className={`h-5 w-5 text-gray-400 transform transition-transform ${
                      isManageSectionExpanded ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isManageSectionExpanded && (
                  <div className="px-4 py-3 bg-white/50">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {jobDescriptions.map(jd => {
                        const isActive = jd.status === 'active';
                        const isDisabled = updatingStatus === jd.jd_id || 
                          (!isActive && jdLimitInfo?.remainingJDs === 0);
                          
                        return (
                        <div 
                          key={jd.jd_id} 
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            isActive ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-100'
                          } ${isDisabled ? 'opacity-70' : 'hover:shadow-sm'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {jd.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Last updated: {new Date(jd.updated_at || jd.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 ml-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                            <Switch
                              checked={isActive}
                              onCheckedChange={() => !isDisabled && toggleJDStatus(jd.jd_id, jd.status || 'active')}
                              disabled={isDisabled}
                              className={`${isDisabled ? 'opacity-50' : ''} ${
                                isActive ? 'data-[state=checked]:bg-green-500' : ''
                              }`}
                            />
                          </div>
                        </div>
                      )})}
                    </div>
                    
                    {jdLimitInfo?.remainingJDs === 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100">
                        <div className="flex">
                          <svg className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <h4 className="text-sm font-medium text-red-800">Active Job Description Limit Reached</h4>
                            <p className="text-xs text-red-700 mt-0.5">
                              You've reached your limit of {jdLimitInfo.maxActiveJDs} active job descriptions. 
                              Please deactivate another JD to activate a new one.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-4 my-6 text-sm font-medium text-[#1e5da8]">
              <span className="flex-1 h-px bg-[#1e5da8]/30" />
              <span>OR</span>
              <span className="flex-1 h-px bg-[#1e5da8]/30" />
            </div>

            <div className="rounded-lg border border-primary-200 bg-primary-50/40 p-4">
              <label className="mb-2 block text-sm font-medium text-primary-700">
                Create a new job description
              </label>
              <Input
                type="text"
                placeholder="Job Title (e.g., Senior Software Engineer)"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mb-0"
                ref={jobTitleInputRef}
              />
            </div>

            {/* Job Description Content Preview */}
            {/*
            {selectedJDContent && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Job Description Content Preview</label>
                {selectedJDFileType === 'pdf' ? (
                  <div className="border rounded bg-gray-100 p-2 flex flex-col items-center">
                    <Document
                      file={selectedJDContent}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={<span>Loading PDF...</span>}
                      error={<span>Failed to load PDF.</span>}
                    >
                      <Page pageNumber={pageNumber} width={400} />
                    </Document>
                    <div className="flex gap-2 mt-2 items-center">
                      <button
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                      >Prev</button>
                      <span className="text-xs">Page {pageNumber} of {numPages}</span>
                      <button
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                      >Next</button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    className="w-full min-h-32 p-2 border rounded bg-gray-100 text-xs"
                    value={selectedJDContent}
                    readOnly
                  />
                )}
              </div>
            )}
            */}

            <div 
              className="rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/40 p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onClick={handleJobDescriptionClick}
              onDrop={handleJobDrop}
              onDragOver={handleJobDragOver}
            >
              <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop files here or click to browse (PDF, DOC, DOCX, TXT)
              </p>
              {uploadedFile && (
                <div className="mt-2 text-xs text-primary-700">Selected file: {uploadedFile.name}</div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="space-y-2">
              <Button 
                onClick={handleProcessJobDescription} 
                className="w-full"
                disabled={processingStatus === 'processing' || (jdLimitInfo && !jdLimitInfo.canCreateJD)}
              >
                {processingStatus === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Job Description...
                  </>
                ) : (
                  'Process Job Description'
                )}
              </Button>
              
              {/* Show limit info */}
              {jdLimitInfo && (
                <div className="text-sm text-gray-600 mt-2">
                  {jdLimitInfo.maxActiveJDs === 0 ? (
                    <span className="text-green-600">Unlimited active job descriptions</span>
                  ) : (
                    <span className={jdLimitInfo.remainingJDs <= 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {jdLimitInfo.currentActiveJDCount} / {jdLimitInfo.maxActiveJDs} active JDs
                      {jdLimitInfo.remainingJDs > 0 && ` (${jdLimitInfo.remainingJDs} remaining)`}
                      {jdLimitInfo.remainingJDs <= 0 && ' - Limit reached'}
                    </span>
                  )}
                </div>
              )}
              
              {/* Show refresh button and auto-refresh status */}
              {selectedJobDescriptionId && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    className="flex-1"
                    disabled={processingStatus === 'processing'}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Show Resolved JD Data
                  </Button>
                  
                  {isWaitingForResolvedJD && (
                    <div className="flex items-center text-xs text-blue-600">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Resolving JD...
                    </div>
                  )}
                </div>
              )}
            </div>

            {resolvedJD && !isEditingResolvedJD && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-left">Resolved Job Description</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingResolvedJD(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
                

                
                <div className="space-y-2 text-sm text-left">
                  {/* Display detailed attributes in the format you want */}
                  {resolvedJD.attributes && Object.entries(resolvedJD.attributes).map(([key, value]) => (
                    <div key={`detailed-${key}`} className="flex flex-col space-y-1">
                      <span className="font-medium capitalize text-left">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <div className="text-left pl-2">
                        {typeof value === 'object' && value !== null ? 
                          Object.entries(value).map(([subKey, subValue]) => (
                            <div key={subKey} className="ml-2 mb-1">
                              <span className="font-medium text-gray-700 capitalize">{subKey}:</span>
                              {Array.isArray(subValue) ? (
                                <div className="ml-2 text-sm">
                                  {subValue.join(', ')}
                                </div>
                              ) : (
                                <span className="ml-2 text-sm">{String(subValue)}</span>
                              )}
                            </div>
                          )) : 
                          <span className="text-sm">{String(value) || 'N/A'}</span>
                        }
                      </div>
                    </div>
                  ))}
                  
                  {/* Display attributes_summary if available */}
                  {resolvedJD.attributes_summary && (
                    <div className="flex flex-col space-y-1">
                      <span className="font-medium text-left">Attributes Summary:</span>
                      <span className="text-left pl-2 text-xs">
                        {resolvedJD.attributes_summary}
                      </span>
                    </div>
                  )}
                  

                </div>
              </div>
            )}

            {resolvedJD && isEditingResolvedJD && (
              <div className="mt-4 space-y-3">
                <h4 className="font-semibold">Edit Resolved Information</h4>
                {resolvedJD.attributes && Object.entries(resolvedJD.attributes).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {typeof value === 'object' && value !== null ? (
                      <div className="space-y-2">
                        {Object.entries(value).map(([subKey, subValue]) => (
                          <div key={subKey} className="space-y-1">
                            <label className="text-xs font-medium text-gray-600 capitalize">
                              {subKey}:
                            </label>
                            <Textarea
                              value={Array.isArray(subValue) ? subValue.join(', ') : String(subValue) || ''}
                              onChange={(e) => {
                                const newValue = Array.isArray(subValue) 
                                  ? e.target.value.split(',').map(item => item.trim()).filter(item => item)
                                  : e.target.value;
                                
                                setResolvedJD(prev => ({
                                  ...prev!,
                                  attributes: {
                                    ...prev!.attributes,
                                    [key]: {
                                      ...(prev!.attributes![key] as any),
                                      [subKey]: newValue
                                    }
                                  }
                                }));
                              }}
                              className="min-h-[40px] text-sm"
                              placeholder={`Enter ${subKey}...`}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Textarea
                        value={String(value) || ''}
                        onChange={(e) => 
                          setResolvedJD(prev => ({
                            ...prev!,
                            attributes: {
                              ...prev!.attributes,
                              [key]: e.target.value
                            }
                          }))
                        }
                        className="min-h-[60px]"
                        placeholder={`Enter ${key.replace(/_/g, ' ')}...`}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    onClick={updateResolvedJD}
                    className="flex-1"
                  >
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => setIsEditingResolvedJD(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

    </div>
  );
};