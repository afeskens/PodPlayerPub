# Podkicker-style Podcast Player — PRD

## Overview
Mobile-first React Native (Expo) podcast player with a dark, audio-player aesthetic (amber on obsidian). Lets users discover, subscribe, stream and download podcast episodes — all locally, no login required.

## Users
Single-user (local-only). No authentication.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router (file-based), expo-audio, expo-file-system (downloads), AsyncStorage, @react-native-community/slider, react-native-draggable-flatlist, @expo/vector-icons, expo-linear-gradient, expo-blur, expo-image.
- **Backend**: FastAPI (Python) — proxies iTunes Search API (CORS-free) and parses podcast RSS feeds with `feedparser`.
- **Storage**: AsyncStorage for subscriptions, downloads metadata, and user settings; `FileSystem.documentDirectory/episodes/` for offline audio files.

## Navigation (4 bottom tabs)
1. **Search** (`/`) — live iTunes search. Each result has an inline round +/✓ button to subscribe/unsubscribe instantly. Tapping the row opens the podcast detail hero.
2. **Latest** (`/latest`) — aggregates the latest episodes across all subscribed podcasts, sorted by publication date. Circular refresh button in the header re-fetches all feeds. **Long-press an episode (≥400 ms)** to download it offline.
3. **Playlist** (`/playlist`) — list of downloaded episodes. **Hold-drag an episode to reorder the queue.** Full player controls docked at the bottom (prev, skip-back, play/pause, skip-forward, next, slider, playback rate). Tap a row to play; the × button deletes the download.
4. **Settings** (`/settings`) — Storage segmented control (Internal / SD Card, SD card enabled on Android only), Skip-forward and Skip-backward chips [10, 15, 30, 45, 60, 90] seconds, and About info. All settings persist via AsyncStorage and are used by the player immediately.

Plus a stack route `/podcast/[id]` for the full podcast detail hero, and a modal `/player` for the Now Playing screen.

## Backend API
| Method | Endpoint                              | Purpose |
|--------|---------------------------------------|---------|
| GET    | `/api/`                               | Health check |
| GET    | `/api/search?term=&limit=`            | iTunes podcast search |
| GET    | `/api/top?genre=&limit=`              | Popular/genre podcasts |
| GET    | `/api/feed?url=&limit=`               | Parse RSS into JSON (title, author, image, episodes[]) |

## Design System
Follows `/app/design_guidelines.json`: background `#05050A`, surface `#0F0F14`, amber accent `#F59E0B`, generous spacing, glassmorphism tab bar, blurred album-art backgrounds on the Now Playing screen.

## Smart Enhancement
"Smart Queue & Daily Digest" — auto-builds a personalized play queue from subscriptions based on unplayed newest episodes + listening time-of-day patterns. Strong retention lever and natural hook for a future Pro tier.

## Known Limitations
- Offline downloads require native/Expo Go (web preview shows an alert — mobile filesystem isn't available in browser).
- "SD Card" storage option is informational/Android-only; on iOS/web it is visible but disabled with a hint.
- Resume-from-last-position is saved but not auto-restored on launch.
