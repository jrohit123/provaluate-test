import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatScoreTenPoint } from '@/lib/formatScoreTenPoint';

export type CohortParameterScore = {
  key: string;
  name: string;
  score?: number | null;
};

export type CohortSpeechMetrics = {
  overall_speech_quality?: number;
  speaking_pace_wpm?: number;
  filler_score?: number;
  filler_rate_per_min?: number;
  pause_quality_score?: number;
  voice_confidence?: number;
};

export type CohortActivityRow = {
  candidate_id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  interview_id?: string | null;
  overall_score?: number | null;
  total_score?: number | null;
  completed_at?: string | null;
  position?: string | null;
  interview_mode?: string | null;
  interview_type?: string | null;
  parameter_breakdown: CohortParameterScore[];
  speech?: CohortSpeechMetrics | null;
};

export type CohortStats = {
  count: number;
  avg_overall?: number | null;
  competency_count?: number | null;
  avg_voice_confidence?: number | null;
  weakest_param_name?: string | null;
  weakest_param_avg?: number | null;
  /** Students with filler rate &gt; 7/min (when speech metrics present). */
  filler_high_count?: number | null;
  filler_rate_sample_count?: number | null;
  total_sessions?: number | null;
  unique_students?: number | null;
  attempt_distribution?: Array<{ attempts: number; students: number }> | null;
  retook_count?: number | null;
  improved_count?: number | null;
  declined_count?: number | null;
  interview_ready_count?: number | null;
  interview_ready_pct?: number | null;
  need_coaching_count?: number | null;
  need_coaching_pct?: number | null;
};

export type CohortTemplateInfo = {
  id: string;
  title?: string | null;
  position?: string | null;
};

type Props = {
  loading: boolean;
  error?: string | null;
  template: CohortTemplateInfo | null;
  rows: CohortActivityRow[];
  cohortStats: CohortStats | null;
  selectedCandidateId?: string | null;
  onViewCandidate?: (candidateId: string) => void;
};

const COMPACT_RESULTS_BTN =
  'h-9 min-h-[44px] sm:min-h-9 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation w-auto max-w-full self-start inline-flex items-center justify-center';

/** API / DB may send numerics as strings; cohort display must still pick total vs overall correctly. */
function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Distinct competencies (by key/name) with a numeric score — duplicate breakdown rows must not count as 2+. */
function competencyCountForBreakdown(pb: CohortParameterScore[] | undefined): number {
  const list = pb || [];
  const seen = new Set<string>();
  for (const p of list) {
    const sc = p.score;
    if (sc == null) continue;
    const v = toFiniteNumber(sc);
    if (v == null) continue;
    const id = String(p.key || p.name || '').trim();
    if (!id) continue;
    seen.add(id);
  }
  if (seen.size > 0) return seen.size;
  return list.length;
}

function competencyCountForRow(row: CohortActivityRow): number {
  return competencyCountForBreakdown(row.parameter_breakdown);
}

type AttemptScoreFields = {
  total_score?: unknown;
  overall_score?: unknown;
  parameter_breakdown?: CohortParameterScore[];
};

/**
 * Primary score per attempt for cohort: total_score when ≤1 competency, else overall_score
 * (same rule as candidate final-results / score_for_display).
 */
function displayScoreForAttemptFields(fields: AttemptScoreFields): number | null {
  const n = competencyCountForBreakdown(fields.parameter_breakdown);
  const total = toFiniteNumber(fields.total_score);
  const overall = toFiniteNumber(fields.overall_score);
  if (n <= 1) {
    if (total != null) return total;
    if (overall != null) return overall;
    return null;
  }
  if (overall != null) return overall;
  if (total != null) return total;
  return null;
}

function displayScoreForCohortRow(row: CohortActivityRow): number | null {
  return displayScoreForAttemptFields({
    total_score: row.total_score,
    overall_score: row.overall_score,
    parameter_breakdown: row.parameter_breakdown,
  });
}

/**
 * Batch / cohort-level stats (batch average, distribution, readiness fallbacks):
 * if this role has ≤1 competency use total_score per attempt, else overall_score.
 * Distinct from {@link displayScoreForCohortRow} which uses per-attempt breakdown count (ranking).
 */
