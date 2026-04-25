import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../src/theme";

export default function VideoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; title?: string; podcastName?: string }>();
  const url = typeof params.url === "string" ? params.url : "";
  const title = typeof params.title === "string" ? params.title : "Video";
  const podcastName = typeof params.podcastName === "string" ? params.podcastName : "";

  const player = useVideoPlayer(url || null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
    if (url) p.play();
  });

  // Watch playing state for the play/pause overlay button
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  // Stop and release on unmount
  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  // Android hardware back closes the screen cleanly
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const close = () => router.back();
  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
  };
  const skip = (delta: number) => {
    try { player.currentTime = Math.max(0, (player.currentTime || 0) + delta); } catch {}
  };

  if (!url) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.errorText}>No video URL provided.</Text>
        <TouchableOpacity onPress={close} style={styles.closeBtnFallback}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.videoWrap}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture={false}
          contentFit="contain"
          nativeControls
        />
      </View>

      <View style={styles.meta}>
        {!!podcastName && <Text style={styles.podcastName}>{podcastName}</Text>}
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity onPress={() => skip(-15)} style={styles.skipBtn} activeOpacity={0.8}>
          <Ionicons name="play-back" size={22} color={colors.textPrimary} />
          <Text style={styles.skipText}>15</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlay} style={styles.playBtn} activeOpacity={0.8}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => skip(30)} style={styles.skipBtn} activeOpacity={0.8}>
          <Ionicons name="play-forward" size={22} color={colors.textPrimary} />
          <Text style={styles.skipText}>30</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={close} style={styles.closeBtn} activeOpacity={0.8}>
        <Ionicons name="close" size={20} color={colors.textPrimary} />
        <Text style={styles.closeBtnText}>Close</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Video plays in foreground only. Lock the screen to pause.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  videoWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  video: { flex: 1 },
  meta: { marginTop: spacing.lg, alignItems: "center" },
  podcastName: { color: colors.textTertiary, fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: "center" },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  skipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: { color: colors.textPrimary, fontSize: 9, fontWeight: "700", marginTop: -2 },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  closeBtnFallback: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  closeBtnText: { color: colors.textPrimary, fontWeight: "600", fontSize: 13 },
  errorText: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.md },
  hint: {
    color: colors.textTertiary,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.md,
    fontStyle: "italic",
  },
});
