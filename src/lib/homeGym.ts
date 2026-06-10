import { supabase } from './supabase';

/**
 * Silently keeps a user's profiles.home_gym_id in sync with their logging
 * behaviour. Call this once, after a session has been successfully inserted.
 *
 * Rules (from the product spec):
 *   1. If home_gym_id is null → set it to the gym they just logged.
 *   2. From the 3rd session onward → keep home_gym_id synced to their
 *      most-logged gym, but only write if the leader differs from the current
 *      value (idempotent; ties prefer the current value so it never flaps).
 *
 * Best-effort and silent: any failure is swallowed so it can never block or
 * crash the submit flow. No UI.
 */
export async function syncHomeGymAfterSubmit(
  userId: string,
  justLoggedGymId: string,
): Promise<void> {
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('home_gym_id')
      .eq('id', userId)
      .single();

    const current: string | null = prof?.home_gym_id ?? null;

    // Case 1 — no home gym yet → adopt the gym they just logged.
    if (current === null) {
      await supabase
        .from('profiles')
        .update({ home_gym_id: justLoggedGymId })
        .eq('id', userId);
      return;
    }

    // Case 2 — from the 3rd session onward, sync to the most-logged gym.
    const { data: sessions } = await supabase
      .from('sessions')
      .select('gym_id')
      .eq('user_id', userId);

    const gymIds = (sessions ?? [])
      .map(s => s.gym_id)
      .filter((g): g is string => !!g);

    if (gymIds.length < 3) return;

    const counts: Record<string, number> = {};
    for (const g of gymIds) counts[g] = (counts[g] ?? 0) + 1;

    // Start from the current gym; only switch if another gym strictly beats it.
    // Strict comparison + current-as-baseline means ties keep the current value
    // and we never issue a needless update.
    let leader = current;
    let max = counts[current] ?? 0;
    for (const [g, c] of Object.entries(counts)) {
      if (c > max) {
        max = c;
        leader = g;
      }
    }

    if (leader !== current) {
      await supabase
        .from('profiles')
        .update({ home_gym_id: leader })
        .eq('id', userId);
    }
  } catch {
    // Inference is best-effort — never surface an error to the user.
  }
}
