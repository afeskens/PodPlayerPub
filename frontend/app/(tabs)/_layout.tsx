import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "rgba(9,9,13,0.85)",
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 58 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom + 6,
            elevation: 0,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
          tabBarBackground: () => (
            <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
          ),
          tabBarIcon: ({ color, focused, size }) => {
            let name: keyof typeof Ionicons.glyphMap = "search-outline";
            if (route.name === "index") name = focused ? "search" : "search-outline";
            else if (route.name === "latest") name = focused ? "flash" : "flash-outline";
            else if (route.name === "playlist") name = focused ? "list" : "list-outline";
            else if (route.name === "library") name = focused ? "albums" : "albums-outline";
            return <Ionicons name={name} size={size ?? 22} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Search" }} />
        <Tabs.Screen name="latest" options={{ title: "Latest" }} />
        <Tabs.Screen name="playlist" options={{ title: "Playlist" }} />
        <Tabs.Screen name="library" options={{ title: "Library" }} />
      </Tabs>

      {/* Global settings button available on every tab */}
      <TouchableOpacity
        onPress={() => router.push("/settings")}
        style={[styles.settingsFab, { top: insets.top + 8 }]}
        hitSlop={8}
        activeOpacity={0.8}
        testID="global-settings-btn"
      >
        <View style={styles.settingsInner}>
          <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsFab: {
    position: "absolute",
    right: 16,
    zIndex: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  settingsInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,15,20,0.85)",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
