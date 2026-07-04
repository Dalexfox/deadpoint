# Deadpoint — Project Context for Claude Code

## What is Deadpoint?
Deadpoint is a social climbing tracker app for indoor bouldering gyms. Think Strava, but for climbing. Users can track which gyms they've visited, log the problems they've completed, and share their sessions with a community feed — like Instagram or TikTok but for climbers.

## Core Concept
- Users visit a gym and log **one climb at a time** (one session = one climb at one grade)
- Their session is shared to a social feed visible to their friends
- Friends can like and comment on sessions
- Users can also share photos and videos directly to the feed from their profile
- Popularity of posts is determined by likes, comments, and shares
- There is no central authoritative database for climbing — this is community-driven

## Comparable Apps
- **Strava** — social feed, activity cards, stats
- **Kaya** — climbing-specific gym and problem tracking
- **Instagram/TikTok** — social feed, likes, comments, shares

## Design Philosophy
Deadpoint should feel like an outdoor performance lifestyle brand — think Arc'teryx, The North Face, Patagonia. NOT a tech startup or generic fitness app.

Key principles:
- **Premium and minimal** — every element earns its place, no clutter
- **Confident typography** — oversized, bold, editorial. Let the type do the talking
- **White space is intentional** — breathing room makes things feel expensive
- **Warm ink + gold system** — INK near-black for structure, SAND gold for key moments, red ACCENT for likes only
- **Performance meets culture** — this is a lifestyle app for people who take climbing seriously but also care how they look doing it

Design references: Arc'teryx (clean, premium, minimal), Outside Days (bold oversized type), Baggu (editorial white space)

## Design System

### Current Color Palette
```
BG         = '#ffffff'              // Main background — pure white
CARD       = '#f4f1eb'              // Card / input backgrounds — warm cream
SURFACE    = '#ece8df'              // Deeper surface, chip backgrounds
INK        = '#1a1408'              // Primary text + structure (nav, banners, active dots)
INK2       = '#3d3320'              // Secondary text
INK3       = '#8a7a50'              // Muted text, labels, placeholders
SAND       = '#c8a84a'              // PRIMARY ACCENT — grade display, active states,
                                    //   submit buttons, active tab underline, top grade stat,
                                    //   follow buttons, wordmark
SAND_LT    = '#e8c87a'              // Light sand — feed card grade display,
                                    //   avatar initials on dark backgrounds
ACCENT     = '#e8383c'              // Red — ONLY for likes (heart) + peak grade bar on charts
DIVIDER    = 'rgba(26,20,8,0.08)'   // Hairline dividers
```

**SAND usage (the main accent — use for anything that needs emphasis):**
- ✅ Submit / Log Session / Save Changes buttons
- ✅ The Deadpoint wordmark on auth screens
- ✅ Active tab underline (profile tabs + feed "For You" underline)
- ✅ Grade display (big V-scale number on Log / Gym Detail)
- ✅ Top Grade stat value on Profile
- ✅ Follow / Invite Friends button
- ✅ Comment sheet Send button
- ✅ Monthly Volume line chart color
- ✅ Grade Distribution non-peak bars

