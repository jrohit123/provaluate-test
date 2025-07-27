import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, User, Eye, Download, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

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
}

interface MatchScorecardSectionProps {
  onCandidateSelect: (candidateId: string) => void;
  selectedCandidateId?: string;
  selectedCandidateData?: any;
  onClose?: () => void;
}

export const MatchScorecardSection = ({ onCandidateSelect, selectedCandidateId, selectedCandidateData, onClose }: MatchScorecardSectionProps) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
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
        return 'bg-blue-100 text-blue-700';
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
      
      // Use final_match if available, otherwise use parsed overall score
      const finalScore = selectedCandidateData.final_match 
        ? Math.round(selectedCandidateData.final_match * 10) 
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
        resumeUrl: selectedCandidateData.resume_url
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
    
    if (!user?.profile?.company_id) {
      console.log('No company_id available, skipping fetch');
      console.log('User object:', user);
      return;
    }

    try {
      setLoading(true);
      
      console.log('Current user:', user);
      console.log('Company ID:', user.profile.company_id);
      
      // Get selected JD and criteria from session storage
      const selectedJDId = sessionStorage.getItem('selectedJDId');
      const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId');
      
      console.log('Session - Selected JD ID:', selectedJDId);
      console.log('Session - Selected Criteria Grid ID:', selectedCriteriaGridId);

      if (!selectedJDId || !selectedCriteriaGridId) {
        console.log('No JD or criteria selected in session, showing empty state');
        setCandidates([]);
        setLoading(false);
        return;
      }

      // First, get the resolved_jd_id for the selected job description
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .select('jd_file')
        .eq('jd_id', selectedJDId)
        .single();

      if (jdError || !jdData?.jd_file) {
        console.log('No JD file found for ID:', selectedJDId);
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
        console.log('Overall score:', overallScore);
        
        // Determine status based on overall score
        let status: string = 'Under Review'; // Default to Under Review
        if (report.status === 'completed' || overallScore > 0) {
          if (overallScore >= 85) status = 'Excellent Match';
          else if (overallScore >= 70) status = 'Good Match';
          else status = 'No Match';
        }

        return {
          id: report.id,
          name: report.candidate_name || 'Unknown Candidate',
          overallScore,
          scores,
          status,
          recommendation: report.recommendation,
          detailedAssessment: report.detailed_assessment,
          resumeUrl: report.resume_url
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
  }, [user?.profile?.company_id, toast]);

  useEffect(() => {
    console.log('useEffect triggered, user:', user);
    console.log('Company ID:', user?.profile?.company_id);
    
    if (user?.profile?.company_id) {
      console.log('Calling fetchAssessmentReports...');
      fetchAssessmentReports();
    } else {
      console.log('No company_id, not fetching reports');
    }
  }, [user?.profile?.company_id, fetchAssessmentReports, selectedCandidateData]);

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

  // Function to process summary text - remove asterisks and format headings
  const processSummaryText = (text: string) => {
    if (!text) return [];
    
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
                <strong className="text-sm text-gray-900 font-bold" style={{ fontWeight: '700', fontSize: '14px' }}>
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

  const handleExportReport = () => {
    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data for the main summary sheet
      const summaryData = candidates.map(candidate => ({
        'Candidate Name': candidate.name,
        'Overall Score (%)': candidate.overallScore,
        'Match Status': candidate.status === 'Excellent Match' ? 'Excellent Match' : 
                       candidate.status === 'Good Match' ? 'Good Match' : 
                       candidate.status === 'No Match' ? 'No Match' : 'Under Review',
        'Resume URL': candidate.resumeUrl || 'N/A',
        'Recommendation': cleanTextForExport(candidate.recommendation),
        'Summary': cleanTextForExport(candidate.detailedAssessment)
      }));

      // Create summary worksheet
      const summaryWS = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Candidate Summary');

      // Prepare detailed scoring data
      const detailedData: any[] = [];
      candidates.forEach(candidate => {
        candidate.scores.forEach(score => {
          detailedData.push({
            'Candidate Name': candidate.name,
            'Overall Score (%)': candidate.overallScore,
            'Parameter': score.parameter,
            'Score (out of 10)': score.score,
            'Weightage (%)': score.weightage,
            'Weighted Score': (score.score * score.weightage) / 10
          });
        });
      });

      // Create detailed scoring worksheet
      const detailedWS = XLSX.utils.json_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(wb, detailedWS, 'Detailed Scoring');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Match_Scorecard_Report_${currentDate}.xlsx`;

      // Download the file
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

  const handleTopFiveOnly = () => {
    const topFive = candidates.slice(0, 5);
    setCandidates(topFive);
    toast({
      title: "Filtered Results",
      description: `Showing top ${topFive.length} candidates only.`,
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-2 text-muted-foreground">Loading assessment reports...</span>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    const selectedJDId = sessionStorage.getItem('selectedJDId');
    const selectedCriteriaGridId = sessionStorage.getItem('selectedCriteriaGridId');
    
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Assessment Reports Found</h3>
          <p className="text-muted-foreground">
            {!selectedJDId || !selectedCriteriaGridId 
              ? "Please select a Job Description and Evaluation Criteria to view assessment reports."
              : "No candidate evaluations found for the selected Job Description and Evaluation Criteria. Upload resumes and run evaluations to see results here."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary-800 mb-2">Match Scorecard</h2>
          <p className="text-muted-foreground">Candidate evaluation results and rankings ({candidates.length} candidates)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm" onClick={handleTopFiveOnly}>
            Top 5 Only
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {candidates.map((candidate) => (
          <Card key={candidate.id} className="p-6 mb-6 shadow-md rounded-xl bg-white">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{candidate.name}</h3>
                  <p className="text-sm text-gray-500">Overall Match Assessment</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRecommendationStyle(candidate.status)}`}>
                    {candidate.status}
                  </span>
                  <span className="text-3xl font-bold text-gray-900">
                    {`${candidate.overallScore}%`}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Overall Score</p>
              </div>
            </div>

            {/* Scoring Section */}
            <div className="space-y-4">
              {candidate.scores.map((score, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{score.parameter}</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">{(score.score * 10)}%</span>
                      <span className="text-sm text-gray-500 ml-4">Weight: {score.weightage}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(score.score * 10)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Section */}
            {candidate.detailedAssessment && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2 text-left">Summary</h4>
                <div className="text-left">
                  {renderSummaryText(candidate.detailedAssessment)}
                </div>
              </div>
            )}

            {/* Recommendation Section */}
            {candidate.recommendation && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                <div>
                  {renderSummaryText(candidate.recommendation)}
                </div>
              </div>
            )}

          </Card>
        ))}
      </div>
    </div>
  );
};
