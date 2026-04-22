import * as FileSystem from "expo-file-system/legacy";
import { Platform, Alert } from "react-native";
import type { DownloadedEpisode } from "./context/LibraryContext";

export type DownloadableEpisode = {
  id: string;
  title: string;
  audioUrl: string;
  duration?: string;
  image?: string;
  podcastId?: number | string;
  podcastName?: string;
};

export function parseDurationToSec(duration?: string): number {
  if (!duration) return 0;
  if (/^\d+$/.test(duration)) return parseInt(duration, 10);
  const parts = duration.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export async function downloadEpisode(
  ep: DownloadableEpisode,
  onProgress?: (pct: number) => void
): Promise<DownloadedEpisode | null> {
  if (Platform.OS === "web") {
    Alert.alert(
      "Downloads unavailable",
      "Offline downloads are not supported on web preview. Try on device or Expo Go."
    );
    return null;
  }
  if (!ep.audioUrl) {
    Alert.alert("No audio", "This episode has no audio URL.");
    return null;
  }
  const safeName = ep.id.replace(/[^a-z0-9-_]/gi, "_").slice(0, 60) || `ep_${Date.now()}`;
  const ext = ep.audioUrl.split("?")[0].split(".").pop() || "mp3";
  const dir = `${FileSystem.documentDirectory}episodes/`;
  const target = `${dir}${safeName}.${ext}`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const task = FileSystem.createDownloadResumable(
      ep.audioUrl,
      target,
      {},
      (p) => {
        const pct = p.totalBytesExpectedToWrite
          ? p.totalBytesWritten / p.totalBytesExpectedToWrite
          : 0;
        onProgress?.(pct);
      }
    );
    const res = await task.downloadAsync();
    if (!res) throw new Error("Download returned no result");
    return {
      id: ep.id,
      title: ep.title,
      audioUrl: ep.audioUrl,
      localUri: res.uri,
      image: ep.image,
      podcastName: ep.podcastName,
      podcastId: ep.podcastId,
      durationSec: parseDurationToSec(ep.duration),
      addedAt: Date.now(),
    };
  } catch (e: any) {
    Alert.alert("Download failed", e?.message || "Unknown error");
    return null;
  }
}
