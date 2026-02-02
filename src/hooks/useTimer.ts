import { useEffect, useRef, useState } from 'react';

type TimerOptions = {
  onEnd?: () => void;
};

export function useTimer(initialSeconds: number, active: boolean, options: TimerOptions = {}) {
  const { onEnd } = options;

  const [seconds, setSeconds] = useState(initialSeconds);
  const startRef = useRef<number | null>(null);
  const previousInitial = useRef(initialSeconds);
  // Keep latest onEnd in a ref so we don't reset the timer when only the callback reference changes (e.g. parent re-render when isRecording changes)
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    // Reset timer when initialSeconds changes
    if (initialSeconds !== previousInitial.current) {
      previousInitial.current = initialSeconds;
      startRef.current = null;
      setSeconds(initialSeconds);
    }
  }, [initialSeconds]);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      return;
    }

    let frame: number;
    // CRITICAL FIX: Initialize start time IMMEDIATELY when active becomes true
    // This prevents the 1-2 second loss that occurred when startRef was set on first tick
    startRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = Math.floor((now - startRef.current!) / 1000);
      const remaining = Math.max(initialSeconds - elapsed, 0);

      setSeconds(remaining);

      if (remaining > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        onEndRef.current?.();
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, initialSeconds]);
  // Intentionally omit onEnd from deps: we use onEndRef so the timer does NOT restart when only the parent's callback reference changes (e.g. when isRecording changes on "Stop recording" for written questions).

  return seconds;
}