// Fully client-side API — no backend required.
// - Search/Top: calls iTunes Search API directly (public, CORS-enabled)
// - Feed: downloads RSS XML and parses on device with react-native-rss-parser
import * as rssParser from "react-native-rss-parser";

export type SearchResult = {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  artworkUrl100: string;
  feedUrl: string;
  primaryGenreName: string;
  trackCount: number;
};

export type FeedEpisode = {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  pubDate: string;
  duration: string;
  image: string;
};

export type Feed = {
  title: string;
  author: string;
  description: string;
  image: string;
  episodes: FeedEpisode[];
};

const ITUNES = "https://itunes.apple.com/search";

function mapItunesResult(r: any): SearchResult {
  return {
    collectionId: r.collectionId,
    collectionName: r.collectionName || "",
    artistName: r.artistName || "",
    artworkUrl600: r.artworkUrl600 || r.artworkUrl100 || "",
    artworkUrl100: r.artworkUrl100 || "",
    feedUrl: r.feedUrl || "",
    primaryGenreName: r.primaryGenreName || "",
    trackCount: r.trackCount || 0,
  };
}

export async function searchPodcasts(term: string, limit = 25): Promise<SearchResult[]> {
  const qs = new URLSearchParams({
    term,
    media: "podcast",
    limit: String(limit),
  });
  const res = await fetch(`${ITUNES}?${qs.toString()}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(mapItunesResult);
}

export async function topPodcasts(genre?: string, limit = 20): Promise<SearchResult[]> {
  // Approximate "top" using the iTunes search with the genre keyword.
  return searchPodcasts(genre || "news", limit);
}

function stripHtml(s: string): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").trim();
}

function pickAudioUrl(item: any): string {
  // react-native-rss-parser exposes enclosures[] with { url, length, mimeType }
  const enclosures = item.enclosures || [];
  const audio = enclosures.find(
    (e: any) => typeof e?.mimeType === "string" && e.mimeType.toLowerCase().includes("audio")
  );
  if (audio?.url) return audio.url;
  if (enclosures[0]?.url) return enclosures[0].url;
  return "";
}

function pickItemImage(item: any, fallback: string): string {
  // itunes:image via itunes namespace (parser exposes item.itunes?.image)
  if (item.itunes?.image) return item.itunes.image;
  if (item.image?.url) return item.image.url;
  return fallback;
}

function pickDuration(item: any): string {
  if (item.itunes?.duration) return String(item.itunes.duration);
  return "";
}

export async function fetchFeed(feedUrl: string, limit = 100): Promise<Feed> {
  let res: Response;
  try {
    res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 PodcastPlayer" },
    });
  } catch (e: any) {
    throw new Error(`Feed fetch failed: ${e?.message || "network error"}`);
  }
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  let rss;
  try {
    rss = await rssParser.parse(xml);
  } catch (e: any) {
    throw new Error(`Feed parse failed: ${e?.message || "invalid XML"}`);
  }

  const feedImage =
    rss.image?.url ||
    // react-native-rss-parser exposes itunes image at rss.itunes?.image
    (rss as any).itunes?.image ||
    "";

  const episodes: FeedEpisode[] = (rss.items || []).slice(0, limit).map((it: any, i: number) => {
    const rawDesc: string = it.description || it.content || it.itunes?.summary || "";
    return {
      id: it.id || it.links?.[0]?.url || `${i}-${it.title || "episode"}`,
      title: it.title || "",
      description: stripHtml(rawDesc).slice(0, 1000),
      audioUrl: pickAudioUrl(it),
      pubDate: it.published || "",
      duration: pickDuration(it),
      image: pickItemImage(it, feedImage),
    };
  });

  return {
    title: rss.title || "",
    author: rss.authors?.[0]?.name || (rss as any).itunes?.author || "",
    description: stripHtml(rss.description || "").slice(0, 2000),
    image: feedImage,
    episodes,
  };
}

// Stable integer derived from a feed URL. Used as the `collectionId` for
// custom (non-iTunes) podcast subscriptions. Must match
// `opml.feedUrlToCollectionId` so that exporting → re-importing a custom
// feed via OPML doesn't create a duplicate subscription.
export function customFeedId(url: string): number {
  const s = (url || "").trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0; // djb2, 32-bit
  }
  return Math.abs(h);
}

// Convenience: fetch a feed URL and shape it into a SubscribedPodcast-like
// payload (the caller decides whether to actually call subscribe()).
export async function previewCustomFeed(url: string): Promise<{
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl: string;
  primaryGenreName: string;
  episodeCount: number;
}> {
  const trimmed = (url || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Please enter a full http(s):// URL");
  }
  const feed = await fetchFeed(trimmed, 3);
  const title = (feed.title || "").trim();
  if (!title) throw new Error("Feed has no <title> — is this an RSS feed?");
  return {
    collectionId: customFeedId(trimmed),
    collectionName: title,
    artistName: feed.author || "",
    artworkUrl600: feed.image || "",
    feedUrl: trimmed,
    primaryGenreName: "Custom",
    episodeCount: feed.episodes.length,
  };
}
