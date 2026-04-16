import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';
import { FileText, User, Briefcase, ExternalLink, ClipboardList, Loader2, Globe, Award, Lightbulb, BookOpen, Heart, Trophy, FolderGit2, Users, Building2, PenLine, BookMarked, Hash, X, Check, Settings, UserPlus, Trash2 } from 'lucide-react';
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
              firstName={candidate?.first_name ?? undefined}
              lastName={candidate?.last_name ?? undefined}
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
            <div className="flex-1 min-h-0 px-3 sm:px-6 py-4 sm:py-8">
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
            </div>
            <footer className="flex-shrink-0 bg-white border-t border-sky-100 px-4 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm text-muted-foreground">
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
            </footer>
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

type EducationEntry = { degree?: string; school?: string; school_url?: string; start_date?: string; end_date?: string; location?: string; description?: string };
type ExperienceEntry = { job_title?: string; employer?: string; employer_url?: string; start_date?: string; end_date?: string; location?: string; description?: string };
type SkillEntry = { skill?: string; information?: string; level?: string };
type GenericEntry = { title?: string; description?: string };

const STRUCTURED_SECTION_IDS = ['education', 'experience', 'skills'];

function normalizeListItems(list: unknown[]): GenericEntry[] {
  return list.map((item) => {
    if (item && typeof item === 'object' && 'title' in item) return item as GenericEntry;
    if (typeof item === 'string') return { title: item, description: '' };
    if (item && typeof item === 'object') return { title: String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).name ?? 'Entry'), description: String((item as Record<string, unknown>).description ?? '') };
    return { title: 'Entry', description: '' };
  });
}

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const PROFILE_SECTIONS: {
  id: string;
  dataKey: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isArray: boolean;
}[] = [
  { id: 'profile', dataKey: 'summary', title: 'Profile', description: 'Add a short summary of your key strengths, experience, and career goals.', icon: User, isArray: false },
  { id: 'education', dataKey: 'education', title: 'Education', description: 'Add your degrees and schools. Include your focus, honors, or exchange terms.', icon: BookOpen, isArray: true },
  { id: 'experience', dataKey: 'experience', title: 'Professional Experience', description: 'Add your professional roles and employer history including internships.', icon: Briefcase, isArray: true },
  { id: 'languages', dataKey: 'languages', title: 'Languages', description: 'Add your languages and proficiency level to show your communication range.', icon: Globe, isArray: true },
  { id: 'certificates', dataKey: 'certificates', title: 'Certificates', description: 'Add your industry certificates or licences. Include issuer and date earned.', icon: Award, isArray: true },
  { id: 'skills', dataKey: 'skills', title: 'Skills', description: 'Add your hard and soft skills that help you stand out from the crowd today.', icon: Lightbulb, isArray: true },
  { id: 'courses', dataKey: 'courses', title: 'Courses', description: 'Add online or in-person courses and trainings you joined and completed.', icon: BookOpen, isArray: true },
  { id: 'interests', dataKey: 'interests', title: 'Interests', description: 'Add relevant personal interests that support your career story and cultural fit.', icon: Heart, isArray: true },
  { id: 'awards', dataKey: 'awards', title: 'Awards', description: 'Add your awards and recognitions from industry, competitions, or academia.', icon: Trophy, isArray: true },
  { id: 'projects', dataKey: 'projects', title: 'Projects', description: 'Add key projects you participated in and highlight your challenges, role, and impact.', icon: FolderGit2, isArray: true },
  { id: 'references', dataKey: 'references', title: 'References', description: 'Add your references from managers or coworkers, including their contact details.', icon: Users, isArray: true },
  { id: 'organisations', dataKey: 'organisations', title: 'Organisations', description: 'Add your memberships or volunteering with organisations including your role.', icon: Building2, isArray: true },
  { id: 'declaration', dataKey: 'declaration', title: 'Declaration', description: 'Add your declaration by creating or uploading your personal signature.', icon: PenLine, isArray: false },
  { id: 'publications', dataKey: 'publications', title: 'Publications', description: 'Add publications, articles, or books you wrote or contributed to.', icon: BookMarked, isArray: true },
  { id: 'custom', dataKey: 'custom_sections', title: 'Custom', description: 'Add a custom section for anything else, or combine sections cleanly.', icon: Hash, isArray: true },
];

