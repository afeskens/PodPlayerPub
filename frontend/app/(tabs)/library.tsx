import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLibrary, SubscribedPodcast } from "../../src/context/LibraryContext";
import { colors, fallbackArt, radius, spacing, emptyStateMic } from "../../src/theme";

export default function LibraryTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subscriptions, unsubscribe, downloads } = useLibrary();
  const [editing, setEditing] = useState(false);

  const confirmUnsubscribe = (p: SubscribedPodcast) => {
    Alert.alert(
      "Unsubscribe?",
      `Stop following "${p.collectionName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsubscribe",
          style: "destructive",
          onPress: () => unsubscribe(p.collectionId),
        },
      ]
    );
  };

  const openDetail = (p: SubscribedPodcast) => {
    router.push({
      pathname: "/podcast/[id]",
      params: {
        id: String(p.collectionId),
        feedUrl: p.feedUrl,
        name: p.collectionName,
        artist: p.artistName,
        art: p.artworkUrl600,
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR SUBSCRIPTIONS</Text>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Library</Text>
          <View style={styles.headerActions}>
            {subscriptions.length > 0 && (
              <TouchableOpacity
                onPress={() => setEditing((v) => !v)}
                style={[styles.iconBtn, editing && styles.iconBtnActive]}
                hitSlop={8}
                testID="library-edit-toggle"
              >
                <Text style={[styles.editText, editing && { color: colors.background }]}>
                  {editing ? "Done" : "Edit"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.sub}>
          {subscriptions.length === 0
            ? "Follow a podcast from Search to add it here"
            : `${subscriptions.length} ${subscriptions.length === 1 ? "podcast" : "podcasts"} · ${downloads.length} downloaded`}
        </Text>
      </View>

      {subscriptions.length === 0 ? (
        <View style={styles.empty}>
          <Image source={{ uri: emptyStateMic }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>No subscriptions yet</Text>
          <Text style={styles.emptySub}>
            Use the Search tab to find podcasts you love, then tap the + to follow them.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push("/")}
            testID="library-go-search"
          >
            <Ionicons name="search" size={16} color={colors.background} />
            <Text style={styles.emptyBtnText}>Go to Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={subscriptions}
          keyExtractor={(p) => String(p.collectionId)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 160 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => (editing ? confirmUnsubscribe(item) : openDetail(item))}
              testID={`library-podcast-${item.collectionId}`}
            >
              <Image
                source={{ uri: item.artworkUrl600 || fallbackArt }}
                style={styles.art}
                contentFit="cover"
              />
              <View style={styles.texts}>
                <Text numberOfLines={2} style={styles.title}>
                  {item.collectionName}
                </Text>
                <Text numberOfLines={1} style={styles.artist}>
                  {item.artistName}
                </Text>
                {!!item.primaryGenreName && (
                  <Text numberOfLines={1} style={styles.genre}>
                    {item.primaryGenreName}
                  </Text>
                )}
              </View>
              {editing ? (
                <View style={styles.removeBtn} testID={`library-unsubscribe-${item.collectionId}`}>
                  <Ionicons name="remove" size={18} color={colors.background} />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    minWidth: 42,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  editText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
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
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: spacing.md, lineHeight: 18 },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  art: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  texts: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  artist: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  genre: { color: colors.accent, fontSize: 11, marginTop: 3, fontWeight: "600" },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
});
