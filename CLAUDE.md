# Deadpoint — Project Context for Claude Code

## What is Deadpoint?
Deadpoint is a social climbing tracker app for indoor bouldering gyms. Think Strava, but for climbing. Users can track which gyms they've visited, log the problems they've completed, and share their sessions with a community feed — like Instagram or TikTok but for climbers.

## Core Concept
- Users visit a gym, log their climbs (problems completed, difficulty level)
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
- **Two-color system** — PRIMARY teal for structure, ACCENT pink only for key moments
- **Performance meets culture** — this is a lifestyle app for people who take climbing seriously but also care how they look doing it

Design references: Arc'teryx (clean, premium, minimal), Outside Days (bold oversized type), Baggu (editorial white space)

## Design System

### Current Color Palette (Light)
```
BG         = '#ffffff'   // Main background
CARD       = '#d8eaf0'   // Card backgrounds
SURFACE    = '#d8eaf0'   // Stats blocks, chips, grade rows
ACCENT     = '#ff507c'   // Coral/hot pink — ONLY for: like buttons, submit/log session
                         //   buttons, the Deadpoint wordmark, success screens
PRIMARY    = '#2E7A96'   // Teal — active tabs, banners, gym tags, selectors, session bars
TEXT       = '#0d2b36'   // Primary text
TEXT_SUB   = '#3d7a8a'   // Subtitles, secondary text
TEXT_MUTED = '#8bb5c4'   // Muted labels, section headers
DIVIDER    = '#c8dde8'   // Hairline dividers
```

**ACCENT usage rules — use sparingly:**
- ✅ Like buttons (heart icon + count)
- ✅ Submit / Log Session buttons
- ✅ The Deadpoint wordmark on auth screens
- ✅ "SESSION LOGGED" success screen title
- ✅ Add Friend button border + text (social action)
- ✅ Monthly Volume line chart line color
- ✅ Peak bar in Grade Distribution chart
- ✅ Comment sheet Send button
- ❌ Navigation buttons → use PRIMARY
- ❌ Grade selectors / radio buttons → use PRIMARY
- ❌ Banners / stat cards → use PRIMARY

### Auth Screens (white background — intentionally different from main app)
- Background: `#ffffff`
- Heading text: `#0d2b36`
- Subtext: `#888888`
- Inputs: `#f5f5f5` fill, `borderRadius: 14`, text `#0d2b36`
- Wordmark / accent: `#ff507c`
- Submit button: ACCENT (`#ff507c`)

### Typography
- **Display / Headings:** `BebasNeue_400Regular` — all caps, large, editorial
  - Screen titles: 42px, letterSpacing: 1
  - Auth headings: 58px, letterSpacing: 1
  - Gym detail name: 40px
- **Body / UI:** DM Sans family
  - `DMSans_800ExtraBold` — card names, stat values, button labels
  - `DMSans_700Bold` — gym names, action counts, dates
  - `DMSans_600SemiBold` — subtitles, metadata, descriptions
  - `DMSans_500Medium` — form inputs
  - `DMSans_400Regular` — counter buttons
  - `DMSans_300Light` — back arrow chevron
- Section labels: 11px, DMSans_800ExtraBold, letterSpacing: 1.4, TEXT_MUTED color

### Cards
- `borderRadius: 20`, `borderWidth: 1.5`, `borderColor: DIVIDER`
- Stats/surface blocks: `borderRadius: 14`, `backgroundColor: SURFACE`
- Grade chips: `borderRadius: 10`, `backgroundColor: SURFACE` (active: `TEXT` `#0d2b36` bg + white label; unselected: SURFACE bg + TEXT label)

### Feed Cards — two variants
**With photo (full-bleed):**
- Card: `backgroundColor: BG`, `borderRadius: 20`, `overflow: hidden`, `borderWidth: 1.5 / DIVIDER`
- Hero image fills full card width, `height: 300`, `resizeMode: cover`
- `LinearGradient` (`rgba(0,0,0,0.58) → transparent`) overlays top 130px — avatar, name, gym, timestamp sit inside it in white text
- Stats (PROBLEMS / DIFFICULTY) + like/comment actions in a white strip below the image, single compact row
- Avatar in overlay: square `borderRadius ~30%`, semi-transparent white ring border

**Without photo (plain):**
- `backgroundColor: CARD`, `borderRadius: 20`, `padding: 20` — existing layout unchanged