function displayScoreForCohortStatContext(row: CohortActivityRow, cohortCompetencyCount: number): number | null {
  const total = toFiniteNumber(row.total_score);
  const overall = toFiniteNumber(row.overall_score);
  if (cohortCompetencyCount <= 1) {
    if (total != null) return total;
    if (overall != null) return overall;
    return null;
  }
  if (overall != null) return overall;
  if (total != null) return total;
  return null;
}

/** One mean stat-context score per candidate (mean across attempts), then used for batch avg / bands / readiness. */
function perStudentStatAverages(rows: CohortActivityRow[], cohortCompetencyCount: number): number[] {
  const by = new Map<string, CohortActivityRow[]>();
  for (const r of rows) {
    const cid = r.candidate_id;
    if (!cid) continue;
    if (!by.has(cid)) by.set(cid, []);
    by.get(cid)!.push(r);
  }
  const out: number[] = [];
  for (const rs of by.values()) {
    const ovs = rs
      .map((x) => displayScoreForCohortStatContext(x, cohortCompetencyCount))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (ovs.length > 0) out.push(ovs.reduce((a, b) => a + b, 0) / ovs.length);
  }
  return out;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number; payload?: { label: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const label = payload[0]?.payload?.label;
  if (value == null || !label) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs max-w-[240px]">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="text-slate-800 mt-1.5 tabular-nums">{value} student{value === 1 ? '' : 's'}</p>
    </div>
  );
}

