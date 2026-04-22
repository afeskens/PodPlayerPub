import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { useLibrary, DownloadedEpisode } from "../../src/context/LibraryContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { colors, fallbackArt, radius, spacing, emptyStateMic, formatTime } from "../../src/theme";

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const { downloads, removeDownload } = useLibrary();
  const { play } = usePlayer();

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
            try {
              await FileSystem.deleteAsync(d.localUri, { idempotent: true });
            } catch {}
            await removeDownload(d.id);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>OFFLINE</Text>
        <Text style={styles.h1}>Downloads</Text>
        <Text style={styles.sub}>
          {downloads.length} {downloads.length === 1 ? "episode" : "episodes"} on device
        </Text>
      </View>

      {downloads.length === 0 ? (
        <View style={styles.empty}>
          <Image source={{ uri: emptyStateMic }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySub}>
            Download episodes from a podcast to listen offline.
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 200 }}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`download-${item.id}`}>
              <TouchableOpacity
                style={styles.rowLeft}
                onPress={() => playItem(item)}
                activeOpacity={0.85}
                testID={`play-download-${item.id}`}
              >
                <Image
                  source={{ uri: item.image || fallbackArt }}
                  style={styles.art}
                  contentFit="cover"
                />
                <View style={styles.texts}>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.podcast}>
                    {item.podcastName}
                  </Text>
                  <View style={styles.meta}>
                    <Ionicons name="cloud-done" size={12} color={colors.success} />
                    <Text style={styles.metaText}>
                      {item.durationSec ? formatTime(item.durationSec) : "Ready"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmRemove(item)}
                hitSlop={10}
                style={styles.trash}
                testID={`delete-download-${item.id}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 6,
  },
  h1: { color: colors.textPrimary, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyImg: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptySub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  art: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  texts: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  podcast: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  metaText: { color: colors.textSecondary, fontSize: 11 },
  trash: {
    padding: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
