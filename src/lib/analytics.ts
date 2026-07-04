/**
 * analytics — minimal event instrumentation, backed by the `events` Supabase table.
 *
 * track() is fire-and-forget and can never throw or block UI: it resolves the
 * user, inserts one row, and swallows every failure (offline, signed out, RLS).
 * Reads happen in SQL on the dashboard side (service role bypasses RLS); the
 * app itself never selects from `events`.
 *
 * Event naming: snake_case verbs — log_started, log_submitted, log_abandoned…
 * Keep props small and flat; they land in a jsonb column.
 */
import { supabase } from './supabase';

export function track(name: string, props?: Record<string, unknown>) {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // pre-auth events aren't recorded (RLS requires auth.uid())
    await supabase.from('events').insert({
      user_id: user.id,
      name,
      ...(props ? { props } : {}),
    });
  })().catch(() => {});
}