export function TpoCohortActivityPanel({
  loading,
  error,
  template,
  rows,
  cohortStats,
  selectedCandidateId,
  onViewCandidate,
}: Props) {
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());
  const [competencyBarsReady, setCompetencyBarsReady] = useState(false);

  const paramKeys = useMemo(() => {
    const ordered: { key: string; shortLabel: string; fullLabel: string }[] = [];
    const seen = new Set<string>();
    const pushBreakdown = (breakdown: CohortParameterScore[]) => {
      for (const p of breakdown) {
        const k = p.key;
        if (!k || seen.has(k)) continue;
        seen.add(k);
        const raw = (p.name || k).trim() || k;
        ordered.push({
          key: k,
          shortLabel: raw.length > 26 ? `${raw.slice(0, 24)}…` : raw,
          fullLabel: raw,
        });
      }
    };
    for (const r of rows) pushBreakdown(r.parameter_breakdown || []);
    return ordered;
  }, [rows]);

  /** Cohort batch average for stat card: pooled attempt mean; total if <=1 competency else overall. */
  const pooledBatchAvg = useMemo(() => {
    const n = paramKeys.length;
    if (rows.length > 0) {
      const attemptScores = rows
        .map((r) => displayScoreForCohortStatContext(r, n))
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const m = mean(attemptScores);
      return m != null ? Number(m.toFixed(1)) : null;
    }
    if (cohortStats?.avg_overall != null) return Number(Number(cohortStats.avg_overall).toFixed(1));
    return null;
  }, [cohortStats?.avg_overall, rows, paramKeys.length]);

  const competencyAverages = useMemo(() => {
    const cohortComp = paramKeys.length;
    if (cohortComp === 0) return [];

    // Single-competency role: same pooled-attempt basis as batch average card.
    if (cohortComp <= 1) {
      const pk = paramKeys[0];
      const attemptScores = rows
        .map((r) => displayScoreForCohortStatContext(r, 1))
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const avg = attemptScores.length > 0
        ? Number((attemptScores.reduce((a, b) => a + b, 0) / attemptScores.length).toFixed(1))
        : null;
      return [
        {
          key: pk.key,
          label: pk.fullLabel,
          avg,
          band: avg == null ? ('none' as const) : avg >= 7 ? ('strong' as const) : avg >= 5 ? ('moderate' as const) : ('weak' as const),
        },
      ];
    }

    // Multi-competency: pooled attempt mean per parameter from breakdown.
    return paramKeys
      .map((pk) => {
        const attemptScores = rows
          .map((r) => (r.parameter_breakdown || []).find((p) => p.key === pk.key)?.score)
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        if (attemptScores.length === 0) {
          return {
            key: pk.key,
            label: pk.fullLabel,
            avg: null,
            band: 'none' as const,
          };
        }
        const avg = attemptScores.reduce((a, b) => a + b, 0) / attemptScores.length;
        return {
          key: pk.key,
          label: pk.fullLabel,
          avg: Number(avg.toFixed(1)),
          band: avg >= 7 ? ('strong' as const) : avg >= 5 ? ('moderate' as const) : ('weak' as const),
        };
      })
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [rows, paramKeys]);

  useEffect(() => {
    setCompetencyBarsReady(false);
    const rafId = window.requestAnimationFrame(() => setCompetencyBarsReady(true));
    return () => window.cancelAnimationFrame(rafId);
  }, [competencyAverages]);

  const distributionData = useMemo(() => {
    // Aligns with FinalResults-style labels: Excellent (≥8), Good (6–<8), Fair (4–<6), Needs Improvement (<4).
    const bands = [
      { key: 'needs_improvement', label: 'Needs Improvement (<4)', color: '#dc2626', min: -Infinity, max: 4 },
      { key: 'fair', label: 'Fair (4–<6)', color: '#eab308', min: 4, max: 6 },
      { key: 'good', label: 'Good (6–<8)', color: '#22c55e', min: 6, max: 8 },
      { key: 'excellent', label: 'Excellent (≥8)', color: '#15803d', min: 8, max: Infinity },
    ];
    const studentScores = perStudentStatAverages(rows, paramKeys.length);
    return bands.map((band) => ({
      ...band,
      count: studentScores.filter((score) => score >= band.min && score < band.max).length,
    }));
  }, [rows, paramKeys.length]);

  const summaryStats = useMemo(() => {
    const studentAvgs = perStudentStatAverages(rows, paramKeys.length);
    const scoredStudents = studentAvgs.length;
    const readyCountFallback = studentAvgs.filter((s) => s >= 7).length;
    const coachingCountFallback = studentAvgs.filter((s) => s < 5).length;
    const readyPctFallback = scoredStudents > 0 ? (readyCountFallback * 100) / scoredStudents : 0;
    const coachingPctFallback = scoredStudents > 0 ? (coachingCountFallback * 100) / scoredStudents : 0;
    const uniqueFromRows = new Set(rows.map((r) => r.candidate_id).filter(Boolean)).size;

    return {
      competencyCount: cohortStats?.competency_count ?? paramKeys.length,
      totalSessions: cohortStats?.total_sessions ?? rows.length,
      uniqueStudents: cohortStats?.unique_students ?? uniqueFromRows,
      attemptDistribution:
        (cohortStats?.attempt_distribution || [])
          .filter((b) => Number.isFinite(b?.attempts) && Number.isFinite(b?.students) && (b?.students ?? 0) > 0)
          .sort((a, b) => a.attempts - b.attempts),
      retookCount: cohortStats?.retook_count ?? 0,
      improvedCount: cohortStats?.improved_count ?? 0,
      declinedCount: cohortStats?.declined_count ?? 0,
      interviewReadyCount: cohortStats?.interview_ready_count ?? readyCountFallback,
      interviewReadyPct: cohortStats?.interview_ready_pct ?? readyPctFallback,
      needCoachingCount: cohortStats?.need_coaching_count ?? coachingCountFallback,
      needCoachingPct: cohortStats?.need_coaching_pct ?? coachingPctFallback,
    };
  }, [cohortStats, rows, paramKeys.length]);

  const communicationStats = useMemo(() => {
    const pickAttemptValues = (pick: (s: CohortSpeechMetrics) => number | null | undefined) =>
      rows
        .map((r) => (r.speech ? pick(r.speech) : undefined))
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    const qualityVals = pickAttemptValues((s) => s.overall_speech_quality);
    const paceVals = pickAttemptValues((s) => s.speaking_pace_wpm);
    const confidenceVals = pickAttemptValues((s) => s.voice_confidence);
    const fillerVals = pickAttemptValues((s) => s.filler_rate_per_min);
    const pauseVals = pickAttemptValues((s) => s.pause_quality_score);

    const avg = (arr: number[]) =>
      arr.length > 0 ? Number((arr.reduce((sum, n) => sum + n, 0) / arr.length).toFixed(1)) : null;

    return {
      avgSpeechQuality: avg(qualityVals),
      avgSpeakingPace: avg(paceVals),
      avgVoiceConfidence: avg(confidenceVals),
      highFillerCount: fillerVals.filter((v) => v > 4).length,
      goodPauseCount: pauseVals.filter((v) => v >= 80).length,
    };
  }, [rows]);

  const rankingRows = useMemo(() => {
    const byCandidate = new Map<
      string,
      {
        candidate_id: string;
        candidate_name: string;
        candidate_email?: string | null;
        attempts: number;
        avg_overall: number | null;
        latest_completed_at?: string | null;
        latest_interview_id?: string | null;
        trend: 'up' | 'down' | 'flat' | null;
        attempt_details: Array<{
          interview_id?: string | null;
          completed_at?: string | null;
          overall_score?: number | null;
          total_score?: number | null;
          parameter_breakdown: CohortParameterScore[];
        }>;
      }
    >();

    const groupedScores = new Map<string, number[]>();
    const groupedAttempts = new Map<string, CohortActivityRow[]>();
    for (const row of rows) {
      const cid = row.candidate_id;
      if (!cid) continue;
      if (!groupedAttempts.has(cid)) groupedAttempts.set(cid, []);
      groupedAttempts.get(cid)!.push(row);
      const ds = displayScoreForCohortRow(row);
      if (ds != null) {
        if (!groupedScores.has(cid)) groupedScores.set(cid, []);
        groupedScores.get(cid)!.push(ds);
      }
    }

    for (const [cid, attempts] of groupedAttempts.entries()) {
      const sorted = [...attempts].sort((a, b) => {
        const ad = a.completed_at || '';
        const bd = b.completed_at || '';
        return ad.localeCompare(bd);
      });
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      const scores = groupedScores.get(cid) || [];
      const avgOverall = scores.length > 0 ? Number((scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(2)) : null;

      let trend: 'up' | 'down' | 'flat' | null = null;
      const firstScore = first ? displayScoreForCohortRow(first) : null;
      const lastScore = latest ? displayScoreForCohortRow(latest) : null;
      if (firstScore != null && lastScore != null && sorted.length > 1) {
        trend = lastScore > firstScore ? 'up' : lastScore < firstScore ? 'down' : 'flat';
      }

      byCandidate.set(cid, {
        candidate_id: cid,
        candidate_name: latest?.candidate_name || first?.candidate_name || 'Candidate',
        candidate_email: latest?.candidate_email || first?.candidate_email || null,
        attempts: sorted.length,
        avg_overall: avgOverall,
        latest_completed_at: latest?.completed_at,
        latest_interview_id: latest?.interview_id || null,
        trend,
        attempt_details: sorted.map((a) => ({
          interview_id: a.interview_id,
          completed_at: a.completed_at,
          overall_score: a.overall_score,
          total_score: a.total_score,
          parameter_breakdown: a.parameter_breakdown || [],
        })),
      });
    }

    return Array.from(byCandidate.values()).sort((a, b) => {
      const av = a.avg_overall ?? -1;
      const bv = b.avg_overall ?? -1;
      if (bv !== av) return bv - av;
      return a.candidate_name.localeCompare(b.candidate_name);
    });
  }, [rows]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 animate-pulse space-y-4">
        <div className="h-5 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg" />
          ))}
        </div>
        <div className="h-40 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!template || rows.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-950">
        No <strong>completed</strong> campus interviews for this role in the selected course yet. After students
        finish, competency analytics and interview results will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Attempt breakdown</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
          {summaryStats.attemptDistribution.length > 0 ? (
            summaryStats.attemptDistribution.map((bucket, idx) => {
              const badgeClass =
                idx % 3 === 0
                  ? 'bg-blue-100 text-blue-700'
                  : idx % 3 === 1
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-fuchsia-100 text-fuchsia-700';
              const attempts = bucket.attempts;
              const attemptsText =
                attempts === 1 ? 'once' : attempts === 2 ? 'twice' : `${attempts} times`;
              return (
                <div key={`attempt-bucket-${attempts}`} className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}>
                    ×{attempts}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{bucket.students}</span>
                  <span className="text-xs text-slate-600">students took it {attemptsText}</span>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-slate-600">No attempt data available</span>
          )}
          <div className="w-full sm:ml-auto sm:w-auto sm:pl-4 sm:border-l sm:border-slate-200 text-xs text-slate-600">
            <strong className="text-base text-violet-700">{summaryStats.totalSessions}</strong> total sessions &nbsp;&middot;&nbsp;{' '}
            <strong className="text-base text-slate-900">{summaryStats.uniqueStudents}</strong> unique students
            <br />
            <span className="text-[11px] text-slate-500">
              Most batch KPIs count each student once (mean of attempts). Batch average card uses pooled attempts; total vs overall still uses role competency count.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Batch average</p>
          <p className="text-2xl font-semibold text-indigo-700 mt-1">
            {pooledBatchAvg != null ? formatScoreTenPoint(pooledBatchAvg) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">across {summaryStats.competencyCount} competencies</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            {paramKeys.length <= 1
              ? 'Based on total score per attempt (single-competency role).'
              : 'Based on overall score per attempt (multi-competency role).'}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Interview-ready</p>
          <p className="text-2xl font-semibold text-emerald-700 mt-1">{summaryStats.interviewReadyCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            <strong>{Math.round(summaryStats.interviewReadyPct)}%</strong> of students &middot; scored 7+
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Need coaching</p>
          <p className="text-2xl font-semibold text-amber-700 mt-1">{summaryStats.needCoachingCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            <strong>{Math.round(summaryStats.needCoachingPct)}%</strong> of students &middot; scored &lt;5
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Retook the interview</p>
          <p className="text-2xl font-semibold text-violet-700 mt-1">{summaryStats.retookCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            <strong>{summaryStats.improvedCount}</strong> improved &middot; <strong>{summaryStats.declinedCount}</strong> declined
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 min-w-0 w-full">
          <p className="text-sm sm:text-base font-semibold uppercase tracking-wider text-slate-500 mb-1">Average score per competency</p>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            One competency: same pooled-attempt basis as batch average (total if one competency, overall if multiple).
            Multiple competencies: each line uses pooled attempt parameter scores from results.
          </p>
          {competencyAverages.length === 0 || competencyAverages.every((item) => item.avg == null) ? (
            <p className="text-sm text-slate-500">No per-competency scores for this cohort yet.</p>
          ) : (
            <div className="space-y-3">
              {competencyAverages.map((item) => {
                const avg = item.avg ?? 0;
                const barColor = item.band === 'strong' ? '#15803d' : item.band === 'moderate' ? '#d97706' : '#dc2626';
                return (
                  <div key={item.key} className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)_48px] items-center gap-2">
                    <p className="text-[11px] text-slate-600 truncate" title={item.label}>
                      {item.label}
                    </p>
                    <div className="h-2.5 rounded bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-700 ease-out"
                        style={{
                          width: competencyBarsReady ? `${Math.max(0, Math.min(100, avg * 10))}%` : '0%',
                          background: barColor,
                        }}
                      />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 text-right tabular-nums">{formatScoreTenPoint(avg)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 min-w-0 w-full">
          <p className="text-sm sm:text-base font-semibold uppercase tracking-wider text-slate-500 mb-1">How the batch is distributed</p>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Score bands (Excellent ≥8 · Good 6–&lt;8 · Fair 4–&lt;6 · Needs Improvement &lt;4) using each student’s
            average display score per student (mean of attempts; total if one competency, overall if multiple) for this role.
          </p>
          {distributionData.every((item) => item.count === 0) ? (
            <p className="text-sm text-slate-500">No overall scores available for distribution yet.</p>
          ) : (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} width={32} />
                    <Tooltip content={<DistributionTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {distributionData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {distributionData.map((item) => (
                  <span key={`legend-${item.key}`} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm sm:text-base font-semibold uppercase tracking-wider text-slate-500 mb-2">Communication health across batch</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Avg speech quality</p>
            <p className="text-2xl font-semibold text-indigo-700 mt-1">
              {communicationStats.avgSpeechQuality != null ? Math.round(communicationStats.avgSpeechQuality) : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">out of 100</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Avg speaking pace</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">
              {communicationStats.avgSpeakingPace != null ? Math.round(communicationStats.avgSpeakingPace) : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">words / min</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Avg voice confidence</p>
            <p className="text-2xl font-semibold text-amber-700 mt-1">
              {communicationStats.avgVoiceConfidence != null ? Math.round(communicationStats.avgVoiceConfidence) : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">needs work</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">High filler usage</p>
            <p className="text-2xl font-semibold text-rose-700 mt-1">{communicationStats.highFillerCount}</p>
            <p className="text-xs text-slate-500 mt-1">attempts (&gt;4/min)</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Good pause quality</p>
            <p className="text-2xl font-semibold text-emerald-700 mt-1">{communicationStats.goodPauseCount}</p>
            <p className="text-xs text-slate-500 mt-1">attempts (80+)</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="text-sm sm:text-base font-semibold uppercase tracking-wider text-slate-500 mb-1">Student ranking</p>
        <p className="text-sm text-slate-600 mb-3">
          Ranked by average score across attempts: <strong>total</strong> when there is one competency,{' '}
          <strong>overall</strong> when there are multiple (same as interview results).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="text-left bg-slate-50">
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">#</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Student</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Attempts</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Avg overall</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Trend</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Latest completed</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rankingRows.map((r, idx) => {
                const sel = selectedCandidateId === r.candidate_id;
                const completedAt = r.latest_completed_at ? new Date(r.latest_completed_at).toLocaleString() : '—';
                const trendText = r.trend === 'up' ? 'Improved' : r.trend === 'down' ? 'Declined' : r.trend === 'flat' ? 'No change' : '—';
                const trendColor = r.trend === 'up' ? 'text-emerald-700' : r.trend === 'down' ? 'text-rose-700' : 'text-slate-500';
                const iid = r.latest_interview_id?.trim();
                const isExpanded = expandedCandidates.has(r.candidate_id);
                const canExpand = r.attempts > 1;
                return (
                  <>
                    <tr key={`rank-${r.candidate_id}`} className={`border-b border-slate-100 ${sel ? 'bg-sky-50/40' : 'bg-white'}`}>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-700">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-slate-900">{r.candidate_name}</div>
                        {r.candidate_email ? <div className="text-xs text-slate-500">{r.candidate_email}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <span>{r.attempts}</span>
                          {canExpand ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCandidates((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(r.candidate_id)) next.delete(r.candidate_id);
                                  else next.add(r.candidate_id);
                                  return next;
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900"
                            >
                              <span aria-hidden>{isExpanded ? '▲' : '▼'}</span>
                              <span>{isExpanded ? `Hide ${r.attempts} attempts` : `Show ${r.attempts} attempts`}</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-sky-700 tabular-nums">
                        {r.avg_overall != null ? `${formatScoreTenPoint(r.avg_overall)}/10` : '—'}
                      </td>
                      <td className={`px-3 py-2 text-sm ${trendColor}`}>{trendText}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">{completedAt}</td>
                      <td className="px-3 py-2">
                        {onViewCandidate ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={COMPACT_RESULTS_BTN}
                            onClick={() => onViewCandidate(r.candidate_id)}
                          >
                            View journey
                          </Button>
                        ) : (
                          <span className="text-xs text-amber-800">No action</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {r.attempt_details.map((attempt, attemptIdx) => {
                              const nBreak = competencyCountForBreakdown(attempt.parameter_breakdown);
                              const displayAttempt = displayScoreForAttemptFields({
                                total_score: attempt.total_score,
                                overall_score: attempt.overall_score,
                                parameter_breakdown: attempt.parameter_breakdown,
                              });
                              const breakdownRows =
                                attempt.parameter_breakdown && attempt.parameter_breakdown.length > 0
                                  ? attempt.parameter_breakdown
                                  : displayAttempt != null
                                    ? ([
                                        {
                                          key: '__cohort_display',
                                          name: 'Interview',
                                          score: null,
                                        } satisfies CohortParameterScore,
                                      ] as CohortParameterScore[])
                                    : [];
                              return (
                              <div key={`${r.candidate_id}-attempt-${attempt.interview_id || attemptIdx}`} className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Attempt {attemptIdx + 1}</p>
                                  <p className="text-[11px] text-slate-600 tabular-nums">
                                    {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : '—'}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {breakdownRows.map((pb) => {
                                    const raw = toFiniteNumber(pb.score);
                                    const value =
                                      nBreak <= 1 && displayAttempt != null ? displayAttempt : raw;
                                    return (
                                    <span
                                      key={`${r.candidate_id}-attempt-${attemptIdx}-${pb.key}`}
                                      className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
                                    >
                                      <strong className="mr-1">
                                        {value != null ? formatScoreTenPoint(value) : '—'}
                                      </strong>
                                      {pb.name || pb.key}
                                    </span>
                                    );
                                  })}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
