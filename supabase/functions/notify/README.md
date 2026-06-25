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

### 3. Add 3 Database Webhooks (Supabase → Database → Webhooks → Create)
Create one webhook for **each** table — `likes`, `comments`, `follows`:
- **Events:** Insert
- **Type:** Supabase Edge Functions → choose **`notify`**
- **Method:** POST

### 4. Turn on iOS push delivery (APNs)
Expo's push service delivers to iOS using an APNs key held by EAS. Either:
- run `eas credentials` → iOS → **Push Notifications Key** → set one up, or
- just run the next `eas build` — it will offer to create/manage the key.

### 5. Rebuild the app
`expo-notifications` is a native module, so it needs a fresh build:
```bash
npx eas-cli build --platform ios --profile production --auto-submit
```

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
