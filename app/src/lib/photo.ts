import { useEffect, useState } from "react";

/**
 * Player photo. The URL is pre-resolved server-side in the data set (players.json)
 * (ESPN headshot -> Wikidata P18). Here we only test whether it can actually load;
 * if it cannot load, it returns null and the card falls back to the jersey image.
 */
const memCache = new Map<string, string | null>();

export function usePlayerImage(_name: string, photo?: string): string | null {
  const [url, setUrl] = useState<string | null>(() => (photo && memCache.get(photo)) ?? null);
  useEffect(() => {
    let alive = true;
    if (!photo) {
      setUrl(null);
      return;
    }
    if (memCache.has(photo)) {
      setUrl(memCache.get(photo) ?? null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      memCache.set(photo, photo);
      if (alive) setUrl(photo);
    };
    img.onerror = () => {
      memCache.set(photo, null);
      if (alive) setUrl(null);
    };
    img.src = photo;
    return () => { alive = false; };
  }, [photo]);
  return url;
}