**ACCENT (red #e8383c) — use sparingly:**
- ✅ Like buttons (heart icon + count) — only place red appears in the UI
- ✅ Peak bar in Grade Distribution chart
- ❌ Everything else → use SAND or INK

### Auth Screens (white background — intentionally different from main app)
- Background: `#ffffff`
- Heading text: INK (`#1a1408`)
- Subtext: INK3 (`#8a7a50`)
- Inputs: CARD (`#f4f1eb`) fill, `borderRadius: 14`, text INK
- Wordmark / accent: SAND (`#c8a84a`)
- Submit button: SAND
- **Brand mark:** both login + signup open with the shared `src/components/AuthBrand.tsx` — the `DEADPOINT` wordmark (SAND, 18px, letterSpacing 4) + a SAND dot-grid motif. ⚠️ NEVER put "DEADPOINT" inside the big 58px heading — at that size it's wider than the screen and **wraps mid-word** (this was the signup bug). The wordmark is its own small mark; the heading is a short two-line phrase ("WELCOME / BACK.", "JOIN / DEADPOINT."). ⚠️ Render each line as its OWN single-line `<Text numberOfLines={1} adjustsFontSizeToFit>` — NOT one `<Text>` with a `\n`. `adjustsFontSizeToFit` + a hard `\n` is buggy on iOS and wraps a word mid-word even when it fits (that was the "WELCOME on two lines" bug). Heading is **52px** (lineHeight 54) so the widest line ("DEADPOINT.") fits at full size on normal phones — both lines stay the same size instead of one auto-shrinking.

### Typography
- **Display / Headings:** `Syne_800ExtraBold` — bold, editorial, tight tracking
  - Screen titles: 42px, letterSpacing: -1.5
  - Auth headings: 52px (lineHeight 54), letterSpacing: -2 — one `<Text numberOfLines={1} adjustsFontSizeToFit>` per line
  - Profile name: 28px, letterSpacing: -1
- **Body / UI:** Space Grotesk family
  - `SpaceGrotesk_700Bold` — gym names, action counts, dates, button labels
  - `SpaceGrotesk_600SemiBold` — subtitles, metadata, descriptions
  - `SpaceGrotesk_500Medium` — form inputs
  - `SpaceGrotesk_400Regular` — body text, notes
  - `SpaceGrotesk_300Light` — back arrow chevron
- Section labels: 9px, SpaceGrotesk_600SemiBold, letterSpacing: 2.5, textTransform: uppercase, INK3 color

### Cards + Inputs
- `borderRadius: 14`, `borderWidth: 0.5`, `borderColor: DIVIDER`
- `backgroundColor: CARD` (`#f4f1eb`)
- Surface blocks (chips, sliders): `borderRadius: 10-14`, `backgroundColor: SURFACE`

### Feed Cards (TikTok full-screen)
Each card fills the entire screen. Two background variants:
- **With media** — full-screen `Image` (photo) or `expo-video` `<VideoView>` (via `VideoBackground`) background
- **Without media** — branded `DefaultCover` (`src/components/DefaultCover.tsx`): warm `#2a2010 → #1a1408` gradient + a centered composition of the climb's **Grade** (big SAND_LT), **Gym** + **Date**, a Deadpoint dot-grid motif, and the `DEADPOINT` wordmark — so a media-less post still feels designed rather than blank

Overlays (all `position: 'absolute'`):
- **Bottom vignette** — `LinearGradient transparent → rgba(0,0,0,0.75)` from 42% down
- **Top tab row** — **Following | For You** at `top: 32` (screen-level overlay, not per-card); active underline in SAND_LT. (Nearby removed — no geo yet.)
- **Right action rail** — avatar, like, comment, share, gym icons stacked on right
- **Bottom-left** — `@username` only (Syne_800ExtraBold, 18px)
- **Stats bar** — `height: 64`, `rgba(0,0,0,0.50)`, pinned to bottom: **left** — top grade in SAND_LT (Syne_800ExtraBold, 28px) + `GRADE` label; **right** — `📍 gymName` in white

### Profile Session Carousel Cards
- `borderRadius: 20`, `backgroundColor: CARD`
- `borderWidth: 0.5`, `borderColor: DIVIDER`
- Width: `SCREEN_WIDTH - 20 - CARD_GAP - CARD_PEEK` (peeks next card in from right)
- **Left column** (top → bottom): top grade in SAND (Syne_800ExtraBold, 28px) → notes in INK3 → hairline divider → gym name (Syne_800ExtraBold) → date (INK3) → dark `▲ VITAL` pill with SAND_LT text
- **Image thumbnail:** 113×150, `borderRadius: 12`, `overflow: 'hidden'`, `resizeMode: 'cover'`

### Buttons
- Submit/CTA: `backgroundColor: SAND`, `borderRadius: 12`, `paddingVertical: 18`, no shadow
- Label: `Syne_800ExtraBold`, 15px, `letterSpacing: -0.3`, `color: '#ffffff'`

### Grade Step-Track Slider
- Track line: `height: 1.5`, `backgroundColor: DIVIDER`
- Inactive dot: `backgroundColor: SURFACE`, `borderWidth: 0.5`, `borderColor: rgba(26,20,8,0.1)`
- Active dot: `backgroundColor: INK`, `borderWidth: 3`, `borderColor: '#ffffff'`
- Active label: SAND color

### Profile Avatar
- **Square** with soft corners: `width: 100, height: 100, borderRadius: 16`
- Edit badge: square `borderRadius: 8`, ACCENT background, bottom-right corner
- Default background: `#2a2010` (warm dark brown)
- Initials color: SAND_LT
- Border: `borderWidth: 3, borderColor: BG` (white ring separating avatar from banner)
- Avatar uploads to Supabase Storage at `{userId}/avatar.jpg` (UNDER the user's own folder, like session media) and `profiles.avatar_url` is updated — propagates to all feed cards. ⚠️ It must live under `{userId}/` because the `session-media` bucket's upload policy is keyed on the first path folder = your user id; a top-level `avatars/` path is rejected (403) → was the silent "profile photo couldn't save".
- ⚠️ The profile screen reads `profiles.avatar_url` from Supabase on focus (SOURCE OF TRUTH); the AsyncStorage cache is only a fast first paint. Earlier the avatar loaded *only* from AsyncStorage, so it vanished on a fresh install / new device even though it was in the DB — fixed by selecting `avatar_url` in the focus fetch and `setAvatarUri(profileRow.avatar_url)`. A failed avatar upload now Alerts instead of silently reverting.

### Profile Banner
- Full-width, height 140, sits at top of profile scroll
- Placeholder: `backgroundColor: INK` (`#1a1408`)
- Camera button (top-right) to change it: `aspect: [3, 1]` crop
- Avatar overlaps banner by 36px (`marginTop: -36`)

## Tech Stack
- **Framework:** React Native with Expo SDK 56
- **Navigation:** expo-router (NOT react-navigation — NEVER use react-navigation)
- **Database:** Supabase (live — `src/lib/supabase.ts`)
- **Auth:** Supabase Auth (live — email/password)
- **Fonts:** `@expo-google-fonts/syne`, `@expo-google-fonts/space-grotesk`
- **Storage:** `@react-native-async-storage/async-storage` (avatar URL cache, banner, photo posts)
- **Media:** `expo-image-picker` (photos and videos)
- **Share card:** `react-native-view-shot` (capture a styled View → image) + `expo-sharing` (native share sheet → Instagram/Messages/Save) + `expo-video-thumbnails` (pull a still frame from a video). All native — need a build (not Expo Go). Powers `ShareCard` / `ShareCardSheet`.
- **Branded video:** a **local Expo native module** at `modules/branded-video` (Swift / AVFoundation) — `BrandedVideo.compose(videoUri, overlayUri)` burns a transparent overlay PNG onto a clip (`AVMutableComposition` + `AVVideoCompositionCoreAnimationTool` + `AVAssetExportSession`, respecting the track's `preferredTransform`) and returns a new mp4. iOS-only; the JS import is null-guarded so Expo Go / unlinked builds fall back. Native code → **only testable on a build**.
- **File I/O:** `expo-file-system/legacy` — MUST use the `/legacy` subpath in SDK 56; `readAsStringAsync` was moved there
- **Base64 decode:** `base64-arraybuffer` — use `decode()` for reliable base64→ArrayBuffer in Hermes (never atob())
- **Charts:** `react-native-chart-kit` + `react-native-svg` — BarChart (Weekly Intensity) and LineChart (Monthly Volume) on Profile. Grade Distribution uses a fully custom View-based bar chart (no chart-kit) to avoid label clipping.
- **Maps:** `react-native-maps` — used on the Gyms tab. Works in Expo Go on iOS (Apple Maps, no API key needed). Do NOT pass `provider={PROVIDER_GOOGLE}` unless a Google Maps API key is configured.
- **Gradients:** `expo-linear-gradient` (feed card photo overlay)
- **Video:** `expo-video` (`useVideoPlayer` + `<VideoView>`) via the shared `src/components/VideoBackground.tsx`. Inline autoplay/loop; only the active feed card (and visible group page) plays. ⚠️ `expo-av` was **removed** — it broke the native iOS build (`EXAV` / `EXEventEmitter.h` symbol errors). Do NOT reintroduce expo-av. Inline video needs a real build (dev build or EAS/TestFlight); in Expo Go it renders but is best verified on a build.
- **Icons:** `@expo/vector-icons` (Ionicons) — installed, works in Expo Go. Used for all tab bar icons and inline icons throughout the app. **Do NOT use `expo-symbols` (SymbolView)** — it requires a dev build and crashes Expo Go.
- **Haptics:** `expo-haptics` — success haptic on log submit + high-point celebration. Always `.catch(() => {})` (no-ops on simulator).
- **Platform:** iOS first (iPhone)

## Supabase Setup
- **Project URL:** stored in `.env` as `EXPO_PUBLIC_SUPABASE_URL`
- **Anon Key:** stored in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `.env` is in `.gitignore` — never commit it
- Client: `src/lib/supabase.ts` — import `{ supabase }` from here in any file that needs the database

### Database Tables (created in Supabase dashboard)
```sql
-- User profiles (linked to Supabase Auth)
profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  username text unique,
  email text,
  avatar_url text,           -- public Supabase Storage URL for profile photo
  bio text,                  -- optional short bio, shown below @username in profile header
  home_gym_id text,          -- the user's home gym (gyms.id); null until set by the picker or inferred
  push_token text,           -- Expo push token for device notifications (src/lib/push.ts)
  created_at timestamp with time zone default now()
)
-- ⚠️ bio + home_gym_id + push_token columns must be added manually if not present:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_gym_id text;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;

-- Climbing sessions
sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),   -- references auth.users, NOT profiles
  gym_id text,
  total_problems int,
  media_url text,            -- public Supabase Storage URL for session photo/video
  notes text,                -- optional description/notes entered on the log screen
  visibility text not null default 'public' check (visibility in ('public','quiet')),
                             -- 'quiet' = only the owner sees it (feed, others' profiles, gym browser)
  feed_rank integer,         -- null = system order; set by "Arrange climbs" to pin page order in a group
  solo boolean not null default false,  -- true = never folded into a same-day group; always its own card
  co_session_id uuid references co_sessions(id),  -- set when combined with a friend's send into a co-session
  created_at timestamp with time zone default now()
)
-- ⚠️ notes / visibility / feed_rank / solo / co_session_id columns must be added manually if not present:
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes text;
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','quiet'));
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS feed_rank integer;
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS solo boolean NOT NULL DEFAULT false;
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS co_session_id uuid REFERENCES co_sessions(id);

-- Co-sessions: two climbers combine their separate sends into one shared post.
co_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now()
)
-- RLS: select public (true); insert own (auth.uid() = created_by).
-- Linking is done by a SECURITY DEFINER RPC (can touch the friend's session row,
-- but only if you own the session you combine FROM):
--   combine_sessions(my_session uuid, other_session uuid) RETURNS uuid
--     → verifies auth.uid() owns my_session, reuses an existing co_session_id on
--       either side or creates one, sets co_session_id on BOTH sessions, returns it.

-- Individual climbs within a session
climbs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  grade text,
  count int,
  problem_id uuid references problems(id),  -- links to a specific problem; null for pre-problems-table sessions
  send_style text                           -- optional: 'flash' | 'send' | 'project'; null = not tagged
    check (send_style in ('flash','send','project'))
)
-- ⚠️ send_style must be added manually if not present:
-- ALTER TABLE climbs ADD COLUMN IF NOT EXISTS send_style text
--   CHECK (send_style IN ('flash','send','project'));
-- 'project' = still being worked → NOT a send. Excluded from Top Grade and the
-- new-high-point celebration everywhere. Flash/Send both count as sends.

-- Climbing problems (community-created, one per distinct climb at a gym)
problems (
  id uuid primary key default gen_random_uuid(),
  gym_id text,                              -- references gyms.id (no FK constraint — consistent with sessions)
  name text not null,                       -- auto-generated: e.g. "Blue V4 Main Wall"
  custom_name text,                         -- optional nickname set by the creator e.g. "The Crimpy Traverse"
  hold_color text not null,                 -- e.g. 'blue', 'red', 'yellow'
  grade text not null,                      -- V-scale: 'V0'–'V10'
  wall_section text,                        -- e.g. 'Main Wall', 'Cave', 'Slab'
  media_url text,                           -- cover photo = media_url of most-liked session for this problem
  start_photo_url text,                     -- first-logger's recognition photo (the start-hold reference image)
  map_x float,                              -- start-hold position on start_photo_url (0–1 proportional)
  map_y float,
  map_wall_id text,                         -- reserved for a future shared wall-coordinate map
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
)
-- RLS policies required:
--   SELECT: public (USING true)
--   INSERT: authenticated (WITH CHECK true)
--   UPDATE: creator only (USING auth.uid() = created_by)

-- Post likes (one row per user-per-session like; unique constraint prevents double-liking)
likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user_id, session_id)
)

-- Follow relationships
follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(follower_id, following_id)
)

-- Session comments
comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
)

-- Analytics events (written by src/lib/analytics.ts track(); read only via
-- dashboard SQL / service role — the app has NO select policy on purpose)
events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,           -- snake_case verb: log_started, log_submitted, …
  props jsonb,                  -- small flat payload, e.g. {"ms": 6200, "mode": "quick"}
  created_at timestamptz not null default now()
)
-- RLS: insert-own only (events_insert_own: auth.uid() = user_id); no select policy.
-- Index: events_name_created_idx on (name, created_at desc).
```

### RLS baseline (deployed and audited 2026-06-15)
Every table has exactly one policy per (table, command), named with the
`*_select` / `*_select_public` / `*_insert_own` / `*_update_own` / `*_delete_own`
convention. The only non-trivial rule is on `sessions` (and `climbs` via a
subquery): **quiet sessions are visible only to their owner.**
```sql
-- sessions
sessions_select       SELECT  USING (visibility = 'public' OR auth.uid() = user_id)
sessions_insert_own   INSERT  WITH CHECK (auth.uid() = user_id)
sessions_update_own   UPDATE  USING (auth.uid() = user_id)
sessions_delete_own   DELETE  USING (auth.uid() = user_id)
-- climbs (visibility inherited from the parent session)
climbs_select         SELECT  USING (EXISTS (SELECT 1 FROM sessions s
                                WHERE s.id = climbs.session_id
                                AND (s.visibility = 'public' OR auth.uid() = s.user_id)))
climbs_insert_own     INSERT  WITH CHECK (EXISTS (SELECT 1 FROM sessions s
                                WHERE s.id = climbs.session_id AND auth.uid() = s.user_id))
-- profiles / problems / likes / follows / comments / gyms
--   *_select_public  SELECT  USING (true)
--   writes constrained to the owner (auth.uid() = user_id / id / follower_id / created_by)
```
⚠️ RLS is the privacy backstop for quiet logging — every "other user's content"
query (feed, `/user/[id]`, gym Current Climbs) relies on it to exclude quiet
sessions server-side. The feed *also* filters in the query for clarity, but
never trust the render layer alone.

### ⚠️ Critical: sessions.user_id → auth.users (NOT profiles)
PostgREST embedded joins (`sessions(profiles(*))`) do NOT work because `sessions.user_id` references `auth.users`, not `profiles`. Always fetch profiles separately:
```ts
// Step 1: fetch sessions
const { data: sessions } = await supabase.from('sessions').select('*, climbs(*)').order('created_at', { ascending: false });

// Step 2: collect unique user IDs
const userIds = [...new Set(sessions.map(s => s.user_id))];

// Step 3: batch-fetch profiles
const { data: profiles } = await supabase.from('profiles')
  .select('id, full_name, username, avatar_url')
  .in('id', userIds);

// Step 4: join in JavaScript
const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
```

### Gyms table
Gym data lives in the `gyms` Supabase table — **never hardcode gym names or IDs** in any file.
Always use the shared helper in `src/lib/gyms.ts`:
```ts
import { fetchGyms, gymName } from '../../lib/gyms';

const gyms = await fetchGyms();          // cached in-process after first call
const name = gymName(gyms, session.gym_id); // sync lookup once gyms are loaded
```

`gyms` table schema:
```sql
gyms (
  id text primary key,              -- '1', '2', '3', '4'
  name text not null,               -- 'Vital Climbing LES'
  address text,                     -- '61 Chrystie St, New York, NY 10002'
  neighborhood text,                -- 'Lower East Side'
  city text default 'NYC',
  latitude double precision,        -- used by the map on the Gyms tab
  longitude double precision,
  image_url text,                   -- optional hero/background photo for the gym card (customizable per row)
  created_at timestamp with time zone default now()
)
-- ⚠️ image_url is optional; `fetchGyms` uses select('*') so the app works with or
-- without it. Add it with: ALTER TABLE gyms ADD COLUMN IF NOT EXISTS image_url text;
-- Gym card photos are data-driven (NEVER hardcode image URLs in code).
-- RLS: publicly readable (no auth required)
```

Current rows (ids 1–4, all Vital Climbing NYC locations):

| id | name | neighborhood | lat | lng |
|----|------|-------------|-----|-----|
| 1 | Vital Climbing LES | Lower East Side | 40.7157 | -73.9952 |
| 2 | Vital Climbing Brooklyn | Williamsburg | 40.7057 | -73.9490 |
| 3 | Vital Climbing UES | Upper East Side | 40.7694 | -73.9547 |
| 4 | Vital Climbing UWS | Upper West Side | 40.7831 | -73.9712 |

### ✅ Adding a new gym
To add a new gym to the app, simply insert a row
into the `gyms` Supabase table with:
  - id (next available string integer e.g. '5')
  - name
  - address
  - neighborhood
  - city
  - latitude
  - longitude

The map, the gym list, the log screen dropdown,
and the explore suggestions all source from
fetchGyms() — they pick up new gyms automatically.
No code changes. No redeployment needed.

### Storage bucket
`session-media` (public) — stores:
- Session media: `{userId}/{timestamp}.ext`
- Profile avatars: `{userId}/avatar.jpg` and banners: `{userId}/banner.jpg` (under the user's own folder so they pass the bucket's per-user upload policy; stable name + upsert → self-overwrites)

⚠️ **Bucket settings gate video uploads.** The `session-media` bucket has a
**file size limit** and an optional **allowed-MIME-types** list. Photos are a few
MB and sail through; iPhone videos are 50–300 MB and get **rejected (HTTP 413)**
if the limit is too low, or **400** if `video/mp4` / `video/quicktime` aren't in
the allowed list. A rejected upload leaves `media_url` null → the feed card shows
the blank dark gradient ("no media at all"). Fix in Supabase → Storage →
`session-media` → Edit bucket: raise the **file size limit** (e.g. 500 MB) and set
allowed MIME types to include `image/*` + `video/*` (or leave unrestricted). This
is a dashboard change — no rebuild needed. `uploadFileToStorage` now returns
`{ url, error }` and `send.tsx` Alerts the failure reason instead of failing silently.

### ⚠️ Media Upload Pattern (React Native)
**NEVER use fetch+blob or FormData** (fail for local URIs), and **do NOT use the
old base64 → ArrayBuffer → `supabase.storage.upload()` path** — it reads the whole
file into JS memory and **fails for videos** (and is flaky for images in Hermes),
which caused empty `media_url`s and reverting avatars/banners on the first device build.
**Always stream the file with `FileSystem.uploadAsync` (BINARY_CONTENT)** via the
shared `uploadFileToStorage(localUri, path, contentType)` helper in `src/lib/store.ts`:
```ts
import * as FileSystem from 'expo-file-system/legacy';
const res = await FileSystem.uploadAsync(
  `${SUPABASE_URL}/storage/v1/object/session-media/${path}`,
  localUri,
  { httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${userAccessToken}`, apikey: SUPABASE_ANON_KEY,
               'Content-Type': contentType, 'x-upsert': 'true' } },
);
// res.status 200 = ok → supabase.storage.from('session-media').getPublicUrl(path)
```
- `uploadSessionMedia` namespaces by `{userId}/{ts}.{ext}` — videos **must** keep a
  real video extension (`mp4`/`mov`/…) so the feed's `/\.(mp4|mov|m4v|avi)$/i` sniff
  detects them. `uploadProfileAvatar` / `uploadProfileBanner` use stable paths
  **under the user's own folder** (`{userId}/avatar.jpg` / `{userId}/banner.jpg`) so
  they pass the bucket's per-user upload policy (a top-level `avatars/`/`banners/`
  path 403s), + append `?v=<ts>` to bust the image cache. `uploadProfileAvatar`
  returns `{ url, error }` so the profile screen Alerts the real failure reason.
  Banner persists its **public URL** in AsyncStorage (never the transient local file URI).

## App Structure

### Auth Flow
- Unauthenticated → `/auth/login`
- Authenticated, intro not yet seen → `/onboarding` (3-card intro, once per install)
- Authenticated, intro seen → `/(tabs)`
- Auth state managed in `src/app/_layout.tsx` via `supabase.auth.onAuthStateChange`
- Root layout also calls `getUser()` to verify session validity on startup; signs out if stale
- **Onboarding gate** (`src/app/_layout.tsx` + `src/app/onboarding.tsx` + `src/lib/onboarding.ts`): the root layout reads a `hasSeenOnboarding` AsyncStorage flag into `seenOnboarding` state (null = still loading → don't redirect yet, so the feed never flashes). The redirect effect: not-logged-in → `/auth/login`; logged-in + `!seen` → `/onboarding`; logged-in + `seen` + (in auth or onboarding) → `/(tabs)`. The intro shows AFTER auth, never before. ⚠️ Completion calls `markSeen()` from `OnboardingContext` (provided by `_layout`, owns the flag) — it flips the **in-memory** flag AND persists to AsyncStorage. The in-memory update is essential: without it the redirect would still see `false` after "Get started" and **bounce the user straight back to `/onboarding`**. `onboarding` is registered in the root Stack with `gestureEnabled:false` (can't swipe back to auth).

### Route Structure
```
src/app/
  _layout.tsx          — Root layout: font loading, auth state, onboarding gate, redirect logic
  onboarding.tsx       — 3-card swipeable intro (post-auth, once per install). See "Auth Flow"
  auth/
    _layout.tsx        — Auth stack (fade animation)
    login.tsx          — Email + password login
    signup.tsx         — Full name, username, email, password sign up
  (tabs)/
    _layout.tsx        — Tab bar (Feed, Gyms, Explore, Log, Profile) — uses Ionicons
    index.tsx          — Feed screen
    gyms.tsx           — Gyms list
    explore.tsx        — Explore / find climbers
    log.tsx            — Screen 1 of 3-screen log flow (Identify Your Climb)
    profile.tsx        — User profile
  gym/
    [id]/
      _layout.tsx      — Stack layout for gym screens
      index.tsx        — Gym detail (three tabs: Log a Climb info + Current Climbs browser + The Scene leaderboard)
      log.tsx          — Screen 1 of 3-screen log flow (gymId pre-filled from route)
  log-flow/
    _layout.tsx        — Stack layout for Screens 2 & 3 (slide_from_right animation)
    match.tsx          — Screen 2: Is This Your Climb (matched problem cards)
    send.tsx           — Screen 3: Log Your Send (grade, media, notes, submit)
  session/
    [id].tsx           — Full-screen feed card modal for a single session
                         (presented as fullScreenModal, slides up over profile)
  user/
    [id].tsx           — View-only profile page for other users
  notifications.tsx    — In-app activity inbox (likes / comments / new followers on YOUR content)
