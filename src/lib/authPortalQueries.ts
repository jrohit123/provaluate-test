import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/** `tpo_users` may not be in generated Database types; query via untyped client. */
export async function hasTpoProfile(authUserId: string): Promise<boolean> {
  const client = supabase as unknown as SupabaseClient;
  const { data, error } = await client.from('tpo_users').select('id').eq('auth_user_id', authUserId).maybeSingle();
  if (error) return false;
  return data != null;
}
