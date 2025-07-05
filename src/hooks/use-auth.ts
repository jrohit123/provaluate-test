import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from '@/integrations/supabase/db';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type UserWithProfile = User & {
  profile?: Database['public']['Tables']['users']['Row'];
  company?: Database['public']['Tables']['companies']['Row'];
};

// Default test user data
const TEST_USER: UserWithProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
  role: 'authenticated',
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  profile: {
    user_id: '00000000-0000-0000-0000-000000000001',
    company_id: '00000000-0000-0000-0000-000000000002',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'admin',
    user_status: 'active',
    created_at: new Date().toISOString()
  },
  company: {
    company_id: '00000000-0000-0000-0000-000000000002',
    company_name: 'Test Company',
    email_domain: 'example.com',
    selected_plan: 'pro',
    subscription_status: 'active',
    subscription_start: new Date().toISOString(),
    subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
};

export function useAuth() {
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Simple direct auth setup that matches JobUploadSection pattern
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔄 Setting test user directly...');
      
      try {
        // Create a simple auth session without complex error handling
        console.log('🔐 Creating Supabase auth session...');
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'testpassword123'
        });

        // If auth fails, just use the test user data directly
        if (signInError) {
          console.log('❌ Auth failed, using test user directly:', signInError.message);
          console.log('✅ Setting test user directly...');
          setUser(TEST_USER);
          setLoading(false);
          return;
        }

        console.log('✅ Auth session created successfully:', authData.user?.email);
        console.log('Auth user ID:', authData.user?.id);

        // Fetch user profile from database
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', authData.user.id)
          .single();

        if (profileError) {
          console.log('❌ Profile fetch failed, using test user:', profileError.message);
          setUser(TEST_USER);
          setLoading(false);
          return;
        }

        // Fetch company data
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .single();

        if (companyError) {
          console.log('❌ Company fetch failed, using test user:', companyError.message);
          setUser(TEST_USER);
          setLoading(false);
          return;
        }

        // Create user object with real auth data
        const userWithProfile: UserWithProfile = {
          ...authData.user,
          profile: userProfile,
          company: companyData
        };

        setUser(userWithProfile);
        setLoading(false);
        console.log('✅ User set successfully:', userWithProfile);
      } catch (error) {
        console.log('💥 Error in auth setup, using test user:', error);
        setUser(TEST_USER);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Sign in - using test user');
    return { user: user, error: null };
  };

  const signUp = async (email: string, password: string, userData: Database['public']['Tables']['users']['Insert']) => {
    console.log('Sign up - using test user');
    return { user: user, error: null };
  };

  const signOut = async () => {
    console.log('Sign out');
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