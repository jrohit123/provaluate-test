import { useMemo, useState } from 'react';
import { formatScoreTenPoint } from '@/lib/formatScoreTenPoint';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { ChartContainer } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CartesianGrid, Line, LineChart, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts';

export type TpoJourneyParameterScore = {
  key: string;
  name: string;
  score?: number | null;
};

export type TpoJourneySpeechMetrics = {
  overall_speech_quality?: number;
  speaking_pace_wpm?: number;
  filler_rate_per_min?: number;
  pause_quality_score?: number;
  voice_confidence?: number;
};

export type TpoJourneyInterview = {
  id: string;
  position?: string | null;
  status?: string | null;
  created_at: string;
  completed_at?: string | null;
  interview_source?: string | null;
  interview_mode?: string | null;
  interview_type?: string | null;
  campus_template_title?: string | null;
  overall_score?: number | null;
  total_score?: number | null;
  parameter_breakdown?: TpoJourneyParameterScore[];
  speech_metrics?: TpoJourneySpeechMetrics | null;
};

type Props = {
  studentName: string;
  interviews: TpoJourneyInterview[];
  focusCampusRole?: string | null;
};

const CHART_OVERALL = 'overall' as const;
type ChartMetricOption = typeof CHART_OVERALL | keyof TpoJourneySpeechMetrics;

const SPEECH_METRIC_CONFIGS: {
  key: keyof TpoJourneySpeechMetrics;
  description: string;
  label: string;
  unit: string;
  color: string;
  domain: [number, number];
  idealRange: [number, number];
  yAxisLabel: string;
  tickFormatter?: (v: number) => string;
}[] = [
  { key: 'overall_speech_quality', label: 'Overall Speech Quality', description: 'Composite score (0-100) from pace, fillers, pauses, and voice confidence.', unit: '/100', color: 'hsl(199, 89%, 48%)', domain: [0, 100], idealRange: [85, 100], yAxisLabel: 'Score (0-100)', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'speaking_pace_wpm', label: 'Speaking Pace (WPM)', description: 'Words per minute. Reflects whether you speak at a clear, steady rate.', unit: ' WPM', color: 'hsl(142, 71%, 45%)', domain: [0, 200], idealRange: [120, 160], yAxisLabel: 'WPM', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'filler_rate_per_min', label: 'Filler Rate (/min)', description: 'Audio-detected filler rate per minute (lower is better).', unit: '/min', color: 'hsl(38, 92%, 50%)', domain: [0, 8], idealRange: [0, 2], yAxisLabel: 'Fillers per min', tickFormatter: (v) => `${Number(v).toFixed(1)}` },
  { key: 'pause_quality_score', label: 'Pause & Pacing', description: 'How well you use pauses and rhythm in speech (0-100).', unit: '/100', color: 'hsl(262, 83%, 58%)', domain: [0, 100], idealRange: [85, 100], yAxisLabel: 'Score (0-100)', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'voice_confidence', label: 'Voice Confidence', description: 'How confident and assured your voice sounds (0-100).', unit: '/100', color: 'hsl(199, 89%, 48%)', domain: [0, 100], idealRange: [80, 100], yAxisLabel: 'Score (0-100)', tickFormatter: (v) => `${Math.round(v)}` },
];

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString();
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function competencyCountForBreakdown(pb: TpoJourneyParameterScore[] | undefined): number {
  const list = pb || [];
  const seen = new Set<string>();
  for (const p of list) {
    const sc = p.score;
    if (typeof sc !== 'number' || !Number.isFinite(sc)) continue;
    const id = String(p.key || p.name || '').trim();
    if (!id) continue;
    seen.add(id);
  }
  if (seen.size > 0) return seen.size;
  return list.length;
}

function displayScoreForJourneyAttempt(a: TpoJourneyInterview): number | null {
  const n = competencyCountForBreakdown(a.parameter_breakdown);
  const total = typeof a.total_score === 'number' && Number.isFinite(a.total_score) ? a.total_score : null;
  const overall = typeof a.overall_score === 'number' && Number.isFinite(a.overall_score) ? a.overall_score : null;
  if (n <= 1) return total ?? overall;
  return overall ?? total;
}

