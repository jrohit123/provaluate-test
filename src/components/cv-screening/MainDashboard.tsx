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
  
  // State for resume plugins modal (Gmail / Outlook / LinkedIn)
  const [isEmailPluginInfoOpen, setIsEmailPluginInfoOpen] = useState(false);
  // State for collapsible sections (mobile only) - closed by default
  const [isCVScreeningOpen, setIsCVScreeningOpen] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  
  // State for real data (CV: job_descriptions; Interview: jd_for_interview + interviews completed)
  const [stats, setStats] = useState({
    jobDescriptions: 0,
    criteriaSets: 0,
    assessments: 0,
    interviewJobDescriptions: 0,
    interviewsCompleted: 0,
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
        interviewJdCountRes,
        criteriaRes,
        interviewsCompletedRes,
      ] = await Promise.all([
        supabase.from('companies').select('*').eq('company_id', cid).single(),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('user_status', 'active'),
        supabase.from('job_descriptions').select('jd_file, jd_id').eq('company_id', cid).eq('status', 'active'),
        supabase.from('jd_for_interview').select('*', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('criteria').select('criteria_name, created_at, company_id, criteria_id').or(`company_id.eq.${cid},company_id.is.null`).order('created_at', { ascending: false }),
        supabase.from('interviews').select('*', { count: 'exact', head: true }).eq('company_id', cid).in('status', ['completed', 'terminated']),
      ]);

      const companyData = companyRes.data;
      const userCount = usersCountRes.count ?? 0;
      const companyJobDescriptions = jobRowsRes.data ?? [];
      const jobCount = companyJobDescriptions.length;
      const interviewJobCount = interviewJdCountRes.count ?? 0;
      const interviewsCompletedCount = interviewsCompletedRes.count ?? 0;
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
          .eq('plan_type', companyData.plan_type || 'combo')
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
        interviewJobDescriptions: interviewJobCount,
        interviewsCompleted: interviewsCompletedCount,
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

  // Avoid flashing combo-only UI while plan/company data is still loading.
  // Once companyData is loaded: missing/empty plan_type -> treat as 'combo' (Free Tier behavior).
  const hasResolvedCompany = companyData != null;
  const rawPlanType = hasResolvedCompany ? (companyData?.plan_type ?? planData?.plan_type) : null;
  const planType =
    rawPlanType != null && String(rawPlanType).trim() !== ''
      ? String(rawPlanType).toLowerCase()
      : hasResolvedCompany
        ? 'combo'
        : null;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div data-tour="dashboard-welcome">
        <p className="text-xs sm:text-sm text-[#042C53] mb-1 sm:mb-2">Welcome to your faster hiring workspace!</p>
        <h1 className="text-xl sm:text-2xl font-bold text-[#042C53]">Dashboard</h1>
        </div>
        {/* Extension above Guided Tour on mobile (flex-col); same row on desktop (sm:flex-row). Resume Plugins only for cv/combo. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {(planType === 'cv' || planType === 'combo') && (
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
                className="flex items-center justify-center gap-2 w-full sm:w-auto text-white shadow-[0_4px_18px_rgba(13,110,163,0.28)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
              >
                <Puzzle className="w-4 h-4" />
                <span className="hidden sm:inline">Resume Plugins</span>
                <span className="sm:hidden">Plugins</span>
              </Button>
            </span>
          )}
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
            className="flex items-center justify-center gap-2 w-full sm:w-auto order-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.28)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Guided Tour</span>
            <span className="sm:hidden">Tour</span>
          </Button>
        </div>
      </div>

      {/* Resume Plugins Modal (Gmail / Outlook / LinkedIn / Zoho) */}
      <BrowserExtensionInfo 
        open={isEmailPluginInfoOpen} 
        onOpenChange={setIsEmailPluginInfoOpen}
        userId={user?.id ?? user?.profile?.user_id} 
      />

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Company Plan Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-[#042C53]">Company Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-[#042C53]">Loading...</div>
                <div className="text-sm text-[#042C53]">Fetching plan details...</div>
              </div>
            ) : planData ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-[#042C53]">
                    {planData.plan_name}
                    {planData.plan_type ? ` (${planData.plan_type === 'cv' ? 'CV Only' : planData.plan_type === 'interview' ? 'Interviews Only' : 'Combo'})` : ''}
                  </div>
                  <div className="text-sm text-[#042C53]">
                    {planData.plan_cost ? `₹${planData.plan_cost}/month` : 'Free Plan'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  {planData.max_cvs != null && (
                    <div>
                      <div className="font-medium text-[#042C53]">Max CVs</div>
                      <div className="text-[#042C53]">
                        {loading ? '...' : `${consumedCVs} / ${planData.max_cvs === 0 ? 'Unlimited' : planData.max_cvs}`}
                      </div>
                    </div>
                  )}
                  {planData.max_interviews != null && (
                    <div>
                      <div className="font-medium text-[#042C53]">Max Interviews</div>
                      <div className="text-[#042C53]">
                        {loading ? '...' : `${companyData?.interview_count ?? 0} / ${planData.max_interviews === 0 ? 'Unlimited' : planData.max_interviews}`}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-[#042C53]">Max Users</div>
                    <div className="text-[#042C53]">
                      {loading ? '...' : `${consumedUsers} / ${planData.max_users || 'N/A'}`}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-[#042C53]">Active JDs</div>
                    <div className="text-[#042C53]">
                      {stats.jobDescriptions} / {planData.active_jobs === 0 ? 'Unlimited' : planData.active_jobs}
                    </div>
                  </div>
                </div>
                  {companyData?.subscription_end && (
                    <div className="text-sm text-[#042C53]">
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
                <div className="text-2xl font-bold text-[#042C53]">No Plan Selected</div>
                <div className="text-sm text-[#042C53]">Contact admin to select a plan</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Card - stats centred with equal spacing */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-[#042C53]">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-12 pb-1 px-6">
            <div className="flex flex-row flex-nowrap gap-6 sm:gap-8 w-full max-w-4xl justify-center items-stretch">
              {/* CV-only: CV JDs, Evaluation criteria, Assessments */}
              {(planType === 'cv' || planType === 'combo') && (
                <>
                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                    <div className="text-lg sm:text-2xl font-bold text-[#0d4060]">
                      {loading ? '...' : stats.jobDescriptions}
                    </div>
                    <div className="text-xs sm:text-sm text-[#0d4060] min-h-[2.5rem] flex items-center justify-center break-words">CV JDs CREATED</div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                    <div className="text-lg sm:text-2xl font-bold text-[#0d4060]">
                      {loading ? '...' : stats.criteriaSets}
                    </div>
                    <div className="text-xs sm:text-sm text-[#0d4060] min-h-[2.5rem] flex items-center justify-center break-words">EVALUATION CRITERIA</div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                    <div className="text-lg sm:text-2xl font-bold text-[#0d4060]">
                      {loading ? '...' : stats.assessments}
                    </div>
                    <div className="text-xs sm:text-sm text-[#0d4060] min-h-[2.5rem] flex items-center justify-center break-words">ASSESSMENTS</div>
                  </div>
                </>
              )}
              {/* Interview-only: Interview JDs, Interviews completed */}
              {(planType === 'interview' || planType === 'combo') && (
                <>
                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                    <div className="text-lg sm:text-2xl font-bold text-[#0d4060]">
                      {loading ? '...' : stats.interviewJobDescriptions}
                    </div>
                    <div className="text-xs sm:text-sm text-[#0d4060] min-h-[2.5rem] flex items-center justify-center break-words">INTERVIEW JDs CREATED</div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                    <div className="text-lg sm:text-2xl font-bold text-[#0d4060]">
                      {loading ? '...' : stats.interviewsCompleted}
                    </div>
                    <div className="text-xs sm:text-sm text-[#0d4060] min-h-[2.5rem] flex items-center justify-center break-words">INTERVIEWS COMPLETED</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card className="animate-fade-in" data-tour="quick-actions">
        <CardHeader>
          <CardTitle className="text-[#042C53]">Quick Actions</CardTitle>
          <CardDescription>
            Follow these steps to complete your candidate evaluation workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CV Screening Section - cv/combo only */}
          {(planType === 'cv' || planType === 'combo') && (
            <Collapsible 
              open={isMobile ? isCVScreeningOpen : true} 
              onOpenChange={isMobile ? setIsCVScreeningOpen : undefined}
              disabled={!isMobile}
            >
              <div className={`mb-3 sm:mb-4 ${isMobile ? 'bg-[#0d6ea3]/5 border border-[#0d6ea3]/20 rounded-lg p-3' : ''}`}>
                <CollapsibleTrigger 
                  asChild 
                  className={isMobile ? "w-full" : "pointer-events-none"}
                >
                  <div className={`flex items-center justify-between ${isMobile ? 'cursor-pointer' : ''}`}>
                    <h3 className="text-base sm:text-lg font-semibold text-[#042C53]">CV Screening</h3>
                    {isMobile && (
                      <ChevronDown className={`h-5 w-5 text-[#0d6ea3] transition-transform duration-200 ${isCVScreeningOpen ? 'rotate-180' : ''}`} />
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
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
            >
              <FileText className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">1. New Job Upload</div>
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
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
            >
              <Wrench className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">2. Evaluation Criteria</div>
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
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
            >
              <Upload className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">3. Resume Upload</div>
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
              className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
            >
              <BarChart3 className="w-5 h-5" />
              <div className="font-semibold text-xs sm:text-sm text-center">4. View All Results</div>
            </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          )}

          {/* Interview Management Section - interview/combo only */}
          {(planType === 'interview' || planType === 'combo') && (
          <div className="mt-4 sm:mt-6">
            <Collapsible 
              open={isMobile ? isInterviewOpen : true} 
              onOpenChange={isMobile ? setIsInterviewOpen : undefined}
              disabled={!isMobile}
            >
              <div className={`mb-3 sm:mb-4 ${isMobile ? 'bg-[#0d6ea3]/5 border border-[#0d6ea3]/20 rounded-lg p-3' : ''}`}>
                <CollapsibleTrigger 
                  asChild 
                  className={isMobile ? "w-full" : "pointer-events-none"}
                >
                  <div className={`flex items-center justify-between ${isMobile ? 'cursor-pointer' : ''}`}>
                    <h3 className="text-base sm:text-lg font-semibold text-[#042C53]">Interview Management</h3>
                    {isMobile && (
                      <ChevronDown className={`h-5 w-5 text-[#0d6ea3] transition-transform duration-200 ${isInterviewOpen ? 'rotate-180' : ''}`} />
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
                className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
              >
                <Cog className="w-5 h-5" />
                <div className="font-semibold text-xs sm:text-sm text-center">Interview Creation</div>
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
                className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
              >
                <Users className="w-5 h-5" />
                <div className="font-semibold text-xs sm:text-sm text-center">Send Interview</div>
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
                className="h-auto p-3 sm:p-4 flex flex-col items-center space-y-1 sm:space-y-2 text-white shadow-[0_4px_18px_rgba(13,110,163,0.20)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.26)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
              >
                <Monitor className="w-5 h-5" />
                <div className="font-semibold text-xs sm:text-sm text-center">Interview Dashboard</div>
              </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}