### Profile Session Carousel Cards
- `borderRadius: 20`, `backgroundColor: CARD`
- `borderWidth: 1.5`, `borderColor: '#b0cdd8'` — light blue border
- Teal `▲ VITAL` pill (PRIMARY background), BebasNeue gym name, date below
- Hairline divider, grade summary text, PRIMARY problems badge (pill)
- Width: `SCREEN_WIDTH - 20 - CARD_GAP - CARD_PEEK` (peeks next card in from right)

### Buttons
- Submit/CTA: `backgroundColor: ACCENT`, `borderRadius: 16`, `paddingVertical: 18`
- Shadow: `shadowColor: ACCENT`, `shadowOpacity: 0.4`, `shadowRadius: 16`
- Label: `DMSans_800ExtraBold`, 17px, `color: '#ffffff'`
- Navigation CTA (e.g. "Log →"): `backgroundColor: PRIMARY`, same shape, white label

### Profile Avatar
- **Square** with soft corners: `width: 100, height: 100, borderRadius: 16`
- Edit badge: square `borderRadius: 8`, ACCENT background, bottom-right corner
- Default background: PRIMARY (not ACCENT)
- Border: `borderWidth: 3, borderColor: BG` (white ring separating avatar from banner)
- Avatar uploads to Supabase Storage (`avatars/{userId}.jpg`) and `profiles.avatar_url` is updated — propagates to all feed cards

### Profile Banner
- Full-width, height 140, sits at top of profile scroll
- Placeholder: `backgroundColor: PRIMARY`
- Camera button (top-right) to change it: `aspect: [3, 1]` crop
- Avatar overlaps banner by 36px (`marginTop: -36`)

## Tech Stack
- **Framework:** React Native with Expo SDK 56
- **Navigation:** expo-router (NOT react-navigation — NEVER use react-navigation)
- **Database:** Supabase (live — `src/lib/supabase.ts`)
- **Auth:** Supabase Auth (live — email/password)
- **Fonts:** `@expo-google-fonts/bebas-neue`, `@expo-google-fonts/dm-sans`
- **Storage:** `@react-native-async-storage/async-storage` (avatar URL cache, banner, photo posts)
- **Media:** `expo-image-picker` (photos and videos)
- **File I/O:** `expo-file-system/legacy` — MUST use the `/legacy` subpath in SDK 56; `readAsStringAsync` was moved there
- **Base64 decode:** `base64-arraybuffer` — use `decode()` for reliable base64→ArrayBuffer in Hermes (never atob())
- **Charts:** `react-native-chart-kit` + `react-native-svg` — BarChart (Weekly Intensity) and LineChart (Monthly Volume) on Profile. Grade Distribution uses a fully custom View-based bar chart (no chart-kit) to avoid label clipping.
- **Gradients:** `expo-linear-gradient` (feed card photo overlay)
- **Video:** `expo-av` is installed (`package.json`) but **requires a development build** — it does NOT work in Expo Go (throws `ExponentAV` native module error). For video playback in Expo Go, use `Linking.openURL(url)` to hand off to the system player. When a dev build is available, swap in `expo-av Video`.
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
  created_at timestamp with time zone default now()
)

-- Individual climbs within a session
climbs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  grade text,
  count int
)

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

### ⚠️ No `gyms` table
Gym names are resolved locally via a `GYM_NAMES` constant in each file that needs them:
```ts
const GYM_NAMES: Record<string, string> = {
  '1': 'Vital LES', '2': 'Vital Brooklyn', '3': 'Vital UES', '4': 'Vital UWS',
};
```

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
    _layout.tsx        — Tab bar (Feed, Gyms, Explore, Log, Profile)
    index.tsx          — Feed screen
    gyms.tsx           — Gyms list
    explore.tsx        — Explore / find climbers
    log.tsx            — Log a session
    profile.tsx        — User profile
  gym/
    [id].tsx           — Gym detail + per-grade climb counter (saves to Supabase)
  user/
    [id].tsx           — View-only profile page for other users
```

### Key Source Files
```
src/lib/
  supabase.ts          — Supabase client (import this everywhere)
  store.ts             — AsyncStorage helpers, media upload, avatar upload
