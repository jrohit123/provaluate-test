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

  // Just set the user directly - no complex auth
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔄 Setting test user directly...');
      
      try {
        // First, create a proper Supabase auth session
        console.log('🔐 Creating Supabase auth session...');
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'testpassword123'
        });

        if (signInError) {
          console.error('❌ Auth session creation failed:', signInError);
          // If auth fails, still set the hardcoded user but it won't work with RLS
        } else {
          console.log('✅ Auth session created successfully:', authData.user?.email);
        }

        // Set the hardcoded user data
        const testUser: UserWithProfile = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'test@example.com',
          role: 'authenticated',
          aud: 'authenticated',
          created_at: '2025-07-02T12:20:55.741Z',
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
            created_at: '2025-07-02T12:20:55.741Z'
          },
          company: {
            company_id: '00000000-0000-0000-0000-000000000002',
            company_name: 'Test Company',
            email_domain: 'example.com',
            selected_plan: 'pro',
            subscription_status: 'active',
            subscription_start: '2025-07-02T12:20:55.741Z',
            subscription_end: '2026-07-02T12:20:55.741Z',
            created_at: '2025-07-02T12:20:55.741Z',
            updated_at: '2025-07-02T12:20:55.741Z'
          }
        };

        setUser(testUser);
        setLoading(false);
        console.log('✅ Test user set successfully:', testUser);
      } catch (error) {
        console.error('💥 Error in auth setup:', error);
        setLoading(false);
        setError(error as Error);
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