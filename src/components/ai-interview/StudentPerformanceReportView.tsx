import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatScoreTenPoint } from '@/lib/formatScoreTenPoint';

export type PerformanceInterviewRow = {
  id: string;
  position: string | null;
  status: string | null;
  created_at: string;
  candidate_name?: string | null;
  interview_source?: string | null;
  campus_template_id?: string | null;
  overall_score?: number | null;
  completed_at?: string | null;
};

type SpeechMetrics = {
  overall_speech_quality?: number;
  speaking_pace_wpm?: number;
  filler_score?: number;
  filler_rate_per_min?: number;
  pause_quality_score?: number;
  voice_confidence?: number;
};

export type ProgressItem = {
  interview_id: string;
  position: string;
  completed_at: string | null;
  overall_score: number | null;
  total_score?: number | null;
  competency_count?: number;
  score_for_display?: number | null;
  interview_source?: string | null;
  competency_scores: Record<string, number>;
  speech_metrics?: SpeechMetrics | null;
};

function resolveDisplayScore(
  progressItem: ProgressItem | undefined,
  interviewRow: PerformanceInterviewRow
): number | null {
  if (progressItem) {
    if (progressItem.score_for_display != null) return progressItem.score_for_display;
    const scoreCount = typeof progressItem.competency_count === 'number'
      ? progressItem.competency_count
      : Object.values(progressItem.competency_scores || {}).filter((v) => v != null).length;
    if (scoreCount <= 1 && progressItem.total_score != null) return progressItem.total_score;
    if (progressItem.overall_score != null) return progressItem.overall_score;
    if (progressItem.total_score != null) return progressItem.total_score;
  }
  return interviewRow.overall_score != null ? interviewRow.overall_score : null;
}

const CHART_OVERALL = 'overall' as const;
type ChartMetricOption = typeof CHART_OVERALL | keyof SpeechMetrics;

const SPEECH_METRIC_CONFIGS: {
  key: keyof SpeechMetrics;
  label: string;
  description: string;
  unit: string;
  color: string;
  domain: [number, number];
  idealRange: [number, number];
  yAxisLabel: string;
  tickFormatter?: (v: number) => string;
}[] = [
  { key: 'overall_speech_quality', label: 'Overall Speech Quality', description: 'Composite score (0–100) from pace, filler score, pauses, and voice confidence.', unit: '/100', color: 'hsl(199, 89%, 48%)', domain: [0, 100], idealRange: [85, 100], yAxisLabel: 'Score (0–100)', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'speaking_pace_wpm', label: 'Speaking Pace (WPM)', description: 'Words per minute. Reflects whether you speak at a clear, steady rate that is easy for the listener to follow.', unit: ' WPM', color: 'hsl(142, 71%, 45%)', domain: [0, 200], idealRange: [120, 160], yAxisLabel: 'WPM', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'filler_score', label: 'Filler Score', description: 'Audio-detected filler sounds, scored 0–100 (higher = fewer fillers).', unit: '/100', color: 'hsl(38, 92%, 50%)', domain: [0, 100], idealRange: [85, 100], yAxisLabel: 'Score (0–100)', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'pause_quality_score', label: 'Pause & Pacing', description: 'How well you use pauses and rhythm in your speech (0–100). Good pacing helps the listener follow and shows control.', unit: '/100', color: 'hsl(262, 83%, 58%)', domain: [0, 100], idealRange: [85, 100], yAxisLabel: 'Score (0–100)', tickFormatter: (v) => `${Math.round(v)}` },
  { key: 'voice_confidence', label: 'Voice Confidence', description: 'How confident and assured your voice sounds (0–100). Higher scores suggest you came across as self-assured and clear.', unit: '/100', color: 'hsl(199, 89%, 48%)', domain: [0, 100], idealRange: [80, 100], yAxisLabel: 'Score (0–100)', tickFormatter: (v) => `${Math.round(v)}` },
];

/** Shared layout for campus templates + performance interview cards. */
export const CANDIDATE_INTERVIEW_CARD_CLASS =
  'flex flex-col gap-4 sm:gap-5 p-5 sm:p-6 min-h-[152px] sm:min-h-[168px] bg-white rounded-xl border border-gray-200 shadow-sm w-full';

