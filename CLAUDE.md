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

## Design System
- **Mode:** Light mode only
- **Background:** White (#ffffff)
- **Accent color:** #ff507c (coral/hot pink)
- **Typography:** Bold sans-serif, editorial feel
- **Style:** Clean, minimal, lots of white space — lifestyle app not utility app
- **Inspiration:** Strava activity cards, Baggu editorial typography

## Tech Stack
- **Framework:** React Native with Expo SDK 56
- **Navigation:** expo-router (NOT react-navigation)
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
- Users select which grades they climbed in a session

## Features — MVP (Phase 1)
- [ ] Bottom tab navigation (Feed, Gyms, Log, Profile)
- [ ] Gyms list screen
- [ ] Log a climbing session
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
- Always use **expo-router** for navigation, never react-navigation
- Always keep compatibility with **Expo SDK 56**
- Always use **#ff507c** as the accent color
- Always use **light mode** white backgrounds
- Always use **bold sans-serif** typography
- After every completed task, **commit and push to GitHub**
- GitHub repo: https://github.com/Dalexfox/deadpoint.git

## Developer Notes
- Developer: Alex Fox
- GitHub: Dalexfox
- No prior coding experience — keep explanations simple
- This is an MVP — prioritize working features over perfect code
