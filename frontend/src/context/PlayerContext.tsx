import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer, {
  Capability,
  Event,
  State,
  AppKilledPlaybackBehavior,
  useTrackPlayerEvents,
  useProgress,
} from "react-native-track-player";
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
  isVideo?: boolean;
  chaptersUrl?: string;
};

type PlayerState = {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  position: number;
  duration: number;
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

// Guard so we only run setupPlayer() once per JS runtime.
let _tpSetupPromise: Promise<void> | null = null;
const ensureTrackPlayerSetup = async () => {
  if (Platform.OS === "web") return;
  if (_tpSetupPromise) return _tpSetupPromise;
  _tpSetupPromise = (async () => {
    try {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });
    } catch (e: any) {
      // "The player has already been initialized" — safe to ignore
      if (!String(e?.message || e).match(/already/i)) {
        console.warn("TrackPlayer.setupPlayer error", e);
      }
    }
    try {
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        progressUpdateEventInterval: 1,
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
          Capability.Stop,
        ],
        forwardJumpInterval: 30,
        backwardJumpInterval: 15,
      });
    } catch (e) {
      console.warn("TrackPlayer.updateOptions error", e);
    }
  })();
  return _tpSetupPromise;
};

const episodeToTrack = (ep: Episode) => ({
  id: ep.id,
  url: ep.audioUrl,
  title: ep.title || "Untitled",
  artist: ep.podcastName || "Podcast",
  artwork: ep.image || ep.podcastArtwork,
  duration: undefined as number | undefined,
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { markPlayed, isPlayed } = useLibrary();
  const queueRef = useRef<Episode[]>([]);
  const currentEpisodeRef = useRef<Episode | null>(null);
  const endedHandledRef = useRef<string | null>(null);

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

  // Kick off setup at mount
  useEffect(() => {
    ensureTrackPlayerSetup().catch((e) => console.warn("tp setup", e));
  }, []);

  useEffect(() => {
    currentEpisodeRef.current = state.currentEpisode;
  }, [state.currentEpisode]);

  const setQueue = useCallback((episodes: Episode[]) => {
    queueRef.current = episodes;
  }, []);

  // Live progress from RNTP
  const progress = useProgress(500);
  useEffect(() => {
    setState((s) => ({
      ...s,
      position: progress.position || 0,
      duration: progress.duration > 0 ? progress.duration : s.duration,
    }));
  }, [progress.position, progress.duration]);

  const saveProgress = useCallback(async (ep: Episode, position: number) => {
    try {
      // Persist full episode metadata so we can fully rehydrate on app launch
      // even if the episode has since been removed from the playlist.
      await AsyncStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ episode: ep, position, savedAt: Date.now() })
      );
    } catch {}
  }, []);

  // Ref holding a saved-position record while we wait for the user to
  // tap play. When play() loads the matching episode, we seek to this
  // position before starting playback.
  const pendingResumeRef = useRef<{ id: string; position: number } | null>(null);

  // ---------- Auto-resume: rehydrate last episode on mount ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROGRESS_KEY);
        if (!raw || cancelled) return;
        const data = JSON.parse(raw);
        const ep = data?.episode;
        const pos = Number(data?.position) || 0;
        // Only restore if we have a real episode and meaningful progress (>5s)
        if (ep && ep.id && ep.audioUrl && pos > 5) {
          pendingResumeRef.current = { id: ep.id, position: pos };
          setState((s) => ({
            ...s,
            currentEpisode: ep,
            position: pos,
            duration: 0,
            isPlaying: false,
            loading: false,
          }));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Periodic progress save while playing ----------
  // Save every ~10 seconds during active playback, plus on
  // pause/stop, so reopening the app always lands within ~10s of
  // where the user actually was.
  const lastSavedPosRef = useRef<number>(0);
  useEffect(() => {
    const ep = state.currentEpisode;
    if (!ep || !state.isPlaying) return;
    const pos = state.position;
    if (pos > 0 && Math.abs(pos - lastSavedPosRef.current) >= 10) {
      lastSavedPosRef.current = pos;
      saveProgress(ep, pos);
    }
  }, [state.position, state.isPlaying, state.currentEpisode, saveProgress]);

  const playRef = useRef<((ep: Episode) => Promise<void>) | null>(null);

  const handleEpisodeEnded = useCallback((ended: Episode) => {
    if (endedHandledRef.current === ended.id) return;
    endedHandledRef.current = ended.id;
    markPlayed(ended.id).catch(() => {});
    // Clear saved resume position for finished episode
    AsyncStorage.removeItem(PROGRESS_KEY).catch(() => {});
    lastSavedPosRef.current = 0;
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

  const handleEndedRef = useRef(handleEpisodeEnded);
  useEffect(() => { handleEndedRef.current = handleEpisodeEnded; }, [handleEpisodeEnded]);

  // Listen to native RNTP events for play/pause state + queue end
  useTrackPlayerEvents(
    [
      Event.PlaybackState,
      Event.PlaybackQueueEnded,
      Event.PlaybackError,
      Event.RemoteNext,
      Event.RemotePrevious,
    ],
    async (event: any) => {
      if (event.type === Event.PlaybackState) {
        const s = event.state as State;
        const playing = s === State.Playing;
        const loading = s === State.Loading || s === State.Buffering;
        setState((st) => ({ ...st, isPlaying: playing, loading }));
      } else if (event.type === Event.PlaybackQueueEnded) {
        const ep = currentEpisodeRef.current;
        if (ep) handleEndedRef.current?.(ep);
      } else if (event.type === Event.PlaybackError) {
        console.warn("RNTP PlaybackError", event);
        setState((st) => ({ ...st, loading: false }));
      } else if (event.type === Event.RemoteNext) {
        // If user hits next button from lock-screen, advance via our queue logic
        const ep = currentEpisodeRef.current;
        if (ep) handleEndedRef.current?.(ep);
      } else if (event.type === Event.RemotePrevious) {
        // Jump to start of current track (podcast convention)
        try { await TrackPlayer.seekTo(0); } catch {}
      }
    }
  );

  const play = useCallback(async (episode: Episode) => {
    endedHandledRef.current = null;
    // If this episode matches a pending resume record, start at the saved position.
    const pending = pendingResumeRef.current;
    const resumeAt =
      pending && pending.id === episode.id && pending.position > 5
        ? pending.position
        : 0;
    pendingResumeRef.current = null; // consume regardless

    setState((s) => ({
      ...s,
      loading: true,
      currentEpisode: episode,
      isPlaying: false,
      position: resumeAt,
      duration: 0,
    }));
    try {
      await ensureTrackPlayerSetup();
      await TrackPlayer.reset();
      await TrackPlayer.add(episodeToTrack(episode));
      if (resumeAt > 0) {
        try { await TrackPlayer.seekTo(resumeAt); } catch {}
      }
      await TrackPlayer.play();
      lastSavedPosRef.current = resumeAt;
      await saveProgress(episode, resumeAt);
    } catch (e) {
      console.warn("play error", e);
      setState((s) => ({ ...s, loading: false, isPlaying: false }));
    }
  }, [saveProgress]);

  useEffect(() => { playRef.current = play; }, [play]);

  const toggle = useCallback(async () => {
    try {
      // Auto-resume scenario: app was just opened, MiniPlayer is visible
      // showing the last episode at the saved position, but the native
      // RNTP queue is empty. Tap-to-play should load + seek + play.
      let active: any = null;
      try { active = await TrackPlayer.getActiveTrack(); } catch {}
      if (!active && currentEpisodeRef.current) {
        await play(currentEpisodeRef.current);
        return;
      }
      const s = await TrackPlayer.getPlaybackState();
      if (s.state === State.Playing) {
        await TrackPlayer.pause();
        // Snapshot exact position on pause so resume is precise
        const ep = currentEpisodeRef.current;
        if (ep) {
          try {
            const { position } = await TrackPlayer.getProgress();
            await saveProgress(ep, position || 0);
            lastSavedPosRef.current = position || 0;
          } catch {}
        }
      } else {
        await TrackPlayer.play();
      }
    } catch (e) {
      console.warn("toggle", e);
    }
  }, [play, saveProgress]);

  const seekTo = useCallback(async (seconds: number) => {
    try {
      await TrackPlayer.seekTo(Math.max(0, seconds));
      setState((s) => ({ ...s, position: Math.max(0, seconds) }));
    } catch {}
  }, []);

  const skip = useCallback(async (deltaSeconds: number) => {
    try {
      const { position } = await TrackPlayer.getProgress();
      const next = Math.max(0, (position || 0) + deltaSeconds);
      await TrackPlayer.seekTo(next);
      setState((s) => ({ ...s, position: next }));
    } catch {}
  }, []);

  const setRate = useCallback(async (rate: number) => {
    try {
      await TrackPlayer.setRate(rate);
      setState((s) => ({ ...s, rate }));
    } catch {}
  }, []);

  const stop = useCallback(async () => {
    try { await TrackPlayer.reset(); } catch {}
    pendingResumeRef.current = null;
    lastSavedPosRef.current = 0;
    try { await AsyncStorage.removeItem(PROGRESS_KEY); } catch {}
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
    const tick = async () => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      if (remaining <= 0) {
        try { await TrackPlayer.pause(); } catch {}
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
