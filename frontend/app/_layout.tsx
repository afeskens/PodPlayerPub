import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { View, StyleSheet } from "react-native";
import { PlayerProvider } from "../src/context/PlayerContext";
import { LibraryProvider } from "../src/context/LibraryContext";
import { SettingsProvider } from "../src/context/SettingsContext";
import { colors } from "../src/theme";
import MiniPlayer from "../src/components/MiniPlayer";

function GlobalMiniPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Hide on the full-screen player modal
  if (pathname === "/player") return null;
  // Offset above bottom tabs when on a tab route; otherwise above bottom safe area
  const inTabs =
    pathname === "/" ||
    pathname === "/search" ||
    pathname === "/downloads";
  const bottomOffset = inTabs ? 58 + insets.bottom : insets.bottom;
  return (
    <View style={[styles.miniWrap, { bottom: bottomOffset, pointerEvents: "box-none" }]}>
      <MiniPlayer />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <LibraryProvider>
            <PlayerProvider>
              <StatusBar style="light" />
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
              </Stack>
              <GlobalMiniPlayer />
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
