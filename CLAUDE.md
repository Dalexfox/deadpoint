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

### Typography
- **Display / Headings:** `Syne_800ExtraBold` — bold, editorial, tight tracking
  - Screen titles: 42px, letterSpacing: -1.5
  - Auth headings: 58px, letterSpacing: -2
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
- **With media** — full-screen `Image` or `expo-av Video` background
- **Without media** — `LinearGradient '#2a2010 → #1a1408'` background (warm dark)

Overlays (all `position: 'absolute'`):
- **Bottom vignette** — `LinearGradient transparent → rgba(0,0,0,0.75)` from 42% down
- **Top tab row** — Following / For You / Nearby tabs at `top: 32`; "For You" underline in SAND_LT
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
- Avatar uploads to Supabase Storage (`avatars/{userId}.jpg`) and `profiles.avatar_url` is updated — propagates to all feed cards

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
- **File I/O:** `expo-file-system/legacy` — MUST use the `/legacy` subpath in SDK 56; `readAsStringAsync` was moved there
- **Base64 decode:** `base64-arraybuffer` — use `decode()` for reliable base64→ArrayBuffer in Hermes (never atob())
- **Charts:** `react-native-chart-kit` + `react-native-svg` — BarChart (Weekly Intensity) and LineChart (Monthly Volume) on Profile. Grade Distribution uses a fully custom View-based bar chart (no chart-kit) to avoid label clipping.
- **Maps:** `react-native-maps` — used on the Gyms tab. Works in Expo Go on iOS (Apple Maps, no API key needed). Do NOT pass `provider={PROVIDER_GOOGLE}` unless a Google Maps API key is configured.
- **Gradients:** `expo-linear-gradient` (feed card photo overlay)
- **Video:** `expo-av` is installed (`package.json`) but **requires a development build** — it does NOT work in Expo Go (throws `ExponentAV` native module error). For video playback in Expo Go, use `Linking.openURL(url)` to hand off to the system player. When a dev build is available, swap in `expo-av Video`.
- **Icons:** `@expo/vector-icons` (Ionicons) — installed, works in Expo Go. Used for all tab bar icons and inline icons throughout the app. **Do NOT use `expo-symbols` (SymbolView)** — it requires a dev build and crashes Expo Go.
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
  created_at timestamp with time zone default now()
)
-- ⚠️ bio column must be added manually if not present:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;

-- Climbing sessions
sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),   -- references auth.users, NOT profiles
  gym_id text,
  total_problems int,
  media_url text,            -- public Supabase Storage URL for session photo/video
  notes text,                -- optional description/notes entered on the log screen
  created_at timestamp with time zone default now()
)
-- ⚠️ notes column must be added manually if not present:
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes text;

-- Individual climbs within a session
climbs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  grade text,
  count int,
  problem_id uuid references problems(id)   -- links to a specific problem; null for pre-problems-table sessions
)

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
  map_x float,                              -- reserved for future wall map (always null for now)
  map_y float,
  map_wall_id text,
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
```

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
  created_at timestamp with time zone default now()
)
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
- Profile avatars: `avatars/{userId}.jpg` (always same path, upsert: true → self-overwrites)

### ⚠️ Media Upload Pattern (React Native)
**NEVER use fetch+blob or FormData** — both fail for local file URIs in React Native / Hermes.
**Always use this pattern:**
```ts
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const base64 = await FileSystem.readAsStringAsync(uri, {
  encoding: FileSystem.EncodingType.Base64,
});
const arrayBuffer = decode(base64);
const { error } = await supabase.storage
  .from('session-media')
  .upload(path, arrayBuffer, { contentType, upsert: true });
