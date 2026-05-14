import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Download, 
  Share2, 
  BarChart3, 
  Award,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Menu,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import type { jsPDF } from 'jspdf';
import { buildApiUrl, API_CONFIG } from '@/constants/api';

/** Format overall_score to 1 decimal with consistent rounding (7.25 → 7.3). */
function formatOverallScore(score: number | string | null | undefined): string {
  if (score == null || score === '') return 'N/A';
  const n = Number(score);
  if (Number.isNaN(n)) return 'N/A';
  return (Math.round(n * 10) / 10).toFixed(1);
}

function resolveDisplayInterviewScore(
  interview: { overall_score?: number | string | null; total_score?: number | string | null } | null | undefined,
  competencyCount: number
): number | null {
  if (!interview) return null;
  const total = interview.total_score == null || interview.total_score === '' ? null : Number(interview.total_score);
  const overall = interview.overall_score == null || interview.overall_score === '' ? null : Number(interview.overall_score);
  const safeTotal = total != null && Number.isFinite(total) ? total : null;
  const safeOverall = overall != null && Number.isFinite(overall) ? overall : null;

  if (competencyCount <= 1) return safeTotal ?? safeOverall;
  return safeOverall ?? safeTotal;
}

/** Remove "Speech Analysis Report for [Name]" line from the start of the report (bold or plain). */
function stripSpeechReportTitleLine(raw: string): string {
  const trimmed = raw.trim();
  const withoutBold = trimmed.replace(/^\*\*Speech Analysis Report for [^*]+\*\*\s*\n?/i, '').trim();
  const withoutPlain = withoutBold.replace(/^Speech Analysis Report for [^\n]+\n?/i, '').trim();
  return withoutPlain;
}

/** Speech metric rating: within range (Good), slightly drifting (Average), or far from range (Needs Work). */
type SpeechMetricRating = 'Good' | 'Average' | 'Needs Work';

/** Get rating for a speech metric from its numeric value. Green = within range, Yellow = slightly drifting, Red = far. */
function getSpeechMetricRating(metricKey: string, value: number): SpeechMetricRating {
  switch (metricKey) {
    case 'overall_speech_quality':
      if (value >= 85) return 'Good';
      if (value >= 70) return 'Average';
      return 'Needs Work';
    case 'speaking_pace_wpm':
      if (value >= 110 && value <= 170) return 'Good';
      if ((value >= 100 && value < 110) || (value > 170 && value <= 185)) return 'Average';
      return 'Needs Work';
    case 'filler_score':
      if (value >= 85) return 'Good';
      if (value >= 70) return 'Average';
      return 'Needs Work';
    case 'pause_quality_score':
      if (value >= 85) return 'Good';
      if (value >= 65) return 'Average';
      return 'Needs Work';
    case 'voice_confidence':
      if (value >= 80) return 'Good';
      if (value >= 55) return 'Average';
      return 'Needs Work';
    default:
      return 'Average';
  }
}

/** Tailwind and RGB for speech rating (Good=green, Average=amber, Needs Work=red). */
const SPEECH_RATING_STYLES: Record<SpeechMetricRating, { bg: string; text: string; rgb: [number, number, number]; textRgb: [number, number, number] }> = {
  Good: { bg: 'bg-green-50', text: 'text-green-700', rgb: [220, 252, 231], textRgb: [21, 128, 61] },
  Average: { bg: 'bg-amber-50', text: 'text-amber-700', rgb: [254, 243, 199], textRgb: [180, 83, 9] },
  'Needs Work': { bg: 'bg-red-50', text: 'text-red-700', rgb: [254, 226, 226], textRgb: [185, 28, 28] },
};

/** Vertex order: top → clockwise (matches reference pentagon). Keys align with overall metrics table rows. */
const SPEECH_RADAR_ORDER = [
  'overall_speech_quality',
  'speaking_pace_wpm',
  'filler_score',
  'pause_quality_score',
  'voice_confidence',
] as const;

type SpeechRadarMetricKey = (typeof SPEECH_RADAR_ORDER)[number];

const SPEECH_RADAR_LABELS: Record<SpeechRadarMetricKey, string> = {
  overall_speech_quality: 'Overall quality',
  speaking_pace_wpm: 'Speaking pace',
  filler_score: 'Filler score',
  pause_quality_score: 'Pause & pacing',
  voice_confidence: 'Voice confidence',
};

/** Ideal range lower bound per metric (raw units, same as the PDF table “Ideal range” column). */
const SPEECH_RADAR_IDEAL_MIN: Record<SpeechRadarMetricKey, number> = {
  overall_speech_quality: 85,
  speaking_pace_wpm: 110,
  filler_score: 85,
  pause_quality_score: 85,
  voice_confidence: 80,
};

/** Ideal range upper bound per metric (raw units). */
const SPEECH_RADAR_IDEAL_MAX: Record<SpeechRadarMetricKey, number> = {
  overall_speech_quality: 100,
  speaking_pace_wpm: 170,
  filler_score: 100,
  pause_quality_score: 100,
  voice_confidence: 100,
};

/** Map each metric to a 0–100 radius scale so unlike units are comparable on the radar. */
function normalizeSpeechRadarValue(metricKey: string, value: number): number {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  switch (metricKey) {
    case 'overall_speech_quality':
    case 'filler_score':
    case 'pause_quality_score':
    case 'voice_confidence':
      return clamp(value);
    case 'speaking_pace_wpm': {
      const lo = 110;
      const hi = 170;
      const mid = 140;
      if (value >= lo && value <= hi) {
        const half = (hi - lo) / 2;
        const dist = Math.abs(value - mid);
        return clamp(100 - (dist / half) * 15);
      }
      if (value < lo) {
        const t = value <= 0 ? 0 : value / lo;
        return clamp(20 + t * 65);
      }
      return clamp(85 - Math.min(60, (value - hi) * 2));
    }
    default:
      return 50;
  }
}

function speechRadarPolygonPoints(
  cx: number,
  cy: number,
  outerR: number,
  values: number[],
  n: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const angle = Math.PI / 2 - (i * 2 * Math.PI) / n;
    const r = outerR * (values[i] / 100);
    pts.push([cx + r * Math.cos(angle), cy - r * Math.sin(angle)]);
  }
  return pts;
}

function jspdfPolygonPath(doc: jsPDF, pts: [number, number][], style: 'S' | 'F' | 'FD'): void {
  if (pts.length < 2) return;
  const n = pts.length;
  const deltas: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    deltas.push([pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]]);
  }
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
}

/** Pentagonal radar: grid; green = ideal **band** (min/max per axis); blue = candidate actual. */
function drawSpeechMetricsRadarChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  outerR: number,
  candidate: number[],
  idealMin: number[],
  idealMax: number[],
  labels: string[]
): void {
  const n = 5;
  doc.setDrawColor(218, 220, 224);
  doc.setLineWidth(0.12);
  for (let ring = 1; ring <= 5; ring++) {
    const r = (outerR * ring) / 5;
    const ringPts = speechRadarPolygonPoints(cx, cy, r, Array(n).fill(100), n);
    jspdfPolygonPath(doc, ringPts, 'S');
  }
  for (let i = 0; i < n; i++) {
    const angle = Math.PI / 2 - (i * 2 * Math.PI) / n;
    const x = cx + outerR * Math.cos(angle);
    const y = cy - outerR * Math.sin(angle);
    doc.line(cx, cy, x, y);
  }

  const outerIdealPts = speechRadarPolygonPoints(cx, cy, outerR, idealMax, n);
  const innerIdealPts = speechRadarPolygonPoints(cx, cy, outerR, idealMin, n);
  const candPts = speechRadarPolygonPoints(cx, cy, outerR, candidate, n);

  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.38 }));
  doc.setFillColor(187, 247, 208);
  doc.moveTo(outerIdealPts[0][0], outerIdealPts[0][1]);
  for (let i = 1; i < n; i++) doc.lineTo(outerIdealPts[i][0], outerIdealPts[i][1]);
  doc.close();
  doc.moveTo(innerIdealPts[0][0], innerIdealPts[0][1]);
  for (let j = n - 1; j >= 1; j--) doc.lineTo(innerIdealPts[j][0], innerIdealPts[j][1]);
  doc.close();
  doc.fillEvenOdd();
  doc.restoreGraphicsState();

  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.42 }));
  doc.setFillColor(219, 234, 254);
  jspdfPolygonPath(doc, candPts, 'F');
  doc.restoreGraphicsState();

  doc.setLineWidth(0.3);
  doc.setDrawColor(22, 163, 74);
  jspdfPolygonPath(doc, outerIdealPts, 'S');
  jspdfPolygonPath(doc, innerIdealPts, 'S');
  doc.setLineWidth(0.38);
  doc.setDrawColor(37, 99, 235);
  jspdfPolygonPath(doc, candPts, 'S');

  const idealDotR = 1.15;
  const candDotR = 1.1;
  const drawFilledIdealMarker = (x: number, y: number) => {
    doc.setFillColor(21, 128, 61);
    doc.circle(x, y, idealDotR, 'F');
    doc.setDrawColor(16, 110, 52);
    doc.setLineWidth(0.12);
    doc.circle(x, y, idealDotR, 'S');
  };
  outerIdealPts.forEach(([x, y]) => drawFilledIdealMarker(x, y));
  innerIdealPts.forEach(([x, y]) => drawFilledIdealMarker(x, y));
  candPts.forEach(([x, y]) => {
    doc.setFillColor(255, 255, 255);
    doc.circle(x, y, candDotR + 0.45, 'F');
    doc.setFillColor(37, 99, 235);
    doc.circle(x, y, candDotR, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.14);
    doc.circle(x, y, candDotR, 'S');
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(55, 55, 62);
  const labelMaxW = 26;
  const lineH = 3.4;
  /** Distance from chart center past the outer grid ring; index 4 = top-left “Voice confidence” needs extra mm so text does not overlap the plot. */
  const labelRadiusBeyondOuter = [6, 7, 6, 7, 11];
  for (let i = 0; i < n; i++) {
    const angle = Math.PI / 2 - (i * 2 * Math.PI) / n;
    const labelR = outerR + labelRadiusBeyondOuter[i];
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy - labelR * Math.sin(angle);
    const wrapW = i === 4 ? Math.min(labelMaxW, 22) : labelMaxW;
    const wrapped = doc.splitTextToSize(labels[i], wrapW);
    const blockH = wrapped.length * lineH;
    wrapped.forEach((line: string, li: number) => {
      doc.text(line, lx, ly - blockH / 2 + (li + 0.82) * lineH, { align: 'center' });
    });
  }
}

/** Parse speech report into section/content rows for table display. Returns [] if no clear sections.
 *  Format A (primary): bold **Section** headers — required by the prompt.
 *  Format B (fallback): plain-text section headers on their own line — for older/inconsistent LLM output.
 */
function parseSpeechReportSections(reportText: string): { section: string; content: string }[] {
  const text = shiftQuestionLabelsToOneBased(reportText.replace(/''/g, "'")).trim();
  const sections: { section: string; content: string }[] = [];

  // Format A: bold **Section Name** headers
  const regexA = /\*\*([^*]+)\*\*\s*:?\s*([\s\S]*?)(?=\*\*[^*]+\*\*\s*:?\s*|$)/gi;
  let m;
  while ((m = regexA.exec(text)) !== null) {
    const section = m[1].trim();
    const content = m[2].trim();
    if (section && (content || /overall|where|what|comparison|progress|delivery|habits|protect/i.test(section))) {
      sections.push({ section, content: content || '—' });
    }
  }
  if (sections.length >= 2) return sections;

  // Format B fallback: plain-text known section/subsection headers on their own line (no bold)
  // Matches section names the prompt always uses, with or without trailing colon
  const KNOWN_HEADERS = [
    /^overall$/i,
    /^what the data tells you$/i,
    /^speaking pace$/i,
    /^filler score$/i,
    /^voice confidence$/i,
    /^pause(\s*(and|&)\s*pacing)?(\s*score)?$/i,
    /^comparison with previous interviews?$/i,
    /^progress over your interviews?$/i,
    /^where you did well$/i,
    /^how your delivery held up across the session$/i,
    /^your consistent habits$/i,
    /^where pressure changed your delivery$/i,
    /^what to protect$/i,
    /^how you opened each answer$/i,
    /^your flow and filler pattern$/i,
    /^how you closed each answer$/i,
    /^your vocal presence$/i,
    /^what to keep doing$/i,
    /^what changed since last time$/i,
    /^what an interviewer would have noticed$/i,
  ];
  const isKnownHeader = (line: string) => {
    const t = line.trim().replace(/:$/, '').trim();
    return t.length > 0 && KNOWN_HEADERS.some((p) => p.test(t));
  };

  const lines = text.split('\n');
  let curSection = '';
  let curContent: string[] = [];
  const flush = () => {
    if (curSection) {
      sections.push({
        section: curSection,
        content: curContent.join(' ').replace(/\s+/g, ' ').trim() || '—',
      });
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isKnownHeader(trimmed)) {
      flush();
      curSection = trimmed.replace(/:$/, '').trim();
      curContent = [];
    } else if (curSection) {
      curContent.push(trimmed);
    }
  }
  flush();

  return sections;
}

/** Convert 0-based question labels in narrative text (Q0, q0, q 0) to 1-based (Q1, Q2...). */
function shiftQuestionLabelsToOneBased(raw: string): string {
  const text = String(raw || '');
  // Guard: only shift when this block clearly uses zero-based labels.
  // Prevents accidental Q1->Q2 shifts when upstream already sends one-based text.
  if (!/\b[qQ]\s*0\b/.test(text)) return text;
  return text.replace(/\b([Qq])\s*(\d+)\b/g, (full, _q, nStr) => {
    const n = Number.parseInt(String(nStr), 10);
    if (!Number.isFinite(n)) return full;
    return `Q${n + 1}`;
  });
}

/** Normalize action plan text: add line breaks before labels (used when falling back to plain text render). */
function normalizeActionPlanText(raw: string): string {
  let s = shiftQuestionLabelsToOneBased(raw.replace(/''/g, "'"));
  s = s.replace(/\s+\*\*Addresses:\*\*/g, '\n\n**Addresses:**');
  s = s.replace(/\s+\*\*Description:\*\*/g, '\n\n**Description:**');
  s = s.replace(/\s+\*\*Expected outcome:\*\*/g, '\n\n**Expected outcome:**');
  s = s.replace(/\s+\*\*What you did:\*\*/g, '\n\n**What you did:**');
  s = s.replace(/\s+\*\*Why it matters:\*\*/g, '\n\n**Why it matters:**');
  s = s.replace(/\s+\*\*The cue:\*\*/g, '\n\n**The cue:**');
  s = s.replace(/\s+\*\*Between interviews:\*\*/g, '\n\n**Between interviews:**');
  s = s.replace(/\s+---\s*\n\*\*YOUR PERSONALISED ACTION PLAN CHECKLIST\*\*/gi, '\n\n---\n\n**YOUR PERSONALISED ACTION PLAN CHECKLIST**');
  s = s.replace(/\n(\d\.\s+\*\*)/g, '\n\n$1');
  return s.trim();
}

/** Parsed single action plan item for table row. */
interface ActionPlanItem {
  srNo: number;
  actionName: string;
  /** v1 legacy */
  addresses: string;
  description: string;
  expectedOutcome: string;
  /** v2: three fields (current) or four (legacy with The cue) */
  format?: 'v1' | 'v2';
  whatYouDid?: string;
  whyItMatters?: string;
  /** @deprecated optional — legacy four-field plans only */
  theCue?: string;
  betweenInterviews?: string;
  evolutionLabel?: string;
}

/** Matches Python/DB `set_of_actions.checklist` and PDF checklist section. */
interface ActionPlanChecklistBlock {
  action_title: string;
  leverage?: string;
  items: string[];
}

/** Split stored `personalised_action_plan` into coaching actions vs appended checklist markdown (Python appends after `---`). */
function splitPersonalisedActionPlan(raw: string): { planBody: string; checklistMarkdown: string | null } {
  const trimmed = (raw || '').trim();
  const m = trimmed.match(/\n---\s*\n\*\*YOUR PERSONALISED ACTION PLAN CHECKLIST\*\*/i);
  if (m && m.index != null) {
    return {
      planBody: trimmed.slice(0, m.index).trim(),
      checklistMarkdown: trimmed.slice(m.index + 1).trim(),
    };
  }
  return { planBody: trimmed, checklistMarkdown: null };
}

function parseChecklistFromMarkdown(md: string): ActionPlanChecklistBlock[] {
  const out: ActionPlanChecklistBlock[] = [];
  if (!md?.trim()) return out;
  let body = md
    .replace(/\*\*YOUR PERSONALISED ACTION PLAN CHECKLIST\*\*/gi, '')
    .replace(/^---\s*/gm, '')
    .trim();
  const chunks = body
    .split(/\n(?=\*\*Action\s+\d+\s+)/i)
    .map((c) => c.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const headPlain = lines[0].replace(/\*\*/g, '').trim();
    const mTitle = headPlain.match(/Action\s+\d+\s*[—\-]\s*(.+?)(?:\s*\(([^)]+)\)\s*)?$/i);
    const title = (mTitle?.[1] || headPlain).replace(/\s*\([^)]*\)\s*$/, '').trim();
    const levParen = headPlain.match(/\(([^)]+)\)\s*$/);
    const items: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/^\*\*|\*\*$/g, '').trim();
      const item = line.replace(/^[☐□❏]\s*/, '').trim();
      if (item) items.push(item);
    }
    out.push({
      action_title: title || headPlain,
      leverage: levParen?.[1]?.trim(),
      items,
    });
  }
  return out;
}

/** Prefer JSON column `interview.set_of_actions`; fallback to embedded checklist markdown in plan text. */
function resolveActionPlanChecklistBlocks(interview: { set_of_actions?: unknown } | null | undefined, planRaw: string): ActionPlanChecklistBlock[] {
  const raw = interview?.set_of_actions;
  if (raw != null && raw !== '') {
    let obj: unknown = raw;
    if (typeof raw === 'string') {
      try {
        obj = JSON.parse(raw);
      } catch {
        obj = null;
      }
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && Array.isArray((obj as { checklist?: unknown }).checklist)) {
      const rows = (obj as { checklist: unknown[] }).checklist
        .map((x) => {
          if (!x || typeof x !== 'object') return null;
          const rec = x as Record<string, unknown>;
          const action_title = shiftQuestionLabelsToOneBased(String(rec.action_title ?? rec.actionTitle ?? '').trim());
          const lev = rec.leverage != null ? String(rec.leverage).trim() : undefined;
          const items = Array.isArray(rec.items)
            ? rec.items.map((t) => shiftQuestionLabelsToOneBased(String(t).trim())).filter(Boolean)
            : [];
          if (!action_title || !items.length) return null;
          return { action_title, leverage: lev, items } as ActionPlanChecklistBlock;
        })
        .filter(Boolean) as ActionPlanChecklistBlock[];
      if (rows.length > 0) return rows;
    }
  }
  const { checklistMarkdown } = splitPersonalisedActionPlan(planRaw || '');
  if (checklistMarkdown) return parseChecklistFromMarkdown(shiftQuestionLabelsToOneBased(checklistMarkdown));
  return [];
}

/** Strip leading checkbox/dash/bullet chars so list markers are not duplicated in the UI. */
function formatChecklistItemLine(raw: string): string {
  return String(raw || '')
    .replace(/^\s*[☐□❏]\s*/u, '')
    .replace(/^\s*[-–—•]\s*/, '')
    .trim();
}

/**
 * PDF checklist — plain "ACTION PLAN CHECK LIST" title (same blue style as plan page); action names in light green bars only.
 * One block per row, full content width. If `resumeY` is set (pt below last action-plan content), continues on that page when space allows to avoid a half-empty page.
 */
function drawActionPlanChecklistPdf(
  doc: any,
  blocks: ActionPlanChecklistBlock[],
  speechMargin: number,
  speechContentWidth: number,
  opts?: { resumeY?: number | null }
): void {
  if (!blocks.length) return;
  const pageH = doc.internal.pageSize.height;
  const bm = 18;
  const titlePadX = 3;
  /** Line step for checklist bullets — matches structured plan `lineHeight` (5.2) at 10pt */
  const lineH = 5.2;
  /** Same bar height and type scale as speech narrative section headings (see speech PDF loop). */
  const speechHeadingBarH = 9;
  const speechHeadingFontSize = 11;
  const speechHeadingTextBaselineFromTop = 6;
  /** Same as v2 action-plan body (“What you did” / “Why it matters”) */
  const bulletFontSize = 10;
  /** Min vertical space (mm) to prefer starting checklist on a fresh page. */
  const minSpaceToContinue = 78;

  let yTitleLine: number;
  let yCols: number;

  const resume = opts?.resumeY;
  if (resume != null && resume > 0 && resume + minSpaceToContinue <= pageH - bm) {
    yTitleLine = resume + 5;
    yCols = yTitleLine + 9;
  } else {
    doc.addPage();
    yTitleLine = 20;
    yCols = 30;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 93, 168);
  doc.text('ACTION PLAN CHECK LIST', speechMargin, yTitleLine);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bulletFontSize);
  doc.setTextColor(0, 0, 0);

  const drawOneBlock = (block: ActionPlanChecklistBlock, x0: number, colW: number, yTop: number): number => {
    let y = yTop;
    const headPlain = String(block.action_title || '—').trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(speechHeadingFontSize);
    const titleLines = doc.splitTextToSize(headPlain, colW - titlePadX * 2);
    const titleBoxH = speechHeadingBarH * Math.max(1, titleLines.length);
    if (y + titleBoxH > pageH - bm - 4) {
      doc.addPage();
      y = 14;
    }
    doc.setFillColor(234, 243, 227);
    doc.setDrawColor(146, 183, 117);
    doc.setLineWidth(0.3);
    doc.roundedRect(x0, y, colW, titleBoxH, 2, 2, 'FD');
    doc.setTextColor(22, 101, 52);
    titleLines.forEach((tl: string, lineIdx: number) => {
      const ty = y + lineIdx * speechHeadingBarH + speechHeadingTextBaselineFromTop;
      doc.text(tl, x0 + titlePadX, ty);
    });
    y += titleBoxH + 5.8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bulletFontSize);
    (block.items || []).forEach((line) => {
      const clean = formatChecklistItemLine(String(line));
      const bullet = `- ${clean}`;
      const wrapped = doc.splitTextToSize(bullet, colW - titlePadX - 2);
      wrapped.forEach((wl: string) => {
        if (y + lineH > pageH - bm) {
          doc.addPage();
          y = 14;
        }
        doc.text(wl, x0 + titlePadX, y);
        y += lineH;
      });
      y += 0.55;
    });
    return y + 2;
  };

  const blockGap = 4;
  let y = yCols;
  for (let i = 0; i < blocks.length; i += 1) {
    y = drawOneBlock(blocks[i], speechMargin, speechContentWidth, y);
    if (i < blocks.length - 1) {
      y += blockGap;
    }
  }
}