```

### 5 Main Tabs
1. **Feed** — TikTok-style full-screen vertical swipeable feed. Each session card fills the entire content area (measured via `onLayout` — window height minus status bar and tab bar). Swipe up/down with `FlatList pagingEnabled + snapToInterval`. Sessions fetched from Supabase ordered by `created_at` descending. `onViewableItemsChanged` (stable ref) tracks the active card index for video autoplay. Cards with media_url show a full-screen photo/video background; cards without show a teal→dark gradient (`#2E7A96 → #0d2b36`). Bottom vignette gradient for readability. Likes and comments are Supabase-backed. **expo-av Video** is used for video autoplay (`shouldPlay={isActive}`) — requires a dev build, crashes in Expo Go.
2. **Gyms** — List of 4 Vital Climbing NYC locations. Tap → Gym Detail screen.
3. **Explore** — Find and follow other climbers. See Explore tab section below.
4. **Log** — Log one climb at a time: add optional photo/video, pick difficulty (V-scale chip), pick gym. Saves to Supabase (`sessions` + `climbs` tables) with `total_problems: 1` and a single climb row `{ grade, count: 1 }`. Media uploaded to Supabase Storage. Success screen shown after submit. Form order: Photo/Video → Difficulty → Gym → Submit.
5. **Profile** — Fixed title header ("Profile" + `+` share button + gear icon). Fixed 3-tab bar (Overview / Sessions / Settings) below it. The rest of the page scrolls as one unit.
   - **Overview tab** — Stats bar (Total Climbs · Gyms Visited · Top Grade) pinned directly below the tab bar (white BG, hairline bottom border), then 3 interactive chart cards (Weekly Intensity, Grade Distribution, Monthly Volume) scrolling below. Stats bar is hidden on Sessions and Settings tabs.
   - **Sessions tab** — swipeable horizontal carousel of past sessions.
   - **Settings tab** — Edit Profile form (Full Name, Username, Bio inputs pre-filled from Supabase; Save Changes button in ACCENT pink; bio display in header only updates after a successful save). Log Out button (outlined red `#e53935`, confirmation alert before signing out).
   - Banner (tappable, persisted via AsyncStorage) + square avatar (tappable, uploads to Supabase Storage + updates `profiles.avatar_url`) scroll with the page above the tab bar.
   - Bio displayed below `@username` in the identity row (TEXT_MUTED, 14px, DMSans_400Regular) — only rendered when non-empty.
   - Stats bar fetched live from Supabase on every focus; rendered conditionally (`activeTab === 'overview'`).
   - **Invite Friends** button (PRIMARY teal outline) on the identity row — triggers `Share.share()` with an invite message.
   - **Follower / following counts** row below the identity block — tapping "followers" or "following" opens a bottom-sheet Modal listing those users.
   - **Followers sheet** — avatar + name/username list; no action buttons (read-only).
   - **Following sheet** — same list with an "Unfollow" button per row; optimistic: removes row and decrements count immediately.

### Feed Card Layout (TikTok-style full-screen)
Each card is a `View` sized `{ width: SCREEN_WIDTH, height: cardHeight }` with all overlays `position: 'absolute'`:

- **Background** — full-screen `Image` (photo) or `expo-av Video` (`shouldPlay={isActive}`, `isLooping`) for media sessions; `LinearGradient '#2E7A96 → #0d2b36'` for sessions without media.
- **Bottom vignette** — `LinearGradient transparent → rgba(0,0,0,0.75)` from 42% down, `pointerEvents="none"`.
- **Top tab row** — `absolute, top: 14`. Three tabs: `Following` (inactive, `rgba(255,255,255,0.55)`) | `For You` (active, white bold + ACCENT 2.5px underline with `alignSelf: 'stretch'`) | `Nearby` (inactive). Following and Nearby are placeholder touchables for Phase 2.
- **Right action rail** — `absolute, right: 12, bottom: STATS_BAR_H + 20`. Five items stacked with `gap: 22`:
  1. Avatar circle (50px, white ring border, `overflow: hidden`) + "follow" label → `onPressUser`
  2. Heart `♥/♡` + like count → `onLike` (filled ACCENT when liked)
  3. `◎` + comment count → `onComment` (opens comment sheet)
  4. `↗` + "share" label → `Share.share()` native sheet
  5. `⬡` + "gym" label → `router.push('/gym/[gymId]')`