```

## App Structure

### Auth Flow
- Unauthenticated → `/auth/login`
- Authenticated → `/(tabs)`
- Auth state managed in `src/app/_layout.tsx` via `supabase.auth.onAuthStateChange`
- Root layout also calls `getUser()` to verify session validity on startup; signs out if stale

### Route Structure
```
src/app/
  _layout.tsx          — Root layout: font loading, auth state, redirect logic
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
      index.tsx        — Gym detail (two tabs: Log a Climb info + Current Climbs browser)
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
```

### Key Source Files
```
src/lib/
  supabase.ts          — Supabase client (import this everywhere)
  store.ts             — AsyncStorage helpers, media upload, avatar upload. Post type includes climbNickname (problems.custom_name) and climbNotes (sessions.notes)
  gyms.ts              — fetchGyms() + gymName() helper; in-process cache; SINGLE SOURCE OF TRUTH for gym data
  holdDetection.ts     — On-device hold color detection: downscale to max 480px wide PNG via expo-image-manipulator, decode PNG binary, pako.inflate IDAT, reconstruct filter bytes, HSL color range matching (red hue wraps 345–15), flood-fill cluster detection with a relative threshold (≥0.15% of pixels), one adaptive relaxed-bounds retry, 4s hard timeout, returns BoundingBox[] as 0–1 proportional coords
src/components/
  ProblemCard.tsx      — Reusable full-bleed problem card (media bg or dark gradient, grade in SAND_LT, hold color dot, wall section, name, custom_name). Used in log-flow/match.tsx and gym Current Climbs browser.
```

### 5 Main Tabs
1. **Feed** — TikTok-style full-screen vertical swipeable feed. Each session card fills the entire content area (measured via `onLayout` — window height minus status bar and tab bar). Swipe up/down with `FlatList pagingEnabled + snapToInterval`. Sessions fetched from Supabase (top 50, `created_at` desc), then reordered in JS: followed users' posts first (preserving chronological order), then everyone else sorted by like count descending. `onViewableItemsChanged` (stable ref) tracks the active card index for video autoplay. Cards with media_url show a full-screen photo/video background; cards without show a teal→dark gradient (`#2E7A96 → #0d2b36`). Bottom vignette gradient for readability. Likes and comments are Supabase-backed. **expo-av Video** is used for video autoplay (`shouldPlay={isActive}`) — requires a dev build, crashes in Expo Go.
2. **Gyms** — Interactive `react-native-maps` map (warm custom style, SAND dot markers, Callout popups) above a scrollable gym list. Both map and list are driven live from the `gyms` Supabase table via `fetchGyms()`. Tapping a marker shows a Callout with name/neighborhood/address and a "View Gym →" button. Tapping a list card animates the map to that gym's coordinates and navigates to `/gym/[id]`. Visited gyms (gyms the user has logged a session at) are highlighted differently in the list. Map height: `max(170, screenHeight * 0.26)` — kept compact so the gym list is easy to reach.
3. **Explore** — Find and follow other climbers. See Explore tab section below.
4. **Log** — 3-screen flow for identifying and logging a climb. See 3-Screen Log Flow section below.
5. **Profile** — Fixed title header ("Profile" + `+` share button + gear icon). Fixed 3-tab bar (Overview / My Climbs / Settings) below it. The rest of the page scrolls as one unit.
   - **Overview tab** — Stats bar (Total Climbs · Gyms Visited · Top Grade) pinned directly below the tab bar (white BG, hairline bottom border), then 3 interactive chart cards (Weekly Intensity, Grade Distribution, Monthly Volume) scrolling below. Stats bar is hidden on My Climbs and Settings tabs.
   - **My Climbs tab** — grade-grouped 3-column grid with a grade step-slider and sort dropdown. See My Climbs section below for full detail.
   - **Settings tab** — Edit Profile form (Full Name, Username, Bio inputs pre-filled from Supabase; Save Changes button in ACCENT pink; bio display in header only updates after a successful save). Log Out button (outlined red `#e53935`, confirmation alert before signing out).
   - Banner (tappable, persisted via AsyncStorage) + square avatar (tappable, uploads to Supabase Storage + updates `profiles.avatar_url`) scroll with the page above the tab bar.
   - Bio displayed below `@username` in the identity row (TEXT_MUTED, 14px, DMSans_400Regular) — only rendered when non-empty.
   - Stats bar fetched live from Supabase on every focus; rendered conditionally (`activeTab === 'overview'`).
   - **Invite Friends** button (PRIMARY teal outline) on the identity row — triggers `Share.share()` with an invite message.
   - **Follower / following counts** row below the identity block — tapping "followers" or "following" opens a bottom-sheet Modal listing those users.
   - **Followers sheet** — avatar + name/username list; no action buttons. Each row is tappable: closes the sheet and navigates to that user's profile (`/(tabs)/profile` for self, `/user/[id]` for others).
   - **Following sheet** — same list with an "Unfollow" button per row; optimistic: removes row and decrements count immediately. Each row is also tappable (same nav logic as followers sheet); Unfollow button tap does not bubble to the row.

