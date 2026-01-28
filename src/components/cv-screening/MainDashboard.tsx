import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, BarChart3, Wrench, Cog, Users, Monitor, HelpCircle, Puzzle, ChevronDown } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { CVScreeningGuidedTour } from './CVScreeningGuidedTour';
import { BrowserExtensionInfo } from './BrowserExtensionInfo';
import { ActiveSection } from '@/pages/Dashboard';
import { UiAnalyticsService } from '@/services/uiAnalyticsService';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainDashboardProps {
  onSectionChange: (section: string) => void;
}

export function MainDashboard({ onSectionChange }: MainDashboardProps) {
  const { isSessionComplete, currentJobDescription, currentEvaluationCriteria } = useSession();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // State for guided tour modal
  const [isGuidedTourOpen, setIsGuidedTourOpen] = useState(false);
  // State for browser extension info modal
  const [isExtensionInfoOpen, setIsExtensionInfoOpen] = useState(false);
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

  // Fetch real data from database
  const fetchStats = async () => {
    if (!user?.profile?.company_id) return;
    
    try {
      setLoading(true);
      
      // Fetch company data to get selected plan
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', user.profile.company_id)
        .single();
      
      setCompanyData(companyData);
      
      // Set consumed CVs from company data
      setConsumedCVs(companyData?.cv_processed_count || 0);
      
      // Fetch active users count for the company
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.profile.company_id)
        .eq('user_status', 'active');
      
      setConsumedUsers(userCount || 0);
      
      // Fetch plan data if company has a selected plan
      if (companyData?.selected_plan) {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('plan_name', companyData.selected_plan)
          .single();
        
        setPlanData(planData);
      }
      
      // Fetch active job descriptions count (CV screening)
      const { count: jobCount } = await supabase
        .from('job_descriptions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.profile.company_id)
        .eq('status', 'active');
      
      // Fetch interview job descriptions count (AI interview)
      const { count: interviewJobCount } = await supabase
        .from('jd_for_interview')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.profile.company_id);
      
      // Combined count for interview job descriptions (both tables)
      const combinedInterviewJobCount = (jobCount || 0) + (interviewJobCount || 0);
      
      // Fetch criteria sets count (all criteria for the company + global templates, unique names, latest version only)
      const { data: criteriaData } = await supabase
        .from('criteria')
        .select('criteria_name, created_at, company_id')
        .or(`company_id.eq.${user.profile.company_id},company_id.is.null`)
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
      
      // Fetch assessments count filtered by company (through criteria_id AND resolved_jd_id)
      // ✅ FIX: Filter by resolved_jd_id to ensure company isolation
      // Since assessment_reports has no company_id, we filter through: 
      // assessment_reports.resolved_jd_id → resolved_jd.referenced_jd → job_descriptions.jd_file → job_descriptions.company_id
      let assessmentCount = 0;

      try {
        // First, get all active job descriptions for this company
        const { data: companyJobDescriptions, error: jdError } = await supabase
          .from('job_descriptions')
          .select('jd_file, jd_id')
          .eq('company_id', user.profile.company_id)
          .eq('status', 'active');

        if (jdError) {
          console.error('❌ Error fetching job descriptions for assessment count:', jdError);
        }

        console.log(`📊 Company has ${companyJobDescriptions?.length || 0} active job descriptions`);

        if (companyJobDescriptions && companyJobDescriptions.length > 0) {
          // Get all jd_file URLs for this company
          const jdFileUrls = companyJobDescriptions
            .map(jd => jd.jd_file)
            .filter(Boolean)
            .filter((url): url is string => typeof url === 'string');
          
          if (jdFileUrls.length > 0) {
            // Get all resolved_jd_ids that belong to this company's job descriptions
            const { data: resolvedJds, error: resolvedError } = await supabase
              .from('resolved_jd')
              .select('resolved_jd_id')
              .in('referenced_jd', jdFileUrls);

            if (resolvedError) {
              console.error('❌ Error fetching resolved JDs for assessment count:', resolvedError);
            }

            const resolvedJdIds = resolvedJds?.map(r => r.resolved_jd_id) || [];
            console.log(`🔗 Found ${resolvedJdIds.length} resolved JD IDs for company's job descriptions`);

            if (resolvedJdIds.length > 0) {
              // Get company criteria IDs (including global criteria with company_id = NULL)
              const { data: companyCriteria, error: criteriaError } = await supabase
                .from('criteria')
                .select('criteria_id, criteria_name, company_id')
                .or(`company_id.eq.${user.profile.company_id},company_id.is.null`);

              if (criteriaError) {
                console.error('❌ Error fetching criteria for assessment count:', criteriaError);
              }

              const criteriaIds = companyCriteria?.map(c => c.criteria_id) || [];
              console.log(`📋 Found ${criteriaIds.length} criteria IDs (company + global)`);

              // ✅ KEY FIX: Count assessments that match BOTH criteria_id AND resolved_jd_id
              // This ensures we only count assessments for THIS company's job descriptions,
              // preventing cross-company data leakage when using shared global criteria
              if (criteriaIds.length > 0) {
                const { count, error: assessmentError } = await supabase
                  .from('assessment_reports')
                  .select('*', { count: 'exact', head: true })
                  .in('criteria_id', criteriaIds)
                  .in('resolved_jd_id', resolvedJdIds);

                if (assessmentError) {
                  console.error('❌ Error counting assessments:', assessmentError);
                  console.error('Assessment error details:', JSON.stringify(assessmentError, null, 2));
                } else {
                  assessmentCount = count || 0;
                  console.log(`✅ Assessment count for company: ${assessmentCount}`);
                  console.log(`   - Using ${criteriaIds.length} criteria IDs`);
                  console.log(`   - Filtering by ${resolvedJdIds.length} resolved JD IDs`);
                }
              } else {
                console.log('⚠️ No criteria IDs found, assessment count = 0');
              }
            } else {
              console.log('ℹ️ No resolved JDs found for company job descriptions, assessment count = 0');
            }
          } else {
            console.log('ℹ️ No valid JD file URLs found, assessment count = 0');
          }
        } else {
          console.log('ℹ️ No job descriptions found for company, assessment count = 0');
        }
      } catch (error) {
        console.error('❌ Unexpected error calculating assessment count:', error);
        assessmentCount = 0; // Fail safely to 0
      }

      console.log('MainDashboard - Final assessment count:', assessmentCount);
      
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
        <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Welcome to your faster hiring workspace!</p>
        <h1 className="text-xl sm:text-2xl font-bold text-primary-800">Dashboard</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button 
            size="sm"
            onClick={() => {
              UiAnalyticsService.track({
                name: 'dashboard_click_browser_extension_info',
                area: 'cv_screening_dashboard',
              });
              setIsExtensionInfoOpen(true);
            }}
            className="hidden sm:flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Puzzle className="w-4 h-4" />
            <span className="hidden sm:inline">Browser Extension</span>
            <span className="sm:hidden">Extension</span>
          </Button>
          <Button 
            size="sm"
            onClick={() => {
              UiAnalyticsService.track({
                name: 'dashboard_click_guided_tour',
                area: 'cv_screening_dashboard',
              });
              setIsGuidedTourOpen(true);
            }}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Guided Tour</span>
            <span className="sm:hidden">Tour</span>
          </Button>
        </div>
      </div>

      {/* Browser Extension Info Modal */}
      <BrowserExtensionInfo 
        open={isExtensionInfoOpen} 
        onOpenChange={setIsExtensionInfoOpen} 
      />

      {/* Guided Tour Modal */}
      <CVScreeningGuidedTour
        open={isGuidedTourOpen}
        onOpenChange={setIsGuidedTourOpen}
        onNavigate={(section) => onSectionChange(section)}
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
      <Card className="animate-fade-in">
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