- **Bottom-left info** — `absolute, left: 16, right: 80, bottom: STATS_BAR_H + 16`. Shows `@username` (DMSans_800ExtraBold, white) only.
- **Stats bar** — `absolute, bottom: 0`, full width, `height: 64`, `backgroundColor: rgba(0,0,0,0.50)`. Two sections separated by a hairline divider: **left** — `topGrade` in ACCENT pink (`#ff507c`, 22px DMSans_800ExtraBold) + `GRADE` label (8px muted white); **right** — `📍  gymName` in white (16px DMSans_600SemiBold, `numberOfLines={1}`).

### Feed Search
- Search bar was removed from the Feed in the TikTok rewrite. Lives in Explore tab (Phase 2 plan).

### Feed Card Tap-Through
- Right rail avatar + "follow" tap → `onPressUser`: own profile → `/(tabs)/profile`, other → `/user/[id]`.
- `post.userId` is set from `session.user_id` in `fetchSessionPosts` and stored as `userId?: string` on the `Post` type in `store.ts`.

### Explore Tab (`/explore`)
- "EXPLORE" BebasNeue header, SURFACE search bar with `magnifyingglass` SF Symbol icon
- **Search** — TextInput debounced 350ms; queries `profiles` with `.ilike('username', '%q%')`; filters out the current user. Results show when query is non-empty.
- **Suggested Climbers** — shown when search is empty. Finds users who have sessions at the same gyms as the current user (queries `sessions` by `gym_id`), excludes self and already-followed users, batch-fetches their profiles.
- **User rows** — circular avatar (real photo or PRIMARY initials fallback), `full_name` (DMSans_800ExtraBold), `@username` (DMSans_600SemiBold, TEXT_SUB), Follow/Following toggle button.
- **Follow button** — PRIMARY solid background + white label when not following; SURFACE background + DIVIDER border + TEXT_MUTED label when following. Optimistic: UI updates immediately, then writes to/deletes from `follows` table.
- **Empty state** — "Log a session to find climbers at your gym." shown if no suggestions.
- `followingSet` is a `Set<string>` of following_ids; refreshed on every screen focus via `useFocusEffect`.

### Gym Detail (`/gym/[id]`)
- Logs one climb at a time: optional photo/video, single V-grade chip selector (V0–V10), fixed Submit button in footer
- Form order: Photo/Video → Difficulty → Submit (gym is already shown in the fixed header)
- Submit saves `total_problems: 1` to `sessions` and one `climbs` row `{ grade, count: 1 }`
- Requires authenticated user (`supabase.auth.getUser()`)
- Shows "SESSION LOGGED" success screen for 2.5s, then navigates back to Gyms tab
- `useFocusEffect` on Profile tab picks up new sessions automatically on next visit

### Profile Stats Dashboard (Overview tab)
Three chart cards, all data derived from the existing sessions+climbs fetch (zero extra Supabase queries):
1. **Weekly Intensity** — `react-native-chart-kit` BarChart of problems per day Mon–Sun. Uses `withCustomBarColorFromData` + `flatColor`: selected day bar is solid `#2E7A96`, others `rgba(46,122,150,0.3)`. Tap a day chip to drill into sessions for that day.
2. **Grade Distribution** — **Custom View-based bar chart** (NOT chart-kit — it clipped V10). Collapsed card: compact 130px bars + grade chips + drill-down list. Tap `↗` to expand inline (no Modal — avoids iOS touch-blocking bugs): expanded shows 180px bars + grade chips + tappable session rows. Tap `×` to collapse. State: `selectedGrade` (collapsed) and `modalSelectedGrade` (expanded) are separate. **Tapping any climb row** (collapsed or expanded) opens the full-screen media viewer.
3. **Monthly Volume** — `react-native-chart-kit` LineChart of total problems per week for the last 12 weeks. ACCENT line color, bezier curve.

### Profile Media Viewer
- Full-screen `Modal` with `animationType="fade"`, **conditionally rendered** (`{mediaViewerVisible && <Modal>}`) so it fully unmounts on close and never blocks touches on the profile scroll view.
- **Photos** — `Image` component, `resizeMode="contain"`, black background, info strip at bottom (gym · grade count · date).
- **Videos** — `Linking.openURL(url)` hands off to the iPhone system player (expo-av requires a dev build and crashes in Expo Go).
- **No media** — centred "No media attached" white text on black background.
- Close `×` button top-right (white, always visible).

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
- Three equal-width tabs: **Overview · Sessions · Settings**
- Active tab: `DMSans_800ExtraBold` label in `PRIMARY`, 2px `PRIMARY` underline indicator pinned to bottom
- Inactive tabs: same label style in `TEXT_MUTED`
- Background `BG` white, `hairlineWidth` bottom border in `DIVIDER`
- Tab bar is fixed (outside the ScrollView); profile header + tab content scroll as one page

