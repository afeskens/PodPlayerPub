import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import type { SubscribedPodcast } from "./context/LibraryContext";
import { fetchFeed } from "./api";

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildOpml(subs: SubscribedPodcast[]): string {
  const now = new Date().toUTCString();
  const outlines = subs
    .map((p) => {
      const title = escapeXml(p.collectionName);
      const xmlUrl = escapeXml(p.feedUrl);
      const text = escapeXml(p.collectionName);
      const author = escapeXml(p.artistName || "");
      return `    <outline type="rss" text="${text}" title="${title}" xmlUrl="${xmlUrl}" author="${author}" />`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>PodPlayer subscriptions</title>
    <dateCreated>${now}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

export async function exportOpml(subs: SubscribedPodcast[]): Promise<void> {
  if (subs.length === 0) {
    Alert.alert("Nothing to export", "You have no subscriptions yet.");
    return;
  }
  const xml = buildOpml(subs);
  const uri = `${FileSystem.cacheDirectory}subscriptions-${Date.now()}.opml`;
  try {
    await FileSystem.writeAsStringAsync(uri, xml, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (e: any) {
    Alert.alert("Export failed", e?.message || "Could not write file");
    return;
  }
  if (Platform.OS === "web") {
    Alert.alert("Exported", `OPML written to ${uri}`);
    return;
  }
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert("Exported", `OPML written to ${uri}`);
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: "text/xml",
    dialogTitle: "Export OPML",
    UTI: "org.opml.opml",
  });
}

/** Extract attributes from an <outline ... /> element */
function parseOutline(raw: string): { xmlUrl?: string; title?: string; text?: string; author?: string } {
  const get = (attr: string) => {
    const m = raw.match(new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, "i"));
    return m ? m[1] : undefined;
  };
  return {
    xmlUrl: get("xmlUrl") || get("xmlurl"),
    title: get("title"),
    text: get("text"),
    author: get("author"),
  };
}

function unescapeXml(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

export type ImportedFeed = {
  feedUrl: string;
  title: string;
  author: string;
};

export function parseOpml(xml: string): ImportedFeed[] {
  const outlines = xml.match(/<outline[^>]*\/?>(?:[^<]*<\/outline>)?/gi) || [];
  const results: ImportedFeed[] = [];
  const seen = new Set<string>();
  for (const raw of outlines) {
    const a = parseOutline(raw);
    if (!a.xmlUrl) continue;
    const url = unescapeXml(a.xmlUrl);
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({
      feedUrl: url,
      title: unescapeXml(a.title || a.text || "Untitled"),
      author: unescapeXml(a.author || ""),
    });
  }
  return results;
}

/** Deterministic collectionId from a feed URL so we can dedupe */
export function feedUrlToCollectionId(url: string): number {
  // Simple 32-bit hash (positive).
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type ImportResult = {
  added: number;
  skipped: number;
  failed: number;
  total: number;
};

export async function importOpml(
  existingIds: Set<number>,
  onSubscribe: (p: SubscribedPodcast) => Promise<void>
): Promise<ImportResult | null> {
  let pick;
  try {
    pick = await DocumentPicker.getDocumentAsync({
      type: ["text/xml", "text/x-opml+xml", "application/xml", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (e: any) {
    Alert.alert("Pick failed", e?.message || "Could not open document picker");
    return null;
  }
  if (pick.canceled) return null;
  const asset = pick.assets?.[0];
  if (!asset) return null;
  let xml = "";
  try {
    xml = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (e: any) {
    Alert.alert("Read failed", e?.message || "Could not read file");
    return null;
  }
  const feeds = parseOpml(xml);
  if (feeds.length === 0) {
    Alert.alert("Nothing found", "No <outline> feeds found in this OPML file.");
    return { added: 0, skipped: 0, failed: 0, total: 0 };
  }
  let added = 0;
  let skipped = 0;
  let failed = 0;
  for (const f of feeds) {
    const cid = feedUrlToCollectionId(f.feedUrl);
    if (existingIds.has(cid)) {
      skipped++;
      continue;
    }
    // Try to enrich with artwork from the feed itself (best-effort).
    let artworkUrl600 = "";
    let primaryGenreName = "";
    try {
      const feed = await fetchFeed(f.feedUrl, 1);
      artworkUrl600 = feed.image || "";
    } catch {
      failed++;
      // still subscribe with what we have
    }
    try {
      await onSubscribe({
        collectionId: cid,
        collectionName: f.title,
        artistName: f.author,
        artworkUrl600,
        feedUrl: f.feedUrl,
        primaryGenreName,
      });
      existingIds.add(cid);
      added++;
    } catch {
      failed++;
    }
  }
  return { added, skipped, failed, total: feeds.length };
}