export function TpoIndividualJourneyPanel({ studentName, interviews, focusCampusRole = null }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [selectedChart, setSelectedChart] = useState<ChartMetricOption>(CHART_OVERALL);

  const derived = useMemo(() => {
    const sorted = [...interviews].sort((a, b) =>
      (b.completed_at || b.created_at || '').localeCompare(a.completed_at || a.created_at || '')
    );
    const campusRows = sorted.filter((r) => (r.interview_source || '').toLowerCase() === 'campus');
    const personalRows = sorted.filter((r) => (r.interview_source || '').toLowerCase() !== 'campus');
    const latest = sorted[0];
    const latestSpeech = latest?.speech_metrics?.overall_speech_quality ?? null;
    const bestCampus = mean(
      campusRows
        .map((r) => r.overall_score)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    );

    const groups = new Map<
      string,
      {
        key: string;
        roleName: string;
        source: 'campus' | 'personal';
        mode: string;
        type: string;
        attempts: TpoJourneyInterview[];
      }
    >();

    for (const r of sorted) {
      const source = (r.interview_source || '').toLowerCase() === 'campus' ? 'campus' as const : 'personal' as const;
      const roleName = (r.position || r.campus_template_title || 'Interview').trim();
      const mode = (r.interview_mode || '—').toString();
      const type = (r.interview_type || '—').toString();
      const key = `${source}::${roleName}::${mode}::${type}`;
      if (!groups.has(key)) {
        groups.set(key, { key, roleName, source, mode, type, attempts: [] });
      }
      groups.get(key)!.attempts.push(r);
    }

    const roleGroups = Array.from(groups.values())
      .map((g) => ({
        ...g,
        attempts: [...g.attempts].sort((a, b) =>
          (b.completed_at || b.created_at || '').localeCompare(a.completed_at || a.created_at || '')
        ),
      }))
      .sort((a, b) => {
        const ad = a.attempts[0]?.completed_at || a.attempts[0]?.created_at || '';
        const bd = b.attempts[0]?.completed_at || b.attempts[0]?.created_at || '';
        return bd.localeCompare(ad);
      });

    return {
      totalSessions: sorted.length,
      campusSessions: campusRows.length,
      personalSessions: personalRows.length,
      campusRoleCount: new Set(campusRows.map((r) => (r.position || r.campus_template_title || 'Interview').trim())).size,
      personalRoleCount: new Set(personalRows.map((r) => (r.position || r.campus_template_title || 'Interview').trim())).size,
      latestSpeech,
      bestCampus,
      roleGroups,
      hasCampus: campusRows.length > 0,
      hasPersonal: personalRows.length > 0,
    };
  }, [interviews]);

  const journeyTrendData = useMemo(() => {
    const rows = [...interviews]
      .map((r) => ({
        interview: r,
        score: displayScoreForJourneyAttempt(r),
      }))
      .filter((x): x is { interview: TpoJourneyInterview; score: number } => typeof x.score === 'number' && Number.isFinite(x.score))
      .sort((a, b) =>
        (a.interview.completed_at || a.interview.created_at || '').localeCompare(
          b.interview.completed_at || b.interview.created_at || ''
        )
      );

    return rows.map((x, idx) => {
      const source = (x.interview.interview_source || '').toLowerCase() === 'campus' ? 'Campus' : 'Personal';
      const role = (x.interview.position || x.interview.campus_template_title || `Interview ${idx + 1}`).trim();
      const fullLabel = `${role} · ${source}`;
      return {
        name: `${idx + 1}`,
        score: x.score,
        fullLabel,
      };
    });
  }, [interviews]);

  const speechChartDataByMetric = useMemo(
    () =>
      SPEECH_METRIC_CONFIGS.map((config) => {
        const data = [...interviews]
          .sort((a, b) => (a.completed_at || a.created_at || '').localeCompare(b.completed_at || b.created_at || ''))
          .map((i, idx) => {
            const source = (i.interview_source || '').toLowerCase() === 'campus';
            const role = (i.position || i.campus_template_title || `Interview ${idx + 1}`).trim();
            const fullLabel = `${role}${source ? ' · Campus' : ' · Personal'}`;
            return {
              name: role.length <= 20 ? fullLabel : `${source ? `Int. ${idx + 1} (C)` : `Int. ${idx + 1}`}`,
              value: i.speech_metrics?.[config.key] ?? null,
              fullLabel,
            };
          })
          .filter((d) => d.value != null) as { name: string; value: number; fullLabel: string }[];
        return { ...config, data };
      }),
    [interviews]
  );

  const chartDropdownOptions: { value: ChartMetricOption; label: string }[] = useMemo(
    () => [
      ...(journeyTrendData.length >= 2 ? [{ value: CHART_OVERALL as ChartMetricOption, label: 'Performance over time' }] : []),
      ...speechChartDataByMetric.filter((m) => m.data.length >= 2).map((m) => ({ value: m.key as ChartMetricOption, label: m.label })),
    ],
    [journeyTrendData.length, speechChartDataByMetric]
  );

  const selectedMetricConfig = selectedChart === CHART_OVERALL ? null : speechChartDataByMetric.find((m) => m.key === selectedChart);
  const selectedMetricHasData =
    selectedChart === CHART_OVERALL ? journeyTrendData.length >= 2 : (selectedMetricConfig?.data.length ?? 0) >= 2;
  const selectedMetricData = selectedChart === CHART_OVERALL ? journeyTrendData : (selectedMetricConfig?.data ?? []);
  const selectedDomain = selectedMetricConfig ? selectedMetricConfig.domain : ([0, 10] as [number, number]);

  if (interviews.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
        No interviews found for this student yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="text-lg font-semibold text-slate-900">{studentName}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total sessions</p>
              <p className="text-lg font-semibold text-indigo-700">{derived.totalSessions}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Campus sessions</p>
              <p className="text-lg font-semibold text-sky-700">{derived.campusSessions}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Personal sessions</p>
              <p className="text-lg font-semibold text-teal-700">{derived.personalSessions}</p>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              {selectedChart === CHART_OVERALL ? 'Performance over time' : selectedMetricConfig?.label ?? 'Performance over time'}
            </p>
            {chartDropdownOptions.length > 0 ? (
              <div className="mt-2 space-y-2">
                <Select
                  value={chartDropdownOptions.some((o) => o.value === selectedChart) ? selectedChart : chartDropdownOptions[0].value}
                  onValueChange={(v) => setSelectedChart(v as ChartMetricOption)}
                >
                  <SelectTrigger className="w-full min-h-[44px] touch-manipulation text-sm sm:text-base bg-white">
                    <SelectValue placeholder="Select chart" />
                  </SelectTrigger>
                  <SelectContent>
                    {chartDropdownOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMetricHasData ? (
                  <ChartContainer
                    config={
                      selectedChart === CHART_OVERALL
                        ? { score: { label: 'Overall score', color: 'hsl(199, 89%, 48%)' } }
                        : { value: { label: selectedMetricConfig?.label || 'Value', color: selectedMetricConfig?.color || 'hsl(199, 89%, 48%)' } }
                    }
                    className="h-[200px] sm:h-[260px] md:h-[280px] w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:!fill-gray-900 [&_.recharts-cartesian-axis-tick_text]:!text-[12px] sm:[&_.recharts-cartesian-axis-tick_text]:!text-[14px] [&_.recharts-cartesian-axis-tick_text]:!font-medium [&_.recharts-cartesian-axis_text]:!fill-gray-900 [&_.recharts-label]:!fill-gray-900 [&_.recharts-label]:!text-[13px] sm:[&_.recharts-label]:!text-[15px]"
                  >
                    <LineChart data={selectedMetricData} margin={{ top: 10, right: 10, left: 14, bottom: 24 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: '#111827' }}
                        tickFormatter={() => ''}
                        label={{ value: 'Interview', position: 'insideBottom', offset: -8, style: { fontSize: 13, fill: '#111827', fontWeight: 500 } }}
                      />
                      <YAxis
                        domain={selectedDomain}
                        tick={{ fontSize: 12, fill: '#111827' }}
                        width={40}
                        tickMargin={10}
                        tickFormatter={
                          selectedChart === CHART_OVERALL
                            ? (v) => `${formatScoreTenPoint(Number(v))}/10`
                            : (selectedMetricConfig?.tickFormatter ?? ((v) => String(v)))
                        }
                      />
                      {selectedMetricConfig ? (
                        <ReferenceArea
                          y1={selectedMetricConfig.idealRange[0]}
                          y2={selectedMetricConfig.idealRange[1]}
                          fill="hsl(142 71% 45% / 0.12)"
                          stroke="hsl(142 71% 45% / 0.4)"
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                      ) : null}
                      <Tooltip
                        formatter={(value: number) => [
                          `${Number(value).toFixed(selectedMetricConfig?.key === 'filler_rate_per_min' ? 2 : 1)}${selectedMetricConfig?.unit || '/10'}`,
                          selectedMetricConfig?.label || 'Score',
                        ]}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullLabel ?? '')}
                      />
                      <Line
                        type="monotone"
                        dataKey={selectedChart === CHART_OVERALL ? 'score' : 'value'}
                        stroke={selectedChart === CHART_OVERALL ? 'var(--color-score)' : 'var(--color-value)'}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name={selectedMetricConfig?.label || 'Overall score'}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-xs text-slate-500 py-8 text-center">Complete more interviews to see progress for this metric.</p>
                )}
                {selectedMetricHasData && selectedChart === CHART_OVERALL && (
                  <div className="text-xs sm:text-sm text-gray-900 mt-2 px-1 space-y-0.5">
                    <p>Y-axis: Score (out of 10)</p>
                  </div>
                )}
                {selectedMetricHasData && selectedChart !== CHART_OVERALL && selectedMetricConfig && (
                  <div className="text-xs sm:text-sm text-gray-900 mt-2 px-1 space-y-1">
                    <p>Shaded band = ideal range for this metric. Compare your scores against the band.</p>
                    <p>Y-axis: {selectedMetricConfig.yAxisLabel}</p>
                    <p className="text-gray-700 mt-1.5">{selectedMetricConfig.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Complete at least 2 interviews to view progress charts.</p>
            )}
          </div>
        </div>
      </div>

      {derived.roleGroups.map((g, idx) => {
        const isFocus =
          !!focusCampusRole &&
          g.source === 'campus' &&
          g.roleName.trim().toLowerCase() === focusCampusRole.trim().toLowerCase();
        const isOpen = openGroups[g.key] ?? (isFocus || idx === 0);
        const scoreVals = g.attempts
          .map((a) => displayScoreForJourneyAttempt(a))
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        const avgScore = mean(scoreVals);
        return (
          <div
            key={g.key}
            className={`rounded-xl border bg-white ${isFocus ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'}`}
          >
            <button
              type="button"
              className="w-full px-4 py-3 sm:px-5 flex items-center justify-between gap-3 text-left"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [g.key]: !isOpen }))}
            >
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">{g.roleName}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {g.source === 'campus' ? 'Campus' : 'Personal'} · {g.mode.toUpperCase()} · {g.type}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  ×{g.attempts.length}
                </span>
                <span className="text-sm font-semibold text-sky-700 tabular-nums">
                  {avgScore != null ? formatScoreTenPoint(avgScore) : '—'}
                </span>
                <span className="text-slate-500 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-slate-100 px-4 py-3 sm:px-5 space-y-3">
                {g.source === 'personal' ? (
                  <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
                    Personal interviews can have speech-only outcomes depending on setup.
                  </div>
                ) : null}
                {g.attempts.map((a, i) => (
                  <div key={a.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    {(() => {
                      const displayScore = displayScoreForJourneyAttempt(a);
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {g.source === 'campus' ? `Attempt ${i + 1}` : `Session ${i + 1}`}
                          </p>
                          <div className="text-right">
                            <p className="text-xs text-slate-600 tabular-nums">{fmtDate(a.completed_at || a.created_at)}</p>
                            <p className="text-sm font-semibold text-sky-700 tabular-nums mt-0.5">
                              {displayScore != null ? formatScoreTenPoint(displayScore) : '—'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs">
                      <a
                        href={`${import.meta.env.BASE_URL}final-results/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        View results
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