```

### ⚠️ Register every off-`(tabs)` route in the root Stack
`src/app/_layout.tsx` renders a `<Stack>` with an explicit `<Stack.Screen>` for
each off-tab route (`(tabs)`, `auth`, `gym/[id]`, `log-flow`, `user/[id]`,
`session/[id]`, `notifications`). When you add a NEW dynamic route, you MUST add a matching
`<Stack.Screen name="..." />` here — otherwise `router.push` to it silently
no-ops. (This was the cause of the username-tap navigation bug: `user/[id]`
existed as a file but was never registered, so every push to it did nothing.)

### Canonical profile navigation
There is exactly ONE other-user profile route: `/user/[id]`. Convention for
tapping any username/avatar: **own → `/(tabs)/profile`**, **other → `/user/[id]`**.
Every username/avatar in the app follows this — feed cards, comment rows,
followers/following sheets, the in-feed CLIMBERS-AT-gym suggestion card, explore
search/suggestion rows, and the session detail screen. Wrap avatar + name in one
`Pressable`/`TouchableOpacity` with `hitSlop` so small text is comfortably tappable.

### Key Source Files
```
src/lib/
  supabase.ts          — Supabase client (import this everywhere)
  store.ts             — AsyncStorage helpers, media upload, avatar upload. Post type includes climbNickname (problems.custom_name) and climbNotes (sessions.notes)
  gyms.ts              — fetchGyms() + gymName() helper; in-process cache; SINGLE SOURCE OF TRUTH for gym data
  holdDetection.ts     — On-device hold color work. `detectHolds(uri, color)`: downscale to max 480px wide PNG via expo-image-manipulator, decode PNG binary, pako.inflate IDAT, reconstruct filter bytes, HSL color range matching (red hue wraps 345–15), flood-fill cluster detection (≥0.15% of pixels), one relaxed-bounds retry, 4s timeout → BoundingBox[] (0–1). ⚠️ Whole-image detection is unreliable on real photos (best-effort only). `sampleHoldColor(uri, x, y)`: the RELIABLE one — reads the colour at ONE known point (the marked start hold): resize once for dependable dims (NOT `Image.getSize`, which is flaky for local `file://` URIs and silently bailed the whole sample → the chip never auto-picked), crop a small window (~9%) centred on the point, vote its pixels against the colour ranges (winner needs ≥10% share) → best hold-colour id or null. Powers start-hold → auto-colour-chip.
  homeGym.ts           — syncHomeGymAfterSubmit(userId, justLoggedGymId): silent home-gym inference. Sets profiles.home_gym_id to the just-logged gym when null; from the 3rd session onward syncs to the most-logged gym (only writes if the leader differs). Best-effort, swallows errors. Called post-submit in send.tsx.
  onboarding.ts        — Onboarding intro context + `ONBOARDING_KEY` ('hasSeenOnboarding'). `OnboardingContext` exposes `markSeen()` (provided by `_layout`, which owns the flag state); `useOnboarding()` hook. The flag state lives in `_layout` so the post-auth redirect can read it; the context only hands `markSeen` down to `onboarding.tsx`. See "Auth Flow".
  push.ts              — `registerForPushNotifications(userId)`: requests notification permission, gets the Expo push token (`getExpoPushTokenAsync` with the EAS projectId), upserts it to `profiles.push_token`. Sets the foreground notification handler. Best-effort, no-ops on simulators / when denied. Called from `_layout.tsx` on auth; taps are deep-linked in `_layout`. Server sender = `supabase/functions/notify`. See "Device push notifications".
  stats.ts             — Pure, unit-testable progress helpers: gradeValue, highestGrade, isNewHighPoint, monthStats, weekStreak. All date math is LOCAL time; weekStreak gives the in-progress current week a one-week grace so a streak isn't shown broken mid-week. No Supabase, no React.
  analytics.ts         — `track(name, props?)`: fire-and-forget event instrumentation → the `events` Supabase table (insert-own RLS; the app never reads it — dashboards query it in SQL with the service role). Never throws/blocks; silently no-ops signed-out or offline. Naming: snake_case verbs (log_started, log_submitted, log_abandoned…). Powers the "median log time" metric + funnels.
  pendingLogs.ts       — Offline log queue: `queuePendingLog()` stores a failed submit's fields (+ best-effort local media URI) in AsyncStorage; `drainPendingLogs()` (called on feed focus + composer mount, re-entrancy-guarded) posts them oldest-first, preserving the original `created_at` on the session row, and removes each only after both inserts land. New-problem logs are never queued (the composer keeps the form open instead).
  constants.ts         — OFFICIAL_ACCOUNT_ID (string | null). When non-null, signup creates an auto-follow to it; currently null (no auto-follow). The follow is ordinary and unfollowable.
  groupPosts.ts        — Pure render-time feed fold: groupPosts(posts) → (Post | GroupedPost)[]. Groups same user_id + gym_id + LOCAL day; cover = hardest grade, pages = cover-first or feed_rank order. See "Feed Session Grouping".
