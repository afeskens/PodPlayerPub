import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import Slider from "@react-native-community/slider";
import * as FileSystem from "expo-file-system/legacy";
import { useLibrary, DownloadedEpisode } from "../../src/context/LibraryContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { useSettings } from "../../src/context/SettingsContext";
import { colors, fallbackArt, radius, spacing, emptyStateMic, formatTime } from "../../src/theme";

export default function PlaylistTab() {
  const insets = useSafeAreaInsets();
  const { downloads, reorderDownloads, removeDownload, isPlayed, playedIds, markPlayed, unmarkPlayed } = useLibrary();
  const { skipForward, skipBackward } = useSettings();
  const {
    currentEpisode, isPlaying, position, duration, loading, rate,
    toggle, seekTo, skip, setRate, play, setQueue,
  } = usePlayer();
  const [seeking, setSeeking] = useState<number | null>(null);

  // Keep the player's queue in sync with the current downloads list so that
  // auto-advance on track-end knows which episode to play next.
  useEffect(() => {
    setQueue(
      downloads.map((d) => ({
        id: d.id,
        title: d.title,
        audioUrl: d.localUri,
        image: d.image,
        podcastName: d.podcastName,
        podcastId: d.podcastId,
      }))
    );
  }, [downloads, setQueue]);

  const playItem = (d: DownloadedEpisode) => {
    play({
      id: d.id,
      title: d.title,
      audioUrl: d.localUri,
      image: d.image,
      podcastName: d.podcastName,
      podcastId: d.podcastId,
    });
  };

  const playNext = () => {
    if (!currentEpisode || downloads.length === 0) return;
    const idx = downloads.findIndex((d) => d.id === currentEpisode.id);
    const next = downloads[(idx + 1) % downloads.length];
    if (next) playItem(next);
  };

  const playPrev = () => {
    if (!currentEpisode || downloads.length === 0) return;
    const idx = downloads.findIndex((d) => d.id === currentEpisode.id);
    const prev = downloads[(idx - 1 + downloads.length) % downloads.length];
    if (prev) playItem(prev);
  };

  const confirmRemove = (d: DownloadedEpisode) => {
    Alert.alert(
      "Remove download?",
      `"${d.title}" will be deleted from your device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try { await FileSystem.deleteAsync(d.localUri, { idempotent: true }); } catch {}
            await removeDownload(d.id);
          },
        },
      ]
    );
  };

  const cycleRate = () => {
    const RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const i = RATES.indexOf(rate);
    setRate(RATES[(i + 1) % RATES.length]);
  };

  const displayedPos = seeking ?? position;
  const progress = duration > 0 ? displayedPos / duration : 0;

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<DownloadedEpisode>) => {
    const isCurrent = currentEpisode?.id === item.id;
    const played = isPlayed(item.id);
    const idx = getIndex?.() ?? 0;
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onPress={() => playItem(item)}
          onLongPress={drag}
          delayLongPress={180}
          disabled={isActive}
          activeOpacity={0.85}
          style={[
            styles.row,
            played && !isCurrent && styles.rowPlayed,
            isCurrent && styles.rowActive,
            isActive && styles.rowDragging,
          ]}
          testID={`playlist-row-${item.id}`}
        >
          <Text style={[styles.indexText, isCurrent && { color: colors.accent }]}>
            {String(idx + 1).padStart(2, "0")}
          </Text>
          <Image source={{ uri: item.image || fallbackArt }} style={styles.art} contentFit="cover" />
          <View style={styles.texts}>
            <Text numberOfLines={2} style={[styles.title, isCurrent && { color: colors.accent }]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.podcast}>
              {item.podcastName}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="cloud-done" size={11} color={colors.success} />
              <Text style={styles.metaText}>
                {item.durationSec ? formatTime(item.durationSec) : "Ready"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => (played ? unmarkPlayed(item.id) : markPlayed(item.id))}
            hitSlop={8}
            style={styles.playedBtn}
            testID={`playlist-played-${item.id}`}
          >
            <Ionicons
              name={played ? "checkmark-circle" : "checkmark-circle-outline"}
              size={18}
              color={played ? "#4E9BFF" : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmRemove(item)}
            hitSlop={8}
            style={styles.trash}
            testID={`playlist-delete-${item.id}`}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <Ionicons name="reorder-three" size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: 58 + insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>OFFLINE QUEUE</Text>
        <Text style={styles.h1}>Playlist</Text>
        <Text style={styles.sub}>
          {downloads.length === 0
            ? "Long-press an episode in Latest to add it here"
            : "Tap to play · hold and drag to reorder"}
        </Text>
      </View>

      {downloads.length === 0 ? (
        <View style={styles.empty}>
          <Image source={{ uri: emptyStateMic }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySub}>
            Download episodes from the Latest tab to listen offline.
          </Text>
        </View>
      ) : (
        <DraggableFlatList
          data={downloads}
          keyExtractor={(d) => `${d.id}:${isPlayed(d.id) ? "p" : "u"}:${currentEpisode?.id === d.id ? "c" : "n"}`}
          onDragEnd={({ data }) => reorderDownloads(data)}
          renderItem={renderItem}
          extraData={{ playedIds, currentEpisodeId: currentEpisode?.id }}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 12,
          }}
          activationDistance={10}
        />
      )}

      <View style={styles.playerDock}>
        <View style={styles.dockInner}>
          <View style={styles.dockTop}>
            <Image
              source={{ uri: currentEpisode?.image || fallbackArt }}
              style={styles.dockArt}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.dockTitle}>
                {currentEpisode?.title || "Nothing playing"}
              </Text>
              <Text numberOfLines={1} style={styles.dockPodcast}>
                {currentEpisode?.podcastName || "Select an episode below"}
              </Text>
            </View>
            <TouchableOpacity onPress={cycleRate} style={styles.rateBtn} testID="playlist-rate">
              <Text style={styles.rateText}>{rate.toFixed(rate % 1 === 0 ? 0 : 2)}x</Text>
            </TouchableOpacity>
          </View>

          <Slider
            value={progress}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor="rgba(255,255,255,0.18)"
            thumbTintColor={colors.accent}
            disabled={!currentEpisode || duration === 0}
            onSlidingStart={() => setSeeking(displayedPos)}
            onValueChange={(v) => {
              if (duration > 0) setSeeking(v * duration);
            }}
            onSlidingComplete={(v) => {
              if (duration > 0) seekTo(v * duration);
              setSeeking(null);
            }}
            testID="playlist-slider"
          />
          <View style={styles.times}>
            <Text style={styles.timeText}>{formatTime(displayedPos)}</Text>
            <Text style={styles.timeText}>-{formatTime(Math.max(0, duration - displayedPos))}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={playPrev} hitSlop={8} testID="playlist-prev">
              <Ionicons name="play-skip-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skip(-skipBackward)} hitSlop={8} testID="playlist-skip-back">
              <Ionicons name="play-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggle}
              disabled={!currentEpisode}
              style={[styles.playBtn, !currentEpisode && { opacity: 0.4 }]}
              testID="playlist-play-pause"
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={24}
                  color={colors.background}
                  style={isPlaying ? undefined : { marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skip(skipForward)} hitSlop={8} testID="playlist-skip-forward">
              <Ionicons name="play-forward" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={playNext} hitSlop={8} testID="playlist-next">
              <Ionicons name="play-skip-forward" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 6 },
  h1: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyImg: { width: 120, height: 120, borderRadius: radius.md, opacity: 0.85, marginBottom: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    marginBottom: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: { borderColor: colors.accent },
  rowPlayed: {
    backgroundColor: colors.playedBg,
    borderColor: colors.playedBorder,
  },
  rowDragging: { boxShadow: "0px 12px 24px rgba(0,0,0,0.5)" },
  playedBtn: {
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
    marginRight: 2,
  },
  indexText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    width: 22,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  art: { width: 50, height: 50, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  texts: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  podcast: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  metaText: { color: colors.textSecondary, fontSize: 11 },
  trash: {
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerDock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm + 4,
    backgroundColor: "rgba(15,15,20,0.96)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dockInner: { gap: 4 },
  dockTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
  dockArt: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  dockTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  dockPodcast: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  rateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateText: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" },
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
    paddingHorizontal: 4,
  },
  timeText: { color: colors.textSecondary, fontSize: 11, fontVariant: ["tabular-nums"] },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginTop: 6,
  },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
