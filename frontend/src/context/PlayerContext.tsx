import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLibrary } from "./LibraryContext";

export type Episode = {
  id: string;
  title: string;
  description?: string;
  audioUrl: string;
  pubDate?: string;
  duration?: string;
  image?: string;
  podcastId?: string | number;
  podcastName?: string;
  podcastArtwork?: string;
};

type PlayerState = {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  position: number; // seconds
  duration: number; // seconds
  rate: number;
  loading: boolean;
  sleepTimerMinutes: number; // 0 = off
  sleepTimerEndsAt: number | null; // epoch ms, null = off
  sleepTimerRemainingSec: number | null;
};

type PlayerContextValue = PlayerState & {
  play: (episode: Episode) => Promise<void>;
  toggle: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  skip: (deltaSeconds: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  stop: () => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  setQueue: (episodes: Episode[]) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PROGRESS_KEY = "@pp:lastPlayed";

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { markPlayed } = useLibrary();
  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<Episode[]>([]);
  const endedRef = useRef<string | null>(null); // episode id that has already fired "ended"
  const currentEpisodeRef = useRef<Episode | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentEpisode: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1.0,
    loading: false,
    sleepTimerMinutes: 0,
    sleepTimerEndsAt: null,
    sleepTimerRemainingSec: null,
  });

  const setQueue = useCallback((episodes: Episode[]) => {
    queueRef.current = episodes;
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "doNotMix",
    }).catch(() => {});
  }, []);

  // Keep a ref to the latest currentEpisode so the poll effect can read it
  // without re-subscribing on every state change.
  useEffect(() => {
    currentEpisodeRef.current = state.currentEpisode;
  }, [state.currentEpisode]);

  // Polling for progress + end-of-track detection (auto-advance to next in queue).
  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const pos = p.currentTime || 0;
        const dur = p.duration || 0;
        setState((s) => ({
          ...s,
          position: pos,
          duration: dur || s.duration,
          isPlaying: p.playing || false,
        }));

        // Detect end-of-track: within 0.4s of duration AND duration is known AND
        // not fired yet for this episode.
        const cur = currentEpisodeRef.current;
        if (cur && dur > 0 && pos >= dur - 0.4 && endedRef.current !== cur.id) {
          endedRef.current = cur.id;
          handleEpisodeEnded(cur);
        }
      } catch {
        // ignore
      }
    }, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires when the current episode reaches the end. Marks it played, and if it
  // was part of a queue (playlist), auto-advances to the next one.
  const handleEpisodeEnded = useCallback((ended: Episode) => {
    // Mark as played (fire-and-forget)
    markPlayed(ended.id).catch(() => {});

    const queue = queueRef.current;
    if (!queue || queue.length === 0) return;
    const idx = queue.findIndex((q) => q.id === ended.id);
    if (idx < 0 || idx >= queue.length - 1) return; // not in queue, or last track
    const next = queue[idx + 1];
    // Defer to next tick so state updates settle
    setTimeout(() => {
      playRef.current?.(next);
    }, 50);
  }, [markPlayed]);

  // Ref so handleEpisodeEnded can call the latest `play` fn without circular deps.
  const playRef = useRef<((ep: Episode) => Promise<void>) | null>(null);

  const saveProgress = useCallback(async (ep: Episode, position: number) => {
    try {
      await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ episode: ep, position }));
    } catch {}
  }, []);

  const play = useCallback(async (episode: Episode) => {
    // Tear down any existing player BEFORE we touch state so the old audio
    // track is guaranteed to be stopped before the new one starts.
    const prev = playerRef.current;
    playerRef.current = null;
    if (prev) {
      try { prev.pause(); } catch {}
      try { prev.remove(); } catch {}
    }
    // Reset the end-of-track debounce so the new track can trigger "ended".
    endedRef.current = null;
    setState((s) => ({
      ...s,
      loading: true,
      currentEpisode: episode,
      isPlaying: false,
      position: 0,
      duration: 0,
    }));
    try {
      const p = createAudioPlayer({ uri: episode.audioUrl });
      playerRef.current = p;
      p.play();
      setState((s) => ({ ...s, isPlaying: true, loading: false }));
      await saveProgress(episode, 0);
    } catch (e) {
      console.warn("play error", e);
      setState((s) => ({ ...s, loading: false, isPlaying: false }));
    }
  }, [saveProgress]);

  // Keep playRef up to date so handleEpisodeEnded can call it without deps.
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const toggle = useCallback(async () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.playing) {
      p.pause();
      setState((s) => ({ ...s, isPlaying: false }));
    } else {
      p.play();
      setState((s) => ({ ...s, isPlaying: true }));
    }
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      await p.seekTo(seconds);
      setState((s) => ({ ...s, position: seconds }));
    } catch {}
  }, []);

  const skip = useCallback(async (delta: number) => {
    const p = playerRef.current;
    if (!p) return;
    const next = Math.max(0, (p.currentTime || 0) + delta);
    try {
      await p.seekTo(next);
      setState((s) => ({ ...s, position: next }));
    } catch {}
  }, []);

  const setRate = useCallback(async (rate: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setPlaybackRate(rate);
      setState((s) => ({ ...s, rate }));
    } catch {}
  }, []);

  const stop = useCallback(async () => {
    const p = playerRef.current;
    if (p) {
      try { p.pause(); p.remove(); } catch {}
      playerRef.current = null;
    }
    setState({
      currentEpisode: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      rate: 1.0,
      loading: false,
      sleepTimerMinutes: 0,
      sleepTimerEndsAt: null,
      sleepTimerRemainingSec: null,
    });
  }, []);

  // Sleep timer: pauses playback when time runs out. 0 = off.
  const setSleepTimer = useCallback((minutes: number) => {
    const m = Math.max(0, Math.min(120, Math.round(minutes)));
    if (m === 0) {
      setState((s) => ({
        ...s,
        sleepTimerMinutes: 0,
        sleepTimerEndsAt: null,
        sleepTimerRemainingSec: null,
      }));
    } else {
      const endsAt = Date.now() + m * 60 * 1000;
      setState((s) => ({
        ...s,
        sleepTimerMinutes: m,
        sleepTimerEndsAt: endsAt,
        sleepTimerRemainingSec: m * 60,
      }));
    }
  }, []);

  // Tick sleep timer every second while active.
  useEffect(() => {
    if (!state.sleepTimerEndsAt) return;
    const endsAt = state.sleepTimerEndsAt;
    const tick = () => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      if (remaining <= 0) {
        const p = playerRef.current;
        if (p) { try { p.pause(); } catch {} }
        setState((s) => ({
          ...s,
          isPlaying: false,
          sleepTimerMinutes: 0,
          sleepTimerEndsAt: null,
          sleepTimerRemainingSec: null,
        }));
      } else {
        setState((s) => ({ ...s, sleepTimerRemainingSec: remaining }));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.sleepTimerEndsAt]);

  const value = useMemo<PlayerContextValue>(() => ({
    ...state,
    play, toggle, seekTo, skip, setRate, stop, setSleepTimer, setQueue,
  }), [state, play, toggle, seekTo, skip, setRate, stop, setSleepTimer, setQueue]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
};
