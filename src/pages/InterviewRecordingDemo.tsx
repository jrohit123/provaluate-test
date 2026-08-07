import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Play, Volume2, VolumeX, RotateCcw, Mic, MicOff,
  FileText, Upload, ChevronDown, ChevronRight, CheckCircle2,
  Sparkles, Brain, Target, Clock, BarChart3, Loader2, Check,
  Settings, Maximize2, Plus, Trash2, HelpCircle,
} from 'lucide-react';

// ─── Section labels ──────────────────────────────────────────────────────────
const SECTIONS = ['Interview Setup', 'Live Interview', 'Performance Report'] as const;
type Section = typeof SECTIONS[number];

// ─── Power BI competencies from real production DB ───────────────────────────
const COMPETENCIES = [
  {
    id: 'param_1', name: 'Power BI Development & DAX Expertise', weight: 30, max_time: 2,
    description: 'Hands-on experience developing reports and data models using Power BI Desktop, Power Query, and DAX. Ability to write complex DAX measures and calculated columns. Expertise in M Query for data transformation.',
    criteria: ['Below Average (1-4): Cannot articulate core DAX concepts or M Query functions', 'Average (5-6): Explains basic DAX and M Query but struggles with complexity', 'Good (7-8): Solid understanding and practical application; explains modeling choices', 'Excellent (9-10): Writes complex DAX measures efficiently; demonstrates advanced best practices'],
    score: 8,
  },
  {
    id: 'param_2', name: 'SQL Querying for Data Extraction', weight: 25, max_time: 2,
    description: 'Expertise in writing complex SQL queries to extract and manipulate data. Ability to perform joins, aggregation, subqueries, and query optimization.',
    criteria: ['Below Average (1-4): Struggles with basic SQL syntax and joins', 'Average (5-6): Writes simple SQL but struggles with performance optimization', 'Good (7-8): Writes efficient complex SQL; strong understanding of database concepts', 'Excellent (9-10): Highly optimized queries; deep knowledge of database structures'],
    score: 7,
  },
  {
    id: 'param_3', name: 'Power BI Service & Deployment', weight: 25, max_time: 1,
    description: 'Knowledge of Power BI Service features, workspaces, dashboards, and report sharing. Experience configuring and managing Power BI Gateways.',
    criteria: ['Below Average (1-4): Limited knowledge of Power BI Service or Gateway configuration', 'Average (5-6): Describes basic features; understands gateways but struggles with details', 'Good (7-8): Good understanding of deployment lifecycle and admin tasks', 'Excellent (9-10): Comprehensive knowledge; troubleshoots advanced configurations'],
    score: 6,
  },
  {
    id: 'param_4', name: 'Data Modeling & Database Concepts', weight: 20, max_time: 1,
    description: 'Understanding of dimensional modeling, star schemas, and their application in BI. Ability to explain how data models impact report performance.',
    criteria: ['Below Average (1-4): Cannot explain data modeling relevance to BI performance', 'Average (5-6): Can define terms but struggles with practical BI application', 'Good (7-8): Demonstrates good understanding and practical examples', 'Excellent (9-10): Applies advanced techniques; designs complex data structures'],
    score: 9,
  },
];

// ─── Q&A pairs ───────────────────────────────────────────────────────────────
const QA = [
  {
    q: 'Can you walk me through how you would design a Power BI report that aggregates sales data across regions and time periods using DAX measures?',
    a: `Sure. I'd start with a star schema — a central fact table for sales transactions linked to dimension tables for date, region, and product. In DAX I'd write a base measure like Total Sales using SUMX, then build time-intelligence measures using CALCULATE with DATESINPERIOD for rolling 12-month views. For regional comparisons I'd use ALLEXCEPT to remove the region filter context while keeping date context — that gives a clean Regional Share of Total metric without double-counting.`,
    feedback: `Strong structural answer — you led with the schema design and moved logically into DAX measures. This maps directly to Power BI Development & DAX Expertise (scored 8/10, Good). To reach Excellent, close with a measurable outcome instead of ending on the technique itself.`,
  },
  {
    q: 'You mentioned ALLEXCEPT — how does that differ from ALL, and when would you choose one over the other?',
    a: `ALLEXCEPT removes all filter context except for the columns you specify, whereas ALL removes everything. So ALLEXCEPT is useful when you want a ratio that respects some filters — like date — but ignores others like region. I'd use ALL when I want a completely unfiltered total, for example a grand total that never responds to any slicer on the page.`,
    feedback: `Correctly distinguished ALLEXCEPT from ALL and grounded it with a real use case — exactly the filter-context nuance this competency rewards. The one gap: you didn't name the failure mode of misusing ALL. Naming that risk is what separates Good from Excellent.`,
  },
];

// ─── Report data ──────────────────────────────────────────────────────────────
const OVERALL = Math.round(COMPETENCIES.reduce((s, c) => s + c.score * c.weight / 100, 0) * 10) / 10;

