import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';
import { FileText, User, Briefcase, ExternalLink, ClipboardList, Loader2, Globe, Award, Lightbulb, BookOpen, Heart, Trophy, FolderGit2, Users, Building2, PenLine, BookMarked, Hash, X, Check, Settings, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import { ChartContainer } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import { INTERVIEW_WORKFLOW_STEPS } from '@/hooks/useWorkflowNavigation';

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
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-gradient-to-br from-sky-50 to-sky-100 overflow-x-hidden">
        <CandidateAppSidebar
              firstName={candidate?.first_name ?? undefined}
              lastName={candidate?.last_name ?? undefined}
            />
        <SidebarInset>
          <header className="bg-sky-700 border-b border-sky-800 px-2 sm:px-6 py-2 sm:py-4 flex items-center justify-between gap-2 min-h-[48px] sm:min-h-[52px]">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-hidden">
              <SidebarTrigger className="text-white flex-shrink-0 min-h-[44px] min-w-[44px] rounded-md touch-manipulation flex items-center justify-center" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="text-base sm:text-xl font-semibold text-white truncate">ProValuate</h1>
                <p className="text-xs sm:text-sm text-white/90 hidden sm:block truncate">Smart Candidate Evaluation Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0 min-w-0">
              <span className="text-xs text-white truncate max-w-[90px] sm:max-w-[140px] md:max-w-[200px]" title={greeting}>
                {truncatedGreeting}
              </span>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="text-xs sm:text-sm px-2.5 sm:px-4 min-h-[40px] sm:min-h-[44px] flex-shrink-0 bg-white text-gray-900 border-white hover:bg-gray-100 hover:border-gray-200 touch-manipulation rounded-md"
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
                <>
                  <div className="lg:hidden">
                    <CompactStepProgress
                      current={2}
                      total={INTERVIEW_WORKFLOW_STEPS.length}
                      steps={INTERVIEW_WORKFLOW_STEPS}
                      onStepClick={(index) => {
                        const routes = ['/candidate-dashboard/jds/configure', '/candidate-dashboard/jds/create', '/candidate-dashboard/interviews'];
                        if (index >= 0 && index < routes.length) navigate(routes[index]);
                      }}
                      allowClickAnyStep
                      theme="candidate"
                    />
                  </div>
                  <MyInterviewsSection candidateId={candidate?.candidate_id} candidateEmail={candidate?.email ?? undefined} />
                </>
              )}
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
type InterviewRow = { id: string; position: string | null; status: string | null; created_at: string; candidate_name?: string | null };
type SpeechMetrics = {
  overall_speech_quality?: number;
  speaking_pace_wpm?: number;
  filler_density?: number;
  pause_quality_score?: number;
  voice_confidence?: number;
  stress_score?: number;
  filler_words?: number;
};
type ProgressItem = {
  interview_id: string;
  position: string;
  completed_at: string | null;
  overall_score: number | null;
  parameter_scores: Record<string, number>;
  speech_metrics?: SpeechMetrics | null;
};
const CHART_OVERALL = 'overall';
type ChartMetricOption = typeof CHART_OVERALL | keyof SpeechMetrics;

