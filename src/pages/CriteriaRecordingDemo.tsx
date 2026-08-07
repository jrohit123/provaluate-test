import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Plus, Trash2, Download, Save, Grid, Briefcase,
  Sparkles, Play, Volume2, VolumeX, RotateCcw, File,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface CriteriaRow { id: string; parameter: string; weightage: number; notes: string; }

// ─── Excel-uploaded Power BI criteria (real production data) ────────────────
const EXCEL_CRITERIA: CriteriaRow[] = [
  { id: '1', parameter: 'Technical Skills',    weightage: 30, notes: 'Check the relevant experience in Power BI Desktop, DAX, M Query, Power Query, PowerBI Service, Gateway and SQL queries.' },
  { id: '2', parameter: 'Experience Level',     weightage: 25, notes: 'Years of hands-on BI environment development and support activities. 0–2 years expected for this role.' },
  { id: '3', parameter: 'Education',            weightage: 15, notes: "Bachelor's degree minimum. Relevant certifications like PL-300 (Microsoft Power BI Data Analyst) add value." },
  { id: '4', parameter: 'Soft Skills',          weightage: 20, notes: 'Excellent communication skills with ability to handle customer team at all levels. Analytical, documentation and task management skills.' },
  { id: '5', parameter: 'Stability',            weightage: 10, notes: 'Calculate Stability Score based on average tenure across previous companies. Higher scores for consistent employment.' },
];

const SAVED_GRIDS = [
  { criteria_id: '_blank_',   criteria_name: '_Blank_',                        jd: null },
  { criteria_id: '_default_', criteria_name: '_Default_',                      jd: null },
  { criteria_id: 'pbi-crit',  criteria_name: 'Power BI Developer - Scoring Criteria', jd: 'Power BI Developer' },
  { criteria_id: 'hr-crit',   criteria_name: 'HR Head',                        jd: 'HR Head Medical' },
];

const EXCEL_FILE_NAME    = 'PowerBI_Criteria_ProValuate.xlsx';
const CRITERIA_GRID_NAME = 'Power BI Developer - Scoring Criteria';

// ─── TTS Script (value-first, CHRO audience) ────────────────────────────────
const TTS = {
  idle: 'Without a scoring framework, hiring between 2 recruiters depends on personal judgment. Great candidates get rejected and poor hires slip through. ProValuate lets you define success before screening begins.',
  jd_banner:    "Hiring a Power B I Developer? Define exactly what great looks like. From skills to experience, so every hiring decision improves business performance.",
  download_tmpl:'Complete this simple template in minutes. Prioritize what drives success, assign weightages, and ensure AI evaluates every candidate the way you would.',
  show_excel:   "Here's a completed hiring framework. Every requirement is weighted by business importance, ensuring top candidates rise to the top and not just the best-looking résumés.",
  upload_excel: 'Upload your framework once, and ProValuate instantly applies your hiring standards, eliminating manual setup and inconsistent evaluations.',
  show_table:   'Now every applicant is scored against the same business-driven criteria, helping you compare candidates fairly, confidently, and at scale.',
  save_excel:   'Save it once and use it forever. All future shortlists stay consistent, defensible, and focused on hiring the right people.',
};
type DemoStep = 'idle' | 'jd_banner' | 'download_tmpl' | 'show_excel' | 'upload_excel' | 'show_table' | 'save_excel';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.98; u.pitch = 1; u.volume = 1;
  const vv = window.speechSynthesis.getVoices();
  const v  = vv.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google')))
           || vv.find(v => v.lang.startsWith('en'));
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Unified Excel overlay — cross-fades between generic and filled ──────────
type ExcelMode = 'generic' | 'filled' | null;

const GENERIC_ROWS = [
  ['Parameter',                   'Weightage (%)', 'Notes (AI scoring guidance)'],
  ['[e.g. Technical Skills]',     '',  '[e.g. Hands-on experience with relevant tools]'],
  ['[e.g. Experience Level]',     '',  '[e.g. Total years of relevant domain experience]'],
  ['[e.g. Education]',            '',  '[e.g. Degree relevance and institution quality]'],
  ['[e.g. Soft Skills]',          '',  '[e.g. Communication, leadership, teamwork]'],
  ['[e.g. Stability]',            '',  '[e.g. Average tenure per employer]'],
];

