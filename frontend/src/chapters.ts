// Lightweight Podcasting 2.0 chapter fetcher + helper hook.
// Spec: https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/chapters/jsonChapters.md
import { useEffect, useState } from "react";

export type Chapter = {
  startTime: number; // seconds
  endTime?: number;
  title: string;
  img?: string;
  url?: string;
};

const cache = new Map<string, Chapter[]>();

export async function fetchChapters(url: string): Promise<Chapter[]> {
  if (!url) return [];
  if (cache.has(url)) return cache.get(url)!;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const arr: any[] = Array.isArray(data?.chapters) ? data.chapters : [];
    const cleaned: Chapter[] = arr
      .map((c: any) => ({
        startTime: Number(c?.startTime) || 0,
        endTime: typeof c?.endTime === "number" ? c.endTime : undefined,
        title: typeof c?.title === "string" ? c.title : "",
        img: typeof c?.img === "string" ? c.img : undefined,
        url: typeof c?.url === "string" ? c.url : undefined,
      }))
      .filter((c) => c.title)
      .sort((a, b) => a.startTime - b.startTime);
    cache.set(url, cleaned);
    return cleaned;
  } catch {
    return [];
  }
}

export function useChapters(url?: string): { chapters: Chapter[]; loading: boolean } {
  const [chapters, setChapters] = useState<Chapter[]>(url && cache.has(url) ? cache.get(url)! : []);
  const [loading, setLoading] = useState(!!url && !cache.has(url));

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setChapters([]);
      setLoading(false);
      return;
    }
    if (cache.has(url)) {
      setChapters(cache.get(url)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchChapters(url).then((c) => {
      if (cancelled) return;
      setChapters(c);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [url]);

  return { chapters, loading };
}

export function activeChapterIndex(chapters: Chapter[], position: number): number {
  if (!chapters || chapters.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startTime <= position) idx = i;
    else break;
  }
  return idx;
}
