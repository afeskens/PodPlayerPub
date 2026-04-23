import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { useSettings } from "../../src/context/SettingsContext";
import { colors, radius, spacing } from "../../src/theme";

type Location = {
  key: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  available: boolean;
};

export default function StoragePicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storagePath, setStorage } = useSettings();
  const [busy, setBusy] = useState(false);

  const locations: Location[] = [
    {
      key: "documents",
      label: "App Documents",
      subtitle: "Private storage managed by the app. Always available.",
      icon: "document-lock",
      path: `${FileSystem.documentDirectory || ""}episodes/`,
      available: true,
    },
    {
      key: "cache",
      label: "Cache",
      subtitle: "Temporary storage that the OS may clear automatically.",
      icon: "flash",
      path: `${FileSystem.cacheDirectory || ""}episodes/`,
      available: true,
    },
  ];

  const chooseSAF = async () => {
    if (Platform.OS !== "android") return;
    setBusy(true);
    try {
      // @ts-ignore — StorageAccessFramework available on Android
      const SAF = (FileSystem as any).StorageAccessFramework;
      if (!SAF) throw new Error("Storage Access Framework not available");
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) {
        setBusy(false);
        return;
      }
      const uri = perm.directoryUri;
      const label = decodeURIComponent(uri.split("/").pop() || "SD Card");
      await setStorage(uri, label);
      router.back();
    } catch (e: any) {
      Alert.alert("Folder pick failed", e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const selectPreset = async (loc: Location) => {
    setBusy(true);
    try {
      if (loc.path.startsWith("file://") || loc.path.startsWith("/") || loc.path.includes(":/")) {
        try { await FileSystem.makeDirectoryAsync(loc.path, { intermediates: true }); } catch {}
      }
      await setStorage(loc.path, loc.label);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          testID="storage-picker-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Choose Storage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DOWNLOAD FOLDER</Text>
          <Text style={styles.h1}>Where to save episodes</Text>
          <Text style={styles.sub}>Downloaded audio files will live here.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Built-in</Text>
          {locations.map((loc) => {
            const selected = storagePath === loc.path;
            return (
              <TouchableOpacity
                key={loc.key}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => selectPreset(loc)}
                disabled={busy || !loc.available}
                activeOpacity={0.85}
                testID={`storage-preset-${loc.key}`}
              >
                <View style={[styles.folderIcon, selected && styles.folderIconActive]}>
                  <Ionicons
                    name={loc.icon}
                    size={18}
                    color={selected ? colors.background : colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{loc.label}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={2}>
                    {loc.subtitle}
                  </Text>
                  <Text style={styles.rowPath} numberOfLines={1}>
                    {loc.path}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device / SD Card</Text>
          <TouchableOpacity
            style={[styles.row, !Platform.OS.startsWith("a") && { opacity: 0.5 }]}
            onPress={chooseSAF}
            disabled={busy || Platform.OS !== "android"}
            activeOpacity={0.85}
            testID="storage-browse"
          >
            <View style={styles.folderIcon}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="folder-open" size={18} color={colors.accent} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Browse…</Text>
              <Text style={styles.rowSubtitle}>
                {Platform.OS === "android"
                  ? "Pick a folder on internal storage or an SD card (Storage Access Framework)."
                  : "Folder picking is only available on Android."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

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
    color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 6,
  },
  h1: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: {
    color: colors.textSecondary, fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.accent },
  folderIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  folderIconActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  rowSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
  rowPath: { color: colors.textTertiary, fontSize: 11, marginTop: 4, fontFamily: "Courier" },
});
