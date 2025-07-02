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

  // Initialize test user and create database records
  useEffect(() => {
    const initializeTestUser = async () => {
      try {
        // First create the company if it doesn't exist
        const { data: existingCompany, error: companyCheckError } = await supabase
          .from('companies')
          .select('company_id')
          .eq('company_id', TEST_USER.company!.company_id)
          .single();

        if (!existingCompany) {
          const { error: createCompanyError } = await supabase
            .from('companies')
            .insert(TEST_USER.company);

          if (createCompanyError) {
            throw new Error(`Failed to create company: ${createCompanyError.message}`);
          }
        }

        // Then create the user if they don't exist
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('user_id')
          .eq('user_id', TEST_USER.id)
          .single();

        if (!existingUser) {
          const { error: createUserError } = await supabase
            .from('users')
            .insert({
              user_id: TEST_USER.id,
              company_id: TEST_USER.profile!.company_id,
              email: TEST_USER.email!,
              first_name: TEST_USER.profile!.first_name,
              last_name: TEST_USER.profile!.last_name,
              role: TEST_USER.profile!.role,
              user_status: TEST_USER.profile!.user_status,
              created_at: TEST_USER.profile!.created_at
            });

          if (createUserError) {
            throw new Error(`Failed to create user: ${createUserError.message}`);
          }
        }

        setUser(TEST_USER);
      } catch (err) {
        console.error('Error initializing test user:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeTestUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Sign in bypassed for testing');
    return { user: TEST_USER };
  };

  const signUp = async (email: string, password: string, userData: Database['public']['Tables']['users']['Insert']) => {
    console.log('Sign up bypassed for testing');
    return { user: TEST_USER };
  };

  const signOut = async () => {
    console.log('Sign out bypassed for testing');
    setUser(null);
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