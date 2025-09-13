import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  UserPlus,
  Settings,
  Copy,
  Send,
  FileText,
  Plus,
  Trash2,
  Save,
  Target,
  Loader2,
  Link
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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

const HRInterviewCreator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    candidates: [{ name: '', email: '' }],
    position: '',
    duration: 30,
    totalQuestions: 1,
    customInstructions: '',
    interviewType: 'mixed',
    interviewMode: 'ai'
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createdInterviews, setCreatedInterviews] = useState<CreatedInterview[]>([]);
  const [customParameters, setCustomParameters] = useState<CustomParameters>({});
  const [isLoadingParameters, setIsLoadingParameters] = useState(true);
  const [isSavingParameters, setIsSavingParameters] = useState(false);
  const [parametersSaved, setParametersSaved] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);

  // Check for selected candidates from View All Results
  useEffect(() => {
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
        .select('jd_id, title, jd_file, created_at')
        .eq('company_id', user.profile.company_id)
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
    const selectedJD = jobDescriptions.find(jd => jd.jd_id === jdId);
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



  const loadParameters = useCallback(async () => {
    if (!formData.position) {
      setCustomParameters({});
      setParametersSaved(false);
      return;
    }
    
    setIsLoadingParameters(true);
    try {
      console.log('🔄 Loading parameters for position:', formData.position, 'mode:', formData.interviewMode);
      
      // Try to load from custom_role_parameters table
      const { data, error } = await supabase
        .from('custom_role_parameters')
        .select('custom_parameters, structured_questions')
        .eq('role_name', formData.position)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const record = data[0];
        const customParams = record.custom_parameters;
        const structuredQuestions = record.structured_questions;
        
        if (formData.interviewMode === 'ai') {
          // Load AI interview parameters
          if (customParams && Object.keys(customParams).length > 0) {
            setCustomParameters(customParams);
            setParametersSaved(true);
            calculateDuration(customParams);
            toast({
              title: "Parameters Loaded",
              description: `Automatically loaded existing AI parameters for ${formData.position}`,
            });
          } else if (structuredQuestions && Array.isArray(structuredQuestions) && structuredQuestions.length > 0) {
            // No AI parameters but structured questions exist - suggest switching mode
            setCustomParameters({});
            setParametersSaved(false);
            toast({
              title: "Structured Interview Available",
              description: `Found structured interview for ${formData.position} (${structuredQuestions.length} questions). Switch to "Structured Interview" mode to use them.`,
              variant: "default",
            });
          } else {
            setCustomParameters({});
            setParametersSaved(false);
          }
        } else if (formData.interviewMode === 'structured') {
          // Load structured interview questions
          if (structuredQuestions && Array.isArray(structuredQuestions) && structuredQuestions.length > 0) {
            // For structured interviews, we don't need custom parameters
            setCustomParameters({});
            setParametersSaved(true);
            
            // Calculate duration from structured questions
            calculateDurationFromStructuredQuestions(structuredQuestions);
            
            toast({
              title: "Structured Interview Loaded",
              description: `Found existing structured interview for ${formData.position} (${structuredQuestions.length} questions)`,
            });
          } else if (customParams && Object.keys(customParams).length > 0) {
            // No structured questions but AI parameters exist - suggest switching mode
            setCustomParameters({});
            setParametersSaved(false);
            toast({
              title: "AI Parameters Available",
              description: `Found AI parameters for ${formData.position}. Switch to "AI Interview" mode to use them.`,
              variant: "default",
            });
          } else {
            setCustomParameters({});
            setParametersSaved(false);
          }
        }
      } else {
        // No existing data found
        setCustomParameters({});
        setParametersSaved(false);
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
      setCustomParameters({});
      setParametersSaved(false);
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
    
    // Ensure duration is within reasonable bounds (5-120 minutes)
    const finalDuration = Math.max(5, Math.min(120, calculatedDuration));
    
    setFormData(prev => ({ 
      ...prev, 
      duration: finalDuration,
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
      duration: Math.round(finalDuration * 10) / 10, // Round to 1 decimal place
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


  // Load job descriptions on component mount
  useEffect(() => {
    if (user?.profile?.company_id) {
      loadJobDescriptions();
    }
  }, [user?.profile?.company_id]);

  useEffect(() => {
    if (formData.position) {
      loadParameters();
    }
  }, [formData.position, formData.interviewMode, loadParameters]);

  // Clear parameters when switching to structured mode
  useEffect(() => {
    if (formData.interviewMode === 'structured') {
      setCustomParameters({});
      setParametersSaved(false);
    }
  }, [formData.interviewMode]);


  const saveParameters = async () => {
    if (!formData.position || Object.keys(customParameters).length === 0) {
      toast({
        title: "Configuration Required",
        description: "Please configure parameters before saving",
      });
      return;
    }
    
    setIsSavingParameters(true);
    try {
      console.log('🔄 Saving parameters for role:', formData.position, customParameters);
      
      const response = await fetch('http://localhost:5000/api/custom-parameters', {
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
      toast({
        title: "Save Failed",
        description: "Failed to save parameters",
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
      interviewMode: 'ai'
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
      case 'technical':
        return {
          ...baseTemplate,
          subject: `Technical Interview Invitation - ${formData.position} Position`,
          body: `${baseTemplate.greeting}You have been invited to complete a technical interview for the ${formData.position} position.\n\nThis interview will assess your technical skills and problem-solving abilities. Please ensure you have a stable internet connection and a quiet environment.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
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
          body: `${baseTemplate.greeting}You have been invited to complete a comprehensive interview for the ${formData.position} position.\n\nThis interview will cover both technical skills and behavioral competencies. Please ensure you have a stable internet connection and are prepared to discuss your experience and technical knowledge.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
        };
      default:
        return {
          ...baseTemplate,
          body: `${baseTemplate.greeting}You have been invited to complete an interview for the ${formData.position} position.\n\nPlease click the link below to start your interview:\n${link}\n\nGood luck!${baseTemplate.closing}`
        };
    }
  };

  const sendInterviewLink = () => {
    if (createdInterviews.length > 0) {
      const interviewType = formData.interviewType || 'mixed';
      
      if (createdInterviews.length === 1) {
        // Single candidate - send individual email
        const interview = createdInterviews[0];
        const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
        const template = getEmailTemplate(interview.candidate_name, interviewType, interviewLink);
        
        const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(interview.candidate_email)}&su=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
        window.open(gmailLink, '_blank');
      } else {
        // Multiple candidates - send bulk email with all links
        const emailList = createdInterviews.map(i => i.candidate_email).join(',');
        const template = getEmailTemplate('', interviewType);
        const allLinks = createdInterviews.map(interview => 
          `${interview.candidate_name}: ${window.location.origin}/interview/${interview.interview_id}`
        ).join('\n\n');
        const emailBody = template.body.replace('{INTERVIEW_LINK}', allLinks);
        
        const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailList)}&su=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(gmailLink, '_blank');
      }
    }
  };

  const sendIndividualEmails = () => {
    if (createdInterviews.length > 0) {
      const interviewType = formData.interviewType || 'mixed';
      
      // Send individual emails to each candidate with their specific interview link
      createdInterviews.forEach((interview, index) => {
        setTimeout(() => {
          const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
          const template = getEmailTemplate(interview.candidate_name, interviewType, interviewLink);
          
          const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(interview.candidate_email)}&su=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
          window.open(gmailLink, '_blank');
        }, index * 1000); // Stagger emails by 1 second to avoid overwhelming Gmail
      });
      
      toast({
        title: "Individual Emails Opening",
        description: `Opening ${createdInterviews.length} individual Gmail compose windows with ${interviewType} interview templates...`,
      });
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
    // Validate all candidates have names and emails
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
    
    try {
      const createdInterviewsList: CreatedInterview[] = [];
      
      // Create interviews for all candidates
      for (const candidate of formData.candidates) {
        console.log(`📤 Current formData before API call:`, {
          totalQuestions: formData.totalQuestions,
          duration: formData.duration,
          position: formData.position
        });
        console.log(`📤 Sending to server: total_questions=${formData.totalQuestions}, duration=${formData.duration}`);
        
        const response = await fetch('http://localhost:5000/api/create-interview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            candidate_name: candidate.name,
            candidate_email: candidate.email,
            position: formData.position,
            duration_minutes: formData.duration,
            total_questions: formData.totalQuestions,
            custom_instructions: formData.customInstructions,
            interview_type: formData.interviewType,
            interview_mode: formData.interviewMode
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

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Interview Creation</h2>
        <p className="text-muted-foreground">Set up an interview and generate a link for your candidate</p>
      </div>

      {/* Interview Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Interview Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {/* Candidates Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Candidates *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCandidate}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Candidate
                </Button>
              </div>
              
              {formData.candidates.map((candidate, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
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
            </div>

            {/* Select Role Section */}
            <div className="space-y-2">
              <Label>Select Role *</Label>
              <Select onValueChange={handleJobDescriptionSelect}>
                <SelectTrigger>
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

            {/* Custom Instructions Section */}
            <div className="space-y-2">
              <Label htmlFor="customInstructions">Custom Instructions (Optional)</Label>
              <Textarea
                id="customInstructions"
                name="customInstructions"
                value={formData.customInstructions}
                onChange={handleInputChange}
                placeholder="Any specific instructions or focus areas for this interview..."
                rows={3}
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
                <SelectTrigger>
                  <SelectValue placeholder="Select interview mode..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai">🤖 AI Interview (Dynamic)</SelectItem>
                  <SelectItem value="structured">📋 Structured Interview (Pre-defined)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                AI Interview: Questions generated dynamically based on candidate responses<br/>
                Structured Interview: Pre-defined questions set by HR
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interview Summary Section - Only for AI Interviews */}
      {formData.position && Object.keys(customParameters).length > 0 && formData.interviewMode === 'ai' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Interview Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
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
            </div>
            
            {/* Editable Duration and Questions Fields */}
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
                  💡 Formula: Sum of (questions × (answer time + 0.5 min reading)) for each parameter + 2 min buffer = {formData.duration} min
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
          </CardContent>
        </Card>
      )}

      {/* Weightage Summary Section - Only for AI Interviews */}
      {formData.position && Object.keys(customParameters).length > 0 && formData.interviewMode === 'ai' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Parameter Weightage Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total Weightage Display */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-green-600 font-medium text-lg">Total Weightage</div>
                  <div className={`text-3xl font-bold ${calculateTotalWeightage() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculateTotalWeightage()}%
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  calculateTotalWeightage() === 100 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {calculateTotalWeightage() === 100 ? '✓ Balanced' : '⚠️ Unbalanced'}
                </div>
              </div>
              
              {/* Weightage Status Message */}
              <div className={`mt-2 text-sm ${
                calculateTotalWeightage() === 100 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {calculateTotalWeightage() === 100 
                  ? '✅ All parameters are properly balanced with 100% total weightage.'
                  : `⚠️ Total weightage should equal 100%. Currently ${calculateTotalWeightage()}%. Please adjust parameter weights.`
                }
              </div>
            </div>
            
            {/* Individual Parameter Weightages */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(customParameters).map(([key, param]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700 truncate" title={param.name}>
                      {param.name}
                    </div>
                    <div className={`text-lg font-bold ${
                      param.weight > 0 ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {param.weight}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${param.weight}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Weightage Distribution Chart */}
            {Object.keys(customParameters).length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Weightage Distribution</div>
                <div className="flex h-8 rounded-lg overflow-hidden">
                  {Object.entries(customParameters).map(([key, param], index) => (
                    <div
                      key={key}
                      className="h-full transition-all duration-300 hover:opacity-80"
                      style={{ 
                        width: `${param.weight}%`,
                        backgroundColor: getWeightageColor(index, param.weight)
                      }}
                      title={`${param.name}: ${param.weight}%`}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assessment Parameters Section - Only for AI Interviews */}
      {formData.interviewMode === 'ai' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Assessment Parameters for {formData.position || 'Selected Role'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-3">
              <Button
                onClick={saveParameters}
                disabled={isSavingParameters || Object.keys(customParameters).length === 0}
                variant="outline"
                className="flex items-center gap-2"
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
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setCustomParameters({});
                  setParametersSaved(false);
                  toast({
                    title: "Parameters Cleared",
                    description: "Parameters cleared successfully!",
                  });
                }}
                disabled={Object.keys(customParameters).length === 0}
                variant="destructive"
                className="flex items-center gap-2"
                title="Clear all current parameters"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {Object.keys(customParameters).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(customParameters).map(([key, param]) => (
                <Card key={key} className="bg-gray-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-lg font-semibold text-gray-900 px-2 py-1">
                          {param.name}
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full mb-4 p-3 bg-white rounded border text-gray-700">
                      {param.description}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>Weight (%)</Label>
                        <div className="p-2 bg-white rounded border text-gray-700 font-medium">
                          {param.weight}%
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Min Questions</Label>
                        <div className="p-2 bg-white rounded border text-gray-700 font-medium">
                          {param.min_questions}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Questions</Label>
                        <div className="p-2 bg-white rounded border text-gray-700 font-medium">
                          {param.max_questions}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Answer Time (min)</Label>
                        <div className="p-2 bg-white rounded border text-gray-700 font-medium">
                          {param.max_time || 3}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Level</Label>
                        <div className="p-2 bg-white rounded border text-gray-700 font-medium">
                          {param.level || 'Regular'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Scoring Criteria Section */}
                    {param.scoring_criteria && Array.isArray(param.scoring_criteria) && param.scoring_criteria.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label>Scoring Criteria</Label>
                        </div>
                        <div className="space-y-2">
                          {param.scoring_criteria.map((criteria, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="flex-1 p-2 bg-white rounded border text-sm text-gray-700">
                                {criteria}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No assessment parameters configured yet.</p>
              <p className="text-gray-400">Select a role to load existing parameters.</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Create Interview Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary-600" />
            Create Interview
          </CardTitle>
          <CardDescription>
            Generate the interview link for your candidate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={createInterview}
            disabled={isCreating}
            className="w-full"
            size="lg"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Creating Interview...
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 mr-2" />
                Create Interview
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Interview Links Section */}
      {createdInterviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Interview Links ({createdInterviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Individual Interview Links */}
            {createdInterviews.map((interview, index) => (
              <div key={interview.interview_id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800">
                    {interview.candidate_name} ({interview.candidate_email})
                  </p>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Interview {index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    value={`${window.location.origin}/interview/${interview.interview_id}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => copyInterviewLink(interview.interview_id)}
                    size="sm"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    onClick={() => {
                      const interviewType = formData.interviewType || 'mixed';
                      const interviewLink = `${window.location.origin}/interview/${interview.interview_id}`;
                      const template = getEmailTemplate(interview.candidate_name, interviewType, interviewLink);
                      const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(interview.candidate_email)}&su=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
                      window.open(gmailLink, '_blank');
                    }}
                    size="sm"
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send Gmail
                  </Button>
                </div>
              </div>
            ))}
            
            
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-medium text-blue-800">Total Interviews</p>
                <p className="text-blue-600 font-mono">{createdInterviews.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="font-medium text-green-800">Status</p>
                <p className="text-green-600">Ready for candidates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HRInterviewCreator;
