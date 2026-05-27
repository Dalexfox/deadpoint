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
- **One bold accent** — #ff507c is the ONLY color pop. Everything else follows the palette below
- **Performance meets culture** — this is a lifestyle app for people who take climbing seriously but also care how they look doing it

Design references: Arc'teryx (clean, premium, minimal), Outside Days (bold oversized type), Baggu (editorial white space)

## Design System

### Current Color Palette (Dark Teal — may be updated to a lighter palette in future)
```
BG       = '#0c1e21'   // Main background (dark teal-black)
CARD     = '#142829'   // Card backgrounds
SURFACE  = '#1a3235'   // Stats blocks, chips, grade rows
ACCENT   = '#ff507c'   // Coral/hot pink — buttons, likes, badges (use sparingly)
TEAL     = '#4da8ae'   // Gym labels, teal accent text
TEXT     = '#ffffff'   // Primary text
TEXT_SUB = '#7ab4b8'   // Subtitles, secondary text
TEXT_MUTED = '#3d6b6f' // Muted labels, section headers
DIVIDER  = '#1e3840'   // Hairline dividers
```

### Auth Screens (white background — intentionally different from main app)
- Background: `#ffffff`
- Text: `#000000`
- Inputs: `#f5f5f5` fill, `borderRadius: 14`
- Accent: `#ff507c`

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
- `borderRadius: 20`, `backgroundColor: CARD`, no border — no shadow (dark mode)
- Stats/surface blocks: `borderRadius: 14`, `backgroundColor: SURFACE`
- Grade chips: `borderRadius: 12`, `backgroundColor: SURFACE`

### Buttons
- Primary: `backgroundColor: ACCENT`, `borderRadius: 16`, `paddingVertical: 18`
- Shadow: `shadowColor: ACCENT`, `shadowOpacity: 0.4`, `shadowRadius: 16`
- Label: `DMSans_800ExtraBold`, 17px, white

### Profile Avatar
- **Square** with soft corners: `width: 100, height: 100, borderRadius: 16`
- Edit badge: square `borderRadius: 8`, ACCENT background, bottom-right corner

## Tech Stack
- **Framework:** React Native with Expo SDK 56
- **Navigation:** expo-router (NOT react-navigation — NEVER use react-navigation)
- **Database:** Supabase (live — `src/lib/supabase.ts`)
- **Auth:** Supabase Auth (live — email/password)
- **Fonts:** `@expo-google-fonts/bebas-neue`, `@expo-google-fonts/dm-sans`
- **Storage:** `@react-native-async-storage/async-storage` (local posts/profile avatar)
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
  store.ts             — AsyncStorage helpers for local posts and profile avatar
```

### 4 Main Tabs
1. **Feed** — Social feed. Shows user-created posts (from AsyncStorage) + placeholder posts. Cards support session posts (gym + stats) and photo/video posts. Likes are interactive.
2. **Gyms** — List of 4 Vital Climbing NYC locations. Tap → Gym Detail screen.
3. **Log** — Log a session: pick gym, pick difficulty (V-scale chip), set problem count, optional photo/video. Saves to AsyncStorage. Success screen shown after submit.
4. **Profile** — Square avatar (tappable, persisted via AsyncStorage), stats row, real posts from store. `+` button in header to share photo/video directly to feed.

### Gym Detail (`/gym/[id]`)
- Per-grade counter (V0–V10) with increment/decrement
- Submit saves to Supabase `sessions` + `climbs` tables
- Requires authenticated user (`supabase.auth.getUser()`)

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
- Social feed with placeholder data + interactive likes
- Photo/video upload from Log screen and Profile
- Profile screen with stats and real post history
- Profile photo (tappable avatar, persisted locally)
- Supabase database connection
- User authentication — sign up (creates profile record) and log in
- Sign up / log in screens (white background, Bebas Neue, premium minimal)

### 🔜 Phase 2
- [ ] Connect feed to real Supabase data (replace AsyncStorage posts)
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
- Always use **#ff507c** as the accent color — sparingly, as a highlight
- Use the **dark teal palette** defined above (may be updated to lighter palette)
- Auth screens use **white backgrounds** — intentionally different from main app
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
