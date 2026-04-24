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
  sleepTimerMinutes: number;
  sleepTimerEndsAt: number | null;
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
  const { markPlayed, isPlayed } = useLibrary();
  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<Episode[]>([]);
  const endedRef = useRef<string | null>(null);
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
    // Keep audio playing when screen is off / app is backgrounded. No lock
    // screen controls with expo-audio — but playback continues in the
    // background thanks to UIBackgroundModes=audio in app.json.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
      interruptionMode: "mixWithOthers",
    }).catch((e) => console.warn("audio mode", e));
  }, []);

  useEffect(() => {
    currentEpisodeRef.current = state.currentEpisode;
  }, [state.currentEpisode]);

  // Polling for progress only. End-of-track uses the native event below.
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
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const saveProgress = useCallback(async (ep: Episode, position: number) => {
    try {
      await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ id: ep.id, position }));
    } catch {}
  }, []);

  const handleEpisodeEnded = useCallback((ended: Episode) => {
    markPlayed(ended.id).catch(() => {});
    const queue = queueRef.current;
    if (!queue || queue.length === 0) return;
    const idx = queue.findIndex((q) => q.id === ended.id);
    if (idx < 0) return;
    for (let i = idx + 1; i < queue.length; i++) {
      const candidate = queue[i];
      if (!isPlayed(candidate.id)) {
        setTimeout(() => playRef.current?.(candidate), 50);
        return;
      }
    }
  }, [markPlayed, isPlayed]);

  const playRef = useRef<((ep: Episode) => Promise<void>) | null>(null);
  const handleEndedRef = useRef(handleEpisodeEnded);
  useEffect(() => {
    handleEndedRef.current = handleEpisodeEnded;
  }, [handleEpisodeEnded]);

  const play = useCallback(async (episode: Episode) => {
    const prev = playerRef.current;
    playerRef.current = null;
    if (prev) {
      try { prev.pause(); } catch {}
      try { prev.remove(); } catch {}
    }
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

      try {
        const sub = (p as any).addListener("playbackStatusUpdate", (status: any) => {
          if (status) {
            setState((s) => ({
              ...s,
              position: typeof status.currentTime === "number" ? status.currentTime : s.position,
              duration: typeof status.duration === "number" && status.duration > 0 ? status.duration : s.duration,
              isPlaying: !!status.playing,
            }));
            if (status.didJustFinish && endedRef.current !== episode.id) {
              endedRef.current = episode.id;
              handleEndedRef.current?.(episode);
            }
          }
        });
        (p as any).__sub = sub;
      } catch (e) {
        console.warn("addListener failed", e);
      }

      p.play();
      setState((s) => ({ ...s, isPlaying: true, loading: false }));
      await saveProgress(episode, 0);
    } catch (e) {
      console.warn("play error", e);
      setState((s) => ({ ...s, loading: false, isPlaying: false }));
    }
  }, [saveProgress]);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const toggle = useCallback(async () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.playing) p.pause();
      else p.play();
      setState((s) => ({ ...s, isPlaying: !s.isPlaying }));
    } catch (e) {
      console.warn("toggle", e);
    }
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    try { await p.seekTo(seconds); } catch {}
    setState((s) => ({ ...s, position: seconds }));
  }, []);

  const skip = useCallback(async (deltaSeconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const cur = p.currentTime || 0;
      const next = Math.max(0, cur + deltaSeconds);
      await p.seekTo(next);
      setState((s) => ({ ...s, position: next }));
    } catch {}
  }, []);

  const setRate = useCallback(async (rate: number) => {
    const p = playerRef.current;
    if (!p) return;
    try { p.setPlaybackRate?.(rate); } catch {}
    setState((s) => ({ ...s, rate }));
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

  const setSleepTimer = useCallback((minutes: number) => {
    const m = Math.max(0, Math.min(120, Math.round(minutes)));
    if (m === 0) {
      setState((s) => ({ ...s, sleepTimerMinutes: 0, sleepTimerEndsAt: null, sleepTimerRemainingSec: null }));
    } else {
      const endsAt = Date.now() + m * 60 * 1000;
      setState((s) => ({ ...s, sleepTimerMinutes: m, sleepTimerEndsAt: endsAt, sleepTimerRemainingSec: m * 60 }));
    }
  }, []);

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
