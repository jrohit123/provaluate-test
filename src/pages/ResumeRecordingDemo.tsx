import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Upload, FileText, User, CheckCircle, Play as PlayBtn, Briefcase, Grid,
  Loader2, File, Check, RefreshCw, Download,
  Play, Volume2, VolumeX, RotateCcw,
} from 'lucide-react';

// ─── Demo data (Power BI Developer, real production shapes) ─────────────────
const DEMO_JD       = { id: 'pbi-jd',   title: 'Power BI Developer' };
const DEMO_CRITERIA = { id: 'pbi-crit', name: 'Power BI Developer - Scoring Criteria' };

const DEMO_FILES = [
  { name: 'Arjun_Mehta_resume.pdf',   size: '0.7 MB' },
  { name: 'Priya_Sharma_resume.docx',  size: '0.5 MB' },
  { name: 'Rohit_Verma_resume.txt',   size: '0.8 MB' },
  { name: 'Sneha_Nair_resume.pdf',    size: '0.6 MB' },
];

// Candidate pool — compact list rows
const POOL: {
  id: string; name: string; status: string; score: number;
  summary: string;
  scores: { parameter: string; score: number; weightage: number }[];
  strengths: string[]; clarifications: string[]; weaknesses: string[]; overallSummary: string;
  recommendation: string;
}[] = [
  {
    id: 'c1', name: 'Arjun Mehta', status: 'To Be Interviewed', score: 84,
    summary: 'To be interviewed',
    scores: [
      { parameter: 'Technical Skills',  score: 8.5, weightage: 30 },
      { parameter: 'Experience Level',  score: 7.5, weightage: 25 },
      { parameter: 'Education',         score: 9.0, weightage: 15 },
      { parameter: 'Soft Skills',       score: 8.0, weightage: 20 },
      { parameter: 'Stability',         score: 8.5, weightage: 10 },
    ],
    strengths: [
      'Strong hands-on experience with Power BI Desktop, DAX, M Query and Power Query.',
      'Holds a Bachelor\'s degree in Computer Engineering — meets mandatory qualification.',
      'Consistent employment history with an average tenure of 2.5 years per company.',
      'Excellent communication skills with demonstrated customer-facing experience.',
    ],
    clarifications: [
      'Experience with PowerBI Gateway configuration is mentioned but not detailed with specific projects.',
      'Certifications listed; PL-300 relevance needs confirmation.',
    ],
    weaknesses: [
      'Limited exposure to Microsoft Azure Data Platform integration.',
    ],
    overallSummary: 'Arjun presents a strong match for the Power BI Developer role with solid technical skills and relevant experience. Recommend scheduling a technical interview focusing on complex DAX scenarios and deployment experience.',
    recommendation: 'To Be Interviewed — Strong alignment with technical requirements. Schedule a 45-minute technical screen focusing on DAX, Power Query transformations, and a live dashboard walkthrough.',
  },
  {
    id: 'c2', name: 'Priya Sharma', status: 'Review Further', score: 61,
    summary: 'Review further',
    scores: [
      { parameter: 'Technical Skills',  score: 6.0, weightage: 30 },
      { parameter: 'Experience Level',  score: 5.5, weightage: 25 },
      { parameter: 'Education',         score: 7.5, weightage: 15 },
      { parameter: 'Soft Skills',       score: 7.0, weightage: 20 },
      { parameter: 'Stability',         score: 6.0, weightage: 10 },
    ],
    strengths: [
      'Holds a relevant Computer Science degree.',
      'Good analytical and documentation skills demonstrated in previous roles.',
      'Familiarity with SQL queries and basic Power BI reporting.',
    ],
    clarifications: [
      'DAX and M Query experience is mentioned at a basic level; depth unclear.',
      'No explicit mention of PowerBI Gateway configuration.',
    ],
    weaknesses: [
      'Limited hands-on experience with Power BI Service and administration features.',
      'Only 1 year of relevant BI experience — below the expected 0–2 year threshold in terms of quality.',
    ],
    overallSummary: 'Priya shows foundational knowledge but lacks depth in key Power BI technical areas. A brief technical screening call is recommended before a final decision.',
    recommendation: 'Review Further — Conduct a short technical call to assess practical Power BI skills before proceeding to a full interview.',
  },
  {
    id: 'c3', name: 'Rohit Verma', status: 'Candidature Rejected', score: 28,
    summary: 'Candidature rejected',
    scores: [
      { parameter: 'Technical Skills',  score: 2.0, weightage: 30 },
      { parameter: 'Experience Level',  score: 2.5, weightage: 25 },
      { parameter: 'Education',         score: 4.0, weightage: 15 },
      { parameter: 'Soft Skills',       score: 3.0, weightage: 20 },
      { parameter: 'Stability',         score: 3.5, weightage: 10 },
    ],
    strengths: [
      'Holds a Bachelor\'s degree in a related field.',
    ],
    clarifications: [],
    weaknesses: [
      'No evidence of experience with Power BI or any BI tool.',
      'Background is primarily in front-end web development — significant mismatch.',
      'No SQL, DAX, or data modeling experience mentioned.',
      'Communication skills present but not validated in a data analytics context.',
    ],
    overallSummary: 'Rohit\'s profile shows a fundamental mismatch with the Power BI Developer requirements. His background is in web development with no demonstrable BI or data experience.',
    recommendation: 'Candidature Rejected — Profile does not align with the core technical requirements for this role. Consider for web development roles if available.',
  },
  {
    id: 'c4', name: 'Sneha Nair', status: 'Candidature Rejected', score: 45,
    summary: 'Candidature rejected',
    scores: [
      { parameter: 'Technical Skills',  score: 4.5, weightage: 30 },
      { parameter: 'Experience Level',  score: 4.0, weightage: 25 },
      { parameter: 'Education',         score: 5.5, weightage: 15 },
      { parameter: 'Soft Skills',       score: 5.0, weightage: 20 },
      { parameter: 'Stability',         score: 4.5, weightage: 10 },
    ],
    strengths: [
      'Some experience with basic Excel-based data analysis and reporting.',
      'Good soft skills with prior client communication experience.',
    ],
    clarifications: [
      'Listed "data visualization" in skills but no Power BI-specific tools mentioned.',
    ],
    weaknesses: [
      'No hands-on Power BI Desktop or Power Query experience.',
      'Lacks DAX, M Query, or PowerBI Service knowledge.',
      'Education is in a non-technical field — does not meet the preferred engineering degree criterion.',
    ],
    overallSummary: 'Sneha has transferable soft skills but does not meet the technical requirements for this Power BI Developer role. The absence of core BI tooling experience is a critical gap.',
    recommendation: 'Candidature Rejected — Critical technical skills gap. Advise candidate to complete Power BI training and apply again once practical experience is gained.',
  },
];

