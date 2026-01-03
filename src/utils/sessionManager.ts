/**
 * Session Manager Utility
 * Handles session timeout (30 minutes inactivity) and single-session login enforcement
 * Communicates with Supabase to track active sessions per user
 */

import { supabase } from '@/integrations/supabase/client';

const SESSION_TIMEOUT_MINUTES = 30;
const SESSION_CHECK_INTERVAL_SECONDS = 60;
const SESSION_STORAGE_KEY = 'provaluate_session_id';
const LAST_ACTIVITY_KEY = 'provaluate_last_activity';

export interface SessionData {
  session_id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  device_info: string;
  is_active?: boolean;
  ended_at?: string | null;
}

export interface SessionConflict {
  hasConflict: boolean;
  existingSession?: SessionData;
  currentSessionId: string;
}

export class SessionManager {
  /**
   * Generate a unique session ID for this browser session
   */
  static generateSessionId(): string {
    // Use only alphanumeric characters to avoid database query issues
    const timestamp = Date.now().toString();
    const randomPart = Math.random().toString(36).substring(2, 11);
    return `${timestamp}_${randomPart}`;
  }

  /**
   * Get device information for session tracking
   */
  static getDeviceInfo(): string {
    const ua = navigator.userAgent;
    const browserInfo = {
      userAgent: ua,
      language: navigator.language,
      platform: navigator.platform,
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(browserInfo);
  }

  /**
   * Create a new session in Supabase
   * @param userId - The user ID from Supabase Auth
   * @returns The new session data
   */
  static async createSession(userId: string): Promise<SessionData | null> {
    try {
      const sessionId = this.generateSessionId();
      const deviceInfo = this.getDeviceInfo();
      const now = new Date().toISOString();

      // Store session ID locally
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      localStorage.setItem(LAST_ACTIVITY_KEY, now);

      // Create session record in Supabase
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          created_at: now,
          last_activity: now,
          device_info: deviceInfo,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  }

  /**
   * Check if user has an existing active session on another device/browser
   * @param userId - The user ID from Supabase Auth
   * @returns SessionConflict object indicating if there's a conflict
   */
  static async checkSessionConflict(userId: string): Promise<SessionConflict> {
    try {
      const currentSessionId = localStorage.getItem(SESSION_STORAGE_KEY) || this.generateSessionId();

      // Get all active sessions for this user
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Error checking session conflict:', error);
        return { hasConflict: false, currentSessionId };
      }

      // Filter out expired sessions
      const activeSessions = (sessions || []).filter(session => {
        const lastActivity = new Date(session.last_activity).getTime();
        const now = Date.now();
        const inactiveMinutes = (now - lastActivity) / (1000 * 60);
        return inactiveMinutes < SESSION_TIMEOUT_MINUTES;
      });

      // Check if there's an existing session that's not the current one
      const existingSession = activeSessions.find(s => s.session_id !== currentSessionId);

      return {
        hasConflict: !!existingSession,
        existingSession: existingSession || undefined,
        currentSessionId,
      };
    } catch (error) {
      console.error('Error in checkSessionConflict:', error);
      return { hasConflict: false, currentSessionId: '' };
    }
  }

  /**
   * Update the last activity timestamp for the current session
   * @param sessionId - The session ID to update
   * @returns Success indicator
   */
  static async updateSessionActivity(sessionId?: string): Promise<boolean> {
    try {
      const id = sessionId || localStorage.getItem(SESSION_STORAGE_KEY);
      if (!id) return false;

      const now = new Date().toISOString();
      localStorage.setItem(LAST_ACTIVITY_KEY, now);

      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_activity: now,
        })
        .eq('session_id', id);

      if (error) {
        console.error('Error updating session activity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateSessionActivity:', error);
      return false;
    }
  }

  /**
   * End a specific session
   * @param sessionId - The session ID to end
   * @returns Success indicator
   */
  static async endSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error ending session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in endSession:', error);
      return false;
    }
  }

  /**
   * End all sessions for a user (except current)
   * @param userId - The user ID
   * @returns Success indicator
   */
  static async endAllOtherSessions(userId: string, keepSessionId?: string): Promise<boolean> {
    try {
      const currentSessionId = keepSessionId || localStorage.getItem(SESSION_STORAGE_KEY) || undefined;
      console.log(`🔄 Ending other sessions for user ${userId}, keeping session: ${currentSessionId}`);

      // First, let's see what sessions exist
      const { data: existingSessions } = await supabase
        .from('user_sessions')
        .select('session_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      console.log('📋 Existing active sessions:', existingSessions);

      let query = supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (currentSessionId) {
        query = query.neq('session_id', currentSessionId);
        console.log(`🔒 Will keep session: ${currentSessionId} active`);
      } else {
        console.log('⚠️ No session ID to keep - will end ALL sessions');
      }

      const { data, error } = await query.select();

      if (error) {
        console.error('❌ Error ending other sessions:', error);
        return false;
      }

      console.log('✅ Sessions ended:', data);
      return true;
    } catch (error) {
      console.error('Error in endAllOtherSessions:', error);
      return false;
    }
  }

  /**
   * Check if current session has expired due to inactivity
   * @returns True if session has timed out
   */
  static hasSessionTimedOut(): boolean {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return true;

    const lastActivityTime = new Date(lastActivity).getTime();
    const now = Date.now();
    const inactiveMinutes = (now - lastActivityTime) / (1000 * 60);

    return inactiveMinutes >= SESSION_TIMEOUT_MINUTES;
  }

  /**
   * Get remaining session time in minutes
   * @returns Remaining minutes
   */
  static getRemainingSessionTime(): number {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return 0;

    const lastActivityTime = new Date(lastActivity).getTime();
    const now = Date.now();
    const inactiveMinutes = (now - lastActivityTime) / (1000 * 60);
    const remaining = Math.max(0, SESSION_TIMEOUT_MINUTES - inactiveMinutes);

    return Math.ceil(remaining);
  }

  /**
   * Clear session data (called on logout)
   */
  static clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }

  /**
   * Ensure user_sessions table exists in Supabase
   * Returns SQL for manual creation if needed
   */
  static getSqlForSessionsTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE,
        device_info TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
    `;
  }

  /**
   * Get the current session data from Supabase
   */
  static async getCurrentSession(): Promise<SessionData | null> {
    const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      console.log('🔍 No session ID in localStorage');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching current session:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          sessionId: sessionId
        });
        return null;
      }

      if (!data) {
        console.log('🔍 No session found in database for ID:', sessionId);
        return null;
      }

      return data as SessionData;
    } catch (error) {
      console.error('❌ Unexpected error in getCurrentSession:', error);
      return null;
    }
  }

  /**
   * Get the current session ID stored locally
   */
  static getCurrentSessionId(): string | null {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  }

  /**
   * Check whether the current session is active on the server
   */
  static async isCurrentSessionActive(): Promise<boolean> {
    try {
      console.log('🔍 SessionManager: Checking if current session is active...');
      const session = await this.getCurrentSession();
      if (!session) {
        console.log('❌ SessionManager: No session found in database');
        return false;
      }
      console.log('📊 SessionManager: Session data:', {
        session_id: session.session_id,
        is_active: session.is_active,
        user_id: session.user_id,
        last_activity: session.last_activity
      });
      
      const isActive = session.is_active === true;
      console.log(isActive ? '✅ SessionManager: Session IS active' : '❌ SessionManager: Session is NOT active');
      return isActive;
    } catch (error) {
      console.error('❌ SessionManager: Error checking session activity:', error);
      return false;
    }
  }
}

export default SessionManager;

