import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  User,
  Clock,
  Video,
  VideoOff,
  Mic,
  MicOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Camera,
  RotateCcw,
  Loader2,
  Volume2,
  Play,
  Pause,
  Eye,
  X,
  Send,
  Keyboard,
  RotateCw,
  Wifi,
} from 'lucide-react';
import { buildApiUrl, API_CONFIG } from '@/constants/api';
import { getAdaptiveVideoConstraints } from '@/utils/mediaConstraints';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { prefetchWelcomeTts } from '@/utils/welcomeTtsCache';

// ── Interface Preview (scripted demo — no real camera/mic) ───────────
type PreviewPhase =
  | 'ai-speaking'
  | 'countdown'
  | 'recording-manual'
  | 'recording-auto'
  | 'recording-type'
  | 'stopped'
  | 'submitting'
  | 'done'
  | 'analysing'
  | 'generating-next'
  | 'complete'
  | 'tab-warn-1'
  | 'tab-warn-2'
  | 'tab-terminated'
  | 'esc-warning-overlay'
  | 'esc-terminated'
  | 'end-confirm'
  | 'end-terminated';

type PreviewScenarioId =
  | 'normal-flow'
  | 'auto-submit'
  | 'speak-or-type'
  | 'tab-switching'
  | 'esc-exit'
  | 'end-interview';

type PreviewStep = {
  phase: PreviewPhase;
  title: string;
  caption: string;
  duration: number;
  countdown?: number;
  statusStrip?: string;
};

const PREVIEW_DEMO_QUESTION =
  'Describe a project where you had to work with a difficult team member. How did you handle it?';

const PREVIEW_DEMO_TRANSCRIPT =
  'So in my previous role, we had a critical issue with our database performance...';

const PREVIEW_DEMO_TRANSCRIPT_FULL =
  'So in my previous role, we had a critical issue with our database performance. I analyzed the slow queries, implemented indexing, and reduced response time by 60%.';

const PREVIEW_SCENARIO_ORDER: PreviewScenarioId[] = [
  'normal-flow',
  'auto-submit',
  'speak-or-type',
  'tab-switching',
  'esc-exit',
  'end-interview',
];

const PREVIEW_SCENARIOS: Record<
  PreviewScenarioId,
  { label: string; shortLabel: string; description: string; steps: PreviewStep[] }
> = {
  'normal-flow': {
    label: 'Normal flow',
    shortLabel: 'How one question works',
    description: 'Listen → record → stop → submit → next question.',
    steps: [
      {
        phase: 'ai-speaking',
        title: 'AI reads the question aloud',
        caption: 'The question appears on screen while the AI speaks. Just listen — no buttons yet.',
        duration: 2400,
        statusStrip: 'AI is reading the question…',
      },
      {
        phase: 'countdown',
        title: '3-second countdown',
        caption: 'Recording starts on its own after the countdown. You do not need to press anything.',
        duration: 1000,
        countdown: 3,
        statusStrip: 'Recording starts in 3…',
      },
      {
        phase: 'countdown',
        title: '3-second countdown',
        caption: 'Recording starts on its own after the countdown.',
        duration: 1000,
        countdown: 2,
        statusStrip: 'Recording starts in 2…',
      },
      {
        phase: 'countdown',
        title: '3-second countdown',
        caption: 'Recording starts on its own after the countdown.',
        duration: 1000,
        countdown: 1,
        statusStrip: 'Recording starts in 1…',
      },
      {
        phase: 'recording-manual',
        title: 'Recording — speak your answer',
        caption: 'Words appear in the box below as you speak. You can edit the text anytime before submitting.',
        duration: 2800,
        statusStrip: '● Recording — speak now',
      },
      {
        phase: 'stopped',
        title: 'Stop → Submit',
        caption: 'Click Stop Recording when you are done. The button turns into Submit Answer (green).',
        duration: 2400,
        statusStrip: 'Recording stopped — review & submit',
      },
      {
        phase: 'submitting',
        title: 'Submitting your answer',
        caption: 'Your answer is sent automatically. Please wait — do not refresh the page.',
        duration: 1600,
        statusStrip: 'Submitting your answer…',
      },
      {
        phase: 'analysing',
        title: 'AI analyses your answer',
        caption: 'Nothing to click. The system prepares your next question in the background.',
        duration: 2000,
        statusStrip: 'Analysing your answer…',
      },
      {
        phase: 'generating-next',
        title: 'Next question loading',
        caption: 'You hear a short transition, then the next question begins automatically.',
        duration: 2200,
        statusStrip: 'Preparing question 2 of 3…',
      },
    ],
  },
  'auto-submit': {
    label: 'Auto-submit',
    shortLabel: 'When time runs out',
    description: 'If the timer hits zero, your answer submits with whatever you have said.',
    steps: [
      {
        phase: 'recording-auto',
        title: 'Keep speaking until time runs out',
        caption: 'You can also click Stop Recording early if you finish before the timer.',
        duration: 2000,
        statusStrip: '● Recording — 0:45 left',
      },
      {
        phase: 'recording-auto',
        title: 'Timer is counting down',
        caption: 'Watch the timer below your answer. At 0 seconds, submission happens automatically.',
        duration: 3500,
        statusStrip: '● Recording — time running out',
      },
      {
        phase: 'submitting',
        title: 'Time\'s up — auto-submitting',
        caption: 'No button needed. Whatever you said so far is submitted automatically.',
        duration: 2000,
        statusStrip: 'Time\'s up — submitting…',
      },
      {
        phase: 'done',
        title: 'Answer submitted',
        caption: 'The interview moves on to analyse your answer and load the next question.',
        duration: 2000,
        statusStrip: 'Answer submitted ✓',
      },
    ],
  },
  'speak-or-type': {
    label: 'Speak or type',
    shortLabel: 'If the mic fails',
    description: 'Speak first, or type directly in the answer box if transcription does not work.',
    steps: [
      {
        phase: 'recording-manual',
        title: 'Speak — words appear live',
        caption: 'Ideally, speak clearly and your words appear in the transcription box.',
        duration: 2200,
        statusStrip: '● Recording — speak now',
      },
      {
        phase: 'recording-type',
        title: 'Or type your answer',
        caption: 'If speech is not detected, click in the box and type your answer instead.',
        duration: 3200,
        statusStrip: '● Recording — speak or type below',
      },
      {
        phase: 'stopped',
        title: 'Stop, then submit',
        caption: 'Stop recording, review your text, then click Submit Answer.',
        duration: 2200,
        statusStrip: 'Recording stopped — review & submit',
      },
      {
        phase: 'submitting',
        title: 'Submitting',
        caption: 'Both spoken and typed answers go through the same submit step.',
        duration: 1600,
        statusStrip: 'Submitting your answer…',
      },
    ],
  },
  'tab-switching': {
    label: 'Tab switching',
    shortLabel: 'Leaving this tab',
    description: 'Two warnings, then the interview ends on the third tab switch.',
    steps: [
      {
        phase: 'recording-manual',
        title: 'Stay on this tab',
        caption: 'Keep the interview window in focus. Do not switch tabs or minimize.',
        duration: 1800,
        statusStrip: '● Recording — stay on this tab',
      },
      {
        phase: 'tab-warn-1',
        title: 'First warning',
        caption: 'Switching away triggers a warning banner. Return to this tab to continue.',
        duration: 2800,
        statusStrip: '⚠ Tab switch — Warning 1 of 2',
      },
      {
        phase: 'recording-manual',
        title: 'You returned — interview continues',
        caption: 'If you stay on the tab, the warning clears. But another switch counts again.',
        duration: 1800,
        statusStrip: '● Recording — stay on this tab',
      },
      {
        phase: 'tab-warn-2',
        title: 'Second warning',
        caption: 'One more tab switch will end the interview immediately.',
        duration: 2800,
        statusStrip: '⚠ Tab switch — Warning 2 of 2',
      },
      {
        phase: 'tab-terminated',
        title: 'Interview ended',
        caption: 'After the third tab switch, the interview ends and your current answer is not submitted.',
        duration: 3200,
        statusStrip: 'Interview ended',
      },
    ],
  },
  'esc-exit': {
    label: 'ESC / fullscreen',
    shortLabel: 'Pressing ESC',
    description: 'Exiting fullscreen or pressing ESC ends the interview almost immediately.',
    steps: [
      {
        phase: 'recording-manual',
        title: 'Interview runs in fullscreen',
        caption: 'The interview opens in fullscreen automatically for focus and integrity.',
        duration: 2000,
        statusStrip: '● Recording — fullscreen required',
      },
      {
        phase: 'esc-warning-overlay',
        title: 'ESC warning overlay',
        caption: 'Pressing ESC shows a warning overlay requiring you to click to return to fullscreen.',
        duration: 3000,
        statusStrip: '⚠ Warning — return to fullscreen',
      },
      {
        phase: 'esc-terminated',
        title: 'ESC ends the interview',
        caption: 'Pressing ESC or leaving fullscreen terminates the session with little warning.',
        duration: 3200,
        statusStrip: 'Interview ended',
      },
    ],
  },
  'end-interview': {
    label: 'End interview',
    shortLabel: 'Ending voluntarily',
    description: 'The red End Interview button stops the session immediately after you confirm.',
    steps: [
      {
        phase: 'recording-manual',
        title: 'End Interview button',
        caption: 'The red button at the bottom ends your session if you need to leave early.',
        duration: 2000,
        statusStrip: '● Recording',
      },
      {
        phase: 'end-confirm',
        title: 'Confirmation dialog',
        caption: 'A popup asks "Are you sure you want to end the interview?" to prevent accidental clicks.',
        duration: 3000,
        statusStrip: 'Confirm to end interview',
      },
      {
        phase: 'end-terminated',
        title: 'Interview ended manually',
        caption: 'After you confirm, the interview ends and cannot be resumed.',
        duration: 3200,
        statusStrip: 'Interview ended',
      },
    ],
  },
};

const CandidateInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  
  // State
  const [interviewData, setInterviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // System checks: 'pending' | 'checking' | 'pass' | 'fail'
  const [browserCheck, setBrowserCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [cameraMicCheck, setCameraMicCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [internetCheck, setInternetCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [permissionsCheck, setPermissionsCheck] = useState<'pending' | 'checking' | 'pass' | 'fail'>('pending');
  const [networkSpeedMbps, setNetworkSpeedMbps] = useState<number | null>(null);
  const [networkSpeedCheck, setNetworkSpeedCheck] = useState<'pending' | 'checking' | 'pass' | 'warn' | 'fail'>('pending');

  // ── Modals ─────────────────────────────────────────────────────────
  const [showSystemCheckModal, setShowSystemCheckModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ── System Check: mic ──────────────────────────────────────────────
  const [micVolume, setMicVolume] = useState(0);
  const [micConfirmed, setMicConfirmed] = useState(false);
  const analyserRafRef = useRef<number | null>(null);
  const systemCheckVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── System Check: speaker ──────────────────────────────────────────
  const [speakerConfirmed, setSpeakerConfirmed] = useState<null | boolean>(null);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [hasPlayedSample, setHasPlayedSample] = useState(false);
  const [previewAcknowledged, setPreviewAcknowledged] = useState(false);

  // ── Instructions checklist (replaces the plain <ul> bullets) ──────
  type RuleSegment = { text: string; bold?: boolean; warn?: boolean };
  type Rule = RuleSegment[];

  const RULES: Rule[] = [
    [
      { text: 'Before starting: ', bold: true },
      { text: "Capture your photo, allow camera and microphone access, keep your face visible throughout the interview, and ensure you're in a quiet environment. If your camera is blocked for more than " },
      { text: '5 seconds', bold: true, warn: true },
      { text: ', the interview ends.' },
    ],
    [
      { text: 'Stay in the interview: ', bold: true },
      { text: 'Do not press ESC, exit fullscreen, switch tabs, minimize, use Alt+Tab, refresh, or close the tab. ' },
      { text: 'ESC', bold: true },
      { text: ' and ' },
      { text: 'tab switching', bold: true },
      { text: ' allow 2 warnings; the ' },
      { text: '3rd violation', bold: true, warn: true },
      { text: ' ends the interview automatically.' },
    ],
    [
      { text: 'Answering: ', bold: true },
      { text: 'Recording starts automatically after a ' },
      { text: '3-second countdown', bold: true },
      { text: ". Speak your answer, stop recording whenever you're ready (or let time expire), review/edit your transcript if needed, then submit. For writing based questions, speak first, then type your answer before submitting." },
    ],
    [
      { text: 'After submitting: ', bold: true },
      { text: 'The AI automatically evaluates your response and loads the next question. ' },
      { text: 'Simply wait—there is nothing else to click.', bold: true },
    ],
  ];
  const [checkedRules, setCheckedRules] = useState<boolean[]>(() => RULES.map(() => false));

  const camPass = cameraMicCheck === 'pass' && cameraReady;
  const systemCheckPassed = camPass && micConfirmed;
  const instructionsAcknowledged = checkedRules.every(Boolean);
  const firstThreeStepsComplete = systemCheckPassed && instructionsAcknowledged && previewAcknowledged;

  // ── Interface Preview state ────────────────────────────────────────
  const [activePreviewScenario, setActivePreviewScenario] = useState<PreviewScenarioId>('normal-flow');
  const [previewStepIndex, setPreviewStepIndex] = useState(0);
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>('ai-speaking');
  const [previewCountdown, setPreviewCountdown] = useState(3);
  const [previewTimer, setPreviewTimer] = useState(6);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [previewScenarioComplete, setPreviewScenarioComplete] = useState(false);
  const [previewReplayKey, setPreviewReplayKey] = useState(0);

  const activePreviewSteps = PREVIEW_SCENARIOS[activePreviewScenario].steps;
  const currentPreviewStep = activePreviewSteps[previewStepIndex] ?? activePreviewSteps[0];

  const resetPreviewPlayback = (scenario: PreviewScenarioId = 'normal-flow') => {
    const firstStep = PREVIEW_SCENARIOS[scenario].steps[0];
    setActivePreviewScenario(scenario);
    setPreviewStepIndex(0);
    setPreviewPhase(firstStep.phase);
    setPreviewCountdown(firstStep.countdown ?? 3);
    setPreviewTimer(6);
    setPreviewPaused(false);
    setPreviewScenarioComplete(false);
    setPreviewReplayKey((k) => k + 1);
  };

  const replayPreviewScenario = () => {
    const firstStep = PREVIEW_SCENARIOS[activePreviewScenario].steps[0];
    setPreviewStepIndex(0);
    setPreviewPhase(firstStep.phase);
    setPreviewCountdown(firstStep.countdown ?? 3);
    setPreviewTimer(6);
    setPreviewPaused(false);
    setPreviewScenarioComplete(false);
    setPreviewReplayKey((k) => k + 1);
  };

  /**
   * Measures approximate download speed using a public dynamic download endpoint.
   */
  const measureNetworkSpeed = async (): Promise<number | null> => {
    const BYTES_PER_RUN = 5_000_000;
    const TEST_URL = `https://speed.cloudflare.com/__down?bytes=${BYTES_PER_RUN}`;
    const RUNS = 3;

    const measureOnce = async (): Promise<number | null> => {
      try {
        const bustUrl = TEST_URL + `&cachebust=${Date.now()}${Math.random()}`;
        const start = performance.now();
        const res = await fetch(bustUrl, { cache: 'no-store' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const durationSec = (performance.now() - start) / 1000;

        if (durationSec <= 0) return null;
        return (blob.size * 8) / durationSec / 1_000_000;
      } catch {
        return null;
      }
    };

    const results: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const speed = await measureOnce();
      if (speed !== null && i > 0) results.push(speed);
    }

    if (results.length === 0) return null;

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    return Math.round(avg * 10) / 10;
  };

  // Run system checks step by step when interview data is ready
  useEffect(() => {
    if (!interviewData) return;

    let cancelled = false;

    let cameraMicOk = false;

    const runChecks = async () => {
      // Step 1: Modern web browser
      setBrowserCheck('checking');
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const hasGetUserMedia = !!(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      );
      setBrowserCheck(hasGetUserMedia ? 'pass' : 'fail');
      if (!hasGetUserMedia) return;
      await new Promise((r) => setTimeout(r, 350));

      // Step 2: Camera & microphone permissions (and working devices)
      setPermissionsCheck('checking');
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;
      try {
        const constraints = getAdaptiveVideoConstraints({
          preferMobile: isMobile,
          preferFrontCamera: isMobile,
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: constraints,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.getTracks().forEach((t) => t.stop());
        cameraMicOk = true;
        setPermissionsCheck('pass');
      } catch {
        setPermissionsCheck('fail');
      }
      await new Promise((r) => setTimeout(r, 350));

      // Step 3: Working camera and microphone (verified by getUserMedia in step 2)
      setCameraMicCheck('checking');
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      setCameraMicCheck(cameraMicOk ? 'pass' : 'fail');
      await new Promise((r) => setTimeout(r, 350));

      // Step 4: Stable internet connection
      setInternetCheck('checking');
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;
      try {
        if (!navigator.onLine) {
          setInternetCheck('fail');
          return;
        }
        const apiUrl = buildApiUrl(API_CONFIG.ENDPOINTS.GET_INTERVIEW);
        const res = await fetch(`${apiUrl}/${interviewId}`, { method: 'HEAD', cache: 'no-store' });
        setInternetCheck(res.ok ? 'pass' : 'fail');
      } catch {
        setInternetCheck('fail');
      }
      await new Promise((r) => setTimeout(r, 350));

      // Step 5: Network speed (advisory)
      setNetworkSpeedCheck('checking');
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      const mbps = await measureNetworkSpeed();
      setNetworkSpeedMbps(mbps);
      if (mbps === null) {
        setNetworkSpeedCheck('fail');   // couldn't measure
      } else if (mbps >= 2) {
        setNetworkSpeedCheck('pass');   // ≥ 2 Mbps — fine for video + upload
      } else if (mbps >= 0.8) {
        setNetworkSpeedCheck('warn');   // 0.8–2 Mbps — marginal but usable
      } else {
        setNetworkSpeedCheck('fail');   // < 0.8 Mbps — likely to cause issues
      }
    };

    runChecks();
    return () => {
      cancelled = true;
    };
  }, [interviewData, interviewId, isMobile]);

  // Load interview data
  useEffect(() => {
    const loadInterviewData = async () => {
      try {
        console.log('🔍 CandidateInterview - Loading interview data for ID:', interviewId);
        const interviewUrl = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_INTERVIEW}/${interviewId}`);
        console.log('🔍 CandidateInterview - Full URL:', interviewUrl);
        setIsLoading(true);
        const response = await fetch(interviewUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Interview data received:', data);
          
          // Handle both possible API response formats
          let interviewData, questions, answers;
          
          if (data.status === 'success') {
            // First endpoint format: {status: 'success', interview: {...}, questions: [...], answers: [...]}
            interviewData = data.interview;
            questions = data.questions || [];
            answers = data.answers || [];
          } else {
            // Second endpoint format: {interview: {...}, questions: [...], answers: [...]}
            interviewData = data.interview;
            questions = data.questions || [];
            answers = data.answers || [];
          }
          
          // Flatten the data for frontend components
          const flattenedData = {
            ...interviewData,
            questions: questions,
            answers: answers
          };
          
          console.log('🔍 Flattened interview data keys:', Object.keys(flattenedData));
          console.log('🔍 Interview type in flattened data:', flattenedData.interview_type);
          
          // If interview already completed, terminated, or has completion markers, redirect to completion page
          const status = (flattenedData as any).status;
          const assessmentStatus = (flattenedData as any).assessment_status;
          const completedAt = (flattenedData as any).completed_at;
          console.log('🏁 Completion check → status:', status, 'assessment_status:', assessmentStatus, 'completed_at:', completedAt);
          if (
            status === 'completed' ||
            status === 'terminated' ||
            assessmentStatus === 'completed' ||
            !!completedAt
          ) {
            console.log('➡️ Redirecting to completion page...');
            navigate(`/candidate-completion/${flattenedData.id}` , {
              state: {
                interviewId: flattenedData.id,
                candidateName: flattenedData.candidate_name,
                position: flattenedData.position
              }
            });
            return;
          }

          setInterviewData(flattenedData);
          setIsLoading(false);
          // Prefetch welcome phrase + TTS audio now, while candidate does photo capture / system checks
          if (flattenedData?.id && flattenedData?.candidate_name && flattenedData?.position) {
            prefetchWelcomeTts(flattenedData.id, flattenedData.candidate_name, flattenedData.position);
          }
          // If logged-in candidate, link this interview to their account for "My Interviews"
          if (interviewId && isCandidate(user) && user.candidate?.candidate_id) {
            supabase
              .from('interviews')
              .update({ candidate_id: user.candidate.candidate_id })
              .eq('id', interviewId)
              .is('candidate_id', null)
              .then(() => {});
          }
        } else if (response.status === 404) {
          console.error('❌ Interview not found (404)');
          setError('Interview not found. Please check your link.');
          setIsLoading(false);
        } else {
          console.error('❌ API Error:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Error details:', errorData);
          setError(errorData.message || 'Failed to load interview. Please try again.');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading interview:', error);
        setError('Failed to load interview. Please check your internet connection and try again.');
        setIsLoading(false);
      }
    };

    if (interviewId) {
      loadInterviewData();
    } else {
      setError('Invalid interview link. Please check your URL.');
      setIsLoading(false);
    }
  }, [interviewId]);

  // Initialize camera for photo capture (adaptive constraints for mobile)
  const initializeCamera = async () => {
    try {
      const videoConstraints = getAdaptiveVideoConstraints({
        preferMobile: isMobile,
        preferFrontCamera: isMobile,
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      });
      
      // Store stream but DON'T attach yet - video element doesn't exist yet
      streamRef.current = stream;
      setCameraReady(true); // This will trigger React to render the video element
      return true;
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraReady(false);
      return false;
    }
  };

  // Attach stream once video element is rendered (and re-attach after Retake when new stream is ready)
  useEffect(() => {
    if (!cameraReady || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    video.srcObject = stream;
    video.play().catch(err => {
      console.error('Video play error:', err);
    });
  }, [cameraReady, photoCaptured, firstThreeStepsComplete]);

  // Capture photo from video stream
  const capturePhoto = async (): Promise<string | null> => {
    try {
      if (!videoRef.current) return null;
      
      const video = videoRef.current;
      
      // Wait for video to be ready
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        await new Promise<void>((resolve) => {
          const checkReady = () => {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              resolve();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      return photoDataUrl;
    } catch (error) {
      console.error('Error capturing photo:', error);
      return null;
    }
  };

  // Handle photo capture
  const handleCapturePhoto = React.useCallback(async () => {
    setIsCapturingPhoto(true);
    const photo = await capturePhoto();
    
    if (photo && interviewData?.id) {
      setCapturedPhoto(photo);
      setPhotoCaptured(true);
      
      const storageKey = `candidate_photo_${interviewData.id}`;
      const timestamp = Date.now();
      
      // ✅ PRIMARY: Upload photo to server for cross-browser access
      try {
        // Convert data URL to blob for upload
        const response = await fetch(photo);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('photo', blob, `candidate_photo_${interviewData.id}.jpg`);
        formData.append('interview_id', interviewData.id.toString());
        
        const uploadUrl = buildApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_CANDIDATE_PHOTO);
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          console.log('✅ Photo uploaded to server successfully');
        } else {
          console.warn('⚠️ Failed to upload photo to server, using local storage only');
        }
      } catch (uploadError) {
        console.error('❌ Error uploading photo to server:', uploadError);
        // Continue with local storage as fallback
      }
      
      // ✅ FALLBACK: Store photo in localStorage and sessionStorage (for offline/backup)
      try {
        localStorage.setItem(storageKey, photo);
        localStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
        sessionStorage.setItem(storageKey, photo);
        sessionStorage.setItem(`${storageKey}_timestamp`, timestamp.toString());
        console.log('✅ Photo stored in local storage:', storageKey);
      } catch (error) {
        console.error('Error storing photo in local storage:', error);
      }
    }
    
    setIsCapturingPhoto(false);
  }, [interviewData?.id]);

  // Handle retake photo: stop current stream, reset state, so init effect requests a new stream and attach effect re-attaches it
  const handleRetakePhoto = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setPhotoCaptured(false);
    setCapturedPhoto(null);
  };

  const playSample = () => {
    setIsPlayingSample(true);

    const utterance = new SpeechSynthesisUtterance('This is a test of your speakers. Can you hear this?');
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsPlayingSample(false);
      setHasPlayedSample(true);
    };

    speechSynthesis.speak(utterance);
  };

  const toggleRule = (index: number) => {
    setCheckedRules((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  // Initialize camera when interview data loads (and re-initialize when Retake is clicked)
  useEffect(() => {
    if (interviewData && !photoCaptured && !streamRef.current) {
      initializeCamera();
    }
  }, [interviewData, photoCaptured]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Attach the shared stream to the System Check modal's own <video> when it opens
  useEffect(() => {
    if (!showSystemCheckModal) return;
    if (!streamRef.current) {
      initializeCamera();
      return;
    }
    if (!systemCheckVideoRef.current) return;
    systemCheckVideoRef.current.srcObject = streamRef.current;
    systemCheckVideoRef.current.play().catch(() => {});
  }, [showSystemCheckModal]);

  // Live mic volume + auto-confirm, only while the modal is open
  useEffect(() => {
    if (!showSystemCheckModal || !streamRef.current) return;
    const stream = streamRef.current;
    if (stream.getAudioTracks().length === 0) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      const scaled = Math.min(100, Math.round((avg / 255) * 200));
      setMicVolume(scaled);
      if (scaled > 8) setMicConfirmed(true);
      analyserRafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (analyserRafRef.current) cancelAnimationFrame(analyserRafRef.current);
      source.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [showSystemCheckModal]);

  // Auto-play active preview scenario step-by-step (pausable, replayable)
  useEffect(() => {
    if (!showPreviewModal || previewPaused || previewScenarioComplete) return;

    const steps = PREVIEW_SCENARIOS[activePreviewScenario].steps;
    const step = steps[previewStepIndex];
    if (!step) return;

    setPreviewPhase(step.phase);
    if (step.countdown != null) setPreviewCountdown(step.countdown);

    let tickInterval: ReturnType<typeof setInterval> | null = null;
    if (step.phase === 'recording-auto') {
      let t = previewStepIndex === 0 ? 6 : 3;
      setPreviewTimer(t);
      tickInterval = setInterval(() => {
        t -= 1;
        setPreviewTimer(Math.max(t, 0));
        if (t <= 0 && tickInterval) {
          clearInterval(tickInterval);
          tickInterval = null;
        }
      }, 700);
    }

    const timeoutId = setTimeout(() => {
      const nextIndex = previewStepIndex + 1;
      if (nextIndex >= steps.length) {
        setPreviewScenarioComplete(true);
      } else {
        setPreviewStepIndex(nextIndex);
      }
    }, step.duration);

    return () => {
      clearTimeout(timeoutId);
      if (tickInterval) clearInterval(tickInterval);
    };
  }, [
    showPreviewModal,
    activePreviewScenario,
    previewStepIndex,
    previewPaused,
    previewScenarioComplete,
    previewReplayKey,
  ]);

  // Reset preview when modal opens
  useEffect(() => {
    if (showPreviewModal) {
      resetPreviewPlayback('normal-flow');
    }
  }, [showPreviewModal]);

  // Helper: network speed label
  const networkSpeedLabel =
    networkSpeedMbps === null
      ? 'Could not measure'
      : networkSpeedMbps >= 2
        ? `${networkSpeedMbps} Mbps — Good`
        : networkSpeedMbps >= 0.8
          ? `${networkSpeedMbps} Mbps — Marginal (2 Mbps recommended)`
          : `${networkSpeedMbps} Mbps — Too slow (may affect video quality)`;

  const networkSpeedColor =
    networkSpeedCheck === 'pass'
      ? 'text-green-600'
      : networkSpeedCheck === 'warn'
        ? 'text-amber-600'
        : 'text-red-600';

  // Manual capture only - no auto-capture

  const startInterview = async () => {
    if (!interviewData) return;
    
    try {
      // Call API to mark interview as started
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.START_INTERVIEW}/${interviewData.id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        console.log('✅ Interview marked as started');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('⚠️ Could not mark interview as started:', errorData.message || 'Unknown error');
      }
    } catch (error) {
      console.warn('⚠️ Error marking interview as started:', error);
    }
    
    // Navigate to the actual interview with the loaded data
    navigate('/conversational-interview', {
      state: {
        interviewId: interviewData.id,
        candidateName: interviewData.candidate_name,
        position: interviewData.position,
        duration: interviewData.duration_minutes,
        currentQuestion: interviewData.questions?.[0],
        functionalWeight: interviewData.functional_weight ?? interviewData.technical_weight,
        softSkillsWeight: interviewData.soft_skills_weight,
        customInstructions: interviewData.custom_instructions,
        interviewType: interviewData.interview_type
      }
    });
  };

  const canStartInterview = firstThreeStepsComplete && photoCaptured;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4" />
          <p className="text-base sm:text-lg text-gray-600">Loading your interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-3 sm:px-6 py-6">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4 flex-shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 break-words">Interview Not Found</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6 break-words">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="min-h-[44px] px-6 py-3 rounded-lg bg-sky-600 text-white text-sm sm:text-base font-medium hover:bg-sky-700 transition-colors touch-manipulation"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Safety net: if interview is already completed/terminated, redirect here as well
  if (interviewData) {
    const status = (interviewData as any).status;
    const assessmentStatus = (interviewData as any).assessment_status;
    const completedAt = (interviewData as any).completed_at;
    if (status === 'completed' || status === 'terminated' || assessmentStatus === 'completed' || !!completedAt) {
      console.log('🏁 (Render guard) Redirecting to completion page...');
      return (
        <Navigate
          to={`/candidate-completion/${(interviewData as any).id}`}
          replace
          state={{
            interviewId: (interviewData as any).id,
            candidateName: (interviewData as any).candidate_name,
            position: (interviewData as any).position
          }}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden lg:overflow-hidden">
      {/* Header: light blue, same as Terms / Privacy Policy; logo size matches Login */}
      <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-3 sm:py-4 lg:py-5">
          <img
            src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`}
            alt="ProValuate"
            className="h-12 sm:h-16 lg:h-20 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main: on desktop no page scroll; inner area scrolls. On mobile page scrolls. */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden lg:overflow-hidden">
        <div className="flex-1 min-h-0 w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-4 lg:py-6 pb-8 sm:pb-6 lg:pb-6 lg:overflow-y-auto overflow-visible">
        {/* Welcome block */}
        <section className="mb-6 sm:mb-8 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 break-words">
            Welcome, {interviewData.candidate_name}!{interviewData.interview_source === 'campus' ? ' (This is campus practice)' : ''}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-gray-600 text-sm sm:text-base break-words">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-500" />
              {interviewData.position}
            </span>
            <span className="text-gray-300" aria-hidden>|</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-500" />
              {Math.round(Number(interviewData.duration_minutes) || 30)} minutes
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-black mt-8 sm:mt-10 lg:mt-12">
            Complete these in order: Instructions → System Check → Interface Demo → Photo Capture
          </p>
        </section>

        {/* Two-column layout: stack on mobile, side-by-side on lg */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12">
          {/* Left column */}
          <div className="flex-1 lg:max-w-[50%] order-1 min-w-0 lg:flex lg:flex-col">
            {/* Ghost spacer — invisible clone of right column header, aligns Instructions title with camera feed on desktop */}
            <div className="hidden lg:block invisible pointer-events-none select-none" aria-hidden="true">
              <h2 className="text-lg sm:text-xl font-semibold mb-2 flex items-center justify-center gap-2">
                <span className="w-5 h-5 flex-shrink-0" />
                Capture Your Photo
              </h2>
              <p className="text-sm sm:text-base text-center mb-4">Position yourself in the frame. Required before starting.</p>
            </div>

            {/* Instructions */}
            <section className="mb-4 sm:mb-6">
              <h3 className="font-semibold text-gray-900 mb-6 text-lg sm:text-xl">
                1) Instructions
              </h3>
              <div className="space-y-4">
                {RULES.map((rule, i) => (
                  <label key={i} className="flex items-start gap-2.5 text-base text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkedRules[i]}
                      onChange={() => toggleRule(i)}
                      className="w-4 h-4 mt-0.5 accent-sky-600 flex-shrink-0"
                    />
                    <span className="break-words">
                      {rule.map((seg, j) =>
                        seg.warn ? (
                          <strong key={j} className="font-bold text-red-600">
                            {seg.text}
                          </strong>
                        ) : seg.bold ? (
                          <strong key={j} className="font-semibold text-gray-900">
                            {seg.text}
                          </strong>
                        ) : (
                          <span key={j}>{seg.text}</span>
                        )
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* System Check + Interface Preview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:mt-auto">
              {/* System Check — required */}
              <button
                type="button"
                onClick={() => setShowSystemCheckModal(true)}
                className={`text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${systemCheckPassed ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
              >
                {systemCheckPassed ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Video className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    2) System Check
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {systemCheckPassed ? 'Camera, mic & speaker confirmed' : 'Test your camera, mic & speaker'}
                  </p>
                </div>
              </button>

              {/* Interface Preview — required, gates Start */}
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className={`text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${previewAcknowledged ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
              >
                {previewAcknowledged ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    3) Interface Demo
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {previewAcknowledged ? 'Interface demo viewed' : 'Preview the interview screen'}
                  </p>
                </div>
              </button>
            </div>
          </div>

            {/* Right: Photo Capture */}
            <div className="flex-1 lg:max-w-[50%] order-2 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 flex items-center justify-center gap-2">
                <span className="mr-1">4)</span>
                <Camera className="w-5 h-5 text-sky-600 flex-shrink-0" />
                <span className="break-words">Photo Capture</span>
              </h2>
              <p className="text-gray-600 text-sm sm:text-base text-center mb-4 break-words">
                {!firstThreeStepsComplete
                  ? 'Complete Instructions, System Check & Interface Demo first.'
                  : !photoCaptured
                    ? 'Position yourself in the frame. Required before starting.'
                    : 'Review your photo. You can retake if needed.'}
              </p>

              {!firstThreeStepsComplete ? (
                <>
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden mb-3 sm:mb-4 aspect-video max-h-[40vh] sm:max-h-[50vh] min-h-[180px] sm:min-h-[200px] border border-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <div className="text-center text-gray-900 font-bold">
                        <Camera className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm px-4">Finish Instructions, System Check & Interface Demo first</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full min-h-[44px] sm:min-h-[48px] bg-gray-300 text-gray-500 py-3 rounded-xl cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-semibold"
                  >
                    <Camera className="w-5 h-5" />
                    Capture Photo (locked)
                  </button>
                </>
              ) : !photoCaptured ? (
                <>
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden mb-3 sm:mb-4 aspect-video max-h-[40vh] sm:max-h-[50vh] min-h-[180px] sm:min-h-[200px] border border-gray-200">
                    {!cameraReady ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                        <div className="text-center text-gray-500">
                          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Initializing camera...</p>
                        </div>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Capture Button - touch-friendly min height */}
                  <button
                    onClick={handleCapturePhoto}
                    disabled={isCapturingPhoto || !cameraReady}
                    className="w-full min-h-[44px] sm:min-h-[48px] bg-sky-600 text-white py-3 rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-semibold touch-manipulation"
                  >
                    <Camera className="w-5 h-5" />
                    {isCapturingPhoto ? 'Capturing...' : 'Capture Photo'}
                  </button>
                </>
              ) : (
                <>
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden mb-3 sm:mb-4 aspect-video max-h-[40vh] sm:max-h-[50vh] min-h-[180px] sm:min-h-[200px] border border-gray-200">
                    {capturedPhoto && (
                      <img 
                        src={capturedPhoto} 
                        alt="Captured photo" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Retake Button - touch-friendly min height */}
                  <button
                    onClick={handleRetakePhoto}
                    className="w-full min-h-[44px] sm:min-h-[48px] bg-gray-200 text-gray-800 py-3 rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base font-semibold touch-manipulation"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Retake Photo
                  </button>
                </>
              )}
            </div>
        </div>

        {/* Primary CTA */}
        <section className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
          <button
            onClick={startInterview}
            disabled={!canStartInterview}
            className={`w-full min-h-[48px] py-3 rounded-lg text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 touch-manipulation ${
              canStartInterview
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            Start Interview
          </button>
        </section>
        </div>
      </main>

      {/* System Check Modal */}
      {showSystemCheckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-8 sm:p-10 relative">
            <button
              onClick={() => setShowSystemCheckModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-1">System Check</h3>
            <p className="text-sm text-gray-500 mb-4">
              Confirm your camera, microphone, and speakers before you continue.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Camera */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-medium text-gray-800">Camera</span>
                  {camPass && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                </div>
                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <video ref={systemCheckVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Mic */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-medium text-gray-800">Microphone</span>
                  {micConfirmed && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                </div>
                <p className="text-xs text-gray-500 mb-2">Say something out loud.</p>
                <div className="flex items-end gap-1 h-10 mb-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-colors ${
                        micVolume >= (i + 1) * 10 ? 'bg-sky-500' : 'bg-gray-200'
                      }`}
                      style={{ height: `${20 + i * 6}%` }}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${micConfirmed ? 'text-green-600' : 'text-gray-500'}`}>
                  {micConfirmed ? '✓ Voice detected' : 'Listening…'}
                </p>
              </div>

              {/* Speaker */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-medium text-gray-800">Speaker</span>
                  {speakerConfirmed === true && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                </div>
                <button
                  onClick={playSample}
                  disabled={isPlayingSample}
                  className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white text-sm py-2 rounded-lg hover:bg-sky-700 disabled:opacity-50 mb-2"
                >
                  <Play className="w-4 h-4" />
                  {isPlayingSample ? 'Playing…' : 'Play Sample'}
                </button>
                {!hasPlayedSample && (
                  <p className="text-xs font-medium text-gray-500">
                    Click Play Sample to test your speakers.
                  </p>
                )}

                {hasPlayedSample && speakerConfirmed !== true && (
                  <div className="mt-1">
                    <p className="text-xs font-medium text-gray-700 mb-1.5">Did you hear the sample?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSpeakerConfirmed(true)}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeakerConfirmed(false)}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                      >
                        No
                      </button>
                    </div>
                    {speakerConfirmed === false && (
                      <p className="text-xs text-amber-600 mt-1.5">
                        Check your volume, unmute your device, or switch output (e.g. headphones/speakers), then click Play Sample again.
                      </p>
                    )}
                  </div>
                )}

                {speakerConfirmed === true && (
                  <p className="text-xs font-medium text-green-600">✓ Sample confirmed heard</p>
                )}
              </div>

              {/* Network speed — advisory */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-medium text-gray-800">Network Speed</span>
                  {networkSpeedCheck === 'pass' && (
                    <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                  )}
                  {networkSpeedCheck === 'warn' && (
                    <AlertTriangle className="w-4 h-4 text-amber-500 ml-auto" />
                  )}
                </div>

                {networkSpeedCheck === 'pending' && (
                  <p className="text-xs text-gray-400">Will run automatically…</p>
                )}
                {networkSpeedCheck === 'checking' && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                    <span className="text-xs text-gray-500">Measuring…</span>
                  </div>
                )}
                {(networkSpeedCheck === 'pass' ||
                  networkSpeedCheck === 'warn' ||
                  networkSpeedCheck === 'fail') && (
                  <>
                    <p className={`text-sm font-semibold ${networkSpeedColor}`}>
                      {networkSpeedLabel}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {networkSpeedCheck === 'pass'
                        ? 'You have enough bandwidth for video upload.'
                        : networkSpeedCheck === 'warn'
                          ? 'Interview will work but video upload may be slow. Try a stronger connection if possible.'
                          : 'Poor connection detected. Consider switching to a faster network or moving closer to your router. The interview can still proceed.'}
                    </p>
                  </>
                )}

                {/* Recommendation line */}
                <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">
                  Recommended: ≥ 2 Mbps for smooth video
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSpeakerConfirmed(true);
                setShowSystemCheckModal(false);
              }}
              className="w-full mt-5 min-h-[44px] py-2.5 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Interface Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-[88rem] max-h-[95vh] overflow-y-auto p-4 sm:p-6 relative">
            <button
              type="button"
              onClick={() => {
                setPreviewAcknowledged(true);
                setShowPreviewModal(false);
              }}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs sm:text-sm font-semibold hover:bg-sky-700 z-10"
              aria-label="I understand — close preview"
            >
              <CheckCircle className="w-4 h-4" />
              I Understand
            </button>

            <div className="mb-4 pr-32 sm:pr-40">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">How the interview works <span className="text-sm font-normal text-gray-500">(click tabs to see scenarios)</span></h3>
            </div>

            {/* Scenario tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PREVIEW_SCENARIO_ORDER.map((id) => {
                const scenario = PREVIEW_SCENARIOS[id];
                const isActive = activePreviewScenario === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => resetPreviewPlayback(id)}
                    className={`text-xs sm:text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {scenario.label}
                  </button>
                );
              })}
            </div>

            {/* Step explanation header */}
            <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">
                  {PREVIEW_SCENARIOS[activePreviewScenario].shortLabel}
                  {!previewScenarioComplete && (
                    <span className="text-sky-500 font-normal normal-case ml-2">
                      · Step {previewStepIndex + 1} of {activePreviewSteps.length}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPaused((p) => !p)}
                    className="flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900 px-2 py-1 rounded-md hover:bg-sky-100"
                  >
                    {previewPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {previewPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={replayPreviewScenario}
                    className="flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900 px-2 py-1 rounded-md hover:bg-sky-100"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Replay
                  </button>
                </div>
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                {previewScenarioComplete
                  ? 'Scenario complete'
                  : currentPreviewStep.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {previewScenarioComplete
                  ? 'Got it? Close this preview and start your interview when you are ready — or pick another tab above.'
                  : currentPreviewStep.caption}
              </p>
              {!previewScenarioComplete && activePreviewSteps.length > 1 && (
                <div className="flex gap-1 mt-3">
                  {activePreviewSteps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < previewStepIndex
                          ? 'bg-sky-400'
                          : i === previewStepIndex
                            ? 'bg-sky-600'
                            : 'bg-sky-200'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Mock interview UI */}
            <div className="bg-gray-100 rounded-xl overflow-hidden border-2 border-black">
              {/* Header */}
              <div className="bg-sky-700 px-4 py-3 flex items-center justify-between">
                <div className="text-white font-semibold">ProValuate</div>
                <div className="flex items-center gap-4 text-white">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{interviewData?.candidate_name ?? 'You'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">25:30</span>
                  </div>
                </div>
              </div>

              {/* Status strip */}
              <div className="bg-sky-800/90 px-4 py-2 text-center">
                <span className="text-xs sm:text-sm text-white font-medium">
                  {previewScenarioComplete
                    ? 'Demo finished — explore other tabs or close to continue'
                    : currentPreviewStep.statusStrip ?? 'Interview in progress'}
                </span>
              </div>

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 p-2">
                {/* Question panel */}
                <div className="lg:col-span-2 bg-sky-100 rounded-xl p-4 h-[220px] sm:h-[240px] overflow-y-auto">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Question 1 of 3</div>

                  {previewPhase === 'ai-speaking' && (
                    <>
                      <div className="flex items-center gap-2 mb-2 text-sky-700">
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        <span className="text-xs font-medium">AI is speaking…</span>
                      </div>
                      <p className="text-gray-800 text-sm leading-relaxed">&ldquo;{PREVIEW_DEMO_QUESTION}&rdquo;</p>
                    </>
                  )}

                  {previewPhase === 'countdown' && (
                    <>
                      <p className="text-gray-600 text-sm mb-2">Recording starts in {previewCountdown} second{previewCountdown !== 1 ? 's' : ''}…</p>
                      <p className="text-gray-800 text-sm leading-relaxed">&ldquo;{PREVIEW_DEMO_QUESTION}&rdquo;</p>
                    </>
                  )}

                  {(previewPhase === 'recording-manual' ||
                    previewPhase === 'recording-auto' ||
                    previewPhase === 'recording-type' ||
                    previewPhase === 'stopped' ||
                    previewPhase === 'submitting' ||
                    previewPhase === 'done' ||
                    previewPhase.startsWith('tab-warn') ||
                    previewPhase.includes('terminated')) && (
                    <p className="text-gray-800 text-sm leading-relaxed">&ldquo;{PREVIEW_DEMO_QUESTION}&rdquo;</p>
                  )}

                  {previewPhase === 'analysing' && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
                      <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-2" />
                      <p className="text-gray-700 text-sm font-medium">Analysing your answer…</p>
                      <p className="text-gray-500 text-xs mt-1">Please wait — nothing to click</p>
                    </div>
                  )}

                  {previewPhase === 'generating-next' && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
                      <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-2" />
                      <p className="text-gray-700 text-sm font-medium">Preparing question 2 of 3…</p>
                      <p className="text-gray-500 text-xs mt-1">AI transition plays, then the next question starts</p>
                    </div>
                  )}
                </div>

                {/* Camera panel */}
                <div className="lg:col-span-3 w-full bg-gray-900 rounded-xl relative overflow-hidden flex items-center justify-center h-[220px] sm:h-[240px]">
                  {(previewPhase === 'ai-speaking' || previewPhase === 'countdown') && (
                    <p className="text-white/60 text-sm">Your camera feed here</p>
                  )}

                  {previewPhase === 'countdown' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                      <div className="flex flex-col items-center">
                        <span className="text-white text-7xl font-bold">{previewCountdown}</span>
                        <p className="text-white/60 text-sm mt-2">Recording starts in…</p>
                      </div>
                    </div>
                  )}

                  {(previewPhase === 'recording-manual' ||
                    previewPhase === 'recording-auto' ||
                    previewPhase === 'recording-type') && (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full z-10">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-white text-xs font-semibold">REC</span>
                      </div>
                      <p className="text-white/60 text-sm">Your camera feed here</p>
                    </>
                  )}

                  {previewPhase === 'stopped' && (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 bg-gray-400 rounded-full" />
                        <span className="text-white text-xs font-semibold">Stopped</span>
                      </div>
                      <p className="text-white/60 text-sm">Recording stopped — ready to submit</p>
                    </>
                  )}

                  {previewPhase === 'submitting' && (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-green-600 px-3 py-1 rounded-full">
                        <Send className="w-3 h-3 text-white" />
                        <span className="text-white text-xs font-semibold">Submitting…</span>
                      </div>
                      <p className="text-white/60 text-sm">Sending your answer</p>
                    </>
                  )}

                  {previewPhase === 'done' && (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-green-600 px-3 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3 text-white" />
                        <span className="text-white text-xs font-semibold">Submitted</span>
                      </div>
                      <p className="text-white/60 text-sm">Your camera feed here</p>
                    </>
                  )}

                  {(previewPhase === 'analysing' || previewPhase === 'generating-next') && (
                    <p className="text-white/60 text-sm">Your camera feed here</p>
                  )}

                  {previewPhase === 'tab-warn-1' || previewPhase === 'tab-warn-2' ? (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full z-10">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-white text-xs font-semibold">REC</span>
                      </div>
                      <div className="absolute inset-x-0 top-0 bg-amber-500 text-white text-xs font-semibold text-center py-2 flex items-center justify-center gap-2 z-20">
                        <AlertTriangle className="w-4 h-4" />
                        Tab switch — Warning {previewPhase === 'tab-warn-1' ? '1' : '2'} of 2
                      </div>
                      <p className="text-white/60 text-sm mt-8">Your camera feed here</p>
                    </>
                  ) : null}

                  {previewPhase === 'tab-terminated' && (
                    <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center gap-2 z-30">
                      <XCircle className="w-8 h-8 text-white" />
                      <span className="text-white text-sm font-semibold">Interview Ended</span>
                      <span className="text-red-100 text-xs px-4 text-center">Third tab switch — interview ended automatically</span>
                    </div>
                  )}

                  {previewPhase === 'esc-warning-overlay' && (
                    <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-3 z-30 p-4">
                      <AlertTriangle className="w-12 h-12 text-amber-400" />
                      <h2 className="text-white text-xl font-bold text-center px-4">
                        Warning 1 of 2 — Fullscreen Required
                      </h2>
                      <p className="text-gray-400 text-sm text-center px-8">
                        Exiting fullscreen is not allowed during the interview.
                      </p>
                      <div className="bg-amber-400 text-black font-bold py-3 px-8 rounded-xl text-sm animate-pulse">
                        Click anywhere to return to fullscreen
                      </div>
                    </div>
                  )}

                  {previewPhase === 'esc-terminated' && (
                    <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center gap-2 z-30">
                      <XCircle className="w-8 h-8 text-white" />
                      <span className="text-white text-sm font-semibold">Interview Ended</span>
                      <span className="text-red-100 text-xs px-4 text-center">Exited fullscreen (ESC pressed)</span>
                    </div>
                  )}

                  {previewPhase === 'end-confirm' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-30 p-4">
                      <div className="bg-white rounded-xl p-4 max-w-xs w-full shadow-2xl">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                          <span className="text-sm font-semibold text-gray-900">End Interview?</span>
                        </div>
                        <p className="text-xs text-gray-600 mb-4">Are you sure you want to end the interview? This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200">
                            Cancel
                          </button>
                          <button className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
                            Yes, End It
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewPhase === 'end-terminated' && (
                    <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center gap-2 z-30">
                      <XCircle className="w-8 h-8 text-white" />
                      <span className="text-white text-sm font-semibold">Interview Ended</span>
                      <span className="text-red-100 text-xs px-4 text-center">Ended manually via End Interview</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transcription box */}
              <div className="px-2 pb-2">
                <div className="bg-white rounded-xl p-4 min-h-[100px] border border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-1">
                    Your Answer — speak and words appear here, or type if the mic does not work
                  </div>

                  {(previewPhase === 'ai-speaking' || previewPhase === 'countdown') && (
                    <p className="text-gray-400 text-sm">Waiting for recording to start…</p>
                  )}

                  {previewPhase === 'recording-manual' && (
                    <div className="flex items-start gap-2">
                      <Mic className="w-4 h-4 text-sky-600 animate-pulse flex-shrink-0 mt-0.5" />
                      <p className="text-gray-600 text-sm leading-relaxed">&ldquo;{PREVIEW_DEMO_TRANSCRIPT}&rdquo;</p>
                    </div>
                  )}

                  {previewPhase === 'recording-auto' && (
                    <div>
                      <p className="text-gray-600 text-sm leading-relaxed">&ldquo;{PREVIEW_DEMO_TRANSCRIPT}&rdquo;</p>
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${
                              previewTimer <= 2 
                                ? 'text-red-400' 
                                : previewTimer <= 4 
                                  ? 'text-yellow-400' 
                                  : 'text-sky-400'
                            }`} />
                            <span className={`text-xs font-medium ${
                              previewTimer <= 2 
                                ? 'text-red-400' 
                                : previewTimer <= 4 
                                  ? 'text-yellow-400' 
                                  : 'text-sky-600'
                            }`}>
                              Time: {previewTimer}s
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {Math.round((previewTimer / 6) * 100)}% remaining
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-700 ease-linear ${
                              previewTimer <= 2 
                                ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' 
                                : previewTimer <= 4 
                                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
                                  : 'bg-gradient-to-r from-sky-500 to-sky-600'
                            }`}
                            style={{ width: `${(previewTimer / 6) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewPhase === 'recording-type' && (
                    <div className="flex items-start gap-2">
                      <Keyboard className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-600 text-sm leading-relaxed">
                        &ldquo;I would approach this problem by first profiling the queries…&rdquo;{' '}
                        <span className="animate-pulse">|</span>
                      </p>
                    </div>
                  )}

                  {(previewPhase === 'stopped' || previewPhase === 'done') && (
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {previewPhase === 'done' ? PREVIEW_DEMO_TRANSCRIPT_FULL : PREVIEW_DEMO_TRANSCRIPT}
                    </p>
                  )}

                  {previewPhase === 'submitting' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <Send className="w-4 h-4" />
                      <span className="text-sm font-medium">Submitting answer…</span>
                    </div>
                  )}

                  {(previewPhase === 'analysing' || previewPhase === 'generating-next') && (
                    <p className="text-gray-500 text-sm italic">Answer locked while processing…</p>
                  )}

                  {(previewPhase === 'tab-warn-1' || previewPhase === 'tab-warn-2') && (
                    <p className="text-amber-600 text-sm">
                      {previewPhase === 'tab-warn-2'
                        ? 'Stay on this tab — one more switch ends the interview.'
                        : 'Return to this tab to continue your interview.'}
                    </p>
                  )}

                  {(previewPhase === 'tab-terminated' ||
                    previewPhase === 'esc-terminated' ||
                    previewPhase === 'end-terminated') && (
                    <p className="text-red-600 text-sm">This response was not submitted.</p>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white border-t border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {(previewPhase === 'recording-manual' ||
                    previewPhase === 'recording-type' ||
                    previewPhase === 'recording-auto') && (
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 bg-[#1e5da8] text-white rounded-lg text-sm font-medium"
                    >
                      <MicOff className="w-4 h-4" />
                      Stop Recording
                    </button>
                  )}
                  {previewPhase === 'stopped' && (
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium ring-2 ring-green-300"
                    >
                      <Send className="w-4 h-4" />
                      Submit Answer
                    </button>
                  )}
                  {(previewPhase === 'submitting' ||
                    previewPhase === 'analysing' ||
                    previewPhase === 'generating-next') && (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Please wait…
                    </button>
                  )}
                  {!previewPhase.includes('terminated') && (
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
                    >
                      <X className="w-4 h-4" />
                      End Interview
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateInterview;