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
- `borderRadius: 20`, `backgroundColor: CARD`, no border, no shadow
- Stats/surface blocks: `borderRadius: 14`, `backgroundColor: SURFACE`
- Grade chips: `borderRadius: 12`, `backgroundColor: SURFACE` (active: `PRIMARY`)

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
- **Storage:** `@react-native-async-storage/async-storage` (avatar, banner, photo posts)
- **Media:** `expo-image-picker` (photos and videos)
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
  created_at timestamp with time zone default now()
)

-- Climbing sessions
sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  gym_id text,
  total_problems int,
  created_at timestamp with time zone default now()
)

-- Individual climbs within a session
climbs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  grade text,
  count int
)
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
    _layout.tsx        — Tab bar (Feed, Gyms, Log, Profile)
    index.tsx          — Feed screen
    gyms.tsx           — Gyms list
    log.tsx            — Log a session
    profile.tsx        — User profile
  gym/
    [id].tsx           — Gym detail + per-grade climb counter (saves to Supabase)
```

### Key Source Files
```
src/lib/
  supabase.ts          — Supabase client (import this everywhere)
  store.ts             — AsyncStorage helpers: profile avatar, profile banner, photo posts
```

### 4 Main Tabs
1. **Feed** — Social feed. Shows user-created photo posts (from AsyncStorage) + placeholder session posts. Cards support session posts (gym + stats) and photo/video posts. Likes are interactive.
2. **Gyms** — List of 4 Vital Climbing NYC locations. Tap → Gym Detail screen.
3. **Log** — Log a session: pick gym, pick difficulty (V-scale chip), set problem count, optional photo/video. Saves to Supabase (`sessions` + `climbs` tables). Success screen shown after submit.
4. **Profile** — Banner image (tappable, persisted via AsyncStorage) + square avatar (tappable, persisted via AsyncStorage). Real stats and session history fetched live from Supabase on every focus. `+` button in header to share photo/video directly to feed. Add Friend outline button.

### Gym Detail (`/gym/[id]`)
- Per-grade counter (V0–V10) with increment/decrement
- Submit saves to Supabase `sessions` + `climbs` tables (one row per grade)
- Requires authenticated user (`supabase.auth.getUser()`)
- Shows "SESSION LOGGED" success screen for 2.5s, then navigates back to Gyms tab
- `useFocusEffect` on Profile tab picks up new sessions automatically on next visit

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
- Bottom tab navigation (Feed, Gyms, Log, Profile)
- Gym detail page with per-grade V-scale climb logger (saves to Supabase)
- Log tab saves sessions to Supabase (`sessions` + `climbs` tables)
- Social feed with placeholder data + interactive likes
- Photo/video upload from Log screen and Profile
- Profile screen with real stats and session history from Supabase (refreshes on every focus)
- Profile photo — tappable square avatar, persisted via AsyncStorage
- Profile banner — full-width tappable banner with camera button, persisted via AsyncStorage
- Add Friend outline button on Profile
- "SESSION LOGGED" success screen on both Log tab and Gym Detail
- Supabase database connection
- User authentication — sign up (creates profile record) and log in
- Sign up / log in screens (white background, Bebas Neue, premium minimal)
- Full light color system across all screens

### 🔜 Phase 2
- [ ] Connect feed to real Supabase data (replace placeholder posts)
- [ ] Sign out button on Profile settings
- [ ] Friends / following system
- [ ] Likes and comments persisted in Supabase
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
- ACCENT (`#ff507c`) is ONLY for: like buttons, submit/log buttons, wordmark, success screen titles, Add Friend button
- PRIMARY (`#2E7A96`) is for: everything else that needs a color — tabs, banners, gym tags, selectors, nav buttons
- Auth screens use **white backgrounds** with `#0d2b36` heading text — intentionally minimal
- **Bebas Neue** for all display headings, **DM Sans** for all body/UI text
- Profile avatar is **square** (`borderRadius: 16`) — NOT circular
- Always import Supabase from `src/lib/supabase.ts`
- Keep `.env` out of git — credentials go there only
- Keep designs minimal and premium — less is more
- After every completed task, **commit and push to GitHub**
- GitHub repo: https://github.com/Dalexfox/deadpoint.git

## Developer Notes
- Developer: Alex Fox
- GitHub: Dalexfox
- No prior coding experience — keep explanations simple and well-commented
- This is an MVP — prioritize working features over perfect code
