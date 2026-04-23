import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SubscribedPodcast = {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl: string;
  primaryGenreName?: string;
};

export type DownloadedEpisode = {
  id: string;
  title: string;
  audioUrl: string;
  localUri: string;
  image?: string;
  podcastName?: string;
  podcastId?: number | string;
  durationSec?: number;
  sizeBytes?: number;
  addedAt: number;
};

const SUBS_KEY = "@pp:subscriptions";
const DLS_KEY = "@pp:downloads";

type LibraryContextValue = {
  subscriptions: SubscribedPodcast[];
  downloads: DownloadedEpisode[];
  subscribe: (p: SubscribedPodcast) => Promise<void>;
  unsubscribe: (collectionId: number) => Promise<void>;
  isSubscribed: (collectionId: number) => boolean;
  addDownload: (d: DownloadedEpisode) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  getDownload: (id: string) => DownloadedEpisode | undefined;
  reorderDownloads: (next: DownloadedEpisode[]) => Promise<void>;
  loading: boolean;
};

const Ctx = createContext<LibraryContextValue | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptions, setSubs] = useState<SubscribedPodcast[]>([]);
  const [downloads, setDownloads] = useState<DownloadedEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  // Refs mirror latest committed state so concurrent async writers can't
  // clobber each other with stale arrays (e.g. simultaneous downloads).
  const subsRef = useRef<SubscribedPodcast[]>([]);
  const dlsRef = useRef<DownloadedEpisode[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, d] = await Promise.all([
          AsyncStorage.getItem(SUBS_KEY),
          AsyncStorage.getItem(DLS_KEY),
        ]);
        if (s) {
          const parsed = JSON.parse(s);
          subsRef.current = parsed;
          setSubs(parsed);
        }
        if (d) {
          const parsed = JSON.parse(d);
          dlsRef.current = parsed;
          setDownloads(parsed);
        }
      } catch (e) {
        console.warn("library load", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistSubs = useCallback(async (next: SubscribedPodcast[]) => {
    subsRef.current = next;
    setSubs(next);
    await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(next));
  }, []);
  const persistDls = useCallback(async (next: DownloadedEpisode[]) => {
    dlsRef.current = next;
    setDownloads(next);
    await AsyncStorage.setItem(DLS_KEY, JSON.stringify(next));
  }, []);

  const subscribe = useCallback(async (p: SubscribedPodcast) => {
    const current = subsRef.current;
    if (current.some((x) => x.collectionId === p.collectionId)) return;
    await persistSubs([p, ...current]);
  }, [persistSubs]);

  const unsubscribe = useCallback(async (collectionId: number) => {
    await persistSubs(subsRef.current.filter((x) => x.collectionId !== collectionId));
  }, [persistSubs]);

  const isSubscribed = useCallback(
    (collectionId: number) => subscriptions.some((x) => x.collectionId === collectionId),
    [subscriptions]
  );

  const addDownload = useCallback(async (d: DownloadedEpisode) => {
    const filtered = dlsRef.current.filter((x) => x.id !== d.id);
    await persistDls([d, ...filtered]);
  }, [persistDls]);

  const removeDownload = useCallback(async (id: string) => {
    await persistDls(dlsRef.current.filter((x) => x.id !== id));
  }, [persistDls]);

  const getDownload = useCallback(
    (id: string) => downloads.find((x) => x.id === id),
    [downloads]
  );

  const reorderDownloads = useCallback(async (next: DownloadedEpisode[]) => {
    await persistDls(next);
  }, [persistDls]);

  const value = useMemo(() => ({
    subscriptions, downloads, subscribe, unsubscribe, isSubscribed,
    addDownload, removeDownload, getDownload, reorderDownloads, loading,
  }), [subscriptions, downloads, subscribe, unsubscribe, isSubscribed, addDownload, removeDownload, getDownload, reorderDownloads, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useLibrary = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
};