function MyInterviewsSection({ candidateId, candidateEmail }: { candidateId: string | undefined; candidateEmail?: string }) {
  const [list, setList] = useState<InterviewRow[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<ChartMetricOption>(CHART_OVERALL);

  useEffect(() => {
    if (!candidateId && !candidateEmail) {
      setLoading(false);
      return;
    }
    (async () => {
      setError(null);
      const seen = new Set<string>();
      const merged: InterviewRow[] = [];
      const selectCols = 'id, position, status, created_at, candidate_name';
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
        for (const row of (data ?? []) as InterviewRow[]) {
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
          for (const row of (data ?? []) as InterviewRow[]) {
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
      .then((data: ProgressItem[]) => setProgress(Array.isArray(data) ? data : []))
      .catch(() => setProgress([]));
  }, [candidateId, candidateEmail]);

  const progressByInterviewId = progress.reduce<Record<string, ProgressItem>>((acc, p) => {
    acc[p.interview_id] = p;
    return acc;
  }, {});

  const chartData = progress
    .filter((p) => p.overall_score != null)
    .sort((a, b) => new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime())
    .map((p, idx) => ({
      name: p.position ? (p.position.length > 20 ? `Interview ${idx + 1}` : p.position) : `Interview ${idx + 1}`,
      score: p.overall_score ?? 0,
      fullLabel: p.position || `Interview ${idx + 1}`,
    }));
  const showChart = chartData.length >= 2;

  // Speech metrics progression: sorted by completed_at (chronological)
  const progressSortedByDate = [...progress].sort(
    (a, b) => new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime()
  );
  const speechMetricConfigs: { key: keyof SpeechMetrics; label: string; unit: string; color: string; domain: [number, number] }[] = [
    { key: 'overall_speech_quality', label: 'Overall speech quality', unit: '/100', color: 'hsl(199, 89%, 48%)', domain: [0, 100] },
    { key: 'speaking_pace_wpm', label: 'Pace (WPM)', unit: ' WPM', color: 'hsl(142, 71%, 45%)', domain: [0, 200] },
    { key: 'filler_density', label: 'Filler density', unit: '%', color: 'hsl(38, 92%, 50%)', domain: [0, 15] },
    { key: 'pause_quality_score', label: 'Pause & pacing', unit: '/100', color: 'hsl(262, 83%, 58%)', domain: [0, 100] },
    { key: 'voice_confidence', label: 'Voice confidence', unit: '/100', color: 'hsl(199, 89%, 48%)', domain: [0, 100] },
    { key: 'stress_score', label: 'Stress', unit: '/100', color: 'hsl(0, 84%, 60%)', domain: [0, 100] },
  ];
  const speechChartDataByMetric = speechMetricConfigs.map((config) => {
    const data = progressSortedByDate
      .map((p, idx) => ({
        name: p.position && p.position.length <= 20 ? p.position : `Int. ${idx + 1}`,
        value: p.speech_metrics?.[config.key] ?? null,
        fullLabel: p.position || `Interview ${idx + 1}`,
      }))
      .filter((d) => d.value != null) as { name: string; value: number; fullLabel: string }[];
    return { ...config, data };
  });
  const showSpeechCharts = speechChartDataByMetric.some((m) => m.data.length >= 2);
  const showAnyChart = showChart || showSpeechCharts;
  const chartDropdownOptions: { value: ChartMetricOption; label: string }[] = [
    ...(showChart ? [{ value: CHART_OVERALL as ChartMetricOption, label: 'Performance over time' }] : []),
    ...speechChartDataByMetric.filter((m) => m.data.length >= 2).map((m) => ({ value: m.key as ChartMetricOption, label: m.label })),
  ];
  const selectedMetricConfig = selectedChart === CHART_OVERALL ? null : speechChartDataByMetric.find((m) => m.key === selectedChart);
  const selectedMetricHasData = selectedChart === CHART_OVERALL ? showChart : (selectedMetricConfig?.data.length ?? 0) >= 2;

  useEffect(() => {
    const valid = chartDropdownOptions.some((opt) => opt.value === selectedChart);
    if (chartDropdownOptions.length > 0 && !valid) {
      setSelectedChart(chartDropdownOptions[0].value);
    }
  }, [chartDropdownOptions, selectedChart]);

  if (!candidateId && !candidateEmail) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My interviews</h1>
        <p className="text-gray-600">Sign in to see your interviews.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 pb-4 sm:pb-0">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">My interviews</h1>
      {loading && (
        <div className="flex items-center gap-2 text-gray-600 text-sm sm:text-base">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" /> Loading…
        </div>
      )}
      {error && <p className="text-red-600 text-sm sm:text-base mb-4">{error}</p>}
      {!loading && showAnyChart && chartDropdownOptions.length > 0 && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 mb-3 min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              {selectedChart === CHART_OVERALL ? 'Performance over time' : selectedMetricConfig?.label ?? 'Performance over time'}
            </h2>
            <Select value={selectedChart} onValueChange={(v) => setSelectedChart(v as ChartMetricOption)}>
              <SelectTrigger className="w-full min-h-[44px] touch-manipulation text-sm sm:text-base">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {chartDropdownOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 -mx-1 sm:mx-0">
          {selectedMetricHasData && selectedChart === CHART_OVERALL && (
            <ChartContainer config={{ score: { label: 'Overall score', color: 'hsl(199, 89%, 48%)' } }} className="h-[200px] sm:h-[260px] md:h-[280px] w-full min-w-0">
              <LineChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 6 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} width={24} />
                <Tooltip
                  formatter={(value: number) => [`${Number(value).toFixed(1)}/10`, 'Score']}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullLabel ?? '')}
                />
                <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 4 }} name="Overall score" />
              </LineChart>
            </ChartContainer>
          )}
          {selectedMetricHasData && selectedChart !== CHART_OVERALL && selectedMetricConfig && (
            <ChartContainer
              config={{ value: { label: selectedMetricConfig.label, color: selectedMetricConfig.color } }}
              className="h-[200px] sm:h-[260px] md:h-[280px] w-full min-w-0"
            >
              <LineChart data={selectedMetricConfig.data} margin={{ top: 6, right: 4, left: 0, bottom: 6 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={selectedMetricConfig.domain} tick={{ fontSize: 10 }} width={24} />
                <Tooltip
                  formatter={(value: number) => [String(Number(value).toFixed(1)) + selectedMetricConfig.unit, selectedMetricConfig.label]}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullLabel ?? '')}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name={selectedMetricConfig.label}
                />
              </LineChart>
            </ChartContainer>
          )}
          {!selectedMetricHasData && (
            <p className="text-sm text-gray-500 py-6 sm:py-8 text-center">Complete more interviews to see progress for this metric.</p>
          )}
          </div>
        </div>
      )}
      {!loading && list.length === 0 && !error && (
        <p className="text-gray-600">You have no interviews linked to your account yet. Open an interview link from your email to have it appear here.</p>
      )}
      {!loading && list.length > 0 && !showChart && chartData.length <= 1 && (
        <p className="text-sm text-gray-500 mb-4">Complete more interviews to see your progress over time.</p>
      )}
      {!loading && list.length > 0 && (
        <ul className="space-y-3 sm:space-y-4">
          {list.map((i) => {
            const prog = progressByInterviewId[i.id];
            const score = prog?.overall_score != null ? prog.overall_score : null;
            return (
              <li key={i.id} className="flex flex-col gap-3 p-4 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-base sm:text-lg">{i.position ?? 'Interview'}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {i.status ?? '—'} · {new Date(i.created_at).toLocaleDateString()}
                    {i.status === 'completed' && score != null && (
                      <span className="ml-2 font-semibold text-sky-600">{Number(score).toFixed(1)}/10</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  {i.status !== 'completed' && i.status !== 'terminated' && (
                    <Button asChild size="sm" variant="outline" className="min-h-[44px] touch-manipulation w-full text-sm sm:text-base">
                      <Link to={`/interview/${i.id}`} className="flex items-center justify-center gap-2">
                        <ClipboardList className="h-4 w-4 shrink-0" />
                        Take interview
                      </Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="min-h-[44px] touch-manipulation w-full text-sm sm:text-base">
                    <a href={`/final-results/${i.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      View report
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
            <p className="text-xs sm:text-sm text-gray-600">Set up assessment parameters and interview type for your roles</p>
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
    if (idx === null || idx === 'new' || idx < 0) {
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
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section)}
                className={`text-left p-4 sm:p-6 md:p-8 rounded-xl border bg-white transition shadow-sm hover:shadow-md hover:border-sky-200 flex flex-col gap-3 min-h-[120px] sm:min-h-[140px] touch-manipulation ${isCustom ? 'border-dashed border-2 border-gray-300' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-sky-100 text-sky-600 flex-shrink-0">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <span className="font-semibold text-gray-900 text-base sm:text-lg">{section.title}</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 leading-snug">{section.description}</p>
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
                            {list.map((item: Record<string, unknown> | GenericEntry, i: number) => (
                              <li key={i} className="flex gap-3 rounded border bg-gray-50 px-3 py-3 text-sm">
                                <div className="flex-1 min-w-0 space-y-1">
                                  {editingSection.id === 'education' && (
                                    <>
                                      {(item.degree || item.school) && <p className="font-medium text-gray-900">{[item.degree, item.school].filter(Boolean).join(' · ')}</p>}
                                      {(item.start_date || item.end_date) && <p className="text-gray-600">{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</p>}
                                      {item.location && <p className="text-gray-600">{String(item.location)}</p>}
                                      {item.description && <p className="text-gray-600 whitespace-pre-wrap">{String(item.description)}</p>}
                                    </>
                                  )}
                                  {editingSection.id === 'experience' && (
                                    <>
                                      {(item.job_title || item.employer) && <p className="font-medium text-gray-900">{[item.job_title, item.employer].filter(Boolean).join(' · ')}</p>}
                                      {(item.start_date || item.end_date) && <p className="text-gray-600">{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</p>}
                                      {item.location && <p className="text-gray-600">{String(item.location)}</p>}
                                      {item.description && <p className="text-gray-600 whitespace-pre-wrap">{String(item.description)}</p>}
                                    </>
                                  )}
                                  {editingSection.id === 'skills' && (
                                    <>
                                      {item.skill && <p className="font-medium text-gray-900">{String(item.skill)}</p>}
                                      {item.level && <p className="text-gray-600">Level: {String(item.level)}</p>}
                                      {item.information && <p className="text-gray-600 whitespace-pre-wrap">{String(item.information)}</p>}
                                    </>
                                  )}
                                  {!isStructured && (
                                    <>
                                      {(item.title || item.name) && <p className="font-medium text-gray-900">{String(item.title || item.name)}</p>}
                                      {item.description && <p className="text-gray-600 whitespace-pre-wrap">{String(item.description)}</p>}
                                    </>
                                  )}
                                </div>
                                <div className="flex shrink-0 gap-1 self-start">
                                  <Button variant="ghost" size="sm" onClick={() => openEntryAtIndex(editingSection, i)}>Edit</Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteStructuredEntry(editingSection.dataKey, i)}>Delete</Button>
                                </div>
                              </li>
                            ))}
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
