import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type UserWithProfile = User & {
  profile?: Database['public']['Tables']['users']['Row'];
  company?: Database['public']['Tables']['companies']['Row'];
};

type AuthContextValue = {
  user: UserWithProfile | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<{ user: UserWithProfile | null; error: { message: string } | null }>;
  signUp: (email: string, password: string, userData: Database['public']['Tables']['users']['Insert']) => Promise<{ user: UserWithProfile | null; error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchUser = useCallback(async () => {
    setError(null);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setUser(null);
        return;
      }
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('user_id, company_id, first_name, last_name, role, user_status, onboarding_complete, created_at')
        .eq('user_id', authUser.id)
        .single();
      if (profileError || !userProfile) {
        setUser(null);
        return;
      }
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .single();
      if (companyError || !companyData) {
        setUser(null);
        return;
      }
      setUser({ ...authUser, profile: userProfile, company: companyData });
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
      const u = { ...data.user, profile: userProfile ?? undefined, company: companyData ?? undefined };
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
      const u = { ...data.user, profile: userProfile ?? undefined, company: companyData ?? undefined };
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
    signOut,
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
