const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

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

export async function searchPodcasts(term: string, limit = 25): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/api/search?term=${encodeURIComponent(term)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

export async function topPodcasts(genre?: string, limit = 20): Promise<SearchResult[]> {
  const q = genre ? `?genre=${encodeURIComponent(genre)}&limit=${limit}` : `?limit=${limit}`;
  const res = await fetch(`${BASE}/api/top${q}`);
  if (!res.ok) throw new Error(`Top failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

export async function fetchFeed(feedUrl: string, limit = 100): Promise<Feed> {
  const res = await fetch(`${BASE}/api/feed?url=${encodeURIComponent(feedUrl)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Feed failed: ${res.status}`);
  return res.json();
}
