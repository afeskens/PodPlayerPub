// Multi-source podcast search abstraction.
// Each provider exposes a unified `search(query)` -> SearchResult[] API,
// letting the UI swap between Apple iTunes, Podcast Index, Fyyd, or a
// user-supplied custom JSON endpoint without any tab-specific code.
import sha1 from "js-sha1";
import { SearchResult } from "./api";
import { customFeedId } from "./api";

export type ProviderId = "itunes" | "podcastindex" | "fyyd" | "custom";

export type ProviderConfig = {
  source: ProviderId;
  podcastIndex?: { apiKey: string; apiSecret: string };
  custom?: {
    urlTemplate: string;     // e.g. "https://x.com/api/search?q={query}"
    resultsPath: string;     // dot path to results array, e.g. "data.results"
    fields: {
      collectionId?: string;     // path inside item, optional
      collectionName: string;
      artistName?: string;
      artworkUrl?: string;
      feedUrl: string;
      genre?: string;
    };
  };
};

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const PI_SEARCH = "https://api.podcastindex.org/api/1.0/search/byterm";
const FYYD_SEARCH = "https://api.fyyd.de/0.2/search/podcast";

// ---------- Helpers ----------

function readPath(obj: any, path?: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function safeString(v: any): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

// ---------- iTunes ----------

async function searchItunes(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const url = `${ITUNES_SEARCH}?media=podcast&entity=podcast&limit=25&term=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`iTunes search failed (${res.status})`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r: any): SearchResult => ({
    collectionId: r.collectionId,
    collectionName: r.collectionName || r.trackName || "",
    artistName: r.artistName || "",
    artworkUrl600: r.artworkUrl600 || r.artworkUrl100 || "",
    artworkUrl100: r.artworkUrl100 || "",
    feedUrl: r.feedUrl || "",
    primaryGenreName: r.primaryGenreName || "",
    trackCount: r.trackCount || 0,
  }));
}

// ---------- Podcast Index ----------
// Auth requires three headers:
//   X-Auth-Date:    unix timestamp (seconds)
//   X-Auth-Key:     api_key
//   Authorization:  sha1(api_key + api_secret + ts)
//   User-Agent:     anything

async function searchPodcastIndex(
  query: string,
  cfg: ProviderConfig,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const key = cfg.podcastIndex?.apiKey?.trim();
  const secret = cfg.podcastIndex?.apiSecret?.trim();
  if (!key || !secret) {
    throw new Error("Podcast Index API key + secret are required. Add them in Settings → Search Sources.");
  }
  const ts = Math.floor(Date.now() / 1000).toString();
  const auth = sha1(key + secret + ts);
  const url = `${PI_SEARCH}?q=${encodeURIComponent(query)}&max=25`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PodPlayer/1.0",
      "X-Auth-Date": ts,
      "X-Auth-Key": key,
      "Authorization": auth,
      "Accept": "application/json",
    },
    signal,
  });
  if (!res.ok) throw new Error(`Podcast Index search failed (${res.status})`);
  const data = await res.json();
  const feeds = Array.isArray(data?.feeds) ? data.feeds : [];
  return feeds.map((f: any): SearchResult => ({
    collectionId: typeof f.id === "number" ? f.id : customFeedId(safeString(f.url)),
    collectionName: f.title || "",
    artistName: f.author || f.ownerName || "",
    artworkUrl600: f.artwork || f.image || "",
    artworkUrl100: f.image || f.artwork || "",
    feedUrl: f.url || "",
    primaryGenreName: Array.isArray(f.categories)
      ? Object.values(f.categories || {}).join(", ").slice(0, 80)
      : safeString(f.categories),
    trackCount: f.episodeCount || 0,
  }));
}

// ---------- Fyyd ----------

async function searchFyyd(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const url = `${FYYD_SEARCH}?term=${encodeURIComponent(query)}&count=25`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Fyyd search failed (${res.status})`);
  const data = await res.json();
  const items = Array.isArray(data?.data) ? data.data : [];
  return items.map((p: any): SearchResult => ({
    collectionId: typeof p.id === "number" ? p.id : customFeedId(safeString(p.xmlURL || p.htmlURL)),
    collectionName: p.title || "",
    artistName: p.author || p.smallTitle || "",
    artworkUrl600: p.imgURL || p.thumbImageURL || "",
    artworkUrl100: p.thumbImageURL || p.imgURL || "",
    feedUrl: p.xmlURL || "",
    primaryGenreName: safeString(p.layoutImageURL ? "" : p.language || ""),
    trackCount: p.episodeCount || 0,
  }));
}

// ---------- Custom ----------

async function searchCustom(
  query: string,
  cfg: ProviderConfig,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const c = cfg.custom;
  if (!c?.urlTemplate || !c.fields?.feedUrl || !c.fields?.collectionName) {
    throw new Error("Custom search isn't fully configured. Open Settings → Search Sources to set the URL template and field paths.");
  }
  const url = c.urlTemplate.replaceAll("{query}", encodeURIComponent(query));
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Custom search failed (${res.status})`);
  const data = await res.json();
  const arr = readPath(data, c.resultsPath) || data;
  if (!Array.isArray(arr)) throw new Error(`Custom search: results path "${c.resultsPath}" did not return an array`);
  return arr.map((it: any): SearchResult => {
    const feedUrl = safeString(readPath(it, c.fields.feedUrl));
    const idRaw = c.fields.collectionId ? readPath(it, c.fields.collectionId) : undefined;
    const collectionId =
      typeof idRaw === "number" ? idRaw :
      idRaw != null ? customFeedId(safeString(idRaw)) :
      customFeedId(feedUrl);
    return {
      collectionId,
      collectionName: safeString(readPath(it, c.fields.collectionName)),
      artistName: c.fields.artistName ? safeString(readPath(it, c.fields.artistName)) : "",
      artworkUrl600: c.fields.artworkUrl ? safeString(readPath(it, c.fields.artworkUrl)) : "",
      artworkUrl100: c.fields.artworkUrl ? safeString(readPath(it, c.fields.artworkUrl)) : "",
      feedUrl,
      primaryGenreName: c.fields.genre ? safeString(readPath(it, c.fields.genre)) : "",
      trackCount: 0,
    };
  });
}

// ---------- Public dispatcher ----------

export async function searchPodcasts(
  query: string,
  cfg: ProviderConfig,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const q = (query || "").trim();
  if (!q) return [];
  switch (cfg.source) {
    case "podcastindex": return searchPodcastIndex(q, cfg, signal);
    case "fyyd":         return searchFyyd(q, signal);
    case "custom":       return searchCustom(q, cfg, signal);
    case "itunes":
    default:             return searchItunes(q, signal);
  }
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  itunes: "Apple",
  podcastindex: "Index",
  fyyd: "Fyyd",
  custom: "Custom",
};