const SPEECH_SECTIONS = [
  {
    title: 'How you opened each answer',
    color: 'bg-blue-50 border-blue-200', titleColor: 'text-blue-700',
    text: `Your opener on Q1 was direct — you committed to the star schema approach in the first clause at a comfortable 138 WPM. Q2 opened with a clean contrast statement that immediately anchored the technical difference. Both cold-starts were clean with no warm-up fillers. Voice confidence was 84/100 across openers.`,
  },
  {
    title: 'Your flow and filler pattern',
    color: 'bg-amber-50 border-amber-200', titleColor: 'text-amber-700',
    text: `Filler score was 88/100 overall — low usage, well controlled. In Q1 mid-answer flow was steady as you moved from schema design through DAX measures. One isolated filler appeared before DATESINPERIOD but did not disrupt the technical chain. Q2 had the cleanest mid-answer delivery.`,
  },
  {
    title: 'How you closed each answer',
    color: 'bg-green-50 border-green-200', titleColor: 'text-green-700',
    text: `Q1 closed strongly — the outcome clause "without double-counting" was a landing statement. Trailing off was not detected on either answer. Q2 also closed cleanly with a concrete example anchoring the abstract distinction.`,
  },
  {
    title: 'What an interviewer would have noticed',
    color: 'bg-purple-50 border-purple-200', titleColor: 'text-purple-700',
    text: `A hiring manager would have noticed the progression: Q1 showed schema design thinking from first principles. Q2 went one level deeper when pushed, explaining filter context mechanics with specificity. The ALLEXCEPT vs ALL distinction is exactly the DAX nuance a senior role requires. The main follow-up question would be around performance on large DirectQuery models.`,
  },
];

const ACTION_PLAN = [
  {
    leverage: 'Highest leverage',
    title: 'Add an outcome metric when closing a complex DAX explanation',
    what: `In Q1, you designed the full schema and measure chain well, but the outcome clause came late and was brief. The strongest signal for an interviewer is connecting a technical design choice to a measurable business result.`,
    why: `Closing with a concrete outcome — for example "query time dropped from 4s to 0.8s" — moves your answer from Good to Excellent on the DAX competency rubric.`,
    between: `Before your next interview, pick one Power BI project and write the outcome in one sentence with a number. Practise ending your DAX answer with that sentence.`,
  },
  {
    leverage: 'High leverage',
    title: 'Name the trade-off when distinguishing DAX functions',
    what: `Q2 explained what ALLEXCEPT and ALL do clearly but did not name when ALL would cause an issue in a real report — you gave the definition without the edge case.`,
    why: `Interviewers testing Expert-level DAX expect you to anticipate failure modes. Naming the risk separates a Good score from Excellent.`,
    between: `After each DAX answer you rehearse, add one sentence: "The risk with this approach is..." Train that as a closing habit.`,
  },
  {
    leverage: 'Maintenance',
    title: 'Protect your direct opener and contrast-structure habit',
    what: `Both Q1 and Q2 opened without warm-up fillers. Q2 used a contrast structure that immediately set up the comparison the interviewer needed. This is already working at a high level.`,
    why: `Clean openers make the first 10 seconds decisive. Your filler score of 88/100 and clean cold-start on both answers means this habit is strong — protect it under pressure.`,
    between: `When practising, start your answer timer the moment you say your first content word — no filler allowed before it.`,
  },
];

// ─── TTS ─────────────────────────────────────────────────────────────────────
const TTS = {
  setup_intro:       'ProValuate helps you interview with confidence. Select the role, choose the interview type, and AI builds the whole interview that evaluates what truly matters.',
  mode_ai:           'AI Conversational mode adapts every question to the candidate’s responses, diving deeper into the skills instead of rehearsed answers.',
  mode_structured:   'Structured interviews use fixed questions and scoring criteria so every candidate is evaluated consistently.',
  type_functional:   'Functional interviews validate the technical & functional expertise needed to perform successfully.',
  type_behavioral:   'Behavioral interviews reveal how candidates think, decide, and perform under real workplace challenges.',
  type_mixed:        'Mixed interviews combine technical capability with behavioral fit, helping you hire people who perform and thrive.',
  setup_comp:        'AI automatically creates weighted competencies from your Job Description, so every interview measures what matters most to business success.',
  session_intro:     'The interview begins. AI conducts the conversation while recording video and live transcripts—giving your hiring team complete visibility without attending every interview.',
  session_q2:        'Instead of asking scripted questions, AI listens, probes deeper, and validates expertise—making it harder for candidates to rely on prepared answers.',
  report_intro:      'Within seconds, ProValuate delivers a complete evaluation with competency scores, communication insights, and actionable recommendations.',
  report_competency: 'Every competency is scored against your predefined hiring standards, instead of subjective interviewer opinions.',
  report_qa:         'Every answer is linked to a competency, making hiring decisions transparent, evidence-based, and easy to justify.',
  report_close:      'All candidates are assessed using the same standards. Your team spends time only on the strongest talent, reduces hiring bias, and makes faster, more confident hiring decisions.',
};
type TtsKey = keyof typeof TTS;

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

