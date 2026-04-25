import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import type { ProviderId, ProviderConfig } from "../searchProviders";

type SettingsState = {
  skipForward: number;
  skipBackward: number;
  storagePath: string;
  storageLabel: string;
  loading: boolean;

  // Search source configuration
  searchSource: ProviderId;
  podcastIndexKey: string;
  podcastIndexSecret: string;
  customSearchUrlTemplate: string;
  customSearchResultsPath: string;
  customSearchFieldFeedUrl: string;
  customSearchFieldName: string;
  customSearchFieldArtist: string;
  customSearchFieldArtwork: string;
  customSearchFieldId: string;
  customSearchFieldGenre: string;
};

type SettingsContextValue = SettingsState & {
  setSkipForward: (n: number) => Promise<void>;
  setSkipBackward: (n: number) => Promise<void>;
  setStorage: (path: string, label: string) => Promise<void>;
  setSearchSource: (id: ProviderId) => Promise<void>;
  setPodcastIndexCreds: (key: string, secret: string) => Promise<void>;
  setCustomSearchConfig: (cfg: Partial<{
    urlTemplate: string; resultsPath: string;
    feedUrl: string; name: string; artist: string;
    artwork: string; id: string; genre: string;
  }>) => Promise<void>;
  buildProviderConfig: () => ProviderConfig;
};

const Ctx = createContext<SettingsContextValue | null>(null);

const KEY = "@pp:settings";

const defaultStoragePath = `${FileSystem.documentDirectory || ""}episodes/`;

const DEFAULTS: Omit<SettingsState, "loading"> = {
  skipForward: 5,
  skipBackward: 5,
  storagePath: defaultStoragePath,
  storageLabel: "App Documents",
  searchSource: "itunes",
  podcastIndexKey: "",
  podcastIndexSecret: "",
  customSearchUrlTemplate: "",
  customSearchResultsPath: "",
  customSearchFieldFeedUrl: "feedUrl",
  customSearchFieldName: "title",
  customSearchFieldArtist: "author",
  customSearchFieldArtwork: "image",
  customSearchFieldId: "",
  customSearchFieldGenre: "",
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SettingsState>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // If user previously chose the (now-removed) Cache location, fall back to App Documents.
          const cacheDir = FileSystem.cacheDirectory || "__no_cache__";
          const isLegacyCache =
            typeof parsed.storagePath === "string" &&
            parsed.storagePath.startsWith(cacheDir);
          setState({
            ...DEFAULTS,
            ...parsed,
            // migrate legacy { storage: "internal"|"sdcard" } to storagePath
            storagePath: isLegacyCache
              ? DEFAULTS.storagePath
              : parsed.storagePath || DEFAULTS.storagePath,
            storageLabel: isLegacyCache
              ? DEFAULTS.storageLabel
              : parsed.storageLabel || DEFAULTS.storageLabel,
            loading: false,
          });
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    })();
  }, []);

  const persist = useCallback(async (patch: Partial<SettingsState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { loading, ...persisted } = next;
      AsyncStorage.setItem(KEY, JSON.stringify(persisted)).catch(() => {});
      return next;
    });
  }, []);

  const buildProviderConfig = useCallback((): ProviderConfig => ({
    source: state.searchSource,
    podcastIndex: state.podcastIndexKey || state.podcastIndexSecret
      ? { apiKey: state.podcastIndexKey, apiSecret: state.podcastIndexSecret }
      : undefined,
    custom: state.customSearchUrlTemplate
      ? {
          urlTemplate: state.customSearchUrlTemplate,
          resultsPath: state.customSearchResultsPath,
          fields: {
            feedUrl: state.customSearchFieldFeedUrl,
            collectionName: state.customSearchFieldName,
            artistName: state.customSearchFieldArtist || undefined,
            artworkUrl: state.customSearchFieldArtwork || undefined,
            collectionId: state.customSearchFieldId || undefined,
            genre: state.customSearchFieldGenre || undefined,
          },
        }
      : undefined,
  }), [state]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...state,
      setSkipForward: async (n) => persist({ skipForward: n }),
      setSkipBackward: async (n) => persist({ skipBackward: n }),
      setStorage: async (path, label) => persist({ storagePath: path, storageLabel: label }),
      setSearchSource: async (id) => persist({ searchSource: id }),
      setPodcastIndexCreds: async (key, secret) =>
        persist({ podcastIndexKey: key, podcastIndexSecret: secret }),
      setCustomSearchConfig: async (cfg) => persist({
        customSearchUrlTemplate: cfg.urlTemplate ?? state.customSearchUrlTemplate,
        customSearchResultsPath: cfg.resultsPath ?? state.customSearchResultsPath,
        customSearchFieldFeedUrl: cfg.feedUrl ?? state.customSearchFieldFeedUrl,
        customSearchFieldName: cfg.name ?? state.customSearchFieldName,
        customSearchFieldArtist: cfg.artist ?? state.customSearchFieldArtist,
        customSearchFieldArtwork: cfg.artwork ?? state.customSearchFieldArtwork,
        customSearchFieldId: cfg.id ?? state.customSearchFieldId,
        customSearchFieldGenre: cfg.genre ?? state.customSearchFieldGenre,
      }),
      buildProviderConfig,
    }),
    [state, persist, buildProviderConfig]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
