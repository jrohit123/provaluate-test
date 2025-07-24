import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, User, CheckCircle, Play, Briefcase, Grid, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { MatchScorecardSection } from './MatchScorecardSection';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface SavedCriteriaGrid {
  id: string;
  name: string;
  criteria: any[];
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx'];
//const CV_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook-test/c32aade7-564b-4cc7-a832-b6b094418132";
const CV_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook-test/c32aade7-564b-4cc7-a832-b6b094418132";

export const ResumeUploadSection = () => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [newlyUploadedIds, setNewlyUploadedIds] = useState<Set<string>>(new Set()); // Track newly uploaded resumes
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

  // Load criteria grids from database
  const loadCriteriaGrids = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log('Loading criteria grids for user:', user.id);
      
      // Get all criteria grouped by criteria_name
      const { data: grids, error } = await supabase
        .from('criteria')
        .select('*')
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

      // Group criteria by name and use the first criteria_id as the grid ID
      const groupedGrids = grids.reduce((acc: { [key: string]: { id: string, criteria: any[] } }, curr) => {
        const key = curr.criteria_name;
        if (!acc[key]) {
          acc[key] = {
            id: curr.criteria_id, // Use the first criteria_id as the grid ID
            criteria: []
          };
        }
        acc[key].criteria.push({
          id: curr.criteria_id,
          parameter: curr.parameter,
          weightage: curr.weightage,
          notes: curr.calc_note || ''
        });
        return acc;
      }, {});

      console.log('Grouped criteria grids:', groupedGrids);

      // Convert to SavedCriteriaGrid format
      const formattedGrids: SavedCriteriaGrid[] = Object.entries(groupedGrids).map(([name, gridData]: [string, { id: string, criteria: any[] }]) => ({
        id: gridData.id, // Use the actual criteria_id as the grid ID
        name,
        criteria: gridData.criteria
      }));

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
    }
  }, [user?.profile?.company_id, loadResumes, loadJobDescriptions, loadCriteriaGrids]);

  // Fetch assessment reports filtered by selected JD and criteria
  useEffect(() => {
    const fetchReports = async () => {
      if (!user?.profile?.company_id || !selectedJobDescriptionId || !selectedCriteriaGridId) {
        setAssessmentReports([]);
        return;
      }
      setLoadingReports(true);
      try {
        const { data, error } = await supabase
          .from('assessment_reports')
          .select('*')
          .eq('job_description_id', selectedJobDescriptionId)
          .eq('criteria_id', selectedCriteriaGridId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setAssessmentReports(data || []);
      } catch (err) {
        setAssessmentReports([]);
        toast({
          title: 'Error Loading Reports',
          description: 'Could not load assessment reports.',
          variant: 'destructive',
        });
      } finally {
        setLoadingReports(false);
      }
    };
    fetchReports();
  }, [user?.profile?.company_id, selectedJobDescriptionId, selectedCriteriaGridId, toast]);

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
      return 'Invalid file type. Please upload PDF, DOC, or DOCX files';
    }
    
    return null;
  };

  const handleFileUpload = async (files: FileList) => {
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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);
      
      if (error) {
        toast({
          title: `Error with ${file.name}`,
          description: error,
          variant: "destructive",
        });
        continue;
      }

      const resumeId = Date.now().toString() + i;
      const newResume: ResumeData = {
        id: resumeId,
        name: file.name.split('.')[0],
        fileName: file.name,
        status: 'uploading',
        summary: '',
        initialScore: 0,
        uploadProgress: 0
      };

      setResumes(prev => [...prev, newResume]);

      try {
        // Upload to Supabase Storage
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${user.profile.company_id}/${timestamp}_${safeFileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file, {
            cacheControl: '3600',
            contentType: file.type
          });

        // Update progress separately
        setResumes(prev => prev.map(resume => 
          resume.id === resumeId 
            ? { ...resume, uploadProgress: 100 }
            : resume
        ));

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(uploadData.path);

        const fileUrl = publicUrlData.publicUrl;

        // Save resume record to database using auth.uid() for RLS compatibility
        const { data: resumeRecord, error: dbError } = await supabase
          .from('resumes')
          .insert({
            candidate_name: file.name.split('.')[0],
            cv_file: fileUrl,
            user_id: user.id, // This should match auth.uid()
            company_id: user.profile.company_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (dbError) throw dbError;

        setResumes(prev => prev.map(resume => 
          resume.id === resumeId 
            ? { 
                ...resume, 
                fileUrl: fileUrl,
                status: 'processed',
                id: resumeRecord.resume_id // Use the database ID
              }
            : resume
        ));
        
        // Track this as newly uploaded
        setNewlyUploadedIds(prev => new Set(prev).add(resumeRecord.resume_id));

        toast({
          title: "Resume Uploaded",
          description: `${file.name} has been uploaded and saved successfully.`,
        });
      } catch (error: any) {
        console.error('Error uploading resume:', error);
        setResumes(prev => prev.map(resume => 
          resume.id === resumeId 
            ? { ...resume, status: 'error' }
            : resume
        ));

        toast({
          title: `Error uploading ${file.name}`,
          description: error.message || "An error occurred during upload.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const processedResumes = resumes.filter(r => r.status === 'processed');
      
      for (const resume of processedResumes) {
        const response = await fetch(CV_WEBHOOK_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resume_url: resume.fileUrl,
            resume_id: resume.id
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to evaluate ${resume.fileName}`);
        }

        const result = await response.json();
        
        setResumes(prev => prev.map(r => 
          r.id === resume.id 
            ? { 
                ...r, 
                status: 'processed',
                summary: result.summary || r.summary,
                initialScore: result.score || r.initialScore
              }
            : r
        ));
      }

      toast({
        title: "Evaluation Complete",
        description: "All resumes have been evaluated.",
      });
    } catch (error: any) {
      toast({
        title: "Evaluation Failed",
        description: error.message || "There was an error during evaluation.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleCandidateClick = (candidateId: string) => {
    setSelectedCandidate(candidateId);
    setShowScorecard(true);
  };

  // Handle job description selection
  const handleJobDescriptionSelect = (jdId: string) => {
    setSelectedJobDescriptionId(jdId);
    sessionStorage.setItem('selectedJDId', jdId);
    
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
    
    const selectedGrid = criteriaGrids.find(grid => grid.id === gridId);
    toast({
      title: "Criteria Grid Selected",
      description: `Selected: ${selectedGrid?.name || 'Unknown Grid'}`,
    });
  };

  // Shared function to send resumes to webhook
  const sendResumesToWebhook = async (resumeUrls: any[], selectedJDId: string, selectedCriteriaGridId: string, actionType: string) => {
    // Prepare GET request with optimized parameters for n8n
    const params = new URLSearchParams({
      action: actionType === 'new_resumes' ? 'process_new_resumes' : 'process_all_resumes',
      company_id: user?.profile?.company_id || '',
      user_id: user?.id || '',
      job_description_id: selectedJDId,
      criteria_grid_id: selectedCriteriaGridId,
      resume_count: resumeUrls.length.toString(),
      timestamp: new Date().toISOString()
    });

    // Check if we have too many resumes for a single GET request
    const maxResumesPerRequest = 5; // Safe limit to avoid URL length issues
    
    if (resumeUrls.length > maxResumesPerRequest) {
      // Send in batches
      console.log(`Too many resumes (${resumeUrls.length}). Sending in batches of ${maxResumesPerRequest}.`);
      
      for (let i = 0; i < resumeUrls.length; i += maxResumesPerRequest) {
        const batch = resumeUrls.slice(i, i + maxResumesPerRequest);
        const batchNumber = Math.floor(i / maxResumesPerRequest) + 1;
        const totalBatches = Math.ceil(resumeUrls.length / maxResumesPerRequest);
        
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
          batch_type: actionType, // 'new_resumes' or 'all_resumes'
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

        const batchResponse = await fetch(batchUrl, {
          method: 'GET',
          mode: 'no-cors', // Avoid CORS preflight
        });

        console.log(`Batch ${batchNumber} sent successfully (no-cors mode)`);
        
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

      const response = await fetch(fullUrl, {
        method: 'GET',
        mode: 'no-cors', // Avoid CORS preflight
      });

      console.log('Resumes sent successfully (no-cors mode)');
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

      await sendResumesToWebhook(resumeUrls, selectedJDId, selectedCriteriaGridId, 'new_resumes');

      toast({
        title: "Processing Started",
        description: `Successfully sent ${resumeUrls.length} new resumes to n8n for processing.`,
      });

    } catch (error: any) {
      console.error('Error processing new resumes:', error);
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

      await sendResumesToWebhook(resumeUrls, selectedJDId, selectedCriteriaGridId, 'all_resumes');

      toast({
        title: "Processing Started",
        description: `Successfully sent ${resumeUrls.length} resumes with job description (${selectedJDId}) and criteria grid (${selectedCriteriaGridId}) to n8n for processing.`,
      });

    } catch (error: any) {
      console.error('Error processing all resumes:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to send resumes to n8n webhook.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Test CV webhook connectivity
  const testCVWebhook = async () => {
    try {
      console.log('Testing CV webhook:', CV_WEBHOOK_URL);
      
      const response = await fetch(CV_WEBHOOK_URL, {
        method: 'GET',
        mode: 'no-cors', // Avoid CORS preflight
      });
      
      // Note: With no-cors mode, we can't read response status or body
      // But the request will still be sent to the webhook
      console.log('CV Webhook test sent (no-cors mode)');
      
      toast({
        title: "CV Webhook Test Sent",
        description: "Test request sent to n8n webhook (CORS limitations prevent reading response)",
      });
    } catch (error: any) {
      console.error('CV Webhook test failed:', error);
      toast({
        title: "CV Webhook Test Failed",
        description: error.message || "Could not connect to n8n CV webhook. Check console for details.",
        variant: "destructive",
      });
    }
  };

  const hasProcessedResumes = resumes.some(resume => resume.status === 'processed');

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Resume Uploads</h2>
        <p className="text-muted-foreground">Upload multiple candidate resumes for evaluation</p>
      </div>

      {/* Job Description Selection */}
      <Card className="animate-fade-in mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary-600" />
            Job Description Selection
          </CardTitle>
          <CardDescription>
            Select the job description to evaluate resumes against
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select value={selectedJobDescriptionId} onValueChange={handleJobDescriptionSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a job description..." />
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
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Job Description Selected
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  {jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId)?.title}
                </p>
              </div>
            )}
            
            {jobDescriptions.length === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No job descriptions found. Please create one in the Job Upload section first.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Criteria Grid Selection */}
      <Card className="animate-fade-in mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-primary-600" />
            Evaluation Criteria Selection
          </CardTitle>
          <CardDescription>
            Select the evaluation criteria grid to use for scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select value={selectedCriteriaGridId} onValueChange={handleCriteriaGridSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select evaluation criteria..." />
              </SelectTrigger>
              <SelectContent>
                {criteriaGrids.map(grid => (
                  <SelectItem key={grid.id} value={grid.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{grid.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {grid.criteria.length} criteria parameters
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedCriteriaGridId && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Criteria Grid Selected
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  {criteriaGrids.find(grid => grid.id === selectedCriteriaGridId)?.name}
                </p>
              </div>
            )}
            
            {criteriaGrids.length === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No evaluation criteria found. Please create one in the Job Upload section first.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="animate-fade-in">
        <CardContent className="p-6">
          <div 
            className="border-2 border-dashed border-primary-200 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onClick={handleFileSelect}
            onDrop={(e) => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                handleFileUpload(files);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Candidate Resumes</h3>
            <p className="text-muted-foreground mb-4">
              Drop multiple PDF/DOC files here or click to browse
            </p>
            <Button className="bg-primary-600 hover:bg-primary-700">
              Select Files
            </Button>
          </div>
          
          {/* Test Webhook Button */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Button 
              onClick={testCVWebhook} 
              variant="outline" 
              size="sm"
              className="w-full text-xs"
            >
              Test CV n8n Webhook Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 flex-wrap">
        {/* Send New Resumes Button - Only shows if there are resumes in current session */}
        {resumes.filter(r => newlyUploadedIds.has(r.id) && r.fileUrl).length > 0 && (
          <Button
            onClick={handleProcessNewResumes}
            disabled={isEvaluating}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isEvaluating ? 'Processing...' : `Send New (${resumes.filter(r => newlyUploadedIds.has(r.id) && r.fileUrl).length})`}
          </Button>
        )}

        {/* Send All Resumes Button - Shows if there are any resumes in database */}
        {resumes.length > 0 && (
          <Button
            onClick={handleProcessAllResumes}
            disabled={isEvaluating}
            variant="outline"
            className="border-primary-600 text-primary-600 hover:bg-primary-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isEvaluating ? 'Processing...' : 'Send All to n8n'}
          </Button>
        )}
        
      {hasProcessedResumes && (
          <Button
            onClick={handleEvaluation}
            disabled={isEvaluating}
            className="bg-accent-600 hover:bg-accent-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            {isEvaluating ? 'Evaluating...' : 'Provaluate'}
          </Button>
        )}
        </div>

      {/* Resume List (now Assessment Reports) */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-primary-800">
          Candidate Pool ({assessmentReports.length})
        </h3>
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
          assessmentReports.map((report) => (
          <Card 
              key={report.id}
            className="animate-fade-in hover:shadow-md transition-shadow cursor-pointer"
              // Optionally, you can add onClick to show more details
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
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                        {report.resume_url ? report.resume_url.split('/').pop() : 'No file'}
                      </p>
                      <p className="text-sm text-gray-700">{report.summary || report.recommendation || ''}</p>
                    </div>
                      </div>
                  <div className="px-3 py-1 rounded-full text-sm font-medium bg-accent-100 text-accent-600">
                    {report.overall_score ? `${report.overall_score}% Match` : 'No Score'}
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
                              className="absolute top-0 left-0 h-3 rounded-full bg-blue-900"
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
          ))
        )}
      </div>

      {/* Scorecard Dialog */}
      <Dialog open={showScorecard} onOpenChange={setShowScorecard}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
          {selectedCandidate && (
            <MatchScorecardSection
              onCandidateSelect={() => {}}
              selectedCandidateId={selectedCandidate}
              onClose={() => setShowScorecard(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
