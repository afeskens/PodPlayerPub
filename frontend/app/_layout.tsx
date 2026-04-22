import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlayerProvider } from "../src/context/PlayerContext";
import { LibraryProvider } from "../src/context/LibraryContext";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
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
          </PlayerProvider>
        </LibraryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
