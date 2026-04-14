import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CANDIDATE_INTERVIEW_CARD_CLASS } from '@/components/ai-interview/StudentPerformanceReportView';
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  avg_voice_confidence?: number | null;
  weakest_param_name?: string | null;
  weakest_param_avg?: number | null;
  /** Students with filler rate &gt; 7/min (when speech metrics present). */
  filler_high_count?: number | null;
  filler_rate_sample_count?: number | null;
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
};

/** Stable 0–1 from string (deterministic jitter / hues). */
function hashToUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function jitterX(candidateId: string, competencyKey: string, maxSpan: number): number {
  const u = hashToUnit(`${candidateId}\0${competencyKey}`);
  return (u - 0.5) * 2 * maxSpan;
}

function fillForCandidate(candidateId: string): string {
  const h = Math.floor(hashToUnit(candidateId) * 360);
  return `hsl(${h} 62% 42%)`;
}

function bandLabelFromScore(score: number): string {
  if (score >= 9) return '9–10';
  if (score >= 7) return '7–8';
  if (score >= 5) return '5–6';
  if (score >= 3) return '3–4';
  return '1–2';
}

const SCORE_BAND_REFS: { y0: number; y1: number; fill: string }[] = [
  { y0: 0.5, y1: 2.5, fill: '#fef2f2' },
  { y0: 2.5, y1: 4.5, fill: '#fff7ed' },
  { y0: 4.5, y1: 6.5, fill: '#fefce8' },
  { y0: 6.5, y1: 8.5, fill: '#eff6ff' },
  { y0: 8.5, y1: 10.5, fill: '#f0fdf4' },
];

type CohortScatterPoint = {
  x: number;
  y: number;
  candidate_id: string;
  candidate_name: string;
  competencyKey: string;
  competencyLabel: string;
  fill: string;
  fillOpacity: number;
  r: number;
  stroke?: string;
  strokeWidth?: number;
};

function shortName(name?: string | null): string {
  const p = (name || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 12);
  return `${p[0]} ${p[1].charAt(0)}.`;
}

const COMPACT_RESULTS_BTN =
  'h-9 min-h-[44px] sm:min-h-9 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation w-auto max-w-full self-start inline-flex items-center justify-center';

function ScatterDotShape(props: {
  cx?: number;
  cy?: number;
  payload?: CohortScatterPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.r}
      fill={payload.fill}
      fillOpacity={payload.fillOpacity}
      stroke={payload.stroke}
      strokeWidth={payload.strokeWidth}
    />
  );
}

function CompetencyScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CohortScatterPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs max-w-[240px]">
      <p className="font-semibold text-slate-900">{d.candidate_name}</p>
      <p className="text-slate-600 mt-1 leading-snug">{d.competencyLabel}</p>
      <p className="text-slate-800 mt-1.5 tabular-nums">
        Score <strong>{d.y.toFixed(1)}</strong>/10 · Band <strong>{bandLabelFromScore(d.y)}</strong>
      </p>
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
}: Props) {
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

  const scatterLayout = useMemo(() => {
    const n = rows.length;
    const m = Math.max(1, paramKeys.length);
    const dotR = Math.max(2.1, Math.min(6, 6.2 - Math.sqrt(n) * 0.38));
    const jitterMax = Math.min(0.34, 0.85 / Math.max(2.8, m));
    const maxChars = paramKeys.reduce((mx, p) => Math.max(mx, p.fullLabel.length), 12);
    const pxPerComp = Math.min(360, Math.max(200, 100 + Math.ceil(maxChars * 2.6)));
    const minChartWidth = Math.max(340, Math.min(1400, 72 + m * pxPerComp));
    const chartHeight = Math.min(540, Math.max(400, 360 + Math.sqrt(Math.max(n, 1)) * 14));

    const rawPoints: Omit<CohortScatterPoint, 'fillOpacity' | 'fill' | 'r' | 'stroke' | 'strokeWidth'>[] = [];
    paramKeys.forEach((pk, compIdx) => {
      for (const r of rows) {
        const pb = (r.parameter_breakdown || []).find((p) => p.key === pk.key);
        const sc = pb?.score;
        if (sc == null || typeof sc !== 'number' || Number.isNaN(sc)) continue;
        const y = Math.min(10, Math.max(1, sc));
        rawPoints.push({
          x: compIdx + jitterX(r.candidate_id, pk.key, jitterMax),
          y,
          candidate_id: r.candidate_id,
          candidate_name: (r.candidate_name || 'Candidate').trim() || 'Candidate',
          competencyKey: pk.key,
          competencyLabel: pk.fullLabel,
        });
      }
    });

    const bucketCounts = new Map<string, number>();
    for (const p of rawPoints) {
      const key = `${p.competencyKey}_${bandLabelFromScore(p.y)}`;
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }

    const globalAlpha = Math.max(0.38, Math.min(0.88, 0.92 - n * 0.007));

    const points: CohortScatterPoint[] = rawPoints.map((p) => {
      const bKey = `${p.competencyKey}_${bandLabelFromScore(p.y)}`;
      const pile = bucketCounts.get(bKey) ?? 1;
      const densityBoost = 1 / Math.sqrt(pile);
      const fillOpacity = Math.max(0.28, Math.min(0.92, globalAlpha * (0.75 + 0.35 * densityBoost)));
      const isSel = Boolean(selectedCandidateId && p.candidate_id === selectedCandidateId);
      return {
        ...p,
        fill: fillForCandidate(p.candidate_id),
        fillOpacity,
        r: isSel ? dotR + 1.2 : dotR,
        stroke: isSel ? '#0369a1' : 'rgba(15,23,42,0.18)',
        strokeWidth: isSel ? 2 : 0.7,
      };
    });

    return { points, dotR, minChartWidth, chartHeight, jitterMax };
  }, [rows, paramKeys, selectedCandidateId]);

  const insightText = useMemo(() => {
    if (!cohortStats || rows.length === 0) return null;
    const parts: string[] = [];
    const w = cohortStats.weakest_param_name;
    const wa = cohortStats.weakest_param_avg;
    if (w != null && wa != null) {
      parts.push(
        `Across ${cohortStats.count} candidate${cohortStats.count === 1 ? '' : 's'}, average overall score is ${cohortStats.avg_overall?.toFixed(1) ?? '—'}/10.`
      );
      parts.push(` Weakest area on average: “${w}” (~${wa.toFixed(1)}/10).`);
    }
    const fillers = rows
      .map((r) => r.speech?.filler_rate_per_min)
      .filter((v): v is number => typeof v === 'number');
    if (fillers.length > 0) {
      const avgF = fillers.reduce((a, b) => a + b, 0) / fillers.length;
      const high = cohortStats.filler_high_count;
      const nFill = cohortStats.filler_rate_sample_count ?? fillers.length;
      if (high != null && high > 0 && nFill != null && nFill > 0) {
        parts.push(
          ` ${high} of ${nFill} student${nFill === 1 ? '' : 's'} exceed 7 fillers/min (coaching opportunity).`,
        );
      }
      parts.push(` Average filler rate is ${avgF.toFixed(1)}/min — consider coaching on delivery if high.`);
    }
    return parts.join('');
  }, [cohortStats, rows]);

  const topPerformer = useMemo(() => {
    const scored = rows.filter((r) => r.overall_score != null);
    if (scored.length === 0) return null;
    return scored.reduce((a, b) => ((b.overall_score ?? 0) > (a.overall_score ?? 0) ? b : a));
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

  const modeLabel = rows[0]?.interview_mode === 'ai' ? 'AI Interview' : rows[0]?.interview_mode || '—';
  const typeLabel = rows[0]?.interview_type ? rows[0].interview_type.charAt(0).toUpperCase() + rows[0].interview_type!.slice(1) : '—';

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
            {template.title || template.position || 'Campus role'}
          </span>
          <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900">
            {modeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950">
            {typeLabel}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Campus cohort overview</h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Latest completed attempt per student for this published role · {rows.length} candidate
          {rows.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cohort avg</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            {cohortStats?.avg_overall != null ? `${cohortStats.avg_overall.toFixed(1)}` : '—'}
            <span className="text-sm font-normal text-slate-500">/10</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Overall score</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Top performer</p>
          <p className="text-base font-semibold text-slate-900 mt-1 truncate" title={topPerformer?.candidate_name || ''}>
            {topPerformer ? shortName(topPerformer.candidate_name) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {topPerformer?.overall_score != null ? `Score: ${topPerformer.overall_score}/10` : ''}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Weakest competency</p>
          <p className="text-sm font-semibold text-slate-900 mt-1 line-clamp-2" title={cohortStats?.weakest_param_name || ''}>
            {cohortStats?.weakest_param_name || '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {cohortStats?.weakest_param_avg != null ? `Cohort avg: ${cohortStats.weakest_param_avg.toFixed(1)}/10` : ''}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Avg voice confidence</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            {cohortStats?.avg_voice_confidence != null ? Math.round(cohortStats.avg_voice_confidence) : '—'}
            <span className="text-sm font-normal text-slate-500">/100</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">From speech analysis</p>
        </div>
      </div>

      {insightText && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm text-sky-950 leading-relaxed">
            <strong>Cohort insight:</strong> {insightText}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 min-w-0 w-full">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Competency scatter</p>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Each dot is one student on one competency (same color = same student). Y-axis shows 1–2 … 9–10 score bands.
            Scroll sideways when there are many columns.
          </p>
          {paramKeys.length === 0 ? (
            <p className="text-sm text-slate-500">No competency scores stored for these attempts yet.</p>
          ) : scatterLayout.points.length === 0 ? (
            <p className="text-sm text-slate-500">No per-competency scores for this cohort yet.</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="min-w-0" style={{ minWidth: scatterLayout.minChartWidth }}>
                <div className="bg-slate-50/50" style={{ height: scatterLayout.chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 16, right: 18, left: 14, bottom: 18 }}
                      aria-label="Competency scores scatter plot"
                    >
                      {SCORE_BAND_REFS.map((b, i) => (
                        <ReferenceArea
                          key={i}
                          y1={b.y0}
                          y2={b.y1}
                          fill={b.fill}
                          fillOpacity={0.88}
                          strokeOpacity={0}
                          ifOverflow="extendDomain"
                        />
                      ))}
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-300/80" strokeOpacity={0.9} />
                      {paramKeys.length > 1
                        ? Array.from({ length: paramKeys.length - 1 }, (_, i) => (
                            <ReferenceLine
                              key={`sep-${i}`}
                              x={i + 0.5}
                              stroke="#64748b"
                              strokeWidth={1.25}
                              strokeOpacity={0.65}
                              ifOverflow="extendDomain"
                            />
                          ))
                        : null}
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[
                          -0.5 - scatterLayout.jitterMax,
                          Math.max(0, paramKeys.length - 1) + 0.5 + scatterLayout.jitterMax,
                        ]}
                        ticks={paramKeys.map((_, i) => i)}
                        tick={false}
                        axisLine={{ stroke: '#64748b', strokeWidth: 1 }}
                        tickLine={false}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0.5, 10.5]}
                        ticks={[2, 4, 6, 8, 10]}
                        interval={0}
                        tickFormatter={(v) =>
                          ({ 2: '1–2', 4: '3–4', 6: '5–6', 8: '7–8', 10: '9–10' } as Record<number, string>)[v] ??
                          ''
                        }
                        width={48}
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        label={{
                          value: 'Score band',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 4,
                          fill: '#64748b',
                          fontSize: 11,
                        }}
                      />
                      <Tooltip content={<CompetencyScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter
                        data={scatterLayout.points}
                        isAnimationActive={false}
                        shape={ScatterDotShape}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div
                  className="grid border-t border-slate-300/90 bg-white px-2 pt-2.5 pb-2.5"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, paramKeys.length)}, minmax(0, 1fr))`,
                  }}
                >
                  {paramKeys.map((pk, i) => (
                    <p
                      key={pk.key}
                      className={`min-w-0 text-center text-[11px] sm:text-xs text-slate-800 leading-snug px-2 ${
                        i > 0 ? 'border-l border-slate-200' : ''
                      }`}
                    >
                      {pk.fullLabel}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Interview results</p>
        <p className="text-sm text-slate-600 mb-3">
          Latest completed campus attempt per student. Open the full report in a new tab.
        </p>
        <ul className="space-y-3 sm:space-y-4 w-full">
          {rows.map((r) => {
            const sel = selectedCandidateId === r.candidate_id;
            const positionLabel =
              (r.position && r.position.trim()) || template?.title || template?.position || 'Campus interview';
            const completedAt = r.completed_at ? new Date(r.completed_at).toLocaleString() : null;
            const modeLabelRow =
              r.interview_mode === 'ai'
                ? 'AI'
                : r.interview_mode === 'structured'
                  ? 'Structured'
                  : r.interview_mode
                    ? r.interview_mode.charAt(0).toUpperCase() + r.interview_mode.slice(1)
                    : null;
            const typeLabelRow = r.interview_type
              ? r.interview_type.charAt(0).toUpperCase() + r.interview_type.slice(1)
              : null;
            const modePart =
              modeLabelRow || typeLabelRow
                ? [modeLabelRow, typeLabelRow].filter(Boolean).join(' · ')
                : null;
            const iid = r.interview_id?.trim();
            const cardRing = sel ? 'ring-2 ring-sky-500 ring-offset-2' : '';
            return (
              <li
                key={iid || r.candidate_id}
                className={`${CANDIDATE_INTERVIEW_CARD_CLASS} ${cardRing}`}
              >
                <div className="min-w-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base sm:text-lg">{positionLabel}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      <span className="font-medium text-gray-800">{r.candidate_name || 'Candidate'}</span>
                      {r.candidate_email ? (
                        <span className="block truncate text-gray-500" title={r.candidate_email}>
                          {r.candidate_email}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Completed
                      {r.overall_score != null && (
                        <span className="ml-2 font-semibold text-sky-600 tabular-nums">
                          {Number(r.overall_score).toFixed(1)}/10
                        </span>
                      )}
                    </p>
                    {modePart ? (
                      <p className="text-xs text-gray-500 mt-1" title="Mode · type">
                        {modePart}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 flex flex-wrap items-start sm:items-end justify-between sm:justify-end gap-x-2 gap-y-2 sm:flex-col">
                    <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide text-sky-900">
                      CAMPUS
                    </span>
                    {completedAt ? (
                      <span
                        className="text-[11px] sm:text-xs text-gray-500 tabular-nums whitespace-nowrap sm:text-right"
                        title="Completed at"
                      >
                        {completedAt}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {iid ? (
                    <Button asChild size="sm" variant="outline" className={COMPACT_RESULTS_BTN}>
                      <a
                        href={`/final-results/${iid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                        View results
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-amber-800">
                      Interview id missing — open this student under <strong>Individual journey</strong> to view results.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
