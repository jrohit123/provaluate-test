import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import JDRecordingDemo, { JDRecordingDemoHandle } from './JDRecordingDemo';
import CriteriaRecordingDemo, { CriteriaRecordingDemoHandle } from './CriteriaRecordingDemo';
import ResumeRecordingDemo, { ResumeRecordingDemoHandle } from './ResumeRecordingDemo';
import InterviewRecordingDemo, { InterviewRecordingDemoHandle } from './InterviewRecordingDemo';

const STEPS = ['jd', 'criteria', 'resume', 'interview'] as const;
type Stage = typeof STEPS[number];
type FullDemoState = 'idle' | Stage | 'complete';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export default function FullDemo() {
  const [currentStage, setCurrentStage] = useState<FullDemoState>('idle');
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Press Play to start the full demo');
  const abortRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  
  const jdDemoRef = useRef<JDRecordingDemoHandle>(null);
  const criteriaDemoRef = useRef<CriteriaRecordingDemoHandle>(null);
  const resumeDemoRef = useRef<ResumeRecordingDemoHandle>(null);
  const interviewDemoRef = useRef<InterviewRecordingDemoHandle>(null);

  const scrollToTop = useCallback(() => {
    setTimeout(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }, []);

  // Waits until a child ref is actually mounted (needed because setCurrentStage
  // causes a re-render, and the ref won't exist until after that render commits)
  const waitForRef = (ref: React.RefObject<any>) =>
    new Promise<void>(resolve => {
      const check = () => {
        if (ref.current) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });

  const hardReset = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setCurrentStage('idle');
    setStatusLabel('Press Play to start the full demo');
  }, []);

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    hardReset();
    scrollToTop();

    // JD Demo
    setCurrentStage('jd');
    setStatusLabel('Job Description Demo in progress');
    await waitForRef(jdDemoRef);
    await wait(200);
    await jdDemoRef.current!.runDemo();
    if (abortRef.current) { setRunning(false); return; }
    await wait(300);

    // Criteria Demo
    setCurrentStage('criteria');
    setStatusLabel('Criteria Creation Demo in progress');
    await waitForRef(criteriaDemoRef);
    await wait(200);
    await criteriaDemoRef.current!.runDemo();
    if (abortRef.current) { setRunning(false); return; }
    await wait(300);

    // Resume Demo
    setCurrentStage('resume');
    setStatusLabel('Resume Upload Demo in progress');
    await waitForRef(resumeDemoRef);
    await wait(200);
    await resumeDemoRef.current!.runDemo();
    if (abortRef.current) { setRunning(false); return; }
    await wait(300);

    // Interview Demo
    setCurrentStage('interview');
    setStatusLabel('Interview Review Demo in progress');
    await waitForRef(interviewDemoRef);
    await wait(200);
    await interviewDemoRef.current!.runDemo();
    if (abortRef.current) { setRunning(false); return; }

    if (!abortRef.current) {
      setCurrentStage('complete');
      setStatusLabel('Full demo complete — press Play to replay');
    }

    setRunning(false);
  }, [hardReset, scrollToTop, waitForRef]);

  const stopDemo = useCallback(() => {
    abortRef.current = true;
    window.speechSynthesis?.cancel();
    setRunning(false);
    setStatusLabel('Stopped — press Play to restart');
  }, []);

  const resetDemo = useCallback(() => {
    stopDemo();
    hardReset();
  }, [hardReset, stopDemo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !running) {
        e.preventDefault();
        runDemo();
      }
      if (e.key === 'Escape' && running) {
        e.preventDefault();
        stopDemo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running, runDemo, stopDemo]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" ref={topRef}>
      {!running && currentStage === 'idle' && (
        <div className="flex items-center justify-center flex-1">
          <Button size="lg" onClick={runDemo} className="px-6 py-6 text-base gap-2 bg-[#094D7B] text-white hover:bg-[#094D7B]/95">
            <Play className="w-5 h-5" /> Play Full Demo
          </Button>
        </div>
      )}

      {(running || currentStage !== 'idle') && (
        <div className="flex-1">
          {currentStage === 'jd' && <JDRecordingDemo ref={jdDemoRef} embedded muted={muted} />}
          {currentStage === 'criteria' && <CriteriaRecordingDemo ref={criteriaDemoRef} embedded muted={muted} />}
          {currentStage === 'resume' && <ResumeRecordingDemo ref={resumeDemoRef} embedded muted={muted} />}
          {currentStage === 'interview' && <InterviewRecordingDemo ref={interviewDemoRef} embedded muted={muted} />}
        </div>
      )}
    </div>
  );
}