function ProfileBuilderSection({ candidateId }: { candidateId: string | undefined }) {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<typeof PROFILE_SECTIONS[0] | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | 'new' | null>(null);
  const [educationEntry, setEducationEntry] = useState<EducationEntry>({});
  const [experienceEntry, setExperienceEntry] = useState<ExperienceEntry>({});
  const [skillEntry, setSkillEntry] = useState<SkillEntry>({});
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

  const persistProfile = useCallback(async (next: ProfileData) => {
    if (!candidateId) return;
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .from('candidate_profile_details')
      .upsert({ candidate_id: candidateId, profile_data: next, updated_at: new Date().toISOString() }, { onConflict: 'candidate_id' });
    setSaving(false);
    if (e) setError(e.message);
    return e;
  }, [candidateId]);

  const saveSection = useCallback(async () => {
    if (!candidateId || !editingSection) return;
    setError(null);
    let value: unknown;
    if (editingSection.isArray) {
      try {
        value = editValue.trim() ? JSON.parse(editValue) : [];
      } catch {
        value = editValue.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(value)) value = [];
    } else {
      value = editValue.trim();
    }
    const next = { ...profileData, [editingSection.dataKey]: value };
    setProfileData(next);
    const err = await persistProfile(next);
    if (!err) setEditingSection(null);
  }, [candidateId, editingSection, editValue, profileData, persistProfile]);

  const saveStructuredEntry = useCallback(async (sectionId: string, dataKey: string, entry: EducationEntry | ExperienceEntry | SkillEntry | GenericEntry) => {
    const list = Array.isArray(profileData[dataKey]) ? [...(profileData[dataKey] as object[])] : [];
    const idx = editingEntryIndex === 'new' ? list.length : editingEntryIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < list.length) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    const next = { ...profileData, [dataKey]: list };
    setProfileData(next);
    const err = await persistProfile(next);
    if (!err) setEditingEntryIndex(null);
  }, [profileData, editingEntryIndex, persistProfile]);

  const deleteStructuredEntry = useCallback(async (dataKey: string, index?: number) => {
    const idx = index ?? (editingEntryIndex === 'new' ? -1 : editingEntryIndex);
    if (idx === null || idx < 0) {
      setEditingSection(null);
      setEditingEntryIndex(null);
      return;
    }
    const list = Array.isArray(profileData[dataKey]) ? [...(profileData[dataKey] as object[])] : [];
    if (idx >= list.length) return;
    list.splice(idx, 1);
    const next = { ...profileData, [dataKey]: list };
    setProfileData(next);
    const err = await persistProfile(next);
    if (!err) {
      setEditingSection(null);
      setEditingEntryIndex(null);
    }
  }, [profileData, editingEntryIndex, persistProfile]);

  const openSection = useCallback((section: typeof PROFILE_SECTIONS[0]) => {
    const raw = profileData[section.dataKey];
    setEditingEntryIndex(null);
    if (STRUCTURED_SECTION_IDS.includes(section.id)) {
      setEducationEntry({});
      setExperienceEntry({});
      setSkillEntry({});
    } else if (section.isArray) {
      setGenericEntry({ title: '', description: '' });
    } else {
      setEditValue(typeof raw === 'string' ? raw : raw != null ? String(raw) : '');
    }
    setEditingSection(section);
    setError(null);
  }, [profileData]);

  const openEntryAtIndex = useCallback((section: typeof PROFILE_SECTIONS[0], index: number) => {
    const raw = profileData[section.dataKey];
    const list = Array.isArray(raw) ? (raw as unknown[]) : [];
    const item = list[index];
    setEditingSection(section);
    setEditingEntryIndex(index);
    if (section.id === 'education') setEducationEntry((item || {}) as EducationEntry);
    else if (section.id === 'experience') setExperienceEntry((item || {}) as ExperienceEntry);
    else if (section.id === 'skills') setSkillEntry((item || {}) as SkillEntry);
    else setGenericEntry(normalizeListItems(list)[index] ?? { title: '', description: '' });
    setError(null);
  }, [profileData]);

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
      {/* Header: Add content + Close */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Add content</h1>
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] touch-manipulation" onClick={() => navigate('/candidate-dashboard')} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
          {PROFILE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isCustom = section.id === 'custom';
            const raw = profileData[section.dataKey];
            const isFilled = section.isArray
              ? Array.isArray(raw) && raw.length > 0
              : typeof raw === 'string' && raw.trim().length > 0;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section)}
                className={`relative text-left p-4 sm:p-6 md:p-8 rounded-xl border bg-white transition shadow-sm hover:shadow-md hover:border-sky-200 flex flex-col gap-3 min-h-[120px] sm:min-h-[140px] touch-manipulation overflow-hidden ${isCustom ? 'border-dashed border-2 border-gray-300' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-sky-100 text-sky-600 flex-shrink-0">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <span className="font-semibold text-gray-900 text-base sm:text-lg">{section.title}</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 leading-snug">{section.description}</p>
                {isFilled && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-700 rounded-b-xl" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-red-600 mt-4">{error}</p>}

      <Dialog open={!!editingSection} onOpenChange={(open) => !open && (setEditingSection(null), setEditingEntryIndex(null))}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {editingSection && editingSection.isArray ? (
            editingEntryIndex === null ? (
              <>
                <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                  <DialogTitle>{editingSection.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {(() => {
                    const rawList = Array.isArray(profileData[editingSection.dataKey]) ? (profileData[editingSection.dataKey] as unknown[]) : [];
                    const isStructured = STRUCTURED_SECTION_IDS.includes(editingSection.id);
                    const list = isStructured ? rawList : normalizeListItems(rawList);
                    return (
                      <>
                        {list.length > 0 ? (
                          <ul className="space-y-3">
                            {list.map((item: unknown, i: number) => {
                              const obj = (item && typeof item === 'object') ? (item as Record<string, unknown>) : {};
                              const educationItem = item as EducationEntry;
                              const experienceItem = item as ExperienceEntry;
                              const skillItem = item as SkillEntry;
                              const genericItem = item as GenericEntry & { name?: string };
                              return (
                                <li key={i} className="flex gap-3 rounded border bg-gray-50 px-3 py-3 text-sm">
                                  <div className="flex-1 min-w-0 space-y-1">
                                    {editingSection.id === 'education' && (
                                      <>
                                        {(educationItem.degree || educationItem.school) && <p className="font-medium text-gray-900">{[educationItem.degree, educationItem.school].filter(Boolean).join(' · ')}</p>}
                                        {(educationItem.start_date || educationItem.end_date) && <p className="text-gray-600">{[educationItem.start_date, educationItem.end_date].filter(Boolean).join(' – ')}</p>}
                                        {educationItem.location && <p className="text-gray-600">{String(educationItem.location)}</p>}
                                        {educationItem.description && <p className="text-gray-600 whitespace-pre-wrap">{String(educationItem.description)}</p>}
                                      </>
                                    )}
                                    {editingSection.id === 'experience' && (
                                      <>
                                        {(experienceItem.job_title || experienceItem.employer) && <p className="font-medium text-gray-900">{[experienceItem.job_title, experienceItem.employer].filter(Boolean).join(' · ')}</p>}
                                        {(experienceItem.start_date || experienceItem.end_date) && <p className="text-gray-600">{[experienceItem.start_date, experienceItem.end_date].filter(Boolean).join(' – ')}</p>}
                                        {experienceItem.location && <p className="text-gray-600">{String(experienceItem.location)}</p>}
                                        {experienceItem.description && <p className="text-gray-600 whitespace-pre-wrap">{String(experienceItem.description)}</p>}
                                      </>
                                    )}
                                    {editingSection.id === 'skills' && (
                                      <>
                                        {skillItem.skill && <p className="font-medium text-gray-900">{String(skillItem.skill)}</p>}
                                        {skillItem.level && <p className="text-gray-600">Level: {String(skillItem.level)}</p>}
                                        {skillItem.information && <p className="text-gray-600 whitespace-pre-wrap">{String(skillItem.information)}</p>}
                                      </>
                                    )}
                                    {!isStructured && (
                                      <>
                                        {(genericItem.title || genericItem.name) && <p className="font-medium text-gray-900">{String(genericItem.title || genericItem.name)}</p>}
                                        {(genericItem.description ?? obj.description) && <p className="text-gray-600 whitespace-pre-wrap">{String(genericItem.description ?? obj.description)}</p>}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 gap-1 self-start">
                                    <Button variant="ghost" size="sm" onClick={() => openEntryAtIndex(editingSection, i)}>Edit</Button>
                                    <Button variant="ghost" size="sm" onClick={() => deleteStructuredEntry(editingSection.dataKey, i)}>Delete</Button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 py-2">No entries yet.</p>
                        )}
                        <Button className="w-full" variant="outline" onClick={() => { setEditingEntryIndex('new'); setEducationEntry({}); setExperienceEntry({}); setSkillEntry({}); setGenericEntry({ title: '', description: '' }); }}>
                          Add entry
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <DialogTitle>{editingSection.title}</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={() => deleteStructuredEntry(editingSection.dataKey)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </DialogHeader>
                {editingSection.id === 'education' && (
                  <div className="space-y-3">
                    <div><Label>Degree</Label><Input placeholder="Enter Degree / Field Of Study" value={educationEntry.degree || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, degree: e.target.value }))} className="mt-1" /></div>
                    <div><Label>School</Label><Input placeholder="Enter school / university" value={educationEntry.school || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, school: e.target.value }))} className="mt-1" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div><Label>Start Date</Label><Input placeholder="MM/YYYY" value={educationEntry.start_date || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, start_date: e.target.value }))} className="mt-1 min-h-[44px]" /></div>
                      <div><Label>End Date</Label><Input placeholder="MM/YYYY" value={educationEntry.end_date || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, end_date: e.target.value }))} className="mt-1 min-h-[44px]" /></div>
                      <div><Label>Location</Label><Input placeholder="City, Country" value={educationEntry.location || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, location: e.target.value }))} className="mt-1 min-h-[44px]" /></div>
                    </div>
                    <div><Label>Description</Label><Textarea placeholder="Add a description of your education entry..." value={educationEntry.description || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, description: e.target.value }))} className="mt-1 min-h-[80px]" /></div>
                    <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white" onClick={() => saveStructuredEntry('education', 'education', educationEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
                {editingSection.id === 'experience' && (
                  <div className="space-y-3">
                    <div><Label>Job Title</Label><Input placeholder="Enter Job Title" value={experienceEntry.job_title || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, job_title: e.target.value }))} className="mt-1" /></div>
                    <div><Label>Employer</Label><Input placeholder="Enter employer" value={experienceEntry.employer || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, employer: e.target.value }))} className="mt-1" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div><Label>Start Date</Label><Input placeholder="MM/YYYY" value={experienceEntry.start_date || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, start_date: e.target.value }))} className="mt-1 min-h-[44px]" /></div>
                      <div><Label>End Date</Label><Input placeholder="MM/YYYY" value={experienceEntry.end_date || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, end_date: e.target.value }))} className="mt-1 min-h-[44px]" /></div>
                      <div><Label>Location</Label><Input placeholder="City, Country" value={experienceEntry.location || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, location: e.target.value }))} className="mt-1 min-h-[44px]" /></div>
                    </div>
                    <div><Label>Description</Label><Textarea placeholder="Describe your role & achievements" value={experienceEntry.description || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, description: e.target.value }))} className="mt-1 min-h-[80px]" /></div>
                    <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white" onClick={() => saveStructuredEntry('experience', 'experience', experienceEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
                {editingSection.id === 'skills' && (
                  <div className="space-y-3">
                    <div><Label>Skill</Label><Input placeholder="Enter Skill" value={skillEntry.skill || ''} onChange={(e) => setSkillEntry((p) => ({ ...p, skill: e.target.value }))} className="mt-1" /></div>
                    <div><Label>Information / Sub-skills</Label><Textarea placeholder="Enter information or sub-skills" value={skillEntry.information || ''} onChange={(e) => setSkillEntry((p) => ({ ...p, information: e.target.value }))} className="mt-1 min-h-[60px]" /></div>
                    <div><Label>Skill level</Label><Select value={skillEntry.level || ''} onValueChange={(v) => setSkillEntry((p) => ({ ...p, level: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Select skill level" /></SelectTrigger><SelectContent>{SKILL_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
                    <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white" onClick={() => saveStructuredEntry('skills', 'skills', skillEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
                {STRUCTURED_SECTION_IDS.includes(editingSection.id) === false && (
                  <div className="space-y-3">
                    <div><Label>Title / Name</Label><Input placeholder="Enter title or name" value={genericEntry.title || ''} onChange={(e) => setGenericEntry((p) => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
                    <div><Label>Description / Details</Label><Textarea placeholder="Add details (optional)" value={genericEntry.description || ''} onChange={(e) => setGenericEntry((p) => ({ ...p, description: e.target.value }))} className="mt-1 min-h-[80px]" /></div>
                    <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white" onClick={() => saveStructuredEntry(editingSection.id, editingSection.dataKey, genericEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
              </>
            )
          ) : editingSection ? (
            <>
              <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                <DialogTitle>{editingSection.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Label>{editingSection.isArray ? 'Content (JSON array or comma-separated)' : 'Content'}</Label>
                <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder={editingSection.isArray ? '[] or ["Item 1", "Item 2"]' : 'Enter text…'} />
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white" onClick={saveSection} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Done</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CandidateDashboard;
