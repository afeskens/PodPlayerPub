import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { View, StyleSheet } from "react-native";
import { PlayerProvider, usePlayer } from "../src/context/PlayerContext";
import { LibraryProvider } from "../src/context/LibraryContext";
import { SettingsProvider } from "../src/context/SettingsContext";
import { colors } from "../src/theme";
import MiniPlayer from "../src/components/MiniPlayer";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function GlobalMiniPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Hide on the full-screen player modal or on Playlist tab (it has its own player dock)
  if (pathname === "/player" || pathname === "/playlist") return null;
  // Offset above bottom tabs when on a tab route; otherwise above bottom safe area
  const inTabs =
    pathname === "/" ||
    pathname === "/latest" ||
    pathname === "/library";
  const bottomOffset = inTabs ? 58 + insets.bottom : insets.bottom;
  return (
    <View style={[styles.miniWrap, { bottom: bottomOffset, pointerEvents: "box-none" }]}>
      <MiniPlayer />
    </View>
  );
}

function GlobalErrorGuard({ children }: { children: React.ReactNode }) {
  const { stop } = usePlayer();
  return <ErrorBoundary onReset={() => { try { stop(); } catch {} }}>{children}</ErrorBoundary>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <LibraryProvider>
            <PlayerProvider>
              <StatusBar style="light" />
              <GlobalErrorGuard>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: "fade",
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="player"
                    options={{
                      presentation: "modal",
                      animation: "slide_from_bottom",
                    }}
                  />
                  <Stack.Screen name="podcast/[id]" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
                </Stack>
                <GlobalMiniPlayer />
              </GlobalErrorGuard>
            </PlayerProvider>
          </LibraryProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  miniWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
