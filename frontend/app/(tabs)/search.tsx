import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { searchPodcasts, SearchResult } from "../../src/api";
import { colors, fallbackArt, radius, spacing, emptyStateMic } from "../../src/theme";

const SUGGESTIONS = ["News", "Comedy", "True Crime", "Tech", "Business", "Science", "Health"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const reqIdRef = useRef(0);

  const doSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const r = await searchPodcasts(trimmed, 30);
      if (myId === reqIdRef.current) setResults(r);
    } catch (e: any) {
      if (myId === reqIdRef.current) setError(e?.message || "Search failed");
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  const onSubmit = () => {
    Keyboard.dismiss();
    doSearch(query);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerWrap}>
        <Text style={styles.eyebrow}>DISCOVER</Text>
        <Text style={styles.h1}>Search</Text>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginLeft: 4 }} />
          <TextInput
            style={styles.input}
            placeholder="Podcasts, shows, topics"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            testID="search-input"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setResults([]);
                setSearched(false);
              }}
              hitSlop={8}
              testID="search-clear"
            >
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {!searched && (
          <View style={styles.suggestWrap}>
            <Text style={styles.suggestLabel}>Try one of these</Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.chip}
                  onPress={() => {
                    setQuery(s);
                    doSearch(s);
                  }}
                  testID={`suggestion-${s}`}
                >
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.dim}>Searching…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.centerPad}>
          <Ionicons name="alert-circle" size={36} color={colors.danger} />
          <Text style={styles.dim}>{error}</Text>
        </View>
      )}

      {!loading && !error && searched && results.length === 0 && (
        <View style={styles.centerPad}>
          <Image source={{ uri: emptyStateMic }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.dim}>No podcasts found for “{query}”</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.collectionId)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 200 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/podcast/[id]",
                params: {
                  id: String(item.collectionId),
                  feedUrl: item.feedUrl,
                  name: item.collectionName,
                  artist: item.artistName,
                  art: item.artworkUrl600 || item.artworkUrl100,
                },
              })
            }
            testID={`search-result-${item.collectionId}`}
          >
            <Image
              source={{ uri: item.artworkUrl600 || item.artworkUrl100 || fallbackArt }}
              style={styles.rowArt}
              contentFit="cover"
            />
            <View style={styles.rowText}>
              <Text numberOfLines={2} style={styles.rowTitle}>
                {item.collectionName}
              </Text>
              <Text numberOfLines={1} style={styles.rowArtist}>
                {item.artistName}
              </Text>
              {!!item.primaryGenreName && (
                <Text numberOfLines={1} style={styles.rowGenre}>
                  {item.primaryGenreName}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 6,
  },
  h1: { color: colors.textPrimary, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    marginTop: spacing.md,
    height: 46,
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  suggestWrap: { marginTop: spacing.md },
  suggestLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "500" },
  centerPad: { alignItems: "center", paddingVertical: 40, gap: 10 },
  dim: { color: colors.textSecondary, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowArt: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  rowText: { flex: 1 },
  rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  rowArtist: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  rowGenre: { color: colors.accent, fontSize: 11, marginTop: 3, fontWeight: "600" },
  emptyImg: { width: 120, height: 120, borderRadius: radius.md, opacity: 0.8 },
});
