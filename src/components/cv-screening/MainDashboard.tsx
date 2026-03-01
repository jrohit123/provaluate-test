import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, BarChart3, Wrench, Cog, Users, Monitor, HelpCircle, Puzzle, ChevronDown } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { BrowserExtensionInfo } from './BrowserExtensionInfo';
import { ActiveSection } from '@/pages/Dashboard';
import { UiAnalyticsService } from '@/services/uiAnalyticsService';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainDashboardProps {
  onSectionChange: (section: string) => void;
  onStartTour?: () => void;
  onDashboardReady?: () => void;
}

export function MainDashboard({ onSectionChange, onStartTour, onDashboardReady }: MainDashboardProps) {
  const { isSessionComplete, currentJobDescription, currentEvaluationCriteria } = useSession();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // State for email plugin info modal (Gmail / Outlook choice)
  const [isEmailPluginInfoOpen, setIsEmailPluginInfoOpen] = useState(false);
  // State for collapsible sections (mobile only) - closed by default
  const [isCVScreeningOpen, setIsCVScreeningOpen] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  
  // State for real data
  const [stats, setStats] = useState({
    jobDescriptions: 0,
    criteriaSets: 0,
    assessments: 0,
    interviewJobDescriptions: 0
  });
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [consumedCVs, setConsumedCVs] = useState(0);
  const [consumedUsers, setConsumedUsers] = useState(0);

  // Fetch real data from database (independent fetches run in parallel)
  const fetchStats = async () => {
    const cid = user?.profile?.company_id;
    if (!cid) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const [
        companyRes,
        usersCountRes,
        jobRowsRes,
        interviewCountRes,
        criteriaRes,
      ] = await Promise.all([
        supabase.from('companies').select('*').eq('company_id', cid).single(),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('user_status', 'active'),
        supabase.from('job_descriptions').select('jd_file, jd_id').eq('company_id', cid).eq('status', 'active'),
        supabase.from('jd_for_interview').select('*', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('criteria').select('criteria_name, created_at, company_id, criteria_id').or(`company_id.eq.${cid},company_id.is.null`).order('created_at', { ascending: false }),
      ]);

      const companyData = companyRes.data;
      const userCount = usersCountRes.count ?? 0;
      const companyJobDescriptions = jobRowsRes.data ?? [];
      const jobCount = companyJobDescriptions.length;
      const interviewJobCount = interviewCountRes.count ?? 0;
      const criteriaData = criteriaRes.data ?? [];

      setCompanyData(companyData);
      setConsumedCVs(companyData?.cv_processed_count || 0);
      setConsumedUsers(userCount);

      const uniqueCriteria = criteriaData.reduce((acc: { [key: string]: any }, curr) => {
        if (!acc[curr.criteria_name] || new Date(curr.created_at) > new Date(acc[curr.criteria_name].created_at)) {
          acc[curr.criteria_name] = curr;
        }
        return acc;
      }, {});
      const criteriaCount = Object.keys(uniqueCriteria).length;
      const companyCriteria = criteriaData;
      const criteriaIds = companyCriteria.map((c: { criteria_id: string }) => c.criteria_id);

      if (companyData?.selected_plan) {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('plan_name', companyData.selected_plan)
          .single();
        setPlanData(planData);
      }

      let assessmentCount = 0;
      try {
        if (companyJobDescriptions.length > 0) {
          const jdFileUrls = companyJobDescriptions
            .map((jd: { jd_file?: string }) => jd.jd_file)
            .filter(Boolean) as string[];
          if (jdFileUrls.length > 0) {
            const { data: resolvedJds, error: resolvedError } = await supabase
              .from('resolved_jd')
              .select('resolved_jd_id')
              .in('referenced_jd', jdFileUrls);
            if (!resolvedError && resolvedJds?.length) {
              const resolvedJdIds = resolvedJds.map((r: { resolved_jd_id: string }) => r.resolved_jd_id);
              if (criteriaIds.length > 0) {
                const { count, error: assessmentError } = await supabase
                  .from('assessment_reports')
                  .select('*', { count: 'exact', head: true })
                  .in('criteria_id', criteriaIds)
                  .in('resolved_jd_id', resolvedJdIds);
                if (!assessmentError) assessmentCount = count ?? 0;
              }
            }
          }
        }
      } catch (e) {
        console.error('❌ Unexpected error calculating assessment count:', e);
      }

      setStats({
        jobDescriptions: jobCount,
        criteriaSets: criteriaCount,
        assessments: assessmentCount,
        interviewJobDescriptions: jobCount + interviewJobCount,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load stats when component mounts (only once user exists)
  useEffect(() => {
    if (!user) return;
    if (user.profile?.company_id) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user?.profile?.company_id, user]);

  // Notify parent only after stats have loaded AND user exists. Delay so loaded UI has painted.
  useEffect(() => {
    if (!loading && user) {
      const t = setTimeout(() => onDashboardReady?.(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, user, onDashboardReady]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div data-tour="dashboard-welcome">
        <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Welcome to your faster hiring workspace!</p>
        <h1 className="text-xl sm:text-2xl font-bold text-primary-800">Dashboard</h1>
        </div>
        {/* Extension above Guided Tour on mobile (flex-col); same row on desktop (sm:flex-row) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <span data-tour="email-plugin" className="inline-flex w-full sm:w-auto order-1">
            <Button
              size="sm"
              onClick={() => {
                UiAnalyticsService.track({
                  name: 'dashboard_click_email_plugin_info',
                  area: 'cv_screening_dashboard',
                });
                setIsEmailPluginInfoOpen(true);
              }}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Puzzle className="w-4 h-4" />
              <span className="hidden sm:inline">Email Plugin</span>
              <span className="sm:hidden">Plugin</span>
            </Button>
          </span>
          <Button 
            size="sm"
            data-tour="guided-tour-trigger"
            onClick={() => {
              UiAnalyticsService.track({
                name: 'dashboard_click_guided_tour',
                area: 'cv_screening_dashboard',
              });
              onStartTour?.();
            }}
            className="flex items-center justify-center gap-2 w-full sm:w-auto order-2"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Guided Tour</span>
            <span className="sm:hidden">Tour</span>
          </Button>
        </div>
      </div>

      {/* Email Plugin Info Modal (Gmail / Outlook) */}
      <BrowserExtensionInfo 
        open={isEmailPluginInfoOpen} 
        onOpenChange={setIsEmailPluginInfoOpen} 
      />

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Company Plan Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Company Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900">Loading...</div>
                <div className="text-sm text-gray-600">Fetching plan details...</div>
              </div>
            ) : planData ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-gray-900">{planData.plan_name}</div>
                  <div className="text-sm text-gray-600">
                    {planData.plan_cost ? `₹${planData.plan_cost}/month` : 'Free Plan'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Max CVs</div>
                    <div className="text-gray-600">
                      {loading ? '...' : `${consumedCVs} / ${planData.max_cvs === 0 ? 'Unlimited' : planData.max_cvs}`}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Max Users</div>
                    <div className="text-gray-600">
                      {loading ? '...' : `${consumedUsers} / ${planData.max_users || 'N/A'}`}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Active JDs</div>
                    <div className="text-gray-600">
                      {stats.jobDescriptions} / {planData.active_jobs === 0 ? 'Unlimited' : planData.active_jobs}
                    </div>
                  </div>
                </div>
                  {companyData?.subscription_end && (
                    <div className="text-sm text-gray-600">
                      Renews on: {(() => {
                        const date = new Date(companyData.subscription_end);
                        const day = date.getDate().toString().padStart(2, '0');
                        const month = date.toLocaleDateString('en-GB', { month: 'short' }).substring(0, 3);
                        const year = date.getFullYear().toString().slice(-2);
                        return `${day}-${month}-${year}`;
                      })()}
                    </div>
                  )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900">No Plan Selected</div>
                <div className="text-sm text-gray-600">Contact admin to select a plan</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.jobDescriptions}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">JOB DESCRIPTIONS</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.criteriaSets}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">CRITERIA SETS</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.assessments}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">ASSESSMENTS</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.interviewJobDescriptions}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 break-words">INTERVIEW JOB DESCRIPTIONS</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card className="animate-fade-in" data-tour="quick-actions">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Follow these steps to complete your candidate evaluation workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CV Screening Section */}
          <Collapsible 
            open={isMobile ? isCVScreeningOpen : true} 
            onOpenChange={isMobile ? setIsCVScreeningOpen : undefined}
            disabled={!isMobile}
          >
            <div className={`mb-3 sm:mb-4 ${isMobile ? 'bg-blue-50 border border-blue-200 rounded-lg p-3' : ''}`}>
              <CollapsibleTrigger 
                asChild 
                className={isMobile ? "w-full" : "pointer-events-none"}
              >
                <div className={`flex items-center justify-between ${isMobile ? 'cursor-pointer' : ''}`}>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">CV Screening</h3>
                  {isMobile && (
                    <ChevronDown className={`h-5 w-5 text-blue-600 transition-transform duration-200 ${isCVScreeningOpen ? 'rotate-180' : ''}`} />
                  )}
                </div>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Manage Job Descriptions */}
            <Button
              onClick={() => {
                UiAnalyticsService.track({
                  name: 'dashboard_quick_action_job_upload',
                  area: 'cv_screening_dashboard',
                });
                onSectionChange('job-upload');
              }}
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
            >
              <FileText className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">1. Create Job Descriptions</div>
            </Button>

            {/* 2. Manage Evaluation Criteria */}
            <Button
              onClick={() => {
                UiAnalyticsService.track({
                  name: 'dashboard_quick_action_evaluation_criteria',
                  area: 'cv_screening_dashboard',
                });
                onSectionChange('evaluation-criteria');
              }}
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
            >
              <Wrench className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">2. Set Up Evaluation Criteria</div>
            </Button>

            {/* 3. Upload Resumes */}
            <Button
              onClick={() => {
                UiAnalyticsService.track({
                  name: 'dashboard_quick_action_resume_upload',
                  area: 'cv_screening_dashboard',
                });
                onSectionChange('resume-upload');
              }}
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
            >
              <Upload className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">3. Upload Resumes</div>
            </Button>

            {/* 4. View Reports */}
            <Button
              onClick={() => {
                UiAnalyticsService.track({
                  name: 'dashboard_quick_action_match_scorecard',
                  area: 'cv_screening_dashboard',
                });
                onSectionChange('match-scorecard');
              }}
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
            >
              <BarChart3 className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">4. View Reports</div>
            </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Interview Management Section */}
          <div className="mt-4 sm:mt-6">
            <Collapsible 
              open={isMobile ? isInterviewOpen : true} 
              onOpenChange={isMobile ? setIsInterviewOpen : undefined}
              disabled={!isMobile}
            >
              <div className={`mb-3 sm:mb-4 ${isMobile ? 'bg-blue-50 border border-blue-200 rounded-lg p-3' : ''}`}>
                <CollapsibleTrigger 
                  asChild 
                  className={isMobile ? "w-full" : "pointer-events-none"}
                >
                  <div className={`flex items-center justify-between ${isMobile ? 'cursor-pointer' : ''}`}>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Interview Management</h3>
                    {isMobile && (
                      <ChevronDown className={`h-5 w-5 text-blue-600 transition-transform duration-200 ${isInterviewOpen ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Interview Configuration */}
              <Button
                onClick={() => {
                  UiAnalyticsService.track({
                    name: 'dashboard_quick_action_interview_setup',
                    area: 'interview_management',
                  });
                  onSectionChange('setup');
                }}
                className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
              >
                <Cog className="w-5 h-5" />
                <div className="font-semibold text-xs sm:text-sm text-center">Interview Configuration</div>
              </Button>

              {/* Assessment Manager */}
              <Button
                onClick={() => {
                  UiAnalyticsService.track({
                    name: 'dashboard_quick_action_assessment_manager',
                    area: 'interview_management',
                  });
                  onSectionChange('ai-interview');
                }}
                className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
              >
                <Users className="w-5 h-5" />
                <div className="font-semibold text-xs sm:text-sm text-center">Assessment Manager</div>
              </Button>

              {/* Interview Dashboard */}
              <Button
                onClick={() => {
                  UiAnalyticsService.track({
                    name: 'dashboard_quick_action_interview_dashboard',
                    area: 'interview_management',
                  });
                  onSectionChange('interview-dashboard');
                }}
                className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2"
              >
                <Monitor className="w-5 h-5" />
                <div className="font-semibold text-xs sm:text-sm text-center">Interview Dashboard</div>
              </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}