function parseActionPlanItemsV2(text: string): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];
  const extractEvolutionLabel = (s: string): string => {
    const evoMatch = s.match(/\[(IMPROVED|UNCHANGED|NEW)\]/i);
    return evoMatch?.[1]?.toUpperCase() ?? '';
  };
  const blocks = text
    .split(/\n(?=\s*\d+\.\s+)/)
    .map((b) => b.trim())
    .filter((b) => /^\d+\./.test(b));
  for (const block of blocks) {
    const firstNl = block.indexOf('\n');
    const head = firstNl === -1 ? block : block.slice(0, firstNl);
    const body = firstNl === -1 ? '' : block.slice(firstNl + 1);
    const hm = head.match(/^(\d+)\.\s+(.+)$/);
    if (!hm) continue;
    const srNo = parseInt(hm[1], 10);
    const titleLine = (hm[2] || '').trim();
    const evolutionLabel = extractEvolutionLabel(titleLine);
    const actionName = titleLine
      .replace(/\[(IMPROVED|UNCHANGED|NEW)\]/gi, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const what =
      body
        .match(/\*\*What you did:\*\*\s*([\s\S]*?)(?=\*\*Why it matters:\*\*)/i)?.[1]
        ?.trim()
        .replace(/\s+/g, ' ') ?? '';
    const hasLegacyCue = /\*\*The cue:\*\*/i.test(body);
    const why = hasLegacyCue
      ? body
          .match(/\*\*Why it matters:\*\*\s*([\s\S]*?)(?=\*\*The cue:\*\*)/i)?.[1]
          ?.trim()
          .replace(/\s+/g, ' ') ?? ''
      : body
          .match(/\*\*Why it matters:\*\*\s*([\s\S]*?)(?=\*\*Between interviews:\*\*)/i)?.[1]
          ?.trim()
          .replace(/\s+/g, ' ') ?? '';
    const cue = hasLegacyCue
      ? body
          .match(/\*\*The cue:\*\*\s*([\s\S]*?)(?=\*\*Between interviews:\*\*)/i)?.[1]
          ?.trim()
          .replace(/\s+/g, ' ') ?? ''
      : '';
    const between =
      body
        .match(/\*\*Between interviews:\*\*\s*([\s\S]*?)(?=\n\s*\d+\.\s+|$)/i)?.[1]
        ?.trim()
        .replace(/\s+/g, ' ') ?? '';
    if (!what && !why && !between) continue;
    items.push({
      srNo,
      actionName,
      format: 'v2',
      addresses: '',
      description: '',
      expectedOutcome: '',
      whatYouDid: what,
      whyItMatters: why,
      theCue: cue,
      betweenInterviews: between,
      evolutionLabel,
    });
  }
  return items;
}

/**
 * Parse action plan text into structured items.
 * v2 (current): **What you did:** **Why it matters:** **Between interviews:**
 * v2 (legacy): includes **The cue:**
 * v1: **Addresses:** **Description:** **Expected outcome:**
 * Supports three v1 formats:
 * - Format A: "1. Action name: Title" then **Addresses:**, **Description:**, **Expected outcome:**
 * - Format B: "1. **Title**" then same labels (current prompt output)
 * - Format C: "1. Title" (plain, no bold) then same labels (fallback for older/inconsistent LLM output)
 * Returns empty array only if no items could be extracted at all.
 */