### Feed Card Layout (TikTok-style full-screen)
Each card is a `View` sized `{ width: SCREEN_WIDTH, height: cardHeight }` with all overlays `position: 'absolute'`:

- **Background** — full-screen `Image` (photo) or `expo-av Video` (`shouldPlay={isActive}`, `isLooping`) for media sessions; `LinearGradient '#2E7A96 → #0d2b36'` for sessions without media. **Media type is sniffed from the URL extension** — `sessions` has no `media_type` column, so `fetchSessionPosts` tests `media_url` against `/\.(mp4|mov|m4v|avi)$/i` to decide `type: 'video'` vs `'image'` (same regex as `session/[id].tsx`). ⚠️ This is a workaround; the proper fix is a `media_type` column on `sessions` set at upload time.
- **Bottom vignette** — `LinearGradient transparent → rgba(0,0,0,0.75)` from 42% down, `pointerEvents="none"`.
- **Top tab row** — `absolute, top: 32`. Three tabs: `Following` (inactive, 16px `rgba(255,255,255,0.55)`) | `For You` (active, 17px white bold + ACCENT 2.5px underline with `alignSelf: 'stretch'`) | `Nearby` (inactive). Following and Nearby are placeholder touchables for Phase 2.
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
The gym detail screen has **two tabs**: "Log a Climb" and "Current Climbs".

**Route structure:** `src/app/gym/[id]/` (Stack layout)
- `index.tsx` — two-tab gym detail screen (info + Current Climbs)
- `log.tsx` — the climb logging form (navigated to from the Log a Climb tab CTA)

**Log a Climb tab** (existing gym info):
- Hero banner, quick stats (sessions · climbers · community), Log a Climb CTA button → navigates to `gym/[id]/log`
- Sections: About, Location (tap → Apple Maps), Amenities, Climbing Clubs, Upcoming Events
- Stats (`totalSessions`, `totalClimbers`) fetched live from Supabase on focus

**Current Climbs tab** (community climbs browser):
- **Grade step-slider** — always shows all V0–V10. Selected grade displayed in ACCENT pink. Tapping a dot filters the section below to that grade. Defaults to V0 on load (no auto-snap to first grade with data).
- **Grade section** — shows the selected grade's aggregated data, or "No climbs logged at this grade yet." if none exist.
- **Problem card grid** — 3-column row-first grid (`toRows()` chunks into groups of 3, each group is one row; incomplete last rows padded with invisible filler Views). Cards use `flex: 1` + `aspectRatio: 0.85`. Cover photo = `media_url` from most-liked session; like count overlay (ACCENT pink, bottom-left); send count footer. Tapping a card opens the video grid modal.
- **Video grid modal** — conditionally rendered bottom sheet (`{modalGroup !== null && <Modal>}`); header shows grade pill + gym name + send count; 3-column portrait thumbnail grid sorted by most-liked; each cell shows climber initials chip (top-left, from `profiles.full_name`) and like count (bottom-left, ACCENT pink). TODO comment marks where to wire cell tap to feed navigation.
- **Data fetching** — sessions + climbs + likes + profiles fetched in parallel via `Promise.all` on focus. Profiles batch-fetched separately (never joined — `sessions.user_id` → `auth.users`).

**Log form** (`gym/[id]/log.tsx`) — Screen 1 of the 3-screen log flow with gymId pre-filled:
- Recognition photo (for hold detection only — never uploaded), hold color chips, wall section chips, grade slider, IDENTIFY CLIMB button
- Navigates to `/log-flow/match` (passing gym_id + hold_color + wall_section + grade); the match screen runs the two-pass query and decides matches / close / celebration. The "Skip" link goes straight to `/log-flow/send?newProblem=true`.
- No gym picker — gymId comes from the route param

### 3-Screen Log Flow (`/log-flow/`)

