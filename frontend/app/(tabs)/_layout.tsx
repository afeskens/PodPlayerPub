import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

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
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.5,
          },
          tabBarBackground: () => (
            <BlurView
              tint="dark"
              intensity={60}
              style={StyleSheet.absoluteFill}
            />
          ),
          tabBarIcon: ({ color, focused, size }) => {
            let name: keyof typeof Ionicons.glyphMap = "home";
            if (route.name === "index") name = focused ? "library" : "library-outline";
            else if (route.name === "search") name = focused ? "search" : "search-outline";
            else if (route.name === "downloads") name = focused ? "cloud-download" : "cloud-download-outline";
            return <Ionicons name={name} size={size ?? 22} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Library" }} />
        <Tabs.Screen name="search" options={{ title: "Search" }} />
        <Tabs.Screen name="downloads" options={{ title: "Downloads" }} />
      </Tabs>
    </View>
  );
}
