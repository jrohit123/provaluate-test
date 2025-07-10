import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, User, Eye, Download, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

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
  status: 'excellent' | 'good' | 'fair' | 'processing';
  recommendation?: string;
  detailedAssessment?: string;
  resumeUrl?: string;
}

interface MatchScorecardSectionProps {
  onCandidateSelect: (candidateId: string) => void;
  selectedCandidateId?: string;
  onClose?: () => void;
}

export const MatchScorecardSection = ({ onCandidateSelect, selectedCandidateId, onClose }: MatchScorecardSectionProps) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Parse scoring text to extract individual scores
  const parseScoringText = (scoringText: string) => {
    const scores: { parameter: string; score: number; weightage: number; maxScore: number }[] = [];
    let overallScore = 0;

    if (!scoringText) return { scores, overallScore };

    const lines = scoringText.split('\n');
    let totalWeightedScore = 0;
    let totalWeightage = 0;

    lines.forEach(line => {
      // Parse lines like "Technical Skills: 8 x 30 = 240"
      const match = line.match(/^(.+?):\s*(\d+)\s*x\s*(\d+)\s*=\s*(\d+)$/);
      if (match) {
        const [, parameter, scoreStr, weightageStr, weightedScoreStr] = match;
        const score = parseInt(scoreStr);
        const weightage = parseInt(weightageStr);
        const weightedScore = parseInt(weightedScoreStr);

        scores.push({
          parameter: parameter.trim(),
          score,
          weightage,
          maxScore: 10 // Assuming scores are out of 10
        });

        totalWeightedScore += weightedScore;
        totalWeightage += weightage;
      }

      // Parse final score line like "Final Score = 520"
      const finalMatch = line.match(/Final Score\s*=\s*(\d+)/);
      if (finalMatch) {
        const finalScore = parseInt(finalMatch[1]);
        // Convert to percentage (assuming max possible score is total weightage * 10)
        if (totalWeightage > 0) {
          overallScore = Math.round((finalScore / (totalWeightage * 10)) * 100);
        }
      }
    });

    return { scores, overallScore };
  };

  // Fetch assessment reports from Supabase
  const fetchAssessmentReports = useCallback(async () => {
    if (!user?.profile?.company_id) {
      console.log('No company_id available, skipping fetch');
      console.log('User object:', user);
      return;
    }

    try {
      setLoading(true);
      
      console.log('Current user:', user);
      console.log('Company ID:', user.profile.company_id);
      
      // Join with criteria table to filter by company_id since assessment_reports doesn't have company_id directly
      const { data: reports, error } = await supabase
        .from('assessment_reports')
        .select(`
          *,
          criteria!inner(company_id)
        `)
        .eq('criteria.company_id', user.profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }
      
      console.log('Fetched reports:', reports);
      console.log('Number of reports:', reports?.length || 0);

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
        let status: 'excellent' | 'good' | 'fair' | 'processing' = 'processing';
        if (report.status === 'completed' || overallScore > 0) {
          if (overallScore >= 85) status = 'excellent';
          else if (overallScore >= 70) status = 'good';
          else status = 'fair';
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
  }, [user?.profile?.company_id, fetchAssessmentReports]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-accent-100 text-accent-800';
      case 'good':
        return 'bg-yellow-100 text-yellow-800';
      case 'fair':
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

  const handleExportReport = () => {
    toast({
      title: "Export Feature",
      description: "Report export functionality will be implemented soon.",
    });
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
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Assessment Reports Found</h3>
          <p className="text-muted-foreground">
            No candidate evaluations have been completed yet. Upload resumes and run evaluations to see results here.
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
          <Card key={candidate.id} className="p-6 mb-6 shadow-md rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-6 h-6 text-primary-600" />
                  <span className="text-2xl font-bold">{candidate.name}</span>
                </div>
                <div className="text-muted-foreground text-sm">Overall Match Assessment</div>
              </div>
              <div className="flex flex-col items-end">
                <span className={
                  candidate.status === 'good'
                    ? 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold mb-2'
                    : candidate.status === 'excellent'
                    ? 'bg-accent-100 text-accent-800 px-3 py-1 rounded-full text-xs font-semibold mb-2'
                    : 'bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-semibold mb-2'
                }>
                  {candidate.status === 'good'
                    ? 'Good Match'
                    : candidate.status === 'excellent'
                    ? 'Excellent Match'
                    : candidate.status === 'fair'
                    ? 'Fair Match'
                    : 'Processing'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary-800">{candidate.status === 'processing' ? '...' : `${candidate.overallScore}%`}</span>
                  <span className="text-muted-foreground text-sm">Overall Score</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 my-4">
              {candidate.scores.map((score, idx) => (
                <div key={idx} className="flex items-center gap-4">
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
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1 flex items-center justify-center gap-2"
                onClick={() => onCandidateSelect(candidate.id)}
                disabled={candidate.status === 'processing'}
              >
                <Eye className="w-4 h-4" /> Deep Dive Analysis
              </Button>
              <Button variant="outline" className="flex-1 flex items-center justify-center gap-2" disabled={candidate.status === 'processing'}>
                <BarChart3 className="w-4 h-4" /> Compare
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
