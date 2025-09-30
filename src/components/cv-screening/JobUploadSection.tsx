import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Edit, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from '@/integrations/supabase/db';
import { useAuth } from '@/hooks/use-auth';
import { useSession } from '@/contexts/SessionContext';
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
// Backend service URLs for integration - Updated to use correct ports
const BACKEND_URLS = {
  UNIFIED_SERVICE: 'http://localhost:5003',      // app.py - unified backend service
  AI_ANALYZER_SERVICE: 'http://localhost:5001',  // jd_analyzer.py - handles AI analysis
  CV_ANALYZER_SERVICE: 'http://localhost:5002',  // cv_analyzer.py - handles CV analysis
  RESUME_SERVICE: 'http://localhost:5003',       // app.py - handles uploads
};

// Legacy webhook URL (kept for compatibility)
//const JD_WEBHOOK_URL = "https://automations.aitamate.com/webhook/61646fe6-09c4-4276-aeb0-3fd7bb6b367e";
export const JobUploadSection = () => {
  const { user, loading, error } = useAuth();
  const { setCurrentJobDescription } = useSession();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>('');
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

        toast({
          title: "Upload & Analysis Completed",
          description: "Job description uploaded, analyzed, and saved successfully.",
        });
      } catch (backendError) {
        console.error('AI Analyzer service error:', backendError);
        toast({
          title: "Processing Error",
          description: "Failed to process job description. Please try again.",
          variant: "destructive",
        });
      }

      setProcessingStatus('completed');
      toast({
        title: "Job Description Saved",
        description: "Job description processed successfully.",
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
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Job Description Setup</h2>
        <p className="text-muted-foreground">Upload your job description file and process it for analysis</p>
      </div>

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
                  <SelectValue placeholder="Choose job description" />
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
              <Button onClick={handleProcessJobDescription} className="w-full">
                Process Job Description
              </Button>
              
              {/* Select for Session Button */}
              {selectedJobDescriptionId && (
                <Button 
                  onClick={() => {
                    const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);
                    if (selectedJD) {
                      // Set in session context
                      setCurrentJobDescription({
                        id: selectedJD.jd_id,
                        title: selectedJD.title,
                        file: selectedJD.jd_file
                      });
                      
                      toast({
                        title: "Success",
                        description: `"${selectedJD.title}" set for current session`
                      });
                    }
                  }} 
                  className="w-full bg-gray-500 hover:bg-gray-600"
                >
                  Select for Session
                </Button>
              )}
              
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
                    <Textarea
                      value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value) || ''}
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

    </div>
  );
};
