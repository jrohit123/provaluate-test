import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';
import { FileText, User, Briefcase, ExternalLink, ClipboardList, Loader2, Globe, Award, Lightbulb, BookOpen, Heart, Trophy, FolderGit2, Users, Building2, PenLine, BookMarked, Hash, X, Check, Settings, UserPlus, Trash2, Plus, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/utils/sessionManager';
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { CandidateAppSidebar } from '@/components/ai-interview/CandidateAppSidebar';
import { CandidateMainDashboard } from '@/components/ai-interview/CandidateMainDashboard';
import { ResumeBuilderPage } from '@/components/ai-interview/ResumeBuilderPage';
import CandidateJdInterviewConfig from '@/components/ai-interview/CandidateJdInterviewConfig';
import CandidateJdInterviewCreate from '@/components/ai-interview/CandidateJdInterviewCreate';
import { ReferralsSection } from '@/components/ai-interview/ReferralsSection';
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import {
  StudentPerformanceReportView,
  CANDIDATE_INTERVIEW_CARD_CLASS,
  type PerformanceInterviewRow,
  type ProgressItem,
} from '@/components/ai-interview/StudentPerformanceReportView';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import { INTERVIEW_WORKFLOW_STEPS } from '@/hooks/useWorkflowNavigation';
import { formatScoreTenPoint } from '@/lib/formatScoreTenPoint';

const CandidateDashboard = () => {
  const { user } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const candidate = isCandidate(user) ? user.candidate : null;
  const path = location.pathname;
  const isHome = path === '/candidate-dashboard' || path === '/candidate-dashboard/';
  const isProfile = path.startsWith('/candidate-dashboard/profile');
  const isJds = path.startsWith('/candidate-dashboard/jds');
  const isJdsConfigure = path.startsWith('/candidate-dashboard/jds/configure');
  const isJdsCreate = path.startsWith('/candidate-dashboard/jds/create');
  const isInterviews = path.startsWith('/candidate-dashboard/interviews');
  const isPerformanceReport = path.startsWith('/candidate-dashboard/performance-report');
  // Legacy routes kept for backwards links; they redirect into Interviews with tab preset.
  const isPersonalInterviewsLegacy = path.startsWith('/candidate-dashboard/personal-interviews');
  const isCampusInterviewsLegacy = path.startsWith('/candidate-dashboard/campus-interviews');
  const isReferrals = path.startsWith('/candidate-dashboard/referrals');
  const isResumeBuilder = path.startsWith('/candidate-dashboard/resume-builder');

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    SessionManager.clearSession();
    localStorage.removeItem('recruitai_auth');
    navigate('/candidate-login');
  }, [navigate]);

  const firstName = candidate?.first_name?.trim() || '';
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back';
  const truncatedGreeting = greeting.length > 30 ? `${greeting.substring(0, 27)}...` : greeting;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex w-full min-h-screen bg-gradient-to-br from-sky-50 to-sky-100 overflow-x-hidden">
        <CandidateAppSidebar
              candidateId={candidate?.candidate_id}
              firstName={candidate?.first_name ?? undefined}
              lastName={candidate?.last_name ?? undefined}
              avatarUrl={candidate?.avatar_url ?? undefined}
            />
        <SidebarInset>
          <header className="[background:linear-gradient(135deg,#1a9fd6,#2563eb)] border-b border-white/15 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 min-h-[52px] sm:min-h-[58px]">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-hidden">
              <SidebarTrigger className="text-white flex-shrink-0 min-h-[44px] min-w-[44px] rounded-md touch-manipulation flex items-center justify-center" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="text-lg sm:text-xl font-semibold text-white truncate">ProValuate</h1>
                <p className="text-sm sm:text-base text-white/90 hidden sm:block truncate">Smart Candidate Evaluation Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
              <span className="text-sm sm:text-base text-white truncate max-w-[90px] sm:max-w-[140px] md:max-w-[200px]" title={greeting}>
                {truncatedGreeting}
              </span>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="text-sm sm:text-base px-3 sm:px-5 min-h-[42px] sm:min-h-[46px] flex-shrink-0 bg-white text-gray-900 border-white hover:bg-gray-100 hover:border-gray-200 touch-manipulation rounded-md"
              >
                Logout
              </Button>
            </div>
          </header>

          <main className="flex-1 w-full min-w-0 flex flex-col min-h-0 overflow-x-hidden">
            <div className={isResumeBuilder ? 'flex-1 min-h-0' : 'flex-1 min-h-0 px-3 sm:px-6 py-4 sm:py-8'}>
              {isHome && (
                <CandidateMainDashboard
                  candidateId={candidate?.candidate_id}
                  candidateEmail={candidate?.email ?? undefined}
                  onNavigate={(path) => navigate(path)}
                />
              )}
              {isProfile && (
                <ProfileBuilderSection candidateId={candidate?.candidate_id} />
              )}
              {isJdsConfigure && (
                <CandidateJdInterviewConfig candidateId={candidate?.candidate_id ?? ''} />
              )}
              {isJdsCreate && (
                <CandidateJdInterviewCreate candidateId={candidate?.candidate_id ?? ''} />
              )}
              {isJds && !isJdsConfigure && !isJdsCreate && (
                <MyJdsSection candidateId={candidate?.candidate_id} />
              )}
              {isInterviews && (
                <InterviewsSection
                  candidateId={candidate?.candidate_id}
                  candidateEmail={candidate?.email ?? undefined}
                  candidateFirstName={candidate?.first_name ?? undefined}
                  candidateLastName={candidate?.last_name ?? undefined}
                />
              )}
              {isPerformanceReport && (
                <>
                  <div className="lg:hidden">
                    <CompactStepProgress
                      current={2}
                      total={INTERVIEW_WORKFLOW_STEPS.length}
                      steps={INTERVIEW_WORKFLOW_STEPS}
                      onStepClick={(index) => {
                        const routes = ['/candidate-dashboard/jds/configure', '/candidate-dashboard/jds/create', '/candidate-dashboard/performance-report'];
                        if (index >= 0 && index < routes.length) navigate(routes[index]);
                      }}
                      allowClickAnyStep
                      theme="candidate"
                    />
                  </div>
                  <MyInterviewsSection candidateId={candidate?.candidate_id} candidateEmail={candidate?.email ?? undefined} />
                </>
              )}
              {isPersonalInterviewsLegacy && (
                <InterviewsSection
                  candidateId={candidate?.candidate_id}
                  candidateEmail={candidate?.email ?? undefined}
                  candidateFirstName={candidate?.first_name ?? undefined}
                  candidateLastName={candidate?.last_name ?? undefined}
                  initialTab="personal"
                />
              )}
              {isCampusInterviewsLegacy && (
                <InterviewsSection
                  candidateId={candidate?.candidate_id}
                  candidateEmail={candidate?.email ?? undefined}
                  candidateFirstName={candidate?.first_name ?? undefined}
                  candidateLastName={candidate?.last_name ?? undefined}
                  initialTab="campus"
                />
              )}
              {isReferrals && <ReferralsSection />}
              {isResumeBuilder && (
                <ResumeBuilderPage candidateId={candidate?.candidate_id} />
              )}
            </div>
            {!isResumeBuilder && <footer className="flex-shrink-0 bg-white border-t border-sky-100 px-4 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm text-muted-foreground">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0 sm:space-x-2">
                <span>© ProValuate 2025</span>
                <span className="hidden sm:inline">|</span>
                <Link to="/privacy" className="text-sky-600 hover:text-sky-800 transition-colors whitespace-nowrap">Privacy Policy</Link>
                <span className="hidden sm:inline">|</span>
                <Link to="/terms" className="text-sky-600 hover:text-sky-800 transition-colors whitespace-nowrap">Terms</Link>
                <span className="hidden sm:inline">|</span>
                <a href="mailto:sales@aitamate.com?&subject=ProValuate&body=Hi,%0D%0A%0D%0AI'd like to know more about ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-800 transition-colors whitespace-nowrap">Contact</a>
                <span className="hidden sm:inline">|</span>
                <span className="whitespace-nowrap">Powered by <a href="https://aitamate.com" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-800">aitamate</a></span>
              </div>
            </footer>}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

