import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLibrary, SubscribedPodcast } from "../../src/context/LibraryContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { topPodcasts, SearchResult } from "../../src/api";
import { colors, fallbackArt, radius, spacing, emptyStateMic } from "../../src/theme";

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subscriptions, downloads } = useLibrary();
  const { currentEpisode } = usePlayer();
  const [recommended, setRecommended] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTop = useCallback(async () => {
    try {
      const r = await topPodcasts("popular", 12);
      setRecommended(r);
    } catch (e) {
      console.warn("top failed", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTop();
      setLoading(false);
    })();
  }, [loadTop]);

  useFocusEffect(useCallback(() => {}, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTop();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      testID="library-scroll"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR LIBRARY</Text>
        <Text style={styles.h1}>Podcasts</Text>
        <Text style={styles.sub}>
          {subscriptions.length} subscribed · {downloads.length} downloaded
        </Text>
      </View>

      <SectionTitle title="Subscriptions" />
      {subscriptions.length === 0 ? (
        <EmptySubs onBrowse={() => router.push("/search")} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScroll}
        >
          {subscriptions.map((p) => (
            <SubCard
              key={p.collectionId}
              item={p}
              onPress={() =>
                router.push({
                  pathname: "/podcast/[id]",
                  params: {
                    id: String(p.collectionId),
                    feedUrl: p.feedUrl,
                    name: p.collectionName,
                    artist: p.artistName,
                    art: p.artworkUrl600,
                  },
                })
              }
            />
          ))}
        </ScrollView>
      )}

      <SectionTitle title="Popular right now" />
      {loading ? (
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <View style={styles.grid}>
          {recommended.map((p) => (
            <TouchableOpacity
              key={p.collectionId}
              style={styles.gridItem}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: "/podcast/[id]",
                  params: {
                    id: String(p.collectionId),
                    feedUrl: p.feedUrl,
                    name: p.collectionName,
                    artist: p.artistName,
                    art: p.artworkUrl600 || p.artworkUrl100,
                  },
                })
              }
              testID={`popular-podcast-${p.collectionId}`}
            >
              <Image
                source={{ uri: p.artworkUrl600 || p.artworkUrl100 || fallbackArt }}
                style={styles.gridArt}
                contentFit="cover"
              />
              <Text numberOfLines={2} style={styles.gridTitle}>
                {p.collectionName}
              </Text>
              <Text numberOfLines={1} style={styles.gridArtist}>
                {p.artistName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const SectionTitle = ({ title }: { title: string }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

const SubCard = ({ item, onPress }: { item: SubscribedPodcast; onPress: () => void }) => (
  <TouchableOpacity
    style={styles.subCard}
    onPress={onPress}
    activeOpacity={0.85}
    testID={`sub-card-${item.collectionId}`}
  >
    <Image
      source={{ uri: item.artworkUrl600 || fallbackArt }}
      style={styles.subArt}
      contentFit="cover"
    />
    <Text numberOfLines={2} style={styles.subCardTitle}>
      {item.collectionName}
    </Text>
  </TouchableOpacity>
);

const EmptySubs = ({ onBrowse }: { onBrowse: () => void }) => (
  <View style={styles.empty}>
    <Image source={{ uri: emptyStateMic }} style={styles.emptyImg} contentFit="cover" />
    <Text style={styles.emptyTitle}>No subscriptions yet</Text>
    <Text style={styles.emptySub}>
      Find podcasts you love and subscribe to get the latest episodes here.
    </Text>
    <TouchableOpacity style={styles.emptyBtn} onPress={onBrowse} testID="library-browse-btn">
      <Ionicons name="search" size={16} color={colors.background} />
      <Text style={styles.emptyBtnText}>Browse podcasts</Text>
    </TouchableOpacity>
  </View>
);

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
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  hScroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  subCard: { width: 130, marginRight: spacing.md },
  subArt: {
    width: 130,
    height: 130,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  subCardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginTop: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg - 4,
  },
  gridItem: { width: "50%", padding: 4, marginBottom: spacing.md },
  gridArt: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  gridTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 8 },
  gridArtist: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
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
    marginBottom: spacing.md,
    lineHeight: 18,
  },
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
});
