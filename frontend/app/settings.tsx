import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { useSettings } from "../src/context/SettingsContext";
import { useLibrary } from "../src/context/LibraryContext";
import { colors, radius, spacing } from "../src/theme";
import { exportOpml, importOpml } from "../src/opml";

const SKIP_MIN = 1;
const SKIP_MAX = 20;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    skipForward, skipBackward, storagePath, storageLabel,
    setSkipForward, setSkipBackward,
  } = useSettings();
  const { subscriptions, downloads, subscribe } = useLibrary();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try { await exportOpml(subscriptions); }
    finally { setExporting(false); }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const existing = new Set(subscriptions.map((s) => s.collectionId));
      const result = await importOpml(existing, subscribe);
      if (result) {
        const msg = [
          `Added: ${result.added}`,
          result.skipped > 0 ? `Already subscribed: ${result.skipped}` : "",
          result.failed > 0 ? `Failed: ${result.failed}` : "",
          `Total in file: ${result.total}`,
        ].filter(Boolean).join("\n");
        Alert.alert("Import complete", msg);
      }
    } finally { setImporting(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          testID="settings-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PREFERENCES</Text>
          <Text style={styles.h1}>Settings</Text>
          <Text style={styles.sub}>
            {subscriptions.length} subscriptions · {downloads.length} downloads
          </Text>
        </View>

        <Section title="Storage">
          <Text style={styles.desc}>Where downloaded episodes are saved.</Text>
          <TouchableOpacity
            style={styles.folderBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/settings/storage")}
            testID="storage-picker-btn"
          >
            <View style={styles.folderIcon}>
              <Ionicons name="folder" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.folderLabel}>{storageLabel}</Text>
              <Text style={styles.folderPath} numberOfLines={1}>
                {storagePath}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </Section>

        <Section title="Subscriptions">
          <Text style={styles.desc}>
            Back up your feeds as an OPML file, or bring them in from another podcast app.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={handleExport}
              disabled={exporting}
              activeOpacity={0.85}
              testID="opml-export-btn"
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Ionicons name="cloud-upload" size={16} color={colors.background} />
              )}
              <Text style={styles.actionPrimaryText}>Export OPML</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.85}
              testID="opml-import-btn"
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <Ionicons name="cloud-download" size={16} color={colors.textPrimary} />
              )}
              <Text style={styles.actionSecondaryText}>Import OPML</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title="Player">
          <Text style={styles.desc}>How far each skip button jumps.</Text>

          <View style={styles.sliderLabelRow}>
            <Text style={styles.rowLabel}>Skip forward</Text>
            <Text style={styles.sliderValue}>{skipForward}s</Text>
          </View>
          <Slider
            style={styles.slider}
            value={skipForward}
            minimumValue={SKIP_MIN}
            maximumValue={SKIP_MAX}
            step={1}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor="rgba(255,255,255,0.18)"
            thumbTintColor={colors.accent}
            onValueChange={(v) => setSkipForward(Math.round(v))}
            testID="skip-forward-slider"
          />
          <View style={styles.sliderTicks}>
            <Text style={styles.sliderTick}>{SKIP_MIN}s</Text>
            <Text style={styles.sliderTick}>{SKIP_MAX}s</Text>
          </View>

          <View style={[styles.sliderLabelRow, { marginTop: spacing.md }]}>
            <Text style={styles.rowLabel}>Skip backward</Text>
            <Text style={styles.sliderValue}>{skipBackward}s</Text>
          </View>
          <Slider
            style={styles.slider}
            value={skipBackward}
            minimumValue={SKIP_MIN}
            maximumValue={SKIP_MAX}
            step={1}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor="rgba(255,255,255,0.18)"
            thumbTintColor={colors.accent}
            onValueChange={(v) => setSkipBackward(Math.round(v))}
            testID="skip-backward-slider"
          />
          <View style={styles.sliderTicks}>
            <Text style={styles.sliderTick}>{SKIP_MIN}s</Text>
            <Text style={styles.sliderTick}>{SKIP_MAX}s</Text>
          </View>
        </Section>

        <Section title="About">
          <InfoRow label="App" value="Podcast Player" />
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Platform" value={Platform.OS} />
        </Section>
      </ScrollView>
    </View>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  topTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  eyebrow: {
    color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 6,
  },
  h1: { color: colors.textPrimary, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: {
    color: colors.textSecondary, fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm + 2 },
  folderBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md - 2,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  folderIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(245,158,11,0.25)",
  },
  folderLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  folderPath: { color: colors.textSecondary, fontSize: 11, marginTop: 3, fontFamily: "Courier" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1,
  },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionSecondary: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
  actionPrimaryText: { color: colors.background, fontWeight: "700", fontSize: 13 },
  actionSecondaryText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  rowLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  sliderLabelRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  sliderValue: {
    color: colors.accent, fontSize: 14, fontWeight: "700",
    fontVariant: ["tabular-nums"], marginBottom: 8,
  },
  slider: { width: "100%", height: 34 },
  sliderTicks: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 4, marginTop: -4,
  },
  sliderTick: { color: colors.textTertiary, fontSize: 11 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.background },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.textSecondary, fontSize: 13 },
  infoValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
});
