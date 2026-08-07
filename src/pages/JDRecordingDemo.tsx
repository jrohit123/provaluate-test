import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, FileText, Edit, Loader2, Type, FileUp, Settings,
  Play, Volume2, VolumeX, RotateCcw, File, CheckCircle2,
} from 'lucide-react';

// ─── Demo data (real production record) ────────────────────────────────────
const DEMO_JD_TITLE = 'Power BI Developer';
const DEMO_FILE_NAME = 'Power_BI_Developer_jd.txt';

const DEMO_JD_TEXT = `Company Name: Credenca Data Solutions Pvt. Ltd.
Position: BI Developer  |  Experience: 0–2 Years

Description of position:
Credenca Data Solutions Pvt Ltd is looking for experienced BI Developers with relevant hands-on experience in development and support activities of BI environments.

Desired skills and experiences:
1. Strong experience in Power BI eco-system — Power BI Desktop, Power Query, PowerBI Service, PowerBI Gateway, PowerBI Mobile.
2. Good understanding of database concepts, data modeling concepts.
3. Expertise in DAX, M Query
4. Expertise in data transformations using Power Query.
5. Knowledge of all Power BI Service features and functionalities.
6. Experience of configuring Power BI Gateway.
7. Good knowledge of Power BI reports deployment to Power BI Service.
8. Experience in Power BI administrations — purchase permissions, authorizations, scheduling, deployments etc.
9. Experience in writing complex SQL queries.
10. Excellent communication skills with ability to handle customer team at all levels (Must).
11. Excellent analytical skills.
12. Excellent documentation skills.
13. Excellent task and project management skills.

Educational Qualifications:
1. Candidate should hold at minimum a bachelor's degree.
2. Any relevant certifications.

Work Location: Pune
Requirement Fulfillment: Immediate to within 15–20 days`;

const DEMO_RESOLVED = {
  attributes: {
    City: { place: 'Pune' },
    'Job History': { mandatory: '0 To 2 Years of relevant hands-on experience in BI environments development and support activities.' },
    'Technical skills': {
      Required: ['Power BI Desktop', 'Power Query', 'Power BI Service', 'PowerBI Gateway', 'PowerBI Mobile', 'DAX', 'M Query', 'data transformations using Power Query', 'Power BI Service features and functionalities', 'configuring Power BI Gateway', 'Power BI reports deployment to Power BI Service', 'Power BI administrations (purchase permissions, authorizations, scheduling, deployments)', 'writing complex SQL queries'],
      Preferred: ['Microsoft Azure Data Platform', 'Tableau', 'Qlik', 'SAP BW', 'SAP Analytics Cloud', 'Microsoft SSIS', 'Talend', 'Alteryx'],
    },
    'Functional skills': { Required: ['database concepts', 'data modeling concepts'] },
    'Soft skills': {
      Required: ['Excellent communication skills with ability to handle customer team at all levels', 'Excellent analytical skills', 'Excellent documentation skills', 'Excellent task and project management skills'],
      Preferred: ['Communication'],
    },
    'Educational qualification': { mandatory: "A bachelor's degree." },
  },
};

// ─── TTS Script ────────────────────────────────────────────────────────────
const TTS = {
  idle:       'Welcome to ProValuate. Hire the right people faster, reduce costly hiring mistakes, and build teams that drive higher business profitability.',
  picker:     'Upload your Job Description or get it from your existing ATS or HRMS. Start building a hiring process that finds better talent faster, before great candidates slip away.',
  uploading:  'Using this Power B I Developer role, ProValuate creates one hiring standard, so every recruiter identifies the right talent, not just the loudest résumés.',
  editor:     'Fine-tune your hiring expectations now, so every shortlist reflects the people who will actually succeed in the role.',
  processing: 'ProValuate transforms your Job Description into an editable hiring blueprint that cuts manual screening, removes bias, and helps prevent expensive mis-hires.',
  resolved:   'Your hiring blueprint is ready. Shortlist stronger candidates faster, make confident hiring decisions, and build teams that accelerate business growth.',
};
type DemoStep = 'idle' | 'picker' | 'uploading' | 'editor' | 'processing' | 'resolved';

