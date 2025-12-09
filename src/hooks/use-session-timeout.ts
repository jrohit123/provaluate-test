/**
 * useSessionTimeout Hook
 * Manages session timeout and activity tracking
 * Automatically logs out user after 30 minutes of inactivity
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionManager } from '@/utils/sessionManager';
import { supabase } from '@/integrations/supabase/client';
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
  const hasLoggedOutRef = useRef(false);

  // Update remaining session time
  const updateRemainingTime = useCallback(() => {
    const remaining = SessionManager.getRemainingSessionTime();
    setRemainingMinutes(remaining);
    return remaining;
  }, []);

  // Check if session should timeout
  const logoutAndRedirect = useCallback(async ({
    title,
    description,
    variant = 'destructive',
    skipEndSession = false,
  }: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
    skipEndSession?: boolean;
  }) => {
    if (hasLoggedOutRef.current) return;
    hasLoggedOutRef.current = true;

    try {
      const sessionId = SessionManager.getCurrentSessionId();
      if (sessionId && !skipEndSession) {
        await SessionManager.endSession(sessionId);
      }
      SessionManager.clearSession();

      localStorage.removeItem('recruitai_auth');
      localStorage.removeItem('cv-screening-session');
      sessionStorage.removeItem('selectedJDId');
      sessionStorage.removeItem('selectedCriteriaGridId');
      sessionStorage.removeItem('uploadedFiles');
      sessionStorage.removeItem('selectedCandidatesForInterview');

      // Try to sign out from Supabase Auth (local scope only), but don't let it block the logout
      // Using local scope prevents other devices from being logged out unintentionally
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (authError) {
        console.warn('Supabase auth signout failed, but continuing with logout:', authError);
        // Don't throw or stop the logout process - our custom session management is independent
      }

      try {
        window.dispatchEvent(new Event('session:cleared'));
      } catch (eventError) {
        // noop
      }

      toast({
        title,
        description,
        variant,
      });
    } catch (error) {
      console.error('Error during logout flow:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  }, [navigate, toast]);

  const handleTimeout = useCallback(async () => {
    await logoutAndRedirect({
      title: 'Session Expired',
      description: 'Your session has expired due to inactivity. Please log in again.',
    });
  }, [logoutAndRedirect]);

  // DISABLED FOR TROUBLESHOOTING - Session timeout checking is commented out
  const checkSessionTimeout = useCallback(async () => {
    // SESSION TIMEOUT DISABLED FOR TROUBLESHOOTING
    return;
    
    /* COMMENTED OUT FOR TROUBLESHOOTING
    // Check if our custom session is still active (independent of Supabase Auth)
    const sessionId = SessionManager.getCurrentSessionId();
    if (sessionId) {
      const isActive = await SessionManager.isCurrentSessionActive();
      console.log(`🔍 Session check - ID: ${sessionId}, Active: ${isActive}`);
      if (!isActive) {
        console.log('❌ Session is inactive, logging out...');
        await logoutAndRedirect({
          title: 'Session Ended',
          description: 'Your session was closed because you signed in from another device.',
          skipEndSession: true,
        });
        return;
      }
    }

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
    */
  }, [warningThresholdMinutes, onTimeout, onWarning, updateRemainingTime, handleTimeout, logoutAndRedirect]);

  // Handle user activity (reset inactivity timer)
  const handleActivity = useCallback(() => {
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set a timeout to update session activity
    // This debounces frequent activity events
    activityTimeoutRef.current = setTimeout(async () => {
      const updateSuccessful = await SessionManager.updateSessionActivity();
      if (!updateSuccessful) {
        // Check if our custom session is still active (independent of Supabase Auth)
        const sessionId = SessionManager.getCurrentSessionId();
        if (sessionId) {
          const stillActive = await SessionManager.isCurrentSessionActive();
          if (!stillActive) {
            await logoutAndRedirect({
              title: 'Session Ended',
              description: 'Your session was closed because you signed in from another device.',
              skipEndSession: true,
            });
            return;
          }
        }
      }
      checkSessionTimeout(); // Re-check timeout after activity
    }, 1000);
  }, [checkSessionTimeout, logoutAndRedirect]);

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
  // DISABLED FOR TROUBLESHOOTING - Activity tracking is commented out
  useEffect(() => {
    // SESSION TIMEOUT DISABLED FOR TROUBLESHOOTING
    return;
    
    /* COMMENTED OUT FOR TROUBLESHOOTING
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
    */
  }, [handleActivity]);

  // Set up timeout check interval
  // DISABLED FOR TROUBLESHOOTING - Timeout checking interval is commented out
  useEffect(() => {
    // SESSION TIMEOUT DISABLED FOR TROUBLESHOOTING
    return;
    
    /* COMMENTED OUT FOR TROUBLESHOOTING
    // Initial check
    checkSessionTimeout();

    // Check every 30 seconds
    checkTimeoutIntervalRef.current = setInterval(() => {
      checkSessionTimeout();
    }, 30000);

    return () => {
      if (checkTimeoutIntervalRef.current) {
        clearInterval(checkTimeoutIntervalRef.current);
      }
    };
    */
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

