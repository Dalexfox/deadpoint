-- Push-notification triggers — fire the `notify` Edge Function on every new
-- like / comment / follow, with a shared-secret header so the function only
-- accepts calls from THESE triggers (the WEBHOOK_SECRET hardening).
--
-- The secret VALUE is NOT in this file — it lives in `app_private.config` (set
-- out-of-band) and in the function's `WEBHOOK_SECRET` secret. So this file is
-- safe to commit and re-run:
--   npx supabase db query --linked -f supabase/functions/notify/webhooks.sql

create extension if not exists pg_net;

-- Private config (NOT in the `public` schema → never exposed via the REST API).
-- Holds the webhook shared secret; the value is inserted separately, never committed.
create schema if not exists app_private;
create table if not exists app_private.config (key text primary key, value text);

-- POSTs a Database-Webhook-shaped payload ({ type, table, record }) to `notify`,
-- with the shared secret header. SECURITY DEFINER so it can read the private
-- config + call net.http_post regardless of the inserting user.
create or replace function public.notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_secret text;
begin
  select value into v_secret from app_private.config where key = 'webhook_secret';
  perform net.http_post(
    url     := 'https://fpjpcnlhxpahvyeidirz.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body    := jsonb_build_object('type', 'INSERT', 'table', tg_table_name, 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists notify_push_likes on public.likes;
create trigger notify_push_likes
  after insert on public.likes
  for each row execute function public.notify_on_insert();

drop trigger if exists notify_push_comments on public.comments;
create trigger notify_push_comments
  after insert on public.comments
  for each row execute function public.notify_on_insert();

drop trigger if exists notify_push_follows on public.follows;
create trigger notify_push_follows
  after insert on public.follows
  for each row execute function public.notify_on_insert();
