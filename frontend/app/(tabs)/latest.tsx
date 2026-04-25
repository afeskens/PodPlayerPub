import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchFeed } from "../../src/api";
import { useLibrary } from "../../src/context/LibraryContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { useSettings } from "../../src/context/SettingsContext";
import { downloadEpisode } from "../../src/downloads";
import { colors, fallbackArt, radius, spacing, emptyStateMic, formatTime, parseDurationToSec, relativeDate } from "../../src/theme";

type LatestEp = {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  pubDate: string;
  duration: string;
  durationSec: number;
  pubTs: number;
  image: string;
  podcastId: number;
  podcastName: string;
  podcastArtwork: string;
  feedUrl: string;
  isVideo: boolean;
};

export default function LatestTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subscriptions, addDownload, getDownload, isPlayed } = useLibrary();
  const { play } = usePlayer();
  const { storagePath } = useSettings();
  const [episodes, setEpisodes] = useState<LatestEp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Persist collapsed state per podcast across launches
  const COLLAPSED_KEY = "@pp:latestCollapsed";
  useEffect(() => {
    AsyncStorage.getItem(COLLAPSED_KEY).then((s) => {
      if (s) {
        try { setCollapsed(JSON.parse(s) || {}); } catch {}
      }
    });
  }, []);
  const toggleSection = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Group episodes by podcast, ordered by the most recent episode in each group
  const sections = useMemo(() => {
    const map = new Map<string, { podcastId: number; podcastName: string; podcastArtwork: string; data: LatestEp[]; mostRecent: number }>();
    for (const ep of episodes) {
      const key = String(ep.podcastId);
      const existing = map.get(key);
      if (existing) {
        existing.data.push(ep);
        if (ep.pubTs > existing.mostRecent) existing.mostRecent = ep.pubTs;
      } else {
        map.set(key, {
          podcastId: ep.podcastId,
          podcastName: ep.podcastName,
          podcastArtwork: ep.podcastArtwork,
          data: [ep],
          mostRecent: ep.pubTs,
        });
      }
    }
    const groups = Array.from(map.values()).sort((a, b) => b.mostRecent - a.mostRecent);
    return groups.map((g) => ({
      title: g.podcastName,
      key: String(g.podcastId),
      podcastArtwork: g.podcastArtwork,
      totalCount: g.data.length,
      data: collapsed[String(g.podcastId)] ? [] : g.data,
    }));
  }, [episodes, collapsed]);

  const loadAll = useCallback(async () => {
    if (subscriptions.length === 0) {
      setEpisodes([]);
      return;
    }
    const results = await Promise.allSettled(
      // Only fetch the 2 newest episodes per feed — much faster than 10.
      subscriptions.map((s) => fetchFeed(s.feedUrl, 2).then((f) => ({ s, f })))
    );
    const all: LatestEp[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { s, f } = r.value;
      for (const e of f.episodes) {
        const ts = e.pubDate ? Date.parse(e.pubDate) : 0;
        all.push({
          id: `${s.collectionId}:${e.id}`,
          title: e.title,
          description: e.description,
          audioUrl: e.audioUrl,
          pubDate: e.pubDate,
          duration: e.duration,
          durationSec: parseDurationToSec(e.duration),
          pubTs: isNaN(ts) ? 0 : ts,
          image: e.image || s.artworkUrl600,
          podcastId: s.collectionId,
          podcastName: s.collectionName,
          podcastArtwork: s.artworkUrl600,
          feedUrl: s.feedUrl,
          isVideo: !!e.isVideo,
        });
      }
    }
    all.sort((a, b) => b.pubTs - a.pubTs);
    setEpisodes(all.slice(0, 80));
  }, [subscriptions]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const playEpisode = (e: LatestEp) => {
    const dl = getDownload(e.id);
    if (e.isVideo) {
      router.push({
        pathname: "/video",
        params: {
          url: dl?.localUri || e.audioUrl,
          title: e.title,
          podcastName: e.podcastName,
        },
      });
      return;
    }
    play({
      id: e.id,
      title: e.title,
      description: e.description,
      audioUrl: dl?.localUri || e.audioUrl,
      image: e.image,
      pubDate: e.pubDate,
      podcastId: e.podcastId,
      podcastName: e.podcastName,
      podcastArtwork: e.podcastArtwork,
      chaptersUrl: (e as any).chaptersUrl,
    });
    router.push("/player");
  };

  const handleLongPress = async (e: LatestEp) => {
    if (getDownload(e.id)) return;
    if (typeof downloading[e.id] === "number") return;
    setDownloading((s) => ({ ...s, [e.id]: 0 }));
    const saved = await downloadEpisode(
      {
        id: e.id,
        title: e.title,
        audioUrl: e.audioUrl,
        duration: e.duration,
        image: e.image,
        podcastId: e.podcastId,
        podcastName: e.podcastName,
      },
      storagePath,
      (pct) => setDownloading((s) => ({ ...s, [e.id]: pct }))
    );
    if (saved) await addDownload(saved);
    setDownloading((s) => {
      const n = { ...s };
      delete n[e.id];
      return n;
    });
  };

  const hasSubs = subscriptions.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR FEED</Text>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            testID="latest-refresh-btn"
            hitSlop={10}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.background} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>
          {hasSubs
            ? `${episodes.length} episodes · hold an episode to download`
            : "Subscribe to podcasts to see their latest episodes here"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !hasSubs ? (
        <View style={styles.empty}>
          <Image source={{ uri: emptyStateMic }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>No subscriptions yet</Text>
          <Text style={styles.emptySub}>
            Use the Search tab to find podcasts and subscribe to them.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push("/")}
            testID="latest-go-search"
          >
            <Ionicons name="search" size={16} color={colors.background} />
            <Text style={styles.emptyBtnText}>Go to Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 160 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const sec: any = section;
            const isCollapsed = !!collapsed[sec.key];
            return (
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(sec.key)}
                activeOpacity={0.85}
                testID={`latest-section-${sec.key}`}
              >
                <Image source={{ uri: sec.podcastArtwork || fallbackArt }} style={styles.sectionArt} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>{sec.title}</Text>
                  <Text style={styles.sectionMeta}>{sec.totalCount} {sec.totalCount === 1 ? "episode" : "episodes"}</Text>
                </View>
                <Ionicons
                  name={isCollapsed ? "chevron-down" : "chevron-up"}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            );
          }}
          renderItem={({ item }) => {
            const isDl = !!getDownload(item.id);
            const played = isPlayed(item.id);
            const pct = downloading[item.id];
            const downloading_ = typeof pct === "number";
            return (
              <View
                style={[
                  styles.epCard,
                  isDl && styles.epCardDownloaded,
                  played && !isDl && styles.epCardPlayed,
                ]}
                testID={`latest-episode-${item.id}`}
              >
                <TouchableOpacity
                  style={styles.epBodyRow}
                  activeOpacity={1}
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={400}
                  testID={`latest-card-body-${item.id}`}
                >
                  <Image source={{ uri: item.image || fallbackArt }} style={styles.epArt} contentFit="cover" />
                  <View style={styles.epBody}>
                    <Text numberOfLines={1} style={styles.epPodcast}>
                      {item.podcastName}
                    </Text>
                    <Text numberOfLines={2} style={styles.epTitle}>
                      {item.title}
                    </Text>
                    <View style={styles.epMeta}>
                      {!!item.pubDate && (
                        <Text style={styles.metaText}>{relativeDate(item.pubDate)}</Text>
                      )}
                      {item.durationSec > 0 && (
                        <>
                          <View style={styles.dot} />
                          <Text style={styles.metaText}>{formatTime(item.durationSec)}</Text>
                        </>
                      )}
                      {isDl && (
                        <>
                          <View style={styles.dot} />
                          <Ionicons name="cloud-done" size={11} color={colors.success} />
                          <Text style={[styles.metaText, { color: colors.success }]}>Saved</Text>
                        </>
                      )}
                      {downloading_ && (
                        <>
                          <View style={styles.dot} />
                          <ActivityIndicator size="small" color={colors.accent} />
                          <Text style={[styles.metaText, { color: colors.accent }]}>
                            {Math.round((pct || 0) * 100)}%
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => playEpisode(item)}
                  hitSlop={10}
                  style={styles.playCircle}
                  testID={`latest-play-${item.id}`}
                >
                  <Ionicons name="play" size={14} color={colors.background} />
                </TouchableOpacity>
              </View>
            );
          }}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionArt: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  sectionMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 1 },
  center: { alignItems: "center", paddingVertical: 40 },
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
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: spacing.md },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  emptyBtnText: { color: colors.background, fontWeight: "700", fontSize: 13 },
  epCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  epCardDownloaded: {
    backgroundColor: colors.downloadedBg,
    borderColor: colors.downloadedBorder,
  },
  epCardPlayed: {
    backgroundColor: colors.playedBg,
    borderColor: colors.playedBorder,
  },
  epBodyRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  epArt: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  epBody: { flex: 1 },
  epPodcast: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  epTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 3 },
  epMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" },
  metaText: { color: colors.textSecondary, fontSize: 11 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textTertiary },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
