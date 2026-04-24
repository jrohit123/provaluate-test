import { useEffect, useRef, useState } from 'react';

type AnimatedNumberOptions = {
  durationMs?: number;
  startAt?: number;
};

export function useAnimatedNumber(target: number, options?: AnimatedNumberOptions): number {
  const durationMs = options?.durationMs ?? 1400;
  const [value, setValue] = useState(options?.startAt ?? 0);
  const fromRef = useRef(options?.startAt ?? 0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      const safeTarget = Math.max(0, Math.floor(Number.isFinite(target) ? target : 0));
      setValue(safeTarget);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const safeTarget = Math.max(0, Math.floor(Number.isFinite(target) ? target : 0));
    if (reduceMotion || durationMs <= 0) {
      setValue(safeTarget);
      fromRef.current = safeTarget;
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    fromRef.current = value;
    startTimeRef.current = null;

    const tick = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const next = Math.round(fromRef.current + (safeTarget - fromRef.current) * progress);
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, durationMs]);

  return value;
}
