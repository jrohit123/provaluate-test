import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart3, User, Eye, Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Filter, Check, Briefcase, Grid } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import { useCurrentStep, useNavigateToStep, WORKFLOW_STEPS } from '@/hooks/useWorkflowNavigation';
import { saveAs } from 'file-saver';

interface Candidate {
  id: string;
  name: string;
  overallScore: number;
  scores: {
    parameter: string;
    score: number;
    weightage: number;
    maxScore: number;
  }[];
  status: string;
  recommendation?: string;
  detailedAssessment?: string;
  resumeUrl?: string;
  createdAt?: string;
}

interface MatchScorecardSectionProps {
  onCandidateSelect: (candidateId: string) => void;
  selectedCandidateId?: string;
  selectedCandidateData?: any;
  onClose?: () => void;
  onSectionReady?: () => void;
}

export const MatchScorecardSection = ({ onCandidateSelect, selectedCandidateId, selectedCandidateData, onClose, onSectionReady }: MatchScorecardSectionProps) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to descending (highest first)
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all');
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>(() => sessionStorage.getItem('selectedJDId') || '');
  const [criteriaGrids, setCriteriaGrids] = useState<any[]>([]);
  const [selectedCriteriaGridId, setSelectedCriteriaGridId] = useState<string>(() => sessionStorage.getItem('selectedCriteriaGridId') || '');
  const currentStep = useCurrentStep();
  const navigateToStep = useNavigateToStep();

  // Keep local state in sync with sessionStorage resets (e.g., on login/logout)
  useEffect(() => {
    const handleSessionCleared = () => {
      const jd = sessionStorage.getItem('selectedJDId') || '';
      const grid = sessionStorage.getItem('selectedCriteriaGridId') || '';
      setSelectedJobDescriptionId(jd);
      setSelectedCriteriaGridId(grid);
    };
    window.addEventListener('session:cleared', handleSessionCleared);
    return () => window.removeEventListener('session:cleared', handleSessionCleared);
  }, []);

  // ✅ ADD: Re-read from sessionStorage when component mounts or becomes visible
  // This ensures JD and criteria selected in extension are reflected in main app
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
  const { user } = useAuth();
  const { toast } = useToast();

  // Add helper function to extract recommendation status
  const extractRecommendationStatus = (recommendation: string | undefined): string => {
    if (!recommendation) return 'Under Review';
    
    // Look for specific phrases in the recommendation text
    const lowerCaseRec = recommendation.toLowerCase();
    if (lowerCaseRec.includes('to be interviewed')) return 'To Be Interviewed';
    if (lowerCaseRec.includes('candidature rejected')) return 'Candidature Rejected';
    if (lowerCaseRec.includes('review further')) return 'Review Further';
    
    return 'Under Review';
  };

  // Add helper function to get status style
  const getRecommendationStyle = (status: string): string => {
    switch (status) {
      case 'To Be Interviewed':
        return 'bg-green-100 text-green-700';
      case 'Candidature Rejected':
        return 'bg-red-100 text-red-700';
      case 'Review Further':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-[#094D7B]/15 text-[#094D7B]';
    }
  };

  // Handle checkbox change for creating interview
  // Function to fetch email from resumes table
  const fetchCandidateEmail = async (resumeUrl: string) => {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('evaluation_scores')
        .eq('cv_file', resumeUrl)
        .single();
      
      if (data && !error) {
        // Check if evaluation_scores is a string that needs parsing
        let evalData = data.evaluation_scores;
        if (typeof evalData === 'string') {
          evalData = JSON.parse(evalData);
        }
        
        // Extract email from the JSON structure
        const email = evalData?.analysis_result?.properties?.email;
        return email || '';
      }
    } catch (error) {
      console.error('Error fetching email:', error);
    }
    return '';
  };

  const handleCreateInterviewCheck = async (candidateId: string, candidateName: string, checked: boolean) => {
    const newSelectedCandidates = new Set(selectedCandidates);
    
    if (checked) {
      newSelectedCandidates.add(candidateId);
      
      // Find the candidate to get resume URL
      const candidate = candidates.find(c => c.id === candidateId);
      if (candidate && candidate.resumeUrl) {
        // Fetch email from database
        const email = await fetchCandidateEmail(candidate.resumeUrl);
        
        // Store candidate data with email
        const candidateData = { name: candidateName, email: email };
        const existingData = JSON.parse(sessionStorage.getItem('selectedCandidatesForInterview') || '[]');
        existingData.push(candidateData);
        sessionStorage.setItem('selectedCandidatesForInterview', JSON.stringify(existingData));
        
        toast({
          title: "Candidate Selected",
          description: `Selected ${candidateName}. Email: ${email || 'Not found'}`,
        });
      } else {
        // Fallback if no resume URL
        const candidateData = { name: candidateName, email: '' };
        const existingData = JSON.parse(sessionStorage.getItem('selectedCandidatesForInterview') || '[]');
        existingData.push(candidateData);
        sessionStorage.setItem('selectedCandidatesForInterview', JSON.stringify(existingData));
        
        toast({
          title: "Candidate Selected",
          description: `Selected ${candidateName}. Email: Not available`,
        });
      }
    } else {
      newSelectedCandidates.delete(candidateId);
      
      // Remove from sessionStorage
      const existingData = JSON.parse(sessionStorage.getItem('selectedCandidatesForInterview') || '[]');
      const updatedData = existingData.filter(c => c.name !== candidateName);
      sessionStorage.setItem('selectedCandidatesForInterview', JSON.stringify(updatedData));
      
      toast({
        title: "Candidate Deselected",
        description: `Removed ${candidateName}. Total selected: ${newSelectedCandidates.size}`,
      });
    }
    
    setSelectedCandidates(newSelectedCandidates);
    
    // Clear sessionStorage if no candidates selected
    if (newSelectedCandidates.size === 0) {
      sessionStorage.removeItem('selectedCandidatesForInterview');
      toast({
        title: "Selection Cleared",
        description: "No candidates selected for interview",
      });
    }
  };

  // Update the useEffect where candidate data is processed
  useEffect(() => {
    if (selectedCandidateData) {
      console.log('Processing selected candidate data:', selectedCandidateData);
      
      // Handle scoring field - it might be a string or jsonb
      let scoringText = '';
      if (typeof selectedCandidateData.scoring === 'string') {
        scoringText = selectedCandidateData.scoring;
      } else if (selectedCandidateData.scoring && typeof selectedCandidateData.scoring === 'object') {
        scoringText = JSON.stringify(selectedCandidateData.scoring);
      }
      
      const { scores, overallScore } = parseScoringText(scoringText);
      
      // Use final_match from database if available (0-10 scale), convert to percentage
      const finalScore = selectedCandidateData.final_match !== null && selectedCandidateData.final_match !== undefined
        ? Math.round(selectedCandidateData.final_match * 10) // Convert 0-10 scale to percentage (7.5 -> 75%)
        : overallScore;
      
      // Extract recommendation status
      const recommendationStatus = extractRecommendationStatus(selectedCandidateData.recommendation);

      const candidate: Candidate = {
        id: selectedCandidateData.id,
        name: selectedCandidateData.candidate_name || 'Unknown Candidate',
        overallScore: finalScore,
        scores,
        status: recommendationStatus,
        recommendation: selectedCandidateData.recommendation,
        detailedAssessment: selectedCandidateData.detailed_assessment,
        resumeUrl: selectedCandidateData.resume_url,
        createdAt: selectedCandidateData.created_at
      };

      setCandidates([candidate]);
      setLoading(false);
      return;
    }
  }, [selectedCandidateData]);

  // Parse scoring text to extract individual scores
  const parseScoringText = (scoringText: string) => {
    const scores: { parameter: string; score: number; weightage: number; maxScore: number }[] = [];
    let overallScore = 0;

    if (!scoringText) return { scores, overallScore };

    try {
      // First try to parse as JSON (our new format)
      const scoringData = JSON.parse(scoringText);
      
      if (scoringData.parameter_scores && scoringData.final_score) {
        // Extract individual parameter scores
        Object.entries(scoringData.parameter_scores).forEach(([parameter, data]: [string, any]) => {
          if (data && typeof data === 'object' && 'score' in data && 'weightage' in data) {
            scores.push({
              parameter: parameter,
              score: data.score,
              weightage: data.weightage,
              maxScore: 10 // Scores are out of 10
            });
          }
        });
        
        // Use the final_score from JSON
        overallScore = Math.round((scoringData.final_score / 10) * 100); // Convert to percentage (7.8 -> 78%)
        console.log('Parsed JSON scoring - overallScore:', overallScore, 'from final_score:', scoringData.final_score);
        return { scores, overallScore };
      }
    } catch (e) {
      console.log('Not JSON format, trying text parsing...');
    }

    // Fallback to original text parsing for backward compatibility
    const lines = scoringText.split('\n');

    lines.forEach(line => {
      // Parse lines like "Technical Skills: 10 x 30% = 3.0"
      const match = line.match(/^(.+?):\s*(\d+)\s*x\s*(\d+)%?\s*=\s*([\d.]+)/);
      if (match) {
        const [, parameter, scoreStr, weightageStr] = match;
        const score = parseInt(scoreStr);
        const weightage = parseInt(weightageStr);

        scores.push({
          parameter: parameter.trim(),
          score,
          weightage,
          maxScore: 10 // Scores are out of 10
        });
      }
    });

    return { scores, overallScore };
  };

  // Fetch assessment reports from Supabase (only when no specific candidate data is provided)
  const fetchAssessmentReports = useCallback(async () => {
    if (selectedCandidateData) {
      // Don't fetch all reports if we have specific candidate data
      return;
    }
    
    // Use company_id from profile or fall back to user's company_id
    const companyId = user?.profile?.company_id || user?.company?.company_id;
    
    if (!companyId) {
      console.log('No company_id available, skipping fetch');
      console.log('User object:', user);
      return;
    }

    try {
      setLoading(true);
      
      console.log('Current user:', user);
      console.log('Company ID:', companyId);
      
      // Use current state values instead of session storage for real-time updates
      console.log('Current state - Selected JD ID:', selectedJobDescriptionId);
      console.log('Current state - Selected Criteria Grid ID:', selectedCriteriaGridId);

      if (!selectedJobDescriptionId || !selectedCriteriaGridId) {
        console.log('No JD or criteria selected in current state, showing empty state');
        setCandidates([]);
        setLoading(false);
        return;
      }

      // First, get the resolved_jd_id for the selected job description
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .select('jd_file')
        .eq('jd_id', selectedJobDescriptionId)
        .single();

      if (jdError || !jdData?.jd_file) {
        console.log('No JD file found for ID:', selectedJobDescriptionId);
        setCandidates([]);
        setLoading(false);
        return;
      }

      console.log('Found JD file URL:', jdData.jd_file);

      // Then get the resolved_jd_id using the file URL
      const { data: resolvedJdData, error: resolvedJdError } = await supabase
        .from('resolved_jd')
        .select('resolved_jd_id')
        .eq('referenced_jd', jdData.jd_file)
        .single();

      if (resolvedJdError || !resolvedJdData?.resolved_jd_id) {
        console.log('No resolved JD found for file URL:', jdData.jd_file);
        setCandidates([]);
        setLoading(false);
        return;
      }

      console.log('Found resolved_jd_id:', resolvedJdData.resolved_jd_id);

      // Finally, fetch assessment reports using resolved_jd_id and criteria_id
      const { data: reports, error } = await supabase
        .from('assessment_reports')
        .select('*')
        .eq('resolved_jd_id', resolvedJdData.resolved_jd_id)
        .eq('criteria_id', selectedCriteriaGridId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }
      
      console.log('Fetched reports for selected JD and criteria:', reports);
      console.log('Number of matching reports:', reports?.length || 0);

      const formattedCandidates: Candidate[] = (reports || []).map(report => {
        console.log('Processing report:', report.id, report.candidate_name);
        console.log('Report scoring field:', report.scoring);
        console.log('Report scoring type:', typeof report.scoring);
        console.log('Report final_match:', report.final_match);
        console.log('Report recommendation:', report.recommendation);
        
        // Handle scoring field - it might be a string or jsonb
        let scoringText = '';
        if (typeof report.scoring === 'string') {
          scoringText = report.scoring;
        } else if (report.scoring && typeof report.scoring === 'object') {
          // If it's a JSON object, try to extract text or convert to string
          scoringText = JSON.stringify(report.scoring);
        }
        
        const { scores, overallScore } = parseScoringText(scoringText);
        console.log('Parsed scores:', scores);
        
        // Use final_match from database (0-10 scale), convert to percentage
        const finalScore = report.final_match !== null && report.final_match !== undefined 
          ? Math.round(report.final_match * 10) 
          : overallScore;
        
        console.log('Final score used:', finalScore);
        
        // Extract recommendation status from recommendation text
        const recommendationStatus = extractRecommendationStatus(report.recommendation);
        console.log('Extracted recommendation status:', recommendationStatus);

        return {
          id: report.id,
          name: report.candidate_name || 'Unknown Candidate',
          overallScore: finalScore,
          scores,
          status: recommendationStatus,
          recommendation: report.recommendation,
          detailedAssessment: report.detailed_assessment,
          resumeUrl: report.resume_url,
          createdAt: report.created_at
        };
      });

      setCandidates(formattedCandidates);
    } catch (error) {
      console.error('Error fetching assessment reports:', error);
      toast({
        title: "Error Loading Assessment Reports",
        description: "Failed to load candidate evaluation data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user?.profile?.company_id, user?.company?.company_id, selectedJobDescriptionId, selectedCriteriaGridId, toast]);

  // Load job descriptions from database
  const loadJobDescriptions = useCallback(async () => {
    console.log('loadJobDescriptions called, user:', user);
    console.log('Company ID:', user?.profile?.company_id);
    
    if (!user?.profile?.company_id) {
      console.log('No company_id, returning early');
      return;
    }
    
    try {
      console.log('Fetching job descriptions...');
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, jd_file, created_at, status')
        .eq('company_id', user.profile.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      console.log('Job descriptions loaded:', data);
      console.log('Job descriptions array length:', data?.length);
      console.log('First job description:', data?.[0]);
      setJobDescriptions(data || []);
    } catch (error) {
      console.error('Error loading job descriptions:', error);
    }
  }, [user?.profile?.company_id]);

  // Load criteria grids from database, filtered by selected JD
  const loadCriteriaGrids = useCallback(async () => {
    console.log('loadCriteriaGrids called, user:', user);
    console.log('User ID:', user?.id);
    console.log('Company ID:', user?.profile?.company_id);
    console.log('Selected JD ID:', selectedJobDescriptionId);
    
    if (!user?.id) {
      console.log('No user ID, returning early');
      return;
    }

    try {
      console.log('Fetching criteria grids...');
      
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
      
      if (error) throw error;
      
      if (!grids || grids.length === 0) {
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

      // Convert to format with criteria count
      const formattedGrids = Object.values(uniqueGrids).map((grid: any) => {
        let criteriaCount = 0;
        if (grid.grid && Array.isArray(grid.grid)) {
          criteriaCount = grid.grid.length;
        }
        return {
          id: grid.criteria_id,
          name: grid.criteria_name,
          criteriaCount
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
      console.log('Criteria grids array length:', sortedGrids.length);
      console.log('First criteria grid:', sortedGrids[0]);
      setCriteriaGrids(sortedGrids);
    } catch (error) {
      console.error('Error loading criteria grids:', error);
    }
  }, [user?.id, user?.profile?.company_id, selectedJobDescriptionId]);

  // Handle job description selection
  const handleJobDescriptionSelect = async (jdId: string) => {
    setSelectedJobDescriptionId(jdId);
    sessionStorage.setItem('selectedJDId', jdId);
    
    const selectedJD = jobDescriptions.find(jd => jd.jd_id === jdId);
    
    // Reload criteria grids filtered by selected JD
    await loadCriteriaGrids();
    
    toast({
      title: "Job Description Selected",
      description: `Selected: ${selectedJD?.title || 'Unknown Job'}. Showing relevant criteria.`,
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

  useEffect(() => {
    console.log('useEffect triggered, user:', user);
    console.log('Company ID:', user?.profile?.company_id);
    console.log('User profile:', user?.profile);
    
    // Use company_id from profile or fall back to user's company_id
    const companyId = user?.profile?.company_id || user?.company?.company_id;
    console.log('Final Company ID:', companyId);
    
    if (companyId) {
      console.log('Calling fetchAssessmentReports...');
      fetchAssessmentReports();
    } else {
      console.log('No company_id, not fetching reports');
      setLoading(false);
    }
  }, [user?.profile?.company_id, user?.company?.company_id, fetchAssessmentReports, selectedCandidateData]);


  // Apply sorting and filtering whenever candidates, sortOrder, or recommendationFilter changes
  useEffect(() => {
    let filtered = [...candidates];
    
    // Apply recommendation filter
    if (recommendationFilter !== 'all') {
      filtered = filtered.filter(candidate => candidate.status === recommendationFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.overallScore - a.overallScore; // Highest first
      } else {
        return a.overallScore - b.overallScore; // Lowest first
      }
    });
    
    setFilteredCandidates(filtered);
  }, [candidates, sortOrder, recommendationFilter]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => onSectionReady?.(), 400);
    return () => clearTimeout(t);
  }, [loading, onSectionReady]);

  // Load job descriptions and criteria grids when component mounts
  useEffect(() => {
    console.log('useEffect for loading data triggered, user:', user);
    console.log('Company ID:', user?.profile?.company_id);
    
    if (user?.profile?.company_id) {
      console.log('Loading job descriptions and criteria grids...');
      loadJobDescriptions();
      loadCriteriaGrids();
    } else {
      console.log('No company_id, not loading data');
    }
  }, [user?.profile?.company_id, loadJobDescriptions, loadCriteriaGrids]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-accent-100 text-accent-800';
      case 'good':
        return 'bg-yellow-100 text-yellow-800';
      case 'nomatch':
        return 'bg-orange-100 text-orange-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 9) return 'bg-accent-500';
    if (score >= 7) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  // Parse detailed_assessment into Strengths (green), Ambiguous (yellow), Weaknesses (red), Overall Summary (blue)
  const parseDetailedAssessment = (text: string): { strengths: string[]; ambiguous: string[]; weaknesses: string[]; overallSummary: string } | null => {
    if (!text || !text.trim()) return null;
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const strengths: string[] = [];
    const ambiguous: string[] = [];
    const weaknesses: string[] = [];
    let overallSummary = '';
    const strengthHeaders = ['Strengths:', 'Key Strengths:'];
    const ambiguousHeaders = ['Ambiguous:'];
    const weaknessHeaders = ['Weaknesses:', 'Notable Gaps:'];
    const overallHeaders = ['Overall Summary:', 'Experience Relevance:', 'Employment History:', 'Overall Fit Assessment:'];
    type Section = 'strengths' | 'ambiguous' | 'weaknesses' | 'overall';
    let currentSection: Section | null = null;
    const isBullet = (line: string) => /^[-*]\s*/.test(line.trim()) || line.trim().startsWith('•');

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      const clean = trimmed.replace(/\*/g, '').trim();
      const lineLower = clean.toLowerCase();

      if (strengthHeaders.some(h => lineLower === h.toLowerCase() || lineLower.startsWith(h.toLowerCase()))) {
        currentSection = 'strengths';
        continue;
      }
      if (ambiguousHeaders.some(h => lineLower === h.toLowerCase() || lineLower.startsWith(h.toLowerCase()))) {
        currentSection = 'ambiguous';
        continue;
      }
      if (weaknessHeaders.some(h => lineLower === h.toLowerCase() || lineLower.startsWith(h.toLowerCase()))) {
        currentSection = 'weaknesses';
        continue;
      }
      if (overallHeaders.some(h => lineLower === h.toLowerCase() || lineLower.startsWith(h.toLowerCase()))) {
        currentSection = 'overall';
        continue;
      }

      if (!currentSection) continue;

      if (currentSection === 'overall') {
        if (trimmed) overallSummary += (overallSummary ? '\n\n' : '') + clean;
      } else {
        if (isBullet(raw)) {
          const bulletText = trimmed.replace(/^[-*•]\s*/, '').replace(/\*/g, '').trim();
          if (bulletText && currentSection === 'strengths') strengths.push(bulletText);
          else if (bulletText && currentSection === 'ambiguous') ambiguous.push(bulletText);
          else if (bulletText && currentSection === 'weaknesses') weaknesses.push(bulletText);
        }
      }
    }

    const hasAny = strengths.length > 0 || ambiguous.length > 0 || weaknesses.length > 0 || overallSummary.trim().length > 0;
    return hasAny ? { strengths, ambiguous, weaknesses, overallSummary: overallSummary.trim() } : null;
  };

  // Render detailed_assessment with green (strengths), yellow (ambiguous), red (weaknesses), blue (overall summary) — one combined box per section, no icons
  const renderColoredSummary = (text: string) => {
    const parsed = parseDetailedAssessment(text);
    if (parsed) {
      return (
        <div className="space-y-4 text-left">
          {parsed.strengths.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4">
              <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Strengths</h5>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-800">
                {parsed.strengths.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed.ambiguous.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
              <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Ambiguous</h5>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-800">
                {parsed.ambiguous.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed.weaknesses.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 sm:p-4">
              <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Shortcomings</h5>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-800">
                {parsed.weaknesses.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed.overallSummary && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
              <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Overall Summary</h5>
              <p className="text-sm text-gray-800 whitespace-pre-line">{parsed.overallSummary}</p>
            </div>
          )}
        </div>
      );
    }
    return renderSummaryText(text);
  };

  // Function to process summary text - handle JSON/object/array gracefully, remove asterisks and format headings
  const processSummaryText = (text: string) => {
    if (!text) return [];
    
    // Try to detect and format JSON summaries into readable text
    try {
      const looksLikeJson = typeof text === 'string' && /^(\s*\{|\s*\[)/.test(text);
      if (looksLikeJson) {
        const parsed: any = JSON.parse(text);

        const lines: Array<{ type: 'heading' | 'text'; text: string }> = [];

        const pushHeading = (t: string) => {
          const heading = t.trim().endsWith(':') ? t.trim() : `${t.trim()}:`;
          lines.push({ type: 'heading', text: heading });
        };
        const pushBullets = (arr: any[]) => {
          arr.forEach((item) => {
            if (item == null) return;
            const s = typeof item === 'string' ? item : JSON.stringify(item);
            const clean = s.replace(/[\n\r]+/g, ' ').trim();
            if (clean) lines.push({ type: 'text', text: `- ${clean}` });
          });
        };
        const pushText = (label: string, value: any) => {
          if (value == null) return;
          const s = typeof value === 'string' ? value : JSON.stringify(value);
          const clean = s.replace(/[\n\r]+/g, ' ').trim();
          if (!clean) return;
          if (label) pushHeading(label);
          lines.push({ type: 'text', text: clean });
        };

        if (Array.isArray(parsed)) {
          pushBullets(parsed);
          return lines;
        }

        if (parsed && typeof parsed === 'object') {
          // Render common keys in a sensible order
          const preferredOrder = [
            'Summary',
            'Strengths',
            'Key Strengths',
            'Ambiguous',
            'Weaknesses',
            'Notable Gaps',
            'Experience Relevance',
            'Employment History',
            'Overall Fit Assessment',
            'Overall Summary',
            'Recommendation'
          ];

          const keys = [
            ...preferredOrder.filter((k) => k in parsed),
            ...Object.keys(parsed).filter((k) => !preferredOrder.includes(k))
          ];

          keys.forEach((key) => {
            const value = parsed[key];
            if (Array.isArray(value)) {
              pushHeading(key);
              pushBullets(value);
            } else if (value && typeof value === 'object') {
              pushHeading(key);
              // Flatten simple objects as key: value lines
              Object.entries(value).forEach(([k, v]) => {
                if (v == null) return;
                const s = typeof v === 'string' ? v : JSON.stringify(v);
                const clean = s.replace(/[\n\r]+/g, ' ').trim();
                if (clean) lines.push({ type: 'text', text: `${k}: ${clean}` });
              });
            } else {
              pushText(key, value);
            }
          });

          return lines;
        }
      }
    } catch (e) {
      // Not JSON or failed to parse; continue with plaintext handling
    }

    // Split text into lines
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      const trimmedLine = line.trim();
      
      // First remove all asterisks from the line
      const cleanLine = trimmedLine.replace(/\*/g, '');
      
      // Define known heading keywords
      const headingKeywords = [
        'Core Experience Mismatch',
        'Educational Qualification Gap', 
        'Functional Skill Discrepancy',
        'Technical Tooling Mismatch',
        'Geographical Mismatch',
        'Experience Mismatch',
        'Qualification Gap',
        'Skill Discrepancy',
        'Tooling Mismatch'
      ];
      
      // Check if this line starts with a known heading keyword followed by colon
      for (const keyword of headingKeywords) {
        if (cleanLine.startsWith(keyword + ':')) {
          // Split at the first colon to separate heading from content
          const colonIndex = cleanLine.indexOf(':');
          const headingText = cleanLine.substring(0, colonIndex + 1);
          const contentText = cleanLine.substring(colonIndex + 1).trim();
          
          return [
            {
              type: 'heading',
              text: headingText
            },
            ...(contentText ? [{
              type: 'text', 
              text: contentText
            }] : [])
          ];
        }
      }
      
      // If not a heading, return as regular text
      if (cleanLine.trim()) {
        return {
          type: 'text',
          text: cleanLine
        };
      }
      
      return null;
    }).flat().filter(Boolean);
    
    return processedLines;
  };

  // Component to render processed summary text
  const renderSummaryText = (text: string) => {
    const processedLines = processSummaryText(text);
    
    return (
      <div className="space-y-2">
        {processedLines.map((line, index) => {
          if (line.type === 'heading') {
            return (
              <div key={index} className="mt-3 first:mt-0">
                <strong className="text-sm font-bold text-[#094D7B]" style={{ fontWeight: '700', fontSize: '14px' }}>
                  {line.text}
                </strong>
              </div>
            );
          } else {
            // Only render non-empty lines
            if (line.text && line.text.trim()) {
              return (
                <p key={index} className="text-sm text-gray-700 ml-0">
                  {line.text}
                </p>
              );
            }
            return null;
          }
        })}
      </div>
    );
  };

  // Function to clean text for export (remove asterisks)
  const cleanTextForExport = (text: string) => {
    if (!text) return 'N/A';
    return text.replace(/\*/g, '');
  };

  const flattenRecommendationForExport = (text: string): string => {
    if (!text) return 'N/A';

    // Try to parse as JSON
    try {
      const looksLikeJson = typeof text === 'string' && /^(\s*\{|\s*\[)/.test(text.trim());
      if (looksLikeJson) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const lines: string[] = [];
          const preferredOrder = ['Classification', 'Rationale', 'Follow-up actions'];
          const keys = [
            ...preferredOrder.filter(k => k in parsed),
            ...Object.keys(parsed).filter(k => !preferredOrder.includes(k))
          ];
          keys.forEach(key => {
            const value = parsed[key];
            if (Array.isArray(value)) {
              lines.push(`${key}:`);
              value.forEach((item: any) => lines.push(`- ${String(item).trim()}`));
            } else if (value != null) {
              lines.push(`${key}: ${String(value).trim()}`);
            }
          });
          return lines.join('\n');
        }
      }
    } catch (e) {
      // Not JSON, fall through
    }

    // Plain text fallback — just strip asterisks
    return text.replace(/\*/g, '');
  };

  // Function to format date for export (dd-mmm-yy hh:mm) - preserves UTC time
  const formatDateForExport = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getUTCDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const year = date.getUTCFullYear().toString().slice(-2);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const handleExportReport = async () => {
  try {
    const XLSX = await import('xlsx-js-style');
    
    const candidatesToExport = selectedCandidateData ? candidates : displayCandidates;
    
    // Prepare data for summary sheet
    const summaryData = await Promise.all(
      candidatesToExport.map(async (candidate) => {
        let candidateEmail = '';
        try {
          if (candidate.resumeUrl) {
            const { data } = await supabase
              .from('resumes')
              .select('evaluation_scores')
              .eq('cv_file', candidate.resumeUrl)
              .single();
            
            if (data && data.evaluation_scores) {
              const evalData = typeof data.evaluation_scores === 'string' 
                ? JSON.parse(data.evaluation_scores) 
                : data.evaluation_scores;
              candidateEmail = evalData?.analysis_result?.properties?.email || '';
            }
          }
        } catch (error) {
          console.error('Error fetching email:', error);
        }

        return [
          candidate.name,
          candidateEmail,
          candidate.overallScore.toString(),
          formatDateForExport(candidate.createdAt || ''),
          flattenRecommendationForExport(candidate.recommendation || ''),
          cleanTextForExport(candidate.detailedAssessment || '')
        ];
      })
    );

    // Add header row
    summaryData.unshift([
      'Candidate Name',
      'Email',
      'Overall Score (%)',
      'Assessed at',
      'Recommendation',
      'Summary'
    ]);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },  // Candidate Name
      { wch: 25 },  // Email
      { wch: 18 },  // Score
      { wch: 20 },  // Date
      { wch: 30 },  // Recommendation ← CHANGED from 60 to 30
      { wch: 80 }   // Summary
    ];

    // Calculate row heights based on content
    const rowHeights = [];
    summaryData.forEach((row, idx) => {
      let maxHeight = 20; // minimum height
      
      row.forEach((cell, colIdx) => {
        const cellText = cell?.toString() || '';
        const colWidth = ws['!cols'][colIdx].wch;
        
        // Estimate lines needed
        const charsPerLine = colWidth * 1.2; // Excel character formula
        const lines = cellText.split('\n');
        let totalLines = 0;
        
        lines.forEach(line => {
          totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
        });
        
        // Calculate height (1 line ≈ 15-20 pixels)
        const cellHeight = totalLines * 18;
        maxHeight = Math.max(maxHeight, cellHeight);
      });
      
      rowHeights.push({ hpx: maxHeight });
    });

    // Set row heights
    ws['!rows'] = rowHeights;

    // Style cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;

        // Header row styling
        if (R === 0) {
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        } else {
          // Data row styling
          ws[cellAddress].s = {
            font: { sz: 11 },
            alignment: { 
              vertical: "top", 
              horizontal: C === 2 ? "center" : "left", 
              wrapText: true 
            },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
          
          // Alternate row colors
          if (R % 2 === 0) {
            ws[cellAddress].s.fill = { fgColor: { rgb: "F2F2F2" } };
          }
        }
      }
    }

    // Create detailed scoring sheet
    const detailedData = [['Candidate Name', 'Overall Score (%)', 'Parameter', 'Score (out of 10)', 'Weightage (%)', 'Weighted Score']];
    
    candidatesToExport.forEach(candidate => {
      candidate.scores.forEach(score => {
        detailedData.push([
          candidate.name,
          candidate.overallScore.toString(),
          score.parameter,
          score.score.toString(),
          score.weightage.toString(),
          parseFloat(((score.score * score.weightage) / 10).toFixed(2)).toString()
        ]);
      });
    });

    const ws2 = XLSX.utils.aoa_to_sheet(detailedData);
    ws2['!cols'] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 35 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 }
    ];

    // Style detailed sheet cells
    const detailedRange = XLSX.utils.decode_range(ws2['!ref']);
    for (let R = detailedRange.s.r; R <= detailedRange.e.r; ++R) {
      for (let C = detailedRange.s.c; C <= detailedRange.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws2[cellAddress]) continue;

        // Header row styling
        if (R === 0) {
          ws2[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        } else {
          // Data row styling
          ws2[cellAddress].s = {
            font: { sz: 11 },
            alignment: { 
              vertical: "top", 
              horizontal: C === 1 || C === 2 || C === 4 || C === 5 ? "center" : "left", 
              wrapText: true 
            },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
          
          // Alternate row colors
          if (R % 2 === 0) {
            ws2[cellAddress].s.fill = { fgColor: { rgb: "F2F2F2" } };
          }
        }
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidate Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detailed Scoring');

    // Generate filename
    const currentDate = new Date().toISOString().split('T')[0];
    let filename = `Match_Scorecard_Report_${currentDate}`;
    
    if (!selectedCandidateData) {
      const filterSuffix = recommendationFilter !== 'all' ? `_${recommendationFilter.replace(/\s+/g, '_')}` : '';
      const sortSuffix = `_sorted_${sortOrder}`;
      filename += `${filterSuffix}${sortSuffix}`;
    }
    
    filename += '.xlsx';

    // Write file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Export Successful",
      description: `Report exported as ${filename}`,
    });
  } catch (error) {
    console.error('Export error:', error);
    toast({
      title: "Export Failed",
      description: "There was an error exporting the report.",
      variant: "destructive"
    });
  }
};

  const handleSortToggle = () => {
    const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newSortOrder);
    toast({
      title: "Sort Order Changed",
      description: `Candidates sorted by ${newSortOrder === 'desc' ? 'highest' : 'lowest'} scores first.`,
    });
  };

  const handleRecommendationFilter = (value: string) => {
    setRecommendationFilter(value);
    const filterText = value === 'all' ? 'All candidates' : `${value} candidates only`;
    toast({
      title: "Filter Applied",
      description: filterText,
    });
  };

  // Get available recommendation statuses from current candidates
  const getAvailableRecommendations = () => {
    const statuses = [...new Set(candidates.map(candidate => candidate.status))];
    return statuses.filter(status => status && status !== 'Under Review');
  };


  // Use filteredCandidates for display
  const displayCandidates = filteredCandidates;

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
      
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-tour="match-scorecard-area">
      {/* Job Description and Criteria Grid Selection - Only Visible in Multi-Candidate Mode */}
      {!selectedCandidateData && (
        <div className="mb-4 sm:mb-6">
          {/* Single Row Layout for Desktop, Stacked for Mobile */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            {/* Job Description Selection */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 flex-1 lg:flex-initial lg:min-w-[200px]">
              <div className="flex items-center gap-2 lg:flex-shrink-0">
                <Briefcase className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Job:</span>
              </div>
              <Select value={selectedJobDescriptionId} onValueChange={handleJobDescriptionSelect}>
                <SelectTrigger className="w-full lg:w-auto lg:min-w-[200px] h-11 sm:h-10">
                  <SelectValue placeholder="Select job..." />
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
            </div>

            {/* Evaluation Criteria Selection */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 flex-1 lg:flex-initial lg:min-w-[200px]">
              <div className="flex items-center gap-2 lg:flex-shrink-0">
                <Grid className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Criteria:</span>
              </div>
              <Select value={selectedCriteriaGridId} onValueChange={handleCriteriaGridSelect}>
                <SelectTrigger className="w-full lg:w-auto lg:min-w-[200px] h-11 sm:h-10">
                  <SelectValue placeholder="Select criteria..." />
                </SelectTrigger>
                <SelectContent>
                  {criteriaGrids.map(grid => (
                    <SelectItem key={grid.id} value={grid.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{grid.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {grid.criteriaCount} parameters
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recommendation Filter */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 flex-1 lg:flex-initial lg:min-w-[150px]">
              <div className="flex items-center gap-2 lg:flex-shrink-0">
                <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Filter:</span>
              </div>
              <Select value={recommendationFilter} onValueChange={handleRecommendationFilter}>
                <SelectTrigger className="w-full lg:w-[150px] h-11 sm:h-10">
                  <SelectValue placeholder="All..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Recommendations</SelectItem>
                  {getAvailableRecommendations().map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Sort Button */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 lg:flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSortToggle} 
                className="w-full lg:w-auto h-11 sm:h-10"
              >
                {sortOrder === 'desc' ? (
                  <ArrowDown className="w-4 h-4 mr-2" />
                ) : (
                  <ArrowUp className="w-4 h-4 mr-2" />
                )}
                <span>Sort {sortOrder === 'desc' ? 'High-Low' : 'Low-High'}</span>
              </Button>
            </div>
            
            {/* Export Button */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 lg:flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportReport} 
                className="w-full lg:w-auto h-11 sm:h-10"
              >
                <Download className="w-4 h-4 mr-2" />
                <span>Export Report</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-primary-800 mb-1 sm:mb-2">
            {selectedCandidateData ? 'Candidate Assessment Details' : 'All Results'}
          </h2>
          <p className="text-muted-foreground">
            {selectedCandidateData 
              ? `Detailed assessment for ${selectedCandidateData.candidate_name || 'Unknown Candidate'}`
              : <>
                  Evaluation results and rankings <br />
                  ({displayCandidates.length} {recommendationFilter !== 'all' ? 'filtered' : ''} 
                   of {candidates.length} candidates)
                </>
            }
          </p>
        </div>
        {/* Show only export button when in single candidate mode */}
        {selectedCandidateData && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportReport}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-2 text-muted-foreground">Loading assessment reports...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && candidates.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Assessment Reports Found</h3>
          <p className="text-muted-foreground">
            {!selectedJobDescriptionId || !selectedCriteriaGridId 
              ? "Please select a Job Description and Evaluation Criteria to view assessment reports."
              : "No candidate evaluations found for the selected Job Description and Evaluation Criteria. Upload resumes and run evaluations to see results here."
            }
          </p>
        </div>
      )}

      {/* Assessment Reports */}
      {!loading && candidates.length > 0 && (
        <div className="grid gap-6">
          {displayCandidates.map((candidate) => (
            <Card key={candidate.id} className="p-4 sm:p-6 mb-4 sm:mb-6 shadow-md rounded-xl bg-white">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6 gap-4">
              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-[#094D7B] sm:h-6 sm:w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                    <h3 className="truncate text-lg font-bold text-[#094D7B] sm:text-xl">{candidate.name}</h3>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`create-interview-${candidate.id}`}
                        checked={selectedCandidates.has(candidate.id)}
                        onCheckedChange={(checked) => {
                          console.log('Checkbox clicked:', candidate.id, candidate.name, checked);
                          handleCreateInterviewCheck(candidate.id, candidate.name, checked as boolean);
                        }}
                        className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                      />
                      <label 
                        htmlFor={`create-interview-${candidate.id}`}
                        className="text-xs sm:text-sm font-medium text-gray-700 cursor-pointer select-none"
                        onClick={() => {
                          const checkbox = document.getElementById(`create-interview-${candidate.id}`) as HTMLInputElement;
                          if (checkbox) {
                            checkbox.click();
                          }
                        }}
                      >
                        {selectedCandidates.has(candidate.id) ? 'Selected' : 'Select for Interview'}
                      </label>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Overall Match Assessment</p>
                </div>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto">
                <div className="flex items-center gap-2 mb-1 justify-start sm:justify-end">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getRecommendationStyle(candidate.status)}`}>
                    {candidate.status}
                  </span>
                  <span className="text-2xl font-bold text-[#094D7B] sm:text-3xl">
                    {`${candidate.overallScore}%`}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500">Overall Score</p>
              </div>
            </div>

            {/* Scoring Section */}
            <div className="space-y-4">
              {candidate.scores
                .filter(score => score.parameter !== 'Overall Assessment')
                .map((score, idx) => {
                  const rawScore =
                    typeof score.score === 'number'
                      ? score.score
                      : parseFloat(score.score ?? 0);
                  const clampedScore = Number.isFinite(rawScore)
                    ? Math.max(0, Math.min(10, rawScore))
                    : 0;
                  const barWidth = clampedScore * 10;
                  const displayScore = Number(clampedScore.toFixed(1))
                    .toString()
                    .replace(/\.0$/, '');
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                        <span className="break-words text-sm font-medium text-[#094D7B] sm:text-base">
                          {score.parameter}
                        </span>
                        <div className="text-left sm:text-right">
                          <span className="text-base font-bold text-[#094D7B] sm:text-lg">
                            {displayScore}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500 sm:ml-4 block sm:inline">
                            Weight: {score.weightage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-[#094D7B] transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Overview card: one card, no gaps; coloured blocks with headers flow together */}
            {candidate.detailedAssessment && (() => {
              const parsed = parseDetailedAssessment(candidate.detailedAssessment);
              if (parsed) {
                return (
                  <div className="mt-4 sm:mt-6 rounded-lg border border-gray-300 overflow-hidden shadow-sm">
                    <div className="text-left">
                      {parsed.strengths.length > 0 && (
                        <div className="bg-green-50 px-3 sm:px-4 py-3">
                          <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Strengths</h5>
                          <div className="space-y-1.5 text-sm text-gray-800">
                            {parsed.strengths.map((item, i) => (
                              <p key={i} className="pl-0">- {item}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {parsed.ambiguous.length > 0 && (
                        <div className="bg-yellow-50 px-3 sm:px-4 py-3">
                          <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Clarifications</h5>
                          <div className="space-y-1.5 text-sm text-gray-800">
                            {parsed.ambiguous.map((item, i) => (
                              <p key={i} className="pl-0">- {item}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {parsed.weaknesses.length > 0 && (
                        <div className="bg-red-50 px-3 sm:px-4 py-3">
                          <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Shortcomings</h5>
                          <div className="space-y-1.5 text-sm text-gray-800">
                            {parsed.weaknesses.map((item, i) => (
                              <p key={i} className="pl-0">- {item}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {parsed.overallSummary && (
                        <div className="bg-blue-50 px-3 sm:px-4 py-3">
                          <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Summary</h5>
                          <p className="text-sm text-gray-800 whitespace-pre-line">{parsed.overallSummary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div className="mt-4 sm:mt-6 rounded-lg border border-gray-300 bg-gray-100/80 p-3 sm:p-4 shadow-sm">
                  <div className="text-left text-gray-800">{renderSummaryText(candidate.detailedAssessment)}</div>
                </div>
              );
            })()}

            {/* Recommendation (grey card) */}
            {candidate.recommendation && (
              <div className="mt-4 sm:mt-6 rounded-lg border border-gray-300 bg-gray-100/80 p-3 sm:p-4 shadow-sm">
                <h4 className="mb-3 text-sm font-semibold text-[#094D7B] sm:text-base">Recommendation</h4>
                <div className="text-gray-800">
                  {renderSummaryText(candidate.recommendation)}
                </div>
              </div>
            )}

          </Card>
        ))}
        </div>
      )}
      </div>
    </div>
  );
};
