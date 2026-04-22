# Podkicker-style Podcast Player — PRD

## Overview
Mobile-first React Native (Expo) podcast player with a dark, audio-player aesthetic (amber on obsidian). Lets users discover, subscribe, stream and download podcast episodes — all locally, no login required.

## Users
Single-user (local-only). No authentication.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router (file-based), expo-audio, expo-file-system (downloads), AsyncStorage, @react-native-community/slider, @expo/vector-icons, expo-linear-gradient, expo-blur, expo-image.
- **Backend**: FastAPI (Python) — proxies iTunes Search API (CORS-free) and parses podcast RSS feeds with `feedparser`.
- **Storage**: AsyncStorage for subscriptions + downloads metadata; `FileSystem.documentDirectory/episodes/` for offline audio files.

## Core Features (MVP — shipped)
1. **Podcast discovery** — iTunes Search API via `/api/search` and `/api/top?genre=`.
2. **Subscribe / Unsubscribe** — persisted in AsyncStorage; shown on the Library screen.
3. **Episode list** — RSS feed parsed server-side via `/api/feed?url=`; episodes with title, description, duration, pubDate, audio URL.
4. **Full audio player** — play / pause, seek slider, skip back 15s, skip forward 30s, playback rate cycling (0.75× → 2.0×), background playback mode.
5. **Mini-Player** — persists above the bottom tab bar (and on podcast detail) while audio is active; tap opens the Now Playing modal.
6. **Offline downloads** — per-episode "Download" button uses `FileSystem.createDownloadResumable` with progress %; downloaded episodes play from local URI. Web preview shows an alert (native / Expo Go only).
7. **Tab navigation** — Library, Search, Downloads.

## Backend API
| Method | Endpoint                              | Purpose |
|--------|---------------------------------------|---------|
| GET    | `/api/`                               | Health check |
| GET    | `/api/search?term=&limit=`            | iTunes podcast search |
| GET    | `/api/top?genre=&limit=`              | Popular/genre podcasts |
| GET    | `/api/feed?url=&limit=`               | Parse RSS into JSON (title, author, image, episodes[]) |

## Design System
Follows `/app/design_guidelines.json`: background `#05050A`, surface `#0F0F14`, amber accent `#F59E0B`, generous spacing, large album art with blurred background on Now Playing, glassmorphism tab bar.

## Smart Enhancement (future-ready revenue/engagement lever)
Add a simple **"Smart Queue & Daily Digest"** feature that auto-builds a personalized play-queue from the user's subscriptions based on unplayed newest episodes and time-of-day listening patterns — high retention/engagement lever and the natural hook for a later Pro subscription (e.g., unlimited queue, transcripts, cross-device sync).

## Known Limitations
- Downloads require native/Expo Go (not supported on web preview).
- Resume-from-last-position is saved but not yet auto-restored on launch (next iteration).
