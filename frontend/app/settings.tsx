import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings, StorageLocation } from "../src/context/SettingsContext";
import { useLibrary } from "../src/context/LibraryContext";
import { colors, radius, spacing } from "../src/theme";

const SKIP_OPTIONS = [1, 3, 5, 8, 10, 15];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    skipForward, skipBackward, storage, sdCardSupported,
    setSkipForward, setSkipBackward, setStorage,
  } = useSettings();
  const { subscriptions, downloads } = useLibrary();

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

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PREFERENCES</Text>
          <Text style={styles.h1}>Settings</Text>
          <Text style={styles.sub}>
            {subscriptions.length} subscriptions · {downloads.length} downloads
          </Text>
        </View>

        <Section title="Storage">
          <Text style={styles.desc}>Choose where downloaded episodes are saved.</Text>
          <View style={styles.segment} testID="storage-segment">
            <SegmentButton
              label="Internal"
              icon="phone-portrait"
              active={storage === "internal"}
              onPress={() => setStorage("internal")}
              testID="storage-internal"
            />
            <SegmentButton
              label="SD Card"
              icon="save"
              active={storage === "sdcard"}
              onPress={() => setStorage("sdcard" as StorageLocation)}
              disabled={!sdCardSupported}
              testID="storage-sdcard"
            />
          </View>
          {!sdCardSupported && (
            <Text style={styles.hint}>
              {Platform.OS === "ios"
                ? "SD Card storage is not available on iOS."
                : "SD Card storage is only available on Android devices with a card."}
            </Text>
          )}
        </Section>

        <Section title="Player">
          <Text style={styles.desc}>How far each skip button jumps.</Text>

          <Text style={styles.rowLabel}>Skip forward</Text>
          <View style={styles.chips} testID="skip-forward-chips">
            {SKIP_OPTIONS.map((n) => (
              <TouchableOpacity
                key={`fwd-${n}`}
                style={[styles.chip, skipForward === n && styles.chipActive]}
                onPress={() => setSkipForward(n)}
                testID={`skip-forward-${n}`}
              >
                <Text style={[styles.chipText, skipForward === n && styles.chipTextActive]}>
                  {n}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.rowLabel, { marginTop: spacing.md }]}>Skip backward</Text>
          <View style={styles.chips} testID="skip-backward-chips">
            {SKIP_OPTIONS.map((n) => (
              <TouchableOpacity
                key={`bwd-${n}`}
                style={[styles.chip, skipBackward === n && styles.chipActive]}
                onPress={() => setSkipBackward(n)}
                testID={`skip-backward-${n}`}
              >
                <Text style={[styles.chipText, skipBackward === n && styles.chipTextActive]}>
                  {n}s
                </Text>
              </TouchableOpacity>
            ))}
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

const SegmentButton = ({
  label, icon, active, onPress, disabled, testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) => (
  <TouchableOpacity
    style={[styles.segBtn, active && styles.segBtnActive, disabled && { opacity: 0.4 }]}
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    testID={testID}
  >
    <Ionicons name={icon} size={16} color={active ? colors.background : colors.textPrimary} />
    <Text style={[styles.segLabel, active && { color: colors.background }]}>{label}</Text>
  </TouchableOpacity>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 6,
  },
  h1: { color: colors.textPrimary, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm + 2 },
  segment: { flexDirection: "row", gap: 8 },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segLabel: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  hint: { color: colors.textTertiary, fontSize: 12, marginTop: 8 },
  rowLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.background },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.textSecondary, fontSize: 13 },
  infoValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
});
