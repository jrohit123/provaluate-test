import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Grid, Save, Plus, Trash2, Download, Edit, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from '@/integrations/supabase/db';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

interface CriteriaItem {
  id: string;
  parameter: string;
  weightage: number;
  notes: string;
}

interface ResolvedJD {
  preferred_city?: string;
  mandatory_city?: string;
  preferred_age?: string;
  mandatory_age?: string;
  preferred_gender?: string;
  mandatory_gender?: string;
  educational_qualification?: string;
  job_history?: string;
  technical_skills?: string;
  functional_skills?: string;
  soft_skills?: string;
}

interface SavedCriteriaGrid {
  id: string;
  name: string;
  criteria: CriteriaItem[];
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx'];
//const JD_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook-test/61646fe6-09c4-4276-aeb0-3fd7bb6b367e";
//const JD_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook/61646fe6-09c4-4276-aeb0-3fd7bb6b367e";
const JD_WEBHOOK_URL = "https://automations.aitamate.com/webhook/61646fe6-09c4-4276-aeb0-3fd7bb6b367e";
export const JobUploadSection = () => {
  const { user, loading, error } = useAuth();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>(() => sessionStorage.getItem('selectedJDId') || '');
  const [selectedJDContent, setSelectedJDContent] = useState<string>('');
  const [selectedJDFileType, setSelectedJDFileType] = useState<string>('');
  const [criteriaData, setCriteriaData] = useState<CriteriaItem[]>([
    { id: '1', parameter: 'Technical Skills', weightage: 30, notes: 'Check the relevant experience in the given programming languages, frameworks, tools' },
    { id: '2', parameter: 'Experience Level', weightage: 25, notes: 'Years of relevant experience' },
    { id: '3', parameter: 'Education', weightage: 15, notes: 'Degree relevance and institution' },
    { id: '4', parameter: 'Soft Skills', weightage: 20, notes: 'Communication, leadership, teamwork' },
    { id: '5', parameter: 'Stability', weightage: 10, notes: 'Calculate the Stability Score based on the average years spent in each of the previous companies.' }
  ]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const criteriaFileInputRef = useRef<HTMLInputElement>(null);
  const jobTitleInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [criteriaUploading, setCriteriaUploading] = useState(false);
  const [resolvedJD, setResolvedJD] = useState<ResolvedJD | null>(null);
  const [isEditingResolvedJD, setIsEditingResolvedJD] = useState(false);
  const [resolvedJDId, setResolvedJDId] = useState<string | null>(null);
  const [savedGrids, setSavedGrids] = useState<SavedCriteriaGrid[]>([]);
  const [selectedGridId, setSelectedGridId] = useState<string>(() => sessionStorage.getItem('selectedCriteriaGridId') || '');
  const [gridName, setGridName] = useState('');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isWaitingForResolvedJD, setIsWaitingForResolvedJD] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const totalPercentage = criteriaData.reduce((sum, item) => sum + item.weightage, 0);
  const isValidTotal = totalPercentage === 0 || totalPercentage === 100;

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

        const { data, error } = await supabase
          .from('resolved_jd')
          .select('*')
          .eq('referenced_jd', jdData.jd_file)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data) {
          // Found resolved JD data
          setResolvedJD(data.parameter);
          setResolvedJDId(data.resolved_jd_id);
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

  useEffect(() => {
    console.log('JobUploadSection - User state:', { user, loading, error });
    console.log('User object details:', user);
    if (user?.id) {
      loadSavedGrids();
      loadJobDescriptions();
    }
  }, [user, loading, error]);

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

  const loadSavedGrids = async () => {
    if (!user?.id) return;

    try {
      console.log('Loading saved grids for user:', user.id);
      
      // Get unique criteria grids by criteria_name with their grid JSON data and criteria_id
      const { data: grids, error } = await supabase
        .from('criteria')
        .select('criteria_id, criteria_name, grid, created_at')
        .eq('created_by', user.id)
        .eq('company_id', user.profile?.company_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching grids:', error);
        throw error;
      }

      console.log('Fetched grids:', grids);
      
      if (!grids || grids.length === 0) {
        console.log('No grids found');
        setSavedGrids([]);
        return;
      }

      // Get unique grids by criteria_name (latest entry for each name)
      const uniqueGrids = grids.reduce((acc: { [key: string]: any }, curr) => {
        if (!acc[curr.criteria_name] || new Date(curr.created_at) > new Date(acc[curr.criteria_name].created_at)) {
          acc[curr.criteria_name] = curr;
        }
        return acc;
      }, {});

      console.log('Unique grids:', uniqueGrids);

      // Convert to SavedCriteriaGrid format using grid JSON data
      const formattedGrids: SavedCriteriaGrid[] = Object.values(uniqueGrids).map((grid: any) => {
        let criteria: CriteriaItem[] = [];
        
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

      console.log('Formatted grids:', formattedGrids);
      setSavedGrids(formattedGrids);
    } catch (error) {
      console.error('Error loading saved grids:', error);
      toast({
        title: "Error Loading Grids",
        description: "Failed to load saved evaluation criteria.",
        variant: "destructive"
      });
    }
  };

  const loadJobDescriptions = async () => {
    if (!user?.profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, jd_file, created_at')
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const jobDescriptions = data || [];
      setJobDescriptions(jobDescriptions);
      
      // Validate selectedJobDescriptionId against loaded job descriptions
      // Clear it if it doesn't exist for this user (prevents stale sessionStorage data)
      if (selectedJobDescriptionId && jobDescriptions.length > 0) {
        const isValidSelection = jobDescriptions.some(jd => jd.jd_id === selectedJobDescriptionId);
        if (!isValidSelection) {
          console.log('Clearing invalid selectedJobDescriptionId from sessionStorage:', selectedJobDescriptionId);
          setSelectedJobDescriptionId('');
          sessionStorage.removeItem('selectedJDId');
          // This will trigger the useEffect to clear resolvedJD
        }
      } else if (selectedJobDescriptionId && jobDescriptions.length === 0) {
        // No job descriptions exist for this user, clear any stale selection
        console.log('Clearing selectedJobDescriptionId - no job descriptions found for this user');
        setSelectedJobDescriptionId('');
        sessionStorage.removeItem('selectedJDId');
      }
    } catch (error) {
      toast({
        title: 'Error Loading Job Descriptions',
        description: 'Failed to load job descriptions from the database.',
        variant: 'destructive',
      });
    }
  };

  const loadResolvedJD = async (jdId: string) => {
    try {
      // First get the JD file URL from job_descriptions table
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .select('jd_file')
        .eq('jd_id', jdId)
        .single();

      if (jdError || !jdData?.jd_file) {
        console.log('No JD file found for ID:', jdId);
        setResolvedJD(null);
        setResolvedJDId(null);
        return;
      }

      // Then look up resolved JD by file URL
      const { data, error } = await supabase
        .from('resolved_jd')
        .select('*')
        .eq('referenced_jd', jdData.jd_file)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading resolved JD:', error);
        throw error;
      }

      if (data) {
        setResolvedJD(data.parameter); // parameter field contains the JSON data
        setResolvedJDId(data.resolved_jd_id);
        console.log('Loaded resolved JD:', data);
        // Stop auto-refresh if it's running since we found the data
        stopAutoRefresh();
        
        // Refresh the job descriptions dropdown to ensure it's up to date
        loadJobDescriptions();
      } else {
        console.log('No resolved JD found for file URL:', jdData.jd_file);
        setResolvedJD(null);
        setResolvedJDId(null);
      }
    } catch (error) {
      console.error('Error loading resolved JD:', error);
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
      return 'Invalid file type. Please upload PDF, DOC, or DOCX files';
    }
    
    return null;
  };

  const handleFileUpload = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "File Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setProcessingStatus('processing');
    try {
      // Upload to Supabase Storage
      const filePath = `jd-files/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-descriptions')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('job-descriptions')
        .getPublicUrl(filePath);

      // Call JD Processing Webhook with GET request (n8n expects GET)
      const webhookParams = {
        file_url: publicUrlData.publicUrl,
        title: jobTitle || 'Untitled Job',
        action: 'process_jd',
        timestamp: new Date().toISOString()
      };

      console.log('handleFileUpload - Webhook parameters:', webhookParams);
      console.log('handleFileUpload - File URL being sent:', publicUrlData.publicUrl);

      const params = new URLSearchParams(webhookParams);
      const fullWebhookUrl = `${JD_WEBHOOK_URL}?${params.toString()}`;
      
      console.log('handleFileUpload - Final webhook URL:', fullWebhookUrl);
      console.log('handleFileUpload - Query parameters:', params.toString());
      
      const response = await fetch(fullWebhookUrl, {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Failed to process JD');

      // Webhook successful, but we'll load resolved JD from database instead
      setProcessingStatus('completed');

      toast({
        title: "Job Description Processed",
        description: "JD has been analyzed. Please review the extracted information.",
      });
    } catch (error: any) {
      setProcessingStatus('failed');
      toast({
        title: "Processing Failed",
        description: error.message || "An error occurred while processing the JD.",
        variant: "destructive",
      });
    }
  };

  const handleJobDescriptionUpload = () => {
    toast({
      title: "Job Description Uploaded",
      description: "Your job description has been processed successfully.",
    });
  };

  const handleCriteriaUpload = async () => {
    if (!isValidTotal) {
      toast({
        title: "Invalid Criteria Weightage",
        description: "Total percentage must be either 0% (no criteria) or 100%.",
        variant: "destructive",
      });
      return;
    }
    try {
      // Save each criteria item to the database
      await Promise.all(
        criteriaData.map(item =>
          DatabaseService.createCriteria({
            criteria_name: item.parameter,
            parameter: item.parameter,
            weightage: item.weightage,
            calc_note: item.notes,
            // Add other fields as needed (created_by, company_id, etc.)
          })
        )
      );
      toast({
        title: "Evaluation Criteria Saved",
        description: "Your evaluation criteria has been saved and is ready to use.",
      });
    } catch (err: any) {
      toast({
        title: "Error Saving Evaluation Criteria",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
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

  // Drag and drop handlers for criteria
  const handleCriteriaDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleCriteriaFile(e.dataTransfer.files[0]);
    }
  };
  const handleCriteriaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleCriteriaClick = () => {
    criteriaFileInputRef.current?.click();
  };
  const handleCriteriaFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleCriteriaFile(files[0]);
    }
  };
  const handleCriteriaFile = async (file: File) => {
    setCriteriaUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Expecting header row: [Parameter, Weightage, Notes]
      if (
        json.length < 2 ||
        !json[0] ||
        json[0][0]?.toString().toLowerCase().includes('parameter') === false
      ) {
        throw new Error('Excel sheet must have a header row: Parameter, Weightage, Notes');
      }
      const newCriteria: CriteriaItem[] = json.slice(1).map((row, idx) => ({
        id: Date.now().toString() + idx,
        parameter: row[0] || '',
        weightage: Number(row[1]) || 0,
        notes: row[2] || '',
      }));
      if (newCriteria.length === 0) throw new Error('No criteria found in Excel sheet.');
      setCriteriaData(newCriteria);
      toast({
        title: 'Criteria Grid Updated',
        description: 'Evaluation criteria loaded from Excel.',
      });
    } catch (err: any) {
      toast({
        title: 'Error Parsing Excel',
        description: err.message || 'Check the Excel sheet and re-upload.',
        variant: 'destructive',
      });
    } finally {
      setCriteriaUploading(false);
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

    try {
      setProcessingStatus('processing');
      let fileUrl = null;
      let jdData = null;

      // First, create the job description record
      const { data: createdJD, error: jdError } = await supabase
        .from('job_descriptions')
        .insert({
          title: jobTitle, // Ensure jobTitle is saved
          user_id: user.id,
          company_id: user.profile.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (jdError) {
        console.error('DB error:', jdError);
        throw jdError;
      }

      jdData = createdJD;
      // Store the new JD ID in sessionStorage
      setSelectedJobDescriptionId(jdData.jd_id);
      sessionStorage.setItem('selectedJDId', jdData.jd_id);

      // Then handle file upload if present
      if (uploadedFile) {
        const timestamp = Date.now();
        const safeFileName = uploadedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${user.profile.company_id}/${jdData.jd_id}/${timestamp}_${safeFileName}`;
        
        console.log('Attempting to upload file:', {
          fileName: safeFileName,
          filePath,
          fileSize: uploadedFile.size,
          fileType: uploadedFile.type,
          userId: user.id,
          companyId: user.profile.company_id
        });

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('job-descriptions')
          .upload(filePath, uploadedFile, {
            cacheControl: '3600',
            contentType: uploadedFile.type
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Don't throw here, we'll still have the JD without the file
          toast({
            title: "File Upload Warning",
            description: "Job description saved but file upload failed. Please try uploading the file again.",
            variant: "default",
          });
        } else if (uploadData?.path) {
          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('job-descriptions')
            .getPublicUrl(uploadData.path);
          
          fileUrl = publicUrlData.publicUrl;
          console.log(fileUrl);

          // Update the job description with the file URL and title (in case it needs to be updated)
          const { error: updateError } = await supabase
            .from('job_descriptions')
            .update({ jd_file: fileUrl, title: jobTitle })
            .eq('jd_id', jdData.jd_id);

          if (updateError) {
            console.error('Error updating JD with file URL:', updateError);
          }

          // Process through webhook
          try {
            const webhookPayload = {
              file_url: fileUrl,
              title: jobTitle,
              jd_id: jdData.jd_id,
              user_id: user.id,
              company_id: user.profile.company_id
            };

            console.log('Sending webhook payload (GET):', webhookPayload);
            console.log('File URL being sent:', fileUrl);

            // Build query string - ensure all values are strings
            const stringPayload: Record<string, string> = {};
            Object.entries(webhookPayload).forEach(([key, value]) => {
              if (value !== null && value !== undefined) {
                stringPayload[key] = String(value);
              }
            });

            const params = new URLSearchParams(stringPayload);
            const webhookUrlWithParams = `${JD_WEBHOOK_URL}?${params.toString()}`;
            
            console.log('Final webhook URL:', webhookUrlWithParams);
            console.log('Query parameters:', params.toString());

            const response = await fetch(webhookUrlWithParams, {
              method: 'GET',
            });

            if (!response.ok) {
              console.error('Webhook error:', await response.text());
              toast({
                title: "Processing Warning",
                description: "Job description saved but processing failed. The file will be processed later.",
                variant: "default",
              });
            } else {
              // Webhook was successful, wait a moment then reload resolved JD from database
              setTimeout(() => {
                loadResolvedJD(jdData.jd_id);
              }, 2000); // Wait 2 seconds for n8n to process and save to database
              
              // Start auto-refresh to check for resolved JD data every 15 seconds
              startAutoRefresh(jdData.jd_id);
            }
          } catch (webhookError) {
            console.error('Webhook error:', webhookError);
            toast({
              title: "Processing Warning",
              description: "Job description saved but processing failed. The file will be processed later.",
              variant: "default",
            });
            
            // Even if webhook fails, start auto-refresh in case N8N processes it later
            startAutoRefresh(jdData.jd_id);
          }
        }
      }

      setProcessingStatus('completed');
      toast({
        title: "Job Description Saved",
        description: fileUrl 
          ? "Job description and file saved successfully."
          : "Job description saved successfully.",
      });

      // Refresh the job descriptions dropdown to show the newly added JD
      await loadJobDescriptions();

      // Reset form
      setJobTitle('');
      setUploadedFile(null);
      // setIsJobFieldsDisabled(false); // Removed as per edit hint
    } catch (err: any) {
      console.error('Error processing job description:', err);
      setProcessingStatus('failed');
      toast({
        title: "Error Saving Job Description",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  const updateCriteria = (id: string, field: keyof CriteriaItem, value: string | number) => {
    setCriteriaData(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addCriteria = () => {
    const newCriteria: CriteriaItem = {
      id: Date.now().toString(),
      parameter: 'New Parameter',
      weightage: 0,
      notes: 'Add description here'
    };
    setCriteriaData(prev => [...prev, newCriteria]);
  };

  const deleteCriteria = (id: string) => {
    setCriteriaData(prev => prev.filter(item => item.id !== id));
  };

  const handleDownloadTemplate = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create sample data
    const sampleData = [
      ['Parameter', 'Weightage', 'Notes'],
      ['Technical Skills', 30, 'Check the relevant experience in the given Programming languages, frameworks, tools'],
      ['Experience Level', 25, 'Years of relevant experience in similar roles'],
      ['Education', 15, 'Degree relevance and institution quality'],
      ['Soft Skills', 20, 'Communication, leadership, teamwork abilities'],
      ['Stability', 10, 'Calculate the Stability Score based on the average years spent in each of the previous companies.']
    ];
    
    // Convert to worksheet
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluation Criteria');
    
    // Generate and download file
    XLSX.writeFile(wb, 'evaluation-criteria-template.xlsx');
    
    toast({
      title: "Template Downloaded",
      description: "Sample evaluation criteria template has been downloaded.",
    });
  };

  const handleSaveCriteria = async () => {
    if (!gridName) {
      toast({
        title: "Name Required",
        description: "Please provide a name for this criteria grid.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to save criteria grids.",
        variant: "destructive",
      });
      return;
    }

    if (!user.profile) {
      toast({
        title: "Profile Error",
        description: "Your user profile is not properly set up. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(user.id) || !UUID_REGEX.test(user.profile.company_id)) {
      toast({
        title: "Invalid ID Format",
        description: "User or company ID is not in the correct format. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Saving criteria with data:', {
        user_id: user.id,
        company_id: user.profile.company_id,
        gridName,
        criteriaData
      });

      // Only save parameter, weightage, calc_note in the grid JSON
      const grid = criteriaData.map(item => ({
        parameter: item.parameter,
        weightage: item.weightage,
        calc_note: item.notes
      }));

      const { data, error } = await supabase
        .from('criteria')
        .insert({
          criteria_name: gridName,
          grid,
          created_by: user.id,
          company_id: user.profile.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('criteria_id')
        .single();
      if (error) {
        console.error('Error saving criteria:', error);
        throw error;
      }
      console.log('Save result:', data);

      toast({
        title: "Criteria Grid Saved",
        description: "Your evaluation criteria has been saved successfully.",
      });

      setGridName('');
      await loadSavedGrids();
      // Store the new grid's criteria_id in sessionStorage
      if (data?.criteria_id) {
        setSelectedGridId(data.criteria_id);
        sessionStorage.setItem('selectedCriteriaGridId', data.criteria_id);
      }
    } catch (err: any) {
      console.error('Error saving grid:', err);
      toast({
        title: "Error Saving Grid",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleGridSelect = async (gridId: string) => {
    setSelectedGridId(gridId);
    sessionStorage.setItem('selectedCriteriaGridId', gridId);
    const selected = savedGrids.find(grid => grid.id === gridId);
    if (selected) {
      setCriteriaData(selected.criteria);
    }
  };

  // When a JD is selected from dropdown, store in sessionStorage
  const handleJDSelect = (jdId: string) => {
    setSelectedJobDescriptionId(jdId);
    sessionStorage.setItem('selectedJDId', jdId);
    // Stop any existing auto-refresh when switching to a different JD
    stopAutoRefresh();
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Job Description & Criteria Setup</h2>
        <p className="text-muted-foreground">Upload your job description and configure evaluation criteria</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
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

            {/* Dropdown to select existing Job Description */}
            <div className="mb-3">
              <Select value={selectedJobDescriptionId} onValueChange={handleJDSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select existing Job Description..." />
                </SelectTrigger>
                <SelectContent>
                  {jobDescriptions.map(jd => (
                    <SelectItem key={jd.jd_id} value={jd.jd_id}>
                      {jd.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                type="text"
                placeholder="Job Title (e.g., Senior Software Engineer)"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mb-3"
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
              className="border-2 border-dashed border-primary-200 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onClick={handleJobDescriptionClick}
              onDrop={handleJobDrop}
              onDragOver={handleJobDragOver}
            >
              <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop PDF/DOC files here or click to browse
              </p>
              {uploadedFile && (
                <div className="mt-2 text-xs text-primary-700">Selected file: {uploadedFile.name}</div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="space-y-2">
              <Button onClick={handleProcessJobDescription} className="w-full">
                Process Job Description
              </Button>
              
              {/* Show refresh button and auto-refresh status */}
              {selectedJobDescriptionId && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    className="flex-1"
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
                  {Object.entries(resolvedJD).map(([key, value]) => (
                    <div key={key} className="flex flex-col space-y-1">
                      <span className="font-medium capitalize text-left">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-left pl-2">{String(value) || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resolvedJD && isEditingResolvedJD && (
              <div className="mt-4 space-y-3">
                <h4 className="font-semibold">Edit Resolved Information</h4>
                {Object.entries(resolvedJD).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <Textarea
                      value={String(value) || ''}
                      onChange={(e) => 
                        setResolvedJD(prev => ({
                          ...prev!,
                          [key]: e.target.value
                        }))
                      }
                      className="min-h-[60px]"
                    />
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

        {/* Criteria Grid */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary-600" />
                Evaluation Criteria
              </div>
              <Select value={selectedGridId} onValueChange={handleGridSelect}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Load saved grid..." />
                </SelectTrigger>
                <SelectContent>
                  {savedGrids.map(grid => (
                    <SelectItem key={grid.id} value={grid.id}>
                      {grid.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
            <CardDescription>
              Configure your evaluation parameters and weights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {criteriaData.map((criteria) => (
                <div key={criteria.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Input
                      value={criteria.parameter}
                      onChange={(e) => updateCriteria(criteria.id, 'parameter', e.target.value)}
                      className="font-medium text-sm bg-transparent border-none p-0 h-auto focus:bg-white focus:border focus:px-2 focus:py-1"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <Input
                          type="number"
                          value={criteria.weightage}
                          onChange={(e) => updateCriteria(criteria.id, 'weightage', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-xs text-center bg-primary-100 border-primary-200"
                          min="0"
                          max="100"
                        />
                        <span className="text-xs font-medium text-primary-800 ml-1">%</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCriteria(criteria.id)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={criteria.notes}
                    onChange={(e) => updateCriteria(criteria.id, 'notes', e.target.value)}
                    className="text-xs text-muted-foreground bg-transparent border-none p-0 h-auto focus:bg-white focus:border focus:px-2 focus:py-1"
                    placeholder="Add description..."
                  />
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={addCriteria}
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Parameter
            </Button>

            <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
              <span className="font-medium text-sm">Total Weightage:</span>
              <span className={`font-bold text-sm ${isValidTotal ? 'text-green-600' : 'text-red-600'}`}>
                {totalPercentage}%
                {isValidTotal && totalPercentage > 0 && <span className="ml-2 text-xs">✓</span>}
                {!isValidTotal && <span className="ml-2 text-xs">⚠ Must be 0% or 100%</span>}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1 text-xs mb-2"
            >
              <Download className="w-3 h-3" />
              Template
            </Button>

            <div 
              className="border-2 border-dashed border-accent-200 rounded-lg p-4 text-center hover:border-accent-400 transition-colors cursor-pointer"
              onClick={handleCriteriaClick}
              onDrop={handleCriteriaDrop}
              onDragOver={handleCriteriaDragOver}
            >
              <Upload className="w-6 h-6 text-accent-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Upload Excel/CSV criteria file
              </p>
            </div>
            
            <input
              ref={criteriaFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleCriteriaFileChange}
              className="hidden"
            />
            
            <div className="flex gap-2">
              <Input
                placeholder="Grid Name"
                value={gridName}
                onChange={(e) => setGridName(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSaveCriteria} 
                className="whitespace-nowrap"
                disabled={!gridName || !isValidTotal}
              >
                <Save className="w-4 h-4 mr-2" />
                Save as New
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
