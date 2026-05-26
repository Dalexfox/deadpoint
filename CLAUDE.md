# Deadpoint — Project Context for Claude Code

## What is Deadpoint?
Deadpoint is a social climbing tracker app for indoor bouldering gyms. Think Strava, but for climbing. Users can track which gyms they've visited, log the problems they've completed, and share their sessions with a community feed — like Instagram or TikTok but for climbers.

## Core Concept
- Users visit a gym, log their climbs (problems completed, difficulty level)
- Their session is shared to a social feed visible to their friends
- Friends can like and comment on sessions
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
- **One bold accent** — #ff507c is the ONLY color pop. Everything else is white, black, or light gray
- **Performance meets culture** — this is a lifestyle app for people who take climbing seriously but also care how they look doing it

Design references: Arc'teryx (clean, premium, minimal), Outside Days (bold oversized type), Baggu (editorial white space)

## Design System
- **Mode:** Light mode only
- **Background:** White (#ffffff)
- **Accent color:** #ff507c (coral/hot pink) — use sparingly as a highlight
- **Secondary colors:** Black (#000000) for headings, mid-gray (#888888) for subtitles, light gray (#f5f5f5) for card backgrounds
- **Typography:** Bold sans-serif, oversized headings, generous letter-spacing on labels
- **Cards:** Soft rounded corners, subtle shadow, white or light gray background
- **Buttons:** Solid #ff507c with white text, rounded, bold label
- **Icons:** Simple, minimal line icons

## Tech Stack
- **Framework:** React Native with Expo SDK 56
- **Navigation:** expo-router (NOT react-navigation — NEVER use react-navigation)
- **Database:** Supabase (coming soon)
- **Auth:** Supabase Auth (coming soon)
- **Platform:** iOS first (iPhone)

## App Structure — 4 Main Tabs
1. **Feed** — Social feed of friends' climbing sessions. Cards show: user name, profile photo, gym visited, problems completed, difficulty range, timestamp, like/comment buttons
2. **Gyms** — Scrollable list of gyms. Tap to visit and log a session
3. **Log** — Log a climbing session: select gym, select difficulty (V-scale), enter problems completed, submit
4. **Profile** — User's name, stats (total climbs, gyms visited, streak), recent activity

## Current Gyms (Phase 1 — NYC)
- Vital Climbing LES (Lower East Side, NYC)
- Vital Climbing Brooklyn (Brooklyn, NYC)
- Vital Climbing UES (Upper East Side, NYC)
- Vital Climbing UWS (Upper West Side, NYC)

## Difficulty Scale
Uses the V-scale standard for bouldering:
- V0 (easiest) through V10 (hardest)
- Users select how many climbs they completed at each grade in a session

## Features — MVP (Phase 1)
- [ ] Bottom tab navigation (Feed, Gyms, Log, Profile)
- [ ] Home dashboard with personal stats
- [ ] Gyms list screen
- [ ] Individual gym detail page with V-scale climb logger
- [ ] Social feed with placeholder data
- [ ] Profile screen with stats
- [ ] Supabase database connection
- [ ] User authentication (sign up / log in)

## Features — Phase 2
- [ ] Real user accounts
- [ ] Friends / following system
- [ ] Likes and comments on sessions
- [ ] Push notifications
- [ ] More gyms (expand beyond NYC)

## Features — Phase 3
- [ ] Global gym database
- [ ] Individual problem tracking
- [ ] Leaderboards
- [ ] App Store launch

## Important Rules for Claude Code
- Always use **expo-router** for navigation, NEVER react-navigation
- Always keep compatibility with **Expo SDK 56**
- Always use **#ff507c** as the accent color — sparingly, as a highlight
- Always use **light mode** white backgrounds
- Always use **bold oversized sans-serif** typography — think Arc'teryx, not a startup
- Keep designs minimal and premium — less is more
- After every completed task, **commit and push to GitHub**
- GitHub repo: https://github.com/Dalexfox/deadpoint.git

## Developer Notes
- Developer: Alex Fox
- GitHub: Dalexfox
- No prior coding experience — keep explanations simple
- This is an MVP — prioritize working features over perfect code
