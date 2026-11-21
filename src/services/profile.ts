import type { Profile } from '@/types/domain';
import { currentUserId, requireClient, toServiceError } from '@/services/client';

/** Fetch the signed-in user's business profile. */
export async function getProfile(): Promise<Profile> {
  const { data, error } = await requireClient().from('profiles').select('*').single();
  if (error) throw toServiceError(error);
  return data as Profile;
}

/** Update the profile fields given in `patch`. */
export async function updateProfile(
  patch: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Profile> {
  const uid = await currentUserId();
  const { data, error } = await requireClient()
    .from('profiles')
    .update(patch)
    .eq('id', uid)
    .select()
    .single();
  if (error) throw toServiceError(error);
  return data as Profile;
}
