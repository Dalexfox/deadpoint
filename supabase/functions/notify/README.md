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

## Optional hardening (recommended once live)
Stop randoms from POSTing fake payloads to the function:
```bash
supabase secrets set WEBHOOK_SECRET=<some-long-random-string>
```
Then on each of the 3 webhooks add an HTTP header
`x-webhook-secret: <same-random-string>`. With no secret set, the check is
skipped (fine for early testing).

## Test it
Have a friend (or a 2nd account on a 2nd device) like one of your climbs — you
should get a banner. Check **Supabase → Edge Functions → notify → Logs** if not.
