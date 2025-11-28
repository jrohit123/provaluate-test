import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, BarChart3, Wrench, Cog, Users, Monitor } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

interface MainDashboardProps {
  onSectionChange: (section: string) => void;
}

export function MainDashboard({ onSectionChange }: MainDashboardProps) {
  const { isSessionComplete, currentJobDescription, currentEvaluationCriteria } = useSession();
  const { user } = useAuth();
  
  // State for real data
  const [stats, setStats] = useState({
    jobDescriptions: 0,
    criteriaSets: 0,
    assessments: 0,
    interviewJobDescriptions: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch real data from database
  const fetchStats = async () => {
    if (!user?.profile?.company_id) return;
    
    try {
      setLoading(true);
      
      // Fetch job descriptions count (CV screening)
      const { count: jobCount } = await supabase
        .from('job_descriptions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.profile.company_id);
      
      // Fetch interview job descriptions count (AI interview)
      const { count: interviewJobCount } = await supabase
        .from('jd_for_interview')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.profile.company_id);
      
      // Combined count for interview job descriptions (both tables)
      const combinedInterviewJobCount = (jobCount || 0) + (interviewJobCount || 0);
      
      // Fetch criteria sets count (only criteria created by current user, unique names, latest version only)
      const { data: criteriaData } = await supabase
        .from('criteria')
        .select('criteria_name, created_at')
        .eq('created_by', user.id)
        .eq('company_id', user.profile.company_id)
        .order('created_at', { ascending: false });
      
      // Get unique criteria names (latest entry for each name)
      const uniqueCriteria = criteriaData ? criteriaData.reduce((acc: { [key: string]: any }, curr) => {
        if (!acc[curr.criteria_name] || new Date(curr.created_at) > new Date(acc[curr.criteria_name].created_at)) {
          acc[curr.criteria_name] = curr;
        }
        return acc;
      }, {}) : {};
      
      const criteriaCount = Object.keys(uniqueCriteria).length;
      
      console.log('MainDashboard - User criteria data:', criteriaData);
      console.log('MainDashboard - Unique user criteria:', uniqueCriteria);
      console.log('MainDashboard - User criteria count:', criteriaCount);
      console.log('MainDashboard - Criteria names:', Object.keys(uniqueCriteria));
      
      // Fetch assessments count (assessment_reports doesn't have company_id field)
      const { count: assessmentCount, data: assessmentData } = await supabase
        .from('assessment_reports')
        .select('*', { count: 'exact' });
      
      console.log('MainDashboard - Assessment count:', assessmentCount);
      console.log('MainDashboard - Assessment data:', assessmentData);
      
      setStats({
        jobDescriptions: jobCount || 0,
        criteriaSets: criteriaCount,
        assessments: assessmentCount || 0,
        interviewJobDescriptions: combinedInterviewJobCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load stats when component mounts
  useEffect(() => {
    if (user?.profile?.company_id) {
      fetchStats();
    }
  }, [user?.profile?.company_id]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">Welcome to your CV screening workspace</p>
        <h1 className="text-2xl font-bold text-primary-800">Dashboard</h1>
      </div>

      {/* Top Cards Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Company Plan Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Company Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900">FreeTrial-30</div>
              <div className="text-sm text-gray-600">Days remaining: 30</div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.jobDescriptions}
                </div>
                <div className="text-sm text-gray-600">JOB DESCRIPTIONS</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.criteriaSets}
                </div>
                <div className="text-sm text-gray-600">CRITERIA SETS</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.assessments}
                </div>
                <div className="text-sm text-gray-600">ASSESSMENTS</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.interviewJobDescriptions}
                </div>
                <div className="text-sm text-gray-600">INTERVIEW JOB DESCRIPTIONS</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Follow these steps to complete your candidate evaluation workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CV Screening Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CV Screening</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* 1. Manage Job Descriptions */}
            <Button
              onClick={() => onSectionChange('job-upload')}
              className="h-auto p-3 flex flex-col items-center space-y-1"
            >
              <FileText className="w-5 h-5" />
              <div className="font-semibold text-sm">1. Manage Job Descriptions</div>
            </Button>

            {/* 2. Manage Evaluation Criteria */}
            <Button
              onClick={() => onSectionChange('evaluation-criteria')}
              className="h-auto p-3 flex flex-col items-center space-y-1"
            >
              <Wrench className="w-5 h-5" />
              <div className="font-semibold text-sm">2. Manage Evaluation Criteria</div>
            </Button>

            {/* 3. Upload Resumes */}
            <Button
              onClick={() => onSectionChange('resume-upload')}
              className="h-auto p-3 flex flex-col items-center space-y-1"
            >
              <Upload className="w-5 h-5" />
              <div className="font-semibold text-sm">3. Upload Resumes</div>
            </Button>

            {/* 4. View Reports */}
            <Button
              onClick={() => onSectionChange('match-scorecard')}
              className="h-auto p-3 flex flex-col items-center space-y-1"
            >
              <BarChart3 className="w-5 h-5" />
              <div className="font-semibold text-sm">4. View Reports</div>
            </Button>
            </div>
          </div>

          {/* Interview Management Section */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Interview Configuration */}
              <Button
                onClick={() => onSectionChange('setup')}
                className="h-auto p-3 flex flex-col items-center space-y-1"
              >
                <Cog className="w-5 h-5" />
                <div className="font-semibold text-sm">Interview Configuration</div>
              </Button>

              {/* Assessment Manager */}
              <Button
                onClick={() => onSectionChange('ai-interview')}
                className="h-auto p-3 flex flex-col items-center space-y-1"
              >
                <Users className="w-5 h-5" />
                <div className="font-semibold text-sm">Assessment Manager</div>
              </Button>

              {/* Interview Dashboard */}
              <Button
                onClick={() => onSectionChange('interview-dashboard')}
                className="h-auto p-3 flex flex-col items-center space-y-1"
              >
                <Monitor className="w-5 h-5" />
                <div className="font-semibold text-sm">Interview Dashboard</div>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}