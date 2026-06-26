# `notify` — push notification sender

Sends a phone push when someone **likes** or **comments** on your climb, or
**follows** you. Triggered by Supabase **Database Webhooks** on `INSERT` into
`likes` / `comments` / `follows`. (The in-app `/notifications` inbox is separate
and needs none of this — it's derived live.)

iOS-first. Push only works on a **real device + a real build** (not Expo Go).

## One-time setup

### 1. Add the column (Supabase → SQL Editor)
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
```

### 2. Deploy this function (Supabase CLI)
```bash
# install once: npm i -g supabase   (or: brew install supabase/tap/supabase)
supabase login
supabase link --project-ref <your-project-ref>   # the subdomain in your Supabase URL
supabase functions deploy notify --no-verify-jwt
```
`--no-verify-jwt` lets the Database Webhook call it. The function does its own
auth with the service-role key (auto-injected) and the optional secret below.

### 3. Wire the triggers (likes / comments / follows → notify)
Done via **`webhooks.sql`** (next to this file) — `pg_net` triggers that POST a
`{ type, table, record }` payload to the function on every insert. It's the SQL
equivalent of the dashboard's "Database Webhooks", but version-controlled and
idempotent. Apply it with:
```bash
npx supabase db query --linked -f supabase/functions/notify/webhooks.sql
```
(Or paste it into Supabase → SQL Editor. The dashboard's Database Webhooks UI is
an equivalent alternative — one hook each for `likes`/`comments`/`follows`,
Insert → Edge Function `notify`.)

> ✅ For the live `deadpoint` project, steps 1 (column) and 3 (triggers) are
> already applied, and step 2 (deploy) is done.

### 4. Turn on iOS push delivery (APNs) — **the remaining step**
The Push Notifications capability + APNs key are set up by EAS during a build, but
the **first** production build after adding the `expo-notifications` plugin must be
run **interactively** so EAS can register the capability + regenerate the
provisioning profile (a non-interactive build fails — that killed build #18):
```bash
npx eas-cli build --platform ios --profile production --auto-submit
```
(No `--non-interactive`. Answer **Yes** to any Push Notifications / provisioning
prompts.) After this one interactive build, future `--non-interactive` builds work.

## Hardening — ✅ DONE
The function is deployed `--no-verify-jwt`, so it was a public endpoint anyone
could POST fake payloads to (push spam). It's now locked behind a shared secret:
- A random `WEBHOOK_SECRET` is set on the function (`supabase secrets set`).
- The same value lives in `app_private.config` (a private, non-API-exposed table),
  and the triggers in `webhooks.sql` read it and send it as the `x-webhook-secret`
  header. The function rejects any request without the matching secret (401).

The secret value is **only** in the function's secrets + `app_private.config` —
never in git. To rotate it: set a new `WEBHOOK_SECRET`, update the
`app_private.config` row to match, then redeploy `notify`.

## Test it
Have a friend (or a 2nd account on a 2nd device) like one of your climbs — you
should get a banner. Check **Supabase → Edge Functions → notify → Logs** if not.
