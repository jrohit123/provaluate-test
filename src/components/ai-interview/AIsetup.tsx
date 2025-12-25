import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { API_CONFIG, buildApiUrl, apiCall } from '@/constants/api';
import { INTERVIEW_CONSTANTS } from '@/constants/interview';
import { JobDescription, StructuredQuestion, CustomParameters } from '@/types/interview';
import {
  Settings,
  FileText,
  Plus,
  Trash2,
  Save,
  Target,
  Brain,
  Loader2,
  X,
  Upload,
  Maximize2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import StructuredInterviewSetup from './StructuredInterviewSetup';

interface FormData {
  position: string;
  newRole: string;
  jobDescription: string;
  duration: number;
  totalQuestions: number;
  interviewType: 'technical' | 'behavioral' | 'mixed';
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



const HRInterviewCreator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [customParameters, setCustomParameters] = useState<CustomParameters>({});
  const [structuredQuestions, setStructuredQuestions] = useState<StructuredQuestion[]>([]);
  const [isLoadingParameters, setIsLoadingParameters] = useState(true);
  const [isSavingParameters, setIsSavingParameters] = useState(false);
  const [parametersSaved, setParametersSaved] = useState(false);
  const [isExpandDialogOpen, setIsExpandDialogOpen] = useState(false);
  const [loadedPositions, setLoadedPositions] = useState<Set<string>>(new Set());
  const [expandedParameters, setExpandedParameters] = useState<Set<string>>(new Set());

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

  // Helper function to convert resolved_jd attributes to plain text
  const convertResolvedJDToText = (parameter: any): string => {
    if (!parameter || !parameter.attributes) {
      return '';
    }

    const attributes = parameter.attributes;
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
    if (parameter.attributes_summary) {
      text += `\nSummary:\n${parameter.attributes_summary}\n`;
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

  // Handle job description selection from both CV screening and AI interview
  const handleJobDescriptionSelect = async (jdId: string) => {
    const selectedJD = jobDescriptions.find(jd => jd.jd_id === jdId);
    if (selectedJD) {
      // Set the role name from the selected JD title
      setFormData(prev => ({ ...prev, position: selectedJD.title }));
      
      // Check if this is from jd_for_interview table (has extracted_text)
      if (selectedJD.extracted_text) {
        // Use the already extracted text from jd_for_interview table
        setFormData(prev => ({ ...prev, jobDescription: selectedJD.extracted_text }));
        showJDLoadedToast(selectedJD.title);
        
        // Load existing parameters for this role (if any)
        console.log('🔄 Role selection: Loading parameters for:', selectedJD.title);
        await loadParametersForPosition(selectedJD.title);
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
              showJDLoadedToast(selectedJD.title);
              
              // Load existing parameters for this role (if any)
              await loadParametersForPosition(selectedJD.title);
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
        const fileNameWithExtension = `${selectedJD.title}.${originalExtension}`;
        
        console.log('Original file extension detected:', originalExtension);
        console.log('Using filename:', fileNameWithExtension);
        
        // Send file data directly to backend without creating File object
        const formDataForUpload = new FormData();
        formDataForUpload.append('file', fileData, fileNameWithExtension);
        formDataForUpload.append('title', selectedJD.title);

        console.log(`Sending ${originalExtension.toUpperCase()} file to backend for text extraction...`);
        const response = await apiCall(API_CONFIG.ENDPOINTS.EXTRACT_JD_TEXT, {
          method: 'POST',
          body: formDataForUpload,
        });

        if (response.ok) {
          const { extractedText } = await response.json();
          console.log('Text extracted successfully, length:', extractedText.length);
          setFormData(prev => ({ ...prev, jobDescription: extractedText }));
          showJDLoadedToast(selectedJD.title);
          
          // Load existing parameters for this role (if any)
          await loadParametersForPosition(selectedJD.title);
        } else {
          console.error('Backend extraction failed:', response.status, response.statusText);
          // Fallback to title if extraction fails
          setFormData(prev => ({ ...prev, jobDescription: selectedJD.title }));
          toast.error('Failed to extract text from file', { id: 'jd-extraction-error' });
        }
      } catch (error) {
        console.error('Error loading JD file:', error);
        // Fallback to title if there's an error
        setFormData(prev => ({ ...prev, jobDescription: selectedJD.title }));
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

      // Clean the extracted text to remove binary data corruption (same as other systems)
      const cleanedText = extractedText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/\\u[0-9A-Fa-f]{4}/g, '') // Remove Unicode escape sequences
        .replace(/\\[nrtbf]/g, ' ') // Replace escape sequences with spaces
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '') // Remove non-printable characters
        .replace(/[&]{2,}/g, ' ') // Remove multiple ampersands
        .replace(/[0-9]{6,}/g, '') // Remove long sequences of numbers
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim(); // Remove leading/trailing whitespace

      console.log('🔄 Cleaned text length:', cleanedText.length);

      // Save JD record to jd_for_interview table
      console.log('🔄 Saving JD record to database...');
      const { data: jdData, error: jdError } = await supabase
        .from('jd_for_interview')
        .insert({
          title: formData.newRole,
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
      
      // Update form data with cleaned text
      setFormData(prev => ({ ...prev, jobDescription: cleanedText }));
      console.log('✅ Form data updated with extracted text');
      
      // Reload job descriptions to include the newly uploaded one
      await loadJobDescriptions();
      console.log('✅ Job descriptions reloaded');
      
      // Load existing parameters for this role (if any)
      if (formData.newRole) {
        await loadParametersForPosition(formData.newRole);
        console.log('✅ Parameters loaded for role:', formData.newRole);
      }
      
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
      
      // Trigger parameter loading when newRole changes and we're in AI mode
      // Only trigger if the value is substantial and user has stopped typing
      if (name === 'newRole' && formData.interviewMode === 'ai' && value.trim().length > 3) {
        // Clear any existing timeout
        if ((window as any).newRoleTimeout) {
          clearTimeout((window as any).newRoleTimeout);
        }
        // Add a delay to prevent loading while user is still typing
        (window as any).newRoleTimeout = setTimeout(() => {
          if (formData.newRole === value) { // Only load if the value hasn't changed
            loadParametersForPosition(value.trim());
          }
        }, 1500);
      }
    }
  };



  const loadParametersForPosition = async (position: string) => {
    console.log('🔍 loadParametersForPosition called with:', { position, interviewMode: formData.interviewMode, isLoadingParameters });
    
    if (!position) {
      console.log('🔄 No position provided, clearing parameters');
      setCustomParameters({});
      setParametersSaved(false);
      return;
    }
    
    // Only prevent if we're already loading the same position
    // Temporarily disabled to debug
    // if (isLoadingParameters) {
    //   console.log('🔄 Already loading parameters, skipping duplicate call for:', position);
    //   return;
    // }
    
    console.log('🔄 Starting to load parameters for:', position);
    setIsLoadingParameters(true);
    try {
      console.log('🔄 Loading parameters for position:', position);
      console.log('🔄 Current customParameters before loading:', Object.keys(customParameters));
      
      // Try to load from custom_role_parameters table first
      const { data, error } = await supabase
        .from('custom_role_parameters')
        .select('custom_parameters, interview_type, structured_questions, personalized_questions')
        .eq('role_name', position)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
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
          setCustomParameters({});
        }
        
        if (customParams && Object.keys(customParams).length > 0 && detectedMode === 'ai') {
          // Load AI interview parameters and ensure they have max_time and level values
          const paramsWithDefaults = Object.keys(customParams).reduce((acc, key) => {
            acc[key] = {
              ...customParams[key],
              max_time: customParams[key].max_time || 3, // Default to 3 minutes if not set
              level: customParams[key].level || 'Regular' // Default to Regular if not set
            };
            return acc;
          }, {} as CustomParameters);
          
          console.log('🔄 Setting customParameters to:', paramsWithDefaults);
          setCustomParameters(paramsWithDefaults);
          setParametersSaved(true);
          
          // Calculate duration and questions - if personalized questions exist, use the combined function
          if (personalizedQuestions && personalizedQuestions.length > 0) {
            // Use the combined function that handles both technical and personalized questions
            recalculateDurationWithPersonalizedQuestions(personalizedQuestions, paramsWithDefaults);
          } else {
            // Only technical questions, use the regular calculation
            calculateDuration(paramsWithDefaults);
          }
          
          // Only show toast if we haven't loaded this position before (silent auto-load)
          const normalizedPosition = position.trim().toLowerCase();
          console.log('🔍 Toast check:', { position, normalizedPosition, loadedPositions: Array.from(loadedPositions), hasPosition: loadedPositions.has(normalizedPosition) });
          // Removed toast - parameters load silently to avoid spam
          setLoadedPositions(prev => new Set(prev).add(normalizedPosition));
          console.log('✅ Loaded existing AI parameters for', position);
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
          setParametersSaved(true);
          
          // Only show toast if we haven't loaded this position before (silent auto-load)
          const normalizedPosition = position.trim().toLowerCase();
          // Removed toast - parameters load silently to avoid spam
          setLoadedPositions(prev => new Set(prev).add(normalizedPosition));
          console.log('✅ Loaded existing structured interview for', position);
        } else {
          console.log('🔄 Existing record found but no valid data, clearing state');
          setCustomParameters({});
          setParametersSaved(false);
        }
      } else {
        // No existing parameters found, start with empty parameters
        console.log('🔄 No existing parameters found for', position, '- clearing state');
        setCustomParameters({});
        setParametersSaved(false);
        // Removed toast - UI state is clear enough without notification
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
      setCustomParameters({});
      setParametersSaved(false);
    } finally {
      setIsLoadingParameters(false);
    }
  };

  const loadParameters = useCallback(async () => {
    await loadParametersForPosition(formData.position);
  }, [formData.position]);

  const calculateDuration = (parameters: CustomParameters) => {
    if (!parameters || Object.keys(parameters).length === 0) {
      setFormData(prev => ({ ...prev, duration: 30, totalQuestions: 1 })); // Default fallback - minimum 1 question
      return;
    }

    let technicalQuestions = 0; // Will be calculated and rounded to whole number

    // Calculate questions per parameter: (min + max) ÷ 2, then round to nearest whole number
    Object.values(parameters).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const questionsPerParam = (minQuestions + maxQuestions) / 2;
      technicalQuestions += questionsPerParam;
    });

    // Round to nearest whole number for technical questions (no decimals)
    technicalQuestions = Math.round(technicalQuestions);
    
    // Ensure minimum of 1 technical question
    technicalQuestions = Math.max(1, technicalQuestions);
    
    // Add personalized questions to total
    const personalizedQuestionsCount = formData.personalizedQuestionsEnabled ? formData.personalizedQuestions.length : 0;
    const totalQuestions = technicalQuestions + personalizedQuestionsCount;
    
    console.log('🔍 calculateDuration debug:', {
      technicalQuestions,
      personalizedQuestionsEnabled: formData.personalizedQuestionsEnabled,
      personalizedQuestions: formData.personalizedQuestions,
      personalizedQuestionsCount,
      totalQuestions,
      formDataPersonalizedQuestions: formData.personalizedQuestions
    });
    
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
      
      console.log(`🔄 Debug max_time for ${param.name}:`, { 
        original: param.max_time, 
        type: typeof param.max_time, 
        parsed: answerTime,
        isValid: !isNaN(answerTime) && answerTime >= 1 && answerTime <= 10
      });
      // Reading time per question (fixed at 30 seconds = 0.5 minutes)
      const readingTime = 0.5;
      // Total time per question = answer time + reading time
      const totalTimePerQuestion = answerTime + readingTime;
      const paramDuration = avgQuestions * totalTimePerQuestion;
      calculatedDuration += paramDuration;
      
      console.log(`🔄 Parameter "${param.name}": ${avgQuestions} questions × ${totalTimePerQuestion} min = ${paramDuration} min`);
    });
    
    // Add 2 minutes buffer
    calculatedDuration += 2;
    
    // Ensure duration is within reasonable bounds (5-120 minutes)
    const finalDuration = Math.max(5, Math.min(120, calculatedDuration));
    
    console.log('🔄 Duration calculation summary:', {
      parameters: Object.keys(parameters).length,
      technicalQuestions,
      personalizedQuestionsCount,
      totalQuestions,
      calculatedDuration: calculatedDuration.toFixed(2),
      buffer: 2,
      finalDuration,
      breakdown: {
        answerTime: (calculatedDuration - 2).toFixed(2),
        readingTime: (technicalQuestions * 0.5).toFixed(2),
        buffer: 2
      },
      parameterDetails: Object.values(parameters).map(p => ({
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
      technicalQuestions,
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
    Object.values(customParameters).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const avgQuestions = (minQuestions + maxQuestions) / 2;
      const answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
      const readingTime = 0.5; // 30 seconds per question
      const totalTimePerQuestion = answerTime + readingTime;
      calculatedDuration += avgQuestions * totalTimePerQuestion;
    });
    
    // Add 2 minutes buffer
    calculatedDuration += 2;
    
    const finalDuration = Math.max(5, Math.min(120, calculatedDuration));
    // FIXED: Replace duration instead of adding to it
    setFormData(prev => ({ ...prev, duration: finalDuration, totalQuestions: questions }));
  };

  const calculateQuestionsFromDuration = (duration: number) => {
    // Calculate questions based on answer time + reading time from parameters
    if (!customParameters || Object.keys(customParameters).length === 0) {
      // Fallback to old logic if no parameters
      const calculatedQuestions = (duration - 2) / 4;
      const finalQuestions = Math.max(1, Math.min(30, Math.round(calculatedQuestions)));
      // FIXED: Replace both duration and totalQuestions instead of just totalQuestions
      setFormData(prev => ({ ...prev, duration: duration, totalQuestions: finalQuestions }));
      return;
    }
    
    // Calculate total time needed for all parameters
    let totalTimeForAllQuestions = 0;
    Object.values(customParameters).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const answerTime = typeof param.max_time === 'string' ? parseFloat(param.max_time) : (param.max_time || 3);
      const readingTime = 0.5; // 30 seconds per question
      const timePerQuestion = answerTime + readingTime;
      const avgQuestions = (minQuestions + maxQuestions) / 2;
      totalTimeForAllQuestions += avgQuestions * timePerQuestion;
    });
    
    // Calculate average time per question across all parameters
    const totalQuestions = Object.values(customParameters).reduce((sum, param) => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      return sum + (minQuestions + maxQuestions) / 2;
    }, 0);
    
    const avgTimePerQuestion = totalTimeForAllQuestions / totalQuestions;
    const calculatedQuestions = (duration - 2) / avgTimePerQuestion;
    const finalQuestions = Math.max(1, Math.min(30, Math.round(calculatedQuestions)));
    // FIXED: Replace both duration and totalQuestions instead of just totalQuestions
    setFormData(prev => ({ ...prev, duration: duration, totalQuestions: finalQuestions }));
  };

  const generateDynamicParameters = async (forceFresh = false) => {
    if (!formData.position && !formData.newRole) {
      toast.error('Please select a position or enter a new role first');
      return;
    }

    if (!formData.jobDescription) {
      toast.error('Please provide a job description first');
      return;
    }

    // Check if parameters already exist - if so, warn user
    if (Object.keys(customParameters).length > 0) {
      const confirmGenerate = window.confirm(
        'You already have parameters set. Generating AI parameters will enhance your existing parameters with AI-generated descriptions and scoring criteria, while preserving your manual settings (timing, questions, weights). Continue?'
      );
      if (!confirmGenerate) {
        return;
      }
    }
    
    setIsLoadingParameters(true);
    try {
      const roleName = formData.newRole || formData.position;
      console.log('🔄 Generating dynamic parameters for role:', roleName);
      
      // First get the interview count for this role
      const countResponse = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW_COUNT}/${encodeURIComponent(roleName)}`);
      const countData = await countResponse.json();
      const interviewCount = countData.interview_count || 1;

      // Generate dynamic parameters using the backend API with JD text
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
          existing_parameters: customParameters // Send current parameters to preserve settings
        })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedParameters = data.parameters || {};
        
        // Preserve existing manual settings and only use AI for missing fields
        const paramsWithDefaults = Object.keys(generatedParameters).reduce((acc, key) => {
          const existingParam = customParameters[key];
          const aiParam = generatedParameters[key];
          
          acc[key] = {
            ...aiParam,
            // Preserve manual settings if they exist, otherwise use reasonable defaults
            max_time: existingParam?.max_time || (aiParam.max_time && aiParam.max_time >= 1 && aiParam.max_time <= 10 ? aiParam.max_time : 3),
            level: existingParam?.level || aiParam.level || 'Regular',
            min_questions: existingParam?.min_questions || (aiParam.min_questions && aiParam.min_questions >= 1 && aiParam.min_questions <= 8 ? aiParam.min_questions : 2),
            max_questions: existingParam?.max_questions || (aiParam.max_questions && aiParam.max_questions >= 1 && aiParam.max_questions <= 8 ? aiParam.max_questions : 5),
            weight: existingParam?.weight || (aiParam.weight && aiParam.weight >= 10 && aiParam.weight <= 40 ? aiParam.weight : 25)
          };
          
          console.log(`🔄 Parameter ${key} settings:`, {
            name: acc[key].name,
            max_time: acc[key].max_time,
            level: acc[key].level,
            min_questions: acc[key].min_questions,
            max_questions: acc[key].max_questions,
            weight: acc[key].weight
          });
          
          return acc;
        }, {} as CustomParameters);
        
        setCustomParameters(paramsWithDefaults);
        setParametersSaved(false);
        calculateDuration(paramsWithDefaults);
        
        const method = data.cached ? 'cached' : 'fresh';
        toast.success(`Generated ${method} parameters for ${roleName} (Interview #${interviewCount})`, { id: 'params-generated' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate parameters');
      }
    } catch (error) {
      console.error('Error generating dynamic parameters:', error);
      toast.error('Failed to generate dynamic parameters', { id: 'params-generate-error' });
    } finally {
      setIsLoadingParameters(false);
    }
  };

  // Auto-generate and save parameters when job description is selected
  const autoGenerateAndSaveParameters = async (jobDescriptionText: string) => {
    const roleName = formData.newRole || formData.position;
    if (!roleName || !jobDescriptionText) {
      return;
    }

    setIsLoadingParameters(true);
    try {
      console.log('🔄 Auto-generating and saving parameters for role:', roleName);
      
      // First get the interview count for this role
      const countResponse = await apiCall(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW_COUNT}/${encodeURIComponent(roleName)}`);
      const countData = await countResponse.json();
      const interviewCount = countData.interview_count || 1;

      // Generate dynamic parameters using the backend API with JD text
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
        const generatedParameters = data.parameters || {};
        
        console.log('🔄 Received parameters from backend:', generatedParameters);
        console.log('🔄 Parameter keys:', Object.keys(generatedParameters));
        Object.entries(generatedParameters).forEach(([key, param]) => {
          const paramObj = param as any;
          console.log(`  ${key}:`, {
            name: paramObj.name,
            min_questions: paramObj.min_questions,
            max_questions: paramObj.max_questions,
            max_time: paramObj.max_time,
            weight: paramObj.weight
          });
        });
        
        // Save parameters directly to custom_role_parameters table
        const { error: saveError } = await supabase
          .from('custom_role_parameters')
          .insert({
            role_name: roleName,
            custom_parameters: generatedParameters,
            user_id: user?.id
          });

        if (saveError) {
          console.error('Error saving parameters:', saveError);
          toast.error('Failed to save parameters', { id: 'params-save-error-2' });
        } else {
          setCustomParameters(generatedParameters);
          setParametersSaved(true);
          calculateDuration(generatedParameters);
          
          const method = data.cached ? 'cached' : 'AI-generated';
          toast.success(`Auto-generated and saved ${method} parameters for ${roleName} (Interview #${interviewCount})`, { id: 'params-auto-saved' });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate parameters');
      }
    } catch (error) {
      console.error('Error auto-generating parameters:', error);
      toast.error('Failed to auto-generate parameters', { id: 'params-auto-error' });
    } finally {
      setIsLoadingParameters(false);
    }
  };

  // Load job descriptions on component mount
  useEffect(() => {
    if (user?.profile?.company_id) {
      loadJobDescriptions(); // Load existing JDs from CV screening and AI interview
    }
  }, [user?.profile?.company_id]);

  useEffect(() => {
    // Immediately clear parameters when position changes to prevent showing old parameters
    console.log('🔄 Position changed to:', formData.position);
    setCustomParameters({});
    setParametersSaved(false);
    
    if (formData.position) {
      // Call loadParameters directly to avoid dependency issues
      loadParametersForPosition(formData.position);
    }
  }, [formData.position]);

  // Debug: Monitor customParameters state changes
  useEffect(() => {
    console.log('🔄 customParameters state changed:', Object.keys(customParameters).length, 'parameters');
    if (Object.keys(customParameters).length > 0) {
      console.log('🔄 Parameters keys:', Object.keys(customParameters));
    }
  }, [customParameters]);

  // Clear data when switching interview modes
  useEffect(() => {
    console.log('🔍 Mode useEffect triggered:', { 
      interviewMode: formData.interviewMode
    });
    
    if (formData.interviewMode === 'ai') {
      // Clear structured questions when switching to AI mode
      setStructuredQuestions([]);
    } else if (formData.interviewMode === 'structured') {
      // Clear custom parameters when switching to structured mode
      setCustomParameters({});
    }
    
    // Clear loaded positions to allow fresh toasts for new mode
    setLoadedPositions(new Set());
  }, [formData.interviewMode]);

  // Load parameters when position changes (only for AI mode)
  useEffect(() => {
    console.log('🔍 Position useEffect triggered:', { 
      position: formData.position, 
      interviewMode: formData.interviewMode 
    });
    
    if (formData.position && formData.interviewMode === 'ai') {
      console.log('🔄 Position useEffect: Loading parameters for position:', formData.position);
      loadParametersForPosition(formData.position);
    }
  }, [formData.position, formData.interviewMode]);

  const saveParameters = async () => {
    const roleName = formData.newRole || formData.position;
    
    if (!roleName || Object.keys(customParameters).length === 0) {
      toast.error('Please configure parameters before saving', { id: 'params-configure-required' });
      return;
    }
    
    setIsSavingParameters(true);
    try {
      console.log('🔄 Saving parameters for role:', roleName, customParameters);
      
      // First check if parameters already exist for this role
      const { data: existingData, error: checkError } = await supabase
        .from('custom_role_parameters')
        .select('id')
        .eq('role_name', roleName)
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .single();

      let data, error;
      
      // If existingData exists (no error), update; otherwise insert new
      if (existingData && !checkError) {
        // Update existing record
        console.log('🔄 Updating existing parameters for role:', roleName);
        const result = await supabase
          .from('custom_role_parameters')
          .update({
            custom_parameters: customParameters,
            interview_type: formData.interviewType,
            structured_questions: {}, // Clear structured questions for AI interviews
            personalized_questions: formData.personalizedQuestionsEnabled ? formData.personalizedQuestions : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Insert new record
        console.log('🔄 Creating new parameters for role:', roleName);
        const result = await supabase
          .from('custom_role_parameters')
          .insert({
            role_name: roleName,
            custom_parameters: customParameters,
            interview_type: formData.interviewType,
            structured_questions: {}, // No structured questions for AI interviews
            personalized_questions: formData.personalizedQuestionsEnabled ? formData.personalizedQuestions : null,
            user_id: user?.id,
            is_active: true
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      setParametersSaved(true);
      
      // Don't recalculate duration after saving - keep the current duration
      // The duration should remain the same as what was calculated before saving
      
      toast.success('Parameters saved successfully!', { id: 'params-saved' });
      console.log('✅ Parameters saved/updated for role:', roleName);
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('Failed to save parameters', { id: 'params-save-error' });
    } finally {
      setIsSavingParameters(false);
    }
  };

  const addParameter = () => {
    const newKey = `param_${Object.keys(customParameters).length + 1}`;
    setCustomParameters(prev => {
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
          scoring_criteria: [
            'Excellent (9-10): Demonstrates exceptional understanding and application',
            'Good (7-8): Shows strong competency with minor areas for improvement',
            'Average (5-6): Meets basic requirements with some gaps in knowledge',
            'Below Average (1-4): Shows significant gaps and needs improvement'
          ]
        }
      };
      
      // Recalculate duration when adding new parameter
      setTimeout(() => calculateDuration(updated), INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      return updated;
    });
  };

  const updateParameter = (key: string, field: keyof CustomParameter, value: string | number | string[]) => {
    let processedValue: string | number | string[] = value;
    if (field === 'weight' || field === 'min_questions' || field === 'max_questions') {
      const numValue = parseInt(value.toString());
      processedValue = isNaN(numValue) ? 0 : numValue;
    }
    
    setCustomParameters(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: processedValue
        }
      };
      
      // Recalculate duration and questions for any parameter change
      setTimeout(() => calculateDuration(updated), INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      
      return updated;
    });
    setParametersSaved(false);
  };

  const deleteParameter = (key: string) => {
    setCustomParameters(prev => {
      const newParams = { ...prev };
      delete newParams[key];
      
      // Recalculate duration when deleting parameter
      setTimeout(() => calculateDuration(newParams), INTERVIEW_CONSTANTS.TIMEOUTS.RECORDING_VERIFICATION);
      return newParams;
    });
    setParametersSaved(false);
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
      baseDuration = Math.max(5, Math.min(120, calculatedDuration));
    }
    
    // Total duration = base duration + personalized questions duration
    const totalDuration = baseDuration + personalizedDuration;
    
    // Calculate total questions (technical + personalized) - use same logic as calculateDuration
    let technicalQuestions = 0;
    Object.values(paramsToUse).forEach(param => {
      const minQuestions = typeof param.min_questions === 'string' ? parseFloat(param.min_questions) : param.min_questions;
      const maxQuestions = typeof param.max_questions === 'string' ? parseFloat(param.max_questions) : param.max_questions;
      const questionsPerParam = (minQuestions + maxQuestions) / 2;
      technicalQuestions += questionsPerParam;
    });
    
    // Round to nearest whole number for technical questions (no decimals)
    technicalQuestions = Math.round(technicalQuestions);
    
    // Ensure minimum of 1 technical question
    technicalQuestions = Math.max(1, technicalQuestions);
    
    const totalQuestions = technicalQuestions + personalizedQuestions.length;
    
    console.log('🔄 Duration recalculation:', {
      personalizedQuestions: personalizedQuestions.length,
      personalizedDuration,
      baseDuration,
      totalDuration,
      technicalQuestions,
      totalQuestions,
      usingProvidedParams: !!parameters
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
      const response = await fetch('https://devprovaluate_py.aitamate.com/api/save-interview-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `${roleName} Interview Configuration`,
          description: `Interview configuration for ${roleName} position`,
          duration: formData.duration,
          difficulty: 'medium', // Default difficulty
          position: roleName,
          skills: [], // Could be extracted from job description
          custom_questions: [], // No custom questions in this component
          personalized_questions_enabled: formData.personalizedQuestionsEnabled,
          personalized_questions: formData.personalizedQuestions,
          total_duration: formData.duration + (formData.personalizedQuestionsEnabled ? 
            formData.personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0) : 0),
          job_description: formData.jobDescription,
          interview_type: formData.interviewType,
          interview_mode: formData.interviewMode,
          custom_parameters: customParameters
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

  // Function to toggle parameter expansion
  const toggleParameter = (key: string) => {
    setExpandedParameters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Interview Parameters Setup</h2>
        <p className="text-muted-foreground">Select the role and configure the interview settings</p>
      </div>

      {/* Interview Configuration Section */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Interview Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Role *</Label>
                <Select onValueChange={handleJobDescriptionSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role from existing job descriptions..." />
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

              <div className="space-y-2">
                <Label htmlFor="newRole">New Role (Optional)</Label>
                <Input
                  id="newRole"
                  name="newRole"
                  value={formData.newRole}
                  onChange={handleInputChange}
                  placeholder="Enter new role name if creating a new position"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interviewMode">Interview Mode *</Label>
                <Select 
                  value={formData.interviewMode} 
                  onValueChange={(value: 'ai' | 'structured') => 
                    setFormData(prev => ({ ...prev, interviewMode: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select interview mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">
                      <div className="flex items-center gap-3">
                        <span>🤖</span>
                        <div>
                          <div className="font-medium">AI Interview (Dynamic)</div>
                          <div className="text-sm text-gray-500">Questions generated based on candidate answers</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="structured">
                      <div className="flex items-center gap-3">
                        <span>📝</span>
                        <div>
                          <div className="font-medium">Structured Interview (Pre-defined)</div>
                          <div className="text-sm text-gray-500">HR writes custom questions and parameters</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  AI Interview: Dynamic questions generated based on candidate responses<br/>
                  Structured Interview: Pre-defined questions and parameters set by HR
                </p>
              </div>

              {formData.interviewMode === 'ai' && (
                <div className="space-y-2">
                  <Label htmlFor="interviewType">Interview Type *</Label>
                  <Select 
                    value={formData.interviewType} 
                    onValueChange={async (value: 'technical' | 'behavioral' | 'mixed') => {
                      setFormData(prev => ({ ...prev, interviewType: value }));
                      // Trigger parameter loading when interview type changes
                      if (formData.position) {
                        await loadParametersForPosition(formData.position);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select interview type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="mixed">Mixed (Technical + Behavioral)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Technical: Focus on technical skills and problem-solving<br/>
                    Behavioral: Focus on soft skills and communication<br/>
                    Mixed: Combination of both technical and behavioral aspects
                  </p>
                </div>
              )}


            </div>

            {/* Right Column */}
            <div className="space-y-4">



              {/* Drag and Drop Upload Area */}
              <div className="space-y-2">
                <Label>Upload New Job Description</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="jobDescription">Job Description *</Label>
                  {formData.jobDescription && (
                    <Dialog open={isExpandDialogOpen} onOpenChange={setIsExpandDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Maximize2 className="h-4 w-4" />
                          Expand
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                        <DialogHeader>
                          <DialogTitle>Job Description - Full Text</DialogTitle>
                          <DialogDescription>
                            View the complete job description text that was extracted from the uploaded PDF file.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="overflow-y-auto max-h-[60vh]">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-gray-50 rounded-lg border">
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
                  className="resize-none"
                  readOnly
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interview Summary Section */}
            {formData.position && Object.keys(customParameters).length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Interview Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium">Total Questions</div>
                <div className="text-2xl font-bold text-blue-800">{formData.totalQuestions || 'Calculating...'}</div>
                <div className="text-xs text-blue-600">Based on parameters</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium">Duration</div>
                <div className="text-2xl font-bold text-blue-800">{formData.duration || 'Calculating...'} min</div>
                <div className="text-xs text-blue-600">Auto-calculated</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium">Parameters</div>
                <div className="text-2xl font-bold text-blue-800">{Object.keys(customParameters).length}</div>
                <div className="text-xs text-blue-600">Assessment areas</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium">Weightage</div>
                <div className="text-2xl font-bold text-blue-800">
                  {Object.values(customParameters).reduce((total, param) => total + (param.weight || 0), 0)}%
                </div>
                <div className="text-xs text-blue-600">Total weightage</div>
              </div>
            </div>
            
            {/* Editable Duration and Questions Fields - Only for AI Interviews */}
            {formData.interviewMode === 'ai' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="duration"
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    min="5"
                    max="120"
                    placeholder="Auto-calculated"
                  />
                  <div className="text-sm text-gray-500 min-w-fit">
                    {formData.duration ? `${formData.duration} min` : 'Calculating...'}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Duration includes answer time + 30 seconds reading time per question + 2 min buffer. You can edit this value manually.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  💡 Formula: Sum of (questions × (answer time + 0.5 min reading)) for each parameter + 2 min buffer = {formData.duration || 'Calculating...'} min
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalQuestions">Total Questions</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="totalQuestions"
                    type="number"
                    name="totalQuestions"
                    value={formData.totalQuestions}
                    onChange={handleInputChange}
                    min="1"
                    max="30"
                    step="1"
                    placeholder="Auto-calculated"
                  />
                  <div className="text-sm text-gray-500 min-w-fit">
                    {formData.totalQuestions ? `${formData.totalQuestions} questions` : 'Calculating...'}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Total questions = Sum of (min+max)/2 for each parameter, rounded to nearest whole number. You can edit this value manually.
                </p>
              </div>
            </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Conditional Rendering based on Interview Mode */}
      {formData.interviewMode === 'ai' ? (
        <div>

        {/* AI Interview - Interview Questions Configuration Section */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Interview Questions Configuration for {formData.position || 'Selected Role'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
          {/* Always show Save Configuration button, show other buttons conditionally */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-3">
              {/* Show Generate button only when creating new parameters */}
              {(!parametersSaved || Object.keys(customParameters).length === 0) && (
                <Button
                  onClick={() => generateDynamicParameters(true)} // Always force fresh generation
                  disabled={isLoadingParameters || !formData.position}
                  className="flex items-center gap-2"
                  title="Generate completely new parameters, ignoring any cached versions"
                >
                  {isLoadingParameters ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      Generate AI Parameters
                    </>
                  )}
                </Button>
              )}
              
              {/* Show Save Parameters button only when parameters exist but not yet saved */}
              {Object.keys(customParameters).length > 0 && !parametersSaved && (
                <Button
                  onClick={saveParameters}
                  disabled={isSavingParameters}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSavingParameters ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Parameters
                    </>
                  )}
                </Button>
              )}
              
              {/* Show "Parameters Saved" indicator and Edit button when parameters are saved */}
              {Object.keys(customParameters).length > 0 && parametersSaved && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg border border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Parameters Saved</span>
                  </div>
                  <Button
                    onClick={() => setParametersSaved(false)}
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400"
                  >
                    Edit Parameters
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* Show Clear button only when parameters exist */}
              {Object.keys(customParameters).length > 0 && (
                <Button
                  onClick={() => {
                    setCustomParameters({});
                    setParametersSaved(false);
                    toast.success('Parameters cleared successfully!', { id: 'params-cleared' });
                  }}
                  variant="destructive"
                  className="flex items-center gap-2"
                  title="Clear all current parameters"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {Object.keys(customParameters).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(customParameters).map(([key, param], index) => {
                const isExpanded = expandedParameters.has(key);
                const color = getWeightageColor(index, param.weight);
                
                return (
                  <Card key={key} className="bg-gray-50">
                    <CardContent className="pt-6">
                      {parametersSaved ? (
                        <div className="space-y-3">
                          {/* Parameter Header with Circle Bullet and Percentage */}
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
                              onClick={() => toggleParameter(key)}
                            >
                              {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteParameter(key)}
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
                              <Label>Parameter Name</Label>
                              <Input
                                type="text"
                                value={param.name}
                                onChange={(e) => updateParameter(key, 'name', e.target.value)}
                                placeholder="Enter parameter name..."
                                className="w-full"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteParameter(key)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    
                      {/* Expandable Content - Only show when parameters are saved and expanded */}
                      {parametersSaved && isExpanded && (
                        <div className="space-y-4">
                          {/* Description */}
                          <div className="w-full p-3 bg-white rounded border text-gray-700 whitespace-pre-line">
                            {param.description}
                          </div>
                          
                          {/* Parameter Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                              <Label>Weight (%)</Label>
                              <div className="text-lg font-semibold text-gray-900">
                                {param.weight}%
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Min Questions</Label>
                              <div className="text-lg font-semibold text-gray-900">
                                {param.min_questions}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Max Questions</Label>
                              <div className="text-lg font-semibold text-gray-900">
                                {param.max_questions}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label title="Time allocated for candidate to answer (question reading time is additional)">Answer Time (min)</Label>
                              <div className="text-lg font-semibold text-gray-900">
                                {param.max_time}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Level</Label>
                              <div className="text-lg font-semibold text-gray-900">
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

                      {/* Editable Content - Only show when parameters are not saved */}
                      {!parametersSaved && (
                        <div className="space-y-4">
                          <div className="w-full mb-4">
                            <Label>Description</Label>
                            <Textarea
                              value={param.description}
                              onChange={(e) => updateParameter(key, 'description', e.target.value)}
                              placeholder="Enter parameter description in bullet points..."
                              rows={4}
                              className="resize-none"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                              <Label>Weight (%)</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={param.weight}
                                onChange={(e) => updateParameter(key, 'weight', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Min Questions</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={param.min_questions}
                                onChange={(e) => updateParameter(key, 'min_questions', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Questions</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={param.max_questions}
                                onChange={(e) => updateParameter(key, 'max_questions', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label title="Time allocated for candidate to answer (question reading time is additional)">Answer Time (min)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={param.max_time}
                                onChange={(e) => updateParameter(key, 'max_time', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Level</Label>
                              <Select
                                value={param.level || 'Regular'}
                                onValueChange={(value: 'Easy' | 'Regular' | 'Expert') => updateParameter(key, 'level', value)}
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
                          </div>
                          
                          {/* Scoring Criteria Section */}
                          {param.scoring_criteria && Array.isArray(param.scoring_criteria) && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <Label>Scoring Criteria</Label>
                                <Button
                                  onClick={() => {
                                    const newCriteria = [...param.scoring_criteria, ''];
                                    updateParameter(key, 'scoring_criteria', newCriteria);
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
                                        updateParameter(key, 'scoring_criteria', newCriteria);
                                      }}
                                      placeholder={`Criteria ${index + 1}`}
                                      className="flex-1 text-sm"
                                    />
                                    {param.scoring_criteria.length > 1 && (
                                      <Button
                                        onClick={() => {
                                          const newCriteria = param.scoring_criteria.filter((_, i) => i !== index);
                                          updateParameter(key, 'scoring_criteria', newCriteria);
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
              
              {/* Add Parameter button - only show when parameters are not saved (i.e., when creating new parameters) */}
              {!parametersSaved && (
                <Button
                  variant="outline"
                  onClick={addParameter}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
            <div className="text-center py-8">
              <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No assessment parameters configured yet.</p>
              <p className="text-gray-400">Select a position and generate AI parameters to get started.</p>
            </div>
                    
          <Button
            variant="outline"
            onClick={addParameter}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Parameter
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
                        if (parametersSaved) return; // Prevent changes when saved
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
                      disabled={parametersSaved}
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                        parametersSaved ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <Label htmlFor="personalizedQuestionsEnabled" className={`text-sm font-medium text-blue-800 ${
                      parametersSaved ? 'opacity-50' : ''
                    }`}>
                      Enable Personalized Questions
                    </Label>
                  </div>
                  
                  {formData.personalizedQuestionsEnabled && (
                    <div className="space-y-3">
                      <p className="text-xs text-blue-600">
                        Add 1-2 personal questions that will be asked before technical questions. These are for review only and won't be scored.
                      </p>
                      
                      {formData.personalizedQuestions.map((question, index) => (
                        <div key={index} className="space-y-2 p-3 bg-white rounded border">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-700">
                              Question {index + 1}
                            </Label>
                            {!parametersSaved && formData.personalizedQuestions.length > 1 && (
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
                          {parametersSaved ? (
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
                            {parametersSaved ? (
                              <div className="text-sm font-semibold text-gray-900">
                                {question.timeLimit}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={question.timeLimit}
                                onChange={(e) => {
                                  const newQuestions = [...formData.personalizedQuestions];
                                  newQuestions[index].timeLimit = parseInt(e.target.value) || 3;
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
                      
                      {!parametersSaved && formData.personalizedQuestions.length < 2 && (
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
                  user_id: user?.id
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
  );
};

export default HRInterviewCreator;
