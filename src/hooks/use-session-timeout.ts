/**
 * useSessionTimeout Hook
 * Manages session timeout and activity tracking
 * Automatically logs out user after 30 minutes of inactivity
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionManager } from '@/utils/sessionManager';
import { useToast } from '@/hooks/use-toast';

interface UseSessionTimeoutOptions {
  onTimeout?: () => void;
  onWarning?: (remainingMinutes: number) => void;
  warningThresholdMinutes?: number;
}

/**
 * Custom hook for managing session timeout and inactivity detection
 * 
 * Features:
 * - Tracks user activity (clicks, keyboard, mouse movement)
 * - Warns user 5 minutes before session expires
 * - Automatically logs out after 30 minutes of inactivity
 * - Extends session when user is active
 *
 * @param options - Configuration options
 * @returns Object with timeout state and control functions
 */
export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const {
    onTimeout,
    onWarning,
    warningThresholdMinutes = 5,
  } = options;

  const navigate = useNavigate();
  const { toast } = useToast();
  const [isTimeoutWarningVisible, setIsTimeoutWarningVisible] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState(30);
  const warningShownRef = useRef(false);
  const checkTimeoutIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update remaining session time
  const updateRemainingTime = useCallback(() => {
    const remaining = SessionManager.getRemainingSessionTime();
    setRemainingMinutes(remaining);
    return remaining;
  }, []);

  // Check if session should timeout
  const checkSessionTimeout = useCallback(() => {
    const hasTimedOut = SessionManager.hasSessionTimedOut();

    if (hasTimedOut) {
      // Session has timed out
      setIsTimeoutWarningVisible(false);
      warningShownRef.current = false;

      // Call timeout callback if provided
      if (onTimeout) {
        onTimeout();
      }

      // Logout user
      handleTimeout();
      return;
    }

    // Check if warning threshold has been reached
    const remaining = updateRemainingTime();
    if (remaining <= warningThresholdMinutes && !warningShownRef.current) {
      warningShownRef.current = true;
      setIsTimeoutWarningVisible(true);

      if (onWarning) {
        onWarning(remaining);
      }
    } else if (remaining > warningThresholdMinutes && warningShownRef.current) {
      // Reset warning flag if user continues session
      warningShownRef.current = false;
      setIsTimeoutWarningVisible(false);
    }
  }, [warningThresholdMinutes, onTimeout, onWarning, updateRemainingTime]);

  // Handle timeout
  const handleTimeout = useCallback(async () => {
    try {
      // Get current session ID
      const sessionId = localStorage.getItem('provaluate_session_id');
      if (sessionId) {
        await SessionManager.endSession(sessionId);
      }

      // Clear local session data
      SessionManager.clearSession();

      // Clear other stored data
      localStorage.removeItem('recruitai_auth');
      localStorage.removeItem('cv-screening-session');
      sessionStorage.removeItem('selectedJDId');
      sessionStorage.removeItem('selectedCriteriaGridId');
      sessionStorage.removeItem('uploadedFiles');
      sessionStorage.removeItem('selectedCandidatesForInterview');

      // Show notification
      toast({
        title: 'Session Expired',
        description: 'Your session has expired due to inactivity. Please log in again.',
        variant: 'destructive',
      });

      // Redirect to login
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error during session timeout:', error);
      navigate('/login', { replace: true });
    }
  }, [navigate, toast]);

  // Handle user activity (reset inactivity timer)
  const handleActivity = useCallback(() => {
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set a timeout to update session activity
    // This debounces frequent activity events
    activityTimeoutRef.current = setTimeout(() => {
      SessionManager.updateSessionActivity();
      checkSessionTimeout(); // Re-check timeout after activity
    }, 1000);
  }, [checkSessionTimeout]);

  // Continue session (user responds to warning)
  const continueSession = useCallback(async () => {
    try {
      await SessionManager.updateSessionActivity();
      setIsTimeoutWarningVisible(false);
      warningShownRef.current = false;
      setRemainingMinutes(30);
      updateRemainingTime();

      toast({
        title: 'Session Extended',
        description: 'Your session has been extended for another 30 minutes.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error continuing session:', error);
    }
  }, [toast, updateRemainingTime]);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity]);

  // Set up timeout check interval
  useEffect(() => {
    // Initial check
    checkSessionTimeout();

    // Check every 30 seconds
    checkTimeoutIntervalRef.current = setInterval(checkSessionTimeout, 30000);

    return () => {
      if (checkTimeoutIntervalRef.current) {
        clearInterval(checkTimeoutIntervalRef.current);
      }
    };
  }, [checkSessionTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (checkTimeoutIntervalRef.current) {
        clearInterval(checkTimeoutIntervalRef.current);
      }
    };
  }, []);

  return {
    isTimeoutWarningVisible,
    remainingMinutes,
    continueSession,
    logout: handleTimeout,
  };
}

export default useSessionTimeout;

