import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

/** Return the configured Supabase client or throw if env vars are missing. */
export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** Id of the signed-in user. Throws if nobody is signed in. */
export async function currentUserId(): Promise<string> {
  const { data, error } = await requireClient().auth.getUser();
  if (error || !data.user) throw new Error('You are not signed in.');
  return data.user.id;
}

/** Wrap a PostgREST error message in an Error. */
export function toServiceError(error: { message: string }): Error {
  return new Error(error.message);
}
