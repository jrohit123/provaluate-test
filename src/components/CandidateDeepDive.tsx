
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { User, FileText, CheckCircle, AlertTriangle, X, ArrowLeft } from 'lucide-react';

interface CandidateDeepDiveProps {
  candidateId: string | null;
}

const candidateDetails = {
  name: 'Sarah Johnson',
  title: 'Senior Software Engineer',
  experience: '8+ years',
  location: 'San Francisco, CA',
  email: 'sarah.johnson@email.com',
  summary: 'Experienced software engineer with expertise in React, Node.js, and cloud architecture. Led multiple high-impact projects and mentored junior developers.',
  skills: [
    { name: 'React/JavaScript', level: 95, status: 'excellent' },
    { name: 'Node.js/Express', level: 90, status: 'excellent' },
    { name: 'AWS/Cloud Architecture', level: 85, status: 'good' },
    { name: 'Python', level: 70, status: 'fair' },
    { name: 'Docker/Kubernetes', level: 80, status: 'good' }
  ],
  highlights: [
    { type: 'match', text: 'Strong React and JavaScript expertise aligns perfectly with requirements' },
    { type: 'match', text: '8+ years experience exceeds minimum requirement of 5 years' },
    { type: 'partial', text: 'Has AWS experience but lacks specific GCP knowledge mentioned in JD' },
    { type: 'missing', text: 'No mention of GraphQL experience which is preferred' }
  ],
  aiObservations: [
    'Candidate demonstrates strong technical leadership through project management experience',
    'Lacks specific GraphQL experience but has strong foundation in related technologies',
    'AWS experience transferable to GCP with minimal training',
    'Excellent communication skills evident from technical writing samples'
  ]
};

export const CandidateDeepDive = ({ candidateId }: CandidateDeepDiveProps) => {
  if (!candidateId) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-primary-800 mb-2">Select a Candidate</h3>
          <p className="text-muted-foreground">
            Choose a candidate from the Match Scorecard to view their detailed analysis
          </p>
        </div>
      </div>
    );
  }

  const getHighlightColor = (type: string) => {
    switch (type) {
      case 'match':
        return 'border-l-accent-500 bg-accent-50';
      case 'partial':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'missing':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getHighlightIcon = (type: string) => {
    switch (type) {
      case 'match':
        return <CheckCircle className="w-4 h-4 text-accent-500" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'missing':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scorecard
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-primary-800">Candidate Deep Dive</h2>
          <p className="text-muted-foreground">Detailed evaluation and analysis</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Resume Preview */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Resume Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-primary-100 p-3 rounded-full">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primary-800">{candidateDetails.name}</h3>
                  <p className="text-primary-600 font-medium">{candidateDetails.title}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                    <span>{candidateDetails.experience}</span>
                    <span>{candidateDetails.location}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-primary-800 mb-2">Professional Summary</h4>
                  <p className="text-sm text-gray-700">{candidateDetails.summary}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-primary-800 mb-2">Key Skills</h4>
                  <div className="space-y-2">
                    {candidateDetails.skills.map((skill, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-sm font-medium min-w-32">{skill.name}</span>
                        <Progress value={skill.level} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground w-8">{skill.level}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation Analysis */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent-500" />
              Criteria-Based Evaluation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Match Highlights */}
            <div>
              <h4 className="font-semibold text-primary-800 mb-3">Match Analysis</h4>
              <div className="space-y-3">
                {candidateDetails.highlights.map((highlight, index) => (
                  <div key={index} className={`p-3 rounded-lg border-l-4 ${getHighlightColor(highlight.type)}`}>
                    <div className="flex items-start gap-2">
                      {getHighlightIcon(highlight.type)}
                      <p className="text-sm">{highlight.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Observations */}
            <div>
              <h4 className="font-semibold text-primary-800 mb-3">AI-Generated Insights</h4>
              <div className="space-y-2">
                {candidateDetails.aiObservations.map((observation, index) => (
                  <div key={index} className="bg-blue-50 p-3 rounded-lg border-l-4 border-l-blue-400">
                    <p className="text-sm text-blue-800">{observation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-2">
              <Button className="w-full bg-accent-600 hover:bg-accent-700">
                Move to Interview
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  Download Report
                </Button>
                <Button variant="outline" size="sm">
                  Share Analysis
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
