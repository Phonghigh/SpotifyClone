import { Directory, File, Paths } from 'expo-file-system';

import type { Track } from './types';
import { cleanTitleForSearch } from './utils';

export type LyricLine = { t: number; line: string };

export type TrackLyrics = {
  /** Time-synced lines, sorted by t. Null when only plain text exists. */
  synced: LyricLine[] | null;
  /** Plain lyrics text. Null when nothing was found. */
  plain: string | null;
  fetchedAt: number;
};

const LYRICS_DIR = 'lyrics';
const LRCLIB_BASE = 'https://lrclib.net/api';
const USER_AGENT = 'Spotaclone/1.0 (https://github.com/local)';

function lyricsDir(): Directory {
  return new Directory(Paths.document, LYRICS_DIR);
}

function sidecarFile(trackFileName: string): File {
  return new File(lyricsDir(), `${trackFileName}.json`);
}

export function loadCachedLyrics(trackFileName: string): TrackLyrics | null {
  try {
    const f = sidecarFile(trackFileName);
    if (!f.exists) return null;
    return JSON.parse(f.textSync()) as TrackLyrics;
  } catch {
    return null;
  }
}

function saveLyrics(trackFileName: string, lyrics: TrackLyrics): void {
  try {
    const dir = lyricsDir();
    if (!dir.exists) dir.create({ intermediates: true });
    sidecarFile(trackFileName).write(JSON.stringify(lyrics));
  } catch (err) {
    console.warn('Failed to cache lyrics', err);
  }
}

export function deleteCachedLyrics(trackFileName: string): void {
  try {
    const f = sidecarFile(trackFileName);
    if (f.exists) f.delete();
  } catch {
    /* ignore */
  }
}

/**
 * Parse LRC text into sorted synced lines. Handles multiple timestamps per
 * line ("[00:12.00][00:44.10] chorus") and ignores metadata tags.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    for (const m of stamps) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const fracRaw = m[3] ?? '0';
      const frac = parseInt(fracRaw, 10) / 10 ** fracRaw.length;
      out.push({ t: min * 60 + sec + frac, line: text });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

type LrclibRecord = {
  trackName?: string;
  artistName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
};

function toTrackLyrics(rec: LrclibRecord): TrackLyrics {
  const synced = rec.syncedLyrics ? parseLrc(rec.syncedLyrics) : null;
  return {
    synced: synced && synced.length > 0 ? synced : null,
    plain: rec.plainLyrics || null,
    fetchedAt: Date.now(),
  };
}

async function lrclibFetch(path: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${LRCLIB_BASE}${path}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch lyrics from LRCLIB (free, no key): exact get by artist+title+duration
 * first, then a search fallback. Caches the result (including misses) to a
 * sidecar so each track hits the network once.
 */
export async function fetchLyrics(
  track: Track,
  durationSec: number | null,
  options?: { force?: boolean },
): Promise<TrackLyrics> {
  if (!options?.force) {
    const cached = loadCachedLyrics(track.fileName);
    if (cached) return cached;
  }

  const title = cleanTitleForSearch(track.title) || track.title;
  const artist = track.artist === 'Unknown artist' ? '' : track.artist;

  // 1) Exact lookup (duration-matched ±2s server-side).
  if (artist && durationSec && durationSec > 0) {
    try {
      const params = new URLSearchParams({
        artist_name: artist,
        track_name: title,
        duration: String(Math.round(durationSec)),
      });
      const res = await lrclibFetch(`/get?${params}`);
      if (res.ok) {
        const lyrics = toTrackLyrics((await res.json()) as LrclibRecord);
        if (lyrics.synced || lyrics.plain) {
          saveLyrics(track.fileName, lyrics);
          return lyrics;
        }
      }
    } catch {
      /* fall through to search */
    }
  }

  // 2) Search fallback — pick the best hit (prefer synced lyrics).
  try {
    const q = [artist, title].filter(Boolean).join(' ');
    const res = await lrclibFetch(`/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const hits = (await res.json()) as LrclibRecord[];
      if (Array.isArray(hits) && hits.length > 0) {
        const best = hits.find((h) => h.syncedLyrics) ?? hits[0];
        const lyrics = toTrackLyrics(best);
        if (lyrics.synced || lyrics.plain) {
          saveLyrics(track.fileName, lyrics);
          return lyrics;
        }
      }
    }
  } catch {
    /* no network — return miss without caching */
    return { synced: null, plain: null, fetchedAt: 0 };
  }

  // Cache the miss (fetchedAt set) so we don't re-query every open.
  const miss: TrackLyrics = { synced: null, plain: null, fetchedAt: Date.now() };
  saveLyrics(track.fileName, miss);
  return miss;
}
