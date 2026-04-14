import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  SidebarProvider,
  SidebarInset,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import TpoJdInterviewConfig from '@/components/ai-interview/TpoJdInterviewConfig';
import {
  StudentPerformanceReportView,
  type PerformanceInterviewRow,
  type ProgressItem,
} from '@/components/ai-interview/StudentPerformanceReportView';
import {
  TpoCohortActivityPanel,
  type CohortActivityRow,
  type CohortStats,
  type CohortTemplateInfo,
} from '@/components/tpo/TpoCohortActivityPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Settings2, Activity, Shield, LogOut, Megaphone } from 'lucide-react';

type StatsResponse = {
  college?: { id: string; college_name: string; college_code: string };
  stats?: {
    total_students: number;
    free_students: number;
    paid_students: number;
    campus_interviews: number;
    campus_attempts: number;
  };
  course_breakdown?: Array<{
    course_id: string;
    course_name: string;
    course_code: string | null;
    student_count: number;
  }>;
};

type TemplateItem = {
  id: string;
  title: string;
  position?: string | null;
  status: 'draft' | 'published' | 'archived';
  interview_mode?: 'ai' | 'structured' | null;
  interview_type?: 'functional' | 'behavioral' | 'mixed' | 'technical' | null;
  custom_role_parameters_id?: string | null;
  max_attempts_per_candidate?: number | null;
  opens_at?: string | null;
  closes_at?: string | null;
  created_at: string;
  variants?: Array<{
    id: string;
    template_id: string;
    custom_role_parameters_id?: string | null;
    interview_mode: 'ai' | 'structured';
    interview_type: 'functional' | 'behavioral' | 'mixed' | 'technical';
    status: 'draft' | 'published' | 'archived';
    cohort_analytics_eligible?: boolean;
    opens_at?: string | null;
    closes_at?: string | null;
    max_attempts_per_candidate?: number | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  }>;
  courses: Array<{ course_id: string; course_name: string; course_code: string | null }>;
};

function variantEligibleForCohort(v: NonNullable<TemplateItem['variants']>[number]): boolean {
  if (v.cohort_analytics_eligible === true) return true;
  if (v.cohort_analytics_eligible === false) return false;
  return v.status === 'published';
}

/** Campus variants usable in cohort filters: published variant, or one tied to a published student application. */
function cohortPublishedVariants(t: TemplateItem | null | undefined): NonNullable<TemplateItem['variants']> {
  if (!t?.variants?.length) return [];
  return t.variants.filter(variantEligibleForCohort);
}

function templateHasCohortPublishedCombo(t: TemplateItem): boolean {
  if (cohortPublishedVariants(t).length > 0) return true;
  return t.status === 'published' && (!t.variants || t.variants.length === 0);
}

type InviteItem = {
  id: string;
  template_id: string;
  title: string;
  message?: string | null;
  status: 'draft' | 'sent' | 'closed' | 'archived' | string;
  created_at: string;
  stats?: {
    invited?: number;
    applied?: number;
    shortlisted?: number;
    rejected?: number;
    published?: number;
    withdrawn?: number;
    total?: number;
  };
};

type InviteApplicationItem = {
  id: string;
  invite_id?: string;
  invite_title?: string | null;
  invite_message?: string | null;
  candidate_id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  course_name?: string | null;
  course_code?: string | null;
  notes?: unknown;
  status: 'invited' | 'applied' | 'shortlisted' | 'rejected' | 'published' | 'withdrawn' | string;
  applied_at?: string | null;
};

type TpoStudentItem = {
  candidate_id: string;
  course_id?: string | null;
  candidate_name?: string | null;
  candidate_email?: string | null;
};

type TpoStudentInterviewItem = {
  id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  position?: string | null;
  status?: string;
  created_at: string;
  completed_at?: string | null;
  overall_score?: number | null;
  interview_source?: 'personal' | 'campus' | string;
  campus_template_id?: string | null;
  campus_template_title?: string | null;
  interview_mode?: string | null;
  interview_type?: string | null;
  duration_minutes?: number | null;
  total_questions?: number | null;
  competency_scores?: Record<string, number>;
  speech_metrics?: {
    overall_speech_quality?: number;
    speaking_pace_wpm?: number;
    filler_score?: number;
    filler_rate_per_min?: number;
    pause_quality_score?: number;
    voice_confidence?: number;
  } | null;
  parameter_breakdown?: Array<{
    key: string;
    name: string;
    score?: number | null;
    weight?: number | null;
  }>;
  answers_count?: number;
  action_items?: string[];
};

type TpoMeResponse = {
  tpo_user?: {
    id?: string;
    full_name: string;
    email: string;
    role: 'tpo_admin' | 'tpo_staff';
  };
};
type TpoUserProfile = NonNullable<TpoMeResponse['tpo_user']>;

type TpoSection = 'home' | 'configure' | 'invite_students' | 'publish_interviews' | 'activity' | 'settings';

type CollegeCourseRow = { id: string; course_name: string; course_code: string | null };
type PublishCompetencySummary = {
  role_name?: string | null;
  interview_mode?: string | null;
  interview_type?: string | null;
  custom_parameters?: Record<string, {
    name?: string;
    weight?: number;
    min_questions?: number;
    max_questions?: number;
    max_time?: number;
    description?: string;
    scoring_criteria?: string[] | string;
  }> | null;
  structured_questions?: Array<{ question?: string; timeLimit?: number }> | null;
};

function getInitials(fullName?: string): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0).toUpperCase() || '';
  const last = parts[1]?.charAt(0).toUpperCase() || '';
  return (first + last) || first || '?';
}

/** Default invite body shown in the TPO invite composer until the user edits it. */
function buildTpoDefaultInviteMessage(roleName: string, modeLabel: string, typeLabel: string): string {
  const aOrAn = modeLabel.toLowerCase().startsWith('a') ? 'an' : 'a';
  return [
    'Dear student,',
    '',
    `This is a message from your college Training & Placement Office (TPO). We have arranged a practice interview for the "${roleName}" role (${aOrAn} ${modeLabel} ${typeLabel} session) so you can get comfortable with the format before company interviews.`,
    '',
    'If you would like to take part, sign in to your student portal and open Campus interviews to apply.',
    '',
    'Warm regards,',
    'Training & Placement Cell',
  ].join('\n');
}

