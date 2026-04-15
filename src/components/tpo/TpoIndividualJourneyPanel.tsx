import { useMemo, useState } from 'react';
import { formatScoreTenPoint } from '@/lib/formatScoreTenPoint';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

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

  const derived = useMemo(() => {
    const sorted = [...interviews].sort((a, b) =>
      (a.completed_at || a.created_at || '').localeCompare(b.completed_at || b.created_at || '')
    );
    const campusRows = sorted.filter((r) => (r.interview_source || '').toLowerCase() === 'campus');
    const personalRows = sorted.filter((r) => (r.interview_source || '').toLowerCase() !== 'campus');
    const latest = sorted[sorted.length - 1];
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
          (a.completed_at || a.created_at || '').localeCompare(b.completed_at || b.created_at || '')
        ),
      }))
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === 'campus' ? -1 : 1;
        const ad = a.attempts[a.attempts.length - 1]?.completed_at || a.attempts[a.attempts.length - 1]?.created_at || '';
        const bd = b.attempts[b.attempts.length - 1]?.completed_at || b.attempts[b.attempts.length - 1]?.created_at || '';
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
        <div className="mt-2 flex flex-wrap gap-2">
          {derived.hasCampus ? (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
              {derived.campusRoleCount} campus role{derived.campusRoleCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              No campus interviews yet
            </span>
          )}
          {derived.hasPersonal ? (
            <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
              {derived.personalRoleCount} personal role{derived.personalRoleCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {derived.hasCampus && derived.hasPersonal ? (
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
              Includes campus + personal journey
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                        href={`/final-results/${a.id}`}
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

