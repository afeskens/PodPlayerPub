import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer, {
  Event,
  State,
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
  useProgress,
  useTrackPlayerEvents,
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

// One-time TrackPlayer setup. Safe to call multiple times — errors after the
// first call are swallowed because the library only allows a single setup.
let setupPromise: Promise<void> | null = null;
async function ensureSetup() {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });
    } catch (e) {
      // setupPlayer throws if already set up — that's fine.
    }
    try {
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
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
          Capability.Stop,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        forwardJumpInterval: 30,
        backwardJumpInterval: 10,
        progressUpdateEventInterval: 1,
      });
    } catch (e) {
      // ignore
    }
  })();
  return setupPromise;
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { markPlayed, isPlayed } = useLibrary();
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

  // One-time setup on mount.
  useEffect(() => {
    ensureSetup().catch(() => {});
    return () => {
      // do NOT reset the player on unmount of a provider instance — we want
      // the background service to keep running even when the UI is gone.
    };
  }, []);

  // Keep a ref to the latest currentEpisode so listeners don't go stale.
  useEffect(() => {
    currentEpisodeRef.current = state.currentEpisode;
  }, [state.currentEpisode]);

  const saveProgress = useCallback(async (ep: Episode, position: number) => {
    try {
      await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ id: ep.id, position }));
    } catch {}
  }, []);

  // Fires when the current track reaches the end. Marks it played, then
  // advances to the next UNPLAYED item in the queue.
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
    await ensureSetup();
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
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: episode.id,
        url: episode.audioUrl,
        title: episode.title || "Episode",
        artist: episode.podcastName || "",
        artwork: episode.image || episode.podcastArtwork,
        duration: parseInt(episode.duration || "0", 10) || undefined,
      });
      await TrackPlayer.play();
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
    try {
      const playing = state.isPlaying;
      if (playing) await TrackPlayer.pause();
      else await TrackPlayer.play();
      setState((s) => ({ ...s, isPlaying: !playing }));
    } catch (e) {
      console.warn("toggle", e);
    }
  }, [state.isPlaying]);

  const seekTo = useCallback(async (seconds: number) => {
    try { await TrackPlayer.seekTo(seconds); } catch {}
    setState((s) => ({ ...s, position: seconds }));
  }, []);

  const skip = useCallback(async (deltaSeconds: number) => {
    try {
      const pos = await TrackPlayer.getPosition();
      const next = Math.max(0, pos + deltaSeconds);
      await TrackPlayer.seekTo(next);
      setState((s) => ({ ...s, position: next }));
    } catch {}
  }, []);

  const setRate = useCallback(async (rate: number) => {
    try { await TrackPlayer.setRate(rate); } catch {}
    setState((s) => ({ ...s, rate }));
  }, []);

  const stop = useCallback(async () => {
    try { await TrackPlayer.reset(); } catch {}
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
        setState((s) => ({ ...s, isPlaying: false, sleepTimerMinutes: 0, sleepTimerEndsAt: null, sleepTimerRemainingSec: null }));
      } else {
        setState((s) => ({ ...s, sleepTimerRemainingSec: remaining }));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.sleepTimerEndsAt]);

  // Track native playback events — mirror into React state.
  useTrackPlayerEvents(
    [
      Event.PlaybackState,
      Event.PlaybackActiveTrackChanged,
      Event.PlaybackQueueEnded,
      Event.PlaybackError,
    ],
    async (event: any) => {
      try {
        if (event.type === Event.PlaybackState) {
          const st = event.state as State;
          setState((s) => ({
            ...s,
            isPlaying: st === State.Playing,
            loading: st === State.Loading || st === State.Buffering,
          }));
        } else if (event.type === Event.PlaybackQueueEnded) {
          const cur = currentEpisodeRef.current;
          if (cur && endedRef.current !== cur.id) {
            endedRef.current = cur.id;
            handleEndedRef.current?.(cur);
          }
        } else if (event.type === Event.PlaybackError) {
          console.warn("playback error", event);
          setState((s) => ({ ...s, isPlaying: false, loading: false }));
        }
      } catch (e) {
        console.warn("event handler", e);
      }
    }
  );

  // Poll position / duration every 500ms while mounted.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [pos, dur] = await Promise.all([TrackPlayer.getPosition(), TrackPlayer.getDuration()]);
        setState((s) => ({
          ...s,
          position: typeof pos === "number" ? pos : s.position,
          duration: typeof dur === "number" && dur > 0 ? dur : s.duration,
        }));
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, []);

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
