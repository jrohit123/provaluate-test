import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hasTpoProfile } from '@/lib/authPortalQueries';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type CandidateRow = Database['public']['Tables']['candidates']['Row'];

type UserWithProfile = User & {
  profile?: Database['public']['Tables']['users']['Row'];
  company?: Database['public']['Tables']['companies']['Row'];
  candidate?: never;
};

type UserWithCandidate = User & {
  profile?: never;
  company?: never;
  candidate?: CandidateRow;
};

export type AuthUser = UserWithProfile | UserWithCandidate;

export function isCandidate(user: AuthUser | null): user is UserWithCandidate {
  return user != null && 'candidate' in user && user.candidate != null;
}

export function isRecruiter(user: AuthUser | null): user is UserWithProfile {
  return user != null && 'profile' in user && user.profile != null;
}

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<{ user: AuthUser | null; error: { message: string } | null }>;
  signUp: (email: string, password: string, userData: Database['public']['Tables']['users']['Insert']) => Promise<{ user: AuthUser | null; error: { message: string } | null }>;
  candidateSignUp: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  candidateSignIn: (email: string, password: string) => Promise<{ user: AuthUser | null; error: { message: string } | null; needsOnboarding?: boolean }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchUser = useCallback(async () => {
    setError(null);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Recruiter: check users table first
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('user_id, company_id, first_name, last_name, role, user_status, onboarding_complete, created_at')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (!profileError && userProfile) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .single();
        if (!companyError && companyData) {
          setUser({ ...authUser, profile: userProfile, company: companyData });
          setLoading(false);
          return;
        }
      }
      // Candidate: check candidates table
      const { data: candidateRow, error: candidateError } = await supabase
        .from('candidates')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (!candidateError && candidateRow) {
        setUser({ ...authUser, candidate: candidateRow });
        setLoading(false);
        return;
      }
      setUser(null);
    } catch (err: unknown) {
      setUser(null);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') fetchUser();
      else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        setUser(null);
        setLoading(false);
        return { user: null, error: signInError };
      }
      const { data: userProfile } = await supabase
        .from('users')
        .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
        .eq('user_id', data.user.id)
        .single();
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', userProfile?.company_id)
        .single();
      const u: AuthUser = { ...data.user, profile: userProfile ?? undefined, company: companyData ?? undefined };
      setUser(u);
      setLoading(false);
      return { user: u, error: null };
    },
    []
  );

  const candidateSignUp = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}candidate-login`;
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (signUpError) return { error: signUpError };
      return { error: null };
    },
    []
  );

  const candidateSignIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        setUser(null);
        setLoading(false);
        return { user: null, error: signInError };
      }
      const { data: candidateRow, error: candidateError } = await supabase
        .from('candidates')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      if (candidateError) {
        setUser(null);
        setLoading(false);
        return { user: null, error: candidateError };
      }
      if (!candidateRow) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (userProfile) {
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return {
            user: null,
            error: { message: 'This account is a recruiter account. Please sign in on the recruiter login page.' },
          };
        }
        if (await hasTpoProfile(data.user.id)) {
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return {
            user: null,
            error: { message: 'This account is a TPO account. Please sign in on the TPO login page.' },
          };
        }
        const u: AuthUser = { ...data.user, candidate: undefined };
        setUser(u);
        setLoading(false);
        return { user: u, error: null, needsOnboarding: true };
      }
      const u: AuthUser = { ...data.user, candidate: candidateRow };
      setUser(u);
      setLoading(false);
      return { user: u, error: null };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string, userData: Database['public']['Tables']['users']['Insert']) => {
      setLoading(true);
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError || !data.user) {
        setUser(null);
        setLoading(false);
        return { user: null, error: signUpError };
      }
      await supabase.from('users').insert({ ...userData, user_id: data.user.id });
      const { data: userProfile } = await supabase
        .from('users')
        .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
        .eq('user_id', data.user.id)
        .single();
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', userProfile?.company_id)
        .single();
      const u: AuthUser = { ...data.user, profile: userProfile ?? undefined, company: companyData ?? undefined };
      setUser(u);
      setLoading(false);
      return { user: u, error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    return { error: null };
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    signIn,
    signUp,
    candidateSignUp,
    candidateSignIn,
    signOut,
    refreshUser: fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