// ─── Web Speech TTS helper ──────────────────────────────────────────────────
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

// ── File type icon colours (Windows Explorer style) ─────────────────────────
function FileIcon({ ext, selected }: { ext: string; selected: boolean }) {
  const colours: Record<string, string> = {
    PDF: '#E2231A', DOCX: '#2B579A', DOC: '#2B579A',
    TXT: '#555', XLSX: '#217346', PNG: '#7B4FA6', JPG: '#7B4FA6',
  };
  const col = selected ? '#fff' : (colours[ext] ?? '#094D7B');
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <rect x="2" y="1" width="9" height="14" rx="1" fill={selected ? 'rgba(255,255,255,0.25)' : '#f3f4f6'} stroke={col} strokeWidth="1"/>
      <path d="M9 1l3 3h-3V1z" fill={col} opacity="0.6"/>
      <text x="4" y="12" fontSize="4" fontWeight="bold" fill={col} fontFamily="Arial">{ext.slice(0,3)}</text>
    </svg>
  );
}

// ── Fake Windows Explorer file-picker ───────────────────────────────────────
function FilePicker({ visible }: { visible: boolean }) {
  const sidebarItems = [
    { icon: '⭐', label: 'Quick access', indent: 0 },
    { icon: '🖥️', label: 'Desktop',      indent: 1, active: true },
    { icon: '⬇️', label: 'Downloads',    indent: 1 },
    { icon: '📄', label: 'Documents',    indent: 1 },
    { icon: '🖼️', label: 'Pictures',     indent: 1 },
    { icon: '💻', label: 'This PC',      indent: 0 },
    { icon: '💾', label: 'Local Disk (C:)', indent: 1 },
    { icon: '🌐', label: 'Network',      indent: 0 },
  ];

  const files = [
    { name: 'Job Descriptions',          ext: 'Folder', size: '',        modified: '01/08/2026 09:14', type: 'File folder', isFolder: true },
    { name: 'Power_BI_Developer_jd.txt', ext: 'TXT',    size: '14.2 KB', modified: '01/08/2026 09:11', type: 'Text Document' },
    { name: 'HR_Head_Medical_jd.pdf',    ext: 'PDF',    size: '98.4 KB', modified: '01/06/2026 13:04', type: 'PDF Document' },
    { name: 'Machine_Learning_jd.docx',  ext: 'DOCX',   size: '32.1 KB', modified: '03/04/2026 11:23', type: 'Word Document' },
    { name: 'Resume_John_Smith.pdf',     ext: 'PDF',    size: '245 KB',  modified: '12/07/2025 16:45', type: 'PDF Document' },
    { name: 'Interview_Notes_Q3.docx',   ext: 'DOCX',   size: '21.3 KB', modified: '22/07/2026 14:30', type: 'Word Document' },
    { name: 'Shortlist_Aug2026.xlsx',    ext: 'XLSX',   size: '18.7 KB', modified: '30/07/2026 10:00', type: 'Excel Spreadsheet' },
  ];

  const [selected, setSelected] = useState<string | null>(null);
  const [animOpen, setAnimOpen] = useState(false);

  useEffect(() => {
    if (!visible) { setSelected(null); setAnimOpen(false); return; }
    // Slight delay so the overlay fades in first, then dialog zooms in
    const t0 = setTimeout(() => setAnimOpen(true), 60);
    const t1 = setTimeout(() => setSelected(DEMO_FILE_NAME), 1100);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
         style={{ animation: 'fadeIn 180ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes zoomIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
      <div
        className="bg-white shadow-2xl overflow-hidden border border-gray-400"
        style={{
          width: 680, maxWidth: '95vw',
          borderRadius: 6,
          animation: animOpen ? 'zoomIn 180ms ease forwards' : 'none',
          opacity: animOpen ? 1 : 0,
        }}
      >
        {/* ── Windows title bar ── */}
        <div className="flex items-center justify-between px-3 py-1.5 select-none"
             style={{ background: 'linear-gradient(to bottom,#e8f0fe,#d0ddf7)', borderBottom: '1px solid #b0b8d0' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">📂</span>
            <span className="text-xs font-medium text-gray-700">Open</span>
          </div>
          <div className="flex gap-1">
            {['─','□','✕'].map((s,i) => (
              <button key={i} className="w-6 h-5 text-[10px] text-gray-600 hover:bg-red-100 rounded flex items-center justify-center">{s}</button>
            ))}
          </div>
        </div>

        {/* ── Address / toolbar bar ── */}
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50">
          {/* Back/Forward */}
          {['←','→','↑'].map((a,i) => (
            <button key={i} className="w-6 h-6 rounded text-gray-400 hover:bg-gray-200 text-xs flex items-center justify-center border border-transparent hover:border-gray-300">{a}</button>
          ))}
          {/* Path bar */}
          <div className="flex-1 flex items-center gap-0.5 border border-gray-300 rounded bg-white px-2 py-0.5 text-[11px] text-gray-700">
            <span className="text-gray-400">💻</span>
            <span className="text-gray-300 mx-0.5">›</span>
            <span>This PC</span>
            <span className="text-gray-300 mx-0.5">›</span>
            <span>🖥️ Desktop</span>
            <span className="text-gray-300 mx-0.5">›</span>
            <span className="font-medium text-[#094D7B]">Job Descriptions</span>
          </div>
          {/* Search box */}
          <div className="flex items-center gap-1 border border-gray-300 rounded bg-white px-2 py-0.5 text-[11px] text-gray-400" style={{width:140}}>
            <span>🔍</span>
            <span>Search Job Descriptions</span>
          </div>
        </div>

        {/* ── Body: sidebar + file list ── */}
        <div className="flex" style={{ height: 300 }}>
          {/* Left sidebar */}
          <div className="border-r border-gray-200 bg-gray-50 py-1 overflow-y-auto flex-shrink-0" style={{ width: 150 }}>
            {sidebarItems.map((item, i) => (
              <div key={i}
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] cursor-pointer select-none rounded mx-1
                  ${item.active ? 'bg-[#cce0f5] text-[#094D7B] font-medium' : 'text-gray-600 hover:bg-gray-200'}`}
                style={{ paddingLeft: item.indent * 10 + 8 }}
              >
                <span>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Right: column headers + file rows */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center border-b border-gray-200 bg-gray-100 px-2 text-[10px] text-gray-500 font-medium select-none flex-shrink-0" style={{height:22}}>
              <span className="flex-1">Name</span>
              <span style={{width:130}}>Date modified</span>
              <span style={{width:110}}>Type</span>
              <span style={{width:70}} className="text-right pr-3">Size</span>
            </div>
            {/* File rows */}
            <div className="flex-1 overflow-y-auto py-0.5">
              {files.map(f => {
                const isSel = selected === f.name;
                return (
                  <div key={f.name}
                    className={`flex items-center gap-2 px-2 py-0.5 cursor-pointer select-none text-[11px] rounded mx-1 my-px
                      ${isSel ? 'bg-[#0078d4] text-white' : 'text-gray-700 hover:bg-blue-50'}`}
                    style={{ height: 22 }}
                  >
                    {f.isFolder
                      ? <span className="flex-shrink-0 text-sm" style={{width:16}}>📁</span>
                      : <FileIcon ext={f.ext} selected={isSel} />
                    }
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    <span className={`flex-shrink-0 ${isSel ? 'text-blue-100' : 'text-gray-400'}`} style={{width:130}}>{f.modified}</span>
                    <span className={`flex-shrink-0 ${isSel ? 'text-blue-100' : 'text-gray-400'}`} style={{width:110}}>{f.type}</span>
                    <span className={`flex-shrink-0 text-right pr-3 ${isSel ? 'text-blue-100' : 'text-gray-400'}`} style={{width:70}}>{f.size}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Status / bottom bar ── */}
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2">
          <span className="text-[11px] text-gray-500 mr-auto">
            {selected ? `1 item selected  (${files.find(f => f.name === selected)?.size ?? ''})` : '7 items'}
          </span>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <label className="text-[11px] text-gray-600 whitespace-nowrap">File name:</label>
            <input readOnly value={selected ?? ''} placeholder=""
              className="flex-1 text-[11px] border border-gray-400 px-2 py-0.5 rounded bg-white outline-none text-gray-800 min-w-0" />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px] text-gray-600">All files (*.*)</span>
          </div>
          <button className={`text-[11px] px-5 py-1 rounded font-medium border transition-colors
            ${selected ? 'bg-[#0078d4] text-white border-[#005fa3] hover:bg-[#006cc1]' : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'}`}
            disabled={!selected}>Open</button>
          <button className="text-[11px] px-4 py-1 rounded border border-gray-300 text-gray-600 bg-white hover:bg-gray-100">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export interface JDRecordingDemoHandle {
  runDemo: () => Promise<void>;
  stopDemo: () => void;
  resetDemo: () => void;
}
interface JDRecordingDemoProps {
  autoPlay?: boolean;
  embedded?: boolean;
  muted?: boolean;
}

const JDRecordingDemo = forwardRef<JDRecordingDemoHandle, JDRecordingDemoProps>(function JDRecordingDemo(
  { autoPlay = false, embedded = false, muted: mutedProp },
  ref
) {
  const [step, setStep]               = useState<DemoStep>('idle');
  const [inputMode, setInputMode]     = useState<'file' | 'editor'>('file');
  const [showPicker, setShowPicker]   = useState(false);
  const [uploadedFile, setUploadedFile] = useState(false);
  const [jobTitle, setJobTitle]       = useState('');
  const [editorText, setEditorText]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [viewMode, setViewMode]         = useState<'resolved' | 'extracted'>('resolved');
  const [muted, setMuted]               = useState(mutedProp ?? false);
  useEffect(() => { if (mutedProp !== undefined) setMuted(mutedProp); }, [mutedProp]);
  const [running, setRunning]           = useState(false);
  const [statusLabel, setStatusLabel]   = useState('Press Play to start the demo');
  const abortRef    = useRef(false);
  const editorRef   = useRef<HTMLDivElement>(null);
  const resolvedRef = useRef<HTMLDivElement>(null);
  // real hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  // Auto-scroll the editor as text appears
  useEffect(() => {
    if (editorRef.current && editorText) {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [editorText]);

  // Scroll resolved panel into view when it appears
  useEffect(() => {
    if (showResolved && resolvedRef.current) {
      setTimeout(() => {
        resolvedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [showResolved]);

  // Auto-play when component mounts with autoPlay prop
  useEffect(() => {
    if (autoPlay && !running) {
      runDemo();
    }
  }, [autoPlay]);

  const speakStep = useCallback((s: keyof typeof TTS): Promise<void> =>
    new Promise(resolve => {
      if (muted || !window.speechSynthesis) { resolve(); return; }
      speak(TTS[s], resolve);
    }), [muted]);

  const hardReset = () => {
    setStep('idle'); setInputMode('file'); setShowPicker(false); setUploadedFile(false);
    setJobTitle(''); setEditorText(''); setIsProcessing(false);
    setShowResolved(false); setViewMode('resolved');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Type text letter-by-letter into editor for the typewriter effect
  const typeText = async (full: string) => {
    // Stream in chunks of ~6 chars every 18ms for a smooth fast-type feel
    const chunkSize = 18;
    let i = 0;
    while (i < full.length) {
      if (abortRef.current) return;
      const chunk = full.slice(0, i + chunkSize);
      setEditorText(chunk);
      i += chunkSize;
      await wait(8);
    }
    setEditorText(full);
  };

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    hardReset();
    const dead = () => abortRef.current;

    // 1 — intro
    setStatusLabel('Introduction'); setStep('idle');
    await speakStep('idle');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    // 2 — show picker
    setStatusLabel('Opening file browser'); setStep('picker');
    setShowPicker(true);
    await speakStep('picker');
    if (dead()) { setRunning(false); return; }
    // picker auto-closes itself after ~1.9s via onPicked callback — we just wait
    await wait(2200);

    // 3 — file selected, badge shown
    setStatusLabel('File selected');  setStep('uploading');
    setShowPicker(false);
    setUploadedFile(true);
    setJobTitle(DEMO_JD_TITLE);
    await speakStep('uploading');
    if (dead()) { setRunning(false); return; }
    await wait(500);

    // 4 — switch to editor tab, typewriter text
    setStatusLabel('Showing extracted text'); setStep('editor');
    setInputMode('editor');
    await speakStep('editor');
    // Start typewriter concurrently with TTS already running above — type while speaking
    if (dead()) { setRunning(false); return; }
    await typeText(DEMO_JD_TEXT);
    if (dead()) { setRunning(false); return; }
    await wait(500);

    // 5 — switch back to file tab, process
    setStatusLabel('Processing…'); setStep('processing');
    setInputMode('file');
    setIsProcessing(true);
    await speakStep('processing');
    if (dead()) { setRunning(false); return; }
    await wait(2200);
    if (dead()) { setRunning(false); return; }
    setIsProcessing(false);

    // 6 — resolved
    setStatusLabel('Resolved JD ready'); setStep('resolved');
    setShowResolved(true); setViewMode('resolved');
    await speakStep('resolved');
    if (dead()) { setRunning(false); return; }
    await wait(1500);

    setRunning(false);
    setStatusLabel('Demo complete — press Play to replay');
  }, [speakStep]);

  const stopDemo  = () => {
    abortRef.current = true;
    window.speechSynthesis?.cancel();
    setShowPicker(false); setRunning(false); setStatusLabel('Stopped — press Play to restart');
  };
  const resetDemo = () => { stopDemo(); hardReset(); setStatusLabel('Press Play to start the demo'); };

  useImperativeHandle(ref, () => ({ runDemo, stopDemo, resetDemo }), [runDemo, stopDemo, resetDemo]);

  // Real file picker handler (user can also manually pick during demo)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFile(true);
    if (!jobTitle) setJobTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fake file picker overlay */}
      <FilePicker visible={showPicker} />

      {/* ── Demo control bar (identical visual weight to the app's top nav) ── */}
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
          <Button variant="ghost" size="sm" onClick={() => setMuted(m => !m)} className="h-8 w-8 p-0" title={muted ? 'Unmute' : 'Mute narration'}>
            {muted ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-[#094D7B]" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetDemo} disabled={!running && step === 'idle'} className="h-8 w-8 p-0" title="Reset">
            <RotateCcw className="w-4 h-4" />
          </Button>
          {running
            ? <Button size="sm" variant="destructive" onClick={stopDemo} className="h-8 px-3 text-xs">Stop</Button>
            : <Button size="sm" onClick={runDemo}
                className="h-8 px-3 text-xs text-white bg-[#094D7B] hover:bg-[#094D7B]/90 gap-1.5">
                <Play className="w-3 h-3 fill-current" /> Play Demo
              </Button>
          }
        </div>
      </div>
      )}

      {/* ── Exact replica of the original JobUploadSection layout ── */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Card className="animate-fade-in">
          <CardHeader className="relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 flex-shrink-0" />
                  <span className="truncate">Job Description</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  Upload your job description file or enter text directly
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto sm:ml-4 flex flex-col sm:items-end gap-1 flex-shrink-0">
                <p className="text-xs font-medium text-right text-emerald-600">2/5 active, 3 available</p>
                <Button variant="default" size="sm"
                  className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm text-white bg-[#094D7B] shadow-[0_4px_18px_rgba(9,77,123,0.20)] hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.26)] pointer-events-none">
                  <Settings className="w-4 h-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Manage Job Descriptions</span>
                  <span className="sm:hidden">Manage Jobs</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Job title — matches "Create a new job description" section */}
            <div className={`rounded-lg border border-primary-200 bg-primary-50/40 p-3 sm:p-4 transition-all duration-500
              ${step === 'uploading' || step === 'editor' ? 'ring-2 ring-[#094D7B]/25 border-[#094D7B]/50' : ''}`}>
              <label className="mb-2 block text-xs sm:text-sm font-medium text-primary-700">
                Create a new job description
              </label>
              <Input
                readOnly
                value={jobTitle}
                placeholder="Job Title (e.g., Senior Software Engineer)"
                className="mb-0 text-base"
              />
            </div>

            {/* Tabs */}
            <Tabs value={inputMode} onValueChange={v => setInputMode(v as 'file' | 'editor')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <FileUp className="w-4 h-4" /> Upload File
                </TabsTrigger>
                <TabsTrigger value="editor" className="flex items-center gap-2">
                  <Type className="w-4 h-4" /> Text Editor
                </TabsTrigger>
              </TabsList>

              {/* ── FILE TAB ── exact structure from original */}
              <TabsContent value="file" className="space-y-4">

                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFileChange({ target: { files: e.dataTransfer.files } } as any); }}
                  className={`rounded-lg border-2 border-dashed bg-primary-50/40 p-4 sm:p-6 text-center hover:border-primary-400 transition-all duration-500 cursor-pointer
                    ${step === 'picker' ? 'border-[#094D7B] bg-blue-50/60 scale-[1.005]' : 'border-primary-200'}`}
                >
                  <Upload className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 transition-colors ${step === 'picker' ? 'text-[#094D7B]' : 'text-primary-400'}`} />
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Drop files here or click to browse (PDF, DOCX, TXT)
                  </p>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileChange} />

                {/* File badge — appears after picker */}
                {uploadedFile && (
                  <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-white transition-all duration-500
                    ${step === 'uploading' ? 'border-[#094D7B]/50 shadow-sm ring-1 ring-[#094D7B]/15' : 'border-gray-200'}`}>
                    <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <File className="w-4 h-4 text-[#094D7B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">{DEMO_FILE_NAME}</p>
                      <p className="text-[10px] text-gray-400">14.2 KB · TXT</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                )}



                {/* Glider slider + resolved/extracted panels — exact original structure */}
                {showResolved && (
                  <div ref={resolvedRef} className="flex flex-col gap-2 scroll-mt-20">
                    {/* Toggle — same w-14 h-7 glider as original */}
                    <div className="flex items-center justify-center gap-3">
                      <span className={`text-xs sm:text-sm font-medium transition-colors ${viewMode === 'resolved' ? 'text-primary-600' : 'text-gray-500'}`}>
                        Resolved Data
                      </span>
                      <div
                        className="relative w-14 h-7 bg-gray-300 rounded-full cursor-pointer transition-colors duration-300"
                        onClick={() => setViewMode(v => v === 'resolved' ? 'extracted' : 'resolved')}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewMode(v => v === 'resolved' ? 'extracted' : 'resolved'); }}}
                      >
                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300
                          ${viewMode === 'extracted' ? 'translate-x-7' : 'translate-x-0'}`} />
                      </div>
                      <span className={`text-xs sm:text-sm font-medium transition-colors ${viewMode === 'extracted' ? 'text-primary-600' : 'text-gray-500'}`}>
                        Source JD
                      </span>
                    </div>

                    {/* Resolved Data panel — exact original markup */}
                    {viewMode === 'resolved' && (
                      <div className={`mt-2 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 transition-all duration-700
                        ${step === 'resolved' ? 'ring-2 ring-[#094D7B]/25' : ''}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                          <h4 className="font-semibold text-xs sm:text-sm md:text-base text-[#094D7B]">Resolved Job Description</h4>
                          <Button variant="ghost" size="sm" className="w-full sm:w-auto pointer-events-none">
                            <Edit className="w-4 h-4 mr-2" />
                            <span className="text-xs sm:text-sm">Edit</span>
                          </Button>
                        </div>
                        <div className="space-y-2 text-xs sm:text-sm text-left">
                          {Object.entries(DEMO_RESOLVED.attributes).map(([key, value]) => (
                            <div key={key} className="flex flex-col space-y-1">
                              <span className="font-medium capitalize text-left text-xs sm:text-sm">
                                {key.replace(/_/g, ' ')}:
                              </span>
                              <div className="text-left pl-2">
                                {typeof value === 'object' && value !== null
                                  ? Object.entries(value).map(([subKey, subVal]) => (
                                      <div key={subKey} className="ml-2 mb-1">
                                        <span className="font-medium text-gray-700 capitalize text-xs sm:text-sm">{subKey}:</span>
                                        {Array.isArray(subVal)
                                          ? <div className="ml-2 text-xs sm:text-sm break-words">{subVal.join(', ')}</div>
                                          : <span className="ml-2 text-xs sm:text-sm break-words">{String(subVal)}</span>
                                        }
                                      </div>
                                    ))
                                  : <span className="text-xs sm:text-sm break-words">{String(value) || 'N/A'}</span>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extracted text panel */}
                    {viewMode === 'extracted' && (
                      <div className="mt-2 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="font-semibold text-sm sm:text-base mb-2 text-[#094D7B]">Extracted Job Description Text</h4>
                        <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm bg-white p-3 sm:p-4 rounded border overflow-x-auto max-h-96 overflow-y-auto">
                          {DEMO_JD_TEXT}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ── EDITOR TAB ── */}
              <TabsContent value="editor" className="space-y-4">
                <div className={`space-y-2 transition-all duration-500 ${step === 'editor' ? 'ring-2 ring-[#094D7B]/15 rounded-lg' : ''}`}>
                  <label className="text-sm font-medium text-primary-700">Job Description Content</label>
                  <p className="text-xs text-muted-foreground">
                    Type or paste your job description. Use the toolbar to format text and highlight important parts.
                  </p>
                  {/* Lightweight editor replica — no external deps, autoscrolls via ref */}
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="border-b bg-gray-50 p-2 flex flex-wrap items-center gap-1">
                      {['B','I','S','H1','H2','H3','•','1.','↩','↪'].map(t => (
                        <button key={t} className="h-8 w-8 text-xs font-bold rounded hover:bg-gray-200 transition-colors text-gray-600">{t}</button>
                      ))}
                    </div>
                    {/* scrollable text area — auto-scrolls as typewriter fills it */}
                    <div
                      ref={editorRef}
                      className="p-4 h-64 overflow-y-auto text-xs sm:text-sm text-gray-700 font-mono whitespace-pre-wrap"
                    >
                      {editorText || <span className="text-gray-400">Enter your job description here. You can format text, add headings, create lists, and highlight important sections…</span>}
                    </div>
                    <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
                      {editorText.length} characters
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Process button — exact original */}
            <div className="space-y-2">
              <Button
                className={`w-full h-10 sm:h-11 text-base text-white bg-[#094D7B] shadow-[0_4px_18px_rgba(9,77,123,0.20)] transition-all hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.26)]
                  ${step === 'processing' ? 'ring-4 ring-[#094D7B]/30 scale-[1.01]' : ''}`}
                disabled={isProcessing}
              >
                {isProcessing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /><span className="text-xs sm:text-sm">Processing...</span></>
                  : <><span className="sm:hidden">Process Job</span><span className="hidden sm:inline">Process Job Description</span></>
                }
              </Button>
              <div className="text-sm mt-2">
                <span className="font-medium text-emerald-600">2 / 5 active JDs (3 remaining)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

JDRecordingDemo.displayName = 'JDRecordingDemo';

export default JDRecordingDemo;
