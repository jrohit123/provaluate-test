
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingDown, TrendingUp, AlertCircle, Download, BarChart3, Users } from 'lucide-react';

const insightsData = {
  commonGaps: [
    { skill: 'GraphQL', percentage: 75, candidates: 3 },
    { skill: 'GCP Experience', percentage: 67, candidates: 2 },
    { skill: 'Microservices Architecture', percentage: 50, candidates: 2 },
    { skill: 'TypeScript', percentage: 33, candidates: 1 }
  ],
  strongMatches: [
    { skill: 'React/JavaScript', percentage: 100, candidates: 4 },
    { skill: 'Node.js', percentage: 75, candidates: 3 },
    { skill: 'AWS Cloud', percentage: 67, candidates: 2 },
    { skill: 'Team Leadership', percentage: 50, candidates: 2 }
  ],
  recommendations: [
    {
      type: 'jd-refinement',
      title: 'Consider GraphQL as "Nice-to-Have"',
      description: 'Most candidates lack GraphQL experience. Consider making it a preferred rather than required skill.',
      priority: 'high'
    },
    {
      type: 'candidate-pool',
      title: 'Expand GCP Experience Search',
      description: 'Consider candidates with AWS experience who can transition to GCP.',
      priority: 'medium'
    },
    {
      type: 'interview-focus',
      title: 'Focus on System Design',
      description: 'Test microservices understanding during technical interviews.',
      priority: 'medium'
    }
  ],
  marketInsights: {
    avgScore: 86,
    competitiveSkills: ['React', 'Node.js', 'Cloud Architecture'],
    rareSkills: ['GraphQL', 'GCP', 'Microservices']
  }
};

export const SmartInsights = () => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary-800 mb-2">Smart Match Insights</h2>
          <p className="text-muted-foreground">AI-powered analysis and recommendations</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Insights
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Common Gaps */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Most Common Skill Gaps
            </CardTitle>
            <CardDescription>
              Skills missing across candidate pool
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insightsData.commonGaps.map((gap, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-primary-800">{gap.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {gap.candidates}/{insightsData.commonGaps.length + 1} candidates missing
                    </span>
                    <Badge variant="outline" className="text-red-600">
                      {gap.percentage}%
                    </Badge>
                  </div>
                </div>
                <Progress value={100 - gap.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Strong Matches */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-500" />
              Strong Match Areas
            </CardTitle>
            <CardDescription>
              Skills well-represented in candidate pool
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insightsData.strongMatches.map((match, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-primary-800">{match.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {match.candidates}/{insightsData.strongMatches.length} candidates have
                    </span>
                    <Badge variant="outline" className="text-accent-600">
                      {match.percentage}%
                    </Badge>
                  </div>
                </div>
                <Progress value={match.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            AI Recommendations
          </CardTitle>
          <CardDescription>
            Suggestions to improve your hiring process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {insightsData.recommendations.map((rec, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border-l-4 border-l-primary-400">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-primary-800">{rec.title}</h4>
                <Badge className={getPriorityColor(rec.priority)}>
                  {rec.priority} priority
                </Badge>
              </div>
              <p className="text-sm text-gray-700">{rec.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Market Insights */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary-800 mb-1">
              {insightsData.marketInsights.avgScore}%
            </div>
            <p className="text-sm text-muted-foreground">Across all candidates</p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-accent-500" />
              Common Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {insightsData.marketInsights.competitiveSkills.map((skill, index) => (
                <Badge key={index} variant="outline" className="mr-1 mb-1">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Rare Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {insightsData.marketInsights.rareSkills.map((skill, index) => (
                <Badge key={index} variant="outline" className="mr-1 mb-1 border-yellow-200 text-yellow-700">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
