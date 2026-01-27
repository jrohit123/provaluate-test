import { useRef, useEffect, useState } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum distance in pixels to trigger swipe
  minVelocity?: number; // Minimum velocity to trigger swipe
  enabled?: boolean; // Whether swipe detection is enabled (default: true)
}

export function useSwipe(options: SwipeOptions = {}) {
  const { onSwipeLeft, onSwipeRight, threshold = 50, minVelocity = 0.3, enabled = true } = options;
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    // Only attach listeners if enabled
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const deltaTime = Date.now() - touchStart.current.time;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Check if horizontal swipe is more significant than vertical (to avoid triggering on scroll)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold && velocity > minVelocity) {
        if (deltaX > 0 && onSwipeRight) {
          // Swipe right
          setSwipeDirection('right');
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          // Swipe left
          setSwipeDirection('left');
          onSwipeLeft();
        }
      }

      // Reset after a short delay
      setTimeout(() => {
        setSwipeDirection(null);
      }, 300);

      touchStart.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, minVelocity, enabled]);

  return { swipeDirection };
}