Logging a climb is split across three screens. Both `(tabs)/log.tsx` (tab entry) and `gym/[id]/log.tsx` (gym detail entry) are Screen 1. Screens 2 and 3 live in `src/app/log-flow/` and cover the full screen (no tab bar).

**Route params flow:**
```
Screen 1 → always:          router.push('/log-flow/match?gymId=&gymName=&holdColor=&wallSection=&grade=')
Screen 1 → skip link:       router.push('/log-flow/send?...&newProblem=true')  (bypasses match)
Screen 2 "YES LOG MY SEND": router.push('/log-flow/send?...&problemId=&problemName=&problemGrade=')
Screen 2 "NO NEW CLIMB":    router.push('/log-flow/send?...&newProblem=true')
Screen 2 "NAME YOUR CLIMB": router.push('/log-flow/send?...&newProblem=true&focusNickname=true')  (celebration)
Screen 3 success (2.5s):    router.navigate('/(tabs)')
```

**Screen 1 — Identify Your Climb** (`(tabs)/log.tsx` and `gym/[id]/log.tsx`):
- Step indicator (Step 1 of 3), recognition photo area (camera/library, for detection only — never posted), hold color chips (9 colors), wall section chips (Main Wall / Cave / Slab / Overhang / Arete), grade slider (V0–V10), gym dropdown (tab version) or pre-filled gym (gym version)
- Hold color + wall section required to continue; grade defaults to V0
- On photo select + color select: `detectHolds(uri, color)` runs automatically, shows SAND bounding boxes over detected holds with dark desaturating overlay. Zero clusters → "No holds detected" label.
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
- Grade slider is pre-filled from `problemGrade` (Screen 2 match) OR `grade` (Screen 1 identify flow) — both params are read, with `problemGrade` taking priority. Without this fallback the slider would always default to V0 when coming from Screen 1.
- Context pill (hold color dot + problem name + gym). Optional nickname input (new problems only) → saved to `problems.custom_name`. Send media picker (separate from recognition photo — this IS uploaded to Supabase and posted to feed). Grade slider (pre-filled from match or Screen 1). Gym picker (pre-filled). Notes input. "LOG SESSION" submit button.
- **Nickname auto-focus** — when arriving from the "you're the first" celebration (Screen 2 passes `focusNickname=true`), the nickname `TextInput` is focused via a `ref` after a 450ms delay (lets the screen-slide animation settle before the keyboard opens). Only fires when `isNew && focusNickname === 'true'`.
- Submit sequence: (1) insert problem if new (auto-name = "Blue V4 Main Wall", custom_name if entered); (2) insert session; (3) insert climb with problem_id; (4) upload send media → update session.media_url; (5) recompute problems.media_url from most-liked session with media for this problem; (6) show "CLIMB LOGGED" for 2.5s → navigate to feed.

**Hold detection** (`src/lib/holdDetection.ts`):
- `detectHolds(imageUri, color)` → `BoundingBox[]`. Detection is an **enhancement, never a dependency** — every failure mode (throw, timeout, zero clusters) resolves to `[]` and the flow continues to metadata matching as if Skip was used. Wrapped in `Promise.race` against a **4s timeout**.
- Pipeline: downscale to **max 480px wide** PNG via `expo-image-manipulator`; decode base64 → ArrayBuffer via `base64-arraybuffer`; parse PNG chunks; decompress IDAT with `pako.inflate`; reconstruct PNG filter bytes (None/Sub/Up/Average/Paeth); convert each pixel RGB→HSL; match against `COLOR_RANGES`; flood-fill connected cells into clusters; **discard clusters smaller than 0.15% of total pixels** (relative, so it survives dimension changes); return proportional 0–1 bounding boxes.
- **Red hue wraparound** — red spans both ends of the hue circle, so its range is `h >= 345 OR h <= 15` (`hWrap: true`). All other colors use a simple `hMin..hMax` between-test.
- **One adaptive retry** — if the first pass finds zero clusters for the selected color, it retries once with relaxed bounds (`relaxRange`: hue window ±8°, sMin −15, lightness ±10 each end) for hard colored-LED gym lighting. Still nothing → continue silently (no error surfaced).

