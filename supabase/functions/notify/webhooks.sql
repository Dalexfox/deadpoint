-- Push-notification triggers — fire the `notify` Edge Function on every new
-- like / comment / follow. This is the SQL equivalent of the dashboard's
-- "Database Webhooks" (which are themselves triggers under the hood); doing it as
-- one idempotent script means it's version-controlled and re-runnable.
--
-- Run it against the deadpoint project (either is fine):
--   npx supabase db query --linked -f supabase/functions/notify/webhooks.sql
--   …or paste it into Supabase → SQL Editor.

create extension if not exists pg_net;

-- POSTs a Database-Webhook-shaped payload ({ type, table, record }) to `notify`,
-- which resolves the recipient + actor and sends the push. SECURITY DEFINER so it
-- can call net.http_post regardless of the inserting user.
create or replace function public.notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://fpjpcnlhxpahvyeidirz.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json'),
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
