import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type StorageLocation = "internal" | "sdcard";

type SettingsState = {
  skipForward: number;
  skipBackward: number;
  storage: StorageLocation;
  loading: boolean;
};

type SettingsContextValue = SettingsState & {
  setSkipForward: (n: number) => Promise<void>;
  setSkipBackward: (n: number) => Promise<void>;
  setStorage: (s: StorageLocation) => Promise<void>;
  sdCardSupported: boolean;
};

const Ctx = createContext<SettingsContextValue | null>(null);

const KEY = "@pp:settings";

const DEFAULTS: Omit<SettingsState, "loading"> = {
  skipForward: 10,
  skipBackward: 5,
  storage: "internal",
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SettingsState>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({ ...DEFAULTS, ...parsed, loading: false });
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
          storage: next.storage,
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
      setStorage: async (s) => persist({ storage: s }),
      sdCardSupported: Platform.OS === "android",
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
