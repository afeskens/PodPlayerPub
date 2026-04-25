import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import { fetchFeed, Feed, FeedEpisode } from "../../src/api";
import { useLibrary } from "../../src/context/LibraryContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { useSettings } from "../../src/context/SettingsContext";
import { downloadEpisode as runDownload } from "../../src/downloads";
import { colors, fallbackArt, radius, spacing, parseDurationToSec, formatTime, relativeDate } from "../../src/theme";

export default function PodcastDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string; feedUrl: string; name: string; artist: string; art: string;
  }>();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, number>>({});

  const { isSubscribed, subscribe, unsubscribe, addDownload, getDownload, removeDownload } = useLibrary();
  const { play } = usePlayer();
  const { storagePath } = useSettings();

  const collectionId = Number(params.id);
  const subscribed = isSubscribed(collectionId);

  useEffect(() => {
    (async () => {
      if (!params.feedUrl) {
        setError("No feed URL for this podcast");
        setLoading(false);
        return;
      }
      try {
        const f = await fetchFeed(params.feedUrl, 60);
        setFeed(f);
      } catch (e: any) {
        setError(e?.message || "Failed to load feed");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.feedUrl]);

  const toggleSub = useCallback(async () => {
    if (subscribed) {
      await unsubscribe(collectionId);
    } else {
      await subscribe({
        collectionId,
        collectionName: String(params.name || feed?.title || "Podcast"),
        artistName: String(params.artist || feed?.author || ""),
        artworkUrl600: String(params.art || feed?.image || ""),
        feedUrl: String(params.feedUrl),
      });
    }
  }, [subscribed, collectionId, params, feed, subscribe, unsubscribe]);

  const playEpisode = useCallback((ep: FeedEpisode) => {
    const dl = getDownload(ep.id);
    if (ep.isVideo) {
      router.push({
        pathname: "/video",
        params: {
          url: dl?.localUri || ep.audioUrl,
          title: ep.title,
          podcastName: String(params.name || feed?.title || ""),
        },
      });
      return;
    }
    play({
      id: ep.id,
      title: ep.title,
      description: ep.description,
      audioUrl: dl?.localUri || ep.audioUrl,
      image: ep.image || String(params.art || ""),
      pubDate: ep.pubDate,
      podcastId: collectionId,
      podcastName: String(params.name || feed?.title || ""),
      podcastArtwork: String(params.art || feed?.image || ""),
    });
    router.push("/player");
  }, [play, router, getDownload, params, feed, collectionId]);

  const downloadEpisode = useCallback(async (ep: FeedEpisode) => {
    const existing = getDownload(ep.id);
    if (existing) {
      Alert.alert("Already downloaded");
      return;
    }
    setDownloadingIds((s) => ({ ...s, [ep.id]: 0 }));
    const saved = await runDownload(
      {
        id: ep.id,
        title: ep.title,
        audioUrl: ep.audioUrl,
        duration: ep.duration,
        image: ep.image || String(params.art || ""),
        podcastId: collectionId,
        podcastName: String(params.name || feed?.title || ""),
        isVideo: !!ep.isVideo,
      },
      storagePath,
      (pct) => setDownloadingIds((s) => ({ ...s, [ep.id]: pct }))
    );
    if (saved) await addDownload(saved);
    setDownloadingIds((s) => {
      const n = { ...s };
      delete n[ep.id];
      return n;
    });
  }, [addDownload, getDownload, params, feed, collectionId, storagePath]);

  const deleteDownload = useCallback(async (ep: FeedEpisode) => {
    const dl = getDownload(ep.id);
    if (!dl) return;
    try { await FileSystem.deleteAsync(dl.localUri, { idempotent: true }); } catch {}
    await removeDownload(ep.id);
  }, [getDownload, removeDownload]);

  const art = String(params.art || feed?.image || fallbackArt);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image source={{ uri: art }} style={styles.heroBlur} contentFit="cover" blurRadius={28} />
          <LinearGradient
            colors={["rgba(5,5,10,0.1)", "rgba(5,5,10,0.7)", colors.background]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.heroNav}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.navBtn}
                hitSlop={10}
                testID="podcast-back"
              >
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Image source={{ uri: art }} style={styles.heroArt} contentFit="cover" />
            <Text numberOfLines={2} style={styles.title}>
              {params.name || feed?.title || "Podcast"}
            </Text>
            {!!params.artist && (
              <Text numberOfLines={1} style={styles.artist}>
                {params.artist}
              </Text>
            )}
            <TouchableOpacity
              onPress={toggleSub}
              style={[styles.subBtn, subscribed && styles.subBtnActive]}
              testID="subscribe-toggle"
            >
              <Ionicons
                name={subscribed ? "checkmark" : "add"}
                size={16}
                color={subscribed ? colors.textPrimary : colors.background}
              />
              <Text
                style={[styles.subBtnText, subscribed && { color: colors.textPrimary }]}
              >
                {subscribed ? "Subscribed" : "Subscribe"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.dim}>Loading episodes…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={32} color={colors.danger} />
            <Text style={styles.dim}>{error}</Text>
          </View>
        )}

        {!loading && !error && feed && (
          <>
            {!!feed.description && (
              <View style={styles.descWrap}>
                <Text style={styles.descLabel}>ABOUT</Text>
                <Text style={styles.desc} numberOfLines={6}>
                  {feed.description}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Episodes ({feed.episodes.length})</Text>

            {feed.episodes.map((ep, idx) => {
              const dl = getDownload(ep.id);
              const dlProgress = downloadingIds[ep.id];
              const isDownloading = typeof dlProgress === "number";
              const dur = parseDurationToSec(ep.duration);
              return (
                <View key={ep.id + idx} style={styles.epCard} testID={`episode-${idx}`}>
                  <TouchableOpacity
                    style={styles.epRow}
                    activeOpacity={0.85}
                    onPress={() => playEpisode(ep)}
                    testID={`play-episode-${idx}`}
                  >
                    <View style={styles.playCircle}>
                      <Ionicons name="play" size={16} color={colors.background} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={styles.epTitle}>
                        {ep.title}
                      </Text>
                      <View style={styles.metaRow}>
                        {!!ep.pubDate && (
                          <Text style={styles.metaText}>{relativeDate(ep.pubDate)}</Text>
                        )}
                        {dur > 0 && (
                          <>
                            <View style={styles.dot} />
                            <Text style={styles.metaText}>{formatTime(dur)}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {!!ep.description && (
                    <Text style={styles.epDesc} numberOfLines={3}>
                      {ep.description}
                    </Text>
                  )}

                  <View style={styles.actions}>
                    {dl ? (
                      <TouchableOpacity
                        onPress={() => deleteDownload(ep)}
                        style={styles.actionBtn}
                        testID={`episode-downloaded-${idx}`}
                      >
                        <Ionicons name="cloud-done" size={14} color={colors.success} />
                        <Text style={[styles.actionText, { color: colors.success }]}>Downloaded</Text>
                      </TouchableOpacity>
                    ) : isDownloading ? (
                      <View style={styles.actionBtn}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={styles.actionText}>
                          {Math.round((dlProgress || 0) * 100)}%
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => downloadEpisode(ep)}
                        style={styles.actionBtn}
                        testID={`episode-download-${idx}`}
                      >
                        <Ionicons name="cloud-download-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.actionText}>Download</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { height: 360 },
  heroBlur: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  heroContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  heroNav: {
    width: "100%",
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroArt: {
    width: 160,
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: spacing.md,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  subBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  subBtnActive: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  subBtnText: { color: colors.background, fontWeight: "700", fontSize: 13 },
  center: { alignItems: "center", paddingVertical: 40, gap: 10 },
  dim: { color: colors.textSecondary, fontSize: 13 },
  descWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  descLabel: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 6,
  },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  epCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  epRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  playCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  epTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaText: { color: colors.textSecondary, fontSize: 11 },
  dot: {
    width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textTertiary,
  },
  epDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 10 },
  actions: { flexDirection: "row", marginTop: 10, gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
});
