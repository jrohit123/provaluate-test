import { useEffect, useRef, useState } from 'react';

type CountdownTimerOptions = {
  onEnd?: () => void;
};

/**
 * A countdown timer that NEVER resets once started
 * Used for the overall interview duration
 */
export function useCountdownTimer(
  initialSeconds: number, 
  active: boolean, 
  options: CountdownTimerOptions = {}
) {
  const { onEnd } = options;
  
  const [seconds, setSeconds] = useState(initialSeconds);
  const startTimeRef = useRef<number | null>(null);
  const initialSecondsRef = useRef(initialSeconds);
  const hasInitializedRef = useRef(false);

  // Only initialize ONCE when component mounts
  useEffect(() => {
    if (!hasInitializedRef.current) {
      initialSecondsRef.current = initialSeconds;
      hasInitializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    // Initialize start time only once
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
      console.log('🕐 Interview timer started at:', new Date().toLocaleTimeString());
    }

    let frame: number;

    const tick = () => {
      const now = performance.now();
      const elapsed = Math.floor((now - startTimeRef.current!) / 1000);
      const remaining = Math.max(initialSecondsRef.current - elapsed, 0);

      setSeconds(remaining);

      if (remaining > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        console.log('⏰ Interview timer ended');
        if (onEnd) {
          onEnd();
        }
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [active, onEnd]);

  return seconds;
}
