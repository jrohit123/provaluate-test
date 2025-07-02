import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, User, Eye, Download } from 'lucide-react';

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
  status: 'excellent' | 'good' | 'fair';
}

interface MatchScorecardSectionProps {
  onCandidateSelect: (candidateId: string) => void;
  selectedCandidateId?: string;
  onClose?: () => void;
}

const candidatesData: Candidate[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    overallScore: 92,
    status: 'excellent',
    scores: [
      { parameter: 'Technical Skills', score: 95, weightage: 30, maxScore: 100 },
      { parameter: 'Experience Level', score: 90, weightage: 25, maxScore: 100 },
      { parameter: 'Education', score: 85, weightage: 15, maxScore: 100 },
      { parameter: 'Soft Skills', score: 95, weightage: 20, maxScore: 100 },
      { parameter: 'Certifications', score: 100, weightage: 10, maxScore: 100 }
    ]
  },
  {
    id: '2',
    name: 'Michael Chen',
    overallScore: 87,
    status: 'good',
    scores: [
      { parameter: 'Technical Skills', score: 90, weightage: 30, maxScore: 100 },
      { parameter: 'Experience Level', score: 85, weightage: 25, maxScore: 100 },
      { parameter: 'Education', score: 95, weightage: 15, maxScore: 100 },
      { parameter: 'Soft Skills', score: 80, weightage: 20, maxScore: 100 },
      { parameter: 'Certifications', score: 85, weightage: 10, maxScore: 100 }
    ]
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    overallScore: 79,
    status: 'good',
    scores: [
      { parameter: 'Technical Skills', score: 80, weightage: 30, maxScore: 100 },
      { parameter: 'Experience Level', score: 75, weightage: 25, maxScore: 100 },
      { parameter: 'Education', score: 90, weightage: 15, maxScore: 100 },
      { parameter: 'Soft Skills', score: 85, weightage: 20, maxScore: 100 },
      { parameter: 'Certifications', score: 60, weightage: 10, maxScore: 100 }
    ]
  }
];

export const MatchScorecardSection = ({ onCandidateSelect, selectedCandidateId, onClose }: MatchScorecardSectionProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-accent-100 text-accent-800';
      case 'good':
        return 'bg-yellow-100 text-yellow-800';
      case 'fair':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-accent-500';
    if (score >= 75) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary-800 mb-2">Match Scorecard</h2>
          <p className="text-muted-foreground">Candidate evaluation results and rankings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            Top 5 Only
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {candidatesData.map((candidate) => (
          <Card key={candidate.id} className="animate-fade-in hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{candidate.name}</CardTitle>
                    <CardDescription>Overall Match Assessment</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(candidate.status)}>
                    {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)} Match
                  </Badge>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-800">
                      {candidate.overallScore}%
                    </div>
                    <div className="text-sm text-muted-foreground">Overall Score</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {candidate.scores.map((score, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium text-gray-700">
                      {score.parameter}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Progress 
                          value={score.score} 
                          className="flex-1 h-2"
                        />
                        <span className="text-sm font-medium w-12 text-right">
                          {score.score}%
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-16 text-right">
                      Weight: {score.weightage}%
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCandidateSelect(candidate.id)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Deep Dive Analysis
                </Button>
                <Button variant="outline" size="sm">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Compare
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