// --- My Interviews (by candidate_id and by candidate_email when candidate_id null) ---
function MyInterviewsSection({ candidateId, candidateEmail }: { candidateId: string | undefined; candidateEmail?: string }) {
  const [list, setList] = useState<PerformanceInterviewRow[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId && !candidateEmail) {
      setLoading(false);
      return;
    }
    (async () => {
      setError(null);
      const seen = new Set<string>();
      const merged: PerformanceInterviewRow[] = [];
      const selectCols =
        'id, position, status, created_at, completed_at, overall_score, candidate_name, interview_source, campus_template_id';
      if (candidateId) {
        const { data, error: e } = await supabase
          .from('interviews')
          .select(selectCols)
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false });
        if (e) {
          setError(e.message);
          setList([]);
          setLoading(false);
          return;
        }
        for (const row of (data ?? []) as PerformanceInterviewRow[]) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
      }
      if (candidateEmail) {
        const { data, error: e } = await supabase
          .from('interviews')
          .select(selectCols)
          .is('candidate_id', null)
          .eq('candidate_email', candidateEmail)
          .order('created_at', { ascending: false });
        if (!e && data) {
          for (const row of (data ?? []) as PerformanceInterviewRow[]) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              merged.push(row);
            }
          }
        }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setList(merged);
      setLoading(false);
    })();
  }, [candidateId, candidateEmail]);

  useEffect(() => {
    if (!candidateId && !candidateEmail) return;
    const q = candidateId
      ? `candidate_id=${encodeURIComponent(candidateId)}`
      : `candidate_email=${encodeURIComponent(candidateEmail!)}`;
    fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_CANDIDATE_INTERVIEW_PROGRESS}?${q}`))
      .then((r) => (r.ok ? r.json() : []))
      .then((raw: unknown) => {
        const arr = Array.isArray(raw) ? raw : [];
        const normalized: ProgressItem[] = arr.map((item: Record<string, unknown>) => {
          const { parameter_scores: ps, competency_scores: cs, ...rest } = item as Record<string, unknown> & {
            parameter_scores?: Record<string, number>;
            competency_scores?: Record<string, number>;
          };
          return {
            ...rest,
            competency_scores: (typeof cs === 'object' && cs != null ? cs : ps) as Record<string, number>,
          } as ProgressItem;
        });
        setProgress(normalized);
      })
      .catch(() => setProgress([]));
  }, [candidateId, candidateEmail]);

  const completedInterviewRows = useMemo(
    () => list.filter((row) => row.status === 'completed'),
    [list]
  );

  if (!candidateId && !candidateEmail) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Performance report</h1>
        <p className="text-gray-600">Sign in to see your interviews.</p>
      </div>
    );
  }

  return (
    <StudentPerformanceReportView
      title="Performance report"
      introText={
        <>
          Charts and cards below use <strong>completed</strong> interviews only. To <strong>start or continue</strong> a
          personal interview you created, open <strong>Personal interviews</strong> in the sidebar (same idea as{' '}
          <strong>Campus interviews</strong> for TPO-published roles).
        </>
      }
      interviewRows={completedInterviewRows}
      progress={progress}
      loadingList={loading}
      error={error}
      showTakeInterview={false}
      messageEmptyList="No completed interviews yet. Finish a personal or campus interview, then view scores and progress here."
    />
  );
}

/** Non-campus rows (personal practice, recruiter, etc.) — same pattern as campus: take / continue / taken here; reports live under Performance report. */
function isNonCampusInterviewSource(source: string | null | undefined): boolean {
  return (source || '').toLowerCase() !== 'campus';
}

function PersonalInterviewsSection({
  candidateId,
  candidateEmail,
  embedded = false,
}: {
  candidateId: string | undefined;
  candidateEmail?: string;
  embedded?: boolean;
}) {
  const [list, setList] = useState<PerformanceInterviewRow[]>([]);
  const [displayScoreByInterviewId, setDisplayScoreByInterviewId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId && !candidateEmail) {
      setLoading(false);
      return;
    }
    (async () => {
      setError(null);
      const seen = new Set<string>();
      const merged: PerformanceInterviewRow[] = [];
      const selectCols =
        'id, position, status, created_at, completed_at, total_score, overall_score, candidate_name, interview_source, campus_template_id';
      if (candidateId) {
        const { data, error: e } = await supabase
          .from('interviews')
          .select(selectCols)
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false });
        if (e) {
          setError(e.message);
          setList([]);
          setLoading(false);
          return;
        }
        for (const row of (data ?? []) as PerformanceInterviewRow[]) {
          if (!seen.has(row.id) && isNonCampusInterviewSource(row.interview_source)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
      }
      if (candidateEmail) {
        const { data, error: e } = await supabase
          .from('interviews')
          .select(selectCols)
          .is('candidate_id', null)
          .eq('candidate_email', candidateEmail)
          .order('created_at', { ascending: false });
        if (!e && data) {
          for (const row of (data ?? []) as PerformanceInterviewRow[]) {
            if (!seen.has(row.id) && isNonCampusInterviewSource(row.interview_source)) {
              seen.add(row.id);
              merged.push(row);
            }
          }
        }
      }
      if (merged.length > 0) {
        try {
          const ids = merged.map((r) => r.id).filter(Boolean);
          const { data: psRows } = await supabase
            .from('interview_parameter_scores')
            .select('interview_id, parameter_scores')
            .in('interview_id', ids);
          const psByInterview = new Map<string, Record<string, unknown>>();
          for (const row of (psRows || []) as Array<{ interview_id?: string; parameter_scores?: Record<string, unknown> }>) {
            if (!row?.interview_id) continue;
            psByInterview.set(row.interview_id, row.parameter_scores || {});
          }
          const nextDisplay: Record<string, number> = {};
          for (const row of merged) {
            const ps = psByInterview.get(row.id) || {};
            let competencyCount = 0;
            for (const v of Object.values(ps)) {
              if (v && typeof v === 'object') {
                const vv = (v as Record<string, unknown>).final_score ?? (v as Record<string, unknown>).score;
                if (typeof vv === 'number' && Number.isFinite(vv)) competencyCount += 1;
              } else if (typeof v === 'number' && Number.isFinite(v)) {
                competencyCount += 1;
              }
            }
            const total = row.total_score;
            const overall = row.overall_score;
            const sc =
              competencyCount <= 1
                ? (total ?? overall ?? null)
                : (overall ?? total ?? null);
            if (typeof sc === 'number' && Number.isFinite(sc)) {
              nextDisplay[row.id] = sc;
            }
          }
          setDisplayScoreByInterviewId(nextDisplay);
        } catch {
          setDisplayScoreByInterviewId({});
        }
      } else {
        setDisplayScoreByInterviewId({});
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setList(merged);
      setLoading(false);
    })();
  }, [candidateId, candidateEmail]);

  if (!candidateId && !candidateEmail) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Personal interviews</h1>
        <p className="text-gray-600">Sign in to see interviews you have created.</p>
      </div>
    );
  }

  const compactBtn =
    'h-9 min-h-[44px] sm:min-h-9 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation w-auto max-w-full self-start inline-flex items-center justify-center';

  return (
    <div className={embedded ? 'w-full min-w-0' : 'w-full min-w-0 pb-4 sm:pb-0'}>
      {!embedded && (
        <>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Personal interviews</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            Interviews you create from <strong>Generate Interview</strong> show up here so you can start or continue them.
            Finished attempts and scores stay in <strong>Performance report</strong>.
          </p>
        </>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-gray-600 text-sm sm:text-base">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" /> Loading...
        </div>
      )}
      {error && <p className="text-red-600 text-sm sm:text-base mb-4">{error}</p>}
      {!loading && list.length === 0 && !error && (
        <p className="text-gray-600">No personal interviews yet. Use Generate Interview to create one.</p>
      )}
      {!loading && list.length > 0 && (
        <ul className="space-y-3 sm:space-y-4 w-full">
          {list.map((row) => {
            const completed = row.status === 'completed';
            const inProgress =
              !!row.status && row.status !== 'completed' && row.status !== 'terminated';
            const terminated = row.status === 'terminated';
            const displayScore = displayScoreByInterviewId[row.id] ?? row.overall_score ?? row.total_score ?? null;

            return (
              <li key={row.id} className={CANDIDATE_INTERVIEW_CARD_CLASS}>
                <div className="min-w-0 flex flex-col gap-3 sm:gap-4 items-start text-left">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900 text-base sm:text-lg leading-snug">{row.position ?? 'Interview'}</p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {row.status ?? '—'}
                      {row.status === 'completed' && displayScore != null && (
                        <span className="ml-2 font-semibold text-sky-600">{formatScoreTenPoint(Number(displayScore))}/10</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {completed && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled
                        className={`${compactBtn} shrink-0 cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 disabled:opacity-100 shadow-sm`}
                        aria-disabled="true"
                      >
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-emerald-700" aria-hidden />
                          Taken
                        </span>
                      </Button>
                    )}
                    {terminated && (
                      <Button asChild size="sm" variant="outline" className={compactBtn}>
                        <a
                          href={`/final-results/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                          View results
                        </a>
                      </Button>
                    )}
                    {!completed && !terminated && (
                      <Button asChild size="sm" variant="outline" className={compactBtn}>
                        <a
                          href={`/interview/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5"
                        >
                          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                          {inProgress ? 'Continue interview' : 'Start interview'}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function InterviewsSection({
  candidateId,
  candidateEmail,
  candidateFirstName,
  candidateLastName,
  initialTab = 'personal',
}: {
  candidateId: string | undefined;
  candidateEmail?: string;
  candidateFirstName?: string;
  candidateLastName?: string;
  initialTab?: 'personal' | 'campus';
}) {
  const [tab, setTab] = useState<'personal' | 'campus'>(initialTab);

  return (
    <div className="w-full min-w-0 pb-4 sm:pb-0">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Interviews</h1>

      {/* Glider / segmented control */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm mb-4">
        <button
          type="button"
          onClick={() => setTab('personal')}
          className={
            tab === 'personal'
              ? 'px-4 py-2 text-sm font-semibold rounded-md bg-sky-700 text-white'
              : 'px-4 py-2 text-sm font-semibold rounded-md text-gray-700 hover:bg-gray-50'
          }
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => setTab('campus')}
          className={
            tab === 'campus'
              ? 'px-4 py-2 text-sm font-semibold rounded-md bg-sky-700 text-white'
              : 'px-4 py-2 text-sm font-semibold rounded-md text-gray-700 hover:bg-gray-50'
          }
        >
          Campus
        </button>
      </div>

      {tab === 'personal' ? (
        <PersonalInterviewsSection candidateId={candidateId} candidateEmail={candidateEmail} embedded />
      ) : (
        <CampusInterviewsSection
          candidateId={candidateId}
          candidateEmail={candidateEmail}
          candidateFirstName={candidateFirstName}
          candidateLastName={candidateLastName}
          embedded
        />
      )}
    </div>
  );
}

type CampusTemplate = {
  id: string;
  template_id?: string;
  variant_id?: string;
  title: string;
  position?: string | null;
  extracted_jd_text?: string | null;
  status: 'draft' | 'published' | 'archived';
  opens_at?: string | null;
  closes_at?: string | null;
  max_attempts_per_candidate?: number | null;
  created_at: string;
  attempt_count: number;
  can_start: boolean;
  /** From linked custom_role_parameters (matches TPO Configure). */
  duration_minutes?: number;
  interview_type?: string;
  interview_mode?: 'ai' | 'structured';
  last_attempt?: {
    id: string;
    status: string;
    created_at: string;
    completed_at?: string | null;
    overall_score?: number | null;
  } | null;
};

function CampusInterviewsSection({
  candidateId,
  candidateEmail,
  candidateFirstName,
  candidateLastName,
  embedded = false,
}: {
  candidateId: string | undefined;
  candidateEmail?: string;
  candidateFirstName?: string;
  candidateLastName?: string;
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [jdModalTemplate, setJdModalTemplate] = useState<CampusTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CampusTemplate[]>([]);
  const isCampusLoading = loading;

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_CAMPUS_INTERVIEWS), {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Failed to load campus interviews');
      setTemplates(((data as { templates?: CampusTemplate[] }).templates || []) as CampusTemplate[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load campus interviews');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const startCampusInterview = async (tpl: CampusTemplate) => {
    if (!candidateId || !candidateEmail) {
      setError('Candidate profile is incomplete.');
      return;
    }
    setStartingTemplateId(tpl.id);
    setError(null);
    try {
      const candidateName = `${candidateFirstName || ''} ${candidateLastName || ''}`.trim() || candidateEmail.split('@')[0];
      const durationMinutes =
        typeof tpl.duration_minutes === 'number' && tpl.duration_minutes >= 5 && tpl.duration_minutes <= 120
          ? Math.round(tpl.duration_minutes)
          : 30;
      const interviewType =
        tpl.interview_type === 'functional' ||
        tpl.interview_type === 'behavioral' ||
        tpl.interview_type === 'mixed'
          ? tpl.interview_type
          : 'mixed';
      const interviewMode = tpl.interview_mode === 'structured' ? 'structured' : 'ai';
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const createRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CREATE_INTERVIEW), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          candidate_id: candidateId,
          position: tpl.position || tpl.title,
          duration_minutes: durationMinutes,
          interview_type: interviewType,
          interview_mode: interviewMode,
          custom_instructions: `Campus Interview: ${tpl.title}`,
          campus_template_id: tpl.template_id || tpl.id,
          interview_source: 'campus',
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error((createData as { error?: string })?.error || 'Could not create interview');
      const interviewId = (createData as { interview_id?: string }).interview_id;
      if (!interviewId) throw new Error('Interview ID missing from response');

      const interviewPath = `/interview/${interviewId}`;
      window.open(interviewPath, '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start campus interview');
    } finally {
      setStartingTemplateId(null);
    }
  };

  if (!candidateId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Campus interviews</h1>
        <p className="text-gray-600">Sign in to view assigned campus interviews.</p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'w-full min-w-0' : 'w-full min-w-0 pb-4 sm:pb-0'}>
      {!embedded && (
        <>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Campus interviews</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            Interviews published by your college TPO for your course will appear here.
          </p>
        </>
      )}
      {isCampusLoading && (
        <div className="flex items-center gap-2 text-gray-600 text-sm sm:text-base">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" /> Loading campus interviews...
        </div>
      )}
      {error && <p className="text-red-600 text-sm sm:text-base mb-4">{error}</p>}
      {!isCampusLoading && templates.length === 0 && !error && (
        <p className="text-gray-600">No campus interviews are available right now.</p>
      )}
      {!isCampusLoading && templates.length > 0 && (
        <ul className="space-y-3 sm:space-y-4 w-full">
          {templates.map((tpl) => (
            <li key={tpl.id} className={CANDIDATE_INTERVIEW_CARD_CLASS}>
              <div className="min-w-0 flex flex-col gap-4 sm:gap-5 items-start text-left">
                <p className="font-semibold text-gray-900 text-base sm:text-lg leading-snug">{tpl.title}</p>
                {tpl.extracted_jd_text && (
                  <button
                    type="button"
                    onClick={() => setJdModalTemplate(tpl)}
                    className="text-xs sm:text-sm text-sky-700 hover:text-sky-900 underline w-fit text-left"
                  >
                    View Job Description
                  </button>
                )}
                <div>
                  {(() => {
                    const la = tpl.last_attempt;
                    const completed = la?.status === 'completed';
                    const inProgress =
                      !!la?.status && la.status !== 'completed' && la.status !== 'terminated';
                    const compactBtn =
                      'h-9 min-h-[44px] sm:min-h-9 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation w-auto max-w-full self-start inline-flex items-center justify-center';
                    const takeDisabled = startingTemplateId === tpl.id;
                    let label = 'Take interview';
                    if (startingTemplateId === tpl.id) label = 'Starting...';
                    else if (inProgress) label = 'Continue interview';
                    else if (completed) label = 'Retake interview';
                    const openExisting = () => {
                      if (tpl.last_attempt?.id) {
                        window.open(`/interview/${tpl.last_attempt.id}`, '_blank', 'noopener,noreferrer');
                      }
                    };
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`${compactBtn}`}
                        disabled={takeDisabled}
                        onClick={() => (inProgress ? openExisting() : startCampusInterview(tpl))}
                      >
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                          {label}
                        </span>
                      </Button>
                    );
                  })()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!jdModalTemplate} onOpenChange={(open) => !open && setJdModalTemplate(null)}>
        <DialogContent className="max-w-3xl lg:max-w-4xl max-h-[85vh] gap-0 p-0 overflow-hidden sm:rounded-lg grid grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader className="px-7 pt-7 pb-3 pr-14">
            <DialogTitle className="text-left text-lg sm:text-xl">
              {jdModalTemplate ? `Job description — ${jdModalTemplate.title}` : 'Job description'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-7 pb-7 overflow-y-auto min-h-0 border-t border-border/60 pt-5">
            {jdModalTemplate?.extracted_jd_text ? (
              <p className="text-base sm:text-[1.05rem] text-gray-700 whitespace-pre-wrap leading-relaxed">{jdModalTemplate.extracted_jd_text}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- My JDs: two services only (Interview configuration & Interview creation) ---
function MyJdsSection({ candidateId }: { candidateId: string | undefined }) {
  if (!candidateId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My JDs</h1>
        <p className="text-gray-600">Sign in to manage your JDs.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">My JDs</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Link
          to="/candidate-dashboard/jds/configure"
          className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-sky-300 hover:shadow transition min-h-[44px] touch-manipulation"
        >
          <div className="p-2.5 sm:p-3 rounded-lg bg-sky-100 shrink-0">
            <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-sky-600" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Interview configuration</h2>
            <p className="text-xs sm:text-sm text-gray-600">Set up assessment competencies and interview type for your roles</p>
          </div>
        </Link>
        <Link
          to="/candidate-dashboard/jds/create"
          className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-sky-300 hover:shadow transition min-h-[44px] touch-manipulation"
        >
          <div className="p-2.5 sm:p-3 rounded-lg bg-sky-100 shrink-0">
            <UserPlus className="h-7 w-7 sm:h-8 sm:w-8 text-sky-600" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Interview creation</h2>
            <p className="text-xs sm:text-sm text-gray-600">Create interview links and send invites from your JDs</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

// --- Profile builder (candidate_profile_details.profile_data) ---
type ProfileData = Record<string, unknown>;

type PersonalEntry = {
  full_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  linkedin_url?: string;
  github_url?: string;
  website_url?: string;
  portfolio_url?: string;
  custom_links?: Array<{ label: string; url: string }>;
};

type EducationEntry = {
  institution?: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  gpa?: string;
  achievements?: string;
};

type ExperienceEntry = {
  job_title?: string;
  employer?: string;
  employment_type?: string;
  work_mode?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  bullets?: string[];
};

type SkillGroupEntry = { category?: string; items?: string[] };
type ProjectEntry = { name?: string; project_type?: string; tech_stack?: string; url?: string; repo_url?: string; bullets?: string[] };
type CertificationEntry = { name?: string; issuer?: string; issue_date?: string; expiry_date?: string; credential_id?: string; url?: string };
type LanguageEntry = { language?: string; proficiency?: string };
type AwardEntry = { title?: string; issuer?: string; year?: string; description?: string };
type ReferenceEntry = { name?: string; job_title?: string; company?: string; email?: string };
type PublicationEntry = { title?: string; year?: string; journal_or_conference?: string; url?: string };
type GenericEntry = { title?: string; description?: string };

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance', 'Apprenticeship'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const PROFICIENCY_LEVELS = ['Native', 'Fluent', 'Professional Working', 'Conversational', 'Basic'];

const STRUCTURED_SECTION_IDS = new Set([
  'education', 'experience', 'skills', 'projects', 'languages', 'certifications', 'awards', 'references', 'publications',
]);

type SectionDef = {
  id: string;
  dataKey: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isArray: boolean;
};

const PROFILE_SECTIONS: SectionDef[] = [
  { id: 'personal', dataKey: 'personal', title: 'Personal Information', description: 'Name, email, phone, location, headline and all links.', icon: User, isArray: false },
  { id: 'profile', dataKey: 'summary', title: 'Profile Summary', description: 'A concise 2–3 sentence summary of your experience and career goals.', icon: User, isArray: false },
  { id: 'experience', dataKey: 'experience', title: 'Work Experience', description: 'Roles, employers and bullet-point achievements for each position.', icon: Briefcase, isArray: true },
  { id: 'education', dataKey: 'education', title: 'Education', description: 'Degrees, institutions, GPA and academic honors or activities.', icon: BookOpen, isArray: true },
  { id: 'projects', dataKey: 'projects', title: 'Projects', description: 'Personal or open-source projects with tech stack, links and impact.', icon: FolderGit2, isArray: true },
  { id: 'skills', dataKey: 'skills', title: 'Technical Skills', description: 'Group your skills by category — Languages, Frameworks, Tools etc.', icon: Lightbulb, isArray: true },
  { id: 'certifications', dataKey: 'certifications', title: 'Certifications', description: 'Industry certs with issuer, issue/expiry dates and credential ID.', icon: Award, isArray: true },
  { id: 'languages', dataKey: 'languages', title: 'Languages', description: 'Languages you speak and your proficiency level for each.', icon: Globe, isArray: true },
  { id: 'awards', dataKey: 'awards', title: 'Awards & Honors', description: 'Prizes, recognitions and competitive achievements.', icon: Trophy, isArray: true },
  { id: 'publications', dataKey: 'publications', title: 'Publications', description: 'Research papers, journal articles or books you have authored.', icon: BookMarked, isArray: true },
  { id: 'references', dataKey: 'references', title: 'References', description: 'Professional references from managers or senior colleagues.', icon: Users, isArray: true },
  { id: 'organisations', dataKey: 'organisations', title: 'Organisations', description: 'Memberships, volunteering and leadership roles in organisations.', icon: Building2, isArray: true },
  { id: 'courses', dataKey: 'courses', title: 'Courses & Training', description: 'Online or classroom courses and professional training completed.', icon: BookOpen, isArray: true },
  { id: 'interests', dataKey: 'interests', title: 'Interests', description: 'Relevant personal interests that support your professional profile.', icon: Heart, isArray: true },
  { id: 'declaration', dataKey: 'declaration', title: 'Declaration', description: 'A personal declaration statement for the bottom of your resume.', icon: PenLine, isArray: false },
  { id: 'custom', dataKey: 'custom_sections', title: 'Custom Section', description: 'Add a custom section for anything that does not fit elsewhere.', icon: Hash, isArray: true },
];

function getEntrySummary(sectionId: string, item: unknown): { primary: string; secondary?: string } {
  const obj = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
  switch (sectionId) {
    case 'experience':
      return {
        primary: [obj.job_title, obj.employer].filter(Boolean).join(' @ ') || 'Untitled Role',
        secondary: [obj.employment_type, obj.start_date && obj.end_date ? `${obj.start_date} – ${obj.end_date}` : obj.start_date].filter(Boolean).join(' · ') || undefined,
      };
    case 'education':
      return { primary: [obj.degree, obj.institution].filter(Boolean).join(', ') || 'Untitled', secondary: obj.field_of_study as string | undefined };
    case 'skills':
      return {
        primary: (obj.category as string) || 'Skill Group',
        secondary: Array.isArray(obj.items) ? (obj.items as string[]).slice(0, 5).join(', ') + ((obj.items as string[]).length > 5 ? '…' : '') : undefined,
      };
    case 'projects':
      return { primary: (obj.name as string) || 'Untitled Project', secondary: (obj.tech_stack as string) || undefined };
    case 'certifications':
      return { primary: (obj.name as string) || 'Untitled', secondary: [obj.issuer, obj.issue_date].filter(Boolean).join(' · ') || undefined };
    case 'languages':
      return { primary: (obj.language as string) || 'Language', secondary: (obj.proficiency as string) || undefined };
    case 'awards':
      return { primary: (obj.title as string) || 'Untitled', secondary: [obj.issuer, obj.year].filter(Boolean).join(', ') || undefined };
    case 'publications':
      return { primary: (obj.title as string) || 'Untitled', secondary: (obj.journal_or_conference as string) || (obj.year as string) || undefined };
    case 'references':
      return { primary: (obj.name as string) || 'Untitled', secondary: [obj.job_title, obj.company].filter(Boolean).join(', ') || undefined };
    default: {
      const title = (obj.title as string) || (obj.name as string) || 'Entry';
      const desc = typeof obj.description === 'string' ? obj.description.substring(0, 60) : undefined;
      return { primary: title, secondary: desc };
    }
  }
}

function FF({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</Label>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

function ActionRow({ onSave, onDelete, saving, isNew }: { onSave: () => void; onDelete: () => void; saving: boolean; isNew: boolean }) {
  return (
    <div className="flex flex-col gap-2 pt-2 sm:flex-row">
      {!isNew && (
        <Button type="button" size="sm" variant="outline" className="h-9 w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 sm:w-auto sm:shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
        </Button>
      )}
      <Button className="flex-1 bg-sky-600 hover:bg-sky-700 text-white h-9 text-sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
        Save
      </Button>
    </div>
  );
}

function ProfileBuilderSection({ candidateId }: { candidateId: string | undefined }) {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<SectionDef | null>(null);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | 'new' | null>(null);
  const [summaryValue, setSummaryValue] = useState('');
  const [declarationValue, setDeclarationValue] = useState('');
  const [personalEntry, setPersonalEntry] = useState<PersonalEntry>({});
  const [educationEntry, setEducationEntry] = useState<EducationEntry>({});
  const [experienceEntry, setExperienceEntry] = useState<ExperienceEntry>({ bullets: [] });
  const [skillGroupEntry, setSkillGroupEntry] = useState<SkillGroupEntry>({ category: '', items: [] });
  const [projectEntry, setProjectEntry] = useState<ProjectEntry>({ bullets: [] });
  const [certificationEntry, setCertificationEntry] = useState<CertificationEntry>({});
  const [languageEntry, setLanguageEntry] = useState<LanguageEntry>({});
  const [awardEntry, setAwardEntry] = useState<AwardEntry>({});
  const [referenceEntry, setReferenceEntry] = useState<ReferenceEntry>({});
  const [publicationEntry, setPublicationEntry] = useState<PublicationEntry>({});
  const [genericEntry, setGenericEntry] = useState<GenericEntry>({ title: '', description: '' });

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: e } = await supabase
        .from('candidate_profile_details')
        .select('profile_data')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (!e && data) setProfileData((data.profile_data as ProfileData) ?? {});
      setLoading(false);
    })();
  }, [candidateId]);

  const persistProfile = useCallback(async (next: ProfileData): Promise<boolean> => {
    if (!candidateId) return false;
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .from('candidate_profile_details')
      .upsert({ candidate_id: candidateId, profile_data: next, updated_at: new Date().toISOString() }, { onConflict: 'candidate_id' });
    setSaving(false);
    if (e) {
      setError(e.message);
      return false;
    }
    return true;
  }, [candidateId]);

  const openSection = useCallback((section: SectionDef) => {
    setEditingEntryIndex(null);
    setError(null);
    const raw = profileData[section.dataKey];
    if (section.id === 'personal') setPersonalEntry((typeof raw === 'object' && raw !== null && !Array.isArray(raw)) ? raw as PersonalEntry : {});
    else if (section.id === 'profile') setSummaryValue(typeof raw === 'string' ? raw : '');
    else if (section.id === 'declaration') setDeclarationValue(typeof raw === 'string' ? raw : '');
    setEditingSection(section);
  }, [profileData]);

  const openEntryAtIndex = useCallback((section: SectionDef, index: number | 'new') => {
    setEditingSection(section);
    setEditingEntryIndex(index);
    setError(null);
    const list = Array.isArray(profileData[section.dataKey]) ? (profileData[section.dataKey] as unknown[]) : [];
    const item: unknown = index === 'new' ? {} : list[index];
    const obj = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
    switch (section.id) {
      case 'education':
        setEducationEntry(index === 'new' ? {} : obj as EducationEntry);
        break;
      case 'experience':
        setExperienceEntry(index === 'new' ? { bullets: [] } : { ...obj as ExperienceEntry, bullets: Array.isArray(obj.bullets) ? obj.bullets as string[] : [] });
        break;
      case 'skills':
        setSkillGroupEntry(index === 'new' ? { category: '', items: [] } : { category: obj.category as string ?? '', items: Array.isArray(obj.items) ? obj.items as string[] : [] });
        break;
      case 'projects':
        setProjectEntry(index === 'new' ? { bullets: [] } : { ...obj as ProjectEntry, bullets: Array.isArray(obj.bullets) ? obj.bullets as string[] : [] });
        break;
      case 'certifications':
        setCertificationEntry(index === 'new' ? {} : obj as CertificationEntry);
        break;
      case 'languages':
        setLanguageEntry(index === 'new' ? {} : obj as LanguageEntry);
        break;
      case 'awards':
        setAwardEntry(index === 'new' ? {} : obj as AwardEntry);
        break;
      case 'references':
        setReferenceEntry(index === 'new' ? {} : obj as ReferenceEntry);
        break;
      case 'publications':
        setPublicationEntry(index === 'new' ? {} : obj as PublicationEntry);
        break;
      default:
        setGenericEntry(index === 'new' ? { title: '', description: '' } : { title: String(obj.title ?? obj.name ?? ''), description: String(obj.description ?? '') });
    }
  }, [profileData]);

  const saveListEntry = useCallback(async (dataKey: string, entry: unknown) => {
    const list = Array.isArray(profileData[dataKey]) ? [...(profileData[dataKey] as unknown[])] : [];
    const idx = editingEntryIndex === 'new' ? list.length : editingEntryIndex as number;
    if (typeof idx === 'number' && idx >= 0 && idx < list.length) list[idx] = entry;
    else list.push(entry);
    const next = { ...profileData, [dataKey]: list };
    setProfileData(next);
    const ok = await persistProfile(next);
    if (ok) setEditingEntryIndex(null);
  }, [profileData, editingEntryIndex, persistProfile]);

  const deleteListEntry = useCallback(async (dataKey: string, idx: number) => {
    const list = Array.isArray(profileData[dataKey]) ? [...(profileData[dataKey] as unknown[])] : [];
    if (idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    const next = { ...profileData, [dataKey]: list };
    setProfileData(next);
    const ok = await persistProfile(next);
    if (ok) setEditingEntryIndex(null);
  }, [profileData, persistProfile]);

  const savePersonal = useCallback(async () => {
    const next = { ...profileData, personal: personalEntry };
    setProfileData(next);
    const ok = await persistProfile(next);
    if (ok) setEditingSection(null);
  }, [profileData, personalEntry, persistProfile]);

  const saveTextField = useCallback(async (dataKey: string, value: string) => {
    const next = { ...profileData, [dataKey]: value };
    setProfileData(next);
    const ok = await persistProfile(next);
    if (ok) setEditingSection(null);
  }, [profileData, persistProfile]);

  const isSectionFilled = (section: SectionDef): { filled: boolean; count?: number } => {
    const raw = profileData[section.dataKey];
    if (section.isArray) {
      const count = Array.isArray(raw) ? raw.length : 0;
      return { filled: count > 0, count };
    }
    if (typeof raw === 'string') return { filled: raw.trim().length > 0 };
    if (typeof raw === 'object' && raw !== null) return { filled: Object.keys(raw).length > 0 };
    return { filled: false };
  };

  const renderForm = () => {
    if (!editingSection) return null;
    if (!editingSection.isArray) {
      if (editingSection.id === 'personal') {
        const addLink = () => setPersonalEntry((p) => ({ ...p, custom_links: [...(p.custom_links ?? []), { label: '', url: '' }] }));
        const removeLink = (i: number) => setPersonalEntry((p) => ({ ...p, custom_links: (p.custom_links ?? []).filter((_, idx) => idx !== i) }));
        const updateLink = (i: number, f: 'label' | 'url', v: string) => setPersonalEntry((p) => {
          const links = [...(p.custom_links ?? [])];
          links[i] = { ...links[i], [f]: v };
          return { ...p, custom_links: links };
        });
        return (
          <>
            <DialogHeader className="pb-2"><DialogTitle>Personal Information</DialogTitle></DialogHeader>
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identity</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FF label="Full Name"><Input value={personalEntry.full_name ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, full_name: e.target.value }))} className="h-9" /></FF>
                  <FF label="Professional Headline"><Input value={personalEntry.headline ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, headline: e.target.value }))} className="h-9" /></FF>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Contact Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FF label="Email"><Input type="email" value={personalEntry.email ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, email: e.target.value }))} className="h-9" /></FF>
                  <FF label="Phone"><Input value={personalEntry.phone ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, phone: e.target.value }))} className="h-9" /></FF>
                  <FF label="City & Country"><Input value={personalEntry.location ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, location: e.target.value }))} className="h-9" /></FF>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Social & Profile Links</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FF label="LinkedIn"><Input value={personalEntry.linkedin_url ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, linkedin_url: e.target.value }))} className="h-9" /></FF>
                  <FF label="GitHub"><Input value={personalEntry.github_url ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, github_url: e.target.value }))} className="h-9" /></FF>
                  <FF label="Personal Website"><Input value={personalEntry.website_url ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, website_url: e.target.value }))} className="h-9" /></FF>
                  <FF label="Portfolio"><Input value={personalEntry.portfolio_url ?? ''} onChange={(e) => setPersonalEntry((p) => ({ ...p, portfolio_url: e.target.value }))} className="h-9" /></FF>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custom Links</div>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-sky-600 hover:text-sky-700 px-2" onClick={addLink}>
                    <Plus className="h-3 w-3 mr-1" /> Add Link
                  </Button>
                </div>
                <div className="space-y-2">
                  {(personalEntry.custom_links ?? []).map((link, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Label" value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} className="h-8 w-28 text-xs shrink-0" />
                      <Input placeholder="URL" value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} className="h-8 text-xs flex-1 min-w-0" />
                      <button type="button" className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-500 shrink-0 rounded hover:bg-red-50 transition-colors" onClick={() => removeLink(i)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white h-10 text-sm mt-2" onClick={savePersonal} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Save Personal Information
              </Button>
            </div>
          </>
        );
      }
      const isDeclaration = editingSection.id === 'declaration';
      const value = isDeclaration ? declarationValue : summaryValue;
      const setValue = isDeclaration ? setDeclarationValue : setSummaryValue;
      return (
        <>
          <DialogHeader className="pb-2"><DialogTitle>{editingSection.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="min-h-[160px] text-sm leading-relaxed" />
            <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white h-10 text-sm" onClick={() => saveTextField(editingSection.dataKey, value)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Save
            </Button>
          </div>
        </>
      );
    }

    const list = Array.isArray(profileData[editingSection.dataKey]) ? profileData[editingSection.dataKey] as unknown[] : [];
    if (editingEntryIndex === null) {
      return (
        <>
          <DialogHeader className="pb-2"><DialogTitle>{editingSection.title}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {list.length === 0 && <p className="text-sm text-slate-500 py-3 text-center">No entries yet. Add your first one below.</p>}
            {list.map((item, i) => {
              const { primary, secondary } = getEntrySummary(editingSection.id, item);
              return (
                <div key={i} className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{primary}</p>
                    {secondary && <p className="text-xs text-slate-500 truncate mt-0.5">{secondary}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500 hover:text-sky-600" onClick={() => openEntryAtIndex(editingSection, i)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500 hover:text-red-600" onClick={() => deleteListEntry(editingSection.dataKey, i)}>Delete</Button>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" className="w-full h-9 text-sm border-dashed border-sky-300 text-sky-600 hover:bg-sky-50 hover:border-sky-400" onClick={() => openEntryAtIndex(editingSection, 'new')}>
              <Plus className="h-4 w-4 mr-1.5" /> Add {editingSection.title}
            </Button>
          </div>
        </>
      );
    }

    const isNew = editingEntryIndex === 'new';
    const entryIdx = isNew ? -1 : editingEntryIndex as number;
    const handleDelete = () => { if (!isNew) void deleteListEntry(editingSection.dataKey, entryIdx); };
    const header = (
      <DialogHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700" onClick={() => setEditingEntryIndex(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>{isNew ? `Add ${editingSection.title}` : `Edit ${editingSection.title}`}</DialogTitle>
        </div>
      </DialogHeader>
    );
    if (editingSection.id === 'experience') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Job Title"><Input value={experienceEntry.job_title ?? ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, job_title: e.target.value }))} className="h-9" /></FF>
              <FF label="Employer / Company"><Input value={experienceEntry.employer ?? ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, employer: e.target.value }))} className="h-9" /></FF>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Employment Type">
                <Select value={experienceEntry.employment_type ?? ''} onValueChange={(v) => setExperienceEntry((p) => ({ ...p, employment_type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </FF>
              <FF label="Work Mode">
                <Select value={experienceEntry.work_mode ?? ''} onValueChange={(v) => setExperienceEntry((p) => ({ ...p, work_mode: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>{WORK_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </FF>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FF label="Start Date"><Input value={experienceEntry.start_date ?? ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, start_date: e.target.value }))} className="h-9" /></FF>
              <FF label="End Date"><Input value={experienceEntry.end_date ?? ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, end_date: e.target.value }))} className="h-9" /></FF>
              <FF label="Location"><Input value={experienceEntry.location ?? ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, location: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Key Responsibilities & Achievements">
              <Textarea value={(experienceEntry.bullets ?? []).join('\n')} onChange={(e) => setExperienceEntry((p) => ({ ...p, bullets: e.target.value.split('\n') }))} className="min-h-[130px] text-sm font-mono leading-relaxed" />
            </FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, { ...experienceEntry, bullets: (experienceEntry.bullets ?? []).filter(Boolean) })} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'education') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Degree / Qualification"><Input value={educationEntry.degree ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, degree: e.target.value }))} className="h-9" /></FF>
              <FF label="Field of Study"><Input value={educationEntry.field_of_study ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, field_of_study: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Institution / University"><Input value={educationEntry.institution ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, institution: e.target.value }))} className="h-9" /></FF>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FF label="Start Date"><Input value={educationEntry.start_date ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, start_date: e.target.value }))} className="h-9" /></FF>
              <FF label="End Date"><Input value={educationEntry.end_date ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, end_date: e.target.value }))} className="h-9" /></FF>
              <FF label="GPA / Score"><Input value={educationEntry.gpa ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, gpa: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="City, Country"><Input value={educationEntry.location ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, location: e.target.value }))} className="h-9" /></FF>
            <FF label="Achievements, Activities & Coursework"><Textarea value={educationEntry.achievements ?? ''} onChange={(e) => setEducationEntry((p) => ({ ...p, achievements: e.target.value }))} className="min-h-[80px] text-sm" /></FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, educationEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'skills') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <FF label="Category"><Input value={skillGroupEntry.category ?? ''} onChange={(e) => setSkillGroupEntry((p) => ({ ...p, category: e.target.value }))} className="h-9" /></FF>
            <FF label="Skills">
              <Textarea value={(skillGroupEntry.items ?? []).join(', ')} onChange={(e) => setSkillGroupEntry((p) => ({ ...p, items: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} className="min-h-[80px] text-sm" />
            </FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, skillGroupEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'projects') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Project Name"><Input value={projectEntry.name ?? ''} onChange={(e) => setProjectEntry((p) => ({ ...p, name: e.target.value }))} className="h-9" /></FF>
              <FF label="Type"><Input value={projectEntry.project_type ?? ''} onChange={(e) => setProjectEntry((p) => ({ ...p, project_type: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Tech Stack"><Input value={projectEntry.tech_stack ?? ''} onChange={(e) => setProjectEntry((p) => ({ ...p, tech_stack: e.target.value }))} className="h-9" /></FF>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Live URL"><Input value={projectEntry.url ?? ''} onChange={(e) => setProjectEntry((p) => ({ ...p, url: e.target.value }))} className="h-9" /></FF>
              <FF label="Repository URL"><Input value={projectEntry.repo_url ?? ''} onChange={(e) => setProjectEntry((p) => ({ ...p, repo_url: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Key Points / Bullets"><Textarea value={(projectEntry.bullets ?? []).join('\n')} onChange={(e) => setProjectEntry((p) => ({ ...p, bullets: e.target.value.split('\n') }))} className="min-h-[120px] text-sm font-mono leading-relaxed" /></FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, { ...projectEntry, bullets: (projectEntry.bullets ?? []).filter(Boolean) })} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'certifications') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <FF label="Certification Name"><Input value={certificationEntry.name ?? ''} onChange={(e) => setCertificationEntry((p) => ({ ...p, name: e.target.value }))} className="h-9" /></FF>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Issuing Organisation"><Input value={certificationEntry.issuer ?? ''} onChange={(e) => setCertificationEntry((p) => ({ ...p, issuer: e.target.value }))} className="h-9" /></FF>
              <FF label="Credential ID"><Input value={certificationEntry.credential_id ?? ''} onChange={(e) => setCertificationEntry((p) => ({ ...p, credential_id: e.target.value }))} className="h-9" /></FF>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FF label="Issue Date"><Input value={certificationEntry.issue_date ?? ''} onChange={(e) => setCertificationEntry((p) => ({ ...p, issue_date: e.target.value }))} className="h-9" /></FF>
              <FF label="Expiry Date"><Input value={certificationEntry.expiry_date ?? ''} onChange={(e) => setCertificationEntry((p) => ({ ...p, expiry_date: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Verification URL"><Input value={certificationEntry.url ?? ''} onChange={(e) => setCertificationEntry((p) => ({ ...p, url: e.target.value }))} className="h-9" /></FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, certificationEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'languages') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Language"><Input value={languageEntry.language ?? ''} onChange={(e) => setLanguageEntry((p) => ({ ...p, language: e.target.value }))} className="h-9" /></FF>
              <FF label="Proficiency Level">
                <Select value={languageEntry.proficiency ?? ''} onValueChange={(v) => setLanguageEntry((p) => ({ ...p, proficiency: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>{PROFICIENCY_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </FF>
            </div>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, languageEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'awards') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <FF label="Award / Honor Title"><Input value={awardEntry.title ?? ''} onChange={(e) => setAwardEntry((p) => ({ ...p, title: e.target.value }))} className="h-9" /></FF>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Issuer / Organisation"><Input value={awardEntry.issuer ?? ''} onChange={(e) => setAwardEntry((p) => ({ ...p, issuer: e.target.value }))} className="h-9" /></FF>
              <FF label="Year"><Input value={awardEntry.year ?? ''} onChange={(e) => setAwardEntry((p) => ({ ...p, year: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Description (optional)"><Textarea value={awardEntry.description ?? ''} onChange={(e) => setAwardEntry((p) => ({ ...p, description: e.target.value }))} className="min-h-[70px] text-sm" /></FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, awardEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'references') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <FF label="Full Name"><Input value={referenceEntry.name ?? ''} onChange={(e) => setReferenceEntry((p) => ({ ...p, name: e.target.value }))} className="h-9" /></FF>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Job Title"><Input value={referenceEntry.job_title ?? ''} onChange={(e) => setReferenceEntry((p) => ({ ...p, job_title: e.target.value }))} className="h-9" /></FF>
              <FF label="Company"><Input value={referenceEntry.company ?? ''} onChange={(e) => setReferenceEntry((p) => ({ ...p, company: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="Email"><Input type="email" value={referenceEntry.email ?? ''} onChange={(e) => setReferenceEntry((p) => ({ ...p, email: e.target.value }))} className="h-9" /></FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, referenceEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    if (editingSection.id === 'publications') {
      return (
        <>
          {header}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <FF label="Publication Title"><Input value={publicationEntry.title ?? ''} onChange={(e) => setPublicationEntry((p) => ({ ...p, title: e.target.value }))} className="h-9" /></FF>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FF label="Journal / Conference"><Input value={publicationEntry.journal_or_conference ?? ''} onChange={(e) => setPublicationEntry((p) => ({ ...p, journal_or_conference: e.target.value }))} className="h-9" /></FF>
              <FF label="Year"><Input value={publicationEntry.year ?? ''} onChange={(e) => setPublicationEntry((p) => ({ ...p, year: e.target.value }))} className="h-9" /></FF>
            </div>
            <FF label="URL / DOI (optional)"><Input value={publicationEntry.url ?? ''} onChange={(e) => setPublicationEntry((p) => ({ ...p, url: e.target.value }))} className="h-9" /></FF>
            <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, publicationEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
          </div>
        </>
      );
    }

    return (
      <>
        {header}
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <FF label="Title / Name"><Input value={genericEntry.title ?? ''} onChange={(e) => setGenericEntry((p) => ({ ...p, title: e.target.value }))} className="h-9" /></FF>
          <FF label="Description / Details"><Textarea value={genericEntry.description ?? ''} onChange={(e) => setGenericEntry((p) => ({ ...p, description: e.target.value }))} className="min-h-[80px] text-sm" /></FF>
          <ActionRow onSave={() => void saveListEntry(editingSection.dataKey, genericEntry)} onDelete={handleDelete} saving={saving} isNew={isNew} />
        </div>
      </>
    );
  };

  if (!candidateId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile builder</h1>
        <p className="text-gray-600">Sign in to edit your profile.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Add Content</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fill in each section — data appears live in your Resume Builder.</p>
        </div>
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => navigate('/candidate-dashboard')} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {loading && <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {PROFILE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const { filled, count } = isSectionFilled(section);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section)}
                className={`relative text-left p-4 sm:p-5 rounded-xl border bg-white transition shadow-sm hover:shadow-md flex flex-col gap-2.5 min-h-[120px] touch-manipulation ${section.id === 'custom' ? 'border-dashed border-2 border-gray-300' : 'border-gray-200 hover:border-sky-200'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0"><Icon className="h-5 w-5" /></div>
                  {filled && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">{count !== undefined ? `${count} ${count === 1 ? 'entry' : 'entries'}` : '✓ Filled'}</span>}
                </div>
                <span className="font-semibold text-gray-900 text-sm">{section.title}</span>
                <p className="text-xs text-gray-500 leading-snug">{section.description}</p>
                {filled && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-b-xl" />}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-red-600 mt-4 text-sm">{error}</p>}

      <Dialog open={!!editingSection} onOpenChange={(open) => { if (!open) { setEditingSection(null); setEditingEntryIndex(null); } }}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto gap-4">
          {renderForm()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CandidateDashboard;
