import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type UserWithProfile = User & {
  profile?: Database['public']['Tables']['users']['Row'];
  company?: Database['public']['Tables']['companies']['Row'];
};

export function useAuth() {
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch the current user and their profile/company on mount
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          setUser(null);
          setLoading(false);
          return;
        }
                    // Fetch user profile
            const { data: userProfile, error: profileError } = await supabase
              .from('users')
              .select('user_id, company_id, first_name, last_name, role, user_status, onboarding_complete, created_at')
              .eq('user_id', authUser.id)
              .single();
        if (profileError || !userProfile) {
          setUser(null);
          setLoading(false);
          return;
        }
        // Fetch company
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .single();
        if (companyError || !companyData) {
          setUser(null);
          setLoading(false);
          return;
        }
        setUser({ ...authUser, profile: userProfile, company: companyData });
        setLoading(false);
      } catch (err: any) {
        setUser(null);
        setError(err);
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Sign in and refresh user state
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setUser(null);
      setLoading(false);
      return { user: null, error };
    }
    // Fetch user profile and company
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
    setUser({ ...data.user, profile: userProfile, company: companyData });
    setLoading(false);
    return { user: { ...data.user, profile: userProfile, company: companyData }, error: null };
  };

  // Sign up and refresh user state
  const signUp = async (email: string, password: string, userData: Database['public']['Tables']['users']['Insert']) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      setUser(null);
      setLoading(false);
      return { user: null, error };
    }
    // Insert user profile into users table
    await supabase.from('users').insert({ ...userData, user_id: data.user.id });
    // Fetch user profile and company
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
    setUser({ ...data.user, profile: userProfile, company: companyData });
    setLoading(false);
    return { user: { ...data.user, profile: userProfile, company: companyData }, error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    return { error: null };
  };

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
  };
} 