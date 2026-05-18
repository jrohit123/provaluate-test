import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  TpoCohortActivityPanel,
  type CohortActivityRow,
  type CohortStats,
  type CohortTemplateInfo,
} from '@/components/tpo/TpoCohortActivityPanel';
import {
  TpoIndividualJourneyPanel,
  type TpoJourneyInterview,
} from '@/components/tpo/TpoIndividualJourneyPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Settings2, Activity, Shield, LogOut, Megaphone } from 'lucide-react';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

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

/** Campus variants usable in cohort filters: published variants only. */
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
  total_score?: number | null;
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

type TpoSection = 'home' | 'configure' | 'invite_students' | 'invite_review' | 'activity' | 'settings';

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
    'Sign in to your student portal, open Campus interviews, and click Take interview when you are ready.',
    '',
    'Warm regards,',
    'Training & Placement Cell',
  ].join('\n');
}

type TpoSidebarProps = {
  activeSection: TpoSection;
  onSectionChange: (section: TpoSection) => void;
  fullName?: string;
};

function TpoAppSidebar({ activeSection, onSectionChange, fullName }: TpoSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const menuBtnClass =
    'py-3.5 px-3 text-lg font-medium text-gray-700 hover:bg-blue-100 hover:text-blue-800 data-[active=true]:bg-blue-200 data-[active=true]:text-blue-900 [&>svg]:w-6 [&>svg]:h-6';

  const handleSectionNav = (section: TpoSection) => {
    onSectionChange(section);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="border-r border-blue-200 [background:linear-gradient(145deg,#EEF2FF_0%,#DCE7FF_42%,#BFD7FF_100%)]">
      <SidebarContent className="gap-0 pt-4 pb-4">
        <SidebarGroup className="px-3 pb-4">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-semibold text-3xl"
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

  // Add CSS for progress bar animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fillBar {
        from {
          width: 0%;
        }
        to {
          width: var(--bar-width);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<TpoSection>('home');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [tpoMe, setTpoMe] = useState<TpoMeResponse | null>(
    initialTpoUser ? { tpo_user: initialTpoUser } : null
  );
  const [collegeCourses, setCollegeCourses] = useState<CollegeCourseRow[]>([]);
  const [courseStudentCounts, setCourseStudentCounts] = useState<Record<string, number>>({});
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
  const [journeyRoleFocus, setJourneyRoleFocus] = useState<string | null>(null);
  const [studentInterviewCache, setStudentInterviewCache] = useState<Record<string, TpoStudentInterviewItem[]>>({});
  const jumpTargetCandidateRef = useRef<string | null>(null);
  const studentInterviewRequestSeq = useRef(0);
  const [publishTemplateId, setPublishTemplateId] = useState<string>('');
  const [publishInterviewMode, setPublishInterviewMode] = useState<'ai' | 'structured'>('ai');
  const [publishInterviewType, setPublishInterviewType] = useState<'functional' | 'behavioral' | 'mixed' | 'technical'>('mixed');
  const [inviteTitle, setInviteTitle] = useState<string>('');
  const [inviteMessage, setInviteMessage] = useState<string>('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteReviewStep, setInviteReviewStep] = useState(false);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [inviteMessageEdited, setInviteMessageEdited] = useState(false);
  const [publishSummaryLoading, setPublishSummaryLoading] = useState(false);
  const [publishSummaryError, setPublishSummaryError] = useState<string | null>(null);
  const [publishSummary, setPublishSummary] = useState<PublishCompetencySummary | null>(null);
  const [expandedSummaryKeys, setExpandedSummaryKeys] = useState<Record<string, boolean>>({});
  const [inviteSummaryDialogOpen, setInviteSummaryDialogOpen] = useState(false);
  const [manageRolesOpen, setManageRolesOpen] = useState(false);
  const [updatingVariantKey, setUpdatingVariantKey] = useState<string | null>(null);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addCourseName, setAddCourseName] = useState('');
  const [addCourseCode, setAddCourseCode] = useState('');
  const [addCourseDuration, setAddCourseDuration] = useState('4');
  const [addCourseMonth, setAddCourseMonth] = useState('7');
  const [addCourseDay, setAddCourseDay] = useState('1');
  const [addingCourse, setAddingCourse] = useState(false);

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

        // Use course breakdown from stats to get student counts
        if (statsJson.course_breakdown && statsJson.course_breakdown.length > 0) {
          const countsMap = statsJson.course_breakdown.reduce((acc, course) => {
            if (course.course_id) {
              acc[course.course_id] = course.student_count || 0;
            }
            return acc;
          }, {} as Record<string, number>);
          setCourseStudentCounts(countsMap);
        }
      } else {
        console.error('Failed to load college courses:', coursesJson.error);
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
    if (activeSection !== 'invite_students') return;
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
    window.location.href = `${import.meta.env.BASE_URL}tpo-login`;
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
  const animatedTotalStudents = useAnimatedNumber(loading ? 0 : (stats?.stats?.total_students ?? 0));
  const animatedFreeStudents = useAnimatedNumber(loading ? 0 : (stats?.stats?.free_students ?? 0));
  const animatedPaidStudents = useAnimatedNumber(loading ? 0 : (stats?.stats?.paid_students ?? 0));
  const animatedCampusInterviews = useAnimatedNumber(loading ? 0 : (stats?.stats?.campus_interviews ?? 0));
  const animatedCampusAttempts = useAnimatedNumber(loading ? 0 : (stats?.stats?.campus_attempts ?? 0));

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

  const setVariantStatus = async (
    templateId: string,
    variant: TemplateItem['variants'][number],
    nextStatus: 'draft' | 'published',
  ) => {
    const variantKey = `${templateId}:${variant.interview_mode}:${variant.interview_type}`;
    try {
      setUpdatingVariantKey(variantKey);
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_CAMPUS_INTERVIEWS}/${templateId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          interview_mode: variant.interview_mode,
          interview_type: variant.interview_type,
          status: nextStatus,
          custom_role_parameters_id: variant.custom_role_parameters_id || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not update role status');
      toast({
        title: 'Role status updated',
        description: `${variant.interview_mode.toUpperCase()} ${variant.interview_type} is now ${nextStatus}.`,
      });
      await loadData();
    } catch (e: unknown) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingVariantKey(null);
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
    const cached = studentInterviewCache[candidateId];
    if (cached) {
      setStudentInterviews(cached);
      setStudentLoading(false);
      return;
    }
    try {
      const requestSeq = ++studentInterviewRequestSeq.current;
      setStudentLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.TPO_STUDENTS}/${candidateId}/interviews?limit=200`), { headers });
      const data = (await res.json().catch(() => ({}))) as { interviews?: TpoStudentInterviewItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load student interviews');
      if (requestSeq !== studentInterviewRequestSeq.current) return;
      const interviews = data.interviews || [];
      setStudentInterviews(interviews);
      setStudentInterviewCache((prev) => ({ ...prev, [candidateId]: interviews }));
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
    let cancelled = false;
    (async () => {
      await loadActivityIndividualStudents(activityIndividualCourseId);
      if (cancelled) return;
      const jumpTargetCandidateId = jumpTargetCandidateRef.current;
      if (jumpTargetCandidateId) {
        setActivityIndividualStudentId(jumpTargetCandidateId);
        const cached = studentInterviewCache[jumpTargetCandidateId];
        if (cached) setStudentInterviews(cached);
        jumpTargetCandidateRef.current = null;
        return;
      }
      setActivityIndividualStudentId('all');
      setStudentInterviews([]);
      setJourneyRoleFocus(null);
    })();
    return () => {
      cancelled = true;
    };
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

  const tpoJourneyInterviews = useMemo((): TpoJourneyInterview[] => {
    return studentInterviews.map((i) => ({
      id: i.id,
      position: i.position ?? null,
      status: i.status ?? null,
      created_at: i.created_at,
      completed_at: i.completed_at ?? null,
      interview_source: i.interview_source ?? null,
      interview_mode: i.interview_mode ?? null,
      interview_type: i.interview_type ?? null,
      campus_template_title: i.campus_template_title ?? null,
      overall_score: i.overall_score ?? null,
      total_score: i.total_score ?? null,
      parameter_breakdown: (i.parameter_breakdown || []).map((p) => ({
        key: p.key,
        name: p.name,
        score: p.score ?? null,
      })),
      speech_metrics: i.speech_metrics ?? null,
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

  const handleOpenCandidateJourneyFromCohort = (candidateId: string) => {
    jumpTargetCandidateRef.current = candidateId;
    setActivityViewTab('individual');
    if (activityCohortCourseId && activityIndividualCourseId !== activityCohortCourseId) {
      setActivityIndividualCourseId(activityCohortCourseId);
    }
    setActivityIndividualStudentId(candidateId);
    const cached = studentInterviewCache[candidateId];
    if (cached) setStudentInterviews(cached);
    setJourneyRoleFocus(cohortTemplate?.title || cohortTemplate?.position || null);
  };

  const handleAddCourse = async () => {
    if (!addCourseName.trim() || !addCourseCode.trim()) {
      toast({ title: 'Missing fields', description: 'Course name and code are required.', variant: 'destructive' });
      return;
    }
    try {
      setAddingCourse(true);
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_COLLEGE_COURSES), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          course_name: addCourseName.trim(),
          course_code: addCourseCode.trim().toUpperCase(),
          duration_years: parseFloat(addCourseDuration),
          academic_start_month: parseInt(addCourseMonth),
          academic_start_day: parseInt(addCourseDay),
          is_active: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to add course');
      toast({ title: 'Course added', description: `"${addCourseName.trim()}" added successfully.` });
      setAddCourseOpen(false);
      setAddCourseName(''); setAddCourseCode(''); setAddCourseDuration('4');
      setAddCourseMonth('7'); setAddCourseDay('1');
      await loadData();
    } catch (e: unknown) {
      toast({ title: 'Failed to add course', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setAddingCourse(false);
    }
  };

  const renderInviteReview = () => (
    <div className="w-full min-w-0 space-y-6">
      <Card className="min-h-[600px]">
        <CardHeader className="pb-4 pt-6">
          <CardTitle className="text-xl">Review & Send</CardTitle>
          <CardDescription className="text-base">
            Confirm the details and customize your invitation message before sending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-6">
          {/* Summary Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-sky-50 p-4 text-center">
              <p className="text-2xl font-bold text-sky-800">
                {courseSelection[publishTemplateId]?.length || 0}
              </p>
              <p className="text-sm text-sky-700">Courses Selected</p>
            </div>
            <div className="rounded-lg border bg-sky-50 p-4 text-center">
              <p className="text-2xl font-bold text-sky-800">
                {templates.find(t => t.id === publishTemplateId)?.title || 'Selected Role'}
              </p>
              <p className="text-sm text-sky-700">Role</p>
            </div>
            <div className="rounded-lg border bg-sky-50 p-4 text-center">
              <p className="text-2xl font-bold text-sky-800">
                {publishInterviewMode === 'ai' ? 'AI Interview' : 'Structured Interview'}
              </p>
              <p className="text-sm text-sky-700">Mode</p>
            </div>
            <div className="rounded-lg border bg-sky-50 p-4 text-center">
              <p className="text-2xl font-bold text-sky-800 capitalize">
                {publishInterviewType}
              </p>
              <p className="text-sm text-sky-700">Type</p>
            </div>
          </div>

          {/* Selected Courses */}
          <div className="space-y-3">
            <p className="text-base font-medium text-gray-800">Selected Courses:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {collegeCourses
                .filter(course => courseSelection[publishTemplateId]?.includes(course.id))
                .map(course => (
                  <div key={course.id} className="flex items-center gap-2 text-base bg-gray-50 border rounded-md p-3">
                    <Checkbox
                      checked={true}
                      disabled
                      className="data-[state=checked]:bg-[#042C53] data-[state=checked]:border-[#042C53]"
                    />
                    <span>
                      {course.course_name}
                      {course.course_code ? <span className="text-gray-500"> ({course.course_code})</span> : null}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Message Customization */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-base font-medium">Invite title</Label>
              <input
                className="h-11 border rounded-md px-3 text-base w-full"
                placeholder="Invite title"
                value={inviteTitle}
                onChange={(e) => setInviteTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-base font-medium">Invitation message</Label>
              <Textarea
                className="min-h-[110px] text-base"
                placeholder="Type message shown to students"
                value={inviteMessage}
                onChange={(e) => {
                  setInviteMessage(e.target.value);
                  setInviteMessageEdited(true);
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveSection('invite_students')}
            >
              Back to Edit
            </Button>
            <Button
              className="[background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)] text-white"
              onClick={handleSendInvite}
              disabled={sendingInvite}
            >
              {sendingInvite ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

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
          No active programs found for your college. Add <strong>college_courses</strong> before sending invites.
        </p>
      ) : (
        <Fragment>
        <Card className="min-h-[600px]">
          <CardHeader className="pb-4 pt-6">
            <CardTitle className="text-xl">Invite students</CardTitle>
            <CardDescription className="text-base">
              Choose role, mode, and type. Send invites to selected courses and manage role visibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2 min-h-[400px] flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-base font-medium">Role</Label>
                <Select value={publishTemplateId} onValueChange={setPublishTemplateId}>
                  <SelectTrigger className="h-11 text-base">
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
                <Label className="text-base font-medium">Interview Mode</Label>
                <Select
                  value={publishInterviewMode}
                  onValueChange={(v: 'ai' | 'structured') => setPublishInterviewMode(v)}
                >
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI Interview (Dynamic)</SelectItem>
                    <SelectItem value="structured">Structured Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-base font-medium">Interview Type</Label>
                <Select
                  value={publishInterviewType}
                  onValueChange={(v: 'functional' | 'behavioral' | 'mixed' | 'technical') => setPublishInterviewType(v)}
                >
                  <SelectTrigger className="h-11 text-base">
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
                <p className="text-base font-medium text-gray-800">Programs (courses) to invite</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-sm"
                    onClick={() => selectAllCoursesForTemplate(selectedPublishTemplate.id, true)}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                    onClick={() => selectAllCoursesForTemplate(selectedPublishTemplate.id, false)}
                  >
                    Clear
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto border rounded-md p-3 bg-gray-50/80">
                  {collegeCourses.map((c) => {
                    const selected = new Set(courseSelection[selectedPublishTemplate.id] || []);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-base cursor-pointer">
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={() => toggleCourseForTemplate(selectedPublishTemplate.id, c.id)}
                          className="data-[state=checked]:bg-[#042C53] data-[state=checked]:border-[#042C53]"
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

            <div className="flex flex-wrap gap-2 justify-between mt-auto pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setManageRolesOpen(true)}
              >
                Manage roles
              </Button>
              <Button
                className="[background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)] text-white"
                onClick={() => setActiveSection('invite_review')}
                disabled={!publishTemplateId || !courseSelection[publishTemplateId]?.length}
              >
                Review & Send
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
                    ? cpEntries.reduce((sum, [, v]) => {
                        const minQ = Number(v?.min_questions ?? 1);
                        const maxQ = Number(v?.max_questions ?? 1);
                        const avgQ = (minQ + maxQ) / 2;
                        const perQuestionMinutes = Number(v?.max_time ?? 2) + 0.5;
                        return sum + (avgQ * perQuestionMinutes);
                      }, 4)
                    : sq.reduce((sum, q) => sum + Number(q?.timeLimit ?? 2), 4);
                  const totalWeight = isAI
                    ? cpEntries.reduce((sum, [, v]) => sum + Number(v?.weight ?? 0), 0)
                    : 100;
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border bg-sky-50 p-4 text-center">
                          <p className="text-2xl font-bold text-sky-800">{Math.round(totalQuestions)}</p>
                          <p className="text-sm text-sky-700">Total Questions</p>
                        </div>
                        <div className="rounded-lg border bg-sky-50 p-4 text-center">
                          <p className="text-2xl font-bold text-sky-800">{Math.round(totalDuration)} min</p>
                          <p className="text-sm text-sky-700">Duration</p>
                        </div>
                        <div className="rounded-lg border bg-sky-50 p-4 text-center">
                          <p className="text-2xl font-bold text-sky-800">{isAI ? cpEntries.length : sq.length}</p>
                          <p className="text-sm text-sky-700">{isAI ? 'Competencies' : 'Questions'}</p>
                        </div>
                        <div className="rounded-lg border bg-sky-50 p-4 text-center">
                          <p className="text-2xl font-bold text-sky-800">{Math.round(totalWeight)}%</p>
                          <p className="text-sm text-sky-700">Weightage</p>
                        </div>
                      </div>
                      {isAI ? (
                        <div className="space-y-3">
                          <p className="text-base font-medium text-gray-800">Competency Weightage Summary</p>
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
                              <div key={key} className="rounded-md border bg-white p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <p className="text-base text-gray-900">{value?.name || key}</p>
                                  <p className="text-base font-semibold text-gray-700">{weight}%</p>
                                </div>
                                <div className="w-full h-2 rounded bg-gray-200 overflow-hidden">
                                  <div className={`h-2 ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, weight))}%` }} />
                                </div>
                                <button
                                  type="button"
                                  className="mt-3 text-sm text-sky-700 hover:text-sky-800"
                                  onClick={() =>
                                    setExpandedSummaryKeys((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                >
                                  {isExpanded ? 'View Details less' : 'View Details more'} {'\u25bc'}
                                </button>
                                {isExpanded ? (
                                  <div className="mt-3 space-y-4 border-t pt-4">
                                    {descriptionPoints.length > 0 ? (
                                      <div>
                                        <p className="text-sm font-semibold text-gray-700 mb-2">Full Description:</p>
                                        <ul className="list-disc pl-4 space-y-2 text-sm text-gray-600">
                                          {descriptionPoints.map((point, pIdx) => (
                                            <li key={`${key}-desc-${pIdx}`}>{point}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    <div>
                                      <p className="text-sm font-semibold text-gray-700 mb-2">Competency Details:</p>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700">
                                        <div className="rounded border p-3">
                                          <p className="text-gray-500">Weight</p>
                                          <p className="font-semibold text-base">{weight}%</p>
                                        </div>
                                        <div className="rounded border p-3">
                                          <p className="text-gray-500">Min Questions</p>
                                          <p className="font-semibold text-base">{Number(value?.min_questions ?? 1)}</p>
                                        </div>
                                        <div className="rounded border p-3">
                                          <p className="text-gray-500">Max Questions</p>
                                          <p className="font-semibold text-base">{Number(value?.max_questions ?? 1)}</p>
                                        </div>
                                        <div className="rounded border p-3">
                                          <p className="text-gray-500">Time (minutes)</p>
                                          <p className="font-semibold text-base">{Number(value?.max_time ?? 2)}</p>
                                        </div>
                                      </div>
                                    </div>
                                    {scoring.length > 0 ? (
                                      <div>
                                        <p className="text-sm font-semibold text-gray-700 mb-2">Scoring Criteria:</p>
                                        <ul className="list-disc pl-4 space-y-2 text-sm text-gray-600">
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
        <Dialog open={manageRolesOpen} onOpenChange={setManageRolesOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage roles</DialogTitle>
              <DialogDescription>
                Set each interview configuration as published or draft. Draft roles stay hidden from candidates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-600">No configured roles found.</p>
              ) : (
                templates.map((tpl) => {
                  const roleName = tpl.title || tpl.position || 'Role';
                  const variants = tpl.variants || [];
                  return (
                    <div key={tpl.id} className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-semibold text-gray-900">{roleName}</p>
                      {variants.length === 0 ? (
                        <p className="text-xs text-gray-600">No mode/type variants configured yet.</p>
                      ) : (
                        variants.map((variant) => {
                          const variantKey = `${tpl.id}:${variant.interview_mode}:${variant.interview_type}`;
                          const busy = updatingVariantKey === variantKey;
                          const isPublished = variant.status === 'published';
                          return (
                            <div key={variantKey} className="flex items-center justify-between rounded border px-3 py-2">
                              <div>
                                <p className="text-sm text-gray-900">
                                  {variant.interview_mode.toUpperCase()} - {variant.interview_type}
                                </p>
                                <p className="text-xs text-gray-600">Current: {variant.status}</p>
                              </div>
                              <Button
                                size="sm"
                                variant={isPublished ? 'outline' : 'default'}
                                disabled={busy}
                                onClick={() => setVariantStatus(tpl.id, variant, isPublished ? 'draft' : 'published')}
                              >
                                {busy ? 'Updating...' : isPublished ? 'Set draft' : 'Set published'}
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
        </Fragment>
      )}

    </div>
  );

  const renderHome = () => (
    <div className="space-y-6">
      <div className="py-4">
          <p className="text-3xl font-bold text-gray-900">{stats?.college?.college_name ? `${stats.college.college_name} - Placement Cell` : '-'}</p>
        </div>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">Total students</div>
          <div className="text-[40px] font-bold text-gray-900 mb-2">{animatedTotalStudents}</div>
          <div className="text-sm text-gray-400">Across all courses</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">Free plan</div>
          <div className="text-[40px] font-bold text-gray-900 mb-2">{animatedFreeStudents}</div>
          <div className="text-sm text-gray-400">Basic access</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">Paid plan</div>
          <div className="text-[40px] font-bold text-gray-900 mb-2">{animatedPaidStudents}</div>
          <div className="text-sm text-gray-400">Premium access</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">Campus interviews</div>
          <div className="text-[40px] font-bold text-gray-900 mb-2">{animatedCampusInterviews}</div>
          <div className="text-sm text-gray-400">Total configured</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">Campus attempts</div>
          <div className="text-[40px] font-bold text-gray-900 mb-2">{animatedCampusAttempts}</div>
          <div className="text-sm text-gray-400">Total attempts</div>
        </div>
      </section>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Course-wise registration</h3>
          <Button
            className="[background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)] text-white"
            onClick={() => setAddCourseOpen(true)}
          >
            + Add new course
          </Button>
        </div>
        <div className="p-6">
          {courses.length === 0 ? (
            <p className="text-base text-gray-600">No course data found.</p>
          ) : (
            <div className="space-y-4">
              {courses.map((course, index) => {
                const maxStudents = Math.max(...courses.map(c => c.student_count || 0));
                const percentage = maxStudents > 0 ? ((course.student_count || 0) / maxStudents) * 100 : 0;
                return (
                  <div key={course.course_id} className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 w-[250px] flex-shrink-0">
                      {course.course_name}
                      {course.course_code && <span className="text-[#042C53] font-medium"> [{course.course_code}]</span>}
                    </span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-md overflow-hidden">
                      <div 
                        className="h-full rounded-md [background:linear-gradient(135deg,#020f1a,#042C53)]"
                        style={{ 
                          '--bar-width': `${percentage}%`,
                          width: '0%',
                          animation: 'fillBar 2s ease-out forwards',
                          animationDelay: `${index * 0.2}s`
                        } as React.CSSProperties}
                      ></div>
                    </div>
                    <span className="text-lg font-bold text-gray-900 w-[40px] text-right flex-shrink-0">{course.student_count || 0}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Dialog open={addCourseOpen} onOpenChange={setAddCourseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add new course</DialogTitle>
            <DialogDescription>
              This course will be linked to your college and appear in invite setup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Course name *</Label>
              <input className="h-10 border rounded-md px-3 text-sm w-full" placeholder="e.g. B.Tech Computer Science"
                value={addCourseName} onChange={e => setAddCourseName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Course code *</Label>
                <input className="h-10 border rounded-md px-3 text-sm w-full uppercase font-mono" placeholder="e.g. BTECH-CS"
                  value={addCourseCode} onChange={e => setAddCourseCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Duration (years)</Label>
                <Select value={addCourseDuration} onValueChange={setAddCourseDuration}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5','5.5','6'].map(v => (
                      <SelectItem key={v} value={v}>{v} yr{v !== '1' ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Academic start month</Label>
                <Select value={addCourseMonth} onValueChange={setAddCourseMonth}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Start day</Label>
                <input className="h-10 border rounded-md px-3 text-sm w-full" type="number"
                  min="1" max="31" value={addCourseDay} onChange={e => setAddCourseDay(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setAddCourseOpen(false)}>Cancel</Button>
            <Button
              className="[background:linear-gradient(135deg,#020f1a,#042C53)] text-white"
              onClick={handleAddCourse}
              disabled={addingCourse}
            >
              {addingCourse ? 'Saving…' : 'Save course'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
                Cohort analytics lists a role when at least one mode/type is set to <strong>published</strong> from{' '}
                <strong>Manage roles</strong>.
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
                  No cohort-eligible mode/type for this role. Use <strong>Manage roles</strong> and publish at least one
                  variant.
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
                onViewCandidate={handleOpenCandidateJourneyFromCohort}
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
              <TpoIndividualJourneyPanel
                studentName={selectedStudentDisplayName}
                interviews={tpoJourneyInterviews}
                focusCampusRole={journeyRoleFocus}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const renderAdminSettings = () => {
    // Use actual TPO user data from database
    const fullName = tpoMe?.tpo_user?.full_name || '';
    const email = tpoMe?.tpo_user?.email || '';
    const role = tpoMe?.tpo_user?.role || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join('') || '';

    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Profile & Settings</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Your account details and administrative preferences</p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
          {/* Profile Card */}
          <div className="bg-white border border-gray-200 rounded-[14px] shadow-sm">
            <div className="p-6">
              <h2 className="text-[18px] font-bold text-gray-900">Profile</h2>
              
              <div className="space-y-3 mt-6">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.06em]">First Name</div>
                  <div className="text-[17px] font-bold text-gray-900 mt-1">{firstName || '-'}</div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Last Name</div>
                  <div className="text-[17px] font-bold text-gray-900 mt-1">{lastName || '-'}</div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Email</div>
                  <div className="text-[17px] font-bold text-gray-900 mt-1 break-all">{email || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* College Details Card */}
          <div className="bg-white border border-gray-200 rounded-[14px] shadow-sm">
            <div className="p-6">
              <h2 className="text-[18px] font-bold text-gray-900">College Details</h2>
              
              <div className="space-y-3 mt-6">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.06em]">College Name</div>
                  <div className="text-[17px] font-bold text-gray-900 mt-1">{stats?.college?.college_name || '-'}</div>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.06em]">College Code</div>
                  <div className="text-[17px] font-bold text-gray-900 mt-1">{stats?.college?.college_code || '-'}</div>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Email Domain</div>
                  <div className="text-[17px] font-bold text-gray-900 mt-1 font-mono text-[15px]">
                    @{(tpoMe?.tpo_user as any)?.matched_tpo_domain || tpoMe?.tpo_user?.email?.split('@')[1] || 'inboxbear.com'}
                  </div>
                  {/* TODO: This should come from college_tpo_email_domains table based on college_id */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex w-full min-h-screen bg-[linear-gradient(145deg,#EEF2FF_0%,#DCE7FF_42%,#BFD7FF_100%)] overflow-x-hidden">
        <TpoAppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          fullName={tpoMe?.tpo_user?.full_name}
        />
        <SidebarInset>
          <header className="[background:linear-gradient(135deg,#020f1a,#042C53)] border-b border-sky-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 min-h-[52px] sm:min-h-[58px]">
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

          <main className="flex-1 w-full min-w-0 flex flex-col min-h-0 overflow-x-hidden bg-gradient-to-br from-sky-50 to-sky-100">
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
              {activeSection === 'invite_review' && renderInviteReview()}
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
