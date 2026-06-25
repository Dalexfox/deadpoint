// notify — Deno Edge Function that sends a push notification when someone likes
// or comments on your climb, or follows you. Triggered by Supabase Database
// Webhooks on INSERT into public.likes / public.comments / public.follows.
//
// It mirrors the in-app /notifications inbox (which is derived live, no table) —
// this just adds the phone banner when the app is closed.
//
// Deploy + wire-up: see supabase/functions/notify/README.md.
//
// Uses the service-role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY) to read
// push tokens + profiles past RLS. Always returns 200 so a webhook never
// retry-storms on a bad row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Optional hardening: if a WEBHOOK_SECRET function secret is set, the webhook must
// send a matching `x-webhook-secret` header. Left unset → the check is skipped
// (fine for an MVP; recommended once you're live). See README.
const SECRET = Deno.env.get('WEBHOOK_SECRET');

async function actorName(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles').select('username, full_name').eq('id', userId).single();
  return data?.username ? `@${data.username}` : (data?.full_name || 'Someone');
}

async function sessionOwner(sessionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('sessions').select('user_id').eq('id', sessionId).single();
  return data?.user_id ?? null;
}

Deno.serve(async (req) => {
  try {
    if (SECRET && req.headers.get('x-webhook-secret') !== SECRET) {
      return new Response('unauthorized', { status: 401 });
    }
    const payload = await req.json();
    const table = payload.table as string;
    const rec = payload.record ?? {};

    let actorId: string | null = null;
    let recipientId: string | null = null;
    let title = '';
    let body = '';
    let url = '/notifications';

    if (table === 'likes') {
      actorId = rec.user_id;
      recipientId = rec.session_id ? await sessionOwner(rec.session_id) : null;
      url = `/session/${rec.session_id}`;
      title = `${await actorName(actorId!)} liked your climb`;
    } else if (table === 'comments') {
      actorId = rec.user_id;
      recipientId = rec.session_id ? await sessionOwner(rec.session_id) : null;
      url = `/session/${rec.session_id}`;
      title = `${await actorName(actorId!)} commented`;
      body = String(rec.content ?? '').slice(0, 140);
    } else if (table === 'follows') {
      actorId = rec.follower_id;
      recipientId = rec.following_id;
      url = '/notifications';
      title = `${await actorName(actorId!)} started following you`;
    } else {
      return new Response('ignored', { status: 200 });
    }

    // Never notify yourself (e.g. liking your own climb).
    if (!recipientId || !actorId || recipientId === actorId) {
      return new Response('skipped', { status: 200 });
    }

    const { data: recip } = await supabase
      .from('profiles').select('push_token').eq('id', recipientId).single();
    const token = recip?.push_token;
    if (!token) return new Response('no token', { status: 200 });

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', data: { url } }),
    });
    const result = await res.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 200 });
  }
});
