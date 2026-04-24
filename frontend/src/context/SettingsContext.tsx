import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

type SettingsState = {
  skipForward: number;
  skipBackward: number;
  storagePath: string;
  storageLabel: string;
  loading: boolean;
};

type SettingsContextValue = SettingsState & {
  setSkipForward: (n: number) => Promise<void>;
  setSkipBackward: (n: number) => Promise<void>;
  setStorage: (path: string, label: string) => Promise<void>;
};

const Ctx = createContext<SettingsContextValue | null>(null);

const KEY = "@pp:settings";

const defaultStoragePath = `${FileSystem.documentDirectory || ""}episodes/`;

const DEFAULTS: Omit<SettingsState, "loading"> = {
  skipForward: 5,
  skipBackward: 5,
  storagePath: defaultStoragePath,
  storageLabel: "App Documents",
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
      AsyncStorage.setItem(
        KEY,
        JSON.stringify({
          skipForward: next.skipForward,
          skipBackward: next.skipBackward,
          storagePath: next.storagePath,
          storageLabel: next.storageLabel,
        })
      ).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...state,
      setSkipForward: async (n) => persist({ skipForward: n }),
      setSkipBackward: async (n) => persist({ skipBackward: n }),
      setStorage: async (path, label) => persist({ storagePath: path, storageLabel: label }),
    }),
    [state, persist]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