### Profile Stats Dashboard (Overview tab)
Three chart cards, all data derived from the existing sessions+climbs fetch (zero extra Supabase queries):
1. **Weekly Intensity** — `react-native-chart-kit` BarChart of problems per day Mon–Sun. Uses `withCustomBarColorFromData` + `flatColor`: selected day bar is solid `#2E7A96`, others `rgba(46,122,150,0.3)`. Tap a day chip to drill into sessions for that day.
2. **Grade Distribution** — **Custom View-based bar chart** (NOT chart-kit — it clipped V10). Collapsed card: compact 130px bars + grade chips + drill-down list. Tap `↗` to expand inline (no Modal — avoids iOS touch-blocking bugs): expanded shows 180px bars + grade chips + tappable session rows. Tap `×` to collapse. State: `selectedGrade` (collapsed) and `modalSelectedGrade` (expanded) are separate. **Tapping any climb row** (collapsed or expanded) opens the full-screen media viewer.
3. **Monthly Volume** — `react-native-chart-kit` LineChart of total problems per week for the last 12 weeks. ACCENT line color, bezier curve.

### Session Detail Screen (`/session/[id]`)
- Route: `src/app/session/[id].tsx` — presented as `fullScreenModal` (slides up over profile).
- Looks **exactly like a feed card**: full-bleed media background (or `#2a2010 → #1a1408` dark gradient if no media), bottom vignette, right action rail, bottom stats bar, @username overlay.
- **Bottom-left info** — `@username`, then `climbNickname` (SAND_LT, SpaceGrotesk_600SemiBold, 13px) if set, then `climbNotes` (white 75%, SpaceGrotesk_400Regular, 12px, max 2 lines) if set. Identical to the feed card layout. `gap: 2` between elements.
- Data fetched independently from Supabase on load: session + climbs (grade, problem_id) + profile + problems (custom_name) + likes + comment count. This is intentional — My Climbs can show sessions not in the feed's top-50 window.
- **Close** — × button top-left (Ionicons, white, safe-area offset). Tap to go back.
- **Right action rail** — avatar, ♥ like (ACCENT, optimistic), ◎ comment count, ↗ share, ⬡ gym.
- **Stats bar** — grade (SAND_LT, Syne_800ExtraBold 28px) + gym name, pinned to bottom.
- **Comment sheet** — identical to the feed comment sheet; slides up as a nested Modal. Full thread with avatars, timestamps, comment input + Send button.
- **No top tab row** (Following/For You/Nearby) — single post view.
- Registered in `_layout.tsx` as `<Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal' }} />`.
- Navigated to from: My Climbs card tap (`router.push('/session/${entry.sessionId}')`).

### Profile Edit State
Two separate state buckets to prevent live-typing from updating the displayed header:
- `editName / editUsername / editBio` — bound to the Settings form inputs; set from Supabase on every screen focus
- `displayName / displayUsername / displayBio` — what shows in the profile header; all three only update after a successful Save Changes (or on initial fetch). `toInitials(displayName)` drives the avatar fallback initials. `displayUsername` renders as `@{displayUsername}` with a null-guard so the row is hidden until data loads.

### App Tab Bar (bottom nav)
- `src/app/(tabs)/_layout.tsx` uses `usePathname()` to detect the active tab.
- **Feed tab (`/`)** — dark theme: `backgroundColor: #0d2b36`, `borderTopColor: #1a3d4f`, active tint `#ffffff`, inactive tint `rgba(255,255,255,0.38)`. Matches the full-screen dark feed background.
- **All other tabs** — light theme: `backgroundColor: #ffffff`, `borderTopColor: #c8dde8`, active tint `PRIMARY`, inactive tint `INACTIVE`. Normal app style.
- The three computed values (`tabBarStyle`, `tabBarActiveTintColor`, `tabBarInactiveTintColor`) are passed to `screenOptions` and update automatically on every tab switch.

### Profile Tab Bar
- Three equal-width tabs: **Overview · My Climbs · Settings**
- Active tab: `DMSans_800ExtraBold` label in `PRIMARY`, 2px `PRIMARY` underline indicator pinned to bottom
- Inactive tabs: same label style in `TEXT_MUTED`
- Background `BG` white, `hairlineWidth` bottom border in `DIVIDER`
- Tab bar is fixed (outside the ScrollView); profile header + tab content scroll as one page

