import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { colors, fallbackArt, radius, spacing } from "../theme";

export default function MiniPlayer() {
  const router = useRouter();
  const { currentEpisode, isPlaying, loading, position, duration, toggle } = usePlayer();

  if (!currentEpisode) return null;

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const art = currentEpisode.image || currentEpisode.podcastArtwork || fallbackArt;

  return (
    <View style={styles.wrap} testID="mini-player">
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.row}
        onPress={() => router.push("/player")}
        testID="mini-player-open"
      >
        <Image source={{ uri: art }} style={styles.art} contentFit="cover" />
        <View style={styles.texts}>
          <Text numberOfLines={1} style={styles.title}>
            {currentEpisode.title || "Now Playing"}
          </Text>
          <Text numberOfLines={1} style={styles.podcast}>
            {currentEpisode.podcastName || ""}
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            toggle();
          }}
          hitSlop={12}
          style={styles.playBtn}
          testID="mini-player-play-pause"
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={22}
              color={colors.background}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#12121A",
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: 0,
  },
  progressTrack: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.accent,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  texts: { flex: 1, marginHorizontal: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  podcast: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