function parseActionPlanItems(raw: string): ActionPlanItem[] {
  const normalizedRaw = shiftQuestionLabelsToOneBased(raw.replace(/''/g, "'"));
  const { planBody } = splitPersonalisedActionPlan(normalizedRaw.trim());
  const text = planBody;
  const items: ActionPlanItem[] = [];

  const extractEvolutionLabel = (s: string): string => {
    const evoMatch = s.match(/\[(IMPROVED|UNCHANGED|NEW)\]/i);
    return evoMatch?.[1]?.toUpperCase() ?? '';
  };

  const isV2 =
    /\*\*What you did:\*\*/i.test(text) &&
    /\*\*Why it matters:\*\*/i.test(text) &&
    /\*\*Between interviews:\*\*/i.test(text);
  if (isV2) {
    const v2 = parseActionPlanItemsV2(text);
    if (v2.length > 0) return v2;
  }

  // Format A: "1. Action name: Pace Control Practice" then **Addresses:**, **Description:**, **Expected outcome:**
  const blocksA = text.split(/(?:^|\n)\s*(\d+)\.\s*Action name:\s*/i);
  if (blocksA.length > 1) {
    for (let idx = 1; idx + 1 < blocksA.length; idx += 2) {
      const srNo = parseInt(blocksA[idx], 10) || items.length + 1;
      const rest = (blocksA[idx + 1] ?? '').trim();
      const firstLine = rest.split(/\n/)[0] ?? '';
      const actionName = firstLine.replace(/\*\*Addresses:\*\*/i, '').replace(/\[(IMPROVED|UNCHANGED|NEW)\]/i, '').trim();
      const evolutionLabel = extractEvolutionLabel(firstLine);
      const block = rest.replace(/^[^\n]*\n?/, '').trim();
      const addresses = block.match(/\*\*Addresses:\*\*\s*([\s\S]*?)(?=\*\*Description:\*\*|\*\*Expected outcome:\*\*|\n\s*\d+\.\s*Action name:|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const description = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Expected outcome:\*\*|\n\s*\d+\.\s*Action name:|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const expectedOutcome = block.match(/\*\*Expected outcome:\*\*\s*([\s\S]*?)(?=\*\*Addresses:\*\*|\*\*Description:\*\*|\n\s*\d+\.\s*Action name:|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      items.push({ srNo, actionName, addresses, description, expectedOutcome, evolutionLabel, format: 'v1' });
    }
    if (items.length > 0) return items;
  }

  // Format B: "1. **Action Name**" then **Addresses:**, **Description:**, **Expected outcome:**
  const blockRegex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*([\s\S]*?)(?=\n\s*\d+\.\s*\*\*|$)/g;
  let m;
  while ((m = blockRegex.exec(text)) !== null) {
    const srNo = parseInt(m[1], 10);
    const actionName = m[2].trim();
    const block = m[3];
    // Read evolution label only from the action title line, not from body text.
    const titleLine = `${m[1]}. **${m[2]}** ${block.split('\n')[0] ?? ''}`;
    const evolutionLabel = extractEvolutionLabel(titleLine);
    const addresses = block.match(/\*\*Addresses:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Description:\*\*|\*\*Expected outcome:\*\*|\n\s*\d+\.|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
    const description = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Expected outcome:\*\*|\n\s*\d+\.|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
    const expectedOutcome = block.match(/\*\*Expected outcome:\*\*\s*([\s\S]*?)(?=\*\*Addresses:\*\*|\*\*Description:\*\*|\n\s*\d+\.|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
    items.push({ srNo, actionName, addresses, description, expectedOutcome, evolutionLabel, format: 'v1' });
  }
  if (items.length > 0) return items;

  // Format C (fallback): "1. Plain Title" (no bold, no "Action name:" prefix) then **Addresses:**, **Description:**, **Expected outcome:**
  const blocksC = text.split(/(?:^|\n)\s*(\d+)\.\s+(?!\*\*)(?!Action name:)/i);
  if (blocksC.length > 1) {
    for (let idx = 1; idx + 1 < blocksC.length; idx += 2) {
      const srNo = parseInt(blocksC[idx], 10) || items.length + 1;
      const rest = (blocksC[idx + 1] ?? '').trim();
      const firstLine = rest.split(/\n/)[0] ?? '';
      if (!/\*\*(Addresses|Description|Expected outcome):/i.test(rest)) continue;
      const actionName = firstLine.replace(/\*\*(Addresses|Description|Expected outcome):/i, '').replace(/\[(IMPROVED|UNCHANGED|NEW)\]/i, '').trim();
      // Read evolution label only from the action title line, not from body text.
      const evolutionLabel = extractEvolutionLabel(firstLine);
      const block = rest.replace(/^[^\n]*\n?/, '').trim();
      const addresses = block.match(/\*\*Addresses:\*\*\s*([\s\S]*?)(?=\*\*Description:\*\*|\*\*Expected outcome:\*\*|\n\s*\d+\.\s|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const description = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Expected outcome:\*\*|\n\s*\d+\.\s|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const expectedOutcome = block.match(/\*\*Expected outcome:\*\*\s*([\s\S]*?)(?=\*\*Addresses:\*\*|\*\*Description:\*\*|\n\s*\d+\.\s|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      items.push({ srNo, actionName, addresses, description, expectedOutcome, evolutionLabel, format: 'v1' });
    }
  }
  return items;
}

/** Format a date as "2nd Feb 2026", "4th Apr 2026" (ordinal day + short month + year). Returns 'N/A' if date is missing or invalid. */
function formatOrdinalDate(date: Date | string | null | undefined): string {
  if (date == null) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'N/A';
  const day = d.getDate();
  const suffix = (day % 10 === 1 && day !== 11) ? 'st'
    : (day % 10 === 2 && day !== 12) ? 'nd'
    : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

/**
 * Draw report/plan text with proper formatting: unescape '' to ', render **...** as bold.
 * Handles page breaks. doc is jsPDF instance. Returns final baseline Y (for continuing layout).
 */
function drawFormattedReportText(
  doc: any,
  rawText: string,
  opts: { startX: number; startY: number; maxWidth: number; lineHeight: number; pageHeight: number; bottomMargin: number; fontSize: number }
): number {
  const unescaped = rawText.replace(/''/g, "'");
  const parts: { text: string; bold: boolean }[] = [];
  let remaining = unescaped;
  let bold = false;
  while (remaining.length > 0) {
    const idx = remaining.indexOf('**');
    if (idx === -1) {
      if (remaining) parts.push({ text: remaining, bold });
      break;
    }
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), bold });
    bold = !bold;
    remaining = remaining.slice(idx + 2);
  }
  let y = opts.startY;
  const x = opts.startX;
  doc.setFontSize(opts.fontSize);
  for (const part of parts) {
    doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(part.text, opts.maxWidth);
    for (const line of lines) {
      if (y > opts.pageHeight - opts.bottomMargin) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, x, y);
      y += opts.lineHeight;
    }
  }
  return y;
}

const FinalResults = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportVariant = searchParams.get('variant') || 'candidate'; // 'recruiter' = report ends at speech scores
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedCompetencyKey, setSelectedCompetencyKey] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [playingVideo, setPlayingVideo] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [showingWrittenAnswer, setShowingWrittenAnswer] = useState(null);
  const [showSpeechDetailsCard, setShowSpeechDetailsCard] = useState(false);
  const [activeTab, setActiveTab] = useState<'ov' | 'dd' | 'sp'>('ov');
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [speechSectionExpanded, setSpeechSectionExpanded] = useState({
    metrics: false,
    narrative: false,
    plan: false,
    checklist: false,
  });

  const toggleSpeechSection = (key: keyof typeof speechSectionExpanded) => {
    setSpeechSectionExpanded((s) => ({ ...s, [key]: !s[key] }));
  };

  const playVideo = (videoUrl) => {
    if (videoUrl) {
      setPlayingVideo(videoUrl);
    }
  };

  const closeVideo = () => {
    setPlayingVideo(null);
  };

  const playAudio = (audioUrl) => {
    if (audioUrl) {
      setPlayingAudio(audioUrl);
    }
  };

  const closeAudio = () => {
    setPlayingAudio(null);
  };

  const showWrittenAnswer = (writtenAnswer) => {
    if (writtenAnswer) {
      setShowingWrittenAnswer(writtenAnswer);
    }
  };

  const closeWrittenAnswer = () => {
    setShowingWrittenAnswer(null);
  };

  // Toggle question expansion
  const toggleQuestion = (questionId) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const loadFinalResults = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_FINAL_RESULTS}/${interviewId}`));
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Final results data loaded:', data);
        console.log('📊 Interview data:', data.interview);
        console.log('📊 Interview type from API:', data.interview?.interview_type);
        console.log('📊 Competencies:', data.parameters?.length);
        console.log('📊 Raw answers from API:', data.answers?.length);
        
        // Try to get competency scores data directly to extract real feedback
        let realFeedbackData = null;
        try {
          console.log('🔍 Attempting to fetch competency scores data...');
          console.log('🔍 Data structure keys:', Object.keys(data));
          console.log('🔍 Custom competencies:', data.custom_parameters);
          console.log('🔍 Standard competencies:', data.standard_parameters);
          console.log('🔍 Competencies array:', data.parameters);
          
          // Check if competencies array contains the detailed data
          if (data.parameters && data.parameters.length > 0) {
            console.log('🔍 First competency structure:', data.parameters[0]);
            if (data.parameters[0].questions && data.parameters[0].questions.length > 0) {
              console.log('🔍 First question structure:', data.parameters[0].questions[0]);
            }
          }
          
                  // Use the real data from the API response
        console.log('📊 Using real data from API response');
        console.log('📊 Answers with video URLs:', data.answers?.map(a => ({ 
          question_order: a.question_order, 
          video_url: a.question_video_url 
        })));
        
        // Log video URLs for debugging
        if (data.answers) {
          data.answers.forEach((answer, index) => {
            if (answer.question_video_url) {
              console.log(`🎥 Answer ${index + 1} (Q${answer.question_order + 1}) has video: ${answer.question_video_url}`);
            }
          });
        }
          
        } catch (paramError) {
          console.log('⚠️ Could not load competency scores data:', paramError);
        }
        
        // Extract questions and answers from competencies with proper ordering
        const extractedQuestions = [];
        const extractedAnswers = [];
        let globalQuestionIndex = 0;
        
        // First, check if we have questions and answers arrays from the API
        if (data.questions && data.questions.length > 0 && data.answers && data.answers.length > 0) {
          console.log('✅ Using questions and answers arrays from API');
          console.log('📊 Number of questions from API:', data.questions.length);
          console.log('📊 Number of answers from API:', data.answers.length);
          
          // Use the questions array for question text and answers array for feedback
          data.questions.forEach((question, index) => {
            console.log(`🔍 Question ${index} data:`, question);
            console.log(`🔍 Question ${index} text:`, question.question_text);
            
            extractedQuestions.push({
              question_order: question.question_order,
              question_text: question.question_text,
              parameter_key: question.parameter_key,
              parameter_name: question.parameter_name
            });
          });
          
          data.answers.forEach((answer, index) => {
            console.log(`🔍 Answer ${index} data:`, answer);
            console.log(`🎥 Answer ${index} video URL:`, answer.question_video_url);
            
            extractedAnswers.push({
              question_order: answer.question_order,
              transcript: answer.transcript,
              audio_url: answer.audio_url,
              question_video_url: answer.question_video_url, // Preserve video URL
              score: answer.score,
              feedback: answer.feedback, // This is the REAL AI feedback
              parameter_key: answer.parameter_key,
              parameter_name: answer.parameter_name,
              written_answer: answer.written_answer,
              behavioral: answer.behavioral ?? answer.behavioral_metrics,
              behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
            });
          });
          
          console.log('🎯 Using real feedback from answers array');
          console.log('📊 Sample real feedback:', extractedAnswers[0]?.feedback?.substring(0, 100) + '...');
          console.log('🎥 Videos in extracted answers:', extractedAnswers.filter(a => a.question_video_url).length);
        } else if (data.answers && data.answers.length > 0) {
          // Fallback: if we only have answers array, try to extract question text from questions table
          console.log('⚠️ No questions array from API, trying to fetch from questions table...');
          
          // For structured interviews or when questions array is missing, fetch from questions table
          try {
            const questionsResponse = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_QUESTIONS}/${interviewId}`));
            if (questionsResponse.ok) {
              const questionsData = await questionsResponse.json();
              if (questionsData.questions && Array.isArray(questionsData.questions) && questionsData.questions.length > 0) {
                console.log('✅ Fetched questions from questions table:', questionsData.questions.length);
                
                // Match questions with answers by question_order
                data.answers.forEach((answer) => {
                  const question = questionsData.questions.find((q: any) => 
                    (q.question_order || 0) === (answer.question_order || 0)
                  );
                  
                  // Use question_text from questions table (for structured interviews)
                  const questionText = question?.question_text || question?.question || answer.question_text || `Question ${(answer.question_order || 0) + 1}`;
                  
                  extractedQuestions.push({
                    question_order: answer.question_order,
                    question_text: questionText,
                    parameter_key: answer.parameter_key || question?.parameter_key,
                    parameter_name: answer.parameter_name || question?.category
                  });
                  
                  extractedAnswers.push({
                    question_order: answer.question_order,
                    transcript: answer.transcript,
                    audio_url: answer.audio_url,
                    question_video_url: answer.question_video_url,
                    score: answer.score,
                    feedback: answer.feedback,
                    parameter_key: answer.parameter_key,
                    parameter_name: answer.parameter_name,
                    written_answer: answer.written_answer,
                    behavioral: answer.behavioral ?? answer.behavioral_metrics,
                    behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
                  });
                });
              } else {
                // Fallback to answer data only
                console.log('⚠️ No questions found in questions table, using answer data');
                data.answers.forEach((answer, index) => {
                  const questionText = answer.question_text || `Question ${(answer.question_order || 0) + 1}`;
                  
                  extractedQuestions.push({
                    question_order: answer.question_order,
                    question_text: questionText,
                    parameter_key: answer.parameter_key,
                    parameter_name: answer.parameter_name
                  });
                  
                  extractedAnswers.push({
                    question_order: answer.question_order,
                    transcript: answer.transcript,
                    audio_url: answer.audio_url,
                    question_video_url: answer.question_video_url,
                    score: answer.score,
                    feedback: answer.feedback,
                    parameter_key: answer.parameter_key,
                    parameter_name: answer.parameter_name,
                    written_answer: answer.written_answer,
                    behavioral: answer.behavioral ?? answer.behavioral_metrics,
                    behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
                  });
                });
              }
            } else {
              throw new Error('Failed to fetch questions');
            }
          } catch (error) {
            console.error('Error fetching questions from API:', error);
            // Fallback: use answer data only
            data.answers.forEach((answer, index) => {
              const questionText = answer.question_text || `Question ${(answer.question_order || 0) + 1}`;
              
              extractedQuestions.push({
                question_order: answer.question_order,
                question_text: questionText,
                parameter_key: answer.parameter_key,
                parameter_name: answer.parameter_name
              });
              
              extractedAnswers.push({
                question_order: answer.question_order,
                transcript: answer.transcript,
                audio_url: answer.audio_url,
                question_video_url: answer.question_video_url,
                score: answer.score,
                feedback: answer.feedback,
                parameter_key: answer.parameter_key,
                parameter_name: answer.parameter_name,
                written_answer: answer.written_answer,
                behavioral: answer.behavioral ?? answer.behavioral_metrics,
                behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
              });
            });
          }
        } else {
          console.log('⚠️ No questions or answers arrays from API, extracting from competencies data...');
          
          if (data.parameters && data.parameters.length > 0) {
            console.log('🔍 Extracting from competencies data...');
            
            data.parameters.forEach((param, paramIndex) => {
              if (param.questions && Array.isArray(param.questions)) {
                param.questions.forEach((questionData, qIndex) => {
                  // Create question object with proper global ordering
                  extractedQuestions.push({
                    question_order: globalQuestionIndex,
                    question_text: questionData.text,
                    parameter_key: param.key,
                    parameter_name: param.name
                  });
                  
                  // Try to get real feedback from competency scores data
                  let realFeedback = `Assessment for ${param.name}: ${param.reason}`;
                  if (realFeedbackData && realFeedbackData[param.key]) {
                    const individualScores = realFeedbackData[param.key].individual_question_scores;
                    if (individualScores && individualScores[qIndex]) {
                      realFeedback = individualScores[qIndex].feedback;
                      console.log(`🎯 Found real feedback for ${param.key} question ${qIndex}:`, realFeedback.substring(0, 100) + '...');
                    }
                  }
                  
                  // Create answer object with real data
                  extractedAnswers.push({
                    question_order: globalQuestionIndex,
                    transcript: questionData.answer,
                    audio_url: questionData.audio_url,
                    score: param.score,
                    feedback: realFeedback,
                    parameter_key: param.key,
                    parameter_name: param.name
                  });
                  
                  globalQuestionIndex++;
                });
              }
            });
          }
        }
        
        // Sort by question_order to ensure proper ordering
        extractedQuestions.sort((a, b) => a.question_order - b.question_order);
        extractedAnswers.sort((a, b) => a.question_order - b.question_order);
        
        // Convert competencies array to object structure for UI compatibility
        const competenciesObject: Record<string, any> = {};

        // When we have questions+answers, build competencies from them so behavioral is guaranteed
        if (extractedQuestions.length > 0 && extractedAnswers.length > 0) {
          const byParam = new Map<string, { questions: any[]; answers: any[] }>();
          extractedQuestions.forEach((q, idx) => {
            const paramKey = q.parameter_key || q.parameter_name || 'general';
            if (!byParam.has(paramKey)) byParam.set(paramKey, { questions: [], answers: [] });
            const ans = extractedAnswers.find((a: any) => (a.question_order || 0) === (q.question_order ?? idx));
            byParam.get(paramKey)!.questions.push({ question: q, answer: ans || extractedAnswers[idx] });
          });
          const paramMeta = new Map<string, any>();
          (data.parameters || []).forEach((p: any) => { if (p.key) paramMeta.set(p.key, p); });
          byParam.forEach((val, paramKey) => {
            const meta = paramMeta.get(paramKey);
            competenciesObject[paramKey] = {
              name: meta?.name || paramKey,
              score: meta?.score ?? 6,
              weight: meta?.weight ?? 100,
              questions: val.questions.map(({ question, answer }) => ({
                question: { question_text: question.question_text, question_order: question.question_order },
                answer: {
                  transcript: answer?.transcript,
                  score: answer?.score,
                  feedback: answer?.feedback,
                  audio_url: answer?.audio_url,
                  question_video_url: answer?.question_video_url,
                  written_answer: answer?.written_answer,
                  behavioral: answer?.behavioral ?? answer?.behavioral_metrics,
                  behavioral_metrics: answer?.behavioral_metrics ?? answer?.behavioral
                }
              })),
              isPersonal: (meta?.name || '').toLowerCase().includes('personal'),
              questionCount: val.questions.length,
              totalScore: (meta?.score ?? 6) * val.questions.length
            };
          });
        }

        // Fallback: build from data.parameters when questions/answers path didn't populate
         if (Object.keys(competenciesObject).length === 0 && data.parameters && Array.isArray(data.parameters)) {
           data.parameters.forEach(param => {
             // Map questions to the format expected by the UI
             const mappedQuestions = (param.questions || []).map((questionData, index) => {
               // Match by 0-based question_order first (API uses 0-based), then 1-based
               const oneBasedOrder = index + 1;
               const correspondingAnswer =
                 data.answers?.find((a: any) => (a.parameter_key === param.key || a.parameter_name === param.name) && Number(a.question_order) === index) ||
                 data.answers?.find((a: any) => (a.parameter_key === param.key || a.parameter_name === param.name) && Number(a.question_order) === oneBasedOrder) ||
                 data.answers?.find((a: any) => a.parameter_key === param.key && Number(a.question_order) === index) ||
                 data.answers?.find((a: any) => Number(a.question_order) === index);

               // Seed values from available sources
               let realQuestionText = questionData.text;
               let realTranscript = correspondingAnswer?.transcript || questionData.answer;
               let realFeedback = correspondingAnswer?.feedback;
               let realScore = correspondingAnswer?.score;
               let realAudioUrl = correspondingAnswer?.audio_url || questionData.audio_url;
               let realVideoUrl = correspondingAnswer?.question_video_url;
               let realWrittenAnswer = correspondingAnswer?.written_answer;

               // Fallback to interview.parameter_scores.individual_question_scores matched by question_order
               if (data.interview?.parameter_scores) {
                 const parameterScores = typeof data.interview.parameter_scores === 'string'
                   ? JSON.parse(data.interview.parameter_scores)
                   : data.interview.parameter_scores;

                 const iqs = parameterScores?.[param.key]?.individual_question_scores;
                 if (Array.isArray(iqs) && iqs.length > 0) {
                   const iqsItem = iqs.find((q: any) => Number(q.question_order) === oneBasedOrder) || iqs[index];
                   if (iqsItem) {
                     // If no direct answer match, use IQS entirely
                     if (!correspondingAnswer) {
                       realQuestionText = iqsItem.question_text || realQuestionText;
                       realTranscript = iqsItem.transcript || realTranscript;
                       realFeedback = iqsItem.feedback || realFeedback;
                       realScore = iqsItem.score ?? realScore;
                       realAudioUrl = iqsItem.audio_url || realAudioUrl;
                     } else {
                       // Only fill missing fields
                       if (!realFeedback && iqsItem.feedback) realFeedback = iqsItem.feedback;
                       if (realScore == null && iqsItem.score != null) realScore = iqsItem.score;
                       if (!realQuestionText && iqsItem.question_text) realQuestionText = iqsItem.question_text;
                       if (!realTranscript && iqsItem.transcript) realTranscript = iqsItem.transcript;
                       if (!realAudioUrl && iqsItem.audio_url) realAudioUrl = iqsItem.audio_url;
                     }
                   }
                 }
               }

               // Final fallbacks
               if (realFeedback == null) realFeedback = `Assessment for ${param.name}: ${param.reason}`;
               if (realScore == null) realScore = param.score;

               // Use full answer when available (includes behavioral) - ensures speech analysis shows
               const fullAnswer = correspondingAnswer || data.answers?.find((a: any) =>
                 (a.parameter_key === param.key || a.parameter_name === param.name) &&
                 (Number(a.question_order) === index || Number(a.question_order) === oneBasedOrder)
               ) || data.answers?.find((a: any) => Number(a.question_order) === index);
               const behavioralData = fullAnswer?.behavioral ?? fullAnswer?.behavioral_metrics;

               return {
                 question: {
                   question_text: realQuestionText,
                   question_order: index
                 },
                 answer: {
                   transcript: realTranscript,
                   score: realScore,
                   feedback: realFeedback,
                   audio_url: realAudioUrl,
                   question_video_url: realVideoUrl,
                   written_answer: realWrittenAnswer,
                   behavioral: behavioralData,
                   behavioral_metrics: behavioralData
                 }
               };
             });
             
             competenciesObject[param.key] = {
               name: param.name,
               score: param.score,
               weight: param.weight,
               questions: mappedQuestions,
               isPersonal: param.name?.toLowerCase().includes('personal') || false,
               questionCount: param.questions?.length || 0,
               totalScore: param.score * (param.questions?.length || 1)
             };
           });
         }
         
         // Add extracted data to the response
         const processedData = {
           ...data,
           questions: extractedQuestions,
           answers: extractedAnswers,
           parameters: competenciesObject
         };
         
         console.log('📊 Extracted questions:', extractedQuestions.length);
         console.log('📊 Extracted answers:', extractedAnswers.length);
         console.log('📊 Sample answer feedback:', extractedAnswers[0]?.feedback?.substring(0, 100) + '...');
         console.log('📊 Competencies object:', competenciesObject);
         console.log('📊 Competencies keys:', Object.keys(competenciesObject));
         
         // Debug duration data
         console.log('🔍 Interview data:', data.interview);
         console.log('🔍 Duration minutes from API:', data.interview?.duration_minutes);
         console.log('🔍 Session duration from API:', data.interview?.session_duration);
         console.log('🔍 Started at:', data.interview?.started_at);
         console.log('🔍 Completed at:', data.interview?.completed_at);
         
         setReportData(processedData);
      } else {
        throw new Error('Failed to load final results');
      }
    } catch (error) {
      console.error('Error loading final results:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load final results', { id: 'load-results-error' });
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    if (interviewId) {
      loadFinalResults();
    }
  }, [loadFinalResults, interviewId]);

  // Auto-select first competency when questions are loaded
  useEffect(() => {
    if (reportData && reportData.questions && reportData.questions.length > 0 && !selectedCompetencyKey) {
      const firstParamKey = reportData.questions[0].parameter_key || reportData.questions[0].parameter_name;
      setSelectedCompetencyKey(firstParamKey);
    }
  }, [reportData, selectedCompetencyKey]);

  // Reset expanded questions when competency changes
  useEffect(() => {
    setExpandedQuestions(new Set());
  }, [selectedCompetencyKey]);





  const shareReport = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Final Results - ${reportData?.interview?.candidate_name || 'Interview'}`,
        text: `View the final assessment results for ${reportData?.interview?.candidate_name || 'Interview'}`,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Report URL copied to clipboard', { id: 'url-copied' });
    }
  };

  const isCandidateReport = reportVariant === 'candidate';
  const getScoreColor = (score) => isCandidateReport ? 'text-sky-600' : 'text-[#1e5da8]';

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreClass = (score) => isCandidateReport ? 'bg-sky-600' : 'bg-[#1e5da8]';
  const accentHex = isCandidateReport ? '#0284c7' : '#1e5da8'; // sky-600 vs blue
  const headerBg = isCandidateReport
    ? '[background:linear-gradient(135deg,#2563eb,#1a9fd6)] border-[#1a9fd6]/50'
    : 'bg-[#1e5da8] border-[#1e5da8]/80';
  const btnPrimary = isCandidateReport ? 'bg-sky-600 hover:bg-sky-700' : 'bg-[#1e5da8] hover:bg-[#1e5da8]/90';
  const btnOutline = isCandidateReport ? 'bg-white text-sky-600 hover:bg-gray-50' : 'bg-white text-[#1e5da8] hover:bg-gray-50';
  const loadingBorder = isCandidateReport ? 'border-sky-600' : 'border-[#1e5da8]';
  const paramSelected = isCandidateReport ? 'bg-sky-50 text-sky-900 border-2 border-sky-200' : 'bg-blue-50 text-blue-900 border-2 border-blue-200';
  const paramBadge = isCandidateReport ? 'bg-sky-100 text-sky-600 border border-sky-200' : 'bg-sky-100 text-[#1e5da8] border border-sky-200';
  const paramBadgeSelected = isCandidateReport ? 'bg-sky-200/50 text-sky-700' : 'bg-[#1e5da8]/20 text-[#1e5da8]';
  const cardHover = isCandidateReport ? 'hover:border-sky-500/50' : 'hover:border-[#1e5da8]/50';
  const expandBtn = isCandidateReport ? 'text-sky-600' : 'text-[#1e5da8]';
  const tableHeaderBg = isCandidateReport ? 'bg-sky-700' : 'bg-[#1e5da8]';
  const iconBg = isCandidateReport ? 'bg-sky-600' : 'bg-[#1e5da8]';
  const barSelected = isCandidateReport ? 'bg-sky-600' : 'bg-[#1e5da8]';
  const accentText = isCandidateReport ? 'text-sky-600' : 'text-[#1e5da8]';

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
        {/* Light bar with logo - commented to avoid flash when navigating to Results */}
        {/* <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4">
            <img
              src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`}
              alt="ProValuate"
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
            />
          </div>
        </header> */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 ${loadingBorder} mx-auto mb-3 sm:mb-4`} />
            <p className="text-sm sm:text-lg text-gray-600">Loading final results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
        {/* Light bar with logo - commented to avoid flash when navigating to Results */}
        {/* <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4">
            <img
              src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`}
              alt="ProValuate"
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
            />
          </div>
        </header> */}
        <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-4 sm:py-6">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-md w-full text-center mx-2 sm:mx-0">
            <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-3 sm:mb-4 flex-shrink-0" />
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2 break-words">Results Not Found</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 break-words">The interview results could not be loaded.</p>
            <button
              onClick={() => navigate(reportVariant === 'recruiter' ? '/dashboard?section=interview-dashboard' : '/candidate-dashboard/performance-report')}
              className={`min-h-[44px] px-4 sm:px-6 py-3 rounded-lg ${btnPrimary} text-white text-sm sm:text-base font-medium transition-colors touch-manipulation w-full sm:w-auto`}
            >
              {reportVariant === 'recruiter' ? 'Go to Dashboard' : 'Go to My Interviews'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { interview, parameters: competenciesReport } = reportData;
  
  // Normalize competency count for both array and object structures (API still returns `parameters`)
  const competencyCount = Array.isArray(competenciesReport)
    ? competenciesReport.length
    : competenciesReport
      ? Object.keys(competenciesReport).length
      : 0;
  const displayInterviewScore = resolveDisplayInterviewScore(interview, competencyCount);

  // PDF Generation Function
  const generatePDFReport = async () => {
    if (isGeneratingPDF) return; // Prevent multiple clicks
    
    setIsGeneratingPDF(true);
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      // Add logo (same as login page: Logo_Transparent_BG.png, height ~48px = 12.7mm)
      let logoAdded = false;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => {
            try {
              const heightMm = 16;
              const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
              const widthMm = heightMm * aspect;
              // x=12 gives breathing room; y=8 clears the top band
              doc.addImage(logoImg, 'PNG', 12, 8, widthMm, heightMm);
              logoAdded = true;
            } catch (error) {
              console.log('Error adding logo to PDF:', error);
            }
            resolve();
          };
          logoImg.onerror = () => {
            console.log('Logo image failed to load');
            resolve();
          };
          logoImg.src = `${import.meta.env.BASE_URL}Logo_Transparent_BG.png`;
        });
      } catch (error) {
        console.log('Logo not found, continuing without logo');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const blueRgb: [number, number, number]      = [30, 93, 168];    // #1e5da8
      const lightBlueRgb: [number, number, number] = [232, 240, 251];  // #e8f0fb – chip/badge bg
      const tableBorder = { lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.15 };

      // ── MAIN TITLE ───────────────────────────────────────────────────────────────
      doc.setTextColor(...blueRgb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('INTERVIEW ANALYSIS REPORT', pageWidth / 2, 44, { align: 'center' });

      // ── SUBTITLE LINES ───────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text('Competency-Based Interview Analytics', pageWidth / 2, 56, { align: 'center' });
      doc.text('Combining AI Evaluation with Advanced Insights', pageWidth / 2, 63, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      // Resolve candidate photo URL (server → localStorage → sessionStorage)
      let candidatePhotoDataUrl: string | null = null;
      const storageKey = `candidate_photo_${interviewId}`;
      try {
        const photoUrl = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_CANDIDATE_PHOTO}/${interviewId}`);
        const photoResponse = await fetch(photoUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          if (photoData.photo && photoData.photo.startsWith('data:image/')) candidatePhotoDataUrl = photoData.photo;
        }
      } catch (_) {}
      if (!candidatePhotoDataUrl) {
        try {
          const local = localStorage.getItem(storageKey);
          const ts = localStorage.getItem(`${storageKey}_timestamp`);
          if (local && (!ts || Date.now() - parseInt(ts) < 7 * 24 * 60 * 60 * 1000)) candidatePhotoDataUrl = local;
        } catch (_) {}
      }
      if (!candidatePhotoDataUrl) {
        try {
          const s = sessionStorage.getItem(storageKey);
          if (s) candidatePhotoDataUrl = s;
        } catch (_) {}
      }
      const isValidPhoto = (s: string | null) => !!s && s.startsWith('data:image/') && s.length >= 100;
      const photoSrc = (candidatePhotoDataUrl && isValidPhoto(candidatePhotoDataUrl)) ? candidatePhotoDataUrl : `${import.meta.env.BASE_URL}assets/NAME.jpg`;

      // ── CANDIDATE PHOTO ──────────────────────────────────────────────────────────
      const photoSize = 52;
      const photoY = 73;
      const photoX = (pageWidth - photoSize) / 2;
      const photoCx   = pageWidth / 2;
      const photoCy   = photoY + photoSize / 2;

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const t = setTimeout(() => resolve(), 5000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const imgFmt = photoSrc.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(img, imgFmt, photoX, photoY, photoSize, photoSize);
          } catch (_) {}
          resolve();
        };
        img.onerror = () => {
          // ── FALLBACK: light-blue circle with candidate initials ──────────────────
          doc.setFillColor(...lightBlueRgb);
          doc.circle(photoCx, photoCy, photoSize / 2, 'F');
          const initials = (interview.candidate_name || 'C')
            .split(' ')
            .map((w: string) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(...blueRgb);
          doc.text(initials, photoCx, photoCy + 1.5, { align: 'center' });
          resolve();
        };
        img.src = photoSrc;
      });

      // ── CANDIDATE DETAILS TABLE ───────────────────────────────────────────────────
      const candidateTableStartY = photoY + photoSize + 30;
      const candidateRows: [string, string][] = [
        ['Candidate', interview.candidate_name || 'N/A'],
        ['Email', interview.candidate_email || 'N/A'],
        ['Position', interview.position || 'N/A'],
        ['Overall Score', `${formatOverallScore(displayInterviewScore)}/10`],
        ['Interview Date', formatOrdinalDate(interview.created_at)],
      ];
      if (interview.status === 'terminated' && interview.termination_reason) {
        candidateRows.push(['Termination Reason', interview.termination_reason]);
      }
      const fieldColWidth = 42;
      const valueColWidth = 78;
      const tableTotalWidth = fieldColWidth + valueColWidth;
      const tableMargin = (pageWidth - tableTotalWidth) / 2;
      autoTable(doc, {
        body: candidateRows,
        startY: candidateTableStartY,
        tableWidth: tableTotalWidth,
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
          lineColor: [208, 223, 245] as [number, number, number],
          lineWidth: 0,
          textColor: [60, 60, 80] as [number, number, number],
        },
        columnStyles: {
          0: {
            cellWidth: fieldColWidth,
            fontStyle: 'bold',
            textColor: [26, 26, 46] as [number, number, number],
            fillColor: [247, 249, 253] as [number, number, number],
          },
          1: {
            cellWidth: valueColWidth,
            fillColor: [255, 255, 255] as [number, number, number],
            fontStyle: 'normal',
          },
        },
        margin: { left: tableMargin, right: tableMargin },
      });
      const candidateTableEndY = (doc as any).lastAutoTable?.finalY ?? (candidateTableStartY + candidateRows.length * 10);
      const candidateTableHeight = Math.max(8, candidateTableEndY - candidateTableStartY);
      doc.setDrawColor(208, 223, 245);
      doc.setLineWidth(0.3);
      // Inner grid lines (custom) so we can keep rounded outer corners clean.
      const rowH = candidateTableHeight / Math.max(1, candidateRows.length);
      doc.line(
        tableMargin + fieldColWidth,
        candidateTableStartY,
        tableMargin + fieldColWidth,
        candidateTableEndY
      );
      for (let i = 1; i < candidateRows.length; i += 1) {
        const y = candidateTableStartY + rowH * i;
        doc.line(tableMargin, y, tableMargin + tableTotalWidth, y);
      }
      doc.setLineWidth(0.8);
      doc.roundedRect(tableMargin, candidateTableStartY, tableTotalWidth, candidateTableHeight, 2.5, 2.5, 'S');
      const execCandidateName = interview.candidate_name || 'the candidate';
      const execRole = interview.position || 'the applied role';
      const summaryParagraph = `This report is an overview of ${execCandidateName}, who has completed the interview for the role of ${execRole}. The following pages provide insight into the candidate's answers for various questions across competencies. This is followed by a Detailed Speech Analysis section, which presents a detailed plan and personalised feedback on the candidate's speech and delivery.`;
      const execSummaryMargin = 21;
      const execSummaryMaxLineWidth = pageWidth - execSummaryMargin * 2;
      const summarySegments = doc.splitTextToSize(summaryParagraph, execSummaryMaxLineWidth);

      // Prepare question data first (needed for total page count)
      const questionRows: { question: any; answer: any; competencyLabel: string; feedback: string }[] = [];
      console.log('🔍 PDF Generation Debug - Enhanced Version:');
      console.log('🔍 Competencies object:', competenciesReport);
      console.log('🔍 Competencies keys:', Object.keys(competenciesReport || {}));
      console.log('🔍 Interview data:', interview);
      console.log('🔍 Competency scores:', interview.parameter_scores);
      console.log('🔍 Report data answers:', reportData.answers?.length);
      console.log('🔍 Report data questions:', reportData.questions?.length);
      
      // Debug feedback availability in different data structures
      if (reportData.answers && reportData.answers.length > 0) {
        console.log('🔍 Sample feedback from answers array:');
        reportData.answers.forEach((answer, index) => {
          console.log(`  Answer ${index}: feedback="${answer.feedback?.substring(0, 100) || 'No feedback'}..."`);
        });
      }
      
      if (interview.parameter_scores) {
        const parameterScores = typeof interview.parameter_scores === 'string' 
          ? JSON.parse(interview.parameter_scores) 
          : interview.parameter_scores;
        console.log('🔍 Competency scores structure:');
        Object.entries(parameterScores).forEach(([paramKey, paramData]: [string, any]) => {
          console.log(`  ${paramKey}: ${paramData.individual_question_scores?.length || 0} individual scores`);
          if (paramData.individual_question_scores) {
            paramData.individual_question_scores.forEach((qs: any, idx: number) => {
              console.log(`    Q${idx}: feedback="${qs.feedback?.substring(0, 100) || 'No feedback'}..."`);
            });
          }
        });
      }
      
      // Use the same ordering logic to avoid duplicates
      if (reportData.questions && reportData.answers && reportData.questions.length > 0) {
        console.log('🔍 Using questions and answers arrays for PDF (primary path)');
        
        // Sort questions by question_order to ensure proper ordering
        const sortedQuestions = [...reportData.questions].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
        
        sortedQuestions.forEach((question: any) => {
          const questionOrder = question.question_order || 0;
          const answer = reportData.answers.find((ans: any) => (ans.question_order || 0) === questionOrder);
          
          const questionText = question.question_text || question.question || 'N/A';
          const competencyLabel = question.parameter_name || question.parameter_key || 'N/A';
          
          // Include all questions (including terminated/partial interviews with 1+ answers)
          if (questionText && questionText !== 'N/A') {
            if (answer) {
              // Enhanced feedback extraction with multiple fallbacks
              const getFeedback = (question: any, answer: any) => {
                // Try multiple possible locations for feedback
                let feedback = null;
                
                // Method 1: Direct feedback from answer
                if (answer.feedback) {
                  feedback = answer.feedback;
                }
                
                // Method 2: Feedback from competency scores data
                if (!feedback && interview.parameter_scores) {
                  const parameterScores = typeof interview.parameter_scores === 'string' 
                    ? JSON.parse(interview.parameter_scores) 
                    : interview.parameter_scores;
                  
                  const paramKey = question.parameter_key || question.parameter_name;
                  if (paramKey && parameterScores[paramKey]) {
                    const paramScoreData = parameterScores[paramKey];
                    if (paramScoreData.individual_question_scores) {
                      const questionScore = paramScoreData.individual_question_scores.find((qs: any) => 
                        qs.question_text === question.question_text ||
                        qs.question_order === question.question_order
                      );
                      if (questionScore && questionScore.feedback) {
                        feedback = questionScore.feedback;
                      }
                    }
                  }
                }
                
                // Method 3: Construct meaningful feedback if nothing found
                if (!feedback) {
                  const score = answer.score || 'N/A';
                  const paramName = question.parameter_name || question.parameter_key || 'General';
                  feedback = `Assessment for ${paramName}: Performance evaluated with score ${score}/10. ${score >= 7 ? 'Good performance demonstrated.' : score >= 5 ? 'Satisfactory performance with room for improvement.' : 'Performance needs significant improvement.'}`;
                }
                
                return feedback;
              };
              
              const formatFeedback = (feedback: string) => {
                if (!feedback || feedback === 'No feedback available') return 'No feedback available';
                
                // Clean up the feedback text but preserve the complete content
                let cleanedFeedback = feedback.trim();
                
                // Only remove obvious formatting issues, don't filter content
                cleanedFeedback = cleanedFeedback.replace(/^•\s*/gm, '').replace(/^\d+\.\s*/gm, '');
                
                // If the feedback already contains bullet points, keep them structured
                if (cleanedFeedback.includes('•') || cleanedFeedback.match(/^\d+\./gm)) {
                  return cleanedFeedback;
                }
                
                // For regular paragraph-style feedback, just return it as-is with proper spacing
                // Don't split into bullets - preserve the original detailed feedback
                return cleanedFeedback;
              };
              
              const feedback = getFeedback(question, answer);
              const formattedFeedback = formatFeedback(feedback);
              questionRows.push({
                question: { ...question, questionText },
                answer,
                competencyLabel,
                feedback: formattedFeedback
              });
            } else {
              questionRows.push({
                question: { ...question, questionText },
                answer: null,
                competencyLabel,
                feedback: 'No feedback available'
              });
            }
          }
        });
      } else if (reportData.parameters && reportData.parameters.length > 0) {
        // Fallback for terminated interviews: build question rows from parameters.questions
        console.log('🔍 Using competencies.questions for PDF (terminated/partial interview fallback)');
        let globalIdx = 0;
        const answersList = reportData.answers || [];
        reportData.parameters.forEach((param: any) => {
          const paramQuestions = param.questions || [];
          paramQuestions.forEach((qData: any, qIdx: number) => {
            const questionText = qData.text || qData.question_text || `Question ${globalIdx + 1}`;
            const competencyLabel = param.name || param.parameter_name || param.key || 'General';
            const matchedAnswer = answersList.find((a: any) =>
              (a.parameter_key === param.key || a.parameter_name === param.name) &&
              ((a.question_order || 0) === globalIdx || (a.question_order || 0) === qIdx)
            ) || answersList.find((a: any) => (a.question_order || 0) === globalIdx);
            const answer = matchedAnswer || {
              transcript: qData.answer || qData.transcript || '',
              score: param.score ?? qData.score ?? 'N/A',
              feedback: param.reason || 'Partial assessment',
              written_answer: qData.written_answer,
              behavioral: null,
              question_order: globalIdx
            };
            questionRows.push({
              question: { question_order: globalIdx, question_text: questionText, questionText, parameter_key: param.key, parameter_name: competencyLabel },
              answer,
              competencyLabel,
              feedback: answer.feedback || 'No feedback available'
            });
            globalIdx++;
          });
        });
      }

      const questionPageCount = questionRows.length; // One page per question (speech analysis moved to overall table)
      const totalPageCount = 3 + questionPageCount; // 1=cover, 2=score summary, then 1 per question, then optional speech/feedback/plan, disclaimer

      type ParamMetrics = {
        overall_quality: number[]; wpm: number[]; filler: number[]; pause_quality: number[];
        voice_confidence: number[];
      };
      const paramBehavioralMap: Record<string, ParamMetrics> = {};
      const initParam = (): ParamMetrics => ({
        overall_quality: [], wpm: [], filler: [], pause_quality: [],
        voice_confidence: [],
      });
      questionRows.forEach((row: any) => {
        const p = row.competencyLabel;
        if (!paramBehavioralMap[p]) paramBehavioralMap[p] = initParam();
        const b = row.answer?.behavioral || row.answer?.behavioral_metrics;
        if (b) {
          if (typeof b.overall_speech_quality === 'number') paramBehavioralMap[p].overall_quality.push(b.overall_speech_quality);
          if (typeof b.speaking_pace_wpm === 'number') paramBehavioralMap[p].wpm.push(b.speaking_pace_wpm);
          if (typeof b.filler_score === 'number') paramBehavioralMap[p].filler.push(b.filler_score);
          if (typeof b.pause_quality_score === 'number') paramBehavioralMap[p].pause_quality.push(b.pause_quality_score);
          if (typeof b.voice_confidence === 'number') paramBehavioralMap[p].voice_confidence.push(b.voice_confidence);
        }
      });

      const hasBehavioralData = Object.keys(paramBehavioralMap).some(p => {
        const d = paramBehavioralMap[p];
        return d.overall_quality.length > 0 || d.wpm.length > 0 || d.filler.length > 0 ||
          d.pause_quality.length > 0 || d.voice_confidence.length > 0;
      });

      // Page 1: no footer drawn here (final pass draws all footers once)

      // Pages 2+: One question per page (Score Summary by Competency removed)
      const totalQuestions = questionRows.length;
      const qFooterY = doc.internal.pageSize.height - 8;
      let currentPageNum = 2;

      // Palette of colors to use for competency header bars in question pages
      const PARAM_COLOR_PALETTE: { bg: [number, number, number]; text: [number, number, number] }[] = [
        { bg: [232, 244, 255], text: [26, 86, 219] },   // soft blue
        { bg: [240, 253, 244], text: [4, 120, 87] },    // soft green
        { bg: [255, 251, 235], text: [180, 83, 9] },    // soft amber
        { bg: [254, 242, 242], text: [185, 28, 28] },   // soft red
        { bg: [239, 246, 255], text: [30, 64, 175] },   // indigo
        { bg: [240, 249, 255], text: [2, 132, 199] },   // sky
        { bg: [240, 253, 250], text: [6, 95, 70] },     // teal
        { bg: [249, 250, 251], text: [31, 41, 55] },    // neutral
      ];
      const paramColorMap: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {};
      let nextParamColorIndex = 0;

      const competencyStats: Record<string, { avgScore: number | null; answeredCount: number; totalCount: number }> = {};
      questionRows.forEach((row: any) => {
        const key = row.competencyLabel || 'Competency';
        if (!competencyStats[key]) {
          competencyStats[key] = { avgScore: null, answeredCount: 0, totalCount: 0 };
        }
        competencyStats[key].totalCount += 1;
        const val = row.answer?.parameter_score ?? row.answer?.score;
        const num = typeof val === 'number' ? val : Number(val);
        if (Number.isFinite(num)) {
          competencyStats[key].answeredCount += 1;
          const prev = competencyStats[key].avgScore;
          if (prev == null) {
            competencyStats[key].avgScore = num;
          } else {
            const n = competencyStats[key].answeredCount;
            competencyStats[key].avgScore = ((prev * (n - 1)) + num) / n;
          }
        }
      });

      // Page 2: Competency breakdown (before competency-based question detail pages)
      const competencyBreakdownRows = Object.entries(competencyStats)
        .map(([name, stat]) => ({
          name,
          score: stat.avgScore,
        }))
        .filter((r) => r.name && r.name.trim().length > 0)
        .sort((a, b) => {
          const aScore = typeof a.score === 'number' ? a.score : -1;
          const bScore = typeof b.score === 'number' ? b.score : -1;
          return bScore - aScore;
        });

      if (competencyBreakdownRows.length > 0) {
        doc.addPage();
        const leftMargin = 21;
        const rightMargin = 21;
        const contentWidth = pageWidth - leftMargin - rightMargin;
        const pageBottomLimit = doc.internal.pageSize.height - 22;

        // Single header block for the whole section (as requested).
        const titleBoxY = 14;
        const titleBoxH = 22;
        doc.setFillColor(236, 231, 255);
        doc.roundedRect(leftMargin, titleBoxY, contentWidth, titleBoxH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(31, 79, 209);
        doc.text('COMPETENCY BREAKDOWN', leftMargin + 4, titleBoxY + 8);
        doc.setFontSize(10);
        doc.setTextColor(77, 89, 117);
        doc.text('Average score per competency for this interview', leftMargin + 4, titleBoxY + 14.8);
        doc.setTextColor(0, 0, 0);

        // Overall circular score indicator between header and competency bars.
        const overallDisplayScore = resolveDisplayInterviewScore(reportData?.interview, competencyBreakdownRows.length);
        const ringCenterX = leftMargin + (contentWidth / 2);
        const ringCenterY = titleBoxY + titleBoxH + 27;
        const ringRadius = 18;

        // Match the existing "AI competency" circle style used in question pages.
        doc.setDrawColor(190, 195, 205);
        doc.setLineWidth(1.1);
        doc.circle(ringCenterX, ringCenterY, ringRadius, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(130, 130, 130);
        doc.text('Overall Score', ringCenterX, ringCenterY - 2.2, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13.5);
        doc.setTextColor(37, 99, 235);
        doc.text(
          overallDisplayScore != null ? `${formatOverallScore(overallDisplayScore)}/10` : 'N/A',
          ringCenterX,
          ringCenterY + 3.8,
          { align: 'center' }
        );
        doc.setTextColor(0, 0, 0);

        const nameCellWidth = contentWidth * 0.52;
        const rightCellX = leftMargin + nameCellWidth;
        const rightCellWidth = contentWidth - nameCellWidth;
        const scoreColWidth = 14;
        const barX = rightCellX + 5;
        const barW = rightCellWidth - scoreColWidth - 10;
        const barH = 3.2;
        const scoreX = leftMargin + contentWidth - 1.5;
        const rowMinHeight = 12.5;
        const nameLineHeight = 5.2;
        let yPos = ringCenterY + ringRadius + 24;

        const pickScoreColor = (v: number): [number, number, number] => {
          if (v >= 7) return [16, 185, 129]; // good
          if (v >= 5) return [234, 179, 8];  // average
          return [239, 68, 68];              // needs work
        };
        const wrapLabelByWordLimit = (label: string, wordsPerLine: number): string[] => {
          const words = String(label || '').trim().split(/\s+/).filter(Boolean);
          if (words.length === 0) return ['Competency'];
          const lines: string[] = [];
          for (let i = 0; i < words.length; i += wordsPerLine) {
            lines.push(words.slice(i, i + wordsPerLine).join(' '));
          }
          return lines;
        };

        for (let i = 0; i < competencyBreakdownRows.length; i += 1) {
          const row = competencyBreakdownRows[i];
          if (yPos + 12 > pageBottomLimit) {
            doc.addPage();
            yPos = 20;
          }
          const numericScore = typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : null;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.8);
          doc.setTextColor(31, 79, 209);
          const wrappedName = wrapLabelByWordLimit(row.name, 4);
          const textBlockHeight = Math.max(nameLineHeight, wrappedName.length * nameLineHeight);
          const rowHeight = Math.max(rowMinHeight, textBlockHeight + 2.5);
          const rowTopY = yPos;
          const grayCellTopY = rowTopY - 2.5;
          const grayCellHeight = rowHeight + 2.5;
          const firstLineY = grayCellTopY + ((grayCellHeight - textBlockHeight) / 2) + (nameLineHeight * 0.78);

          // Table-like row layout: competency cell (light gray), bar+score cell (white).
          doc.setDrawColor(220, 225, 236);
          doc.setLineWidth(0.25);
          doc.setFillColor(245, 247, 251);
          doc.rect(leftMargin, rowTopY - 2.5, nameCellWidth, rowHeight + 2.5, 'FD');
          doc.setFillColor(255, 255, 255);
          doc.rect(rightCellX, rowTopY - 2.5, rightCellWidth, rowHeight + 2.5, 'FD');

          wrappedName.forEach((line: string, idx: number) => {
            doc.text(line, leftMargin + (nameCellWidth / 2), firstLineY + (idx * nameLineHeight), { align: 'center' });
          });

          // For multi-line labels, align bar to the visual midpoint of the *gap*
          // between line 1 and line 2 (not baseline midpoint).
          const fontSize = 9.8;
          const textTopOffset = fontSize * 0.72; // baseline -> approximate glyph top
          const line1Baseline = firstLineY;
          const line2Baseline = firstLineY + nameLineHeight;
          const line1Bottom = (line1Baseline - textTopOffset) + fontSize;
          const line2Top = line2Baseline - textTopOffset;
          const barCenterY = wrappedName.length >= 2
            ? (line1Bottom + line2Top) / 2
            : firstLineY - (nameLineHeight * 0.18);
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.3);
          doc.setFillColor(238, 242, 255);
          doc.roundedRect(barX, barCenterY - (barH / 2), barW, barH, 1.8, 1.8, 'FD');

          if (numericScore != null) {
            const normalized = Math.max(0, Math.min(10, numericScore));
            const fillW = Math.max(1.2, (normalized / 10) * barW);
            const c = pickScoreColor(normalized);
            doc.setFillColor(c[0], c[1], c[2]);
            doc.roundedRect(barX, barCenterY - (barH / 2), fillW, barH, 1.8, 1.8, 'F');
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(31, 41, 55);
          doc.text(
            numericScore != null ? Number(numericScore).toFixed(1) : 'N/A',
            scoreX,
            barCenterY + 1.5,
            { align: 'right' }
          );

          yPos += rowHeight + 5.5;
        }

        // Executive Summary moved from page 1 to appear below competency breakdown.
        let execSummaryY = yPos + 16;
        const execSummaryNeededHeight = 10 + (summarySegments.length * 6) + 8;
        if (execSummaryY + execSummaryNeededHeight > pageBottomLimit) {
          doc.addPage();
          execSummaryY = 22;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...blueRgb);
        doc.text('EXECUTIVE SUMMARY', pageWidth / 2, execSummaryY, { align: 'center' });
        execSummaryY += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        // Keep paragraph strictly within the same horizontal bounds as the violet header block.
        const execSummaryInnerWidth = Math.max(40, contentWidth - 12);
        const execSummaryCenteredLines = doc.splitTextToSize(summaryParagraph, execSummaryInnerWidth);
        const execSummaryCenterX = leftMargin + (contentWidth / 2);
        execSummaryCenteredLines.forEach((seg: string) => {
          doc.text(seg, execSummaryCenterX, execSummaryY, { align: 'center' });
          execSummaryY += 6;
        });
      }

      // DB-backed lookup maps for level/band text in PDF summary block.
      const paramLevelByKey: Record<string, string> = {};
      const paramLevelByName: Record<string, string> = {};
      const parameterList: any[] = Array.isArray(reportData?.parameters)
        ? reportData.parameters
        : (reportData?.parameters && typeof reportData.parameters === 'object'
            ? Object.values(reportData.parameters)
            : []);
      parameterList.forEach((p: any) => {
        const lvl = String(p?.level || '').trim();
        if (!lvl) return;
        if (p?.key) paramLevelByKey[String(p.key)] = lvl;
        if (p?.name) paramLevelByName[String(p.name)] = lvl;
        if (p?.parameter_name) paramLevelByName[String(p.parameter_name)] = lvl;
      });

      const bandByQOrder: Record<number, { band?: string; reason?: string }> = {};
      try {
        const psRaw = interview?.parameter_scores;
        const ps = typeof psRaw === 'string' ? JSON.parse(psRaw) : psRaw;
        if (ps && typeof ps === 'object') {
          Object.values(ps as Record<string, any>).forEach((paramData: any) => {
            const iqs = Array.isArray(paramData?.individual_question_scores) ? paramData.individual_question_scores : [];
            iqs.forEach((it: any) => {
              const qOrd = Number(it?.question_order);
              if (Number.isFinite(qOrd)) {
                bandByQOrder[qOrd] = {
                  band: it?.band_applied,
                  reason: it?.band_reason
                };
              }
            });
          });
        }
      } catch (e) {
        console.warn('Failed to parse parameter_scores for band lookup:', e);
      }

      const getLevelLabelFromDb = (levelRaw: any, row: any): string => {
        const fallbackLevel =
          row?.question?.level ||
          paramLevelByKey[String(row?.question?.parameter_key || '')] ||
          paramLevelByName[String(row?.question?.parameter_name || '')] ||
          paramLevelByName[String(row?.competencyLabel || '')] ||
          '';
        const level = String(levelRaw || fallbackLevel || '').trim();
        if (!level) return 'N/A';
        return `${level} level`;
      };

      questionRows.forEach((row, idx) => {
        doc.addPage();
        const qNum = idx + 1;
        const pageHeight = doc.internal.pageSize.height;
        const leftMargin = 21;
        const rightMargin = 21;
        // Push the question/answer block further down to make room for score summary block
        const contentStartY = 80;
        const continuedPageStartY = 22;
        const bottomMargin = 28;
        const labelX = leftMargin + 2;
        const valueX = leftMargin + 2;
        const maxWidth = pageWidth - valueX - rightMargin - 3;
        const lineHeight = 5.2;

        // Colored competency header bar
        const paramName = row.competencyLabel || 'Competency';
        if (!paramColorMap[paramName]) {
          paramColorMap[paramName] = PARAM_COLOR_PALETTE[nextParamColorIndex % PARAM_COLOR_PALETTE.length];
          nextParamColorIndex += 1;
        }
        const colors = paramColorMap[paramName];
        const headerY = 14;
        const headerHeight = 18;
        doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
        // simple rounded rectangle spanning page width with margins
        doc.roundedRect(leftMargin, headerY, pageWidth - leftMargin - rightMargin, headerHeight, 2, 2, 'F');
        // First line: "COMPETNACY:"
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        doc.text('COMPETENCY:', leftMargin + 4, headerY + 7.5);
        // Second line: parameter name
        doc.setFontSize(13);
        doc.text(`${paramName}`, leftMargin + 4, headerY + 14.5);
        // Right-side question index text (e.g., Q 5 of 6)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(245, 248, 252);
        doc.text(`Q ${qNum} of ${totalQuestions}`, pageWidth - rightMargin - 12, headerY + 6.5, { align: 'right' });
        // reset text color for body content
        doc.setTextColor(0, 0, 0);

        // Summary block under header: left circular score + right competency summary
        const paramStats = competencyStats[paramName] || { avgScore: null, answeredCount: 0, totalCount: 0 };
        const summaryY = headerY + headerHeight + 8;
        const circleCenterX = leftMargin + 12;
        const circleCenterY = (headerY + headerHeight + contentStartY) / 2;
        const circleR = 14;
        const scoreValue = row.answer?.parameter_score ?? row.answer?.score ?? paramStats.avgScore;
        const scoreNum = typeof scoreValue === 'number' ? scoreValue : Number(scoreValue);
        const scoreText = Number.isFinite(scoreNum) ? `${Math.round(scoreNum)}/10` : 'N/A';
        const qOrder = Number(row?.question?.question_order);
        const bandFallback = Number.isFinite(qOrder) ? bandByQOrder[qOrder] : undefined;
        const bandTextRaw = String(row.answer?.band_applied || bandFallback?.band || '').trim();
        const bandText = bandTextRaw.length > 0 ? bandTextRaw : 'Not Evaluated';

        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.5);
        doc.circle(circleCenterX, circleCenterY, circleR, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(130, 130, 130);
        doc.text('AI competency', circleCenterX, circleCenterY - 2.8, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        doc.text(scoreText, circleCenterX, circleCenterY + 3.8, { align: 'center' });

        const summaryTextX = leftMargin + 28;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(145, 145, 145);
        doc.text('Performance band', summaryTextX, summaryY + 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(55, 55, 55);
        doc.text(`${bandText}`, summaryTextX, summaryY + 17.5);

        // Divider below summary block
        doc.setDrawColor(228, 228, 228);
        doc.line(leftMargin, summaryY + 33, pageWidth - rightMargin, summaryY + 33);

        const ensureSpace = (neededLines: number) => {
          if (yPos + neededLines * lineHeight > pageHeight - bottomMargin) {
            doc.addPage();
            currentPageNum++;
            // For overflow pages, start near the top (not mid-page).
            yPos = continuedPageStartY;
          }
        };

        const drawField = (
          label: string,
          value: string,
          options?: { italic?: boolean; separator?: boolean }
        ) => {
          const v = value && value.trim().length > 0 ? value : '—';
          const paragraphs = doc.splitTextToSize(v, maxWidth);
          const needed = paragraphs.length + 4;
          ensureSpace(needed);

          // label
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(145, 145, 145);
          doc.text(label, labelX, yPos);
          // Clear visual separation between label and value
          yPos += lineHeight + 1.0;

          // value
          if (options?.italic) {
            doc.setFont('helvetica', 'italic');
          } else {
            doc.setFont('helvetica', 'normal');
          }
          doc.setFontSize(12);
          doc.setTextColor(30, 30, 30);
          paragraphs.forEach((line, i) => {
            doc.text(line, valueX, yPos + (i * lineHeight));
          });

          // Moderate section gap so we use remaining page space better
          yPos += paragraphs.length * lineHeight + (lineHeight * 0.9);
          // subtle separator line (optional)
          if (options?.separator !== false) {
            doc.setDrawColor(230, 230, 230);
            doc.line(leftMargin, yPos - 2, pageWidth - rightMargin, yPos - 2);
          }
          yPos += lineHeight * 0.45;
          doc.setTextColor(0, 0, 0);
        };

        const transcript = row.answer
          ? row.answer.transcript || row.answer.answer || 'No transcript available'
          : 'No answer recorded';
        const writtenAnswerRaw = row.answer?.written_answer?.trim();
        const hasWrittenAnswer = !!writtenAnswerRaw;
        const score = row.answer != null ? (row.answer.score ?? 'N/A') : 'N/A';

        let yPos = contentStartY;
        const qOrderForLabel = Number.isFinite(Number(row?.question?.question_order))
          ? Number(row.question.question_order) + 1
          : idx + 1;
        drawField(`Question [Q${qOrderForLabel}]`, row.question.questionText || 'N/A', { separator: false });
        // Candidate answer should match normal body font (no italics)
        drawField('Candidate Answer', transcript, { separator: false });
        // Only show a Written Answer row if there is actual written content
        if (hasWrittenAnswer) {
          drawField('Written Answer', 'See written answer below', { italic: true });
        }
        drawField('AI Feedback', row.feedback || 'No feedback available');

        // Per-question speech metric stat cards (5 cards) below AI Feedback.
        const behavioral = row.answer?.behavioral || row.answer?.behavioral_metrics || {};
        const asNumberOrNull = (v: any): number | null => {
          if (typeof v === 'number' && Number.isFinite(v)) return v;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };
        const formatMetric = (
          v: number | null,
          opts?: { suffix?: string; decimals?: number }
        ): string => {
          if (v == null) return '—';
          const decimals = typeof opts?.decimals === 'number' ? opts.decimals : 0;
          return `${v.toFixed(decimals)}${opts?.suffix || ''}`;
        };

        const metricCards: Array<{ name: string; value: string }> = [
          {
            name: 'Overall Speech',
            value: formatMetric(asNumberOrNull(behavioral?.overall_speech_quality), { suffix: '/100', decimals: 0 }),
          },
          {
            name: 'Speaking Pace',
            value: formatMetric(asNumberOrNull(behavioral?.speaking_pace_wpm), { suffix: ' WPM', decimals: 0 }),
          },
          {
            name: 'Filler Score',
            value: (() => {
              const fillerScore = asNumberOrNull(behavioral?.filler_score);
              if (fillerScore != null) return formatMetric(fillerScore, { suffix: '/100', decimals: 0 });
              const fillerRate = asNumberOrNull(behavioral?.filler_rate_per_min);
              return formatMetric(fillerRate, { suffix: '/min', decimals: 1 });
            })(),
          },
          {
            name: 'Pause Quality',
            value: formatMetric(asNumberOrNull(behavioral?.pause_quality_score), { suffix: '/100', decimals: 0 }),
          },
          {
            name: 'Voice Confidence',
            value: formatMetric(asNumberOrNull(behavioral?.voice_confidence), { suffix: '/100', decimals: 0 }),
          },
        ];

        const cardsGap = 3;
        const cardsTotalWidth = pageWidth - leftMargin - rightMargin;
        const cardW = (cardsTotalWidth - cardsGap * 4) / 5;
        const cardH = 18;
        const cardsY = yPos + 1;
        const cardsNeededLines = Math.ceil((cardH + 8) / lineHeight) + 1;
        ensureSpace(cardsNeededLines);

        metricCards.forEach((card, idx) => {
          const x = leftMargin + idx * (cardW + cardsGap);
          doc.setDrawColor(216, 224, 236);
          doc.setLineWidth(0.25);
          doc.setFillColor(248, 250, 253);
          doc.roundedRect(x, cardsY, cardW, cardH, 1.6, 1.6, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(112, 120, 132);
          doc.text(card.name, x + cardW / 2, cardsY + 6.2, { align: 'center' });

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.6);
          doc.setTextColor(31, 93, 168);
          doc.text(card.value, x + cardW / 2, cardsY + 13.4, { align: 'center' });
        });
        yPos = cardsY + cardH + 6;

        // Written answer block: line-by-line, monospace, preserves code/SQL formatting
        if (hasWrittenAnswer && writtenAnswerRaw) {
          const writtenLabelY = yPos;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(30, 93, 168);
          doc.text('Written answer', leftMargin, writtenLabelY);
          yPos += 7;
          doc.setFont('courier', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          const lines = writtenAnswerRaw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const segments = doc.splitTextToSize(line, maxWidth);
            for (let s = 0; s < segments.length; s++) {
              if (yPos > pageHeight - bottomMargin) {
                doc.addPage();
                currentPageNum++;
                yPos = 20;
                doc.setFont('courier', 'normal');
                doc.setFontSize(8);
                doc.text('(written answer continued)', leftMargin, yPos);
                yPos += lineHeight;
              }
              doc.text(segments[s], leftMargin, yPos);
              yPos += lineHeight;
            }
          }
          yPos += 8;
        }

        // Next question starts on a fresh page only when there is a next question (avoids blank page after last question)
        if (hasWrittenAnswer && writtenAnswerRaw && idx < totalQuestions - 1) {
          doc.addPage();
          currentPageNum++;
        }
        currentPageNum++;
      });

      // Page after all questions: Speech Analysis — Overall Metrics Summary (Metric | Candidate score | Rating | Ideal range)
      if (hasBehavioralData) {
        const withBehavioral = (reportData?.answers ?? []).filter((a: any) => {
          const b = a.behavioral ?? a.behavioral_metrics;
          return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
        });
        const avg = (key: string, formatter: (v: number) => string) => {
          const vals = withBehavioral.map((a: any) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v: any) => typeof v === 'number');
          if (vals.length === 0) return null;
          const sum = vals.reduce((s: number, v: number) => s + v, 0);
          return formatter(sum / vals.length);
        };
        const avgNum = (key: string): number | null => {
          const vals = withBehavioral.map((a: any) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v: any) => typeof v === 'number');
          if (vals.length === 0) return null;
          return vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
        };
        const idealRanges: {
          key: string;
          name: string;
          getCandidate: () => string | null;
          getNum: () => number | null;
          ideal: string;
          definition: string;
        }[] = [
          {
            key: 'overall_speech_quality',
            name: 'Overall Speech Quality',
            getCandidate: () => avg('overall_speech_quality', (v) => `${Math.round(v)}`),
            getNum: () => avgNum('overall_speech_quality'),
            ideal: '85–100',
            definition: 'Composite score (0–100) from pace, fillers, pauses and confidence.',
          },
          {
            key: 'speaking_pace_wpm',
            name: 'Speaking Pace (WPM)',
            getCandidate: () => avg('speaking_pace_wpm', (v) => `${Math.round(v)} WPM`),
            getNum: () => avgNum('speaking_pace_wpm'),
            ideal: '110–170 WPM',
            definition: 'Words per minute calculated from audio duration.',
          },
          {
            key: 'filler_score',
            name: 'Filler Score',
            getCandidate: () => avg('filler_score', (v) => `${Math.round(v)}`),
            getNum: () => avgNum('filler_score'),
            ideal: '85–100',
            definition: 'Audio-detected filler sounds per speaking minute, converted to 0–100 (higher = fewer fillers).',
          },
          {
            key: 'pause_quality_score',
            name: 'Pause & Pacing',
            getCandidate: () => avg('pause_quality_score', (v) => `${Math.round(v)}`),
            getNum: () => avgNum('pause_quality_score'),
            ideal: '85–100',
            definition: 'Score based on appropriate pausing vs awkward or dead-air silences.',
          },
          {
            key: 'voice_confidence',
            name: 'Voice Confidence',
            getCandidate: () => avg('voice_confidence', (v) => `${Math.round(v)}`),
            getNum: () => avgNum('voice_confidence'),
            ideal: '80–100',
            definition: 'Score based on pitch variation, range, and vocal projection.',
          },
        ];
        const overallMetricsRows = idealRanges
          .map((r) => {
            const candidate = r.getCandidate();
            const numVal = r.getNum();
            if (candidate == null) return null;
            const rating = numVal != null ? getSpeechMetricRating(r.key, numVal) : 'Average';
            return { name: r.name, candidate, ideal: r.ideal, rating, definition: r.definition, key: r.key };
          })
          .filter(
            (r): r is { name: string; candidate: string; ideal: string; rating: SpeechMetricRating; definition: string; key: string } =>
              r != null
          );
        if (overallMetricsRows.length > 0) {
          const speechMargin = 8;
          const speechContentWidth = pageWidth - speechMargin * 2;
          doc.addPage();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text('SPEECH ANALYSIS — OVERALL METRICS SUMMARY', speechMargin, 20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text('The table below shows the candidate\'s overall average for each speech metric across the entire interview, compared against professionally accepted benchmark ranges.', speechMargin, 27, { maxWidth: speechContentWidth });
          doc.setTextColor(0, 0, 0);
          const overallTableBody = overallMetricsRows.map((r) => {
            return [
              r.name,
              `${r.candidate} (${r.rating})`,
              r.ideal,
              r.definition,
            ];
          });
          const summaryCol0 = speechContentWidth * 0.24;
          const summaryCol1 = speechContentWidth * 0.24;
          const summaryCol2 = speechContentWidth * 0.18;
          const summaryCol3 = speechContentWidth * 0.34;
          const overallTableStartY = 36;
          const overallHeaderH = 14;
          const overallCornerR = 2.5;

          // Custom rounded header band to avoid square-corner artifacts from autoTable headers.
          doc.setFillColor(4, 44, 83);
          doc.roundedRect(speechMargin, overallTableStartY, speechContentWidth, overallHeaderH, overallCornerR, overallCornerR, 'F');
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.2);
          const headerSep1 = speechMargin + summaryCol0;
          const headerSep2 = headerSep1 + summaryCol1;
          const headerSep3 = headerSep2 + summaryCol2;
          doc.line(headerSep1, overallTableStartY, headerSep1, overallTableStartY + overallHeaderH);
          doc.line(headerSep2, overallTableStartY, headerSep2, overallTableStartY + overallHeaderH);
          doc.line(headerSep3, overallTableStartY, headerSep3, overallTableStartY + overallHeaderH);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          const headerCenterY = overallTableStartY + overallHeaderH / 2 + 1;
          doc.text('Metric', speechMargin + summaryCol0 / 2, headerCenterY, { align: 'center' });
          const hdr2 = doc.splitTextToSize('Candidate score & rating', summaryCol1 - 8);
          hdr2.forEach((line: string, i: number) => {
            doc.text(line, headerSep1 + summaryCol1 / 2, headerCenterY - (hdr2.length - 1) * 2.2 + i * 4.4, { align: 'center' });
          });
          doc.text('Ideal range', headerSep2 + summaryCol2 / 2, headerCenterY, { align: 'center' });
          doc.text('Definition', headerSep3 + summaryCol3 / 2, headerCenterY, { align: 'center' });
          doc.setTextColor(0, 0, 0);

          autoTable(doc, {
            body: overallTableBody,
            startY: overallTableStartY + overallHeaderH,
            // Borderless table with light alternating row backgrounds
            styles: {
              fontSize: 8.5,
              cellPadding: 4,
              minCellHeight: 11,
              lineWidth: 0,
              lineColor: [255, 255, 255],
              textColor: [40, 40, 40],
              fillColor: [242, 242, 242],
              halign: 'center',
              valign: 'middle',
            },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            columnStyles: {
              0: { cellWidth: summaryCol0, halign: 'center', valign: 'middle' },
              1: { cellWidth: summaryCol1, halign: 'center', valign: 'middle' },
              2: { cellWidth: summaryCol2, halign: 'center', valign: 'middle' },
              3: { cellWidth: summaryCol3, halign: 'center', valign: 'middle' },
            },
            margin: { left: speechMargin, right: speechMargin },
            tableWidth: speechContentWidth,
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 1) {
                data.cell.text = [''];
              }
            },
            didDrawCell: (data) => {
              if (data.section !== 'body') return;
              if (data.column.index !== 1) return;
              const row = overallMetricsRows[data.row.index];
              if (!row) return;
              const style = SPEECH_RATING_STYLES[row.rating];
              const text = `${row.candidate} (${row.rating})`;
              const textWidth = doc.getTextWidth(text);
              const padX = 4;
              const padY = 2;
              const boxW = Math.min(textWidth + padX * 2, data.cell.width - 4);
              const boxH = Math.min(9, data.cell.height - 3);
              const boxX = data.cell.x + (data.cell.width - boxW) / 2;
              const boxY = data.cell.y + (data.cell.height - boxH) / 2;

              doc.setFillColor(style.rgb[0], style.rgb[1], style.rgb[2]);
              doc.rect(boxX, boxY, boxW, boxH, 'F');

              const prevFontSize = doc.getFontSize();
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(style.textRgb[0], style.textRgb[1], style.textRgb[2]);
              doc.text(text, data.cell.x + data.cell.width / 2, boxY + boxH / 2 + 1.5, { align: 'center' });
              doc.setFontSize(prevFontSize);
            },
          });
          const overallTableEndY = (doc as any).lastAutoTable?.finalY ?? (overallTableStartY + overallHeaderH + overallMetricsRows.length * 11);
          const overallTableHeight = Math.max(12, overallTableEndY - overallTableStartY);

          // Strong, continuous vertical separators for body rows only.
          const bodyStartY = overallTableStartY + overallHeaderH;
          doc.setDrawColor(208, 223, 245);
          doc.setLineWidth(0.45);
          doc.line(headerSep1, bodyStartY, headerSep1, overallTableEndY);
          doc.line(headerSep2, bodyStartY, headerSep2, overallTableEndY);
          doc.line(headerSep3, bodyStartY, headerSep3, overallTableEndY);

          doc.setDrawColor(208, 223, 245);
          doc.setLineWidth(0.8);
          doc.roundedRect(speechMargin, overallTableStartY, speechContentWidth, overallTableHeight, overallCornerR, overallCornerR, 'S');

          const rowByKey: Record<string, (typeof overallMetricsRows)[number]> = {};
          for (const r of overallMetricsRows) rowByKey[r.key] = r;
          const outerR = Math.min(37, speechContentWidth * 0.195);
          const ratingLegendItems: SpeechMetricRating[] = ['Good', 'Average', 'Needs Work'];
          const ratingBoxSize = 5;
          const ratingItemGap = 18;
          const gapTableToRatingLegend = 5;
          const ratingLegendRowY = overallTableStartY + overallTableHeight + gapTableToRatingLegend;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const ratingLegendBlockWidth = ratingLegendItems.reduce((acc, label, idx) => {
            const labelWidth = doc.getTextWidth(label);
            const itemWidth = ratingBoxSize + 3 + labelWidth;
            return acc + itemWidth + (idx < ratingLegendItems.length - 1 ? ratingItemGap : 0);
          }, 0);
          const ratingLegendStartX =
            speechMargin + Math.max(0, (speechContentWidth - ratingLegendBlockWidth) / 2);
          let ratingCursorX = ratingLegendStartX;
          ratingLegendItems.forEach((label, idx) => {
            const style = SPEECH_RATING_STYLES[label];
            const labelWidth = doc.getTextWidth(label);
            doc.setFillColor(style.rgb[0], style.rgb[1], style.rgb[2]);
            doc.rect(ratingCursorX, ratingLegendRowY, ratingBoxSize, ratingBoxSize, 'F');
            doc.setTextColor(0, 0, 0);
            doc.text(label, ratingCursorX + ratingBoxSize + 3, ratingLegendRowY + ratingBoxSize - 0.5);
            ratingCursorX += ratingBoxSize + 3 + labelWidth;
            if (idx < ratingLegendItems.length - 1) ratingCursorX += ratingItemGap;
          });

          const gapRatingToProfileTitle = 17;
          const chartTitleY = ratingLegendRowY + ratingBoxSize + gapRatingToProfileTitle;
          const gapProfileTitleToRadar = 26;
          const radarTopY = chartTitleY + gapProfileTitleToRadar;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(30, 93, 168);
          doc.text('SPEECH METRIC RADAR CHART', speechMargin, chartTitleY);

          const radarCanDraw = SPEECH_RADAR_ORDER.every((k) => rowByKey[k] != null);
          let radarBottomY = radarTopY;
          if (radarCanDraw) {
            const candidateRadar = SPEECH_RADAR_ORDER.map((k) => {
              const num = idealRanges.find((r) => r.key === k)?.getNum();
              return num == null ? 0 : normalizeSpeechRadarValue(k, num);
            });
            const idealMinRadar = SPEECH_RADAR_ORDER.map((k) =>
              normalizeSpeechRadarValue(k, SPEECH_RADAR_IDEAL_MIN[k])
            );
            const idealMaxRadar = SPEECH_RADAR_ORDER.map((k) =>
              normalizeSpeechRadarValue(k, SPEECH_RADAR_IDEAL_MAX[k])
            );
            const radarLabels = SPEECH_RADAR_ORDER.map((k) => SPEECH_RADAR_LABELS[k]);
            const cy = radarBottomY + outerR;
            const cx = speechMargin + speechContentWidth / 2;
            const approxLegendTextW = 30;
            const keyBox = 3;
            const legendX = Math.min(
              speechMargin + speechContentWidth - (keyBox + 2 + approxLegendTextW),
              cx + outerR + 22
            );
            drawSpeechMetricsRadarChart(doc, cx, cy, outerR, candidateRadar, idealMinRadar, idealMaxRadar, radarLabels);

            const lineGap = 4;
            const legendStackH = keyBox + lineGap + keyBox;
            const row1Top = cy - legendStackH / 2;
            doc.setFillColor(22, 163, 74);
            doc.rect(legendX, row1Top, keyBox, keyBox, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.9);
            doc.setTextColor(42, 42, 48);
            doc.text('Ideal range', legendX + keyBox + 2, row1Top + keyBox - 0.5);
            doc.setFillColor(37, 99, 235);
            doc.rect(legendX, row1Top + keyBox + lineGap, keyBox, keyBox, 'F');
            doc.text('Candidate', legendX + keyBox + 2, row1Top + keyBox + lineGap + keyBox - 0.5);

            radarBottomY = cy + outerR + 12;
          } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(120, 120, 128);
            doc.text('Radar chart needs all five metrics; some averages are missing.', speechMargin, chartTitleY + 10);
            doc.setFont('helvetica', 'normal');
            radarBottomY = chartTitleY + 22;
          }
        }
      }

      // Page: Detailed feedback on candidate speech abilities (candidate report only; recruiter report ends at speech scores)
      if (reportVariant !== 'recruiter') {
      const speechReport = reportData?.interview?.speech_detailed_report;
      if (speechReport && String(speechReport).trim()) {
        const speechMargin = 8;
        const speechContentWidth = pageWidth - speechMargin * 2;
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        // Slightly larger heading for this page title
        doc.setFontSize(14);
        doc.setTextColor(30, 93, 168);
        doc.text('DETAILED FEEDBACK ON CANDIDATE SPEECH ABILITIES', speechMargin, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const reportBody = shiftQuestionLabelsToOneBased(stripSpeechReportTitleLine(String(speechReport).trim()));
        const reportSections = parseSpeechReportSections(reportBody);

        const whereDidWellIndex = reportSections.findIndex((s) =>
          /^Where You Did Well$/i.test((s.section || '').trim())
        );

        const narrativeSections = reportSections.filter((s, idx) => {
          const title = (s.section || '').trim();
          if (/^What the Data Tells You$/i.test(title)) return false;
          if (whereDidWellIndex >= 0 && idx > whereDidWellIndex) return false;
          return true;
        });

        // Render narrative sections with bold black headings
        let yPos = 30;
        const pageHeight = doc.internal.pageSize.height;
        const bottomMargin = 28;
        const lineHeight = 5;

        const ensureSpace = (extraLines: number) => {
          if (yPos + extraLines * lineHeight > pageHeight - bottomMargin) {
            doc.addPage();
            doc.setFont('helvetica', 'normal');
            // Keep speech body typography consistent across page breaks.
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            yPos = 20;
          }
        };

        const speechSectionColorMap: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
          'how your delivery held up across the session': { bg: [232, 244, 255], text: [26, 86, 219] },
          'your consistent habits': { bg: [232, 244, 255], text: [26, 86, 219] },
          'where pressure changed your delivery': { bg: [232, 244, 255], text: [26, 86, 219] },
          'how you opened each answer': { bg: [232, 244, 255], text: [26, 86, 219] },
          'your flow and filler pattern': { bg: [236, 253, 245], text: [5, 122, 85] },
          'how you closed each answer': { bg: [254, 243, 199], text: [146, 64, 14] },
          'your vocal presence': { bg: [239, 246, 255], text: [30, 64, 175] },
          'what to protect': { bg: [240, 253, 244], text: [4, 120, 87] },
          'what to keep doing': { bg: [240, 253, 244], text: [4, 120, 87] },
          'what changed since last time': { bg: [245, 240, 255], text: [107, 70, 193] },
          'what an interviewer would have noticed': { bg: [255, 251, 235], text: [180, 83, 9] },
          'progress over your interviews': { bg: [245, 240, 255], text: [107, 70, 193] },
        };

        narrativeSections.forEach((section, sectionIdx) => {
          const title = (section.section || '').trim();
          const content = (section.content || '').trim();
          if (!title && !content) return;
          const sectionColor = speechSectionColorMap[title.toLowerCase()] || PARAM_COLOR_PALETTE[sectionIdx % PARAM_COLOR_PALETTE.length];
          const speechHeadingUpperKeys = new Set([
            'how you opened each answer',
            'your flow and filler pattern',
            'how you closed each answer',
            'your vocal presence',
            'what to keep doing',
            'progress over your interviews',
            'progress over interviews',
            'what an interviewer would have noticed',
          ]);
          const headingDisplay =
            speechHeadingUpperKeys.has(title.toLowerCase()) ? title.toUpperCase() : title;

          // Heading
          ensureSpace(5);
          // ensureSpace() may add a page and reset typography; re-apply heading style afterwards.
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          const headingBoxY = yPos - 2.5;
          const headingBoxH = 9;
          const headingTextX = speechMargin + 2.5;
          const headingTextY = headingBoxY + 6;
          doc.setFillColor(sectionColor.bg[0], sectionColor.bg[1], sectionColor.bg[2]);
          doc.roundedRect(speechMargin, headingBoxY, speechContentWidth, headingBoxH, 2, 2, 'F');
          doc.setTextColor(sectionColor.text[0], sectionColor.text[1], sectionColor.text[2]);
          doc.text(headingDisplay || '—', headingTextX, headingTextY);
          yPos = headingBoxY + headingBoxH + 6;

          // Body — plain text, no bold numbers (avoids jsPDF mixed-font spacing bugs)
          if (content) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            const bodyTextX = headingTextX;
            const bodyTextWidth = pageWidth - bodyTextX - speechMargin;
            const paragraphs = content.split(/\n{2,}/);
            paragraphs.forEach((para, idx) => {
              const text = para.trim();
              if (!text) return;
              const wrapped = doc.splitTextToSize(text, bodyTextWidth);
              wrapped.forEach((line: string) => {
                ensureSpace(1);
                doc.text(line, bodyTextX, yPos);
                yPos += lineHeight + 0.5;
              });
              if (idx < paragraphs.length - 1) {
                yPos += lineHeight + 1;
              }
            });
            yPos += lineHeight + 1;
          }
        });

        
      }

      // Page: Your Personalised Action Plan — checklist prefers `interview.set_of_actions` (same data as markdown tail).
      const actionPlan = reportData?.interview?.personalised_action_plan;
      const planRaw = String(actionPlan ?? '').trim();
      const planItems = planRaw ? parseActionPlanItems(planRaw) : [];
      const checklistPdfBlocks = resolveActionPlanChecklistBlocks(reportData?.interview, planRaw);
      const hasPlanBody = planRaw.length > 0;
      if (hasPlanBody || checklistPdfBlocks.length > 0) {
        const speechMargin = 8;
        const speechContentWidth = pageWidth - speechMargin * 2;
        if (hasPlanBody) {
          doc.addPage();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(30, 93, 168);
          doc.text('YOUR PERSONALISED ACTION PLAN', speechMargin, 20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
        }
        if (planItems.length > 0) {
          const leverageColors: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
            'Highest leverage': { bg: [246, 232, 235], text: [146, 27, 56] },
            'High leverage': { bg: [244, 233, 211], text: [120, 72, 8] },
            Maintenance: { bg: [229, 244, 231], text: [22, 101, 52] },
          };
          const normalizeLeverageLabel = (text: string): string => {
            const t = String(text || '').trim().toLowerCase();
            if (t === 'highest leverage') return 'Highest leverage';
            if (t === 'high leverage') return 'High leverage';
            if (t === 'maintenance') return 'Maintenance';
            return '';
          };
          const extractLeverage = (actionName: string): { cleanName: string; leverage: string } => {
            const nameRaw = String(actionName || '').replace(/\*\*/g, '').trim();
            const m = nameRaw.match(/\b(Highest leverage|High leverage|Maintenance)\b/i);
            const leverage = normalizeLeverageLabel(m?.[1] ?? '');
            const cleanName = nameRaw.replace(/\b(Highest leverage|High leverage|Maintenance)\b/i, '').replace(/\s{2,}/g, ' ').trim();
            return { cleanName: cleanName || '—', leverage };
          };

          let yPos = 28;
          const pageHeight = doc.internal.pageSize.height;
          const bottomMargin = 24;
          const lineHeight = 5.2;
          const numberBoxW = 9;
          const numberBoxH = 9;
          const numberBoxX = speechMargin;
          const titleX = numberBoxX + numberBoxW + 3;
          const badgeRightPadding = 3;
          const badgeH = 8;
          const contentX = speechMargin + 2;
          const contentWidth = speechContentWidth - 4;

          const estimateLines = (text: string, maxWidth: number, fontSize: number): number => {
            const prevFontSize = doc.getFontSize();
            doc.setFontSize(fontSize);
            const wrapped = doc.splitTextToSize(text || '—', maxWidth);
            doc.setFontSize(prevFontSize);
            return Math.max(1, wrapped.length);
          };
          const ensureSpace = (heightNeeded: number) => {
            if (yPos + heightNeeded > pageHeight - bottomMargin) {
              doc.addPage();
              yPos = 20;
              // Do not reset font size/color here — callers already set typography before drawing.
              // Previously forcing 9pt after addPage() ran between setFontSize(10) and doc.text(wrapped),
              // so body text on continuation pages rendered smaller than page 1.
            }
          };

          /** Bordered callout for “The cue” / “Between interviews” (lavender vs teal). */
          const drawV2HighlightBox = (
            label: string,
            body: string,
            box: {
              fill: [number, number, number];
              stroke: [number, number, number];
              header: [number, number, number];
              bodyRgb: [number, number, number];
            }
          ) => {
            const padX = 4;
            const padTop = 6;
            const padBottom = 5;
            const labelFontSize = 9;
            const bodyFontSize = 10;
            const labelLineH = 5;
            const bodyLineH = lineHeight;

            const boxX = contentX - 1;
            const boxW = contentWidth + 2;
            const textMaxW = boxW - padX * 2 - 1;

            const prevFontSize = doc.getFontSize();
            doc.setFontSize(bodyFontSize);
            const wrapped = doc.splitTextToSize(String(body || '—'), textMaxW);
            doc.setFontSize(prevFontSize);

            const bodyH = Math.max(1, wrapped.length) * bodyLineH;
            const boxH = padTop + labelFontSize * 0.8 + labelLineH + bodyH + padBottom;

            ensureSpace(boxH + 4);
            const boxY = yPos;

            doc.setFillColor(box.fill[0], box.fill[1], box.fill[2]);
            doc.setDrawColor(box.stroke[0], box.stroke[1], box.stroke[2]);
            doc.setLineWidth(0.3);
            doc.rect(boxX, boxY, boxW, boxH, 'FD');

            const labelBaseline = boxY + padTop + labelFontSize * 0.72;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(labelFontSize);
            doc.setTextColor(box.header[0], box.header[1], box.header[2]);
            doc.text(`${label}:`, boxX + padX, labelBaseline);

            const bodyStartBaseline = labelBaseline + labelLineH + 2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(bodyFontSize);
            doc.setTextColor(box.bodyRgb[0], box.bodyRgb[1], box.bodyRgb[2]);
            wrapped.forEach((line: string, i: number) => {
              doc.text(line, boxX + padX, bodyStartBaseline + i * bodyLineH);
            });

            yPos = boxY + boxH + 3;
          };

          const cueCalloutStyle = {
            fill: [234, 234, 248] as [number, number, number],
            stroke: [129, 140, 248] as [number, number, number],
            header: [76, 80, 191] as [number, number, number],
            bodyRgb: [26, 26, 26] as [number, number, number],
          };
          const betweenCalloutStyle = {
            fill: [204, 251, 241] as [number, number, number],
            stroke: [45, 212, 191] as [number, number, number],
            header: [15, 118, 110] as [number, number, number],
            bodyRgb: [26, 26, 26] as [number, number, number],
          };

          planItems.forEach((item, idx) => {
            const { cleanName, leverage } = extractLeverage(item.actionName || '');
            const leverageLabel = leverage || (idx === planItems.length - 1 ? 'Maintenance' : idx === 0 ? 'Highest leverage' : 'High leverage');
            const leverageStyle = leverageColors[leverageLabel] || leverageColors['High leverage'];
            const addressesText = item.addresses || '—';
            const descriptionText = item.description || '—';
            const outcomeText = item.expectedOutcome || '—';

            const evoLabel = item.evolutionLabel || '';
            const evoColors: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
              'IMPROVED': { bg: [220, 252, 231], text: [22, 101, 52] },
              'UNCHANGED': { bg: [243, 244, 246], text: [75, 85, 99] },
              'NEW': { bg: [219, 234, 254], text: [30, 64, 175] },
            };
            const evoStyle = evoColors[evoLabel];

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            const badgeTextWidth = doc.getTextWidth(leverageLabel);
            const badgePadX = 3;
            const badgeW = badgeTextWidth + badgePadX * 2;

            let evoBadgeW = 0;
            const evoBadgeGap = 2;
            if (evoStyle) {
              doc.setFontSize(7.5);
              const evoTextWidth = doc.getTextWidth(evoLabel);
              evoBadgeW = evoTextWidth + badgePadX * 2;
            }

            const totalBadgeWidth = badgeW + (evoStyle ? evoBadgeGap + evoBadgeW : 0);
            const badgeX = speechMargin + speechContentWidth - totalBadgeWidth - badgeRightPadding;
            const titleMaxWidth = Math.max(30, badgeX - titleX - 4);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            // Reserve only the action header first; let long body/outcome continue naturally.
            ensureSpace(16);

            // Number box
            doc.setFillColor(234, 234, 248);
            doc.rect(numberBoxX, yPos, numberBoxW, numberBoxH, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(76, 80, 191);
            doc.text(String(item.srNo || idx + 1), numberBoxX + numberBoxW / 2, yPos + 6.3, { align: 'center' });

            // Action title — light orange chip, dark orange uppercase text (matches web)
            const titleUpper = cleanName.toUpperCase();
            const titlePadX = 2.5;
            const titlePadY = 2;
            const titleLineH = 5.2;
            const titleInnerW = Math.max(10, titleMaxWidth - titlePadX * 2);
            const titleLines = doc.splitTextToSize(titleUpper, titleInnerW);
            const titleBoxW = Math.min(titleMaxWidth + 4, badgeX - titleX - 2);
            const titleBoxH = titlePadY * 2 + titleLines.length * titleLineH + 1;
            doc.setFillColor(255, 237, 213);
            doc.setDrawColor(254, 215, 170);
            doc.setLineWidth(0.25);
            doc.roundedRect(titleX - 0.5, yPos + 0.5, titleBoxW, titleBoxH, 1.4, 1.4, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(154, 52, 18);
            doc.text(titleLines, titleX + titlePadX, yPos + titlePadY + 4.2);

            // Leverage badge
            doc.setFillColor(leverageStyle.bg[0], leverageStyle.bg[1], leverageStyle.bg[2]);
            doc.rect(badgeX, yPos + 0.7, badgeW, badgeH, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(leverageStyle.text[0], leverageStyle.text[1], leverageStyle.text[2]);
            doc.text(leverageLabel, badgeX + badgeW / 2, yPos + 6, { align: 'center' });

            // Evolution label badge (only for follow-up interviews)
            if (evoStyle) {
              const evoBadgeX = badgeX + badgeW + evoBadgeGap;
              doc.setFillColor(evoStyle.bg[0], evoStyle.bg[1], evoStyle.bg[2]);
              doc.rect(evoBadgeX, yPos + 0.7, evoBadgeW, badgeH, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7.5);
              doc.setTextColor(evoStyle.text[0], evoStyle.text[1], evoStyle.text[2]);
              doc.text(evoLabel, evoBadgeX + evoBadgeW / 2, yPos + 6, { align: 'center' });
            }

            yPos += Math.max(14, titleBoxH + 5);

            if (item.format === 'v2') {
              const v2PlainRows: { label: string; text: string }[] = [
                { label: 'What you did', text: item.whatYouDid || '—' },
                { label: 'Why it matters', text: item.whyItMatters || '—' },
              ];
              for (const row of v2PlainRows) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text(`${row.label.toUpperCase()}:`, contentX, yPos);
                yPos += lineHeight;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                const wrapped = doc.splitTextToSize(row.text, contentWidth);
                ensureSpace(Math.max(1, wrapped.length) * lineHeight + 3);
                doc.text(wrapped, contentX, yPos);
                yPos += Math.max(1, wrapped.length) * lineHeight + 2;
              }
              if ((item.theCue || '').trim()) {
                drawV2HighlightBox('The cue', item.theCue || '—', cueCalloutStyle);
              }
              drawV2HighlightBox('BETWEEN INTERVIEWS', item.betweenInterviews || '—', betweenCalloutStyle);
            } else {
              const addressesPrefix = 'Addresses: ';
              const addressesPrefixWidth = doc.getTextWidth(addressesPrefix);
              const outcomeLabelLines = estimateLines('-> Expected outcome', contentWidth - 4, 9);
              const outcomeBodyLines = estimateLines(outcomeText, contentWidth - 4, 10);
              const outcomeBoxH = 6 + (outcomeLabelLines * (lineHeight - 0.4)) + 3 + (outcomeBodyLines * lineHeight) + 4;
              // Addresses line
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              doc.setTextColor(90, 90, 90);
              doc.text(addressesPrefix, contentX, yPos);
              const addressValueX = contentX + addressesPrefixWidth;
              const addressWrapped = doc.splitTextToSize(addressesText, Math.max(20, contentWidth - addressesPrefixWidth));
              ensureSpace(Math.max(1, addressWrapped.length) * lineHeight + 2);
              doc.text(addressWrapped, addressValueX, yPos);
              yPos += Math.max(1, addressWrapped.length) * lineHeight + 1.5;

              // Description
              doc.setTextColor(60, 60, 60);
              const descWrapped = doc.splitTextToSize(descriptionText, contentWidth);
              ensureSpace(Math.max(1, descWrapped.length) * lineHeight + 4);
              doc.text(descWrapped, contentX, yPos);
              yPos += Math.max(1, descWrapped.length) * lineHeight + 3.5;

              // Expected outcome box
              ensureSpace(outcomeBoxH + 5);
              const outcomeBoxY = yPos;
              doc.setFillColor(234, 243, 227);
              doc.setDrawColor(146, 183, 117);
              doc.setLineWidth(0.3);
              doc.rect(contentX - 1, outcomeBoxY, contentWidth + 2, outcomeBoxH, 'FD');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9);
              doc.setTextColor(67, 119, 24);
              doc.text('Expected outcome', contentX + 2, outcomeBoxY + 5.2);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              doc.setTextColor(63, 90, 38);
              const outcomeWrapped = doc.splitTextToSize(outcomeText, contentWidth - 4);
              doc.text(outcomeWrapped, contentX + 2, outcomeBoxY + 11);
              yPos += outcomeBoxH + 5;
            }

            if (idx < planItems.length - 1) {
              yPos += 5;
            }
          });

          drawActionPlanChecklistPdf(doc, checklistPdfBlocks, speechMargin, speechContentWidth, {
            resumeY: yPos + (checklistPdfBlocks.length > 0 ? 7.5 : 0),
          });
        } else if (hasPlanBody) {
          const planBody = normalizeActionPlanText(splitPersonalisedActionPlan(planRaw).planBody);
          const formattedEndY = drawFormattedReportText(doc, planBody, {
            startX: speechMargin,
            startY: 28,
            maxWidth: speechContentWidth,
            lineHeight: 5.5,
            pageHeight: doc.internal.pageSize.height,
            bottomMargin: 28,
            fontSize: 9,
          });
          drawActionPlanChecklistPdf(doc, checklistPdfBlocks, speechMargin, speechContentWidth, {
            resumeY: formattedEndY + (checklistPdfBlocks.length > 0 ? 7.5 : 0),
          });
        } else {
          drawActionPlanChecklistPdf(doc, checklistPdfBlocks, speechMargin, speechContentWidth);
        }
      }
      }

      // Add closing/disclaimer page
      doc.addPage();
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const disclaimerLines = [
        'This report combines AI content evaluation with advanced speech analysis.',
        'Metrics are calculated using speech analysis and machine learning.',
        'This report was created by the smart assessment system ProValuate.'
      ];
      const lineHeight = 8;
      const pageHeightForDisclaimer = doc.internal.pageSize.height;
      let disclaimerY = pageHeightForDisclaimer / 2 - (disclaimerLines.length * lineHeight) / 2;
      disclaimerLines.forEach((line) => {
        doc.text(line, pageWidth / 2, disclaimerY, { align: 'center' });
        disclaimerY += lineHeight;
      });
      // Single final pass: redraw footer on every page with consistent font (helvetica 8pt) and correct "Page X of Y"
      const totalPages = (doc.internal as any).getNumberOfPages();
      const footerYUniform = doc.internal.pageSize.height - 8;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text("Don't just evaluate, ProValuate.", pageWidth / 2, footerYUniform, { align: 'center' });
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - 15, footerYUniform, { align: 'right' });
      }

      // Save the PDF with proper filename
      const candidateName = interview.candidate_name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Interview_Report_${candidateName}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Generate and download the PDF
      doc.save(fileName);
      
      // Show success message after a small delay to ensure download started
      setTimeout(() => {
        toast.success('PDF report downloaded successfully!', { id: 'pdf-generate-success' });
      }, 500);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report', { id: 'pdf-generate-error' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden bg-white text-gray-900">
      {/* Header - dark blue bar with title and Menu */}
      <header className={`flex-shrink-0 border-b min-h-[72px] sm:min-h-[80px] flex items-center ${headerBg}`}>
        <div className="w-full pl-4 sm:pl-6 pr-4 sm:pr-6 py-4 sm:py-5 flex items-center justify-between gap-4">
          {/* Left: Title and subtitle */}
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white truncate">
              Competency-Based Assessment Analysis
            </h1>
            <p className="text-xs sm:text-sm text-white/90 mt-0.5">
              AI Evaluation and Communication Insights
            </p>
          </div>
          {/* Right: Menu - aligned to end, vertically centered */}
          <div className="flex items-center flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center gap-2 min-h-[44px] px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-medium transition-colors touch-manipulation ${btnOutline} flex-shrink-0`}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span>Menu</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(reportVariant === 'recruiter' ? '/dashboard?section=interview-dashboard' : '/candidate-dashboard/performance-report')}>
                  <LayoutDashboard className="mr-2 h-4 w-4 flex-shrink-0" />
                  {reportVariant === 'recruiter' ? 'Back to Dashboard' : 'Back to My Interviews'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={generatePDFReport}
                  disabled={isGeneratingPDF}
                  className={isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                  )}
                  Download PDF Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareReport}>
                  <Share2 className="mr-2 h-4 w-4 flex-shrink-0" />
                  Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content - full width as old setup */}
      <div className="flex-1 w-full min-w-0 py-4 sm:py-8 px-4 sm:px-6 pb-8 sm:pb-12 overflow-x-hidden">
        <div className="mx-auto w-full max-w-screen-2xl">
        {/* Tabs */}
        <nav className="mb-4 sm:mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-gray-200 bg-white" role="tablist">
          <div className="flex min-w-max gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ov'}
              onClick={() => setActiveTab('ov')}
              className={`px-4 py-3 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'ov'
                  ? 'text-[#0d6ea3] border-[#0d6ea3] font-semibold'
                  : 'text-gray-600 border-transparent hover:text-[#0d6ea3]'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'dd'}
              onClick={() => setActiveTab('dd')}
              className={`px-4 py-3 text-base font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
                activeTab === 'dd'
                  ? 'text-[#0d6ea3] border-[#0d6ea3] font-semibold'
                  : 'text-gray-600 border-transparent hover:text-[#0d6ea3]'
              }`}
            >
              Question Deep Dive
              <span className="inline-flex items-center justify-center rounded-full bg-[#0d6ea3]/10 px-2 py-0.5 text-sm font-semibold text-[#0d6ea3]">
                {reportData?.questions?.length ?? 0}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'sp'}
              onClick={() => setActiveTab('sp')}
              className={`px-4 py-3 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'sp'
                  ? 'text-[#0d6ea3] border-[#0d6ea3] font-semibold'
                  : 'text-gray-600 border-transparent hover:text-[#0d6ea3]'
              }`}
            >
              Speech &amp; Coaching
            </button>
          </div>
        </nav>

        {/* ═══ TAB 1 — OVERVIEW ═══ */}
        {activeTab === 'ov' && (
        <>
        {/* Interview Overview - Two Cards */}
        <div className="grid grid-cols-1 sm:[grid-template-columns:minmax(260px,320px)_1fr] gap-4 sm:gap-6 mb-6 sm:mb-10 items-stretch">
          {/* Card 1: Overall Score - Circular Diagram */}
          <div className="rounded-lg p-4 sm:p-6 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] border border-gray-200 shadow-sm flex flex-col items-center justify-center w-full">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {isCandidateReport && (
                  <defs>
                    <linearGradient id="scoreRingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#1a9fd6" />
                    </linearGradient>
                  </defs>
                )}
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={isCandidateReport ? 'url(#scoreRingGradient)' : accentHex}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(10, Math.max(0, Number(interview?.overall_score) || 0)) / 10) * 263} 263`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl sm:text-4xl font-bold ${accentText}`}>
                  {displayInterviewScore != null ? `${formatOverallScore(displayInterviewScore)}/10` : 'N/A'}
                </span>
                <span className="text-sm sm:text-base text-gray-600 mt-1">Overall Score</span>
              </div>
            </div>
            <div className={`text-sm sm:text-base mt-2 px-3 py-1 rounded-full text-white ${getScoreClass(displayInterviewScore || 0)}`}>
              {getScoreLabel(displayInterviewScore || 0)}
            </div>
          </div>

          {/* Card 2: Interview Summary */}
          <div className="rounded-lg p-4 sm:p-6 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] border border-gray-200 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center text-gray-900">
              <BarChart3 className={`h-5 w-5 sm:h-6 sm:w-6 mr-2 ${accentText} flex-shrink-0`} />
              Interview Summary
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg text-gray-600">Candidate:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{interview?.candidate_name ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg text-gray-600">Role:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{interview?.position ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg text-gray-600">Date:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">
                  {formatOrdinalDate(interview?.completed_at || interview?.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg text-gray-600">Duration:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">
                  {interview?.completed_at && interview?.started_at
                    ? `${Math.round((new Date(interview.completed_at).getTime() - new Date(interview.started_at).getTime()) / 60000)} minutes`
                    : `${Math.round(Number(interview?.duration_minutes) || 30)} minutes`
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg text-gray-600">Competencies Evaluated:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{competencyCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg text-gray-600">Total Questions:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{interview?.total_questions ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Competency Performance */}
        {reportData?.questions?.length && reportData?.answers?.length ? (
          <div className="rounded-lg p-4 sm:p-6 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] border border-gray-200 shadow-sm mb-6 sm:mb-10">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center text-gray-900">
              <Award className={`h-5 w-5 sm:h-6 sm:w-6 mr-2 ${accentText} flex-shrink-0`} />
              Competency Performance
            </h2>

            {(() => {
              const competencyGroups: Record<string, { name: string; scoreSum: number; count: number }> = {};
              (reportData.questions || []).forEach((q: any) => {
                const key = q.parameter_key || q.parameter_name || 'General';
                const name = q.parameter_name || q.parameter_key || 'General';
                if (!competencyGroups[key]) competencyGroups[key] = { name, scoreSum: 0, count: 0 };
                const ans = (reportData.answers || []).find((a: any) => a.question_order === q.question_order);
                if (ans && typeof ans.score === 'number') {
                  competencyGroups[key].scoreSum += ans.score;
                  competencyGroups[key].count += 1;
                }
              });

              const rows = Object.values(competencyGroups)
                .filter((g) => g.count > 0)
                .map((g) => ({ name: g.name, avg: g.scoreSum / g.count }))
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 6);

              if (rows.length === 0) {
                return <p className="text-sm sm:text-base text-gray-600">No competency scores available yet.</p>;
              }

              const colorFor = (v: number) => (v >= 7 ? 'bg-emerald-500' : v >= 5 ? 'bg-amber-500' : 'bg-red-500');

              return (
                <div className="space-y-3">
                  {rows.map((r) => (
                    <div key={r.name} className="grid grid-cols-[minmax(220px,1fr)_minmax(180px,1fr)_52px] gap-2 items-center">
                      <div className="text-base sm:text-lg text-gray-700 leading-snug break-words">{r.name}</div>
                      <div className="h-2.5 rounded-full bg-slate-100 border border-slate-900 overflow-hidden">
                        <div
                          className={`h-full ${colorFor(r.avg)}`}
                          style={{ width: `${Math.max(0, Math.min(100, (r.avg / 10) * 100))}%` }}
                        />
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-gray-900 text-right tabular-nums">
                        {Number.isFinite(r.avg) ? r.avg.toFixed(1) : 'N/A'}
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 text-sm text-gray-600 flex flex-wrap gap-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                      7–10 Good
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm bg-amber-500" />
                      5–6.9 Average
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm bg-red-500" />
                      &lt; 5 Needs Work
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* Speech details card (dialog) */}
        <Dialog open={showSpeechDetailsCard} onOpenChange={setShowSpeechDetailsCard}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl">Speech details</DialogTitle>
            </DialogHeader>
            <p className="text-base sm:text-lg text-gray-600 mb-6">
              For further details and detailed analysis, please download the PDF.
            </p>
            {reportData?.answers && (() => {
              const answers = reportData.answers;
              const withBehavioral = answers.filter((a) => {
                const b = a.behavioral ?? a.behavioral_metrics;
                return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
              });
              if (withBehavioral.length === 0) return null;

              const avg = (key: string, formatter: (v: number) => string = (v) => String(v)) => {
                const vals = withBehavioral.map((a) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v): v is number => typeof v === 'number');
                if (vals.length === 0) return null;
                const sum = vals.reduce((s, v) => s + v, 0);
                return formatter(sum / vals.length);
              };
              const avgNum = (key: string): number | null => {
                const vals = withBehavioral.map((a) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v): v is number => typeof v === 'number');
                if (vals.length === 0) return null;
                return vals.reduce((s, v) => s + v, 0) / vals.length;
              };
              const metricConfig = [
                { key: 'overall_speech_quality', name: 'Overall speech quality', getCandidate: () => avg('overall_speech_quality', (v) => `${Math.round(v)}/100`), ideal: '85–100' },
                { key: 'speaking_pace_wpm', name: 'Speaking pace (WPM)', getCandidate: () => avg('speaking_pace_wpm', (v) => `${Math.round(v)} WPM`), ideal: '110–170' },
                { key: 'filler_score', name: 'Filler score', getCandidate: () => avg('filler_score', (v) => `${Math.round(v)}/100`), ideal: '85–100' },
                { key: 'pause_quality_score', name: 'Pause & pacing', getCandidate: () => avg('pause_quality_score', (v) => `${Math.round(v)}/100`), ideal: '85–100' },
                { key: 'voice_confidence', name: 'Voice confidence', getCandidate: () => avg('voice_confidence', (v) => `${Math.round(v)}/100`), ideal: '80–100' },
              ];
              const metrics = metricConfig
                .map((m) => {
                  const candidate = m.getCandidate();
                  const numVal = avgNum(m.key);
                  if (candidate == null) return null;
                  const rating = numVal != null ? getSpeechMetricRating(m.key, numVal) : 'Average';
                  return { name: m.name, candidate, ideal: m.ideal, rating, numVal };
                })
                .filter((m): m is NonNullable<typeof m> => m != null);

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-base sm:text-lg border border-gray-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className={`${tableHeaderBg} text-white`}>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Metric</th>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Candidate Average</th>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Ideal Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((m, i) => {
                        const style = SPEECH_RATING_STYLES[m.rating];
                        return (
                          <tr key={m.name} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="py-3 px-4 text-gray-700">{m.name}</td>
                            <td className={`py-3 px-4 font-medium ${style.bg} ${style.text}`}>{m.candidate}</td>
                            <td className="py-3 px-4 text-gray-600">{m.ideal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
        </>
        )}

        {/* ═══ TAB 2 — QUESTION DEEP DIVE ═══ */}
        {activeTab === 'dd' && reportData?.questions && reportData.questions.length > 0 && (
          <div className="rounded-lg p-3 sm:p-6 bg-white border border-gray-200 shadow-sm mt-2 sm:mt-4">
            {/* Competency cards */}
            {(() => {
              // Safety check - ensure data exists
              if (!reportData.questions || !reportData.answers) {
                return (
                  <div className={`text-center py-12 ${
                    'text-gray-500'
                  }`}>
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Loading assessment data...</p>
                    </div>
                );
              }

              // Group questions by competency (API fields: parameter_key / parameter_name)
              const competencyGroups = {};
              reportData.questions.forEach(question => {
                const paramKey = question.parameter_key || question.parameter_name;
                if (!competencyGroups[paramKey]) {
                  competencyGroups[paramKey] = {
                    name: question.parameter_name,
                    key: paramKey,
                    questions: [],
                    totalScore: 0,
                    questionCount: 0
                  };
                }
                const answer = reportData.answers?.find(a => a.question_order === question.question_order);
                if (answer) {
                  competencyGroups[paramKey].questions.push({ question, answer });
                  competencyGroups[paramKey].totalScore += answer.score || 0;
                  competencyGroups[paramKey].questionCount += 1;
                }
              });

              // Add Personal Questions as a group if they exist
              if (reportData.personalized_answers && reportData.personalized_answers.length > 0) {
                competencyGroups['personal-questions'] = {
                  name: 'Personal Questions',
                  key: 'personal-questions',
                  questions: reportData.personalized_answers.map((answer, index) => ({
                    question: { question_text: answer.question_text, question_order: `personal-${index}` },
                    answer: { ...answer, score: null } // No scoring for personal questions
                  })),
                  totalScore: 0,
                  questionCount: reportData.personalized_answers.length,
                  averageScore: null, // No scoring for personal questions
                  isPersonal: true
                };
              }

              // Calculate average scores for each competency (except personal questions)
              Object.values(competencyGroups).forEach((param: any) => {
                if (!param.isPersonal) {
                  param.averageScore = param.questionCount > 0 ? Math.round((param.totalScore / param.questionCount) * 10) / 10 : 0;
                }
              });

              // Check if we have any competency groups with questions
              if (Object.keys(competencyGroups).length === 0) {
                return (
                  <div className={`text-center py-12 ${
                    'text-gray-500'
                  }`}>
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No assessment data available</p>
                    <p className="text-sm">Assessment questions and answers are still being processed</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Competency tabs with performance metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-8">
                    {Object.entries(competencyGroups).map(([paramKey, param]: [string, any]) => (
                      <button
                        key={paramKey}
                        onClick={() => { setSelectedCompetencyKey(paramKey); setExpandedQuestions(new Set()); }}
                        className={`p-3 sm:p-6 rounded-xl transition-all duration-200 text-left min-w-0 ${
                          selectedCompetencyKey === paramKey
                            ? `${paramSelected} shadow-lg transform scale-105`
                            : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-102 shadow-sm hover:shadow-md'
                        }`}
                      >
                          <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide opacity-80">Competency:</p>
                                <h4 className="font-bold text-sm sm:text-lg leading-tight break-words">{param.name}</h4>
                              </div>
                            {param.isPersonal ? (
                              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                selectedCompetencyKey === paramKey
                                  ? paramBadgeSelected
                                  : paramBadge
                              }`}>
                                Review Only
                              </div>
                            ) : (
                              <div className={`text-2xl sm:text-3xl font-bold ${
                                selectedCompetencyKey === paramKey 
                                  ? accentText
                                  : getScoreColor(param.averageScore)
                              }`}>
                                {param.averageScore}/10
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex justify-between text-sm sm:text-lg font-medium opacity-90">
                              {param.isPersonal ? (
                                <span>No scoring applied</span>
                              ) : (
                                <span>Weight: {(() => {
                                  // Calculate weight based on question count relative to total (excluding personal questions)
                                  const functionalQuestions = Object.values(competencyGroups).reduce((sum: number, p: any) => 
                                    p.isPersonal ? sum : sum + (p.questionCount as number), 0) as number;
                                  const weight = functionalQuestions > 0 ? Math.round(((param.questionCount as number) / functionalQuestions) * 100) : 0;
                                  return weight;
                                })()}%</span>
                              )}
                              <span>{param.questionCount} questions</span>
                            </div>
                            
                            {/* Performance bar — scored competencies only */}
                            {!param.isPersonal ? (
                              <div className={`w-full rounded-full h-3 ${
                                'bg-gray-300'
                              }`}>
                                <div 
                                  className={`h-3 rounded-full transition-all duration-300 ${
selectedCompetencyKey === paramKey 
                                  ? barSelected
                                  : getScoreClass(param.averageScore)
                                  }`}
                                  style={{ width: `${param.averageScore * 10}%` }}
                                ></div>
                              </div>
                            ) : (
                              /* Placeholder space for Personal Questions to maintain uniform card height */
                              <div className="w-full h-3"></div>
                            )}
                  </div>
                </div>
                      </button>
              ))}
            </div>

                  {/* Questions for selected competency */}
                  {selectedCompetencyKey && competencyGroups[selectedCompetencyKey] && (
            <div className="space-y-6 mt-6">
                      {/* Question cards - vertical list with Expand */}
                      <div className="space-y-4 sm:space-y-5">
                        {competencyGroups[selectedCompetencyKey].questions.map(({ question, answer }: { question: any; answer: any }, idx: number) => {
                          const expandKey = `${selectedCompetencyKey}-${idx}`;
                          const isExpanded = expandedQuestions.has(expandKey);
                          return (
                            <div
                              key={idx}
                              className={`rounded-xl border border-gray-200 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] shadow-sm overflow-hidden ${cardHover} transition-colors cursor-pointer`}
                              onClick={() => toggleQuestion(expandKey)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleQuestion(expandKey); } }}
                            >
                              <div className="flex items-start justify-between gap-5 p-6 sm:p-8 min-h-[140px] sm:min-h-[160px]">
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="flex items-center gap-3 mb-3">
                                    <span className="font-bold text-base sm:text-lg text-gray-900">
                                      {`Question [Q${
                                        Number.isFinite(Number(question?.question_order))
                                          ? Number(question.question_order) + 1
                                          : idx + 1
                                      }]`}
                                    </span>
                                    {!competencyGroups[selectedCompetencyKey].isPersonal && answer?.score != null && (
                                      <span className={`text-xl sm:text-2xl font-bold ${getScoreColor(answer.score)}`}>{answer.score}/10</span>
                                    )}
                                  </div>
                                  <p className="text-base sm:text-lg text-gray-600 line-clamp-3">{question?.question_text || 'No question text'}</p>
                                </div>
                                <div className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-base font-medium ${expandBtn} rounded-lg`}>
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="px-5 sm:px-8 pb-5 sm:pb-8 pt-0 border-t border-gray-100 space-y-5 sm:space-y-6" onClick={(e) => e.stopPropagation()}>
                                  <div>
                                    <h5 className="font-bold mb-2 text-base sm:text-lg text-gray-900">Answer:</h5>
                                    <p className="text-base sm:text-lg text-gray-700 break-words">{answer.transcript || 'No transcript available'}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {answer.audio_url && (
                                      <button onClick={() => playAudio(answer.audio_url)} className={`inline-flex items-center gap-2 px-4 py-2 ${btnPrimary} text-white rounded-lg text-sm`}>
                                        <Download className="h-4 w-4" /> Play Audio
                                      </button>
                                    )}
                                    {answer.question_video_url && (
                                      <button onClick={() => playVideo(answer.question_video_url)} className={`inline-flex items-center gap-2 px-4 py-2 ${btnPrimary} text-white rounded-lg text-sm`}>
                                        <Download className="h-4 w-4" /> Play Video
                                      </button>
                                    )}
                                    {answer.written_answer && (
                                      <button onClick={() => showWrittenAnswer(answer.written_answer)} className={`inline-flex items-center gap-2 px-4 py-2 ${btnPrimary} text-white rounded-lg text-sm`}>
                                        <FileText className="h-4 w-4" /> Show Written Answer
                                      </button>
                                    )}
                                  </div>
                                  {!competencyGroups[selectedCompetencyKey].isPersonal && (
                                    <div>
                                      <h5 className="font-bold mb-2 text-base sm:text-lg text-gray-900">AI Feedback:</h5>
                                      <p className="text-base sm:text-lg text-gray-700 break-words">{answer.feedback || 'Feedback analysis pending - will be available soon'}</p>
                                    </div>
                                  )}
                                  {(answer.behavioral || answer.behavioral_metrics) && (
                                    <div className="p-5 bg-[#BFD7FF] rounded-lg border border-sky-200">
                                      <h5 className="font-bold mb-3 text-base sm:text-lg text-gray-900">Speech Analysis</h5>
                                      {(() => {
                                        const b = answer.behavioral || answer.behavioral_metrics;
                                        return (
                                          <>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm sm:text-base">
                                              <div><span className="text-gray-600">Overall speech quality</span><span className="font-semibold block">{b.overall_speech_quality != null ? `${b.overall_speech_quality}/100` : '-'}</span></div>
                                              <div><span className="text-gray-600">Speaking pace</span><span className="font-semibold block">{b.speaking_pace_wpm ?? '-'} WPM</span></div>
                                              <div><span className="text-gray-600">Filler score</span><span className="font-semibold block">{b.filler_score != null ? `${b.filler_score}/100` : '-'}{b.filler_rate_per_min != null ? ` (${Number(b.filler_rate_per_min).toFixed(1)}/min)` : ''}</span></div>
                                              <div>
                                                <span className="text-gray-600">Pause & pacing</span>
                                                <span className="font-semibold flex items-center gap-2 flex-wrap">
                                                  {b.pause_quality_score != null ? `${b.pause_quality_score}/100` : '-'}
                                                  {b.cold_start_detected && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">⚠ Hesitation at start</span>
                                                  )}
                                                  {b.trailing_off_detected && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">⚠ Trailed off at close</span>
                                                  )}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Voice confidence</span>
                                                <span className="font-semibold flex items-center gap-2 flex-wrap">
                                                  {b.voice_confidence != null ? `${b.voice_confidence}/100` : '-'}
                                                  {b.uptalk_ratio != null && Number(b.uptalk_ratio) > 0.35 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">⚠ Uptalk detected</span>
                                                  )}
                                                </span>
                                              </div>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No competency selected */}
                  {!selectedCompetencyKey && (
                    <div className="text-center py-8 sm:py-16 text-gray-500 px-2">
                      <p className="text-base sm:text-xl font-medium break-words">Select a competency to view its questions</p>
                      <p className="text-sm sm:text-lg mt-2 sm:mt-3 leading-relaxed break-words">Click a competency card above, then expand a question to see full details</p>
                    </div>
                  )}
                  </div>
                );
            })()}
          </div>
        )}

        {/* ═══ TAB 3 — SPEECH & COACHING ═══ */}
        {activeTab === 'sp' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Speech Metrics — Overall Average */}
            <div className="rounded-lg p-4 sm:p-6 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] border border-gray-200 shadow-sm">
              <div
                className="mb-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                role="button"
                tabIndex={0}
                aria-expanded={speechSectionExpanded.metrics}
                onClick={() => toggleSpeechSection('metrics')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSpeechSection('metrics');
                  }
                }}
              >
                <h2 className="text-lg sm:text-xl font-bold flex items-center text-gray-900 tracking-[0.06em]">
                  SPEECH METRICS — VISUAL REPRESENTATION
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSpeechSection('metrics');
                  }}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#0d6ea3] hover:text-[#042C53]"
                  aria-expanded={speechSectionExpanded.metrics}
                >
                  {speechSectionExpanded.metrics ? 'Collapse' : 'Expand'}
                  {speechSectionExpanded.metrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {!speechSectionExpanded.metrics && (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-sm font-semibold text-[#042C53]">Quick preview</div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="font-semibold text-slate-800">Radar</div>
                      <div className="mt-1">Compare ideal band vs your score across 5 metrics.</div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="font-semibold text-slate-800">Bars</div>
                      <div className="mt-1">See your score and ideal range on the same scale.</div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="font-semibold text-slate-800">Hover insights</div>
                      <div className="mt-1">Hover points to view candidate, ideal min & ideal max.</div>
                    </div>
                  </div>
                </div>
              )}

              {speechSectionExpanded.metrics && reportData?.answers && (() => {
                const answers = reportData.answers;
                const withBehavioral = answers.filter((a) => {
                  const b = a.behavioral ?? a.behavioral_metrics;
                  return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
                });
                if (withBehavioral.length === 0) {
                  return <p className="text-sm sm:text-base text-gray-600">No speech metrics available for this interview.</p>;
                }

                const avg = (key: string, formatter: (v: number) => string = (v) => String(v)) => {
                  const vals = withBehavioral.map((a) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v): v is number => typeof v === 'number');
                  if (vals.length === 0) return null;
                  const sum = vals.reduce((s, v) => s + v, 0);
                  return formatter(sum / vals.length);
                };
                const avgNum = (key: string): number | null => {
                  const vals = withBehavioral.map((a) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v): v is number => typeof v === 'number');
                  if (vals.length === 0) return null;
                  return vals.reduce((s, v) => s + v, 0) / vals.length;
                };

                const metricConfig = [
                  { key: 'overall_speech_quality', name: 'Overall speech quality', getCandidate: () => avg('overall_speech_quality', (v) => `${Math.round(v)}/100`), getNum: () => avgNum('overall_speech_quality'), ideal: { min: 85, max: 100 }, max: 100 },
                  { key: 'speaking_pace_wpm', name: 'Speaking pace (WPM)', getCandidate: () => avg('speaking_pace_wpm', (v) => `${Math.round(v)} WPM`), getNum: () => avgNum('speaking_pace_wpm'), ideal: { min: 110, max: 170 }, max: 220 },
                  { key: 'filler_score', name: 'Filler score', getCandidate: () => avg('filler_score', (v) => `${Math.round(v)}/100`), getNum: () => avgNum('filler_score'), ideal: { min: 85, max: 100 }, max: 100 },
                  { key: 'pause_quality_score', name: 'Pause & pacing', getCandidate: () => avg('pause_quality_score', (v) => `${Math.round(v)}/100`), getNum: () => avgNum('pause_quality_score'), ideal: { min: 85, max: 100 }, max: 100 },
                  { key: 'voice_confidence', name: 'Voice confidence', getCandidate: () => avg('voice_confidence', (v) => `${Math.round(v)}/100`), getNum: () => avgNum('voice_confidence'), ideal: { min: 80, max: 100 }, max: 100 },
                ] as const;

                const metrics = metricConfig
                  .map((m) => {
                    const candidate = m.getCandidate();
                    const numVal = m.getNum();
                    if (candidate == null) return null;
                    const rating = numVal != null ? getSpeechMetricRating(m.key, numVal) : 'Average';
                    return { ...m, candidate, numVal, rating };
                  })
                  .filter((m): m is NonNullable<typeof m> => m != null);

                const polarPoint = (cx: number, cy: number, r: number, angleRad: number) => ({
                  x: cx + r * Math.cos(angleRad),
                  y: cy + r * Math.sin(angleRad),
                });
                const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
                const toNorm = (raw: number | null | undefined, max: number) => (raw == null ? 0 : clamp01(Number(raw) / max));
                const toNormIdeal = (raw: number, max: number) => clamp01(raw / max);

                const Radar = () => {
                  const [hovered, setHovered] = useState<null | { label: string; value: string; x: number; y: number }>(null);
                  const size = 700;
                  const pad = 110;
                  const cx = size / 2;
                  const cy = size / 2;
                  const rMax = (size / 2) - pad;
                  const axes = metrics;
                  const n = axes.length;
                  const start = -Math.PI / 2;
                  const step = (Math.PI * 2) / n;

                  const axisLabel = (k: string) => {
                    if (k === 'overall_speech_quality') return 'Overall quality';
                    if (k === 'speaking_pace_wpm') return 'Speaking pace';
                    if (k === 'filler_score') return 'Filler score';
                    if (k === 'pause_quality_score') return 'Pause & pacing';
                    if (k === 'voice_confidence') return 'Voice confidence';
                    return k;
                  };
                  const formatIdeal = (k: string, v: number) => (k === 'speaking_pace_wpm' ? `${v} WPM` : `${v}/100`);

                  const poly = (vals: number[]) =>
                    vals
                      .map((v, i) => {
                        const a = start + i * step;
                        const p = polarPoint(cx, cy, rMax * clamp01(v), a);
                        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
                      })
                      .join(' ');

                  const idealMin = axes.map((m) => toNormIdeal(m.ideal.min, m.max));
                  const idealMax = axes.map((m) => toNormIdeal(m.ideal.max, m.max));
                  const candidate = axes.map((m) => toNorm(m.numVal, m.max));

                  const gridLevels = [0.25, 0.5, 0.75, 1];

                  const idealBandPath = (() => {
                    // Build a ring path: outer (idealMax) + inner (idealMin reversed)
                    const outer = idealMax.map((v, i) => {
                      const a = start + i * step;
                      const p = polarPoint(cx, cy, rMax * clamp01(v), a);
                      return { x: p.x, y: p.y };
                    });
                    const inner = idealMin.map((v, i) => {
                      const a = start + i * step;
                      const p = polarPoint(cx, cy, rMax * clamp01(v), a);
                      return { x: p.x, y: p.y };
                    });
                    const move = (p: { x: number; y: number }) => `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
                    const line = (p: { x: number; y: number }) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
                    const close = 'Z';
                    const outerPath = `${move(outer[0])} ${outer.slice(1).map(line).join(' ')} ${close}`;
                    const innerRev = [...inner].reverse();
                    const innerPath = `${move(innerRev[0])} ${innerRev.slice(1).map(line).join(' ')} ${close}`;
                    return `${outerPath} ${innerPath}`;
                  })();

                  return (
                    <div className="flex flex-col items-center relative">
                      <div className="relative mt-3">
                        <svg
                          viewBox={`0 0 ${size} ${size}`}
                          preserveAspectRatio="xMidYMid meet"
                          className="h-[560px] w-[560px] max-w-full overflow-visible sm:h-[640px] sm:w-[640px]"
                        >
                          {/* grid */}
                          {gridLevels.map((lvl) => (
                            <polygon
                              key={lvl}
                              points={poly(new Array(n).fill(lvl))}
                              fill="none"
                              stroke="rgba(148,163,184,0.55)"
                              strokeWidth="1.25"
                            />
                          ))}
                          {/* axes */}
                          {axes.map((m, i) => {
                            const a = start + i * step;
                            const p = polarPoint(cx, cy, rMax, a);
                            return (
                              <line
                                key={m.key}
                                x1={cx}
                                y1={cy}
                                x2={p.x}
                                y2={p.y}
                                stroke="rgba(148,163,184,0.55)"
                                strokeWidth="1.25"
                              />
                            );
                          })}

                          {/* ideal band (ring) */}
                          <path
                            d={idealBandPath}
                            fill="rgba(34,197,94,0.26)"
                            fillRule="evenodd"
                            stroke="rgba(34,197,94,0.70)"
                            strokeWidth="2.25"
                          />

                          {/* candidate */}
                          <polygon points={poly(candidate)} fill="rgba(13,110,163,0.22)" stroke="rgba(13,110,163,0.92)" strokeWidth="2.75" />

                          {/* labels */}
                          {axes.map((m, i) => {
                            const a = start + i * step;
                            const p = polarPoint(cx, cy, rMax + 20, a);
                            const anchor =
                              Math.abs(Math.cos(a)) < 0.25 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
                            return (
                              <text
                                key={`${m.key}-lbl`}
                                x={p.x}
                                y={p.y}
                                textAnchor={anchor as any}
                                dominantBaseline="middle"
                                fontSize="16"
                                fill="#334155"
                              >
                                {axisLabel(m.key)}
                              </text>
                            );
                          })}

                          {/* ideal min/max dots + candidate dots */}
                          {axes.map((m, i) => {
                            const a = start + i * step;
                            const pMin = polarPoint(cx, cy, rMax * clamp01(idealMin[i] ?? 0), a);
                            const pMax = polarPoint(cx, cy, rMax * clamp01(idealMax[i] ?? 0), a);
                            const pCand = polarPoint(cx, cy, rMax * clamp01(candidate[i] ?? 0), a);
                            const label = axisLabel(m.key);
                            const scoreLabel = m.candidate || '—';
                            return (
                              <g key={`${m.key}-dots`}>
                                {/* ideal min */}
                                <circle
                                  cx={pMin.x}
                                  cy={pMin.y}
                                  r={5.5}
                                  fill="white"
                                  stroke="rgba(34,197,94,0.95)"
                                  strokeWidth="2"
                                  style={{ cursor: 'default' }}
                                  onMouseEnter={() => setHovered({ label: `${label} (ideal min)`, value: formatIdeal(m.key, m.ideal.min), x: pMin.x, y: pMin.y })}
                                  onMouseMove={() => setHovered({ label: `${label} (ideal min)`, value: formatIdeal(m.key, m.ideal.min), x: pMin.x, y: pMin.y })}
                                  onMouseLeave={() => setHovered(null)}
                                />
                                {/* ideal max */}
                                <circle
                                  cx={pMax.x}
                                  cy={pMax.y}
                                  r={5.5}
                                  fill="white"
                                  stroke="rgba(34,197,94,0.95)"
                                  strokeWidth="2"
                                  style={{ cursor: 'default' }}
                                  onMouseEnter={() => setHovered({ label: `${label} (ideal max)`, value: formatIdeal(m.key, m.ideal.max), x: pMax.x, y: pMax.y })}
                                  onMouseMove={() => setHovered({ label: `${label} (ideal max)`, value: formatIdeal(m.key, m.ideal.max), x: pMax.x, y: pMax.y })}
                                  onMouseLeave={() => setHovered(null)}
                                />

                                {/* candidate */}
                                <circle
                                  cx={pCand.x}
                                  cy={pCand.y}
                                  r={7}
                                  fill="white"
                                  stroke="rgba(13,110,163,0.95)"
                                  strokeWidth="2"
                                  style={{ cursor: 'default' }}
                                  onMouseEnter={() => setHovered({ label: `${label} (candidate)`, value: scoreLabel, x: pCand.x, y: pCand.y })}
                                  onMouseMove={() => setHovered({ label: `${label} (candidate)`, value: scoreLabel, x: pCand.x, y: pCand.y })}
                                  onMouseLeave={() => setHovered(null)}
                                />
                                <circle cx={pCand.x} cy={pCand.y} r={4} fill="rgba(13,110,163,0.95)" pointerEvents="none" />
                              </g>
                            );
                          })}
                        </svg>

                        {hovered && (
                          <div
                            className="pointer-events-none absolute rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-lg"
                            style={{
                              left: hovered.x,
                              top: hovered.y,
                              transform: 'translate(-50%, -110%)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span className="font-semibold">{hovered.label}:</span> {hovered.value}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                };

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-gray-900">
                          Metric Chart (
                          <span className="inline-flex items-center gap-1">
                            Ideal <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" />
                          </span>
                          {' '}vs{' '}
                          <span className="inline-flex items-center gap-1">
                            Actual Captured <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0d6ea3]" />
                          </span>
                          )
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-6 flex items-center justify-center overflow-visible">
                          <Radar />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-gray-900">
                          Speech Metrics Bar Representation
                        </div>
                        <div className="flex flex-col">
                          <div className="grid grid-rows-5 gap-4">
                            {metrics.map((m) => {
                              const style = SPEECH_RATING_STYLES[m.rating];
                              const v = toNorm(m.numVal, m.max);
                              const idealMin = toNormIdeal(m.ideal.min, m.max);
                              const idealMax = toNormIdeal(m.ideal.max, m.max);
                              const left = idealMin * 100;
                              const width = Math.max(0, (idealMax - idealMin) * 100);
                              const right = Math.min(100, left + width);
                              const candidatePct = Math.max(0, Math.min(100, v * 100));
                              const labelPos = (pct: number) => {
                                const c = Math.max(0, Math.min(100, pct));
                                const transform = c < 8 ? 'translateX(0%)' : c > 92 ? 'translateX(-100%)' : 'translateX(-50%)';
                                return { left: `${c}%`, transform };
                              };
                              return (
                                <div key={m.key} className="rounded-lg border border-gray-200 bg-white p-4 h-full flex flex-col justify-center overflow-hidden">
                                  {/* Row 1: Metric name -> candidate score bar */}
                                  <div className="mt-1 grid grid-cols-[140px_1fr] items-center gap-3">
                                    <div className="text-sm font-semibold text-slate-800">
                                      {m.name}:
                                    </div>
                                    <div className="relative pt-5">
                                      {/* label above the bar */}
                                      <div className="pointer-events-none absolute top-0 left-0 right-0 h-5 px-1">
                                        <span
                                          className="absolute top-0 whitespace-nowrap text-[11px] font-semibold text-slate-800"
                                          style={labelPos(candidatePct)}
                                        >
                                          {m.candidate}
                                        </span>
                                      </div>

                                      <div className="relative h-3 rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                          className="absolute top-0 bottom-0 rounded-full"
                                          style={{
                                            width: `${v * 100}%`,
                                            background: m.rating === 'Good' ? 'rgba(34,197,94,0.95)' : m.rating === 'Needs Work' ? 'rgba(239,68,68,0.92)' : 'rgba(202,138,4,0.95)',
                                          }}
                                          aria-hidden="true"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Row 2: Ideal Range -> ideal band bar */}
                                  <div className="mt-5 grid grid-cols-[140px_1fr] items-center gap-3">
                                    <div className="text-sm font-semibold text-slate-700">
                                      Ideal Range:
                                    </div>
                                    <div className="relative pt-5">
                                      {/* labels above the bar */}
                                      <div className="pointer-events-none absolute top-0 left-0 right-0 h-5 px-1">
                                        <span
                                          className="absolute top-0 whitespace-nowrap text-[11px] font-semibold text-slate-700"
                                          style={labelPos(left)}
                                        >
                                          {m.ideal.min}
                                        </span>
                                        <span
                                          className="absolute top-0 whitespace-nowrap text-[11px] font-semibold text-slate-700"
                                          style={labelPos(right)}
                                        >
                                          {m.ideal.max}
                                        </span>
                                      </div>

                                      <div className="relative h-3 rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                          className="absolute top-0 bottom-0 bg-green-300/70"
                                          style={{ left: `${left}%`, width: `${width}%` }}
                                          aria-hidden="true"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 text-xs text-gray-600">
                            Each bar shows your score (coloured) against the ideal zone (green). Bars outside the ideal zone need attention.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table removed (redundant with radar + bars) */}
                  </div>
                );
              })()}
            </div>

            {/* Speech Narrative */}
            <div className="rounded-lg p-4 sm:p-6 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] border border-gray-200 shadow-sm">
              <div
                className="mb-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                role="button"
                tabIndex={0}
                aria-expanded={speechSectionExpanded.narrative}
                onClick={() => toggleSpeechSection('narrative')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSpeechSection('narrative');
                  }
                }}
              >
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-[0.06em]">
                  SPEECH NARRATIVE
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSpeechSection('narrative');
                  }}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#0d6ea3] hover:text-[#042C53]"
                  aria-expanded={speechSectionExpanded.narrative}
                >
                  {speechSectionExpanded.narrative ? 'Collapse' : 'Expand'}
                  {speechSectionExpanded.narrative ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {!speechSectionExpanded.narrative && (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-sm font-semibold text-[#042C53]">Quick preview</div>
                  <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                    A section-wise breakdown of your speech performance with strengths, issues, and coaching guidance.
                  </div>
                </div>
              )}
              {speechSectionExpanded.narrative && (() => {
                const speechReport = reportData?.interview?.speech_detailed_report;
                if (!speechReport || !String(speechReport).trim()) {
                  return <p className="text-sm sm:text-base text-gray-600">No narrative available yet. Download the PDF for the full analysis when it’s ready.</p>;
                }
                const reportBody = shiftQuestionLabelsToOneBased(
                  stripSpeechReportTitleLine(String(speechReport).trim()).replace(/''/g, "'")
                );
                const sections = parseSpeechReportSections(reportBody);
                if (!sections.length) {
                  return <p className="text-sm sm:text-base text-gray-600 whitespace-pre-line">{reportBody}</p>;
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sections.map((s) => (
                      <div key={s.section} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0d6ea3]">{s.section}</div>
                        <p className="mt-2 text-sm sm:text-base text-gray-800 leading-relaxed whitespace-pre-line">{s.content}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Personalised Action Plan + Checklist */}
            <div className="rounded-lg p-4 sm:p-6 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] border border-gray-200 shadow-sm">
              <div
                className="mb-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                role="button"
                tabIndex={0}
                aria-expanded={speechSectionExpanded.plan}
                onClick={() => toggleSpeechSection('plan')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSpeechSection('plan');
                  }
                }}
              >
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-[0.06em]">
                  PERSONALISED ACTION PLAN
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSpeechSection('plan');
                  }}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#0d6ea3] hover:text-[#042C53]"
                  aria-expanded={speechSectionExpanded.plan}
                >
                  {speechSectionExpanded.plan ? 'Collapse' : 'Expand'}
                  {speechSectionExpanded.plan ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {!speechSectionExpanded.plan && (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-sm font-semibold text-[#042C53]">Quick preview</div>
                  <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                    A personalised set of improvement actions and (when available) a checklist you can tick off as you practice.
                  </div>
                </div>
              )}
              {speechSectionExpanded.plan && (() => {
                const planRaw = String(reportData?.interview?.personalised_action_plan ?? '').trim();
                const items = planRaw ? parseActionPlanItems(planRaw) : [];
                const checklistBlocks = resolveActionPlanChecklistBlocks(reportData?.interview, planRaw);
                const normalizeLeverageLabel = (raw: string): 'Highest leverage' | 'High leverage' | 'Maintenance' | '' => {
                  const t = String(raw || '').trim().toLowerCase();
                  if (t === 'highest leverage') return 'Highest leverage';
                  if (t === 'high leverage') return 'High leverage';
                  if (t === 'maintenance') return 'Maintenance';
                  return '';
                };
                const extractLeverageFromTitle = (actionName: string): { cleanName: string; leverage: 'Highest leverage' | 'High leverage' | 'Maintenance' | '' } => {
                  const nameRaw = String(actionName || '').replace(/\*\*/g, '').trim();
                  const m = nameRaw.match(/\b(Highest leverage|High leverage|Maintenance)\b/i);
                  const leverage = normalizeLeverageLabel(m?.[1] ?? '');
                  const cleanName = nameRaw
                    .replace(/\b(Highest leverage|High leverage|Maintenance)\b/i, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
                  return { cleanName: cleanName || '—', leverage };
                };
                const leverageBadgeClass: Record<'Highest leverage' | 'High leverage' | 'Maintenance', string> = {
                  'Highest leverage': 'bg-rose-100 text-rose-800 border border-rose-200',
                  'High leverage': 'bg-amber-100 text-amber-800 border border-amber-200',
                  Maintenance: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
                };
                const hasAny = items.length > 0 || checklistBlocks.length > 0;
                if (!hasAny) return <p className="text-sm sm:text-base text-gray-600">No personalised action plan available yet.</p>;
                return (
                  <div className="space-y-6">
                    {items.length > 0 && (
                      <div className="space-y-4">
                        {items.map((it, idx) => {
                          const parsed = extractLeverageFromTitle(it.actionName || '');
                          const fallbackLeverage =
                            idx === items.length - 1 ? 'Maintenance' : idx === 0 ? 'Highest leverage' : 'High leverage';
                          const leverage = parsed.leverage || fallbackLeverage;
                          return (
                      <div key={`${it.srNo}-${it.actionName}`} className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3 pb-4 sm:pb-5">
                          <div className="min-w-0">
                            <div className="text-sm font-bold tracking-[0.08em] text-gray-700 uppercase">Action {it.srNo}</div>
                            <div className="mt-1 inline-block max-w-full rounded-md border border-orange-200 bg-orange-100 px-3 py-2 text-base sm:text-lg font-semibold uppercase tracking-wide text-orange-900">
                              {parsed.cleanName}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${leverageBadgeClass[leverage]}`}>
                              {leverage}
                            </span>
                            {it.evolutionLabel ? (
                              <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                {it.evolutionLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {it.format === 'v2' ? (
                          <div className="mt-12 sm:mt-14 space-y-5 border-l-2 border-slate-200/80 pl-4 sm:pl-5 pt-2 text-sm sm:text-base text-gray-800">
                            {it.whatYouDid ? (
                              <div>
                                <div className="text-sm font-bold tracking-[0.08em] text-gray-700 uppercase">What you did</div>
                                <p className="mt-1 leading-relaxed">{it.whatYouDid}</p>
                              </div>
                            ) : null}
                            {it.whyItMatters ? (
                              <div>
                                <div className="text-sm font-bold tracking-[0.08em] text-gray-700 uppercase">Why it matters</div>
                                <p className="mt-1 leading-relaxed">{it.whyItMatters}</p>
                              </div>
                            ) : null}
                            {it.betweenInterviews ? (
                              <div className="rounded-md border border-[#0d6ea3]/20 bg-[#0d6ea3]/5 p-3">
                                <div className="text-sm font-bold tracking-[0.08em] text-[#0d6ea3] uppercase">Between interviews</div>
                                <p className="mt-1 leading-relaxed text-gray-800">{it.betweenInterviews}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3 text-sm sm:text-base text-gray-800">
                            {it.addresses ? <p><span className="font-semibold">Addresses:</span> {it.addresses}</p> : null}
                            {it.description ? <p><span className="font-semibold">Description:</span> {it.description}</p> : null}
                            {it.expectedOutcome ? <p><span className="font-semibold">Expected outcome:</span> {it.expectedOutcome}</p> : null}
                          </div>
                        )}
                      </div>
                          );
                        })}
                      </div>
                    )}

                    {checklistBlocks.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-bold text-gray-900 tracking-[0.06em]">
                            ACTION PLAN CHECKLIST
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleSpeechSection('checklist')}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#0d6ea3] hover:text-[#042C53]"
                            aria-expanded={speechSectionExpanded.checklist}
                          >
                            {speechSectionExpanded.checklist ? 'Collapse' : 'Expand'}
                            {speechSectionExpanded.checklist ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                        {speechSectionExpanded.checklist && (
                          <div className="mt-3 space-y-4">
                            {checklistBlocks.map((b) => (
                              <div key={b.action_title} className="rounded-lg border border-gray-200 bg-white p-4">
                                <div className="text-xs font-semibold tracking-[0.08em] text-gray-600 uppercase">
                                  {b.action_title}
                                </div>
                                <div className="mt-3 space-y-2">
                                  {b.items.map((txt) => {
                                    const key = `${b.action_title}::${txt}`;
                                    const on = !!checklistChecked[key];
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => setChecklistChecked((m) => ({ ...m, [key]: !on }))}
                                        className="w-full flex items-start gap-3 text-left"
                                      >
                                        <span
                                          className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                                            on ? 'bg-[#0d6ea3] border-[#0d6ea3]' : 'bg-white border-gray-300'
                                          }`}
                                          aria-hidden="true"
                                        >
                                          {on ? <span className="text-white text-xs font-bold">✓</span> : null}
                                        </span>
                                        <span className={`text-sm sm:text-base leading-relaxed ${on ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                          {txt}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Personalised action plan + checklist: included in downloaded PDF only; not rendered on web results. */}

        {/* Complete Session Video */}
        {reportData.interview?.session_video_url && (
          <div className="rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300 bg-white border border-gray-200 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Complete Session Video</h3>
            <div className="rounded-lg p-3 sm:p-4 transition-colors duration-300 bg-gray-50 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h4 className="font-medium text-gray-900">🎥 Full Interview Session</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Complete video recording from start to finish
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 break-words">
                    Size: {reportData.interview.session_video_size ? `${(reportData.interview.session_video_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown'} | Format: WebM
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => playVideo(reportData.interview.session_video_url)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg ${btnPrimary} text-white text-sm sm:text-base font-medium transition-colors touch-manipulation flex-1 sm:flex-none`}
                  >
                    Play Full Video
                  </button>
                  <a
                    href={reportData.interview.session_video_url}
                    download
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base font-medium transition-colors touch-manipulation flex-1 sm:flex-none"
                  >
                    Download Video
                  </a>
                </div>
              </div>
              <div className="rounded p-3 transition-colors duration-300 bg-gray-100 border border-gray-300">
                <h5 className={`font-medium mb-2 ${
                  'text-gray-900'
                }`}>📹 This video contains the complete interview session including:</h5>
                <ul className={`text-sm space-y-1 ${
                  'text-gray-600'
                }`}>
                  <li>• Candidate's facial expressions and body language</li>
                  <li>• Complete audio from all questions</li>
                  <li>• Full session duration: {Math.round(Number(reportData.interview.duration_minutes) || 30)} minutes</li>
                  <li>• Professional assessment context</li>
                  {reportData.answers && reportData.answers.some(answer => answer.question_video_url) && (
                    <li>• Individual question videos are also available above for easier review</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Video Modal */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4 flex-shrink-0 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Question Video Player</h3>
              <button
                onClick={closeVideo}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:text-gray-900 touch-manipulation"
                aria-label="Close video"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-2 sm:p-4 min-h-0 flex-1 overflow-auto">
              <video
                controls
                autoPlay
                muted
                className="w-full h-auto max-h-[70vh] rounded-lg"
                src={playingVideo}
              >
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Audio Modal */}
      {playingAudio && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4 flex-shrink-0 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Question Audio Player</h3>
              <button
                onClick={closeAudio}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:text-gray-900 touch-manipulation"
                aria-label="Close audio"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-3 sm:p-6 overflow-auto min-h-0">
              <div className="rounded-lg p-4 sm:p-6 text-center transition-colors duration-300 bg-gray-50 border border-gray-200">
                <div className="mb-4 sm:mb-6">
                  <div className={`w-16 h-16 sm:w-24 sm:h-24 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                    <Download className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Audio Recording</h4>
                  <p className="text-sm sm:text-base text-gray-600">Question answer audio playback</p>
                </div>
                <audio
                  controls
                  autoPlay
                  className="w-full max-w-md mx-auto"
                  src={playingAudio}
                >
                  Your browser does not support the audio element.
                </audio>
                <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
                  Use the controls above to play, pause, and seek through the audio
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Written Answer Modal */}
      {showingWrittenAnswer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4 flex-shrink-0 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Written Answer</h3>
              <button
                onClick={closeWrittenAnswer}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:text-gray-900 touch-manipulation"
                aria-label="Close written answer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-3 sm:p-6 overflow-auto min-h-0 flex-1">
              <div className="rounded-lg p-4 sm:p-6 transition-colors duration-300 bg-white border border-gray-200">
                <textarea
                  value={showingWrittenAnswer}
                  readOnly
                  className="w-full h-64 sm:h-96 p-3 sm:p-4 text-sm sm:text-base text-gray-800 bg-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="No written answer available..."
                />
                <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500 text-center">
                  This is the exact written answer submitted by the candidate during the interview
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinalResults;
