import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
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

  useEffect(() => {
    (async () => {
      try {
        const [s, d] = await Promise.all([
          AsyncStorage.getItem(SUBS_KEY),
          AsyncStorage.getItem(DLS_KEY),
        ]);
        if (s) setSubs(JSON.parse(s));
        if (d) setDownloads(JSON.parse(d));
      } catch (e) {
        console.warn("library load", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistSubs = async (next: SubscribedPodcast[]) => {
    setSubs(next);
    await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(next));
  };
  const persistDls = async (next: DownloadedEpisode[]) => {
    setDownloads(next);
    await AsyncStorage.setItem(DLS_KEY, JSON.stringify(next));
  };

  const subscribe = useCallback(async (p: SubscribedPodcast) => {
    if (subscriptions.some((x) => x.collectionId === p.collectionId)) return;
    await persistSubs([p, ...subscriptions]);
  }, [subscriptions]);

  const unsubscribe = useCallback(async (collectionId: number) => {
    await persistSubs(subscriptions.filter((x) => x.collectionId !== collectionId));
  }, [subscriptions]);

  const isSubscribed = useCallback(
    (collectionId: number) => subscriptions.some((x) => x.collectionId === collectionId),
    [subscriptions]
  );

  const addDownload = useCallback(async (d: DownloadedEpisode) => {
    const filtered = downloads.filter((x) => x.id !== d.id);
    await persistDls([d, ...filtered]);
  }, [downloads]);

  const removeDownload = useCallback(async (id: string) => {
    await persistDls(downloads.filter((x) => x.id !== id));
  }, [downloads]);

  const getDownload = useCallback(
    (id: string) => downloads.find((x) => x.id === id),
    [downloads]
  );

  const reorderDownloads = useCallback(async (next: DownloadedEpisode[]) => {
    await persistDls(next);
  }, [downloads]);

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