const FILLED_ROWS = [
  ['Parameter',          'Weightage', 'Notes'],
  ['Technical Skills',   '30',  'Check relevant experience in Power BI Desktop, DAX, M Query, Power Query, PowerBI Service, Gateway and SQL'],
  ['Experience Level',   '25',  'Years of hands-on BI environment development and support. 0–2 years expected for this role'],
  ['Education',          '15',  "Bachelor's degree minimum. PL-300 certification adds value"],
  ['Soft Skills',        '20',  'Communication skills with ability to handle customer team at all levels. Analytical and documentation skills'],
  ['Stability',          '10',  'Stability Score based on average tenure across previous companies'],
];

function ExcelOverlay({ mode }: { mode: ExcelMode }) {
  // Keep previous rows visible during cross-fade
  const [displayedRows, setDisplayedRows] = useState(GENERIC_ROWS);
  const [displayedTitle, setDisplayedTitle] = useState('evaluation-criteria-template.xlsx');
  const [isGeneric, setIsGeneric] = useState(true);
  // opacity of the content panel — fades to 0, swaps content, fades back to 1
  const [contentOpacity, setContentOpacity] = useState(1);
  const prevMode = useRef<ExcelMode>(null);

  useEffect(() => {
    if (mode === prevMode.current) return;
    const prev = prevMode.current;
    prevMode.current = mode;

    if (!mode) return; // closing handled by parent

    if (prev === null) {
      // First appearance — just set content immediately
      const generic = mode === 'generic';
      setDisplayedRows(generic ? GENERIC_ROWS : FILLED_ROWS);
      setDisplayedTitle(generic ? 'evaluation-criteria-template.xlsx' : 'PowerBI_Criteria_ProValuate.xlsx');
      setIsGeneric(generic);
      setContentOpacity(1);
      return;
    }

    // Cross-fade: fade out → swap → fade in
    setContentOpacity(0);
    const t = setTimeout(() => {
      const generic = mode === 'generic';
      setDisplayedRows(generic ? GENERIC_ROWS : FILLED_ROWS);
      setDisplayedTitle(generic ? 'evaluation-criteria-template.xlsx' : 'PowerBI_Criteria_ProValuate.xlsx');
      setIsGeneric(generic);
      setContentOpacity(1);
    }, 320); // swap at midpoint of fade
    return () => clearTimeout(t);
  }, [mode]);

  if (!mode) return null;

  const cols = ['A', 'B', 'C'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
         style={{ animation: 'fadeIn 180ms ease' }}>
      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes zoomIn  { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
      `}</style>
      <div style={{
        width: 1100, maxWidth: '98vw', background: '#fff',
        border: '1px solid #bbb', borderRadius: 4,
        boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
        animation: 'zoomIn 180ms ease forwards',
        overflow: 'hidden',
      }}>
        {/* Title bar */}
        <div style={{ background: '#217346', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: '#fff' }}>✕</span>
            <span style={{ fontSize: 13, color: '#e0f0e8', fontWeight: 600, transition: 'opacity .32s', opacity: contentOpacity }}>
              {displayedTitle} — Excel
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['─','□','✕'].map((s,i) => <span key={i} style={{ color:'#c8e6c8', fontSize:13, padding:'0 5px' }}>{s}</span>)}
          </div>
        </div>
        {/* Ribbon */}
        <div style={{ background:'#f3f3f3', borderBottom:'1px solid #ddd', padding:'4px 14px', display:'flex', gap:20 }}>
          {['File','Home','Insert','Page Layout','Formulas','Data','Review','View'].map(m => (
            <span key={m} style={{ fontSize:13, color: m==='Home'?'#217346':'#444', fontWeight: m==='Home'?700:400, padding:'2px 4px', borderBottom: m==='Home'?'2px solid #217346':'none' }}>{m}</span>
          ))}
        </div>
        {/* Formula bar */}
        <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid #ddd', padding:'3px 10px', gap:10, background:'#fafafa' }}>
          <span style={{ fontSize:13, color:'#888', width:34, textAlign:'center', border:'1px solid #ddd', padding:'2px 4px', background:'#fff' }}>A1</span>
          <span style={{ fontSize:14, color:'#888' }}>fx</span>
          <span style={{ fontSize:13, flex:1, color:'#222' }}>Parameter</span>
        </div>
        {/* Sheet — the only part that fades */}
        <div style={{ overflowX:'auto', transition: `opacity .32s ease`, opacity: contentOpacity }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:28 }} />
              <col style={{ width: isGeneric ? 220 : 200 }} />
              <col style={{ width: isGeneric ? 120 : 80  }} />
              <col style={{ width:'auto' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ background:'#f3f3f3', border:'1px solid #ddd', textAlign:'center', color:'#888', fontWeight:400, padding:'4px' }}></th>
                {cols.map(c => <th key={c} style={{ background:'#f3f3f3', border:'1px solid #ddd', textAlign:'center', padding:'4px 8px', color:'#444', fontWeight:600, fontSize:13 }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, ri) => (
                <tr key={ri} style={{ background: ri === 0 ? '#e8f5e9' : isGeneric ? '#fff' : ri % 2 === 0 ? '#f9fffe' : '#fff' }}>
                  <td style={{ border:'1px solid #ddd', textAlign:'center', color:'#999', fontSize:12, background:'#f3f3f3', padding:'4px' }}>{ri+1}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      border: '1px solid #ddd',
                      padding: '8px 12px',
                      fontWeight: ri === 0 ? 700 : 400,
                      color: ri === 0 ? '#1a5c35' : isGeneric ? (ci===1?'#217346':'#999') : (ci===1?'#217346':'#222'),
                      fontStyle: isGeneric && ri > 0 ? 'italic' : 'normal',
                      whiteSpace: 'normal', wordBreak: 'break-word',
                      lineHeight: '1.5', verticalAlign: 'top', fontSize: 13,
                    }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Sheet tab */}
        <div style={{ display:'flex', alignItems:'center', borderTop:'1px solid #ddd', background:'#f3f3f3', padding:'3px 10px', gap:2 }}>
          <span style={{ fontSize:13, background:'#fff', border:'1px solid #ddd', borderBottom:'none', padding:'3px 16px', color:'#217346', fontWeight:600 }}>Criteria</span>
          <span style={{ fontSize:20, color:'#999', padding:'0 8px' }}>+</span>
        </div>
      </div>
    </div>
  );
}



interface CriteriaRecordingDemoProps {
  autoPlay?: boolean;
  embedded?: boolean;
  muted?: boolean;
}

export interface CriteriaRecordingDemoHandle {
  runDemo: () => Promise<void>;
  stopDemo: () => void;
  resetDemo: () => void;
}

const CriteriaRecordingDemo = forwardRef<CriteriaRecordingDemoHandle, CriteriaRecordingDemoProps>(function CriteriaRecordingDemo(
  { autoPlay = false, embedded = false, muted: mutedProp },
  ref
) {
  const [step, setStep]               = useState<DemoStep>('idle');
  const [criteriaData, setCriteriaData] = useState<CriteriaRow[]>([]);
  const [selectedGridId, setSelectedGridId] = useState('');
  const [gridName, setGridName]       = useState('');
  const [savedOk, setSavedOk]         = useState(false);
  const [showExcel, setShowExcel]     = useState<ExcelMode>(null);
  const [excelUploaded, setExcelUploaded] = useState(false);
  const [muted, setMuted]             = useState(mutedProp ?? false);
  useEffect(() => { if (mutedProp !== undefined) setMuted(mutedProp); }, [mutedProp]);
  const [running, setRunning]         = useState(false);
  const [statusLabel, setStatusLabel] = useState('Press Play to start the demo');

  const abortRef           = useRef(false);
  const topRef             = useRef<HTMLDivElement>(null);
  const selectRef          = useRef<HTMLDivElement>(null);
  const downloadRef        = useRef<HTMLDivElement>(null);
  const uploadRef          = useRef<HTMLDivElement>(null);
  const tableRef           = useRef<HTMLDivElement>(null);
  const totalRef           = useRef<HTMLDivElement>(null);
  const nameRef            = useRef<HTMLDivElement>(null);
  const savedRef           = useRef<HTMLDivElement>(null);
  const criteriaFileInputRef = useRef<HTMLInputElement>(null);

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

  // Smooth scroll then wait for animation
  const scrollTo = useCallback((ref: React.RefObject<HTMLDivElement>, block: ScrollLogicalPosition = 'start') =>
    new Promise<void>(resolve => {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block });
        setTimeout(resolve, 520);
      }, 80);
    }), []);

  const say = useCallback((s: keyof typeof TTS): Promise<void> =>
    new Promise(resolve => {
      if (muted || !window.speechSynthesis) { resolve(); return; }
      speak(TTS[s], resolve);
    }), [muted]);

  const hardReset = () => {
    setStep('idle'); setCriteriaData([]); setSelectedGridId(''); setGridName('');
    setSavedOk(false); setShowExcel(null); setExcelUploaded(false);
  };

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    hardReset();
    const dead = () => abortRef.current;

    // 1 — Intro
    setStatusLabel('Introduction'); setStep('idle');
    await scrollTo(topRef, 'start');
    await say('idle');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    // 2 — JD banner
    setStatusLabel('JD context'); setStep('jd_banner');
    await scrollTo(topRef, 'start');
    await say('jd_banner');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    // 3 — Download template — highlight table while explaining, then move to download button
    setStatusLabel('Download template'); setStep('download_tmpl');
    await scrollTo(tableRef, 'center');
    await say('download_tmpl');
    if (dead()) { setRunning(false); return; }
    await wait(300);
    await scrollTo(downloadRef, 'center');
    // Show blank template
    setShowExcel('generic');
    await wait(2600);
    if (dead()) { setRunning(false); return; }
    // Cross-fade to filled Power BI template
    setStatusLabel('Filled Excel template'); setStep('show_excel');
    setShowExcel('filled');
    await say('show_excel');
    if (dead()) { setRunning(false); return; }
    await wait(2400);
    // Close overlay once — no jarring re-open
    setShowExcel(null);
    if (dead()) { setRunning(false); return; }
    await wait(400);

    // 6 — Upload zone highlight
    setStatusLabel('Uploading Excel'); setStep('upload_excel');
    await scrollTo(uploadRef, 'center');
    await say('upload_excel');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setExcelUploaded(true);
    setCriteriaData(EXCEL_CRITERIA);
    await wait(400);

    // 7 — Scroll to table to show populated rows
    setStatusLabel('Criteria grid populated'); setStep('show_table');
    await scrollTo(tableRef, 'start');
    await say('show_table');
    if (dead()) { setRunning(false); return; }
    await wait(300);

    // 8 — Scroll to total bar
    await scrollTo(totalRef, 'center');
    await wait(600);

    // 9 — Save
    setStatusLabel('Saving criteria'); setStep('save_excel');
    await scrollTo(nameRef, 'center');
    setGridName(CRITERIA_GRID_NAME);
    await say('save_excel');
    if (dead()) { setRunning(false); return; }
    await wait(500);
    setSavedOk(true);
    await scrollTo(savedRef, 'start');
    await wait(1800);

    setRunning(false);
    setStatusLabel('Demo complete — press Play to replay');
  }, [say, scrollTo]);

  const stopDemo  = () => { abortRef.current = true; window.speechSynthesis?.cancel(); setShowExcel(null); setRunning(false); setStatusLabel('Stopped — press Play to restart'); };
  const resetDemo = () => { stopDemo(); hardReset(); setStatusLabel('Press Play to start the demo'); };

  useImperativeHandle(ref, () => ({ runDemo, stopDemo, resetDemo }), [runDemo, stopDemo, resetDemo]);

  const totalPct = criteriaData.reduce((s, r) => s + (r.weightage || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <ExcelOverlay mode={showExcel} />

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

        {/* ── JD banner ── */}
        {step !== 'idle' && (
          <Card ref={topRef} className={`border-blue-200 bg-blue-50 animate-fade-in transition-all duration-500 ${step === 'jd_banner' ? 'ring-2 ring-[#094D7B]/25' : ''}`}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#094D7B] flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-blue-800 break-words">
                  Creating criteria for: <strong>Power BI Developer</strong>
                </span>
              </div>
              <p className="mt-1 text-xs text-[#094D7B]">
                This criteria will be associated with the selected job description. To create a default criteria that works for all JDs, include "Default" in the name.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Scoring Criteria card ── */}
        <Card className="animate-fade-in">
          {/* invisible anchor at top of card for scroll-to-top */}
          <div ref={step === 'idle' ? topRef : undefined} />

          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-lg sm:text-xl">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                Scoring Criteria <i>(Optional)</i>
              </div>
              <Button variant="default" size="sm"
                className="h-10 gap-2 whitespace-nowrap bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.20)] hover:bg-[#094D7B] pointer-events-none">
                <Sparkles className="w-4 h-4" />
                Generate from JD
              </Button>
            </CardTitle>
            <CardDescription>Configure the parameters and weights for the CV evaluation</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Select saved grid */}
            <div ref={selectRef}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-primary-700 whitespace-nowrap">Select criteria grid:</span>
              <Select value={selectedGridId} onValueChange={setSelectedGridId}>
                <SelectTrigger className="w-full sm:w-[280px] h-11 sm:h-10">
                  <SelectValue placeholder="Choose evaluation criteria..." />
                </SelectTrigger>
                <SelectContent>
                  {SAVED_GRIDS.map(g => (
                    <SelectItem key={g.criteria_id} value={g.criteria_id}>
                      <div className="flex items-center gap-2">
                        <span>{g.criteria_name}</span>
                        {g.jd && <span className="text-[10px] text-gray-400 ml-1">({g.jd})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* OR Create new divider */}
            <div className="flex items-center gap-2 sm:gap-4 my-4 sm:my-6 text-xs sm:text-sm font-medium text-[#094D7B]">
              <span className="flex-1 h-px bg-[#094D7B]/30" />
              <span className="whitespace-nowrap">OR Create new</span>
              <span className="flex-1 h-px bg-[#094D7B]/30" />
            </div>

            {/* Desktop criteria table */}
            <div ref={tableRef} className={`hidden md:block overflow-x-auto border rounded-lg transition-all duration-500
  ${step === 'download_tmpl' ? 'pulse-highlight' : 'border-primary-100'}`}>
              <table className="w-full table-auto">
                <thead className="bg-primary-50 text-left">
                  <tr className="text-xs font-semibold text-primary-800 uppercase tracking-wide">
                    <th className="px-4 py-3 w-[25%]">Parameters To Assess</th>
                    <th className="px-4 py-3 w-[20%]">Weightage</th>
                    <th className="px-4 py-3">How To Assess? (Prompt to AI)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100 bg-white">
                  {criteriaData.map(row => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <Input readOnly value={row.parameter} className="font-medium text-base bg-transparent border border-primary-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input readOnly type="number" value={row.weightage} className="w-20 h-9 text-base text-center bg-primary-50 border border-primary-200" />
                          <span className="text-xs font-semibold text-primary-800">%</span>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input readOnly value={row.notes} className="text-xs text-muted-foreground bg-transparent border border-primary-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile criteria cards */}
            <div className={`block md:hidden space-y-3 rounded-lg border transition-all duration-500
  ${step === 'download_tmpl' ? 'pulse-highlight' : 'border-transparent'}`}>
              {criteriaData.map(row => (
                <Card key={row.id} className="border border-primary-100">
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-primary-800 uppercase tracking-wide">Parameter To Assess</label>
                      <Input readOnly value={row.parameter} className="font-medium text-base bg-transparent border border-primary-100 h-10" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-primary-800 uppercase tracking-wide">Weightage</label>
                      <div className="flex items-center gap-2">
                        <Input readOnly type="number" value={row.weightage} className="w-24 h-10 text-base text-center bg-primary-50 border border-primary-200" />
                        <span className="text-sm font-semibold text-primary-800">%</span>
                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-red-100 hover:text-red-600 ml-auto"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-primary-800 uppercase tracking-wide">How To Assess? (Prompt to AI)</label>
                      <Input readOnly value={row.notes} className="text-base text-muted-foreground bg-transparent border border-primary-100 h-10" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add Parameter */}
            <Button variant="outline" className="w-full border-dashed h-11 sm:h-10 pointer-events-none">
              <Plus className="w-4 h-4 mr-2" /> Add Parameter
            </Button>

            {/* Total weightage */}
            <div ref={totalRef} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-gray-100 rounded-lg">
              <span className="font-medium text-sm">Total Weightage:</span>
              <span className={`font-bold text-sm ${totalPct === 100 ? 'text-green-600' : totalPct === 0 ? 'text-gray-500' : 'text-red-600'}`}>
                {totalPct}%
                {totalPct === 100 && <span className="ml-2 text-xs">✓</span>}
                {totalPct > 0 && totalPct !== 100 && <span className="ml-2 text-xs">⚠ Must be 0% or 100%</span>}
              </span>
            </div>

            {/* OR Upload Excel divider */}
            <div className="flex items-center gap-2 sm:gap-4 my-4 sm:my-6 text-xs sm:text-sm font-medium text-[#094D7B]">
              <span className="flex-1 h-px bg-[#094D7B]/30" />
              <span className="whitespace-nowrap">OR Upload Excel</span>
              <span className="flex-1 h-px bg-[#094D7B]/30" />
            </div>

            {/* Download template */}
            <div ref={downloadRef}>
              <Button variant="default" size="sm"
                className={`flex h-11 w-full items-center justify-center gap-2 bg-[#094D7B] text-sm text-white shadow-[0_4px_18px_rgba(9,77,123,0.20)] hover:bg-[#094D7B] sm:h-9 sm:w-auto pointer-events-none transition-all duration-300
                  ${step === 'download_tmpl' ? 'ring-4 ring-[#094D7B]/30 scale-[1.01]' : ''}`}>
                <Download className="w-4 h-4 sm:w-3 sm:h-3" />
                Download Excel Template
              </Button>
            </div>

            {/* Upload zone */}
            <div ref={uploadRef}
              onClick={() => criteriaFileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer min-h-[100px] flex flex-col items-center justify-center transition-all duration-500
                ${step === 'upload_excel' ? 'pulse-highlight bg-blue-50/60' : 'border-accent-200 hover:border-accent-400'}`}
            >
              <Upload className={`w-6 h-6 mx-auto mb-2 transition-colors ${step === 'upload_excel' ? 'text-[#094D7B]' : 'text-accent-500'}`} />
              {excelUploaded ? (
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <File className="w-4 h-4" />
                  {EXCEL_FILE_NAME}
                  <span className="text-xs text-green-500">✓ parsed</span>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Upload Excel/CSV criteria file</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tap to browse or drag & drop</p>
                </>
              )}
            </div>
            <input ref={criteriaFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" />

            {/* Name + Save */}
            <div ref={nameRef} className="flex flex-col sm:flex-row gap-2">
              <Input
                readOnly
                placeholder="Name your criteria (e.g., 'Software Engineer Evaluation')"
                value={gridName}
                className={`flex-1 h-11 sm:h-10 text-base border transition-all duration-300
                  ${step === 'save_excel' ? 'pulse-highlight' : ''}`}
              />
              <Button
                className={`h-11 w-full bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.20)] hover:bg-[#094D7B] sm:h-10 sm:w-auto pointer-events-none transition-all duration-300
                  ${step === 'save_excel' ? 'pulse-highlight' : ''}`}
              >
                <Save className="w-4 h-4 mr-2" /> Save Criteria
              </Button>
            </div>

            {/* Save confirmation */}
            {savedOk && (
              <div ref={savedRef} className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
                <span className="text-green-600 text-base">✓</span>
                <div>
                  <p className="text-sm font-medium text-green-800">Criteria Grid Saved</p>
                  <p className="text-xs text-green-700">Your evaluation criteria has been saved successfully.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

CriteriaRecordingDemo.displayName = 'CriteriaRecordingDemo';

export default CriteriaRecordingDemo;
