import * as FileSystem from "expo-file-system";
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
  isVideo?: boolean;
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

const SAF_SCHEME = "content://";

export async function downloadEpisode(
  ep: DownloadableEpisode,
  storagePath: string,
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
  const fileName = `${safeName}.${ext}`;

  // SAF (Android picked folder) path -> download to cache first, then copy in via SAF APIs
  const usingSAF = storagePath.startsWith(SAF_SCHEME);
  const dir = usingSAF ? `${FileSystem.cacheDirectory}episodes/` : storagePath;
  const tempTarget = `${dir}${fileName}`;

  try {
    if (!usingSAF) {
      try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    } else {
      try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    }
    const task = FileSystem.createDownloadResumable(
      ep.audioUrl,
      tempTarget,
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

    let finalUri = res.uri;
    if (usingSAF && Platform.OS === "android") {
      // Move the file into the user-picked SAF directory.
      try {
        // @ts-ignore — Android only
        const SAF = (FileSystem as any).StorageAccessFramework;
        const content = await FileSystem.readAsStringAsync(res.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const newUri = await SAF.createFileAsync(storagePath, fileName, "audio/mpeg");
        await SAF.writeAsStringAsync(newUri, content, {
          encoding: FileSystem.EncodingType.Base64,
        });
        try { await FileSystem.deleteAsync(res.uri, { idempotent: true }); } catch {}
        finalUri = newUri;
      } catch (e) {
        // Fallback: keep the cache copy.
        console.warn("SAF move failed, keeping cache copy", e);
      }
    }

    return {
      id: ep.id,
      title: ep.title,
      audioUrl: ep.audioUrl,
      localUri: finalUri,
      image: ep.image,
      podcastName: ep.podcastName,
      podcastId: ep.podcastId,
      durationSec: parseDurationToSec(ep.duration),
      addedAt: Date.now(),
      isVideo: !!ep.isVideo,
    };
  } catch (e: any) {
    Alert.alert("Download failed", e?.message || "Unknown error");
    return null;
  }
}