src/components/
  ProblemCard.tsx      — Reusable full-bleed problem card (media bg or dark gradient, grade in SAND_LT, hold color dot, wall section, name, custom_name). When the problem has start_photo_url + map_x/map_y, shows THAT photo with a SAND start-hold ring + "START" tag (so same-colour problems are distinguishable). Used in log-flow/match.tsx and gym Current Climbs browser.
  ClimbReel.tsx        — Full-screen, vertically-swipeable immersive viewer for ONE grade's logged climbs at a gym ("B" of the Current Climbs "A then B"). Opened by tapping a card in the Current Climbs 2-up grid; paged FlatList over the grade's sessions seeded at the tapped one. Each page = full-bleed media (video autoplays only on the active page via the shared VideoBackground; photo; or warm gradient when media-less) + scrim + grade/@handle/date overlay + ♥ count. Tap a card → `/session/[id]` for full likes/comments/share. Read-only browse/watch surface (no like/comment mutation here). Close + (video) mute in the top bar.
  ClimbDatePicker.tsx  — Zero-dependency month-calendar bottom sheet (exports ClimbDatePicker + climbDayKey). Days with climbs are SAND-dotted/tappable; used by My Climbs + /user/[id] date filtering.
  ClimbThumb.tsx       — Cover thumbnail for a climb card in the My Climbs + /user/[id] grids. Handles all 3 media cases so a card is NEVER blank: photo → `<Image>`; **video → a frame grabbed with `expo-video-thumbnails` (cached per URL) + a ▶ badge** (a grade placeholder shows while it generates / if it fails); no media → 🧗. ⚠️ Fixes the bug where video climbs showed no cover (a grid `<Image>` can't render a video URL). Server-side posters at upload would be the longer-term fix.
  VideoBackground.tsx  — Inline full-bleed video via expo-video (useVideoPlayer + VideoView). Mounted only for video posts; autoplays/loops while isActive, pauses otherwise. ⚠️ **Off-screen audio is killed inside `VideoBackground` itself:** an inactive card is BOTH paused AND **force-muted** (`player.muted = muted || !isActive`), and the player is paused + muted on the unmount cleanup. This is because expo-video's `player.pause()` alone did **NOT** reliably silence a scrolled-away card in the production build — its audio kept playing under the next card (the "audio keeps playing after you scroll" bug). FlatLists of video cards (feed, GroupedCard pages, ClimbReel) still set `extraData` (active index + mute) so scrolled-away cells re-render and flip `isActive`→false — necessary, but the force-mute is the actual guarantee (the earlier `extraData`-only fix shipped in build #22 and still leaked audio). ⚠️ **Blur is a separate trigger from scroll-away:** PUSHING a route over a video surface (the + log composer over the feed, a gym/profile over `session/[id]`, `/session/[id]` over `ClimbReel`) does NOT unmount or scroll it — every video surface must ALSO gate `isActive` on screen focus: the feed + `session/[id]` + `gym/[id]` keep a `screenFocused` state set/cleared in `useFocusEffect` (cleanup = blur) and include it in `isActive` (+ `extraData`); `ClimbReel` takes a `suspended` prop (the gym screen passes `!screenFocused`) because the reel is a Modal that stays mounted under pushed routes. This was the "audio keeps playing when I tap the + button" bug in build #24. Takes a `muted` prop (player.muted) and a `rate` prop (player.playbackRate; default 1 — `preservesPitch` defaults true so 2× audio stays natural-pitched). Used by the feed FullScreenCard (+ group pages), session/[id], AND the send-screen video cover preview (isActive=false → shows the paused first frame). **Tap-to-mute:** a tap anywhere on a video card toggles sound; the feed holds one global `videoMuted` (TikTok-style, persists across cards), session/[id] holds its own. A speaker badge (volume-high/volume-mute Ionicon) shows the state. Default = sound ON. **Hold-to-speed (feed only):** press-and-hold a video card boosts it to 2× via the `rate` prop while held; releasing restores 1×. Implemented in the feed `FullScreenCard` — the tap layer is a `Pressable` (onPress=mute, onLongPress[delay 180ms]=`setBoosting(true)`, onPressOut=`setBoosting(false)`); a long press doesn't also fire the tap, so holding never toggles mute. A centred `2×` badge shows while held.
  StartHoldPicker.tsx  — Full-screen pinch-to-zoom + pan modal for marking a climb's starting hold. Native iOS-zoomable ScrollView (maximumZoomScale/pinchGestureEnabled). ⚠️ Tap detection uses **raw `onTouchStart`/`onTouchEnd` on the content rect**, NOT a `Pressable` — a Pressable's `onPress` is swallowed by the ScrollView's zoom/pan gestures (that was the "tapping the start hold does nothing" bug). We track the touch and only place the hold on a clean single-finger tap (skip if it went multi-touch=pinch or moved >14px=pan). `locationX/Y` are relative to the content rect → zoom-invariant → map straight to 0–1 proportional coords, snapped to the nearest detected hold box. Shared by both Screen-1 log entries ((tabs)/log.tsx + gym/[id]/log.tsx).
  DefaultCover.tsx     — Branded fallback "cover" for a media-less climb: warm ink gradient + centered Grade / Gym / Date + Deadpoint dot-grid motif + wordmark. Full-bleed (absoluteFill); the card's own overlays render on top. Used by the feed FullScreenCard and session/[id] no-media branch.
  ShareCard.tsx        — The Strava-style branded share card (portrait 4:5): the climb's still as hero + ink scrim + Deadpoint dot-motif/wordmark + big Grade / Gym / Date. forwardRef → the root View is captured by react-native-view-shot. Pure visual; takes a `stillUri` (null → branded gradient).
  BrandedVideoOverlay.tsx — The TRANSPARENT version of the card (scrim + Grade/Gym/Date + Deadpoint mark, no opaque bg), rendered at the video's aspect and captured as a PNG (alpha) → fed to the `BrandedVideo` native module to burn onto the clip. forwardRef for capture.
  ShareCardSheet.tsx   — Full-screen preview + share flow. **Image** post → the photo is the hero. **Video** post → samples ~6 frames across the clip (`expo-video-thumbnails.getThumbnailAsync` at fixed times; out-of-range times drop) into an Instagram-style **cover filmstrip** — tap a frame to set the card's still. Share options for video: **Share branded video** (primary when the `BrandedVideo` native module is linked — captures `BrandedVideoOverlay` PNG, downloads the clip, `BrandedVideo.compose` burns the overlay on, shares the mp4), **Share as card** (the still), **Share full video** (raw clip). **Media-less** → branded card. `Image.prefetch`es remote stills so the capture isn't blank; "Share card" does `captureRef` → `expo-sharing.shareAsync` (IG story/feed, Messages, Save to Photos…). Opened from the feed + session-detail share buttons via a `ShareInput`.
  MentionText.tsx      — Renders a notes string with `@username` tokens as tappable links → resolves the handle to profiles.id on tap and routes to /(tabs)/profile (self) or /user/[id] (other). Plain "tag in the description" — no table; the handle is just typed into sessions.notes. Used by the feed card + session/[id] notes.
  GymLeaderboard.tsx   — "The Scene" tab on the gym page: this-week leaderboard (Sends / Top-grade toggle) + recent-sends strip + an **all-time "All Climbers" roster** (everyone who's ever logged here, ranked by total sends; beta feedback "see all climbers in a gym"). One all-time query feeds all three (week board = client-filtered to this week; roster = all-time). Quiet-week → the board collapses to a one-line note but the roster still shows. Pure render from sessions/climbs/profiles (public, non-project). No schema. Restrained styling: flat hairline-separated rows (no card box), soft-square avatar chips, #1 rank + value in SAND, and the right-hand value is the active ranking metric (send count or top grade) with the secondary metric under the name.
  AuthBrand.tsx        — Shared DEADPOINT wordmark + dot-grid motif at the top of login + signup. Keeps the brand out of the big heading (where it wrapped mid-word).
src/app/
  notifications.tsx    — In-app activity inbox. NO notifications table — derived live from existing data: likes/comments on the user's sessions + follows where following_id = me, merged + sorted newest-first. Each row: actor avatar/name (→ profile) + message + timestamp; like/comment rows show a post thumbnail (→ /session/[id], video posts show a ▶ placeholder), follow rows show a Follow-back toggle. Opening it stamps `NOTIF_LAST_SEEN_KEY` (AsyncStorage). The Profile header bell shows a SAND unread dot when the latest activity is newer than that stamp (computed in a lightweight 3×limit-1 focus query).
  SplashGate.tsx       — Animated "two doors" launch overlay. The screen is the Deadpoint speckled gold-dot pattern (a jittered grid of SAND/SAND_LT rounded dots, via react-native-svg) on #0d0a05 that softly **clears toward the centre** (radial opacity fade in `buildField`) where the **real `icon.png` logo** sits — so the logo matches the app icon exactly and the bright field never collides with it as a hard square. Holds briefly, then two panels each carrying their half of the speckle + logo slide apart to reveal the app, then unmounts. The field is generated once (memoised) and both doors render the identical SVG clipped to their half, so the seam is seamless when closed. Sits under the static native splash so there's no flash. Rendered once at root (_layout.tsx). Dial knobs: `SPACING`, dot size/opacity, and the `clear`/`full` fade radii.
```

### 5 Main Tabs
1. **Feed** — TikTok-style full-screen vertical swipeable feed. Each session card fills the entire content area (measured via `onLayout` — window height minus status bar and tab bar). Swipe up/down with `FlatList pagingEnabled + snapToInterval`. Sessions fetched from Supabase (top 50, `created_at` desc) and shown **most-recent-first** — both the For You and Following tabs are purely chronological, so a fresh post leads (when you log, your climb is at the top). `onViewableItemsChanged` (stable ref) tracks the active card index for video autoplay. Cards with media_url show a full-screen photo/video background; cards without show a warm dark gradient (`#2a2010 → #1a1408`). Bottom vignette gradient for readability. Likes and comments are Supabase-backed. **Video autoplays inline via `expo-video`** (`<VideoBackground>`), playing only on the active card. The feed also hosts the **zero-onboarding first-run cards** — see "Feed First-Run Cards" below.
2. **Gyms** — leads with a **"YOUR GYM · THE SCENE" hero card** (INK card; shown when `profiles.home_gym_id` is set) → tap goes straight to your home gym's detail, which opens on **The Scene** (so the local leaderboard/FOMO is ~1 tap from the Gyms tab — beta strategy). Below it: an interactive `react-native-maps` map (warm custom style, SAND dot markers, Callout popups) above a scrollable gym list. Map + list driven live from the `gyms` Supabase table via `fetchGyms()`. Tapping a marker shows a Callout ("View Gym →"); tapping a list card animates the map + navigates to `/gym/[id]`. Visited gyms highlighted in the list. Map height: `max(170, screenHeight * 0.26)`.
3. **Explore** — Find and follow other climbers. See Explore tab section below.
4. **Log** — 3-screen flow for identifying and logging a climb. See 3-Screen Log Flow section below.
5. **Profile** — Fixed title header ("Profile" + `+` share button + gear icon). Fixed 3-tab bar (Overview / My Climbs / Settings) below it. The rest of the page scrolls as one unit.
   - **Overview tab** — Stats bar (Total Climbs · Gyms Visited · Top Grade) pinned directly below the tab bar (white BG, hairline bottom border), then a **PROGRESS** card (between Weekly Intensity and Grade Distribution), then 3 interactive chart cards (Weekly Intensity, Grade Distribution, Monthly Volume) scrolling below. Stats bar is hidden on My Climbs and Settings tabs.
     - **PROGRESS section** (own profile only — lives in `(tabs)/profile.tsx`, never on `/user/[id]`): a single row of 3 stat blocks — **This month** (sends + distinct days climbed), **High point** (hardest grade in the reused grade-chip style), **Streak** (consecutive Mon–Sun weeks; shows "Log a climb every week to build a streak" when 0–1 instead of a sad zero). All derived client-side from the user's sessions via pure helpers in `src/lib/stats.ts` — no schema, no extra query.
   - **My Climbs tab** — grade-grouped 3-column grid with a grade step-slider and sort dropdown. See My Climbs section below for full detail.
   - **Settings tab** — Edit Profile form (Full Name, Username, Bio inputs pre-filled from Supabase; Save Changes button in ACCENT pink; bio display in header only updates after a successful save). Log Out button (outlined red `#e53935`, confirmation alert before signing out).
   - Banner (tappable, persisted via AsyncStorage) + square avatar (tappable, uploads to Supabase Storage + updates `profiles.avatar_url`) scroll with the page above the tab bar.
   - Bio displayed below `@username` in the identity row (INK3, 14px, SpaceGrotesk_400Regular) — only rendered when non-empty.
   - Stats bar fetched live from Supabase on every focus; rendered conditionally (`activeTab === 'overview'`).
   - **Invite Friends** button (SAND outline) on the identity row — triggers `Share.share()` with an invite message.
   - **Follower / following counts** row below the identity block — tapping "followers" or "following" opens a bottom-sheet Modal listing those users.
   - **Followers sheet** — avatar + name/username list; no action buttons. Each row is tappable: closes the sheet and navigates to that user's profile (`/(tabs)/profile` for self, `/user/[id]` for others).
   - **Following sheet** — same list with an "Unfollow" button per row; optimistic: removes row and decrements count immediately. Each row is also tappable (same nav logic as followers sheet); Unfollow button tap does not bubble to the row.

### Feed Card Layout (TikTok-style full-screen)
Each card is a `View` sized `{ width: SCREEN_WIDTH, height: cardHeight }` with all overlays `position: 'absolute'`:

- **Background** — full-screen `Image` (photo) or inline video via `<VideoBackground>` (expo-video, autoplays/loops while `isActive`) for media sessions; `LinearGradient '#2a2010 → #1a1408'` for sessions without media. **Media type is sniffed from the URL extension** — `sessions` has no `media_type` column, so `fetchSessionPosts` tests `media_url` against `/\.(mp4|mov|m4v|avi)$/i` to decide `type: 'video'` vs `'image'` (same regex as `session/[id].tsx`). ⚠️ This is a workaround; the proper fix is a `media_type` column on `sessions` set at upload time.
- **Bottom vignette** — `LinearGradient transparent → rgba(0,0,0,0.75)` from 42% down, `pointerEvents="none"`.
- **Top tab row** — now a **screen-level overlay** (`absolute, top: 32`) rendered once by `FeedScreen` over the FlatList, NOT inside each card (so it's visible even on grouped carousels). Two tabs: **Following** | **For You** (active = 17px white bold + SAND_LT 2.5px underline; inactive = 16px `rgba(255,255,255,0.55)`). `feedTab` state drives both the active styling and the feed filter: **Following** filters `posts` to `followingSet`; **For You** shows all. Switching tabs resets to the top (`scrollToOffset 0`). First-run cards + the CLIMBERS suggestion card only appear on For You. An empty Following tab renders `FollowingEmptyCard` (→ Explore / For You). Shown only when `posts.length > 0`. (Nearby removed — no geolocation yet.)
- **Right action rail** — `absolute, right: 12, bottom: STATS_BAR_H + 20`. Five items stacked with `gap: 22`:
  1. Avatar circle (50px, white ring border, `overflow: hidden`) — follow/profile behaviour (see Feed Card Tap-Through below)
  2. Heart `♥/♡` + like count → `onLike` (filled ACCENT when liked)
  3. `◎` + comment count → `onComment` (opens comment sheet)
  4. `↗` + "share" label → `Share.share()` native sheet
  5. `⬡` + "gym" label → `router.push('/gym/[gymId]')`
- **Bottom-left info** — `absolute, left: 16, right: 80, bottom: STATS_BAR_H + 16`, `gap: 2`. Shows `@username` (Syne_800ExtraBold, white) — tappable, navigates to that user's profile. Below username: `climbNickname` (SAND_LT, SpaceGrotesk_600SemiBold, 13px) if set; then `climbNotes` (white 75% opacity, SpaceGrotesk_400Regular, 12px, max 2 lines) if set.
- **Stats bar** — `absolute, bottom: 0`, full width, `height: 64`, `backgroundColor: rgba(0,0,0,0.50)`. Two sections separated by a hairline divider: **left** — grade in SAND_LT (Syne_800ExtraBold, 28px) + `GRADE` label (8px muted white); **right** — `📍  gymName` in white (16px SpaceGrotesk_600SemiBold, `numberOfLines={1}`).

### Feed Search
- Search bar was removed from the Feed in the TikTok rewrite. Lives in Explore tab (Phase 2 plan).

### Feed Card Tap-Through
- **Right rail avatar tap logic:**
  - Own post → navigates to `/(tabs)/profile` (no label shown under avatar)
  - Other user, not yet following → follows them (optimistic, writes to `follows` table) + 😊 emoji fades in/out over 1 second on the avatar; "follow" label shown below avatar
  - Other user, already following → navigates to `/user/[id]`; no label shown under avatar
- **Bottom-left `@username`** — always tappable; own post → `/(tabs)/profile`, other → `/user/[id]`.
- Follow state is fetched on feed load in parallel with likes/comments (queries `follows` where `follower_id = currentUserId`); stored as `followingSet: Set<string>` in screen state.
- `post.userId` is set from `session.user_id` in `fetchSessionPosts` and stored as `userId?: string` on the `Post` type in `store.ts`.

### Feed First-Run Cards (zero-onboarding personalization)
Beyond the one-time intro cards (`/onboarding`, shown once per install right after auth — see "Auth Flow"), there is NO in-feed onboarding gating: a new user lands directly in the feed and is personalized inline. The feed renders a single `FeedItem[]` list (a discriminated union: `post` | `gymPicker` | `gymConfirm` | `suggestions` | `empty`). All first-run cards are **full-height items in the same snap FlatList**, so vertical snap behaviour is identical for every item. The whole load is wrapped so any failed query shows a quiet inline retry card (`FeedErrorCard`), never a blank/crashed screen.
- **Gym picker** (`gymPicker`) — first item while `home_gym_id` is null: "YOUR GYM" label + "Where do you climb?" (SAND on INK) + gym chips (name + neighborhood) from `fetchGyms()`. Tapping a chip writes `profiles.home_gym_id`.
- **Confirmation** (`gymConfirm`) — replaces the picker in place after a selection ("{gym} set as your gym…", taps to `/gym/[id]`). Driven by transient `gymJustSet` state; cleared on the next feed refresh and never returns.
- **Suggestions** (`suggestions`) — injected after the 3rd post ONLY when `home_gym_id` is set AND the user follows < 3 people AND another profile shares their home gym. Horizontal row of avatar + @username + Follow button; reuses the feed's own `handleFollowToggle` mutation (never duplicated). Dismissible ✕.
- **Empty** (`empty`) — when there are no public sessions: "QUIET IN HERE / No sends yet." + SAND "LOG A SEND" CTA → Log tab, plus a "Meanwhile, on the wall at {gym}" link when the home gym has catalog problems. Picker shows above it when applicable.
- **Dismissals** (picker ✕, suggestions ✕) persist **for the app session only** via module-level flags in `index.tsx` (not state) — they survive tab switches/refreshes but reset on next launch, reappearing until a gym is set/inferred.
- Home gym is also inferred silently on log submit — see `src/lib/homeGym.ts`.

### Quiet Logging (`visibility`)
A session is `'public'` (everyone) or `'quiet'` (only the owner). Quiet still
counts in the owner's own stats, charts, streak and high-point — it's hidden
only from *other* people.
- **On log** (`log-flow/send.tsx`) — a toggle below Notes: `SHARE TO FEED` +
  `eye-outline` (SAND) + hint "Posts to your feed for everyone to see" when
  public; `ONLY YOU` + `eye-off-outline` (INK3) + hint "Logged to your climbs —
  not shared to the feed" when quiet. The explicit copy makes the
  logging-is-posting relationship clear (beta feedback: feed vs logged confusion).
  Defaults to Public every launch (`useState(true)`). Submit inserts `visibility`
  + `feed_rank: null`. (The My Climbs tab also shows a one-line explainer: public
  climbs appear on your feed, "Only You" climbs don't.)
- **After the fact** — own session cards (feed `FullScreenCard`, grouped pages,
  and `session/[id]`) show an `ellipsis-vertical` overflow → bottom sheet
  ("Make quiet"/"Make public") → **confirm step** → updates `sessions.visibility`.
  `created_at` is untouched, so re-publicising never bumps the post; likes and
  comments are preserved. Own quiet posts show an `ONLY YOU` badge; quiet
  My-Climbs cards show an `eye-off-outline` badge.
- **Cover photos** — after every submit AND after every visibility toggle, call
  `supabase.rpc('recompute_problem_cover', { problem_id })`. The SECURITY DEFINER
  function picks the most-liked **public** session's media, so a quiet send can
  never be a problem's cover.
- **The visibility filter lives in the QUERY, never the render layer.** The feed
  query adds `.or('visibility.eq.public,user_id.eq.<uid>')`; all other
  "other-user" reads rely on the RLS baseline above. See "RLS baseline".

### Feed Session Grouping (`src/lib/groupPosts.ts`)
`groupPosts(posts)` is a **pure render-time fold** — no DB change, no delayed
posting. Posts hit the feed instantly and are only *visually* clustered.
- **Group key** = same `user_id` + same `gym_id` + same **LOCAL** calendar day.
  Members need NOT be adjacent. Grouping can't cross the feed's two ordering
  segments (followed-first vs. by-likes) because every one of a user's posts is
  in exactly one segment — so it runs on the concatenated, already-ordered list
  and leaves ordering untouched. A group sits at its **most-recent member's** slot.
- **Cover** = hardest grade (`gradeValue` from `stats.ts`); ties → most recent.
  **Pages** = cover first, then oldest → newest — UNLESS any member has
  `feed_rank` set, in which case ALL pages order by `feed_rank` asc, nulls last.
- **Single-member groups render as a normal post** (zero visual change).
- **Solo opt-out** (`sessions.solo`) — a session with `solo = true` gets a unique
  group key, so it's always its own card even if it shares a day/gym. Set it at
  log time ("Post on its own" toggle in `send.tsx`), via a grouped card's
  overflow ("Post separately" → `solo = true`), or undo it ("Add back to the
  group" → `solo = false`, shown only when a groupable same-day sibling exists).
- **Render** (`GroupedCard` in `index.tsx`) — a horizontal `FlatList`
  (`pagingEnabled`, `directionalLockEnabled`) of full `FullScreenCard` pages
  (`inGroup` hides the top tabs + duplicate username). Group header
  (`@user · N climbs at gym`), SAND/INK3 page dots, `+N more` on the cover only.
  Per-page likes/comments/stats are independent (each page is its own session).
  Video plays only on the visible page of the active card
  (`isActive && index === activePage`). First-run cards are never grouped.
- **Arrange climbs** — own grouped cards' overflow adds "Arrange climbs" → a
  sheet with up/down chevrons → writes `feed_rank 0..n-1`; "Reset to default"
  nulls every member's `feed_rank`. The feed reloads so `groupPosts` re-orders.
- **Co-sessions** (combine across users) — when two climbers combine their
  separate sends, both sessions share a `co_session_id`. `groupKeyFor` returns
  `co|<id>` for those (overriding solo + the user/gym/day key), so they fold into
  ONE card **across users + across day/gym**. `isCoSession(group)` (groupKey starts
  with `co|`) drives the multi-name header (`@a + @b · co-session · N climbs`) and
  keeps each page's own username visible (`inGroup={!co}`). Each page is still its
  own session (independent likes/comments/owner in the rail). The combine action
  lives on the session detail overflow — see "Session Detail Screen".

### Explore Tab (`/explore`)
- "EXPLORE" header (Syne_800ExtraBold), SURFACE search bar with Ionicons `search-outline` icon
- **Search** — placeholder "Search climbers & gyms...". TextInput debounced 350ms for climbers; gyms filtered instantly from `fetchGyms()` cache. Results show when query is non-empty.
- **Gym search** — matches gym `name`, `neighborhood`, or `city` client-side. Results shown in a **GYMS** section above climbers. Each gym row: SAND location-pin icon in a CARD square, gym name (Syne_800ExtraBold) + neighborhood (SpaceGrotesk_600SemiBold, INK3), chevron. Tapping navigates to `/gym/[id]`.
- **Climber search** — queries `profiles` with `.or('username.ilike,full_name.ilike')`; filters out current user. Shown in a **CLIMBERS** section below gyms.
- **Empty search state** — bold `"Send It."` tagline (38px Syne_800ExtraBold) + subline `"Find your people. Discover your next project."` above the suggested climbers list. No section label shown.
- **Suggested Climbers** — shown below tagline when search is empty. Finds users who have sessions at the same gyms as the current user (queries `sessions` by `gym_id`), excludes self and already-followed users, batch-fetches their profiles. No header label. No empty state message — if no suggestions, just the tagline is shown.
- **User rows** — circular avatar (real photo or SAND initials fallback), `full_name` (Syne_800ExtraBold), `@username` (SpaceGrotesk_600SemiBold, INK2), Follow/Following toggle button.
- **Follow button** — SAND solid + white label when not following; SURFACE background + DIVIDER border + INK3 label when following. Optimistic: UI updates immediately, then writes to/deletes from `follows` table.
- `followingSet` is a `Set<string>` of following_ids; refreshed on every screen focus via `useFocusEffect`.
- Gyms loaded once on mount via `useEffect` + `fetchGyms()` (cached).

### Gym Detail (`/gym/[id]`)
The gym detail screen has **three tabs**: "Log a Climb", "Current Climbs", and "The Scene". ⚠️ It **opens on The Scene by default** (`activeTab` initial state is `'scene'`) — the community/leaderboard is the "is this gym alive?" surface, so it leads (beta strategy: surface the local FOMO). The other two tabs are one tap away.

**The Scene tab** (`src/components/GymLeaderboard.tsx`) — the local community/competition view: a **this-week leaderboard** of climbers at this gym (rank by **Sends** or **Top grade** via a toggle; #1 in SAND; tap a climber → their profile) + a **recent-sends** strip ("@user sent V6 · 2h" → `/session/[id]`) + an **All Climbers** roster (every climber who's ever logged here, all-time, ranked by total sends — "see all climbers in a gym"). One all-time `sessions` query feeds all three: the week board is client-filtered to since-Monday-local, the roster uses everything; on a quiet week the board collapses to a note while the roster persists. Pure render from `sessions` + `climbs` + `profiles` (public sends only, projects excluded) — **no schema**. Drives the local FOMO/competition that makes a single-gym seed feel alive. Re-fetches each time the tab is opened (the component mounts only when active).

**Route structure:** `src/app/gym/[id]/` (Stack layout)
- `index.tsx` — two-tab gym detail screen (info + Current Climbs)
- `log.tsx` — the climb logging form (navigated to from the Log a Climb tab CTA)

**Log a Climb tab** (existing gym info):
- Hero banner, quick stats (sessions · climbers · community), Log a Climb CTA button → navigates to `gym/[id]/log`
- Sections: About, Location (tap → Apple Maps), Amenities, Climbing Clubs, Upcoming Events
- Stats (`totalSessions`, `totalClimbers`) fetched live from Supabase on focus

**Current Climbs tab** (community climbs browser) — "**A then B**": a browsable photo grid, tap a climb for an immersive swipe-through viewer. Redesigned from beta feedback (the old tiny dot-slider + dead-end thumbnail modal).
- **Grade chips** — a horizontal scrollable row of big V0–V10 pill chips (much larger tap targets than the old 11-dot slider). Selected = filled INK; grades with no climbs are dimmed (transparent + hairline). On load it auto-selects the first grade WITH climbs (only re-snaps on refocus if the current pick went empty), so you never land on an empty grade.
- **2-up photo grid** — the selected grade's logged climbs (sessions) as a photo-forward 2-column grid (`width: '48.5%'`, `aspectRatio: 0.82`, `flexWrap` + `space-between`). Each card: full-bleed `media_url` photo (or a warm `#2a2010 → #1a1408` gradient when media-less) + bottom scrim + grade (SAND_LT) / `@handle` / ♥ like count overlay. A `{grade} · N climbs on the wall` count sits above. Per-grade empty state when the selected grade has none.
- **Immersive viewer (B)** — tapping a card opens `ClimbReel` (`src/components/ClimbReel.tsx`): a full-screen, vertically-swipeable paged feed of THAT grade's climbs, seeded at the tapped one. Video autoplays only on the active page (shared `VideoBackground`); tap a card to open the full post (`/session/[id]`) for likes/comments/share. Browse/watch surface — read-only here.
- **Data fetching** — sessions + climbs + likes + profiles fetched in parallel via `Promise.all` on focus, grouped by grade into `GradeGroup[]` (each `.sessions` sorted by likes desc). Profiles batch-fetched separately (never joined — `sessions.user_id` → `auth.users`).

**Log form** (`gym/[id]/log.tsx`) — Screen 1 of the 3-screen log flow with gymId pre-filled:
- Recognition photo (hold detection + start-hold tap; uploaded to `start_photo_url` only when a new problem is created), hold color chips, wall section chips, grade slider, IDENTIFY CLIMB button
- Navigates to `/log-flow/match` (passing gym_id + hold_color + wall_section + grade); the match screen runs the two-pass query and decides matches / close / celebration. The "Skip" link goes straight to `/log-flow/send?newProblem=true`.
- No gym picker — gymId comes from the route param

### 3-Screen Log Flow (`/log-flow/`)

Logging a climb is split across three screens. Both `(tabs)/log.tsx` (tab entry) and `gym/[id]/log.tsx` (gym detail entry) are Screen 1. Screens 2 and 3 live in `src/app/log-flow/` and cover the full screen (no tab bar).

**⚡ Quick Log — the DEFAULT everywhere.** The center **Log tab** AND the gym-page **"Log a Climb" CTAs** open the quick composer directly (`/log-flow/send?quick=true`, the gym CTAs add `gymId`); the detailed identify flow is the opt-in "Identify the exact climb →" link inside it (routes to `/gym/[id]/log` when a gymId is present, else `/(tabs)/log`). Quick mode hides the problem context pill, labels the step header "Quick log", and pre-fills **sticky smart defaults**: gym = route param → **last-logged gym** (AsyncStorage `deadpoint:lastGymId`, instant) → `home_gym_id` (network); grade = **last-logged grade** (`deadpoint:lastGrade`) instead of V0 (both keys written on every successful submit). A **recent-problems shortlist** ("ON THE WALL — TAP TO TAG") shows the gym's most-sent problems from the last 14 days as horizontal chips — tapping one attaches that `problem_id` to the log AND sets the grade, so quick logs regain catalog attribution without the identify flow; untagged quick logs still post with `problem_id: null`. Submit ends on the **reward screen** (grade + "your Nth climb this month" + "+ LOG ANOTHER" / Done) — see Screen 3. Best for fast bulk / quiet logging; the full identify flow stays for contributing a NEW problem to the catalog.

**Route params flow:**
```
Screen 1 → always:          router.push('/log-flow/match?gymId=&gymName=&holdColor=&wallSection=&grade=')
Screen 1 → skip link:       router.push('/log-flow/send?...&newProblem=true')  (bypasses match)
Screen 2 "YES LOG MY SEND": router.push('/log-flow/send?...&problemId=&problemName=&problemGrade=')
Screen 2 "NO NEW CLIMB":    router.push('/log-flow/send?...&newProblem=true')
Screen 2 "NAME YOUR CLIMB": router.push('/log-flow/send?...&newProblem=true&focusNickname=true')  (celebration)
Screen 3 success:           reward screen — "+ LOG ANOTHER" (resets for the next climb, stays mounted) or "Done" → /(tabs)
```

**Screen 1 — Identify Your Climb** (`(tabs)/log.tsx` and `gym/[id]/log.tsx`):
- Step indicator (Step 1 of 3), recognition photo area (camera/library), hold color chips (9 colors), wall section chips (Main Wall / Cave / Slab / Overhang / Arete), grade slider (V0–V10), gym dropdown (tab version) or pre-filled gym (gym version)
- Hold color + wall section required to continue; grade defaults to V0
- On photo select + color select: `detectHolds(uri, color)` runs automatically, shows SAND bounding boxes over detected holds with dark desaturating overlay. Zero clusters → "No holds detected" label.
- **Start-hold tap** (`startHold`) — after a photo, tapping the inline photo opens the **full-screen `StartHoldPicker`** (pinch-zoom + pan) where you mark the starting hold; it snaps to the nearest detected hold box → SAND ring. Optional. Passed forward as `photoUri` + `startX`/`startY` (0–1) through match → send. **Auto-colour:** when you tap **Done** in the picker, `sampleHoldColor(photoUri, x, y)` reads the colour AT the marked point and auto-selects the matching hold-colour chip — reliable because it samples one known location, unlike whole-image detection. It always runs and overwrites the chip (re-marking re-detects); the user can still correct it by tapping a chip. When a NEW problem is created, the recognition photo is uploaded to `problems.start_photo_url` and the coords saved to `map_x`/`map_y` — so on Screen 2, same-colour candidates show their start-hold photo + ring and the climber visually picks the right one. (Human disambiguation; not cross-photo auto-matching.) The recognition photo is now uploaded ONLY for the first logger of a new problem; otherwise it stays local.
- "IDENTIFY CLIMB" button queries `problems` (gym_id + hold_color + wall_section + grade); navigates based on results
- "Skip — log by attributes only" link does the same query without detection

**Screen 2 — Is This Your Climb** (`log-flow/match.tsx`):
- Both Screen-1 entries route here **unconditionally** (when not skipping) — `match.tsx` owns all the match/celebration logic; Screen 1 no longer pre-queries.
- **Two-pass query** runs in parallel via `Promise.all`: (1) **exact** = `gym_id + hold_color + grade + wall_section`; (2) **broad** = `gym_id + hold_color + grade` (any wall section). Close matches = broad minus exact. Both ordered `created_at` desc.
- **Four states** (`queryState`): `loading` (SAND spinner) · `matches` (exact found) · `close` (no exact, but same color+grade on other walls) · `none` (nothing → celebration) · `error` (query threw/failed → quiet retry).
- **matches / close** — shows matched `ProblemCard` list (reuses `ProblemCard`, never forked). Close matches render under a `CLOSE MATCHES` 9px section label. Tap a card to select it (SAND border + glow). "YES — LOG MY SEND" (disabled until selected) → Screen 3 with problemId. "NO — IT'S A NEW CLIMB" → Screen 3 with newProblem=true.
- **none → "You're the first." celebration** — full-card centered state: subtle SAND `DotGrid` (3×3 dots, brand motif), `NEW PROBLEM` section label, `You're the first.` headline (Syne_800ExtraBold 34px INK), subline pulling the gym name via `gymName()`. Primary `NAME YOUR CLIMB` button (SAND bg, INK text) → Screen 3 with `focusNickname=true` (auto-focuses the nickname input). Secondary `Log without naming` link → Screen 3 normally. No ACCENT red anywhere.
- **error → quiet retry** — "Couldn't check the catalog — try again" + retry button calling `runQuery()`. Never shows the celebration on a network error (would create duplicate problems).

**Screen 3 — Log Your Send** (`log-flow/send.tsx`):
- Grade slider is pre-filled from `problemGrade` (Screen 2 match) OR `grade` (Screen 1 identify flow) — `problemGrade` takes priority; in quick mode with neither param it defaults to the **last-logged grade** (AsyncStorage) instead of V0. Both the slider **dots AND the grade labels** are tappable (labels get `hitSlop` — chalky-finger targets).
- Section order is **grade-first** (the one required decision): identify link / context pill → nickname (new problems) → shortlist (quick) → **DIFFICULTY** → media → send style → gym → notes → visibility → solo. The **"LOG SEND" submit button lives in a fixed footer** below the ScrollView — always visible, never below the fold (safe-area padded via `useSafeAreaInsets`).
- Context pill (hold color dot + problem name + gym; identify mode only). Optional nickname input (new problems only) → saved to `problems.custom_name`. Send media picker: an Alert menu (Take Photo / Choose Photo / Choose Video). ⚠️ **Videos MUST use `allowsEditing: true` + `videoMaxDuration: 60`** — the trim-UI (UIImagePickerController) export is the proven iOS path; the build-#24 combined picker (`mediaTypes: ['images','videos']`, `allowsEditing: false` → PHPicker export) **failed SILENTLY for videos on-device** (no asset, no error, no preview) and was reverted. Photos keep `allowsEditing: false` (no forced crop screen). Every picker failure path Alerts + `track('media_pick_failed')` — never silent; video type is extension-sniffed as a backstop when `asset.type` is null. A selected **video shows its real first-frame cover** (paused `VideoBackground`, isActive=false) with a ▶ badge. **Send-style picker** (optional). Gym picker (pre-filled). Notes input.
- **Send-style tag** (optional) — three chips **Flash · Send · Project** between Difficulty and Gym; `sendStyle` state defaults to `null` (no tag). Tapping the active chip again clears it. Stored on `climbs.send_style` (omitted from the insert when null). A small tag renders on feed cards / grouped pages / session detail / My Climbs + `/user/[id]` grids (SAND_LT for Flash/Send, muted white for Project). **`'project'` is "still working it", NOT a send** → excluded from Top Grade and never triggers the high-point celebration (the prior-max query filters `send_style !== 'project'`, and a project log skips the celebration entirely).
- **Nickname auto-focus** — when arriving from the "you're the first" celebration (Screen 2 passes `focusNickname=true`), the nickname `TextInput` is focused via a `ref` after a 450ms delay (lets the screen-slide animation settle before the keyboard opens). Only fires when `isNew && focusNickname === 'true'`.
- Submit sequence — **fully optimistic**; NOTHING after the climb insert delays the "logged" moment: (1) insert problem if new (auto-name = "Blue V4 Main Wall", custom_name if entered); (2) insert session; (3) insert climb with problem_id — these are awaited (the post must exist). Then the sticky-default keys persist, `log_submitted` tracks, a success haptic fires, and the **reward screen shows immediately**. Everything else runs **in the background (fire-and-forget, survives navigation):** upload send media → update `session.media_url` → recompute `problems.media_url`; upload the new-problem start photo; `syncHomeGymAfterSubmit`; the this-month session count (reward-screen stat); and the **high-point check** (was awaited pre-submit — it added two queries of latency to every log). Upload failures still `Alert` (it's a global API).
- **Reward screen** (replaces the old 1.8s auto-navigate): kicker `LOGGED` (or `SAVED` for an offline-queued log), the grade huge (96px Syne SAND), "Your Nth climb this month" (background count query; hidden until it resolves), visibility-aware sub-copy (public: "Your crew can see it on the feed." / quiet: "Logged to your climbs — only you can see it."), then **"+ LOG ANOTHER"** (primary) and **Done** (→ feed). Log-another keeps gym + grade (sticky), clears media/notes/style/solo, sets `quickAgain=true` so the follow-up log is always a quick log (no problem/new-problem context carried over), and re-tracks `log_started {mode:'again'}`. This is the bulk-session loop — climbers log 5–15 problems a session.
- **New high point celebration** — computed **in the background** after the reward screen shows (via `isNewHighPoint` from `stats.ts`; no denormalized max stored). A strictly-harder grade — or the first-ever log — overlays the full-screen celebration: "NEW HIGH POINT", the grade huge (104px Syne, **SAND on INK**), "Your hardest send yet." Tap dismisses **back to the reward screen** (where "+ LOG ANOTHER" lives), not to the feed. Ties/below-max/projects do NOT trigger it; a query error never falsely celebrates. SAND only — no ACCENT red.
- **Offline queue** — a submit that fails on a **network error** (and isn't creating a new problem) offers "Save & post later": the log's fields (+ local media URI, best-effort) queue in AsyncStorage via `src/lib/pendingLogs.ts` and post automatically on the next feed focus / composer mount (`drainPendingLogs`), preserving the original `created_at`. The reward screen shows the `SAVED` variant. Gyms are concrete basements — a dead zone must never lose a log.
- **Instrumentation** — `track()` from `src/lib/analytics.ts`: `log_started {mode: quick|identify|again}` on mount, `log_submitted {ms, mode, media, grade, gym_id, quiet, problem}` on success (ms = mount→submit, the "median log time" metric), `log_abandoned {ms}` on unmount without submit, `log_switched_identify` when leaving via the identify link.

**Hold detection** (`src/lib/holdDetection.ts`):
- `detectHolds(imageUri, color)` → `BoundingBox[]`. Detection is an **enhancement, never a dependency** — every failure mode (throw, timeout, zero clusters) resolves to `[]` and the flow continues to metadata matching as if Skip was used. Wrapped in `Promise.race` against a **4s timeout**.
- Pipeline: downscale to **max 480px wide** PNG via `expo-image-manipulator`; decode base64 → ArrayBuffer via `base64-arraybuffer`; parse PNG chunks; decompress IDAT with `pako.inflate`; reconstruct PNG filter bytes (None/Sub/Up/Average/Paeth); convert each pixel RGB→HSL; match against `COLOR_RANGES`; flood-fill connected cells into clusters; **discard clusters smaller than 0.15% of total pixels** (relative, so it survives dimension changes); return proportional 0–1 bounding boxes.
- **Red hue wraparound** — red spans both ends of the hue circle, so its range is `h >= 345 OR h <= 15` (`hWrap: true`). All other colors use a simple `hMin..hMax` between-test.
- **One adaptive retry** — if the first pass finds zero clusters for the selected color, it retries once with relaxed bounds (`relaxRange`: hue window ±8°, sMin −15, lightness ±10 each end) for hard colored-LED gym lighting. Still nothing → continue silently (no error surfaced).

### Profile Stats Dashboard (Overview tab)
Four cards, all data derived from the existing sessions+climbs fetch (the only extra query is a small `problems(id, wall_section)` lookup for Terrain). All Arc'teryx editorial style — one confident statement, restrained support:
1. **Weekly Intensity** — `react-native-chart-kit` BarChart of problems per day Mon–Sun. Uses `withCustomBarColorFromData` + `flatColor`: selected day bar is solid `#1a1408` (INK), others `#ece8df` (SURFACE). Tap a day chip to drill into sessions for that day.
2. **Terrain** — climbs by wall section (Slab / Overhang / Cave / Main Wall / …). A small `TERRAIN` label → the dominant style as a big Syne hero → `your ground · {pct}% of sends` → restrained SAND bars per section (dominant fills the track; others scale relative to it at 0.45 opacity) with `{pct}%` + count. Wall section comes from the linked `problems.wall_section` (climbs with no problem/section are skipped). Empty state when no sectioned climbs.
3. **Grade Pyramid** — replaces the old Grade Distribution. Centered horizontal bars, **hardest grade at the apex**, easy grades forming the wide base; only grades with ≥1 climb are shown (`reverse()`d so hardest is on top). Bars scale to the most-climbed grade; the **peak (most-climbed) grade is ACCENT**, the rest SAND. Tap a grade row → inline drill-down of that grade's sends (each row → `/session/[id]`, the in-app card that plays video inline). Single `selectedGrade` state; no expand/collapse, no Modal.
4. **Monthly Volume** — `react-native-chart-kit` LineChart of total problems per week for the last 12 weeks. SAND line color (`rgba(200,168,74)` — note the config var is named `ACCENT_CHART_CONFIG` but resolves to SAND), bezier curve.

### Session Detail Screen (`/session/[id]`)
- Route: `src/app/session/[id].tsx` — presented as `fullScreenModal` (slides up over profile).
- Looks **exactly like a feed card**: full-bleed media background (or `#2a2010 → #1a1408` dark gradient if no media), bottom vignette, right action rail, bottom stats bar, @username overlay.
- **Bottom-left info** — `@username`, then `climbNickname` (SAND_LT, SpaceGrotesk_600SemiBold, 13px) if set, then `climbNotes` (white 75%, SpaceGrotesk_400Regular, 12px, max 2 lines) if set. Identical to the feed card layout. `gap: 2` between elements.
- Data fetched independently from Supabase on load: session + climbs (grade, problem_id) + profile + problems (custom_name) + likes + comment count. This is intentional — My Climbs can show sessions not in the feed's top-50 window.
- **Close** — × button top-left (Ionicons, white, safe-area offset). Tap to go back.
- **Right action rail** — avatar, ♥ like (ACCENT, optimistic), ◎ comment count, ↗ share, ⬡ gym.
- **Stats bar** — grade (SAND_LT, Syne_800ExtraBold 28px) + gym name, pinned to bottom.
- **Comment sheet** — identical to the feed comment sheet; slides up as a nested Modal. Full thread with avatars, timestamps, comment input + Send button.
- **Overflow (own session)** — `ellipsis-vertical` → bottom sheet with "Make quiet/public" (+ confirm) AND **"Combine with a friend's send"** → opens a picker of recent **public** sends from people you follow (avatar, @user, grade · gym · date) → tapping one calls the `combine_sessions` RPC → the two become a **co-session** (`router.replace('/(tabs)')` to see it). Media-less sessions render `DefaultCover`; notes render via `MentionText` (tappable @handles).
- **No top tab row** (Following/For You/Nearby) — single post view.
- Registered in `_layout.tsx` as `<Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal' }} />`.
- Navigated to from: My Climbs card tap (`router.push('/session/${entry.sessionId}')`).

### Profile Edit State
Two separate state buckets to prevent live-typing from updating the displayed header:
- `editName / editUsername / editBio` — bound to the Settings form inputs; set from Supabase on every screen focus
- `displayName / displayUsername / displayBio` — what shows in the profile header; all three only update after a successful Save Changes (or on initial fetch). `toInitials(displayName)` drives the avatar fallback initials. `displayUsername` renders as `@{displayUsername}` with a null-guard so the row is hidden until data loads.

### App Tab Bar (bottom nav)
- `src/app/(tabs)/_layout.tsx` uses `usePathname()` to detect the active tab.
- Tab order is **Feed · Explore · Log · Gyms · Profile** — Log is intentionally the **center** tab.
- **Elevated center Log button** — `LogIcon` renders a 56×56 SAND rounded-square (`borderRadius: 18`) with a white `add` icon, lifted above the bar (`marginTop: -22`) with a drop shadow and a 4px ring whose color matches the bar background (`#0d0d0b` on Feed, `#ffffff` elsewhere → reads as floating). `ringColor` is passed from the layout based on `isFeed`. ⚠️ Tapping it **intercepts the tab press** (`listeners.tabPress` → `preventDefault()`) and opens the **quick-log composer** (`/log-flow/send?quick=true`) directly — the low-friction default — rather than switching to the heavy identify Screen 1 (`(tabs)/log.tsx`). The detailed identify flow is now an **opt-in** "Identify the exact climb →" link inside the composer (→ `/(tabs)/log`). This was the fix for "logging has too much friction" — most logs are just grade + optional media + submit; identify/catalog attribution is for the climbers who want it.
- **Feed tab (`/`)** — dark theme: `backgroundColor: #0d0d0b`, active tint `#ffffff`, inactive tint `rgba(255,255,255,0.38)`. Matches the full-screen dark feed background.
- **All other tabs** — light theme: `backgroundColor: #ffffff`, active tint `INK`, inactive tint `rgba(26,20,8,0.3)`. Normal app style.
- The three computed values (`tabBarStyle`, `tabBarActiveTintColor`, `tabBarInactiveTintColor`) are passed to `screenOptions` and update automatically on every tab switch.

### Profile Tab Bar
- Three equal-width tabs: **Overview · My Climbs · Settings**
- Active tab: `Syne_800ExtraBold` label in `INK`, 2px `SAND` underline indicator pinned to bottom
- Inactive tabs: same label style in `INK3`
- Background `BG` white, `hairlineWidth` bottom border in `DIVIDER`
- Tab bar is fixed (outside the ScrollView); profile header + tab content scroll as one page

### My Climbs Tab (grade-filtered grid)
- **Layout** — a **"Choose a Date:" calendar** picker on top (`src/components/ClimbDatePicker.tsx` — a zero-dependency month grid; days with climbs are SAND-dotted/tappable, empty days dimmed), then grade step-slider (left) + Clear/All button + hamburger ☰ sort button (right column). Below: grade-grouped sections ScrollView. The date filter (exact local day via `climbDayKey`) stacks with the grade + sort filters.
- **Grade step-slider** — V0–V10 step-track. `myClimbsSlider: number | null` (null = no dot highlighted on load). Tapping a dot sets `myClimbsFilter` to that grade AND highlights the dot. Dimmed dots (0.4 opacity) = grades with no climbs logged.
- **Filter logic** — `myClimbsFilter: string | null`. When set, `filteredGroups` shows only sections matching that grade. When null, all grade sections show. Computed from `climbEntries` (individual climb rows), NOT from `sessions`.
- **Clear button** — shown when filter active: SAND gold, `rgba(200,168,74,0.12)` bg, border. Resets both `myClimbsFilter` and `myClimbsSlider` to null. Shows "All" (greyed out) when no filter.
- **Sort dropdown** — tapping ☰ opens a floating dropdown. Two options: **Date** (default) · **Gym**. Applies within each grade section.
- **Grade sections** — one per grade in `filteredGroups`, ordered V0→V10. Each has a SAND grade pill + `N sends` count. `filteredGroups` is derived from `climbEntries` grouped by `e.grade`, filtered by `myClimbsFilter`.
- **3-column row grid** — `toRows()` chunks `group.entries` (ClimbEntry[]) into rows of 3. Incomplete last rows padded with invisible filler Views.
- **ClimbGridCard** — takes a `ClimbEntry` (not SupabaseSession). Shows: cover thumbnail (80px) via `ClimbThumb` (photo → image, video → generated frame + ▶, none → 🧗 — never blank); grade in SAND (Syne_800ExtraBold); gym name; date; ▲ VITAL pill. `borderRadius: 14`. **Tapping a card** navigates to `/session/[sessionId]`. The `/user/[id]` climbs grid uses the same `ClimbThumb`.
- **ClimbEntry type** — `{ sessionId, grade, count, gymName, date, createdAt, mediaUrl, visibility }`. Derived from the `climbs` table joined with session metadata. Every session has exactly one ClimbEntry (count always 1). Quiet entries show an `eye-off-outline` badge.
- **Empty state** — "No V5 climbs logged yet" centred when filter active but no matches.

### Feed Likes & Comments (Supabase-backed)
- **Like toggle** — optimistic: UI updates immediately, then inserts/deletes from `likes` table in background. Heart filled ACCENT when liked, outline when not.
- **Feed load** — `fetchSessionPosts` fires 3 parallel queries (profiles, likes, comments) and builds counts + liked-by-me state in JS maps. No waterfall.
- **Comment sheet** — conditionally rendered `{commentSheetVisible && <Modal>}` (slide animation, transparent backdrop). Layout: flex:1 `TouchableOpacity` fills space above the sheet to dismiss on backdrop tap; `KeyboardAvoidingView` wraps the sheet panel at the bottom.
- Comment rows show real avatar photo (`borderRadius: 11` square) when `avatar_url` is set, initials fallback otherwise.
- **Tap commenter name** — closes the sheet, then navigates: own comment → `/(tabs)/profile`; other user → `/user/[userId]`.
- **Tap avatar on feed card** — see Feed Card Tap-Through above (follow/navigate logic). Does not open comment sheet.
- **Post a comment** — inserts to `comments` table, appends to local list, bumps the feed card count in real time. Send button in ACCENT pink, disabled + muted when input is empty.

### User Profile Page (`/user/[id]`)
- Route: `src/app/user/[id].tsx` — pushed via `router.push(\`/user/${userId}\`)` from the comment sheet name tap.
- Header with `‹` back chevron (SpaceGrotesk_300Light) and centred "PROFILE" title (Syne_800ExtraBold).
- Square avatar (`width: 100, height: 100, borderRadius: 16`) — real photo or SAND_LT initials fallback.
- Full name (Syne_800ExtraBold), `@username` (SpaceGrotesk_600SemiBold, INK2), bio (SpaceGrotesk_400Regular, INK3) — each only renders if set.
- **Follow / Following toggle button** — SAND solid + white label when not following; SURFACE background + DIVIDER border + INK3 label when following. Hidden if viewing own profile (`currentUserId === id`). Optimistic: updates `isFollowing` and `followerCount` immediately, then writes to/deletes from `follows` table.
- **Follower / following counts** — tappable `X followers · Y following` row; opens bottom-sheet Modals listing those users (avatar + name/username, no action buttons since this is not your own profile).
- Stats bar (SURFACE background, borderRadius: 20): **Total Climbs · Top Grade · Gyms Visited** — computed live from the user's sessions+climbs in Supabase, same logic as the self-profile.
- **Climbs grid** — a 3-column grid of the user's **public** climbs (RLS returns public-only for other users, so quiet never leaks), newest-first, each card → `/session/[id]`. Mirrors the My Climbs controls: a **grade step-slider** filter (tap a dot; dimmed = no climbs), a **Date/Gym sort** menu, and a **"Choose a Date:" calendar** picker (`src/components/ClimbDatePicker.tsx`). Empty/filtered states handled.
- All follow data is fetched inside a `try/catch` so the screen renders correctly even if the `follows` table doesn't exist.

## Current Gyms (Phase 1 — NYC)
All gym data lives in the `gyms` Supabase table. To add a gym, insert a row — no code changes needed.
- Vital Climbing LES (id: 1, Lower East Side, 40.7157 / -73.9952)
- Vital Climbing Brooklyn (id: 2, Williamsburg, 40.7057 / -73.9490)
- Vital Climbing UES (id: 3, Upper East Side, 40.7694 / -73.9547)
- Vital Climbing UWS (id: 4, Upper West Side, 40.7831 / -73.9712)

## Difficulty Scale
V-scale standard for bouldering: V0 (easiest) through V10 (hardest).
Both the Log screen and Gym Detail log one climb at a time with a single V-grade chip selector.

## Post Types
Posts have a `postType` field: `'session'` or `'photo'`
- **session** — has `gym`, `gymId`, `topGrade` (= `climbs[0].grade`). Shows stats block in feed card.
- **photo** — has `media` only. No stats block. Created from Profile `+` button.

## ⚠️ Critical: Session = 1 Climb
Every session in this app is exactly **one climb at one grade**:
- 1 row in `sessions` (`total_problems: 1`)
- 1 row in `climbs` (`{ grade: 'V5', count: 1 }`)

Therefore:
- `session.climbs?.[0]?.grade` ← this IS the grade, full stop
- There is no "top grade" calculation *within* a session — just direct access
- The only legitimate grade comparison is finding the **best grade across all sessions** (for the profile Top Grade stat)
- `total_problems` is always 1 — never display it as a meaningful number
- The `Post` type's `topGrade` field is set to `climbs[0].grade` directly in `fetchSessionPosts`

### Sessions vs Climbs vs Problems — what each table is

| Table | What it represents | What to delete to remove a send |
|-------|-------------------|----------------------------------|
| `sessions` | The **social post** — who logged it, which gym, timestamp, photo/video, notes. This is what appears on the feed and in My Climbs. | ✅ Always delete this |
| `climbs` | The **grade detail** inside that post — V-grade, count (always 1), and the `problem_id` link. | ✅ Always delete this |
| `problems` | The **community climb record** — shared across all users who have logged that specific hold color + grade + wall section at a gym. | ⚠️ Only delete if you created it AND no other climbers have logged it. Deleting a problem removes the reference for everyone who has sent it. |

**To fully delete a logged send from the Supabase dashboard:**
1. Delete the row from `climbs` (find by `session_id`)
2. Delete the row from `sessions` (this removes it from the feed and My Climbs)
3. Optionally delete from `problems` only if you are `created_by` and no other `climbs` rows reference that `problem_id`

## Features — MVP Status

### ✅ Built
- Bottom tab navigation (Feed, Gyms, Explore, Log, Profile)
- Gym detail page with per-grade V-scale climb logger (saves to Supabase)
- Log tab saves sessions to Supabase (`sessions` + `climbs` tables)
- Photo/video upload from Log screen and Gym Detail (uploads to Supabase Storage, `media_url` saved)
- **Social feed live from Supabase** — real sessions, real avatars, no placeholder data
- Feed cards with full-bleed photo layout (LinearGradient overlay) and plain layout
- Profile screen with real stats and session history from Supabase (refreshes on every focus)
- Profile photo — tappable square avatar, uploads to Supabase Storage, `profiles.avatar_url` updated (propagates to feed)
- Profile banner — full-width tappable banner with camera button, persisted via AsyncStorage
- **Profile 3-tab layout** — Overview / My Climbs / Settings tabs with fixed tab bar
- **Profile stats dashboard** — 4 cards (Weekly Intensity, Terrain, Grade Pyramid, Monthly Volume) in Overview tab, Arc'teryx editorial style
- **Terrain chart** — climbs by wall section (Slab / Overhang / Cave / …) with %-of-sends + count; dominant style as a big Syne hero (`src/app/(tabs)/profile.tsx`)
- **Grade Pyramid** — replaced Grade Distribution: centered bars, hardest grade at the apex, peak grade in ACCENT, tap a grade → drill-down to its sends
- **Send-style tag** — optional Flash / Send / Project chip per climb (`climbs.send_style`); renders as a small tag on cards; `project` excluded from Top Grade + high-point (it's not a send)
- **Interactive chart drill-downs** — tap day or grade chips to see climb details; tapping a drilled-down climb opens the in-app **session detail** (`/session/[id]`, plays video inline) — same as My Climbs. (The old full-screen media-viewer Modal that played video via `Linking.openURL` was removed — everything is in-app now.)
- **My Climbs tab** — grade-grouped 3-column grid. Grade step-slider **filters** (not scrolls) to that grade; Clear button resets. ClimbGridCard takes ClimbEntry (individual climb row), shows photo thumbnail, grade in SAND gold, gym name, date, VITAL pill. Tapping a card opens the session detail modal.
- **Session detail modal** (`/session/[id]`) — full-screen feed card experience: media fill, vignette, right rail (like/comment/share/gym), stats bar, comment sheet. Presented as `fullScreenModal`, slides up over profile.
- **Notes / description field** — multiline text input on Log screen and Gym Detail; saves to `sessions.notes`; displayed on My Climbs cards when present
- **Edit profile** — Settings tab form for Full Name, Username, Bio; saves to Supabase `profiles` table; bio shown in profile header
- **Sign out** — Log Out button in Settings tab with confirmation alert, wired to `supabase.auth.signOut()`
- **Likes — Supabase-backed** — real like counts on feed cards; optimistic toggle inserts/deletes from `likes` table; heart fills ACCENT red when liked
- **Comments — Supabase-backed** — comment sheet slides up from bottom; shows real comments with avatars; post new comments live; count updates on feed card instantly
- **User profile page** (`/user/[id]`) — view-only profile for other users: avatar, name, username, bio, stats (total climbs, top grade, gyms visited)
- **Feed — TikTok-style full-screen swipeable feed** — `FlatList pagingEnabled`, `snapToInterval = cardHeight` (measured via `onLayout`), `onViewableItemsChanged` tracks active card; full-screen photo/video or warm dark ink gradient bg; right rail with like/comment/share/gym; bottom stats bar showing grade (SAND_LT) + gym name only
- **Inline video via `expo-video`** — shared `src/components/VideoBackground.tsx` (`useVideoPlayer` + `<VideoView>`); autoplays/loops on the active feed card and the visible group page; used by the feed + session detail. Replaced the removed `expo-av`.
- **Feed card tap-through** — right rail avatar: own post → profile tab; other user not following → follow + animated 😊 overlay; other user already following → `/user/[id]`. Bottom-left `@username` always navigates to profile.
- **Feed ordering** — purely **chronological (most-recent-first)** on both tabs. `fetchSessionPosts` returns the query's `created_at desc` order as-is (`return { posts: allPosts, ... }`), so a fresh post leads For You + Following instead of getting buried. (Was followed-first-then-by-likes; changed per feedback — a new post should lead, not sink under high-like ones. `followingSet` is still returned, used only for the Following-tab filter + follow state.)
- **Following feed tab** — screen-level Following | For You overlay; Following filters the feed to followed users (`FollowingEmptyCard` when none); switching resets to top. Nearby removed.
- **Elevated center Log button** — Strava-style raised SAND button in the middle of the tab bar (floats above with a bar-matching ring + shadow); `src/app/(tabs)/_layout.tsx`
- **Dark tab bar on Feed** — `usePathname()` in `_layout.tsx` switches tab bar to `#0d0d0b` background + white tints on `/`; all other tabs use white bg with INK active tint
- **Profile header live from Supabase** — removed hardcoded `USER` constant; `displayName / displayUsername / displayBio` state drives the header, populated from `profiles` table on focus and committed on successful save
- **Explore tab** — search climbers AND gyms simultaneously; gym results instant from cache, climber results debounced via Supabase; "Send It." tagline when search empty; suggested climbers from shared gyms (no header/empty-state text); Follow/Following toggle (optimistic)
- **Follow system on profiles** — own profile shows "Invite Friends" (Share.share) + follower/following counts with bottom-sheet lists (following sheet has Unfollow buttons); other users' profiles show Follow/Following toggle + same count sheets
- **Gym detail three-tab layout** — "Log a Climb" (gym info + CTA), "Current Climbs" (community climbs browser with grade slider, problem cards, video grid modal), and **"The Scene"** (this-week leaderboard + recent sends — `src/components/GymLeaderboard.tsx`)
- **Gym leaderboard / The Scene** — per-gym this-week leaderboard (rank by Sends or Top grade) + recent-sends activity strip; local competition/FOMO for the seed. Derived live from sessions/climbs (public, non-project) — no schema.
- **Quick Log** — the DEFAULT log flow everywhere (center tab + gym-page CTAs) → `/log-flow/send?quick=true`: grade + go, everything else optional. No recognition photo, hold-color/wall, or catalog matching required; the identify flow is the opt-in link.
- **Sub-10-second logging** (the Week-1 friction batch) — sticky smart defaults (last grade + last gym from AsyncStorage, home gym fallback), grade-first section order with tappable grade labels, fixed-footer "LOG SEND" button (never below the fold), crop-free photo picking, non-blocking high-point check (the celebration overlays the reward screen instead of delaying it), success haptics. (The combined photo+video picker shipped in #24 broke video selection on-device and was reverted — see the Screen 3 media-picker gotcha.)
- **Reward screen + "+ Log another"** — every submit ends on a reward screen (grade, "your Nth climb this month", visibility-aware copy) with "+ LOG ANOTHER" (keeps gym/grade, resets the rest, quick mode) and "Done" → the bulk-session loop.
- **Recent-problems shortlist** — quick log shows the gym's most-sent problems from the last 14 days as tap-to-tag chips; tapping attaches `problem_id` + sets the grade (community logging as autocomplete; quick logs regain catalog attribution).
- **Offline log queue** (`src/lib/pendingLogs.ts`) — a network-failed submit offers "Save & post later"; queued logs auto-post on the next feed focus / composer mount with the original timestamp preserved. Dead-zone gyms never lose a log.
- **Analytics events** (`src/lib/analytics.ts` + `events` table) — log_started / log_submitted (with mount→submit ms = the median-log-time metric) / log_abandoned / log_switched_identify. Insert-own RLS; dashboards read via SQL.
- **Current Climbs browser ("A then B")** — big V0–V10 grade chips (dimmed when empty; auto-selects the first grade with climbs) → a 2-up photo grid of that grade's logged climbs → tap a card to open `ClimbReel`, a full-screen vertical swipe-through viewer of the grade (video autoplays on the active page; tap → `/session/[id]`). Replaced the old tiny dot-slider + dead-end thumbnail modal (beta feedback)
- **Tab bar icons via Ionicons** — replaced `expo-symbols` (dev-build-only) with `@expo/vector-icons` Ionicons; works in Expo Go. Inline icons (search, settings, camera, share) also converted.
- **Gyms tab interactive map** — `react-native-maps` MapView with warm custom style, SAND dot markers, Callout popups (name / neighborhood / address / "View Gym →"). Map + list both sourced from `gyms` Supabase table via `src/lib/gyms.ts`.
- **`gyms` Supabase table** — single source of truth for all gym data (name, address, neighborhood, lat/lng). `src/lib/gyms.ts` provides `fetchGyms()` (with in-process cache) and `gymName(gyms, id)`. All hardcoded `GYM_NAMES` constants removed from every file.
- **3-screen log flow** — Screen 1 (Identify: photo + hold detection + color/wall/grade chips + gym), Screen 2 (match ProblemCard list), Screen 3 (send media + grade + notes + submit). Lives in `src/app/log-flow/`. Route: `/log-flow/match` and `/log-flow/send`.
- **On-device hold detection** — `src/lib/holdDetection.ts` using `expo-image-manipulator` + `pako`; PNG parsing + HSL color range matching + flood-fill clustering; returns bounding boxes rendered as SAND overlays on the recognition photo
- **Full-screen start-hold picker** — `src/components/StartHoldPicker.tsx`: tap the recognition photo → full-screen pinch-zoom + pan modal to place the start hold precisely (snaps to nearest detected hold); shared by both Screen-1 log entries
- **Video cover preview** — selecting a video on the log screen shows its real first frame (paused expo-video) as the cover, not a text placeholder
- **Tap-to-mute video** — tap a video card (feed or session detail) to toggle sound; feed mute is global (TikTok-style), with a speaker badge showing the state. Default sound ON.
- **Hold-to-speed video** (feed) — press-and-hold a feed video card plays it at 2× while held (TikTok/Reels-style); releasing restores 1×. A centred `2×` badge shows while held. Implemented via the `VideoBackground` `rate` prop + a `Pressable` long-press in `FullScreenCard` (holding never toggles mute).
- **In-app notifications inbox** (`/notifications`) — Instagram-style activity list: who liked/commented on your climbs (with post thumbnail → the post) and who started following you (with Follow-back). Derived live from `likes`/`comments`/`follows` — no notifications table. Opened from a bell in the Profile header that shows a SAND unread dot. (Device **push** notifications — the phone banner when the app is closed — are now built too: `src/lib/push.ts` + `supabase/functions/notify`; see "Device push notifications".)
- **Shareable IG card** (Strava-style) — the feed + session-detail Share button opens `ShareCardSheet`: a branded portrait card (video still / photo + Grade / Gym / Date + Deadpoint mark) captured with `react-native-view-shot` and handed to the native share sheet (`expo-sharing`) for Instagram story/feed, Messages, or Save to Photos. **Video posts get a cover/frame picker** (Instagram-style filmstrip of sampled frames) + a **"Share full video"** option; images just use the image. Stills via `expo-video-thumbnails`. **Needs a build** (native modules). The growth flywheel for the gym seed.
- **Branded video** (🔬 shipped to build, pending on-device verification) — `modules/branded-video` Swift/AVFoundation module burns the Deadpoint overlay onto a climb's clip so the *shared video* carries the brand (the real answer for a video-first sport). Primary share action for videos when linked; card + full-video remain fallbacks. ⚠️ Untestable without a build — first device test is the gate; likely needs a round or two on orientation/overlay-flip (`isGeometryFlipped`) and export.
- **Branded default cover** — media-less climbs render `DefaultCover` (Grade / Gym / Date + Deadpoint motif) instead of a blank gradient (`src/components/DefaultCover.tsx`)
- **@username tagging** — type `@handle` in a climb's notes and it renders as a tappable link to that profile (`src/components/MentionText.tsx`); no schema, resolves the handle on tap
- **Co-sessions** (combine with a friend) — from a session's overflow, "Combine with a friend's send" picks a followed climber's recent public send and merges the two (via the `combine_sessions` SECURITY DEFINER RPC + `sessions.co_session_id`). The feed folds co-sessions into one cross-user card (`@a + @b · co-session`); `groupPosts`/`isCoSession` handle the grouping
- **Visible upload failures** — `uploadFileToStorage` returns `{ url, error }`; the send screen Alerts the reason (e.g. `Upload failed (413)` = video over the bucket size limit) instead of silently posting a blank card
- **`problems` table** — community-created climb records (gym_id, hold_color, grade, wall_section, name, custom_name, media_url). `climbs.problem_id` links each logged climb to a problem. `problems.media_url` auto-updated to the most-liked session photo on each send.
- **Feed + session detail show climb nickname + notes** — `climbNickname` (from `problems.custom_name`, SAND_LT) and `climbNotes` (from `sessions.notes`, white 75%) shown below `@username` on both feed cards and the session detail modal when set. `gap: 2` keeps them tight.
- **"You're the first." celebration** (Screen 2) — when both match passes return zero, Screen 2 shows a full-card first-logger celebration (SAND dot-grid motif, `NEW PROBLEM` label, headline + gym-name subline, `NAME YOUR CLIMB` / `Log without naming` CTAs) instead of a dead-end empty state. A Supabase query failure shows a quiet retry state instead — never the celebration.
- **Close-matches pass** — before declaring "first", Screen 2 runs a broadened query (same gym + color + grade, any wall section) and surfaces those under a `CLOSE MATCHES` label above the YES/NO actions.
- "CLIMB LOGGED" success screen (centered) after submitting a send
- **Onboarding intro cards** (`src/app/onboarding.tsx`) — a 3-card swipeable intro (Track your climbs / See what's sending / Build your story) shown ONCE per install, AFTER auth and before the feed. Editorial style: left-aligned, oversized Syne_800ExtraBold headline, a small "01 — 03" index label + a short SAND rule, no icon. Paged horizontal FlatList + fixed page dots + a single CTA that switches "Next" → "Get started". Completion persists `hasSeenOnboarding` (AsyncStorage) via `markSeen()` and routes to the feed. Routing + bounce-fix live in `_layout.tsx` (`OnboardingContext` / `src/lib/onboarding.ts`). See "Auth Flow".
- **Zero-onboarding first-run experience** (in-feed) — after the intro, signup lands straight in the feed; in-feed gym picker → confirmation cards (sets `profiles.home_gym_id`); silent home-gym inference on submit (`src/lib/homeGym.ts`); in-feed CLIMBERS-AT-gym suggestion card; "QUIET IN HERE" empty state; `OFFICIAL_ACCOUNT_ID` auto-follow scaffolding (off). See "Feed First-Run Cards".
- **New high point celebration** — first-ever / new-hardest send shows a full-screen SAND-on-INK grade celebration after submit (computed on read; `src/lib/stats.ts`)
- **Profile PROGRESS section** — own-profile-only row: This month (sends + days), High point (grade chip), Streak (consecutive weeks). Pure helpers in `src/lib/stats.ts`.
- **Canonical profile navigation** — every username/avatar (feed, comments, followers/following, suggestion card, explore rows, session detail, group header) routes to `/user/[id]` (other) or `/(tabs)/profile` (own), each with `hitSlop`. `user/[id]` is registered in the root Stack.
- **Quiet logging** — per-session `visibility` ('public'/'quiet') with a log-screen toggle + after-the-fact overflow toggle on own cards; quiet hidden from others via the RLS baseline + feed query filter; `recompute_problem_cover` RPC keeps quiet sends off problem covers. Counts in the owner's own stats. See "Quiet Logging".
- **Feed session grouping** — `src/lib/groupPosts.ts` folds same-day/same-gym/same-user runs into one carousel card (horizontal paged FlatList, page dots, +N more, per-page likes/comments/video); "Arrange climbs" writes `feed_rank`. Singles unchanged. See "Feed Session Grouping".
- **Other users' climbs grid** — `/user/[id]` lists the user's public climbs (RLS-filtered) with the same grade slider, Date/Gym sort, and calendar date picker as My Climbs.
- **Climb date picker** — `src/components/ClimbDatePicker.tsx`, a zero-dependency calendar used by My Climbs + `/user/[id]` to filter climbs to an exact day.
- **Inline video** — `expo-video` via `src/components/VideoBackground.tsx`; autoplays on the active feed card / visible group page / session detail (replaced removed `expo-av`).
- **Real app icon + animated splash** — dotted-D marker icon; static native splash on `#0d0a05`; `SplashGate` "two doors" launch reveal — the full screen is the speckled gold-dot brand pattern (+ centred D logo) that splits open.
- **Live on TestFlight** — EAS production builds (`eas build … --auto-submit`), Supabase keys as EAS env vars, remote auto-incrementing build numbers. See "EAS Build + TestFlight".
- Supabase database connection
- User authentication — sign up (creates profile record) and log in
- Sign up / log in screens (white background, Syne ExtraBold, premium minimal)
- Full ink/sand/cream design system across all screens

### 🔜 Phase 2
- [x] Follow infrastructure (`follows` table + RLS) — done
- [x] Follower/following counts on profiles + bottom-sheet user lists — done
- [x] Feed ordering — chronological (most-recent-first) on both For You + Following, so a fresh post leads — done (was followed-first + by-likes)
- [x] In-app notifications inbox (`/notifications`) — likes/comments/follows, derived (no table) — done
- [x] **Device push notifications** — built (code complete; needs the one-time setup below + a build to go live).
      The in-app inbox is the visible "Activity" list; this is the separate piece that banners the
      phone when the app is **closed**. Architecture:
      - **⚠️ BUILD GOTCHA:** the `expo-notifications` config plugin adds the **Push Notifications
        capability / `aps-environment` entitlement**, which the original provisioning profile (pre-push)
        lacked → a `--non-interactive` build FAILS ("Provisioning profile … doesn't include the Push
        Notifications capability"; that killed build #18). The **FIRST** production build after adding
        the plugin MUST be run **interactively** (`eas build -p ios --profile production --auto-submit`,
        NO `--non-interactive`) so EAS registers the Push capability on the App ID + sets up the APNs
        key + regenerates the provisioning profile (uses the stored ASC API key — just confirm the
        prompts). After that one interactive build, future `--non-interactive` builds work again.
      - **Client:** `expo-notifications` (config plugin in app.json, SAND accent). `src/lib/push.ts`
        `registerForPushNotifications(userId)` requests permission + `getExpoPushTokenAsync({projectId})`
        and upserts `profiles.push_token`; `_layout.tsx` calls it once authed and handles notification
        taps (runtime + cold start) → stashes `data.url` and `router.push`es it once authed.
      - **Server:** a Supabase Edge Function `supabase/functions/notify` fired by **Database Webhooks**
        on INSERT into `likes`/`comments`/`follows`. It resolves recipient (session owner / followed
        user) + actor name, skips self-actions, looks up the recipient's `push_token` (service role),
        and POSTs to Expo's Push API. Deep-links: likes/comments → `/session/[id]`, follows →
        `/notifications`. Optional `WEBHOOK_SECRET` header guard.
      - **Setup status (live `deadpoint` project): ✅ FULLY LIVE.** (1) `push_token` column added;
        (2) `notify` function deployed; (3) like/comment/follow triggers wired via
        `supabase/functions/notify/webhooks.sql` (pg_net triggers POSTing `{type,table,record}`);
        (4) interactive build #19 set up the APNs key + Push capability and is on TestFlight (push
        confirmed working on-device); (5) **hardened** — a random `WEBHOOK_SECRET` is set on the
        function and stored in `app_private.config` (private, non-API-exposed); the triggers send it
        as the `x-webhook-secret` header and the function 401s anything without it. The secret value
        lives only in the function secrets + `app_private.config`, never in git. To rotate: new
        `WEBHOOK_SECRET` + update the `app_private.config` row + redeploy `notify`.
- [ ] **Improve on-device hold detection** (TODO — deferred 2026-06-18, revisit later). The
      outlines from `src/lib/holdDetection.ts` (HSL color matching + flood-fill) are a
      **best-effort snapping aid, NOT required** — real gym photos (LED lighting, mixed-color
      holds, angle) defeat the color matching often, so outlines frequently come up empty.
      Per-climb identity does NOT depend on it: you still tap to place the start hold, and
      Screen 2's photo disambiguation works regardless. When we pick it up, options to explore:
      better/adaptive color sampling, letting the user lasso/confirm the hold region, or a
      server-side / ML detector. Decision: leave as a nicety for now (2026-06-18).
- [ ] **Consensus grading** (TODO — deferred 2026-06-19, build once there's log volume). Grades
      are subjective (±1 is normal; color-band gyms make a "grade" an explicit range). The
      climbing-authentic model: each climber logs THEIR perceived V-grade (their truth — drives
      their own stats, never "wrong"); a shared problem then shows the **consensus** (median of
      all logged grades) + the **spread** ("V4–V6 · most say V5"). Needs volume to be meaningful.
      ⚠️ Implication for catalog matching: make grade a **±1 soft filter, not a hard key** (match
      by color + wall + photo; grade is fuzzy) so the same climb logged V4 vs V5 doesn't split
      into two entries. For now: climbers just log their honest read; no consensus UI yet.
- [ ] More gyms (expand beyond NYC Vital locations)

### 🔜 Phase 3
- [x] Gym database in Supabase — done (`gyms` table, seeded with 4 NYC locations)
- [ ] Expand gym coverage beyond NYC Vital locations
- [x] Individual problem tracking — `problems` table + 3-screen log flow — done
- [ ] Leaderboards
- [ ] App Store launch

## EAS Build + TestFlight (LIVE — first build shipped 2026-06-16)
The app builds on **EAS** and is on **TestFlight**. Project: `@dalexthefox/deadpoint`,
bundle id `com.foxcollective.deadpoint`, App Store Connect app id `6780744569`.
- **Build + submit:** `npx eas-cli build --platform ios --profile production --auto-submit`
  (build profiles in `eas.json`). `eas.json` uses `appVersionSource: "remote"` so EAS
  **auto-increments the iOS build number** — `ios.buildNumber` is NOT in app.json (remove it; it's ignored).
- **⚠️ `--auto-submit` in `--non-interactive` mode needs `submit.production.ios.ascAppId`
  in `eas.json`** (the App Store Connect app id, `6780744569`). Without it the build
  still succeeds but the submit step fails ("Set ascAppId in the submit profile … or
  re-run in interactive mode"). It's now set in `eas.json`; the ASC API key itself lives
  in the EAS credentials service. To submit an already-built build:
  `npx eas-cli submit -p ios --latest` (or `--id <buildId>`).
- **⚠️ ENV VARS — the #1 launch-crash cause.** `.env` is gitignored, so EAS cloud builds
  do NOT get `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` → `createClient()`
  throws on the first line → instant crash at launch. They are set as **EAS environment
  variables** (`eas env:create --environment production/preview/development --name … --visibility sensitive`).
  If you ever rotate keys or add an env var, set it on EAS too, not just in `.env`.
- **⚠️ Keep Expo packages aligned.** Run `npx expo install --check` before building. Mismatched
  native module versions cause DYLD **"Symbol not found"** launch crashes (this happened:
  expo-video 56.1.4 vs expo-modules-core 56.0.13 → fixed with `npx expo install --fix`, which
  brought expo→56.0.12 / expo-modules-core→56.0.17). `expo-video` + `expo-image` config plugins
  live in app.json `plugins`.
- **Diagnosing a TestFlight launch crash:** iPhone → Settings → Privacy & Security → Analytics &
  Improvements → Analytics Data → `Deadpoint-*` → read `Termination Reason` + top frames.
- **Apple Silicon / ITMS-90863 warning** (non-blocking) — Expo apps reference ExpoModulesCore
  symbols not available when run as an iPhone app on a Mac. Before the public App Store release,
  turn OFF Mac availability in App Store Connect → Pricing and Availability. Does not affect iPhone/TestFlight.

## Icon + Splash (real, shipped)
- **Icon:** `./assets/images/icon.png` — the dotted-"D" climbing-hold marker (1024×1024, opaque).
- **Native splash:** static, `backgroundColor: #0d0a05` (sampled from the icon's corners so the
  logo sits seamlessly), `image: ./assets/images/splash-icon.png` (= the marker), `imageWidth: 220`.
- **Door animation:** native splashes are static, so the "two doors" reveal is the in-app
  `SplashGate` overlay (see Key Source Files), rendered once at root.
- Zero TypeScript errors as of last commit.

## Important Rules for Claude Code
- Always use **expo-router** for navigation, NEVER react-navigation
- **Register every off-`(tabs)` route** with a `<Stack.Screen name="..." />` in `src/app/_layout.tsx` — an unregistered file route makes `router.push` to it silently no-op (this caused the username-tap navigation bug)
- **Profile navigation convention:** own → `/(tabs)/profile`, other → `/user/[id]`. Wire every username/avatar this way; wrap avatar + name in one `Pressable` with `hitSlop`
- **Quiet visibility:** the public/quiet filter belongs in the QUERY + RLS, never the render layer. Other-user reads rely on the RLS baseline; the feed also adds `.or('visibility.eq.public,user_id.eq.<uid>')`. After any session insert OR visibility change, call `supabase.rpc('recompute_problem_cover', { problem_id })` so quiet sends never become a cover.
- **Feed grouping:** group with the pure `groupPosts()` fold (`src/lib/groupPosts.ts`) at render time only — never reorder the feed query or persist groups. First-run cards are never grouped.
- Always keep compatibility with **Expo SDK 56**
- Use the **ink/sand/cream palette** defined above — BG white, CARD `#f4f1eb`, SURFACE `#ece8df`, INK `#1a1408`, SAND `#c8a84a`, ACCENT `#e8383c`
- ACCENT (`#e8383c`) is ONLY for: like buttons (heart) + Grade Distribution peak bar — nowhere else
- SAND (`#c8a84a`) is for: everything else that needs a color — buttons, active tabs, grade display, follow buttons, wordmark, chart lines, pills
- INK (`#1a1408`) is for: structure — nav text, banners, active slider dots, body text
- Auth screens use **white backgrounds** with INK heading text — intentionally minimal
- **Syne_800ExtraBold** for all display headings, **SpaceGrotesk_*** for all body/UI text
- Profile avatar is **square** (`borderRadius: 16`) — NOT circular
- Always import Supabase from `src/lib/supabase.ts`
- Keep `.env` out of git — credentials go there only
- Keep designs minimal and premium — less is more
- **Media uploads:** ALWAYS stream via `FileSystem.uploadAsync` (BINARY_CONTENT) → the `uploadFileToStorage` helper in `src/lib/store.ts`. The old base64→ArrayBuffer→`supabase.storage.upload()` path fails for video — do NOT use it. NEVER use fetch+blob or FormData. (base64 decode is still fine for non-upload work like holdDetection.)
- **Feed profiles:** `sessions.user_id` references `auth.users`, NOT `profiles` — always batch-fetch profiles separately and join in JS
- **Gym data:** ALWAYS use `src/lib/gyms.ts` — `fetchGyms()` fetches from Supabase (cached), `gymName(gyms, id)` does the lookup. NEVER hardcode gym names, IDs, or coordinates in any screen file. There is no fallback `GYM_NAMES` constant anywhere in the codebase.
- **Icons:** ALWAYS use `@expo/vector-icons` Ionicons — NEVER use `expo-symbols` / `SymbolView` (requires dev build, crashes Expo Go)
- **Video playback:** use `expo-video` via the shared `src/components/VideoBackground.tsx` (`useVideoPlayer` + `<VideoView contentFit="cover" nativeControls={false}>`, looping, autoplay gated on `isActive`). Mounted only for video posts (feed cards, group pages, session detail). **NEVER reintroduce `expo-av`** — it does not build against this Expo SDK (`EXAV`/`EXEventEmitter.h` errors) and crashes the iOS build. (Profile chart drill-downs now route to `/session/[id]` for in-app inline video — the old `Linking.openURL` media viewer was removed.)
- **Chart cards:** NEVER add `overflow: 'hidden'` to chart card containers — on iOS it clips hit-testing and prevents taps on rows inside expanded cards. Charts are sized correctly so nothing bleeds out.
- **Modals that overlay scrollable content:** ALWAYS conditionally render them (`{visible && <Modal visible>}`) so they fully unmount when closed and cannot intercept touches on the screen behind them.
- **Session grade access:** ALWAYS use `session.climbs?.[0]?.grade` — never `.reduce()`, never `.sort()`, never `Math.max()` on grades within a single session. One session = one climb = one grade.
- **StyleSheet.absoluteFill** — use `StyleSheet.absoluteFill` (not `absoluteFillObject`, which does not exist in SDK 56).
- **Never hardcode user data** — names, usernames, initials, and any other per-user values must always come from Supabase (`profiles` table) via state variables. No `const USER = { name: '...' }` constants or similar placeholders in production code. Use the `displayName / displayUsername / displayBio` pattern (committed header state) and `toInitials(displayName)` for avatar fallbacks.
- After every completed task, **commit and push to GitHub**
- GitHub repo: https://github.com/Dalexfox/deadpoint.git

## Developer Notes
- Developer: Alex Fox
- GitHub: Dalexfox
- No prior coding experience — keep explanations simple and well-commented
- This is an MVP — prioritize working features over perfect code