### My Climbs Tab (grade-filtered grid)
- **Layout** — grade step-slider (left) + Clear/All button + hamburger ☰ sort button (right column). Below: grade-grouped sections ScrollView.
- **Grade step-slider** — V0–V10 step-track. `myClimbsSlider: number | null` (null = no dot highlighted on load). Tapping a dot sets `myClimbsFilter` to that grade AND highlights the dot. Dimmed dots (0.4 opacity) = grades with no climbs logged.
- **Filter logic** — `myClimbsFilter: string | null`. When set, `filteredGroups` shows only sections matching that grade. When null, all grade sections show. Computed from `climbEntries` (individual climb rows), NOT from `sessions`.
- **Clear button** — shown when filter active: SAND gold, `rgba(200,168,74,0.12)` bg, border. Resets both `myClimbsFilter` and `myClimbsSlider` to null. Shows "All" (greyed out) when no filter.
- **Sort dropdown** — tapping ☰ opens a floating dropdown. Two options: **Date** (default) · **Gym**. Applies within each grade section.
- **Grade sections** — one per grade in `filteredGroups`, ordered V0→V10. Each has a SAND grade pill + `N sends` count. `filteredGroups` is derived from `climbEntries` grouped by `e.grade`, filtered by `myClimbsFilter`.
- **3-column row grid** — `toRows()` chunks `group.entries` (ClimbEntry[]) into rows of 3. Incomplete last rows padded with invisible filler Views.
- **ClimbGridCard** — takes a `ClimbEntry` (not SupabaseSession). Shows: photo thumbnail (80px, `mediaUrl`) or 🧗 placeholder; grade in SAND (Syne_800ExtraBold); gym name; date; ▲ VITAL pill. `borderRadius: 14`. **Tapping a card** navigates to `/session/[sessionId]`.
- **ClimbEntry type** — `{ sessionId, grade, count, gymName, date, mediaUrl }`. Derived from the `climbs` table joined with session metadata. Every session has exactly one ClimbEntry (count always 1).
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
- Header with `‹` back chevron (DMSans_300Light) and centred "PROFILE" title (BebasNeue).
- Square avatar (`width: 100, height: 100, borderRadius: 16`) — real photo or PRIMARY initials fallback.
- Full name (DMSans_800ExtraBold), `@username` (DMSans_600SemiBold, TEXT_SUB), bio (DMSans_400Regular, TEXT_MUTED) — each only renders if set.
- **Follow / Following toggle button** — PRIMARY solid + white label when not following; SURFACE background + DIVIDER border + TEXT label when following. Hidden if viewing own profile (`currentUserId === id`). Optimistic: updates `isFollowing` and `followerCount` immediately, then writes to/deletes from `follows` table.
- **Follower / following counts** — tappable `X followers · Y following` row; opens bottom-sheet Modals listing those users (avatar + name/username, no action buttons since this is not your own profile).
- Stats bar (SURFACE background, borderRadius: 20): **Total Climbs · Top Grade · Gyms Visited** — computed live from the user's sessions+climbs in Supabase, same logic as the self-profile.
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
- **Profile stats dashboard** — 3 interactive charts (Weekly Intensity, Grade Distribution, Monthly Volume) in Overview tab
- **Interactive chart drill-downs** — tap day or grade chips to see climb details
- **Grade Distribution inline expand** — ↗ expands card in place (no Modal), × collapses; tapping any climb row opens the media viewer
- **Media viewer** — full-screen fade Modal, conditionally rendered; photos shown inline, videos via Linking.openURL
- **My Climbs tab** — grade-grouped 3-column grid. Grade step-slider **filters** (not scrolls) to that grade; Clear button resets. ClimbGridCard takes ClimbEntry (individual climb row), shows photo thumbnail, grade in SAND gold, gym name, date, VITAL pill. Tapping a card opens the session detail modal.
- **Session detail modal** (`/session/[id]`) — full-screen feed card experience: media fill, vignette, right rail (like/comment/share/gym), stats bar, comment sheet. Presented as `fullScreenModal`, slides up over profile.
- **Notes / description field** — multiline text input on Log screen and Gym Detail; saves to `sessions.notes`; displayed on My Climbs cards when present
- **Edit profile** — Settings tab form for Full Name, Username, Bio; saves to Supabase `profiles` table; bio shown in profile header
- **Sign out** — Log Out button in Settings tab with confirmation alert, wired to `supabase.auth.signOut()`
- **Likes — Supabase-backed** — real like counts on feed cards; optimistic toggle inserts/deletes from `likes` table; heart fills ACCENT red when liked
- **Comments — Supabase-backed** — comment sheet slides up from bottom; shows real comments with avatars; post new comments live; count updates on feed card instantly
- **User profile page** (`/user/[id]`) — view-only profile for other users: avatar, name, username, bio, stats (total climbs, top grade, gyms visited)
- **Feed — TikTok-style full-screen swipeable feed** — `FlatList pagingEnabled`, `snapToInterval = cardHeight` (measured via `onLayout`), `onViewableItemsChanged` tracks active card; full-screen photo/video or warm dark ink gradient bg; right rail with like/comment/share/gym; bottom stats bar showing grade (SAND_LT) + gym name only
- **Feed expo-av workaround** — `VideoPlayer` loaded via `try { require('expo-av').Video }` so Expo Go doesn't crash; falls back to static thumbnail; TODO marks where to restore static import for dev build
- **Feed card tap-through** — right rail avatar: own post → profile tab; other user not following → follow + animated 😊 overlay; other user already following → `/user/[id]`. Bottom-left `@username` always navigates to profile.
- **Feed ordering** — followed users' sessions shown first (chronological), then everyone else sorted by like count descending. Computed in JS in `fetchSessionPosts`: `allPosts` split into `followedPosts` (userId in `followingSet`) + `otherPosts` (sorted by `.likes` desc), then concatenated.
- **Dark tab bar on Feed** — `usePathname()` in `_layout.tsx` switches tab bar to `#0d0d0b` background + white tints on `/`; all other tabs use white bg with INK active tint
- **Profile header live from Supabase** — removed hardcoded `USER` constant; `displayName / displayUsername / displayBio` state drives the header, populated from `profiles` table on focus and committed on successful save
- **Explore tab** — search climbers AND gyms simultaneously; gym results instant from cache, climber results debounced via Supabase; "Send It." tagline when search empty; suggested climbers from shared gyms (no header/empty-state text); Follow/Following toggle (optimistic)
- **Follow system on profiles** — own profile shows "Invite Friends" (Share.share) + follower/following counts with bottom-sheet lists (following sheet has Unfollow buttons); other users' profiles show Follow/Following toggle + same count sheets
- **Gym detail two-tab layout** — "Log a Climb" (gym info + CTA) and "Current Climbs" (community climbs browser with grade slider, problem cards, video grid modal)
- **Current Climbs grade slider** — always shows V0–V10; filters section to selected grade; "No climbs logged" empty state per grade; defaults to V0 (no auto-snap)
- **Tab bar icons via Ionicons** — replaced `expo-symbols` (dev-build-only) with `@expo/vector-icons` Ionicons; works in Expo Go. Inline icons (search, settings, camera, share) also converted.
- **Gyms tab interactive map** — `react-native-maps` MapView with warm custom style, SAND dot markers, Callout popups (name / neighborhood / address / "View Gym →"). Map + list both sourced from `gyms` Supabase table via `src/lib/gyms.ts`.
- **`gyms` Supabase table** — single source of truth for all gym data (name, address, neighborhood, lat/lng). `src/lib/gyms.ts` provides `fetchGyms()` (with in-process cache) and `gymName(gyms, id)`. All hardcoded `GYM_NAMES` constants removed from every file.
- **3-screen log flow** — Screen 1 (Identify: photo + hold detection + color/wall/grade chips + gym), Screen 2 (match ProblemCard list), Screen 3 (send media + grade + notes + submit). Lives in `src/app/log-flow/`. Route: `/log-flow/match` and `/log-flow/send`.
- **On-device hold detection** — `src/lib/holdDetection.ts` using `expo-image-manipulator` + `pako`; PNG parsing + HSL color range matching + flood-fill clustering; returns bounding boxes rendered as SAND overlays on the recognition photo
- **`problems` table** — community-created climb records (gym_id, hold_color, grade, wall_section, name, custom_name, media_url). `climbs.problem_id` links each logged climb to a problem. `problems.media_url` auto-updated to the most-liked session photo on each send.
- **Feed + session detail show climb nickname + notes** — `climbNickname` (from `problems.custom_name`, SAND_LT) and `climbNotes` (from `sessions.notes`, white 75%) shown below `@username` on both feed cards and the session detail modal when set. `gap: 2` keeps them tight.
- **"You're the first." celebration** (Screen 2) — when both match passes return zero, Screen 2 shows a full-card first-logger celebration (SAND dot-grid motif, `NEW PROBLEM` label, headline + gym-name subline, `NAME YOUR CLIMB` / `Log without naming` CTAs) instead of a dead-end empty state. A Supabase query failure shows a quiet retry state instead — never the celebration.
- **Close-matches pass** — before declaring "first", Screen 2 runs a broadened query (same gym + color + grade, any wall section) and surfaces those under a `CLOSE MATCHES` label above the YES/NO actions.
- "CLIMB LOGGED" success screen (centered) after submitting a send
- Supabase database connection
- User authentication — sign up (creates profile record) and log in
- Sign up / log in screens (white background, Syne ExtraBold, premium minimal)
- Full ink/sand/cream design system across all screens