function isCampusInterviewRow(i: PerformanceInterviewRow): boolean {
  return (i.interview_source || '').toLowerCase() === 'campus';
}

function performanceReportSourceLabel(source: string | null | undefined): 'CAMPUS' | 'PERSONAL' {
  return (source || '').toLowerCase() === 'campus' ? 'CAMPUS' : 'PERSONAL';
}

export type StudentPerformanceReportViewProps = {
  title: string;
  /** Optional blurb under the title (e.g. candidate “My interviews” copy). */
  introText?: React.ReactNode;
  interviewRows: PerformanceInterviewRow[];
  progress: ProgressItem[];
  loadingList: boolean;
  error?: string | null;
  /** When false, hides “Take interview” (e.g. TPO viewing a student). Default true. */
  showTakeInterview?: boolean;
  messageEmptyList?: React.ReactNode;
  /** Message when rows exist but none pass the campus “completed” visibility filter */
  messageAllCampusPending?: React.ReactNode;
  /** Shown under cards when fewer than 2 scored completions (no time series yet) */
  moreInterviewsHint?: React.ReactNode;
};

export function StudentPerformanceReportView({
  title,
  introText,
  interviewRows: list,
  progress,
  loadingList: loading,
  error = null,
  showTakeInterview = true,
  messageEmptyList = 'You have no interviews linked to your account yet. Open an interview link from your email to have it appear here.',
  messageAllCampusPending = (
    <>
      Completed interviews will show here. For campus roles assigned by your TPO, open <strong>Campus interviews</strong> to
      take or continue an attempt; once you finish, it appears below and in the charts.
    </>
  ),
  moreInterviewsHint = 'Complete more interviews to see your progress over time.',
}: StudentPerformanceReportViewProps) {
  const isMobile = useIsMobile();
  const [selectedChart, setSelectedChart] = useState<ChartMetricOption>(CHART_OVERALL);
  const tooltipFontSize = isMobile ? 12 : 14;

  const visibleInterviewList = useMemo(
    () =>
      list.filter((i) => {
        if (!isCampusInterviewRow(i)) return true;
        return i.status === 'completed';
      }),
    [list]
  );

  const progressByInterviewId = progress.reduce<Record<string, ProgressItem>>((acc, p) => {
    acc[p.interview_id] = p;
    return acc;
  }, {});

  const chartData = useMemo(
    () =>
      progress
        .map((p) => ({
          ...p,
          _display_score:
            p.score_for_display != null
              ? p.score_for_display
              : ((typeof p.competency_count === 'number'
                  ? p.competency_count
                  : Object.values(p.competency_scores || {}).filter((v) => v != null).length) <= 1 && p.total_score != null)
                ? p.total_score
                : p.overall_score,
        }))
        .filter((p) => p._display_score != null)
        .sort((a, b) => new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime())
        .map((p, idx) => {
          const isCampus = (p.interview_source || '').toLowerCase() === 'campus';
          const rawPos = p.position || `Interview ${idx + 1}`;
          const fullLabel = `${rawPos}${isCampus ? ' · Campus' : ''}`;
          const shortName =
            p.position && p.position.length <= 20
              ? fullLabel
              : `${isCampus ? `Interview ${idx + 1} (Campus)` : `Interview ${idx + 1}`}`;
          return {
            name: shortName,
            score: p._display_score ?? 0,
            fullLabel,
          };
        }),
    [progress]
  );
  const showChart = chartData.length >= 2;

  const progressSortedByDate = useMemo(
    () =>
      [...progress].sort(
        (a, b) => new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime()
      ),
    [progress]
  );

  const speechChartDataByMetric = useMemo(
    () =>
      SPEECH_METRIC_CONFIGS.map((config) => {
        const data = progressSortedByDate
          .map((p, idx) => {
            const isCampus = (p.interview_source || '').toLowerCase() === 'campus';
            const rawPos = p.position || `Interview ${idx + 1}`;
            const fullLabel = `${rawPos}${isCampus ? ' · Campus' : ''}`;
            const name =
              p.position && p.position.length <= 20 ? fullLabel : `${isCampus ? `Int. ${idx + 1} (C)` : `Int. ${idx + 1}`}`;
            return {
              name,
              value: p.speech_metrics?.[config.key] ?? null,
              fullLabel,
            };
          })
          .filter((d) => d.value != null) as { name: string; value: number; fullLabel: string }[];
        return { ...config, data };
      }),
    [progressSortedByDate]
  );
  const showSpeechCharts = speechChartDataByMetric.some((m) => m.data.length >= 2);
  const showAnyChart = showChart || showSpeechCharts;
  const chartDropdownOptions: { value: ChartMetricOption; label: string }[] = useMemo(
    () => [
      ...(showChart ? [{ value: CHART_OVERALL as ChartMetricOption, label: 'Performance over time' }] : []),
      ...speechChartDataByMetric.filter((m) => m.data.length >= 2).map((m) => ({ value: m.key as ChartMetricOption, label: m.label })),
    ],
    [showChart, speechChartDataByMetric]
  );
  const selectedMetricConfig = selectedChart === CHART_OVERALL ? null : speechChartDataByMetric.find((m) => m.key === selectedChart);
  const selectedMetricHasData = selectedChart === CHART_OVERALL ? showChart : (selectedMetricConfig?.data.length ?? 0) >= 2;

  useEffect(() => {
    const valid = chartDropdownOptions.some((opt) => opt.value === selectedChart);
    if (chartDropdownOptions.length > 0 && !valid) {
      setSelectedChart(chartDropdownOptions[0].value);
    }
  }, [chartDropdownOptions, selectedChart]);

  const compactActionBtn =
    'h-9 min-h-[44px] sm:min-h-9 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation w-auto max-w-full self-start inline-flex items-center justify-center';

  const individualSummary = useMemo(() => {
    const latest = progressSortedByDate.length > 0 ? progressSortedByDate[progressSortedByDate.length - 1] : null;
    if (!latest) return null;

    const studentName =
      list.find((i) => (i.candidate_name || '').trim())?.candidate_name?.trim() ||
      latest.position ||
      'Student';
    const roleLabel = latest.position || list.find((i) => i.position)?.position || 'Interview role';

    const scores = progressSortedByDate
      .map((p) => p.score_for_display ?? p.overall_score ?? p.total_score ?? null)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const avgOverall = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
    const attempts = progressSortedByDate.length;
    const status = avgOverall != null ? (avgOverall >= 7 ? 'Interview-ready' : avgOverall >= 5 ? 'Needs practice' : 'Needs coaching') : '—';

    const priorAttempts = progressSortedByDate.slice(0, -1);
    const competencyValuesByKey = new Map<string, number[]>();
    for (const p of priorAttempts) {
      for (const [k, v] of Object.entries(p.competency_scores || {})) {
        if (typeof v !== 'number' || !Number.isFinite(v)) continue;
        if (!competencyValuesByKey.has(k)) competencyValuesByKey.set(k, []);
        competencyValuesByKey.get(k)!.push(v);
      }
    }

    const latestCompetencyEntries = Object.entries(latest.competency_scores || {}).filter(
      ([, v]) => typeof v === 'number' && Number.isFinite(v)
    ) as Array<[string, number]>;

    const competencyRows = latestCompetencyEntries.map(([key, score]) => {
      const series = competencyValuesByKey.get(key) || [];
      const baseline = series.length > 0 ? Number((series.reduce((a, b) => a + b, 0) / series.length).toFixed(1)) : null;
      const delta = baseline != null ? Number((score - baseline).toFixed(1)) : null;
      return { key, score, baseline, delta };
    });

    return {
      studentName,
      roleLabel,
      avgOverall,
      attempts,
      status,
      baselineOverall: avgOverall,
      competencyRows,
    };
  }, [progressSortedByDate, list]);

  return (
    <div className="w-full min-w-0 pb-4 sm:pb-0">
      <h2
        className={`text-lg sm:text-xl md:text-2xl font-bold text-gray-900 ${introText ? 'mb-2 sm:mb-3' : 'mb-3 sm:mb-4'}`}
      >
        {title}
      </h2>
      {introText ? <p className="text-sm text-gray-600 mb-3 sm:mb-4">{introText}</p> : null}
      {loading && (
        <div className="flex items-center gap-2 text-gray-600 text-sm sm:text-base">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" /> Loading…
        </div>
      )}
      {error && <p className="text-red-600 text-sm sm:text-base mb-4">{error}</p>}
      {!loading && showAnyChart && chartDropdownOptions.length > 0 && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 mb-3 min-w-0">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900">
              {selectedChart === CHART_OVERALL ? 'Performance over time' : selectedMetricConfig?.label ?? 'Performance over time'}
            </h3>
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
              <ChartContainer
                config={{ score: { label: 'Overall score', color: 'hsl(199, 89%, 48%)' } }}
                className="h-[200px] sm:h-[260px] md:h-[280px] w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:!fill-gray-900 [&_.recharts-cartesian-axis-tick_text]:!text-[12px] sm:[&_.recharts-cartesian-axis-tick_text]:!text-[14px] [&_.recharts-cartesian-axis-tick_text]:!font-medium [&_.recharts-cartesian-axis_text]:!fill-gray-900 [&_.recharts-label]:!fill-gray-900 [&_.recharts-label]:!text-[13px] sm:[&_.recharts-label]:!text-[15px]"
              >
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 14, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#111827' }} tickFormatter={() => ''} label={{ value: 'Interview', position: 'insideBottom', offset: -8, style: { fontSize: 13, fill: '#111827', fontWeight: 500 } }} />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 12, fill: '#111827' }}
                    width={40}
                    tickMargin={10}
                    tickFormatter={(v) => `${formatScoreTenPoint(Number(v))}/10`}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: tooltipFontSize }}
                    labelStyle={{ fontSize: tooltipFontSize }}
                    formatter={(value: number) => [`${formatScoreTenPoint(Number(value))}/10`, 'Score']}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullLabel ?? '')}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 4 }} name="Overall score" />
                </LineChart>
              </ChartContainer>
            )}
            {selectedMetricHasData && selectedChart !== CHART_OVERALL && selectedMetricConfig && (
              <ChartContainer
                config={{ value: { label: selectedMetricConfig.label, color: selectedMetricConfig.color } }}
                className="h-[200px] sm:h-[260px] md:h-[280px] w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:!fill-gray-900 [&_.recharts-cartesian-axis-tick_text]:!text-[12px] sm:[&_.recharts-cartesian-axis-tick_text]:!text-[14px] [&_.recharts-cartesian-axis-tick_text]:!font-medium [&_.recharts-cartesian-axis_text]:!fill-gray-900 [&_.recharts-label]:!fill-gray-900 [&_.recharts-label]:!text-[13px] sm:[&_.recharts-label]:!text-[15px]"
              >
                <LineChart data={selectedMetricConfig.data} margin={{ top: 10, right: 10, left: 14, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#111827' }} tickFormatter={() => ''} label={{ value: 'Interview', position: 'insideBottom', offset: -8, style: { fontSize: 13, fill: '#111827', fontWeight: 500 } }} />
                  <YAxis
                    domain={selectedMetricConfig.domain}
                    tick={{ fontSize: 12, fill: '#111827' }}
                    width={40}
                    tickMargin={10}
                    tickFormatter={selectedMetricConfig.tickFormatter ?? ((v) => String(v))}
                  />
                  <ReferenceArea
                    y1={selectedMetricConfig.idealRange[0]}
                    y2={selectedMetricConfig.idealRange[1]}
                    fill="hsl(142 71% 45% / 0.12)"
                    stroke="hsl(142 71% 45% / 0.4)"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                  <Tooltip
                    contentStyle={{ fontSize: tooltipFontSize }}
                    labelStyle={{ fontSize: tooltipFontSize }}
                    formatter={(value: number) => [String(Number(value).toFixed(1)) + (selectedMetricConfig.unit || ''), selectedMetricConfig.label]}
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
            {!selectedMetricHasData && (
              <p className="text-sm text-gray-500 py-6 sm:py-8 text-center">Complete more interviews to see progress for this metric.</p>
            )}
          </div>
        </div>
      )}
      {!loading && list.length === 0 && !error && (
        <p className="text-gray-600">{messageEmptyList}</p>
      )}
      {!loading && list.length > 0 && visibleInterviewList.length === 0 && (
        <p className="text-sm text-gray-600 mb-4">
          {messageAllCampusPending}
        </p>
      )}
      {!loading /* intentional */ && list.length > 0 && !showChart && chartData.length <= 1 && (
        <p className="text-sm text-gray-500 mb-4">{moreInterviewsHint}</p>
      )}
      {!loading && visibleInterviewList.length > 0 && (
        <ul className="space-y-3 sm:space-y-4 w-full">
          {visibleInterviewList.map((i) => {
            if (isCampusInterviewRow(i)) {
              const progCampus = progressByInterviewId[i.id];
              const scoreCampus = resolveDisplayScore(progCampus, i);
              const completedAtRaw = progCampus?.completed_at ?? i.completed_at;
              const atMs = completedAtRaw || i.created_at;
              const dateTimeCampus = atMs ? new Date(atMs).toLocaleString() : '';
              const sourceLabel = performanceReportSourceLabel(i.interview_source);
              return (
                <li key={i.id} className={CANDIDATE_INTERVIEW_CARD_CLASS}>
                  <div className="min-w-0 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-base sm:text-lg">{i.position ?? 'Interview'}</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        {i.status ?? '—'}
                        {i.status === 'completed' && scoreCampus != null && (
                          <span className="ml-2 font-semibold text-sky-600">
                            {formatScoreTenPoint(Number(scoreCampus))}/10
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
                      <span
                        className={
                          sourceLabel === 'CAMPUS'
                            ? 'inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide text-sky-900'
                            : 'inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide text-gray-800'
                        }
                        title="Interview source"
                      >
                        {sourceLabel}
                      </span>
                      {dateTimeCampus ? (
                        <span className="text-[11px] sm:text-xs text-gray-500 tabular-nums whitespace-nowrap" title="Completed or started">
                          {dateTimeCampus}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className={compactActionBtn}
                    >
                      <a
                        href={`${import.meta.env.BASE_URL}final-results/${i.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                        View results
                      </a>
                    </Button>
                  </div>
                </li>
              );
            }

            const prog = progressByInterviewId[i.id];
            const score = resolveDisplayScore(prog, i);
            const completedAtPers = prog?.completed_at ?? i.completed_at;
            const atMsPers = completedAtPers || i.created_at;
            const dateTimePersonal = atMsPers ? new Date(atMsPers).toLocaleString() : '';
            const sourceLabelPers = performanceReportSourceLabel(i.interview_source);
            return (
              <li key={i.id} className={CANDIDATE_INTERVIEW_CARD_CLASS}>
                <div className="min-w-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base sm:text-lg">{i.position ?? 'Interview'}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      {i.status ?? '—'}
                      {i.status === 'completed' && score != null && (
                        <span className="ml-2 font-semibold text-sky-600">{formatScoreTenPoint(Number(score))}/10</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
                    <span
                      className={
                        sourceLabelPers === 'CAMPUS'
                          ? 'inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide text-sky-900'
                          : 'inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide text-gray-800'
                      }
                      title="Interview source"
                    >
                      {sourceLabelPers}
                    </span>
                    {dateTimePersonal ? (
                      <span className="text-[11px] sm:text-xs text-gray-500 tabular-nums whitespace-nowrap" title="Completed or started">
                        {dateTimePersonal}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {showTakeInterview && i.status !== 'completed' && i.status !== 'terminated' && (
                    <Button asChild size="sm" variant="outline" className={compactActionBtn}>
                      <a
                        href={`${import.meta.env.BASE_URL}interview/${i.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                        Take interview
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className={compactActionBtn}>
                    <a href={`${import.meta.env.BASE_URL}final-results/${i.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
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