function scoreBand(s: number) {
  if (s >= 9) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700' };
  if (s >= 7) return { label: 'Good',      color: 'bg-blue-100 text-blue-700' };
  if (s >= 5) return { label: 'Average',   color: 'bg-amber-100 text-amber-700' };
  return { label: 'Below Average', color: 'bg-red-100 text-red-700' };
}

interface InterviewRecordingDemoProps {
  autoPlay?: boolean;
  embedded?: boolean;
  muted?: boolean;
}

export interface InterviewRecordingDemoHandle {
  runDemo: () => Promise<void>;
  stopDemo: () => void;
  resetDemo: () => void;
}

const InterviewRecordingDemo = forwardRef<InterviewRecordingDemoHandle, InterviewRecordingDemoProps>(function InterviewRecordingDemo(
  { autoPlay = false, embedded = false, muted: mutedProp },
  ref
) {
  const [activeSection, setActiveSection] = useState<Section>('Interview Setup');
  // Setup
  const [uploadedJD, setUploadedJD]             = useState(true);
  const [generatingComp, setGeneratingComp]     = useState(false);
  const [competenciesReady, setCompetenciesReady] = useState(false);
  const [suppressCompetencies, setSuppressCompetencies] = useState(false);
  const [openCompId, setOpenCompId]             = useState<string|null>(null);
  const [demoOpenCard, setDemoOpenCard]         = useState(false);
  // Session
  const [qaIndex, setQaIndex]   = useState(-1);
  const [q1Text, setQ1Text]     = useState('');
  const [q2Text, setQ2Text]     = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  // Report
  const [reportReady, setReportReady]     = useState(false);
  const [visibleSections, setVisibleSections] = useState(0);
  const [reportStep, setReportStep] = useState<'competency' | 'qa' | null>(null);
  // Controls
  const [muted, setMuted]           = useState(mutedProp ?? false);
  useEffect(() => { if (mutedProp !== undefined) setMuted(mutedProp); }, [mutedProp]);
  const [running, setRunning]       = useState(false);
  const [statusLabel, setStatusLabel] = useState('Press Play to start the demo');
  const [selectedRole, setSelectedRole] = useState('pbi');
  const [interviewMode, setInterviewMode] = useState<'' | 'ai' | 'structured'>('');
  const [interviewType, setInterviewType] = useState<'' | 'functional' | 'behavioral' | 'mixed'>('');
  const [focusHints, setFocusHints] = useState<string[]>(['DAX', 'Power Query', 'Gateway']);

  useEffect(() => {
    const ready = Boolean(interviewMode && interviewType) && !suppressCompetencies;
    setCompetenciesReady(ready);
    if (!ready) setOpenCompId(null);
  }, [interviewMode, interviewType, suppressCompetencies]);

  const abortRef    = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setupRef    = useRef<HTMLDivElement>(null);
  const compRef     = useRef<HTMLDivElement>(null);
  const sessionRef  = useRef<HTMLDivElement>(null);
  const reportRef   = useRef<HTMLDivElement>(null);
  const competencyRef = useRef<HTMLDivElement>(null);
  const qaRef         = useRef<HTMLDivElement>(null);
  const speechRef      = useRef<HTMLDivElement>(null);
  const actionRef   = useRef<HTMLDivElement>(null);

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

  const say = useCallback((k: TtsKey): Promise<void> =>
    new Promise(resolve => {
      if (muted || !window.speechSynthesis) { resolve(); return; }
      speak(TTS[k], resolve);
    }), [muted]);

  const hardReset = () => {
    window.scrollTo({ top: 0, behavior: 'auto' }); // snap to top instantly before any section swap renders
    setActiveSection('Interview Setup');
    setUploadedJD(true); setGeneratingComp(false); setCompetenciesReady(false); setSuppressCompetencies(false); setOpenCompId(null); setDemoOpenCard(false);
    setQaIndex(-1); setQ1Text(''); setQ2Text(''); setAiTyping(false);
    setTranscript(''); setIsRecording(false); setSessionDone(false);
    setReportReady(false); setVisibleSections(0); setReportStep(null);
    setSelectedRole('pbi');
    setInterviewMode('');
    setInterviewType('');
    setFocusHints(['DAX', 'Power Query', 'Gateway']);
  };

  const typeInto = async (setter: (s: string) => void, text: string) => {
    setter('');
    for (let i = 1; i <= text.length; i++) {
      if (abortRef.current) return;
      setter(text.slice(0, i));
      await wait(16);
    }
  };

  const typeTranscript = async (text: string) => {
    setTranscript('');
    const chunk = 14;
    for (let i = chunk; i <= text.length + chunk; i += chunk) {
      if (abortRef.current) return;
      setTranscript(text.slice(0, i));
      await wait(28);
    }
    setTranscript(text);
  };

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    hardReset();
    const dead = () => abortRef.current;

    // ── SECTION 1: Interview Setup ────────────────────────────────────
    setActiveSection('Interview Setup');
    setStatusLabel('Setup overview');
    await scrollTo(setupRef, 'start');
    await say('setup_intro');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    setUploadedJD(true);
    await wait(600);

    setSuppressCompetencies(true);

    setInterviewMode('ai');
    await say('mode_ai');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setInterviewMode('structured');
    await say('mode_structured');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setInterviewMode('ai');
    await wait(400);

    setInterviewType('functional');
    await say('type_functional');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setInterviewType('behavioral');
    await say('type_behavioral');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setInterviewType('mixed');
    await say('type_mixed');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setInterviewType('functional');
    await wait(400);

    setSuppressCompetencies(false);

    setStatusLabel('Generating competencies');
    setGeneratingComp(true);
    await wait(1800);
    setGeneratingComp(false);

    await scrollTo(compRef, 'start');
    await wait(700);
    await say('setup_comp');
    if (dead()) { setRunning(false); return; }
    await wait(700);

    setOpenCompId('param_1');
    setDemoOpenCard(true);
    await wait(3200);
    setOpenCompId(null);
    setDemoOpenCard(false);
    await wait(300);

    // ── SECTION 2: Live Interview ─────────────────────────────────────
    setActiveSection('Live Interview');
    setStatusLabel('Live interview session');
    await say('session_intro');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    setQaIndex(0);
    setAiTyping(true);
    await typeInto(setQ1Text, QA[0].q);
    setAiTyping(false);
    await wait(700);
    setIsRecording(true);
    await typeTranscript(QA[0].a);
    if (dead()) { setRunning(false); return; }
    await wait(600);
    setIsRecording(false);
    await wait(500);

    setQaIndex(1);
    setAiTyping(true);
    await Promise.all([
      say('session_q2'),
      typeInto(setQ2Text, QA[1].q),
    ]);
    setAiTyping(false);
    if (dead()) { setRunning(false); return; }
    await wait(600);
    setIsRecording(true);
    setTranscript('');
    await typeTranscript(QA[1].a);
    if (dead()) { setRunning(false); return; }
    await wait(600);
    setIsRecording(false);
    setSessionDone(true);
    await wait(700);

    // ── SECTION 3: Performance Report ────────────────────────────────
    setActiveSection('Performance Report');
    setStatusLabel('Report generated');
    setReportReady(true);
    await scrollTo(reportRef, 'start');
    await Promise.all([say('report_intro'), wait(2200)]); // guaranteed min read time on letterhead + overall score
    if (dead()) { setRunning(false); return; }
    await wait(400);

    await scrollTo(competencyRef, 'start');
    setReportStep('competency');
    await Promise.all([say('report_competency'), wait(2000)]); // guaranteed min read time on competency table
    if (dead()) { setRunning(false); return; }
    await wait(1200);

    await scrollTo(qaRef, 'start');
    setReportStep('qa');
    await Promise.all([say('report_qa'), wait(1400)]);
    if (dead()) { setRunning(false); return; }
    await wait(1200);

    setReportStep(null);
    await say('report_close');
    if (dead()) { setRunning(false); return; }
    await wait(1200);

    setRunning(false);
    setStatusLabel('Demo complete — press Play to replay');
  }, [say, scrollTo]);

  const playSection = useCallback(async (section: Section) => {
    // Play only a single section's demo sequence (non-destructive, cancellable)
    abortRef.current = false;
    setRunning(true);
    hardReset();
    const dead = () => abortRef.current;

    if (section === 'Interview Setup') {
      setActiveSection('Interview Setup');
      setStatusLabel('Playing setup');
      await scrollTo(setupRef, 'start');
      await say('setup_intro');
      if (dead()) { setRunning(false); return; }
      await wait(300);

      setUploadedJD(true);
      await wait(500);

      setSuppressCompetencies(true);
      setInterviewMode('ai');
      await say('mode_ai');
      if (dead()) { setRunning(false); return; }
      await wait(400);
      setInterviewMode('structured');
      await say('mode_structured');
      if (dead()) { setRunning(false); return; }
      await wait(400);
      setInterviewMode('ai');
      await wait(300);

      setInterviewType('functional');
      await say('type_functional');
      if (dead()) { setRunning(false); return; }
      await wait(350);
      setInterviewType('behavioral');
      await say('type_behavioral');
      if (dead()) { setRunning(false); return; }
      await wait(350);
      setInterviewType('mixed');
      await say('type_mixed');
      if (dead()) { setRunning(false); return; }
      await wait(350);
      setInterviewType('functional');
      await wait(300);

      setSuppressCompetencies(false);
      setStatusLabel('Generating competencies');
      setGeneratingComp(true);
      await wait(1400);
      setGeneratingComp(false);

      await scrollTo(compRef, 'start');
      await wait(600);
      await say('setup_comp');
      if (dead()) { setRunning(false); return; }
      await wait(700);
      setOpenCompId('param_1');
      setDemoOpenCard(true);
      await wait(2200);
      setOpenCompId(null);
      setDemoOpenCard(false);
      await wait(200);

      setRunning(false);
      setStatusLabel('Press Play to start the demo');
      return;
    }

    if (section === 'Live Interview') {
      setActiveSection('Live Interview');
      setStatusLabel('Playing live interview');
      await say('session_intro');
      if (dead()) { setRunning(false); return; }
      await wait(250);

      setQaIndex(0);
      setAiTyping(true);
      await typeInto(setQ1Text, QA[0].q);
      setAiTyping(false);
      await wait(500);
      setIsRecording(true);
      await typeTranscript(QA[0].a);
      if (dead()) { setRunning(false); return; }
      await wait(400);
      setIsRecording(false);
      await wait(300);

      setQaIndex(1);
      setAiTyping(true);
      await Promise.all([
        say('session_q2'),
        typeInto(setQ2Text, QA[1].q),
      ]);
      setAiTyping(false);
      if (dead()) { setRunning(false); return; }
      await wait(400);
      setIsRecording(true);
      setTranscript('');
      await typeTranscript(QA[1].a);
      if (dead()) { setRunning(false); return; }
      await wait(400);
      setIsRecording(false);
      setSessionDone(true);
      await wait(400);

      setRunning(false);
      setStatusLabel('Press Play to start the demo');
      return;
    }

    if (section === 'Performance Report') {
      setActiveSection('Performance Report');
      setStatusLabel('Report generated');
      setReportReady(true);
      await scrollTo(reportRef, 'start');
      await Promise.all([say('report_intro'), wait(1800)]);
      if (dead()) { setRunning(false); return; }
      await wait(300);

      await scrollTo(competencyRef, 'start');
      setReportStep('competency');
      await Promise.all([say('report_competency'), wait(1600)]);
      if (dead()) { setRunning(false); return; }
      await wait(900);

      await scrollTo(qaRef, 'start');
      setReportStep('qa');
      await Promise.all([say('report_qa'), wait(1200)]);
      if (dead()) { setRunning(false); return; }
      await wait(1000);

      setReportStep(null);
      await say('report_close');
      if (dead()) { setRunning(false); return; }
      await wait(1000);

      setRunning(false);
      setStatusLabel('Press Play to start the demo');
      return;
    }
  }, [say, scrollTo]);

  const stopDemo  = () => { abortRef.current = true; window.speechSynthesis?.cancel(); setRunning(false); setStatusLabel('Stopped — press Play to restart'); };
  const resetDemo = () => { stopDemo(); hardReset(); setStatusLabel('Press Play to start the demo'); };

  useImperativeHandle(ref, () => ({ runDemo, stopDemo, resetDemo }), [runDemo, stopDemo, resetDemo]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Control bar ── */}
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
          <Button variant="ghost" size="sm" onClick={resetDemo} disabled={!running && activeSection === 'Interview Setup' && !uploadedJD} className="h-8 w-8 p-0">
            <RotateCcw className="w-4 h-4" />
          </Button>
          {running
            ? <Button size="sm" variant="destructive" onClick={stopDemo} className="h-8 px-3 text-xs">Stop</Button>
            : <Button size="sm" onClick={runDemo} className="h-8 px-3 text-xs text-white bg-[#094D7B] hover:bg-[#094D7B]/90 gap-1.5">
                <Play className="w-3 h-3 fill-current" /> Play Demo
              </Button>}
        </div>
      </div>
      )}

      {/* ── Section tab strip — hidden when embedded (e.g. inside FullDemo) ── */}
      {!embedded && (
      <div className="sticky top-[48px] z-40 bg-white border-b px-3 sm:px-4 flex gap-0">
        {SECTIONS.map((s, i) => (
          <div key={s} className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveSection(s)}
              aria-pressed={activeSection === s}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors
                ${activeSection === s ? 'border-[#094D7B] text-[#094D7B]' : 'border-transparent text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                ${activeSection === s ? 'bg-[#094D7B] text-white' : SECTIONS.indexOf(activeSection) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {SECTIONS.indexOf(activeSection) > i ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); playSection(s); }}
              aria-label={`Play ${s}`}
              className="ml-1 mr-2 p-2 rounded-md text-[#094D7B] hover:bg-[#094D7B]/5">
              <Play className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      )}

      <div className="p-3 space-y-4 sm:p-4 sm:space-y-6">

        {/* ═══════════════ SECTION 1: INTERVIEW SETUP ═══════════════ */}
        {activeSection === 'Interview Setup' && (
          <div ref={setupRef} className="scroll-mt-24 space-y-4 sm:space-y-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
              <div>
                <h2 className="mb-2 text-xl font-bold text-[#020f1a] sm:text-2xl">Interview Competencies Setup</h2>
                <p className="text-sm text-muted-foreground sm:text-base">Select the role and configure the interview settings</p>
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Help">
                      <HelpCircle className="h-6 w-6" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] text-sm" align="end" side="bottom">
                    <div className="space-y-3">
                      <h3 className="border-b pb-2 text-base font-semibold">Interview Competencies – Quick Help</h3>
                      <div>
                        <h4 className="mb-1 font-semibold text-gray-900">Create a new role</h4>
                        <p className="text-gray-600">Type the role name, upload the JD, and then pick that role in the dropdown to see the extracted text.</p>
                      </div>
                      <div>
                        <h4 className="mb-1 font-semibold text-gray-900">Modes &amp; types</h4>
                        <p className="text-gray-600">Choose AI Interview for dynamic questions and Functional, Behavioral, or Mixed for the interview focus.</p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button className="gap-2 bg-[#094D7B] text-sm text-white shadow hover:bg-[#094D7B]/90">
                  <Settings className="h-4 w-4" />Manage Job Descriptions
                </Button>
              </div>
            </div>

            <Card className="animate-fade-in overflow-hidden" data-tour="setup-area">
              <CardContent className="space-y-6 px-3 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
                <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Select Role *</label>
                      <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value)}>
                        <SelectTrigger className="w-full min-h-[44px]">
                          <SelectValue placeholder="Select a role from existing job descriptions…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pbi">Power BI Developer (Enabled)</SelectItem>
                          <SelectItem value="ml">Machine Learning (Enabled)</SelectItem>
                          <SelectItem value="hr">HR Head Medical (Enabled)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Interview Mode *</label>
                      <Select value={interviewMode} onValueChange={(value) => setInterviewMode(value as 'ai' | 'structured')}>
                        <SelectTrigger className="w-full min-h-[44px]">
                          <SelectValue placeholder="Select interview mode..." />
                        </SelectTrigger>
                        <SelectContent className="w-[320px] sm:w-[360px]">
                          <SelectItem value="ai" className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                            <div className="text-sm font-semibold text-slate-900">AI Interview (Dynamic)</div>
                            <div className="mt-1 text-sm text-slate-600">Questions generated from the candidate’s answers, with adaptive follow-ups that change in real time.</div>
                          </SelectItem>
                          <SelectItem value="structured" className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                            <div className="text-sm font-semibold text-slate-900">Structured Interview (Pre-defined)</div>
                            <div className="mt-1 text-sm text-slate-600">Fixed questions and competencies are defined before the interview for a consistent, repeatable flow.</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        {interviewMode === 'ai' && 'AI Interview adapts questions in real time based on candidate responses.'}
                        {interviewMode === 'structured' && 'Structured Interview uses a fixed script and competencies defined before the session.'}
                        {!interviewMode && 'Select a mode to see how the interview flow will behave.'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Interview Type *</label>
                      <Select value={interviewType} onValueChange={(value) => setInterviewType(value as 'functional' | 'behavioral' | 'mixed' | '')}>
                        <SelectTrigger className="w-full min-h-[44px]">
                          <SelectValue placeholder="Select interview type..." />
                        </SelectTrigger>
                        <SelectContent className="w-[320px] sm:w-[360px]">
                          <SelectItem value="functional" className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                            <div className="text-sm font-semibold text-slate-900">Functional</div>
                            <div className="mt-1 text-sm text-slate-600">Focus on practical role-specific skills, problem solving, and technical experience.</div>
                          </SelectItem>
                          <SelectItem value="behavioral" className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                            <div className="text-sm font-semibold text-slate-900">Behavioral</div>
                            <div className="mt-1 text-sm text-slate-600">Assess how the candidate has behaved in past work situations and handled challenges.</div>
                          </SelectItem>
                          <SelectItem value="mixed" className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                            <div className="text-sm font-semibold text-slate-900">Mixed (Functional + Behavioral)</div>
                            <div className="mt-1 text-sm text-slate-600">Combine technical and behavioral questions for a balanced evaluation.</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        {interviewType === 'functional' && 'Functional focuses on technical and role-specific problem solving.'}
                        {interviewType === 'behavioral' && 'Behavioral evaluates past work behavior, decisions, and challenge handling.'}
                        {interviewType === 'mixed' && 'Mixed combines both functional and behavioral question styles.'}
                        {!interviewType && 'Select a type to see how the interview questions will be weighted.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3">
                    <div className="flex flex-1 flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Job Description *</label>
                        {uploadedJD && (
                          <button className="flex items-center gap-1 text-xs text-blue-600 pointer-events-none">
                            <Maximize2 className="h-3.5 w-3.5" />Expand
                          </button>
                        )}
                      </div>
                      <Textarea
                        readOnly
                        value={uploadedJD
                          ? `Power BI Developer — Credenca Data Solutions Pvt. Ltd.\nExperience: 0–2 Years\n\nDesired skills:\n• Power BI Desktop, Power Query, Power BI Service, Gateway, Mobile\n• DAX, M Query, data transformations using Power Query\n• SQL queries (complex), database concepts, data modeling\n• Communication, analytical, documentation and task management skills\n\nEducational Qualifications:\n• Bachelor's degree minimum. Relevant certifications a plus.\n\nWork Location: Pune`
                          : ''}
                        placeholder="Job description will be auto-filled when you select a role above…"
                        rows={8}
                        className="min-h-[220px] flex-1 resize-none bg-gray-50 text-xs leading-relaxed"
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-slate-900">
                            Focus area hints <span className="font-normal text-slate-500">(optional)</span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Competency names to include when generating. Each chip becomes at least one competency, plus JD-based ones — max 5.
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-[10px] text-slate-500">{focusHints.length} hints</span>
                      </div>

                      {focusHints.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {focusHints.map((hint) => (
                            <span key={hint} className="inline-flex items-center rounded-full border border-[#094D7B]/20 bg-white px-2.5 py-1 text-[11px] font-medium text-[#094D7B]">
                              {hint}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          readOnly
                          placeholder="e.g. DAX, Power Query, Gateway"
                          className="flex-1 bg-white text-xs"
                          value={uploadedJD ? 'DAX, Power Query, Gateway' : ''}
                        />
                        <Button variant="outline" size="sm" className="pointer-events-none h-9 px-3 text-xs">
                          <Plus className="mr-1 h-3.5 w-3.5" />Add
                        </Button>
                      </div>
                      {!uploadedJD && (
                        <p className="text-[10px] text-slate-500">Select a role above to add focus hints.</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-4 sm:p-6">
                {!competenciesReady && (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Select an interview mode and interview type above to reveal the competency summary cards.
                  </div>
                )}
                {competenciesReady && (
                  <div ref={compRef} className="space-y-3">
                    {COMPETENCIES.map((c, index) => {
                      const color = index === 0 ? '#22c55e' : index === 1 ? '#f59e0b' : index === 2 ? '#38bdf8' : '#84cc16';
                      return (
                        <Card key={c.id} className={`border bg-gray-50 transition-all duration-300 ${openCompId === c.id ? 'border-[#094D7B]/40 ring-1 ring-[#094D7B]/10' : 'border-gray-200'}`}>
                          <CardContent className="px-4 pb-3 pt-4">
                            <div className="space-y-3">
                              <div className="mb-3 flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-gray-900 mb-1">{c.name}</div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-lg font-bold text-gray-900">{c.weight}%</div>
                                </div>
                              </div>

                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${c.weight}%`, backgroundColor: color }} />
                              </div>
                            </div>

                            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-gray-500">Weight (%)</p>
                                <p className="text-base font-semibold text-gray-900">{c.weight}%</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-gray-500">Min Questions</p>
                                <p className="text-base font-semibold text-gray-900">2</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-gray-500">Max Questions</p>
                                <p className="text-base font-semibold text-gray-900">{c.max_time === 1 ? 3 : 4}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-gray-500">Answer Time</p>
                                <p className="text-base font-semibold text-gray-900">{c.max_time} min</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-gray-500">Level</p>
                                <p className="text-base font-semibold text-gray-900">Regular</p>
                              </div>
                            </div>

                            <button
                              onClick={() => setOpenCompId((prev) => (prev === c.id ? null : c.id))}
                              className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                            >
                              {openCompId === c.id ? 'Hide Details ▲' : 'View Details ▼'}
                            </button>

                          {openCompId === c.id && (
                            <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                              <div className="rounded border border-gray-100 bg-white p-3 text-xs leading-relaxed text-gray-700 whitespace-pre-line">
                                {c.description}
                              </div>
                              <div>
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Scoring Criteria</p>
                                <div className="space-y-1.5">
                                  {c.criteria.map((cr, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                                        i === 0 ? 'bg-red-400' :
                                        i === 1 ? 'bg-amber-400' :
                                        i === 2 ? 'bg-blue-400' :
                                        'bg-emerald-400'
                                      }`} />
                                      <span>{cr}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )})}

                    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
                      <span className="text-xs font-medium text-gray-600">Total weight:</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-1.5 w-full rounded-full bg-green-500" />
                        </div>
                        <span className="text-sm font-bold text-green-600">100% ✓</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════ SECTION 2: LIVE INTERVIEW ═══════════════ */}
        {activeSection === 'Live Interview' && (
          <div ref={sessionRef} className="scroll-mt-24 space-y-3">
            {/* Header banner removed per request */}

            {/* Two-col: question + camera */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* AI question card */}
              <div className="bg-sky-50 rounded-xl border border-sky-100 p-4 min-h-[100px] flex flex-col justify-center">
                {qaIndex === -1
                  ? <p className="text-gray-400 text-base text-center">AI question appears here…</p>
                  : (
                    <p className="text-base sm:text-lg text-gray-800 font-medium leading-relaxed">
                      {qaIndex === 0 ? q1Text : q2Text}
                    </p>
                  )
                }
              </div>

              {/* Camera feed */}
              <div className="bg-black rounded-xl overflow-hidden min-h-[100px] relative shadow-inner">
                <img
                  src="https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzj8nq3e.jpg"
                  alt="Candidate"
                  className="w-full h-full object-cover object-[50%_25%] opacity-90"
                  style={{ minHeight: '100px' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white text-xs font-semibold tracking-widest">REC</span>
                  </div>
                )}
                {/* bottom text overlay intentionally removed for simpler demo visuals */}
              </div>
            </div>

            {/* Live transcript */}
            <div>
              <div className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Mic className="w-3 h-3" /> Live Transcript
              </div>
              <Textarea
                readOnly
                value={transcript}
                placeholder="Your transcribed answer will appear here once recording starts…"
                className="resize-none bg-gray-50 border-gray-200 text-base text-gray-800 min-h-[90px]"
              />
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-4 py-2 border-t border-gray-100">
              <Button className={`flex items-center gap-2 px-5 py-2.5 text-base font-medium pointer-events-none
                ${isRecording ? 'bg-red-600 text-white' : sessionDone ? 'bg-gray-400 text-white' : 'bg-[#094D7B] text-white'}`}>
                {isRecording
                  ? <><MicOff className="w-4 h-4" />Recording…</>
                  : sessionDone
                  ? <><CheckCircle2 className="w-4 h-4" />Session Complete</>
                  : <><Mic className="w-4 h-4" />Auto Record</>}
              </Button>
              <Button className={`flex items-center gap-2 px-5 py-2.5 text-base font-medium pointer-events-none
                ${sessionDone ? 'bg-[#094D7B] text-white' : 'bg-gray-200 text-gray-400'}`}>
                <FileText className="w-4 h-4" />
                {sessionDone ? 'Generate Report' : 'Auto Submit'}
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════ SECTION 3: PERFORMANCE REPORT ═══════════════ */}
        {activeSection === 'Performance Report' && reportReady && (
          <div ref={reportRef} className="scroll-mt-24">
            <div className="w-full bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">

              {/* ── Report letterhead ── */}
              <div className="bg-[#094D7B] px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-1">ProValuate · Interview Performance Report</p>
                  <h2 className="text-white text-xl sm:text-2xl font-bold">Power BI Developer — Candidate Assessment</h2>
                  <p className="text-white/70 text-sm mt-1">Report ID: PV-{new Date().getFullYear()}-PBI-0142 · Generated {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <img
                  src="https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzj8nq3e.jpg"
                  alt="Candidate"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover object-[50%_25%] border-2 border-white/40 flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>

              <div className="p-5 sm:p-8 space-y-6">

                {/* ── Overall score summary ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-100">
                  <div>
                    <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-1">Overall Score</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold text-[#094D7B]">{OVERALL}</span>
                      <span className="text-base text-gray-400">/ 10</span>
                    </div>
                  </div>
                  <div className="flex gap-4 sm:gap-6 text-center">
                    <div>
                      <p className="text-xs uppercase tracking-wide font-semibold text-gray-400">Role</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">Power BI Developer</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide font-semibold text-gray-400">Type</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">Functional · AI Interview</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide font-semibold text-gray-400">Questions</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{QA.length} answered</p>
                    </div>
                  </div>
                </div>

                {/* ── Competency summary table ── */}
                <div ref={competencyRef} className="scroll-mt-24">
                  <p className="text-base font-bold text-gray-800 mb-3">Competency Summary</p>
                  <div className={`space-y-3 rounded-lg border transition-all duration-500 p-3
                    ${reportStep === 'competency' ? 'pulse-highlight' : 'border-transparent'}`}>
                    {COMPETENCIES.map(c => {
                      const band = scoreBand(c.score);
                      return (
                        <div key={c.id} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 truncate flex-1 mr-2">{c.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${band.color}`}>{band.label}</span>
                              <span className="text-base font-bold text-[#094D7B]">{c.score}/10</span>
                              <span className="text-xs text-gray-400">W:{c.weight}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-[#094D7B]" style={{ width: `${c.score * 10}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Question & Answer review with feedback ── */}
                <div ref={qaRef} className="scroll-mt-24">
                  <p className="text-base font-bold text-gray-800 mb-3">Question &amp; Answer Review</p>
                  <div className={`space-y-4 rounded-lg border transition-all duration-500 p-3
                    ${reportStep === 'qa' ? 'pulse-highlight' : 'border-transparent'}`}>
                    {QA.map((item, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#094D7B] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{item.q}</p>
                        </div>
                        <div className="px-4 py-3 space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-1">Candidate's Answer</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{item.a}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                            <p className="text-xs uppercase tracking-wide font-semibold text-blue-600 mb-1">Feedback</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{item.feedback}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>



                {/* ── Report footer ── */}
                <div className="pt-4 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400">Generated automatically by ProValuate AI · This report reflects a single interview session and is intended as a hiring decision aid.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
});

InterviewRecordingDemo.displayName = 'InterviewRecordingDemo';

export default InterviewRecordingDemo;