### Profile Session Carousel
- Swipeable horizontal carousel with peek (next card visible at right edge)
- `snapToInterval={CARD_WIDTH + CARD_GAP}`, `decelerationRate="fast"` — NOT `pagingEnabled`
- Dot indicator (pills) below carousel, "X / Y" counter
- Each card: teal `▲ VITAL` pill, BebasNeue gym name, date, grade summary, problems badge
- `borderWidth: 1.5, borderColor: '#b0cdd8'` (light blue border)

### Feed Likes & Comments (Supabase-backed)
- **Like toggle** — optimistic: UI updates immediately, then inserts/deletes from `likes` table in background. Heart filled ACCENT when liked, outline when not.
- **Feed load** — `fetchSessionPosts` fires 3 parallel queries (profiles, likes, comments) and builds counts + liked-by-me state in JS maps. No waterfall.
- **Comment sheet** — conditionally rendered `{commentSheetVisible && <Modal>}` (slide animation, transparent backdrop). Layout: flex:1 `TouchableOpacity` fills space above the sheet to dismiss on backdrop tap; `KeyboardAvoidingView` wraps the sheet panel at the bottom.
- Comment rows show real avatar photo (`borderRadius: 11` square) when `avatar_url` is set, initials fallback otherwise.
- **Tap commenter name** — closes the sheet, then navigates: own comment → `/(tabs)/profile`; other user → `/user/[userId]`.
- **Tap avatar / name on feed card** — navigates to profile without opening the comment sheet (see Feed Card Tap-Through above).
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
- Vital Climbing LES (id: 1, Lower East Side)
- Vital Climbing Brooklyn (id: 2, Brooklyn)
- Vital Climbing UES (id: 3, Upper East Side)
- Vital Climbing UWS (id: 4, Upper West Side)

## Difficulty Scale
V-scale standard for bouldering: V0 (easiest) through V10 (hardest).
On the Log screen, users pick a single overall difficulty.
On Gym Detail, users log how many problems at each grade individually.

## Post Types
Posts have a `postType` field: `'session'` or `'photo'`
- **session** — has `gym`, `problems`, `difficulty`. Shows stats block in feed card.
- **photo** — has `media` only. No stats block. Created from Profile `+` button.

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
- **Profile 3-tab layout** — Overview / Sessions / Settings tabs with fixed tab bar
- **Profile stats dashboard** — 3 interactive charts (Weekly Intensity, Grade Distribution, Monthly Volume) in Overview tab
- **Interactive chart drill-downs** — tap day or grade chips to see climb details
- **Grade Distribution inline expand** — ↗ expands card in place (no Modal), × collapses; tapping any climb row opens the media viewer
- **Media viewer** — full-screen fade Modal, conditionally rendered; photos shown inline, videos via Linking.openURL
- **Session carousel** — swipeable peek carousel with light blue border cards in Sessions tab
- **Edit profile** — Settings tab form for Full Name, Username, Bio; saves to Supabase `profiles` table; bio shown in profile header
- **Sign out** — Log Out button in Settings tab with confirmation alert, wired to `supabase.auth.signOut()`
- **Likes — Supabase-backed** — real like counts on feed cards; optimistic toggle inserts/deletes from `likes` table; heart fills ACCENT pink when liked
- **Comments — Supabase-backed** — comment sheet slides up from bottom; shows real comments with avatars; post new comments live; count updates on feed card instantly
- **User profile page** (`/user/[id]`) — view-only profile for other users: avatar, name, username, bio, stats (total climbs, top grade, gyms visited)
- **Feed — TikTok-style full-screen swipeable feed** — `FlatList pagingEnabled`, `snapToInterval = cardHeight` (measured via `onLayout`), `onViewableItemsChanged` tracks active card; full-screen photo/video or gradient bg; right rail with like/comment/share/gym; bottom stats bar with grade mini bars
- **Feed expo-av workaround** — `VideoPlayer` loaded via `try { require('expo-av').Video }` so Expo Go doesn't crash; falls back to static thumbnail; TODO marks where to restore static import for dev build
- **Feed card tap-through** — right rail avatar navigates to that user's profile (own → Profile tab, other → `/user/[id]`)
- **Dark tab bar on Feed** — `usePathname()` in `_layout.tsx` switches tab bar to `#0d2b36` background + white tints on `/`; all other tabs use the normal light style
- **Profile header live from Supabase** — removed hardcoded `USER` constant; `displayName / displayUsername / displayBio` state drives the header, populated from `profiles` table on focus and committed on successful save
- **Explore tab** — search climbers by username (`ilike`), suggested climbers from shared gyms, Follow/Following toggle (optimistic, writes to `follows` table)
- **Follow system on profiles** — own profile shows "Invite Friends" (Share.share) + follower/following counts with bottom-sheet lists (following sheet has Unfollow buttons); other users' profiles show Follow/Following toggle + same count sheets
- "SESSION LOGGED" success screen on both Log tab and Gym Detail
- Supabase database connection
- User authentication — sign up (creates profile record) and log in
- Sign up / log in screens (white background, Bebas Neue, premium minimal)
- Full light color system across all screens

