import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "../src/context/PlayerContext";
import { useSettings } from "../src/context/SettingsContext";
import { colors, fallbackArt, radius, spacing, formatTime } from "../src/theme";

const RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { skipForward, skipBackward } = useSettings();
  const {
    currentEpisode,
    isPlaying,
    position,
    duration,
    rate,
    loading,
    toggle,
    seekTo,
    skip,
    setRate,
  } = usePlayer();
  const [seeking, setSeeking] = useState<number | null>(null);

  if (!currentEpisode) {
    return (
      <View style={[styles.emptyWrap, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Nothing is playing.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const art = currentEpisode.image || currentEpisode.podcastArtwork || fallbackArt;
  const displayedPos = seeking ?? position;
  const progress = duration > 0 ? displayedPos / duration : 0;

  const cycleRate = () => {
    const idx = RATES.indexOf(rate);
    const next = RATES[(idx + 1) % RATES.length];
    setRate(next);
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: art }} style={styles.bgBlur} contentFit="cover" blurRadius={42} />
      <LinearGradient
        colors={["rgba(5,5,10,0.5)", "rgba(5,5,10,0.85)", "rgba(5,5,10,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.topBtn}
            hitSlop={10}
            testID="player-close"
          >
            <Ionicons name="chevron-down" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.topEyebrow}>NOW PLAYING</Text>
            <Text numberOfLines={1} style={styles.topTitle}>
              {currentEpisode.podcastName || ""}
            </Text>
          </View>
          <View style={styles.topBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </View>
        </View>

        <View style={styles.artWrap}>
          <Image source={{ uri: art }} style={styles.art} contentFit="cover" />
        </View>

        <Text numberOfLines={3} style={styles.epTitle}>
          {currentEpisode.title}
        </Text>
        {!!currentEpisode.podcastName && (
          <Text numberOfLines={1} style={styles.epPodcast}>
            {currentEpisode.podcastName}
          </Text>
        )}

        <View style={styles.sliderWrap}>
          <Slider
            value={progress}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor="rgba(255,255,255,0.18)"
            thumbTintColor={colors.accent}
            onSlidingStart={() => setSeeking(displayedPos)}
            onValueChange={(v) => {
              if (duration > 0) setSeeking(v * duration);
            }}
            onSlidingComplete={(v) => {
              if (duration > 0) seekTo(v * duration);
              setSeeking(null);
            }}
            testID="player-slider"
          />
          <View style={styles.times}>
            <Text style={styles.timeText}>{formatTime(displayedPos)}</Text>
            <Text style={styles.timeText}>-{formatTime(Math.max(0, duration - displayedPos))}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={cycleRate} style={styles.sideBtn} testID="player-rate">
            <Text style={styles.rateText}>{rate.toFixed(rate % 1 === 0 ? 0 : 2)}x</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => skip(-skipBackward)} style={styles.skipBtn} testID="player-skip-back">
            <Ionicons name="play-back" size={22} color={colors.textPrimary} />
            <Text style={styles.skipLabel}>{skipBackward}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggle}
            style={styles.playBtn}
            testID="player-play-pause"
          >
            {loading ? (
              <ActivityIndicator size="large" color={colors.background} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={34}
                color={colors.background}
                style={isPlaying ? undefined : { marginLeft: 3 }}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => skip(skipForward)} style={styles.skipBtn} testID="player-skip-forward">
            <Ionicons name="play-forward" size={22} color={colors.textPrimary} />
            <Text style={styles.skipLabel}>{skipForward}</Text>
          </TouchableOpacity>

          <View style={styles.sideBtn}>
            <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
          </View>
        </View>

        {!!currentEpisode.description && (
          <View style={styles.descBox}>
            <Text style={styles.descLabel}>EPISODE NOTES</Text>
            <Text style={styles.desc}>{currentEpisode.description}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bgBlur: { ...StyleSheet.absoluteFillObject, opacity: 0.7 },
  scroll: {
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    flexGrow: 1,
  },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  emptyText: { color: colors.textSecondary, marginBottom: 20 },
  closeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.textPrimary, fontWeight: "600" },
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  topEyebrow: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "700",
  },
  topTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginTop: 2 },
  artWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    boxShadow: "0px 20px 30px rgba(0,0,0,0.6)",
  },
  art: {
    width: 300,
    height: 300,
    maxWidth: "90%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  epTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
    marginTop: spacing.sm,
  },
  epPodcast: { color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: "center" },
  sliderWrap: { width: "100%", marginTop: spacing.lg },
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    paddingHorizontal: 4,
  },
  timeText: { color: colors.textSecondary, fontSize: 12, fontVariant: ["tabular-nums"] },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: spacing.lg,
  },
  sideBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  skipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    position: "absolute",
    bottom: 10,
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: "transparent",
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  descBox: {
    width: "100%",
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descLabel: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 8,
  },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
});