### 🔜 Phase 2
- [x] Follow infrastructure (`follows` table + RLS) — done
- [x] Follower/following counts on profiles + bottom-sheet user lists — done
- [x] Feed prioritises followed users — their posts appear first, then others by likes — done
- [ ] Push notifications
- [ ] More gyms (expand beyond NYC Vital locations)

### 🔜 Phase 3
- [x] Gym database in Supabase — done (`gyms` table, seeded with 4 NYC locations)
- [ ] Expand gym coverage beyond NYC Vital locations
- [x] Individual problem tracking — `problems` table + 3-screen log flow — done
- [ ] Leaderboards
- [ ] App Store launch

## app.json — TestFlight Config
```json
{
  "name": "Deadpoint",
  "slug": "deadpoint",
  "bundleIdentifier": "com.foxcollective.deadpoint",
  "buildNumber": "1",
  "version": "1.0.0",
  "supportsTablet": false
}
```
- Splash background: `#1a1408` (INK dark)
- Icon: `./assets/images/icon.png` — **needs a real 1024×1024 PNG** (currently placeholder)
- Splash image: `./assets/images/splash-icon.png` — replace with Deadpoint wordmark/logo
- Zero TypeScript errors as of last commit

## Important Rules for Claude Code
- Always use **expo-router** for navigation, NEVER react-navigation
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
- **Media uploads:** ALWAYS use `expo-file-system/legacy` readAsStringAsync → `base64-arraybuffer` decode() → ArrayBuffer → supabase.storage.upload(). NEVER use fetch+blob or FormData.
- **Feed profiles:** `sessions.user_id` references `auth.users`, NOT `profiles` — always batch-fetch profiles separately and join in JS
- **Gym data:** ALWAYS use `src/lib/gyms.ts` — `fetchGyms()` fetches from Supabase (cached), `gymName(gyms, id)` does the lookup. NEVER hardcode gym names, IDs, or coordinates in any screen file. There is no fallback `GYM_NAMES` constant anywhere in the codebase.
- **Icons:** ALWAYS use `@expo/vector-icons` Ionicons — NEVER use `expo-symbols` / `SymbolView` (requires dev build, crashes Expo Go)
- **Video playback:** `expo-av` IS used in the Feed (`index.tsx`) for TikTok-style video autoplay (`shouldPlay={isActive}`). It is loaded via a **dynamic `require()` inside `try/catch`** (not a static import) so Expo Go doesn't crash — if the native module is absent, `VideoPlayer` is `null` and video cards fall back to a static thumbnail. A TODO comment marks where to restore the static import once a dev build is set up. The Profile media viewer still uses `Linking.openURL(url)` as its own fallback.
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