// ─── TTS Script ─────────────────────────────────────────────────────────────
const TTS = {
  idle: 'Watch ProValuate screen an entire candidate pool in minutes, saving hours of manual effort while helping you hire stronger talent, faster.',
  upload: 'Either Upload the résumés or get them from your ATS or even your mailbox. It also lets you have a branded career page where applicants can apply from. ProValuate accepts all formats, so you can move from applications to decisions quickly.',
  processing: 'Every candidate is evaluated against your hiring standards, exposing top performers and reducing costly hiring mistakes.',
  pool: 'Your shortlist is ready! Instantly identify your strongest candidates instead of wasting time reviewing every résumé manually.',
  detail: 'Open any candidate for a complete hiring picture. This candidate scores 84% with an Interview recommendation, supported by strengths, clarifications, gaps & even what to look for when you call them.',
  close: 'A HUGE problem with most AI tools is that it decide who gets shortlisted for you. ProValuate lets YOU define success. Then applies your standards consistently, helping you hire people matching YOUR business and not what looks good on paper.',
};
type DemoStep = 'idle'|'upload'|'processing'|'pool'|'detail'|'close';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.98; u.pitch = 1; u.volume = 1;
  const vv = window.speechSynthesis.getVoices();
  const v = vv.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google'))) || vv.find(v => v.lang.startsWith('en'));
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function recBadge(status: string) {
  if (status === 'To Be Interviewed')   return 'bg-green-100 text-green-700';
  if (status === 'Candidature Rejected') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

// ─── Processing overlay (exact production replica) ───────────────────────────
const STEPS = ['Extracting resume content','Analysing with AI','Scoring against criteria','Saving results'];
function Overlay({ visible, idx, done }: { visible:boolean; idx:number; done:boolean }) {
  if (!visible) return null;
  return createPortal(
    <>
      <style>{`@keyframes procIn{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200/90 bg-white p-6
          shadow-[0_8px_32px_rgba(15,23,42,0.12)] opacity-0
          animate-[procIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <p className="mb-5 text-xs font-medium tracking-wide text-[#1a5070]">Processing 4 resumes</p>
          <div className="space-y-4">
            {STEPS.map((label, i) => {
              const isDone = done || i < idx;
              const isActive = !done && i === idx;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isDone   ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#042C53] text-white"><Check className="h-3 w-3" strokeWidth={3}/></span>
                    : isActive ? <Loader2 className="h-6 w-6 animate-spin text-[#0d6ea3]" strokeWidth={2.25}/>
                    : <span className="block h-6 w-6 rounded-full border-2 border-slate-300 bg-slate-50"/>}
                  </div>
                  <span className={`text-sm font-semibold leading-6 transition-colors sm:text-base
                    ${isDone ? 'text-[#042C53]/80' : isActive ? 'text-[#0d6ea3]' : 'text-slate-400'}`}>{label}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs font-medium tracking-wide text-[#1a5070]">
            {done ? 'All done — loading your results' : `Step ${idx+1} of ${STEPS.length}`}
          </p>
        </div>
      </div>
    </>, document.body,
  );
}

// ─── Candidate Pool List (compact rows like screenshot) ──────────────────────
function CandidateRow({ c, onClick, highlighted }: { c: typeof POOL[0]; onClick: ()=>void; highlighted: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-blue-50/40
        ${highlighted ? 'bg-blue-50/60' : 'bg-white'}`}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-[#094D7B]" />
      </div>
      {/* Name + sub-line */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#094D7B] truncate">{c.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <FileText className="w-3 h-3 text-[#094D7B]" />
          <span className="text-xs text-[#094D7B] underline cursor-pointer">View Candidate</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{c.summary}</p>
      </div>
      {/* Badge + score */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${recBadge(c.status)}`}>{c.status}</span>
        <span className="text-lg font-bold text-[#094D7B]">{c.score}%</span>
      </div>
    </div>
  );
}

// ─── Detail Dialog (exact replica of ResumeUploadSection's scorecard Dialog) ─
function DetailDialog({ c, open, onClose }: { c: typeof POOL[0] | null; open: boolean; onClose: () => void }) {
  if (!c) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        data-dialog-content
        className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] sm:h-[80vh] overflow-y-auto p-3 sm:p-6"
        aria-describedby="detail-dialog-desc"
      >
        <DialogTitle className="sr-only">Candidate Assessment Details</DialogTitle>
        <div id="detail-dialog-desc" className="sr-only">Detailed assessment report for {c.name}</div>

        {/* Header — mirrors MatchScorecardSection single-candidate header */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-primary-800 mb-1">Candidate Assessment Details</h2>
          <p className="text-muted-foreground text-sm">Detailed assessment for {c.name}</p>
        </div>

        {/* Card body */}
        <div className="p-4 sm:p-6 shadow-md rounded-xl bg-white border border-gray-200">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6 gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-[#094D7B] sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                  <h3 className="text-lg font-bold text-[#094D7B] sm:text-xl">{c.name}</h3>
                  <div className="flex items-center gap-2">
                    <Checkbox className="data-[state=checked]:bg-primary-600" />
                    <label className="text-xs sm:text-sm font-medium text-gray-700 cursor-pointer select-none">
                      Select for Interview
                    </label>
                  </div>
                </div>
                <p className="text-sm text-gray-500">Overall Match Assessment</p>
              </div>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto">
              <div className="flex items-center gap-2 mb-1 justify-start sm:justify-end">
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${recBadge(c.status)}`}>
                  {c.status}
                </span>
                <span className="text-2xl font-bold text-[#094D7B] sm:text-3xl">{c.score}%</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Overall Score</p>
            </div>
          </div>

          {/* Score bars */}
          <div className="space-y-4">
            {c.scores.map((s, i) => (
              <div key={i} className="space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                  <span className="text-sm font-medium text-[#094D7B] sm:text-base">{s.parameter}</span>
                  <div className="text-left sm:text-right">
                    <span className="text-base font-bold text-[#094D7B] sm:text-lg">{s.score}</span>
                    <span className="text-xs sm:text-sm text-gray-500 sm:ml-4 block sm:inline">
                      Weight: {s.weightage}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-[#094D7B] transition-all duration-300"
                    style={{ width: `${s.score * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Colour-coded assessment blocks */}
          <div className="mt-4 sm:mt-6 rounded-lg border border-gray-300 overflow-hidden shadow-sm">
            {c.strengths.length > 0 && (
              <div className="bg-green-50 px-3 sm:px-4 py-3">
                <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Strengths</h5>
                <div className="space-y-1.5 text-sm text-gray-800">
                  {c.strengths.map((s, i) => <p key={i}>- {s}</p>)}
                </div>
              </div>
            )}
            {c.clarifications.length > 0 && (
              <div className="bg-yellow-50 px-3 sm:px-4 py-3">
                <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Clarifications</h5>
                <div className="space-y-1.5 text-sm text-gray-800">
                  {c.clarifications.map((s, i) => <p key={i}>- {s}</p>)}
                </div>
              </div>
            )}
            {c.weaknesses.length > 0 && (
              <div className="bg-red-50 px-3 sm:px-4 py-3">
                <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Shortcomings</h5>
                <div className="space-y-1.5 text-sm text-gray-800">
                  {c.weaknesses.map((s, i) => <p key={i}>- {s}</p>)}
                </div>
              </div>
            )}
            <div className="bg-blue-50 px-3 sm:px-4 py-3">
              <h5 className="mb-2 text-sm font-semibold text-[#094D7B] sm:text-base">Summary</h5>
              <p className="text-sm text-gray-800">{c.overallSummary}</p>
            </div>
          </div>

          {/* Recommendation */}
          <div className="mt-4 sm:mt-6 rounded-lg border border-gray-300 bg-gray-100/80 p-3 sm:p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-[#094D7B] sm:text-base">Recommendation</h4>
            <p className="text-sm text-gray-800">{c.recommendation}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
interface ResumeRecordingDemoProps {
  autoPlay?: boolean;
  embedded?: boolean;
  muted?: boolean;
}

export interface ResumeRecordingDemoHandle {
  runDemo: () => Promise<void>;
  stopDemo: () => void;
  resetDemo: () => void;
}

const ResumeRecordingDemo = forwardRef<ResumeRecordingDemoHandle, ResumeRecordingDemoProps>(function ResumeRecordingDemo(
  { autoPlay = false, embedded = false, muted: mutedProp },
  ref
) {
  const [step, setStep]             = useState<DemoStep>('idle');
  const [jd, setJd]                 = useState(DEMO_JD.id);
  const [crit, setCrit]             = useState(DEMO_CRITERIA.id);
  const [filesShown, setFilesShown] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<('pending'|'uploading'|'done')[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayIdx, setOverlayIdx] = useState(0);
  const [overlayDone, setOverlayDone] = useState(false);
  const [poolVisible, setPoolVisible] = useState(false);
  const [openCandidateId, setOpenCandidateId] = useState<string|null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [muted, setMuted]           = useState(mutedProp ?? false);
  useEffect(() => { if (mutedProp !== undefined) setMuted(mutedProp); }, [mutedProp]);
  const [running, setRunning]       = useState(false);
  const [statusLabel, setStatusLabel] = useState('Press Play to start the demo');

  const abortRef    = useRef(false);
  const topRef      = useRef<HTMLDivElement>(null);
  const selectRef   = useRef<HTMLDivElement>(null);
  const uploadRef   = useRef<HTMLDivElement>(null);
  const buttonRef   = useRef<HTMLDivElement>(null);
  const poolRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  // Auto-play when component mounts with autoPlay prop
  useEffect(() => {
    if (autoPlay && !running) {
      runDemo();
    }
  }, [autoPlay]);

  const scrollTo = useCallback((ref: React.RefObject<HTMLDivElement>, block: ScrollLogicalPosition = 'start') =>
    new Promise<void>(resolve => {
      setTimeout(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block }); setTimeout(resolve, 520); }, 80);
    }), []);

  const say = useCallback((s: keyof typeof TTS): Promise<void> =>
    new Promise(resolve => {
      if (muted || !window.speechSynthesis) { resolve(); return; }
      speak(TTS[s], resolve);
    }), [muted]);

  const hardReset = () => {
    setStep('idle'); setFilesShown(false); setFileStatuses([]);
    setOverlayVisible(false); setOverlayIdx(0); setOverlayDone(false);
    setPoolVisible(false); setOpenCandidateId(null); setDialogOpen(false);
    // keep JD + criteria pre-selected
  };

  const animateUploads = async () => {
    setFilesShown(true);
    setFileStatuses(DEMO_FILES.map(() => 'pending'));
    for (let i = 0; i < DEMO_FILES.length; i++) {
      if (abortRef.current) return;
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? 'uploading' : s));
      await wait(250);
      if (abortRef.current) return;
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? 'done' : s));
      await wait(80);
    }
  };

  const animateOverlay = async () => {
    setOverlayVisible(true); setOverlayIdx(0); setOverlayDone(false);
    for (let i = 0; i < STEPS.length; i++) {
      if (abortRef.current) return;
      setOverlayIdx(i); await wait(500);
    }
    if (abortRef.current) return;
    setOverlayDone(true); await wait(600);
    setOverlayVisible(false);
  };

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    hardReset();
    setJd(DEMO_JD.id);
    setCrit(DEMO_CRITERIA.id);
    const dead = () => abortRef.current;

    // 1 — intro
    setStatusLabel('Introduction'); setStep('idle');
    await scrollTo(topRef, 'start');
    await say('idle');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    // 2 — upload resumes
    setStatusLabel('Uploading resumes'); setStep('upload');
    await scrollTo(uploadRef, 'center');
    await say('upload');
    if (dead()) { setRunning(false); return; }
    await animateUploads();
    if (dead()) { setRunning(false); return; }
    await wait(400);

    // 4 — processing
    setStatusLabel('AI processing…'); setStep('processing');
    await scrollTo(buttonRef, 'center');
    await say('processing');
    if (dead()) { setRunning(false); return; }
    await animateOverlay();
    if (dead()) { setRunning(false); return; }
    await wait(300);

    // 5 — candidate pool
    setStatusLabel('Candidate pool'); setStep('pool');
    setPoolVisible(true);
    await scrollTo(poolRef, 'start');
    await say('pool');
    if (dead()) { setRunning(false); return; }
    await wait(600);

    // 6 — open Arjun's detail dialog
    setStatusLabel('Opening candidate detail'); setStep('detail');
    setOpenCandidateId('c1');
    setDialogOpen(true);
    // Let dialog paint before scrolling
    await wait(400);
    // Auto-scroll the dialog content to the bottom so assessment blocks are visible
    const dlg = document.querySelector('[data-dialog-content]') as HTMLElement | null;
    if (dlg) {
      const scrollStep = () => {
        dlg.scrollTop += 6;
        if (dlg.scrollTop < dlg.scrollHeight - dlg.clientHeight) {
          requestAnimationFrame(scrollStep);
        }
      };
      requestAnimationFrame(scrollStep);
    }
    await say('detail');
    if (dead()) { setRunning(false); return; }
    // Auto-close dialog immediately after narration ends
    setDialogOpen(false);
    await wait(400);

    // 7 — value close
    setStatusLabel('Value statement'); setStep('close');
    await say('close');
    if (dead()) { setRunning(false); return; }
    await wait(1500);

    setRunning(false);
    setStatusLabel('Demo complete — press Play to replay');
  }, [say, scrollTo]);

  const stopDemo  = () => { abortRef.current = true; window.speechSynthesis?.cancel(); setOverlayVisible(false); setDialogOpen(false); setRunning(false); setStatusLabel('Stopped — press Play to restart'); };
  const resetDemo = () => { stopDemo(); hardReset(); setStatusLabel('Press Play to start the demo'); };

  useImperativeHandle(ref, () => ({ runDemo, stopDemo, resetDemo }), [runDemo, stopDemo, resetDemo]);

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" ref={topRef}>
      <Overlay visible={overlayVisible} idx={overlayIdx} done={overlayDone} />

      {/* Control bar */}
      {!embedded && (
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 bg-[#094D7B]/10 rounded-lg px-3 py-1.5 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-semibold text-[#094D7B]">DEMO</span>
          </div>
          <span className="text-xs text-gray-500 truncate hidden sm:block">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setMuted(m => !m)} className="h-8 w-8 p-0">
            {muted ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-[#094D7B]" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetDemo} disabled={!running && step === 'idle'} className="h-8 w-8 p-0">
            <RotateCcw className="w-4 h-4" />
          </Button>
          {running
            ? <Button size="sm" variant="destructive" onClick={stopDemo} className="h-8 px-3 text-xs">Stop</Button>
            : <Button size="sm" onClick={runDemo} className="h-8 px-3 text-xs text-white bg-[#094D7B] hover:bg-[#094D7B]/90 gap-1.5">
                <Play className="w-3 h-3 fill-current" /> Play Demo
              </Button>
          }
        </div>
      </div>
      )}

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* ── Upload card ── */}
        <Card className="animate-fade-in">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary-800 mb-2">Resume Uploads</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Upload multiple candidate resumes for evaluation</p>
              </div>

              {/* JD selector */}
              <div ref={selectRef} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-primary-600" />
                  <h3 className="font-medium text-[#094D7B]">Job Description</h3>
                </div>
                <Select value={jd} onValueChange={setJd}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select job description..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pbi-jd">
                      <div className="flex flex-col"><span className="font-medium">Power BI Developer</span><span className="text-xs text-muted-foreground">Created: 17/04/2026</span></div>
                    </SelectItem>
                    <SelectItem value="ml-jd"><span className="font-medium">Machine Learning</span></SelectItem>
                    <SelectItem value="hr-jd"><span className="font-medium">HR Head Medical</span></SelectItem>
                  </SelectContent>
                </Select>
                {jd && <div className="p-2 bg-green-50 border border-green-200 rounded text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /><span className="font-medium text-green-800">Selected</span></div>}
              </div>

              {/* Criteria selector */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Grid className="w-4 h-4 text-primary-600" />
                  <h3 className="font-medium text-[#094D7B]">Evaluation Criteria</h3>
                </div>
                <Select value={crit} onValueChange={setCrit}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select criteria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pbi-crit"><div className="flex flex-col"><span className="font-medium">Power BI Developer - Scoring Criteria</span><span className="text-xs text-muted-foreground">5 parameters</span></div></SelectItem>
                    <SelectItem value="_default_"><span className="font-medium">_Default_</span></SelectItem>
                  </SelectContent>
                </Select>
                {crit && <div className="p-2 bg-green-50 border border-green-200 rounded text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /><span className="font-medium text-green-800">Selected</span></div>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="border-t border-gray-200" />

        {/* Drop zone */}
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div ref={uploadRef}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-500
                ${step === 'upload' ? 'border-[#094D7B] bg-blue-50/40' : 'border-primary-200 bg-primary-50/40 hover:border-primary-400'}`}
            >
              {!filesShown ? (
                <>
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${step === 'upload' ? 'text-[#094D7B]' : 'text-primary-400'}`} />
                  <h3 className="text-lg font-semibold mb-2">Upload Candidate Resumes</h3>
                  <p className="text-muted-foreground mb-4">Drop multiple files here or click to browse (PDF, DOCX, TXT)</p>
                  <Button className="bg-[#094D7B] text-white hover:bg-[#094D7B]/90 pointer-events-none">Select Files</Button>
                </>
              ) : (
                <>
                  <FileText className={`w-12 h-12 mx-auto mb-4 ${fileStatuses.every(s => s==='done') ? 'text-green-500' : 'text-[#094D7B]'}`} />
                  <h3 className={`text-lg font-semibold mb-2 ${fileStatuses.every(s => s==='done') ? 'text-green-700' : 'text-[#094D7B]'}`}>
                    {fileStatuses.every(s => s==='done') ? '4 Resumes Uploaded' : 'Uploading Resumes…'}
                  </h3>
                  <div className="space-y-2 mb-4">
                    {DEMO_FILES.map((f, i) => (
                      <div key={i} className={`flex items-center justify-between gap-2 text-sm p-2 rounded
                        ${fileStatuses[i]==='uploading' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2 flex-1">
                          <File className={`w-4 h-4 ${fileStatuses[i]==='done' ? 'text-green-600' : fileStatuses[i]==='uploading' ? 'text-[#094D7B]' : 'text-gray-400'}`} />
                          <span className="truncate max-w-xs">{f.name}</span>
                          <span className="text-xs text-gray-400">({f.size})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {fileStatuses[i]==='pending'   && <span className="text-xs text-gray-500">Waiting…</span>}
                          {fileStatuses[i]==='uploading' && <><Loader2 className="h-3 w-3 animate-spin text-[#094D7B]"/><span className="text-xs text-[#094D7B]">Uploading…</span></>}
                          {fileStatuses[i]==='done'      && <><CheckCircle className="w-3 h-3 text-green-600"/><span className="text-xs text-green-600">Uploaded</span></>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" multiple className="hidden" />

            {/* Pro-Valuate button */}
            <div ref={buttonRef} className="mt-4">
              <Button className={`relative w-full text-white transition-all duration-300
                ${step==='processing' ? 'bg-[#094D7B] ring-4 ring-[#094D7B]/30 scale-[1.01]' : poolVisible ? 'bg-green-600 hover:bg-green-700' : 'bg-accent-600 hover:bg-accent-700'}
                ${(!jd||!crit||!filesShown) ? 'opacity-50' : ''}`}
                disabled={!jd||!crit||!filesShown}>
                {step==='processing' ? <span>Processing resumes…</span>
                : poolVisible ? <><CheckCircle className="w-4 h-4 mr-2"/>Processing complete</>
                : <><PlayBtn className="w-4 h-4 mr-2"/>Pro-Valuate</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Candidate pool ── */}
        {poolVisible && (
          <div ref={poolRef}>
            <Card className={`animate-fade-in transition-all duration-500 ${step==='pool' ? 'ring-2 ring-[#094D7B]/20' : ''}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold text-[#094D7B]">Candidate Pool ({POOL.length})</span>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs pointer-events-none">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>
              <div className="divide-y">
                {POOL.map(c => (
                  <CandidateRow
                    key={c.id}
                    c={c}
                    onClick={() => { setOpenCandidateId(c.id); setDialogOpen(true); }}
                    highlighted={openCandidateId === c.id}
                  />
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Detail dialog — opens over the page exactly like ResumeUploadSection */}
        <DetailDialog
          c={POOL.find(c => c.id === openCandidateId) ?? null}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      </div>
    </div>
  );
});

ResumeRecordingDemo.displayName = 'ResumeRecordingDemo';

export default ResumeRecordingDemo;
