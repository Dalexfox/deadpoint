# Deadpoint — Project Handover Document
*Last updated: May 27, 2026*

---

## What is Deadpoint?
A social climbing tracker app for indoor bouldering gyms. Think Strava but for climbing. Users log sessions at gyms, track problems completed by V-grade, and share activity with a social feed. Friends can like and comment on sessions.

**Comparable apps:** Strava (social feed), Kaya (climb tracking), Instagram (community feed)

---

## Current Status
The app is a working MVP running on iOS simulator. Core features are functional. Ready for visual polish and social features before TestFlight beta.

### ✅ Working
- Sign up / log in (Supabase Auth)
- Bottom tab navigation: Feed, Gyms, Log, Profile
- 4 Vital gym locations listed
- Individual gym pages with V-scale climb logger (V0–V10)
- Log a session via both Log tab and Gym detail page
- Sessions and climbs save to Supabase database
- Profile screen with real stats (total climbs, gyms visited, top grade)
- "Your Sessions" on profile showing real logged sessions
- Session Logged success screen
- Profile banner with torn paper edge effect
- Add Friend button on profile (UI only, not yet functional)
- GitHub repo with all code backed up

### 🔄 In Progress
- Media upload (photo/video) — upload to Supabase Storage is broken due to React Native blob limitation. FormData fix in progress.
- Full app color system update (teal + pink dual palette)
- Profile 3-tab layout (Overview / Sessions / Settings)
- Bar chart of climbs by grade on Profile

### ❌ Not Yet Built
- Feed showing real sessions (query written but not displaying correctly)
- Friends/following system
- Likes and comments (UI exists, not connected to database)
- Edit profile (name, username, bio)
- Log out button
- Dark mode (planned for v2)
- Push notifications
- More gyms beyond NYC
- App Store submission

---

## Tech Stack
| Tool | Purpose | Cost |
|---|---|---|
| React Native + Expo SDK 56 | App framework | Free |
| expo-router | Navigation | Free |
| Supabase | Database, Auth, Storage | Free tier |
| GitHub | Code backup | Free |
| Xcode Simulator | Testing | Free |

**Monthly cost so far: $0**

Upcoming costs:
- Expo EAS Build: ~$13/month (needed for TestFlight)
- Apple Developer Account: $99/year (needed for App Store)
- Supabase Pro: $25/month (when user base grows)

---

## Design System
| Element | Value |
|---|---|
| Background | #ffffff (white) |
| Primary color | #2E7A96 (teal) — banners, active tabs, stat cards |
| Accent color | #ff507c (pink) — likes, submit buttons, wordmark, success screen |
| Dark text | #0d2b36 |
| Surface/cards | #d8eaf0 |
| Typography | Bold sans-serif, editorial, Arc'teryx-inspired |
| Mode | Light mode (dark mode planned for v2) |

**Design references:** Arc'teryx, The North Face, Baggu editorial typography

---

## Database Schema (Supabase)
```
profiles        — id, full_name, username, email, avatar_url, created_at
gyms            — id, name, neighborhood, city, created_at
sessions        — id, user_id, gym_id, total_problems, media_url, notes, created_at
climbs          — id, session_id, grade, count
follows         — follower_id, following_id, created_at
```

**RLS (Row Level Security):** Enabled on all tables.

**Auto-profile trigger:** When a user signs up, a trigger automatically creates a row in the `profiles` table.

**Storage bucket:** `session-media` (public) — for photos/videos attached to sessions.

---

## Current Gyms (Phase 1)
- Vital Climbing LES — Lower East Side, NYC (gym_id: 1)
- Vital Climbing Brooklyn — Brooklyn, NYC (gym_id: 2)
- Vital Climbing UES — Upper East Side, NYC (gym_id: 3)
- Vital Climbing UWS — Upper West Side, NYC (gym_id: 4)

---

## Project Structure
```
deadpoint/
├── src/
│   ├── app/
│   │   ├── _layout.tsx          — Root layout, auth check
│   │   ├── auth/
│   │   │   ├── login.tsx        — Login screen
│   │   │   └── signup.tsx       — Sign up screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx      — Tab bar layout
│   │   │   ├── index.tsx        — Feed screen
│   │   │   ├── gyms.tsx         — Gyms list
│   │   │   ├── log.tsx          — Log session
│   │   │   └── profile.tsx      — Profile screen
│   │   └── gym/
│   │       └── [id].tsx         — Individual gym detail + logger
│   └── lib/
│       ├── supabase.ts          — Supabase client
│       └── store.ts             — AsyncStorage helpers, media upload
├── assets/
│   └── images/
│       └── torn-paper.png       — Torn paper edge texture
├── CLAUDE.md                    — Project context for Claude Code
├── .env                         — Supabase credentials (never pushed to GitHub)
└── .gitignore                   — Protects .env
```

---

## Environment Variables
Stored in `.env` (never committed to GitHub):
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## GitHub
**Repo:** https://github.com/Dalexfox/deadpoint.git
**Branch:** main
**Note:** .env credentials are gitignored and safe.

---

## Immediate Next Steps (Priority Order)
1. **Fix media upload** — FormData approach for React Native blob limitation
2. **Fix Feed** — Show real Supabase sessions instead of placeholder data
3. **Apply dual color system** — Teal primary + pink accent across all screens
4. **Profile 3 tabs** — Overview (with bar chart) / Sessions / Settings
5. **Friends/following system** — Follow users, feed shows friends' sessions
6. **Likes + comments** — Connect UI to database
7. **Edit profile + log out** — Complete the Settings tab
8. **TestFlight beta** — Set up EAS Build + Apple Developer account

---

## Known Issues
- Media upload fails in simulator (blob limitation) — needs FormData fix
- Feed shows placeholder data, not real sessions
- Add Friend button is UI only, no functionality
- Profile photo upload saves locally but not to Supabase Storage
- Dark mode not yet implemented

---

## Key Decisions Made
- **Platform:** iOS first
- **SDK:** Expo SDK 56
- **Navigation:** expo-router only (never react-navigation)
- **Colors:** Light mode, teal primary #2E7A96, pink accent #ff507c
- **Gyms:** Starting with 4 Vital NYC locations
- **Difficulty:** V-scale (V0–V10)
- **Dark mode:** Planned for v2, not v1

---

## Developer
- **Name:** Alex Fox
- **GitHub:** Dalexfox
- **Experience:** No prior coding experience — using Claude Code + Claude as technical partners