function parseInviteNotes(notes: unknown): Record<string, unknown> {
  if (!notes) return {};
  if (typeof notes === 'object') return notes as Record<string, unknown>;
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function inferVariantFromInviteText(text: string): { mode?: 'ai' | 'structured'; type?: 'functional' | 'behavioral' | 'mixed' | 'technical' } {
  const t = text.toLowerCase();
  const mode = t.includes('structured') ? 'structured' : t.includes('ai') ? 'ai' : undefined;
  let type: 'functional' | 'behavioral' | 'mixed' | 'technical' | undefined;
  if (t.includes('behavioral')) type = 'behavioral';
  else if (t.includes('functional')) type = 'functional';
  else if (t.includes('technical')) type = 'technical';
  else if (t.includes('mixed')) type = 'mixed';
  return { mode, type };
}

type TpoSidebarProps = {
  activeSection: TpoSection;
  onSectionChange: (section: TpoSection) => void;
  fullName?: string;
};

function TpoAppSidebar({ activeSection, onSectionChange, fullName }: TpoSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const menuBtnClass =
    'py-3.5 px-3 text-lg font-medium text-gray-800 hover:bg-sky-50 hover:text-sky-800 data-[active=true]:bg-sky-100 data-[active=true]:text-sky-800 [&>svg]:w-6 [&>svg]:h-6';

  const handleSectionNav = (section: TpoSection) => {
    onSectionChange(section);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="border-r border-sky-100 bg-white">
      <SidebarContent className="gap-0 pt-4 pb-4">
        <SidebarGroup className="px-3 pb-4">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-semibold text-3xl"
              aria-hidden
            >
              {getInitials(fullName)}
            </div>
            <p className="text-center text-lg font-medium text-gray-900 leading-tight break-words max-w-full">
              {fullName || 'TPO User'}
            </p>
          </div>
        </SidebarGroup>

        <SidebarGroup className="pt-8 pb-0">
          <SidebarGroupContent className="py-0">
            <SidebarMenu className="flex flex-col gap-3">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionNav('home')}
                  isActive={activeSection === 'home'}
                  tooltip="Home"
                  className={menuBtnClass}
                >
                  <Home className="w-6 h-6 shrink-0" />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionNav('configure')}
                  isActive={activeSection === 'configure'}
                  tooltip="Configure interview"
                  className={menuBtnClass}
                >
                  <Settings2 className="w-6 h-6 shrink-0" />
                  <span>Configure interview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionNav('invite_students')}
                  isActive={activeSection === 'invite_students'}
                  tooltip="Invite students"
                  className={menuBtnClass}
                >
                  <Megaphone className="w-6 h-6 shrink-0" />
                  <span>Invite students</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionNav('publish_interviews')}
                  isActive={activeSection === 'publish_interviews'}
                  tooltip="Publish steps"
                  className={menuBtnClass}
                >
                  <Megaphone className="w-6 h-6 shrink-0" />
                  <span>Publish steps</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionNav('activity')}
                  isActive={activeSection === 'activity'}
                  tooltip="Student activity"
                  className={menuBtnClass}
                >
                  <Activity className="w-6 h-6 shrink-0" />
                  <span>Student activity</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionNav('settings')}
                  isActive={activeSection === 'settings'}
                  tooltip="Admin settings"
                  className={menuBtnClass}
                >
                  <Shield className="w-6 h-6 shrink-0" />
                  <span>Admin settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const TpoDashboard = ({ initialTpoUser }: { initialTpoUser?: TpoUserProfile | null }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<TpoSection>('home');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [tpoMe, setTpoMe] = useState<TpoMeResponse | null>(
    initialTpoUser ? { tpo_user: initialTpoUser } : null
  );
  const [collegeCourses, setCollegeCourses] = useState<CollegeCourseRow[]>([]);
  const [courseSelection, setCourseSelection] = useState<Record<string, string[]>>({});
  const [activityCohortCourseId, setActivityCohortCourseId] = useState<string>('');
  const [activityCohortTemplateId, setActivityCohortTemplateId] = useState<string>('');
  const [activityCohortMode, setActivityCohortMode] = useState<'ai' | 'structured' | ''>('');
  const [activityCohortType, setActivityCohortType] = useState<
    'functional' | 'behavioral' | 'mixed' | 'technical' | ''
  >('');
  const [activityIndividualCourseId, setActivityIndividualCourseId] = useState<string>('');
  const [activityIndividualStudentId, setActivityIndividualStudentId] = useState<string>('all');
  const [cohortRows, setCohortRows] = useState<CohortActivityRow[]>([]);
  const [cohortTemplate, setCohortTemplate] = useState<CohortTemplateInfo | null>(null);
  const [cohortStats, setCohortStats] = useState<CohortStats | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [activityIndividualStudents, setActivityIndividualStudents] = useState<TpoStudentItem[]>([]);
  const [activityViewTab, setActivityViewTab] = useState<'cohort' | 'individual'>('cohort');
  const [studentInterviews, setStudentInterviews] = useState<TpoStudentInterviewItem[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentProgress, setStudentProgress] = useState<ProgressItem[]>([]);
  const [studentProgressLoading, setStudentProgressLoading] = useState(false);
  const [publishTemplateId, setPublishTemplateId] = useState<string>('');
  const [publishInterviewMode, setPublishInterviewMode] = useState<'ai' | 'structured'>('ai');
  const [publishInterviewType, setPublishInterviewType] = useState<'functional' | 'behavioral' | 'mixed' | 'technical'>('mixed');
  const [inviteTitle, setInviteTitle] = useState<string>('');
  const [inviteMessage, setInviteMessage] = useState<string>('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [applications, setApplications] = useState<InviteApplicationItem[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [inviteMessageEdited, setInviteMessageEdited] = useState(false);
  const [publishingSelected, setPublishingSelected] = useState(false);
  const [publishSummaryLoading, setPublishSummaryLoading] = useState(false);
  const [publishSummaryError, setPublishSummaryError] = useState<string | null>(null);
  const [publishSummary, setPublishSummary] = useState<PublishCompetencySummary | null>(null);
  const [expandedSummaryKeys, setExpandedSummaryKeys] = useState<Record<string, boolean>>({});
  const [inviteSummaryDialogOpen, setInviteSummaryDialogOpen] = useState(false);

  const courses = useMemo(() => stats?.course_breakdown || [], [stats]);

  const cohortTemplateLinkedToSelectedCourse = useMemo(() => {
    if (!activityCohortCourseId || !activityCohortTemplateId) return true;
    const t = templates.find((x) => x.id === activityCohortTemplateId);
    return (t?.courses || []).some((c) => c.course_id === activityCohortCourseId);
  }, [templates, activityCohortCourseId, activityCohortTemplateId]);

  const cohortSelectedTemplate = useMemo(
    () => templates.find((t) => t.id === activityCohortTemplateId) || null,
    [templates, activityCohortTemplateId],
  );

  /** Roles with at least one published mode/type (draft-only variants excluded). */
  const cohortRoleTemplates = useMemo(
    () => templates.filter((t) => templateHasCohortPublishedCombo(t)),
    [templates],
  );

  const cohortPublishedVariantRows = useMemo(
    () => cohortPublishedVariants(cohortSelectedTemplate),
    [cohortSelectedTemplate],
  );

  const cohortInterviewModeOptions = useMemo((): ('ai' | 'structured')[] => {
    const vars = cohortPublishedVariantRows;
    if (vars.length > 0) {
      return [...new Set(vars.map((v) => v.interview_mode).filter(Boolean))] as ('ai' | 'structured')[];
    }
    if (
      cohortSelectedTemplate?.status === 'published' &&
      (!cohortSelectedTemplate.variants || cohortSelectedTemplate.variants.length === 0)
    ) {
      const m = cohortSelectedTemplate.interview_mode;
      return m ? [m as 'ai' | 'structured'] : [];
    }
    return [];
  }, [cohortPublishedVariantRows, cohortSelectedTemplate]);

  const cohortInterviewTypeOptions = useMemo((): ('functional' | 'behavioral' | 'mixed' | 'technical')[] => {
    const vars = cohortPublishedVariantRows;
    const filtered = activityCohortMode
      ? vars.filter((v) => v.interview_mode === activityCohortMode)
      : vars;
    if (filtered.length > 0) {
      return [...new Set(filtered.map((v) => v.interview_type).filter(Boolean))] as (
        | 'functional'
        | 'behavioral'
        | 'mixed'
        | 'technical'
      )[];
    }
    if (
      cohortSelectedTemplate?.status === 'published' &&
      (!cohortSelectedTemplate.variants || cohortSelectedTemplate.variants.length === 0) &&
      (!activityCohortMode || cohortSelectedTemplate.interview_mode === activityCohortMode)
    ) {
      const ty = cohortSelectedTemplate.interview_type;
      return ty ? [ty as 'functional' | 'behavioral' | 'mixed' | 'technical'] : [];
    }
    return [];
  }, [cohortPublishedVariantRows, cohortSelectedTemplate, activityCohortMode]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [statsRes, templatesRes, coursesRes] = await Promise.all([
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_DASHBOARD_STATS), { headers }),
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_CAMPUS_INTERVIEWS), { headers }),
        fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_COLLEGE_COURSES), { headers }),
      ]);

      const statsJson = (await statsRes.json().catch(() => ({}))) as StatsResponse & { error?: string };
      if (!statsRes.ok) throw new Error(statsJson.error || 'Failed to load dashboard stats');

      const tplJson = (await templatesRes.json().catch(() => ({}))) as { templates?: TemplateItem[]; error?: string };
      if (!templatesRes.ok) throw new Error(tplJson.error || 'Failed to load templates');
      const coursesJson = (await coursesRes.json().catch(() => ({}))) as { courses?: CollegeCourseRow[]; error?: string };
      if (coursesRes.ok) {
        setCollegeCourses(coursesJson.courses || []);
      } else {
        setCollegeCourses([]);
        toast({
          title: 'Could not load college programs',
          description: coursesJson.error || 'Publish tab may be limited until the server is updated.',
          variant: 'destructive',
        });
      }

      setStats(statsJson);
      setTemplates(tplJson.templates || []);
    } catch (err: unknown) {
      toast({
        title: 'Failed to load dashboard',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Mount-only dashboard load; loadData closes over toast/setters — do not add as dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialTpoUser) {
      setTpoMe({ tpo_user: initialTpoUser });
    }
  }, [initialTpoUser]);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const t of templates) {
      next[t.id] = (t.courses || []).map((c) => c.course_id).filter(Boolean);
    }
    setCourseSelection(next);
  }, [templates]);

  useEffect(() => {
    if (templates.length === 0) {
      setPublishTemplateId('');
      return;
    }
    if (!publishTemplateId || !templates.some((t) => t.id === publishTemplateId)) {
      setPublishTemplateId(templates[0].id);
    }
  }, [templates, publishTemplateId]);

  useEffect(() => {
    const tpl = templates.find((t) => t.id === publishTemplateId) || templates[0];
    if (!tpl) return;
    const variants = tpl.variants || [];
    if (variants.length > 0) {
      setPublishInterviewMode(variants[0].interview_mode || 'ai');
      setPublishInterviewType((variants[0].interview_type || 'mixed') as 'functional' | 'behavioral' | 'mixed' | 'technical');
      return;
    }
    if (tpl.interview_mode) setPublishInterviewMode(tpl.interview_mode);
    if (tpl.interview_type) {
      setPublishInterviewType(tpl.interview_type as 'functional' | 'behavioral' | 'mixed' | 'technical');
    }
  }, [publishTemplateId, templates]);

  useEffect(() => {
    if (activeSection !== 'invite_students' && activeSection !== 'publish_interviews') return;
    loadInvites(publishTemplateId || templates[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, publishTemplateId, templates.length]);

  useEffect(() => {
    if (inviteMessageEdited) return;
    const tpl = templates.find((t) => t.id === publishTemplateId) || templates[0];
    if (!tpl) return;
    const localModeLabel = publishInterviewMode === 'ai' ? 'AI' : 'Structured';
    const roleName = tpl.title || tpl.position || 'this role';
    const localTypeLabel = publishInterviewType.charAt(0).toUpperCase() + publishInterviewType.slice(1);
    const localTitle = `${roleName} - ${localModeLabel} ${localTypeLabel} practice invite`;
    const localMessage = buildTpoDefaultInviteMessage(roleName, localModeLabel, localTypeLabel);
    setInviteMessage(localMessage);
    setInviteTitle(localTitle);
  }, [templates, publishTemplateId, publishInterviewMode, publishInterviewType, inviteMessageEdited]);

  useEffect(() => {
    const appliedIds = applications
      .filter((a) => (a.status || '').toLowerCase() === 'applied')
      .map((a) => a.id)
      .filter(Boolean);
    setSelectedApplicationIds(appliedIds);
  }, [applications]);

  useEffect(() => {
    if (activeSection !== 'publish_interviews') return;
    loadAppliedApplicationsForTemplate(
      publishTemplateId || templates[0]?.id,
      publishInterviewMode,
      publishInterviewType
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, publishTemplateId, publishInterviewMode, publishInterviewType, templates.length]);

  useEffect(() => {
    let cancelled = false;
    const loadPublishSummary = async () => {
      const tpl = templates.find((t) => t.id === publishTemplateId) || templates[0];
      const variant = (tpl?.variants || []).find(
        (v) => v.interview_mode === publishInterviewMode && v.interview_type === publishInterviewType
      );
      const crpId = variant?.custom_role_parameters_id;
      if (!crpId) {
        setPublishSummary(null);
        setPublishSummaryError(null);
        setPublishSummaryLoading(false);
        return;
      }
      setPublishSummaryLoading(true);
      setPublishSummaryError(null);
      try {
        const { data, error } = await supabase
          .from('custom_role_parameters')
          .select('role_name, interview_mode, interview_type, custom_parameters, structured_questions')
          .eq('id', crpId)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setPublishSummary((data as PublishCompetencySummary | null) || null);
      } catch (e: unknown) {
        if (cancelled) return;
        setPublishSummary(null);
        setPublishSummaryError(e instanceof Error ? e.message : 'Could not load competency summary');
      } finally {
        if (!cancelled) setPublishSummaryLoading(false);
      }
    };
    loadPublishSummary();
    return () => {
      cancelled = true;
    };
  }, [templates, publishTemplateId, publishInterviewMode, publishInterviewType]);

  useEffect(() => {
    setExpandedSummaryKeys({});
  }, [publishTemplateId, publishInterviewMode, publishInterviewType, publishSummary?.role_name]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/tpo-login';
  };

  const firstName = (tpoMe?.tpo_user?.full_name || '').trim().split(/\s+/)[0] || 'User';
  /** Cohort API: course + parent template + mode + type (matches interview rows). */
  const activityCohortReady = Boolean(
    activityCohortCourseId &&
      activityCohortTemplateId &&
      activityCohortMode &&
      activityCohortType,
  );
  const greeting = `Welcome back, ${firstName}`;
  const truncatedGreeting = greeting.length > 30 ? `${greeting.substring(0, 27)}...` : greeting;
  const selectedPublishTemplate = useMemo(
    () => templates.find((t) => t.id === publishTemplateId) || templates[0],
    [templates, publishTemplateId]
  );
  const selectedPublishVariant = useMemo(
    () =>
      (selectedPublishTemplate?.variants || []).find(
        (v) => v.interview_mode === publishInterviewMode && v.interview_type === publishInterviewType
      ) || null,
    [selectedPublishTemplate, publishInterviewMode, publishInterviewType]
  );
  const modeLabel = publishInterviewMode === 'ai' ? 'AI' : 'Structured';
  const typeLabel = publishInterviewType.charAt(0).toUpperCase() + publishInterviewType.slice(1);
  const publishVariantOptions = useMemo(() => {
    return templates.flatMap((tpl) => {
      const roleName = tpl.title || tpl.position || 'Role';
      const variants = (tpl.variants || []).map((v) => {
        const mode = v.interview_mode === 'ai' ? 'AI' : 'Structured';
        const type = v.interview_type.charAt(0).toUpperCase() + v.interview_type.slice(1);
        return {
          value: `${tpl.id}::${v.interview_mode}::${v.interview_type}`,
          label: `${roleName} - ${mode} - ${type}`,
        };
      });
      if (variants.length > 0) return variants;
      const fallbackMode = tpl.interview_mode || 'ai';
      const fallbackType = (tpl.interview_type || 'mixed') as 'functional' | 'behavioral' | 'mixed' | 'technical';
      const mode = fallbackMode === 'ai' ? 'AI' : 'Structured';
      const type = fallbackType.charAt(0).toUpperCase() + fallbackType.slice(1);
      return [{
        value: `${tpl.id}::${fallbackMode}::${fallbackType}`,
        label: `${roleName} - ${mode} - ${type}`,
      }];
    });
  }, [templates]);
  const publishVariantValue = `${selectedPublishTemplate?.id || ''}::${publishInterviewMode}::${publishInterviewType}`;
  const inviteRoleName = selectedPublishTemplate?.title || selectedPublishTemplate?.position || 'this role';
  const generatedInviteTitle = `${inviteRoleName} - ${modeLabel} ${typeLabel} practice invite`;
  const generatedInviteMessage = buildTpoDefaultInviteMessage(inviteRoleName, modeLabel, typeLabel);
  const appliedApplications = applications.filter((a) => (a.status || '').toLowerCase() === 'applied');
  const publishedApplications = applications.filter((a) => (a.status || '').toLowerCase() === 'published');
  const allPublishedForRole =
    appliedApplications.length === 0 && publishedApplications.length > 0;

  const handleTpoWorkflowStep = (step: number) => {
    if (step === 0) setActiveSection('configure');
    else if (step === 1) setActiveSection('activity');
  };

  const toggleCourseForTemplate = (templateId: string, courseId: string) => {
    setCourseSelection((prev) => {
      const cur = new Set(prev[templateId] || []);
      if (cur.has(courseId)) cur.delete(courseId);
      else cur.add(courseId);
      return { ...prev, [templateId]: Array.from(cur) };
    });
  };

  const selectAllCoursesForTemplate = (templateId: string, selectAll: boolean) => {
    setCourseSelection((prev) => ({
      ...prev,
      [templateId]: selectAll ? collegeCourses.map((c) => c.id) : [],
    }));
  };

  const loadInvites = async (templateId?: string) => {
    if (!templateId) {
      setInvites([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const q = `?template_id=${encodeURIComponent(templateId)}`;
      const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_CAMPUS_ROLE_INVITES}${q}`), { headers });
      const data = (await res.json().catch(() => ({}))) as { invites?: InviteItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load invites');
      const rows = data.invites || [];
      setInvites(rows);
    } catch (e: unknown) {
      setInvites([]);
      toast({
        title: 'Could not load applications',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
    }
  };

  const loadAppliedApplicationsForTemplate = async (
    templateId?: string,
    desiredMode?: 'ai' | 'structured',
    desiredType?: 'functional' | 'behavioral' | 'mixed' | 'technical'
  ) => {
    if (!templateId) {
      setApplications([]);
      return;
    }
    try {
      setLoadingApplications(true);
      const headers = await getAuthHeaders();
      const q = `?template_id=${encodeURIComponent(templateId)}`;
      const invitesRes = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_CAMPUS_ROLE_INVITES}${q}`), { headers });
      const invitesData = (await invitesRes.json().catch(() => ({}))) as { invites?: InviteItem[]; error?: string };
      if (!invitesRes.ok) throw new Error(invitesData.error || 'Failed to load invites');
      const roleInvites = invitesData.invites || [];
      setInvites(roleInvites);
      if (roleInvites.length === 0) {
        setApplications([]);
        return;
      }
      const appResponses = await Promise.all(
        roleInvites.map(async (inv) => {
          const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_CAMPUS_ROLE_INVITES}/${inv.id}/applications`), { headers });
          const data = (await res.json().catch(() => ({}))) as { applications?: InviteApplicationItem[]; error?: string };
          if (!res.ok) throw new Error(data.error || `Failed to load applicants for ${inv.title}`);
          return (data.applications || []).map((a) => ({
            ...a,
            invite_id: inv.id,
            invite_title: inv.title,
            invite_message: inv.message ?? null,
          }));
        })
      );
      const merged = appResponses.flat();
      const filtered = merged.filter((row) => {
        if (!desiredMode || !desiredType) return true;
        const notesObj = parseInviteNotes(row.notes);
        const noteMode = String(notesObj.interview_mode || '').toLowerCase();
        const noteType = String(notesObj.interview_type || '').toLowerCase();
        if (noteMode && noteType) {
          return noteMode === desiredMode && noteType === desiredType;
        }
        // Backward compatibility for older invites created before notes stamping.
        const inferred = inferVariantFromInviteText(`${row.invite_title || ''} ${row.invite_message || ''}`);
        if (inferred.mode && inferred.type) {
          return inferred.mode === desiredMode && inferred.type === desiredType;
        }
        return true;
      });
      setApplications(filtered);
    } catch (e: unknown) {
      setApplications([]);
      toast({
        title: 'Could not load applicants',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingApplications(false);
    }
  };

  const handleSendInvite = async () => {
    const templateId = publishTemplateId || templates[0]?.id;
    if (!templateId) return;
    const ids = courseSelection[templateId] || [];
    if (ids.length === 0) {
      toast({
        title: 'Select at least one course',
        description: 'Choose the program(s) that should receive this role form.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSendingInvite(true);
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_CAMPUS_ROLE_INVITES), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          template_id: templateId,
          title: (inviteTitle || '').trim() || generatedInviteTitle,
          message: (inviteMessage || '').trim() || generatedInviteMessage,
          course_ids: ids,
          interview_mode: publishInterviewMode,
          interview_type: publishInterviewType,
          custom_role_parameters_id: selectedPublishVariant?.custom_role_parameters_id || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; invited_count?: number };
      if (!res.ok) throw new Error(data.error || 'Failed to send form');
      toast({
        title: 'Form sent',
        description: `Invite sent to ${data.invited_count ?? 0} students.`,
      });
      setInviteTitle(generatedInviteTitle);
      setInviteMessage(generatedInviteMessage);
      setInviteMessageEdited(false);
      await loadInvites(templateId);
    } catch (e: unknown) {
      toast({
        title: 'Could not send form',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const publishSelectedApplicants = async () => {
    if (selectedApplicationIds.length === 0) {
      toast({
        title: 'No students selected',
        description: 'Select at least one applied student to publish this interview.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setPublishingSelected(true);
      const headers = await getAuthHeaders();
      const selectedSet = new Set(selectedApplicationIds);
      const groupedByInvite = applications
        .filter((a) => selectedSet.has(a.id) && a.invite_id)
        .reduce<Record<string, string[]>>((acc, row) => {
          const inviteId = row.invite_id as string;
          if (!acc[inviteId]) acc[inviteId] = [];
          acc[inviteId].push(row.id);
          return acc;
        }, {});
      const inviteIds = Object.keys(groupedByInvite);
      if (inviteIds.length === 0) {
        throw new Error('No eligible applications found for publishing.');
      }
      let totalPublished = 0;
      for (const inviteId of inviteIds) {
        const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_CAMPUS_ROLE_INVITES}/${inviteId}/publish-selected`), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            application_ids: groupedByInvite[inviteId],
            interview_mode: publishInterviewMode,
            interview_type: publishInterviewType,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; published_count?: number };
        if (!res.ok) throw new Error(data.error || 'Failed to publish selected');
        totalPublished += data.published_count ?? 0;
      }
      toast({
        title: 'Published',
        description: `${totalPublished} students can now take this interview.`,
      });
      await loadAppliedApplicationsForTemplate(publishTemplateId || templates[0]?.id);
      await loadInvites(publishTemplateId);
      await loadData();
    } catch (e: unknown) {
      toast({
        title: 'Publish failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPublishingSelected(false);
    }
  };

  const loadActivityIndividualStudents = async (courseId: string) => {
    if (!courseId) {
      setActivityIndividualStudents([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const q = `?course_id=${encodeURIComponent(courseId)}`;
      const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_STUDENTS}${q}`), { headers });
      const data = (await res.json().catch(() => ({}))) as { students?: TpoStudentItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load students');
      setActivityIndividualStudents(data.students || []);
    } catch (e: unknown) {
      setActivityIndividualStudents([]);
      toast({
        title: 'Could not load students',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const loadStudentInterviews = async (candidateId: string) => {
    if (!candidateId || candidateId === 'all') {
      setStudentInterviews([]);
      return;
    }
    try {
      setStudentLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_STUDENTS}/${candidateId}/interviews?limit=200`), { headers });
      const data = (await res.json().catch(() => ({}))) as { interviews?: TpoStudentInterviewItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load student interviews');
      setStudentInterviews(data.interviews || []);
    } catch (e: unknown) {
      setStudentInterviews([]);
      toast({
        title: 'Could not load interview history',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setStudentLoading(false);
    }
  };

  useEffect(() => {
    if (!activityCohortCourseId) {
      setActivityCohortTemplateId('');
      return;
    }
    const tf = cohortRoleTemplates;
    setActivityCohortTemplateId((prev) => {
      if (prev && tf.some((t) => t.id === prev)) return prev;
      return tf[0]?.id || '';
    });
  }, [activityCohortCourseId, cohortRoleTemplates]);

  useEffect(() => {
    if (!activityCohortTemplateId) {
      setActivityCohortMode('');
      setActivityCohortType('');
      return;
    }
    const tpl = templates.find((t) => t.id === activityCohortTemplateId);
    if (!tpl) return;
    const vars = cohortPublishedVariants(tpl);
    const modes: ('ai' | 'structured')[] =
      vars.length > 0
        ? ([...new Set(vars.map((v) => v.interview_mode).filter(Boolean))] as ('ai' | 'structured')[])
        : tpl.status === 'published' && (!tpl.variants || tpl.variants.length === 0) && tpl.interview_mode
          ? [tpl.interview_mode as 'ai' | 'structured']
          : [];
    setActivityCohortMode((prev) => (prev && modes.includes(prev) ? prev : modes[0] || ''));
  }, [activityCohortTemplateId, templates]);

  useEffect(() => {
    if (!activityCohortTemplateId || !activityCohortMode) {
      setActivityCohortType('');
      return;
    }
    const tpl = templates.find((t) => t.id === activityCohortTemplateId);
    if (!tpl) return;
    const vars = cohortPublishedVariants(tpl);
    const types: ('functional' | 'behavioral' | 'mixed' | 'technical')[] =
      vars.length > 0
        ? ([
            ...new Set(
              vars
                .filter((v) => v.interview_mode === activityCohortMode)
                .map((v) => v.interview_type)
                .filter(Boolean),
            ),
          ] as ('functional' | 'behavioral' | 'mixed' | 'technical')[])
        : tpl.status === 'published' &&
            (!tpl.variants || tpl.variants.length === 0) &&
            (!activityCohortMode || tpl.interview_mode === activityCohortMode) &&
            tpl.interview_type
          ? [tpl.interview_type as 'functional' | 'behavioral' | 'mixed' | 'technical']
          : [];
    setActivityCohortType((prev) => (prev && types.includes(prev) ? prev : types[0] || ''));
  }, [activityCohortTemplateId, activityCohortMode, templates]);

  useEffect(() => {
    if (activeSection !== 'activity') return;
    setActivityViewTab('cohort');
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'activity') return;
    loadActivityIndividualStudents(activityIndividualCourseId);
    setActivityIndividualStudentId('all');
    setStudentInterviews([]);
    setStudentProgress([]);
  }, [activeSection, activityIndividualCourseId]);

  useEffect(() => {
    if (
      activeSection !== 'activity' ||
      !activityCohortCourseId ||
      !activityCohortTemplateId ||
      !activityCohortMode ||
      !activityCohortType
    ) {
      setCohortRows([]);
      setCohortTemplate(null);
      setCohortStats(null);
      setCohortError(null);
      setCohortLoading(false);
      return;
    }
    let cancelled = false;
    setCohortLoading(true);
    setCohortError(null);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({
          course_id: activityCohortCourseId,
          campus_template_id: activityCohortTemplateId,
          interview_mode: activityCohortMode,
          interview_type: activityCohortType,
        });
        const res = await fetch(
          buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_ACTIVITY_COHORT}?${params.toString()}`),
          { headers },
        );
        const data = (await res.json().catch(() => ({}))) as {
          rows?: CohortActivityRow[];
          template?: CohortTemplateInfo | null;
          cohort_stats?: CohortStats | null;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load cohort activity');
        if (cancelled) return;
        setCohortTemplate(data.template ?? null);
        setCohortRows(Array.isArray(data.rows) ? data.rows : []);
        setCohortStats(data.cohort_stats ?? null);
      } catch (e: unknown) {
        if (!cancelled) {
          setCohortRows([]);
          setCohortTemplate(null);
          setCohortStats(null);
          setCohortError(e instanceof Error ? e.message : 'Failed to load cohort');
        }
      } finally {
        if (!cancelled) setCohortLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, activityCohortCourseId, activityCohortTemplateId, activityCohortMode, activityCohortType]);

  useEffect(() => {
    if (activeSection !== 'activity') return;
    if (!activityIndividualCourseId || activityIndividualStudentId === 'all') {
      setStudentInterviews([]);
      setStudentLoading(false);
      return;
    }
    loadStudentInterviews(activityIndividualStudentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activityIndividualCourseId, activityIndividualStudentId]);

  useEffect(() => {
    if (
      activeSection !== 'activity' ||
      activityIndividualStudentId === 'all' ||
      !activityIndividualCourseId
    ) {
      setStudentProgress([]);
      setStudentProgressLoading(false);
      return;
    }
    let cancelled = false;
    setStudentProgressLoading(true);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const url = buildApiUrl(
          `${API_CONFIG.ENDPOINTS.TPO_STUDENTS}/${encodeURIComponent(activityIndividualStudentId)}/interview-progress`,
        );
        const r = await fetch(url, { headers });
        const raw = r.ok ? await r.json().catch(() => []) : [];
        if (cancelled) return;
        if (!r.ok) {
          setStudentProgress([]);
          return;
        }
        const arr = Array.isArray(raw) ? raw : [];
        const normalized: ProgressItem[] = arr.map((item: Record<string, unknown>) => {
          const { parameter_scores: ps, competency_scores: cs, ...rest } = item as Record<string, unknown> & {
            parameter_scores?: Record<string, number>;
            competency_scores?: Record<string, number>;
          };
          const named = typeof cs === 'object' && cs != null && Object.keys(cs).length > 0 ? cs : ps;
          return {
            ...rest,
            competency_scores: (named ?? {}) as Record<string, number>,
          } as ProgressItem;
        });
        setStudentProgress(normalized);
      } catch {
        if (!cancelled) setStudentProgress([]);
      } finally {
        if (!cancelled) setStudentProgressLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, activityIndividualCourseId, activityIndividualStudentId]);

  const tpoIndividualReportRows = useMemo((): PerformanceInterviewRow[] => {
    return studentInterviews.map((i) => ({
      id: i.id,
      position: i.position ?? null,
      status: i.status ?? null,
      created_at: i.created_at,
      candidate_name: i.candidate_name ?? null,
      interview_source: i.interview_source ?? null,
      campus_template_id: i.campus_template_id ?? null,
      overall_score: i.overall_score ?? null,
      completed_at: i.completed_at ?? null,
    }));
  }, [studentInterviews]);

  const selectedStudentDisplayName = useMemo(() => {
    const s = activityIndividualStudents.find((x) => x.candidate_id === activityIndividualStudentId);
    return (
      s?.candidate_name ||
      s?.candidate_email ||
      studentInterviews[0]?.candidate_name ||
      studentInterviews[0]?.candidate_email ||
      'Student'
    );
  }, [activityIndividualStudents, activityIndividualStudentId, studentInterviews]);

  const renderInviteStudents = () => (
    <div className="w-full min-w-0 space-y-6">
      {loading ? (
        <p className="text-sm text-gray-600">Loading templates…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-600">
          No campus interview templates yet. Use <strong>Configure interview</strong> to add a JD and competencies first.
        </p>
      ) : collegeCourses.length === 0 ? (
        <p className="text-sm text-amber-800">
          No active programs found for your college. Add <strong>college_courses</strong> before publishing.
        </p>
      ) : (
        <Fragment>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Invite students to apply</CardTitle>
            <CardDescription>
              Choose role, mode, and type. Send your message, then publish to applicants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={publishTemplateId} onValueChange={setPublishTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Interview Mode</Label>
                <Select
                  value={publishInterviewMode}
                  onValueChange={(v: 'ai' | 'structured') => setPublishInterviewMode(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI Interview (Dynamic)</SelectItem>
                    <SelectItem value="structured">Structured Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Interview Type</Label>
                <Select
                  value={publishInterviewType}
                  onValueChange={(v: 'functional' | 'behavioral' | 'mixed' | 'technical') => setPublishInterviewType(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:self-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setInviteSummaryDialogOpen(true)}
                >
                  Summary
                </Button>
              </div>
            </div>

            {selectedPublishTemplate ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">Programs (courses) to invite</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => selectAllCoursesForTemplate(selectedPublishTemplate.id, true)}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => selectAllCoursesForTemplate(selectedPublishTemplate.id, false)}
                  >
                    Clear
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto border rounded-md p-3 bg-gray-50/80">
                  {collegeCourses.map((c) => {
                    const selected = new Set(courseSelection[selectedPublishTemplate.id] || []);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={() => toggleCourseForTemplate(selectedPublishTemplate.id, c.id)}
                        />
                        <span>
                          {c.course_name}
                          {c.course_code ? <span className="text-gray-500"> ({c.course_code})</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Invite title</Label>
              <input
                className="h-10 border rounded-md px-3 text-sm w-full"
                placeholder="Invite title"
                value={inviteTitle}
                onChange={(e) => setInviteTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Invitation message</Label>
              <Textarea
                className="min-h-[110px]"
                placeholder="Type message shown to students"
                value={inviteMessage}
                onChange={(e) => {
                  setInviteMessage(e.target.value);
                  setInviteMessageEdited(true);
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-sky-600 hover:bg-sky-700"
                onClick={handleSendInvite}
                disabled={sendingInvite || !publishTemplateId}
              >
                {sendingInvite ? 'Sending…' : 'Send invite to students'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={inviteSummaryDialogOpen} onOpenChange={setInviteSummaryDialogOpen}>
          <DialogContent className="max-w-3xl lg:max-w-4xl max-h-[85vh] gap-0 p-0 overflow-hidden sm:rounded-lg grid grid-rows-[auto_minmax(0,1fr)]">
            <DialogHeader className="px-7 pt-7 pb-3 pr-14">
              <DialogTitle className="text-left text-lg sm:text-xl">Configured competency summary</DialogTitle>
              <DialogDescription className="text-left">
                Overview for the selected role, interview mode, and type ({modeLabel} · {typeLabel}).
              </DialogDescription>
            </DialogHeader>
            <div className="px-7 pb-7 overflow-y-auto min-h-0 border-t border-border/60 pt-5 bg-slate-50/50">
              {publishSummaryLoading ? (
                <p className="text-sm text-gray-600">Loading summary…</p>
              ) : publishSummaryError ? (
                <p className="text-sm text-amber-800">{publishSummaryError}</p>
              ) : !selectedPublishVariant ? (
                <p className="text-sm text-gray-600">No variant row found for this role + mode + type yet.</p>
              ) : !selectedPublishVariant.custom_role_parameters_id ? (
                <p className="text-sm text-gray-600">This combination exists but competencies are not saved yet.</p>
              ) : !publishSummary ? (
                <p className="text-sm text-gray-600">No competency details available for this configuration.</p>
              ) : (
                (() => {
                  const cp = publishSummary.custom_parameters || {};
                  const cpEntries = Object.entries(cp);
                  const sq = Array.isArray(publishSummary.structured_questions) ? publishSummary.structured_questions : [];
                  const isAI = cpEntries.length > 0;
                  const totalQuestions = isAI
                    ? cpEntries.reduce((sum, [, v]) => {
                        const minQ = Number(v?.min_questions ?? 1);
                        const maxQ = Number(v?.max_questions ?? 1);
                        return sum + Math.max(1, Math.round((minQ + maxQ) / 2));
                      }, 0)
                    : sq.length;
                  const totalDuration = isAI
                    ? cpEntries.reduce((sum, [, v]) => sum + (Number(v?.max_time ?? 2) + 0.5), 4)
                    : sq.reduce((sum, q) => sum + Number(q?.timeLimit ?? 2), 4);
                  const totalWeight = isAI
                    ? cpEntries.reduce((sum, [, v]) => sum + Number(v?.weight ?? 0), 0)
                    : 100;
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border bg-sky-50 p-3 text-center">
                          <p className="text-xl font-bold text-sky-800">{Math.round(totalQuestions)}</p>
                          <p className="text-xs text-sky-700">Total Questions</p>
                        </div>
                        <div className="rounded-lg border bg-sky-50 p-3 text-center">
                          <p className="text-xl font-bold text-sky-800">{Math.round(totalDuration)} min</p>
                          <p className="text-xs text-sky-700">Duration</p>
                        </div>
                        <div className="rounded-lg border bg-sky-50 p-3 text-center">
                          <p className="text-xl font-bold text-sky-800">{isAI ? cpEntries.length : sq.length}</p>
                          <p className="text-xs text-sky-700">{isAI ? 'Competencies' : 'Questions'}</p>
                        </div>
                        <div className="rounded-lg border bg-sky-50 p-3 text-center">
                          <p className="text-xl font-bold text-sky-800">{Math.round(totalWeight)}%</p>
                          <p className="text-xs text-sky-700">Weightage</p>
                        </div>
                      </div>
                      {isAI ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-800">Competency Weightage Summary</p>
                          {cpEntries.map(([key, value], idx) => {
                            const weight = Number(value?.weight ?? 0);
                            const barColor = idx % 2 === 0 ? 'bg-blue-500' : 'bg-emerald-500';
                            const isExpanded = !!expandedSummaryKeys[key];
                            const scoring =
                              Array.isArray(value?.scoring_criteria)
                                ? value.scoring_criteria
                                : typeof value?.scoring_criteria === 'string'
                                  ? value.scoring_criteria.split('\n').map((s) => s.trim()).filter(Boolean)
                                  : [];
                            const descriptionPoints = (value?.description || '')
                              .split('•')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            return (
                              <div key={key} className="rounded-md border bg-white p-3">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                  <p className="text-sm text-gray-900">{value?.name || key}</p>
                                  <p className="text-sm font-semibold text-gray-700">{weight}%</p>
                                </div>
                                <div className="w-full h-1.5 rounded bg-gray-200 overflow-hidden">
                                  <div className={`h-1.5 ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, weight))}%` }} />
                                </div>
                                <button
                                  type="button"
                                  className="mt-2 text-xs text-sky-700 hover:text-sky-800"
                                  onClick={() =>
                                    setExpandedSummaryKeys((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                >
                                  {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                                </button>
                                {isExpanded ? (
                                  <div className="mt-3 space-y-3 border-t pt-3">
                                    {descriptionPoints.length > 0 ? (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-700 mb-1">Full Description:</p>
                                        <ul className="list-disc pl-4 space-y-1 text-xs text-gray-600">
                                          {descriptionPoints.map((point, pIdx) => (
                                            <li key={`${key}-desc-${pIdx}`}>{point}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-700 mb-1">Competency Details:</p>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-700">
                                        <div className="rounded border p-2">
                                          <p className="text-gray-500">Weight</p>
                                          <p className="font-semibold">{weight}%</p>
                                        </div>
                                        <div className="rounded border p-2">
                                          <p className="text-gray-500">Min Questions</p>
                                          <p className="font-semibold">{Number(value?.min_questions ?? 1)}</p>
                                        </div>
                                        <div className="rounded border p-2">
                                          <p className="text-gray-500">Max Questions</p>
                                          <p className="font-semibold">{Number(value?.max_questions ?? 1)}</p>
                                        </div>
                                        <div className="rounded border p-2">
                                          <p className="text-gray-500">Time (minutes)</p>
                                          <p className="font-semibold">{Number(value?.max_time ?? 2)}</p>
                                        </div>
                                      </div>
                                    </div>
                                    {scoring.length > 0 ? (
                                      <div>
                                        <p className="text-xs font-semibold text-gray-700 mb-1">Scoring Criteria:</p>
                                        <ul className="list-disc pl-4 space-y-1 text-xs text-gray-600">
                                          {scoring.map((criterion, cIdx) => (
                                            <li key={`${key}-score-${cIdx}`}>{criterion}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-800">Structured questions</p>
                          {sq.slice(0, 5).map((q, idx) => (
                            <div key={idx} className="rounded-md border bg-white p-3 text-sm text-gray-700">
                              Q{idx + 1}. {q.question || 'Question'} {q.timeLimit != null ? `• ${q.timeLimit} min` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </DialogContent>
        </Dialog>
        </Fragment>
      )}

    </div>
  );

  const renderPublishInterviews = () => (
    <div className="w-full min-w-0 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publish interviews</CardTitle>
          <CardDescription>
            Select a role to see all applied students and publish interview links in one click.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-sm text-gray-600">Loading templates…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-600">
          No campus interview templates yet. Use <strong>Configure interview</strong> to add a JD and competencies first.
        </p>
      ) : (
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <CardTitle className="text-lg">Applicants by role</CardTitle>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={publishVariantValue}
                onValueChange={(value) => {
                  const [templateId, mode, type] = value.split('::');
                  if (!templateId) return;
                  setPublishTemplateId(templateId);
                  if (mode === 'ai' || mode === 'structured') {
                    setPublishInterviewMode(mode);
                  }
                  if (type === 'functional' || type === 'behavioral' || type === 'mixed' || type === 'technical') {
                    setPublishInterviewType(type);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role + mode + type" />
                </SelectTrigger>
                <SelectContent>
                  {publishVariantOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingApplications ? (
              <p className="text-sm text-gray-600">Loading applicants…</p>
            ) : invites.length === 0 ? (
              <p className="text-sm text-gray-600">No invites sent for this role yet.</p>
            ) : appliedApplications.length === 0 ? (
              <p className="text-sm text-gray-600">No applied students yet for this role.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={appliedApplications.length > 0 && selectedApplicationIds.length === appliedApplications.length}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedApplicationIds(appliedApplications.map((a) => a.id));
                      else setSelectedApplicationIds([]);
                    }}
                  />
                  <p className="text-sm text-gray-700">Select all applied students ({appliedApplications.length})</p>
                </div>
                {appliedApplications.map((a) => (
                  <label key={a.id} className="border rounded-md p-3 flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={selectedApplicationIds.includes(a.id)}
                      onCheckedChange={(checked) => {
                        setSelectedApplicationIds((prev) => {
                          if (checked) return Array.from(new Set([...prev, a.id]));
                          return prev.filter((id) => id !== a.id);
                        });
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{a.candidate_name || a.candidate_email || a.candidate_id}</p>
                      <p className="text-sm text-gray-600">
                        {(a.course_name || 'Course')} {a.course_code ? `(${a.course_code})` : ''}
                        {a.applied_at ? ` • applied ${new Date(a.applied_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="pt-1 space-y-2">
              {publishedApplications.length > 0 ? (
                <p className="text-xs text-emerald-700">Already published for this role: {publishedApplications.length}</p>
              ) : null}
              <Button
                variant={allPublishedForRole ? 'outline' : 'default'}
                className={
                  allPublishedForRole
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 disabled:opacity-100 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }
                disabled={
                  publishingSelected ||
                  allPublishedForRole ||
                  selectedApplicationIds.length === 0
                }
                onClick={allPublishedForRole ? undefined : publishSelectedApplicants}
              >
                {publishingSelected
                  ? 'Publishing…'
                  : allPublishedForRole
                    ? `Published (${publishedApplications.length})`
                    : `Publish (${selectedApplicationIds.length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderHome = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">College</p>
          <p className="text-xl font-semibold text-gray-900">{stats?.college?.college_name || '-'}</p>
          <p className="text-sm text-gray-600">{stats?.college?.college_code || '-'}</p>
        </CardContent>
      </Card>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Total students</p><p className="text-2xl font-semibold">{stats?.stats?.total_students ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Free plan</p><p className="text-2xl font-semibold">{stats?.stats?.free_students ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Paid plan</p><p className="text-2xl font-semibold">{stats?.stats?.paid_students ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Campus interviews</p><p className="text-2xl font-semibold">{stats?.stats?.campus_interviews ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Campus attempts</p><p className="text-2xl font-semibold">{stats?.stats?.campus_attempts ?? 0}</p></CardContent></Card>
      </section>
      <Card>
        <CardHeader><CardTitle>Course-wise student registration</CardTitle></CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-gray-600">No course data found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b">Course</th>
                    <th className="text-left p-3 border-b">Code</th>
                    <th className="text-left p-3 border-b">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.course_id} className="border-b">
                      <td className="p-3">{course.course_name}</td>
                      <td className="p-3">{course.course_code || '-'}</td>
                      <td className="p-3">{course.student_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderHomeLoading = () => (
    <div className="space-y-6 animate-pulse">
      <Card>
        <CardContent className="pt-6">
          <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-7 w-64 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
        </CardContent>
      </Card>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Card key={idx}>
            <CardContent className="pt-6">
              <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
              <div className="h-8 w-12 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardHeader>
          <div className="h-6 w-72 bg-gray-200 rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-10 w-full bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderActivity = () => (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Student activity</CardTitle>
        <CardDescription>
          Cohort analytics by course, interview role, mode (AI vs structured), and type; or open a student for the full
          performance report and journey.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activityViewTab} onValueChange={(v) => setActivityViewTab(v as 'cohort' | 'individual')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="cohort" className="text-sm">
              Cohort analytics
            </TabsTrigger>
            <TabsTrigger value="individual" className="text-sm">
              Individual journey
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cohort" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Course</Label>
                <select
                  className="h-10 w-full border rounded-md px-3 text-sm bg-white"
                  value={activityCohortCourseId}
                  onChange={(e) => setActivityCohortCourseId(e.target.value)}
                  aria-label="Cohort course"
                >
                  <option value="">Select course</option>
                  {collegeCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_name}{course.course_code ? ` (${course.course_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Interview role</Label>
                <select
                  className="h-10 w-full border rounded-md px-3 text-sm bg-white disabled:opacity-60"
                  value={activityCohortTemplateId}
                  onChange={(e) => setActivityCohortTemplateId(e.target.value)}
                  disabled={!activityCohortCourseId || cohortRoleTemplates.length === 0}
                  aria-label="Interview role for cohort"
                >
                  {cohortRoleTemplates.length === 0 ? (
                    <option value="">
                      {templates.length === 0
                        ? 'No campus roles configured'
                        : 'No cohort-eligible variants — publish a variant or publish student applications'}
                    </option>
                  ) : (
                    cohortRoleTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Interview mode</Label>
                <select
                  className="h-10 w-full border rounded-md px-3 text-sm bg-white disabled:opacity-60"
                  value={activityCohortMode}
                  onChange={(e) => setActivityCohortMode(e.target.value as 'ai' | 'structured')}
                  disabled={!activityCohortTemplateId || cohortInterviewModeOptions.length === 0}
                  aria-label="Interview mode"
                >
                  {cohortInterviewModeOptions.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    cohortInterviewModeOptions.map((m) => (
                      <option key={m} value={m}>
                        {m === 'ai' ? 'AI' : 'Structured'}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Interview type</Label>
                <select
                  className="h-10 w-full border rounded-md px-3 text-sm bg-white disabled:opacity-60"
                  value={activityCohortType}
                  onChange={(e) =>
                    setActivityCohortType(
                      e.target.value as 'functional' | 'behavioral' | 'mixed' | 'technical',
                    )
                  }
                  disabled={!activityCohortMode || cohortInterviewTypeOptions.length === 0}
                  aria-label="Interview type"
                >
                  {cohortInterviewTypeOptions.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    cohortInterviewTypeOptions.map((ty) => (
                      <option key={ty} value={ty}>
                        {ty.charAt(0).toUpperCase() + ty.slice(1)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {!activityCohortCourseId && (
              <p className="text-sm text-slate-600">Select a <strong>course</strong> to configure cohort filters.</p>
            )}

            {activityCohortCourseId && templates.length === 0 && (
              <p className="text-sm text-amber-800">
                No campus interview roles yet. Add a role under <strong>Configure interview</strong>.
              </p>
            )}

            {activityCohortCourseId && templates.length > 0 && cohortRoleTemplates.length === 0 && (
              <p className="text-sm text-amber-800">
                Cohort analytics lists a role when at least one mode/type is <strong>published</strong> under{' '}
                <strong>Publish interviews</strong>, or when students have a <strong>published</strong> application that
                references that variant (draft variants still count in that case).
              </p>
            )}

            {activityCohortCourseId &&
              cohortRoleTemplates.length > 0 &&
              !cohortTemplateLinkedToSelectedCourse &&
              activityCohortTemplateId && (
                <p className="text-sm text-amber-800">
                  This role is not targeted to the selected course in <strong>Configure interview</strong>. Cohort data still
                  loads when students in this course have completed this campus interview (or applied via an invite).
                </p>
              )}

            {activityCohortCourseId &&
              cohortRoleTemplates.length > 0 &&
              !activityCohortReady &&
              activityCohortTemplateId &&
              (cohortInterviewModeOptions.length > 0 || cohortInterviewTypeOptions.length > 0) && (
                <p className="text-sm text-slate-600">
                  Pick <strong>interview mode</strong> and <strong>type</strong> to match what candidates were given (e.g.
                  Automation × AI × Functional).
                </p>
              )}

            {activityCohortCourseId &&
              cohortRoleTemplates.length > 0 &&
              activityCohortTemplateId &&
              cohortInterviewModeOptions.length === 0 && (
                <p className="text-sm text-amber-800">
                  No cohort-eligible mode/type for this role. Use <strong>Publish interviews</strong> or publish student
                  applications that reference a variant.
                </p>
              )}

            {activityCohortReady && (
              <TpoCohortActivityPanel
                loading={cohortLoading}
                error={cohortError}
                template={cohortTemplate}
                rows={cohortRows}
                cohortStats={cohortStats}
                selectedCandidateId={
                  activityIndividualStudentId !== 'all' ? activityIndividualStudentId : null
                }
              />
            )}
          </TabsContent>
          <TabsContent value="individual" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Course</Label>
                <select
                  className="h-10 w-full border rounded-md px-3 text-sm bg-white"
                  value={activityIndividualCourseId}
                  onChange={(e) => setActivityIndividualCourseId(e.target.value)}
                  aria-label="Course for student list"
                >
                  <option value="">Select course</option>
                  {collegeCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_name}{course.course_code ? ` (${course.course_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Student</Label>
                <select
                  className="h-10 w-full border rounded-md px-3 text-sm bg-white disabled:opacity-60"
                  value={activityIndividualStudentId}
                  onChange={(e) => setActivityIndividualStudentId(e.target.value)}
                  disabled={!activityIndividualCourseId}
                  aria-label="Select student"
                >
                  <option value="all">Select a student</option>
                  {activityIndividualStudents.map((s) => (
                    <option key={s.candidate_id} value={s.candidate_id}>
                      {s.candidate_name || s.candidate_email || s.candidate_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!activityIndividualCourseId && (
              <p className="text-sm text-slate-600">Select a <strong>course</strong> to load students.</p>
            )}

            {activityIndividualCourseId && activityIndividualStudentId === 'all' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
                Select a <strong>student</strong> to open the same <strong>Performance report</strong> view they see: chart
                with metric dropdown and interview cards with <strong>View results</strong>.
              </div>
            )}

            {activityIndividualCourseId && activityIndividualStudentId !== 'all' && (
              <StudentPerformanceReportView
                title={`Performance report — ${selectedStudentDisplayName}`}
                introText={
                  <>
                    Same experience as the candidate <strong>Performance report</strong>: one chart with a metric dropdown
                    (overall score and speech metrics), plus completed interviews with <strong>View results</strong> /{' '}
                    <strong>View report</strong> (opens in a new tab).
                  </>
                }
                interviewRows={tpoIndividualReportRows}
                progress={studentProgress}
                loadingList={studentLoading || studentProgressLoading}
                showTakeInterview={false}
                messageEmptyList="No interviews found for this student."
                messageAllCampusPending={
                  <>
                    This student has campus attempts that are not completed yet. Completed interviews will appear here
                    and in the charts, same as on the candidate side.
                  </>
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const renderAdminSettings = () => (
    <Card>
      <CardHeader><CardTitle>Admin settings</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 border-b">Name</th>
                <th className="text-left p-3 border-b">Email</th>
                <th className="text-left p-3 border-b">Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border-b">{tpoMe?.tpo_user?.full_name || '-'}</td>
                <td className="p-3 border-b">{tpoMe?.tpo_user?.email || '-'}</td>
                <td className="p-3 border-b">{tpoMe?.tpo_user?.role === 'tpo_admin' ? 'TPO Admin' : 'TPO Staff'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-slate-50 overflow-x-hidden">
        <TpoAppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          fullName={tpoMe?.tpo_user?.full_name}
        />
        <SidebarInset>
          <header className="bg-sky-700 border-b border-sky-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 min-h-[52px] sm:min-h-[58px]">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-hidden">
              <SidebarTrigger className="text-white flex-shrink-0 min-h-[44px] min-w-[44px] rounded-md touch-manipulation flex items-center justify-center" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="text-lg sm:text-xl font-semibold text-white truncate">ProValuate</h1>
                <p className="text-sm sm:text-base text-white/90 hidden sm:block truncate">
                  Smart TPO Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
              <span className="text-sm sm:text-base text-white truncate max-w-[90px] sm:max-w-[140px] md:max-w-[200px]" title={greeting}>
                {truncatedGreeting}
              </span>
              <Button
                variant="outline"
                onClick={signOut}
                className="text-sm sm:text-base px-3 sm:px-5 min-h-[42px] sm:min-h-[46px] flex-shrink-0 bg-white text-gray-900 border-white hover:bg-gray-100 hover:border-gray-200 rounded-md"
              >
                Logout
              </Button>
            </div>
          </header>

          <main className="flex-1 w-full min-w-0 flex flex-col min-h-0 overflow-x-hidden">
            <div className="flex-1 min-h-0 p-3 sm:p-6">
              {activeSection === 'home' && loading && renderHomeLoading()}
              {activeSection === 'home' && !loading && renderHome()}
              {activeSection === 'configure' && (
                <div className="w-full min-w-0 space-y-4 overflow-x-hidden">
                  <TpoJdInterviewConfig
                    tpoWorkflowStepIndex={0}
                    onTpoWorkflowStepClick={handleTpoWorkflowStep}
                  />
                </div>
              )}
              {activeSection === 'invite_students' && renderInviteStudents()}
              {activeSection === 'publish_interviews' && renderPublishInterviews()}
              {activeSection === 'activity' && renderActivity()}
              {activeSection === 'settings' && renderAdminSettings()}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default TpoDashboard;