### 🔜 Phase 2
- [x] Follow infrastructure (`follows` table + RLS) — done
- [x] Follower/following counts on profiles + bottom-sheet user lists — done
- [ ] Feed filtered to followed users only
- [ ] Push notifications
- [ ] More gyms (expand beyond NYC Vital locations)

### 🔜 Phase 3
- [ ] Global gym database
- [ ] Individual problem tracking
- [ ] Leaderboards
- [ ] App Store launch

## Important Rules for Claude Code
- Always use **expo-router** for navigation, NEVER react-navigation
- Always keep compatibility with **Expo SDK 56**
- Use the **light palette** defined above — BG white, CARD/SURFACE `#d8eaf0`, PRIMARY `#2E7A96`, ACCENT `#ff507c`
- ACCENT (`#ff507c`) is ONLY for: like buttons, submit/log buttons, wordmark, success screen titles, Monthly Volume chart line, Grade Distribution peak bar
- PRIMARY (`#2E7A96`) is for: everything else that needs a color — tabs, banners, gym tags, selectors, nav buttons, carousel pills
- Auth screens use **white backgrounds** with `#0d2b36` heading text — intentionally minimal
- **Bebas Neue** for all display headings, **DM Sans** for all body/UI text
- Profile avatar is **square** (`borderRadius: 16`) — NOT circular
- Always import Supabase from `src/lib/supabase.ts`
- Keep `.env` out of git — credentials go there only
- Keep designs minimal and premium — less is more
- **Media uploads:** ALWAYS use `expo-file-system/legacy` readAsStringAsync → `base64-arraybuffer` decode() → ArrayBuffer → supabase.storage.upload(). NEVER use fetch+blob or FormData.
- **Feed profiles:** `sessions.user_id` references `auth.users`, NOT `profiles` — always batch-fetch profiles separately and join in JS
- **Gym names:** there is no `gyms` table — use a local `GYM_NAMES` constant in each file
- **Video playback:** `expo-av` IS used in the Feed (`index.tsx`) for TikTok-style video autoplay (`shouldPlay={isActive}`). It is loaded via a **dynamic `require()` inside `try/catch`** (not a static import) so Expo Go doesn't crash — if the native module is absent, `VideoPlayer` is `null` and video cards fall back to a static thumbnail. A TODO comment marks where to restore the static import once a dev build is set up. The Profile media viewer still uses `Linking.openURL(url)` as its own fallback.
- **Chart cards:** NEVER add `overflow: 'hidden'` to chart card containers — on iOS it clips hit-testing and prevents taps on rows inside expanded cards. Charts are sized correctly so nothing bleeds out.
- **Modals that overlay scrollable content:** ALWAYS conditionally render them (`{visible && <Modal visible>}`) so they fully unmount when closed and cannot intercept touches on the screen behind them.
- **Never hardcode user data** — names, usernames, initials, and any other per-user values must always come from Supabase (`profiles` table) via state variables. No `const USER = { name: '...' }` constants or similar placeholders in production code. Use the `displayName / displayUsername / displayBio` pattern (committed header state) and `toInitials(displayName)` for avatar fallbacks.
- After every completed task, **commit and push to GitHub**
- GitHub repo: https://github.com/Dalexfox/deadpoint.git

## Developer Notes
- Developer: Alex Fox
- GitHub: Dalexfox
- No prior coding experience — keep explanations simple and well-commented
- This is an MVP — prioritize working features over perfect code
