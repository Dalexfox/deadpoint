/**
 * pendingLogs — offline safety net for the log flow.
 *
 * Gyms are concrete basements with bad signal. When the submit insert fails on
 * a network error, the composer offers "Save & post later": the log's fields are
 * queued here (AsyncStorage) and drained the next time the app has connectivity
 * — drainPendingLogs() is called on feed focus and on composer mount.
 *
 * Scope: quick logs and matched-problem logs only. New-problem creation is never
 * queued (it needs a problems insert + start-photo upload; the composer keeps
 * the form open instead so nothing is lost).
 *
 * The original log time is preserved: the queued `createdAt` is written to
 * sessions.created_at on drain, so a climb logged offline at the gym doesn't
 * jump to the top of the feed hours later with the wrong timestamp.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { uploadSessionMedia } from './store';

export type PendingLog = {
  id: string;
  gymId: string;
  grade: string;
  sendStyle: 'flash' | 'send' | 'project' | null;
  notes: string;
  visibility: 'public' | 'quiet';
  solo: boolean;
  problemId: string | null;
  mediaUri: string | null;          // local picker URI — may be purged by iOS; upload is best-effort
  mediaType: 'image' | 'video' | null;
  createdAt: string;                // ISO — original log moment, written to sessions.created_at
};

const KEY = 'deadpoint:pendingLogs';

export async function queuePendingLog(log: Omit<PendingLog, 'id' | 'createdAt'>): Promise<void> {
  const entry: PendingLog = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const raw = await AsyncStorage.getItem(KEY);
  const list: PendingLog[] = raw ? JSON.parse(raw) : [];
  list.push(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

let draining = false;

/** Posts queued logs oldest-first. Returns how many were posted. Never throws. */
export async function drainPendingLogs(): Promise<number> {
  if (draining) return 0;
  draining = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return 0;
    let list: PendingLog[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let posted = 0;
    for (const log of [...list]) {
      try {
        const { data: session, error: sErr } = await supabase
          .from('sessions')
          .insert({
            user_id:        user.id,
            gym_id:         log.gymId,
            total_problems: 1,
            visibility:     log.visibility,
            feed_rank:      null,
            solo:           log.solo,
            created_at:     log.createdAt,
            ...(log.notes ? { notes: log.notes } : {}),
          })
          .select('id')
          .single();
        if (sErr) throw sErr;

        const { error: cErr } = await supabase.from('climbs').insert({
          session_id: session.id,
          grade:      log.grade,
          count:      1,
          problem_id: log.problemId,
          ...(log.sendStyle ? { send_style: log.sendStyle } : {}),
        });
        if (cErr) throw cErr;

        // Media + cover are best-effort in the background — the climb row is what matters.
        if (log.mediaUri && log.mediaType) {
          const sessionId = session.id;
          const { mediaUri, mediaType, problemId } = log;
          uploadSessionMedia(mediaUri, mediaType)
            .then(async (up) => {
              if (up.url) {
                await supabase.from('sessions').update({ media_url: up.url }).eq('id', sessionId);
                if (problemId) await supabase.rpc('recompute_problem_cover', { problem_id: problemId });
              }
            })
            .catch(() => {});
        } else if (log.problemId) {
          supabase.rpc('recompute_problem_cover', { problem_id: log.problemId });
        }

        // Remove from the queue only after both inserts landed.
        list = list.filter((l) => l.id !== log.id);
        await AsyncStorage.setItem(KEY, JSON.stringify(list));
        posted++;
      } catch {
        break; // still offline (or a real error) — stop; the rest stay queued for next drain
      }
    }
    return posted;
  } catch {
    return 0;
  } finally {
    draining = false;
  }
}
