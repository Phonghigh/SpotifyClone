import { File, Paths } from 'expo-file-system';

import { deleteCover } from './covers';
import type { DownloadFormat } from './settings';

/**
 * Bump when the scan gains new outputs (e.g. cover extraction) so previously
 * scanned files are re-processed once on the next launch.
 */
const SCAN_VERSION = 2;

type TrackMetadataEntry = {
  genre?: string;
  genreSource: 'id3' | 'manual';
  /** Cached cover image file name (in the covers dir); absent if none found. */
  art?: string;
  /** File size when last scanned — lets us skip re-parsing unchanged files. */
  size: number;
  /** Scan pipeline version this entry was produced by. */
  scanVersion?: number;
  scannedAt: number;
  /** Original remote link this file was downloaded from, if any. */
  sourceUrl?: string;
  /** Format the file was downloaded in, if known. */
  format?: DownloadFormat;
};

type TrackMetadataMap = Record<string, TrackMetadataEntry>;

const METADATA_FILE = 'track-metadata.json';

function metadataFile(): File {
  return new File(Paths.document, METADATA_FILE);
}

let cache: TrackMetadataMap | null = null;

function load(): TrackMetadataMap {
  if (cache) return cache;
  try {
    const f = metadataFile();
    if (!f.exists) {
      cache = {};
      return cache;
    }
    const raw = JSON.parse(f.textSync());
    cache = raw && typeof raw === 'object' ? raw : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(map: TrackMetadataMap): void {
  try {
    metadataFile().write(JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save track metadata', err);
  }
}

/** The cached genre for a track file, if any. */
export function getGenre(fileName: string): string | undefined {
  return load()[fileName]?.genre;
}

/** The cached cover image file name for a track file, if any. */
export function getArt(fileName: string): string | undefined {
  return load()[fileName]?.art;
}

/** The original remote link this file was downloaded from, if any. */
export function getSourceUrl(fileName: string): string | undefined {
  return load()[fileName]?.sourceUrl;
}

/** The format this file was downloaded in, if known. */
export function getFormat(fileName: string): DownloadFormat | undefined {
  return load()[fileName]?.format;
}

/**
 * True when this file (by name + size) has already been scanned by the current
 * scan pipeline. A size change or a scan-version bump forces a re-scan.
 */
export function isScanned(fileName: string, size: number): boolean {
  const entry = load()[fileName];
  return entry != null && entry.size === size && entry.scanVersion === SCAN_VERSION;
}

/**
 * Cache the result of an ID3 scan. Both genre and art may be undefined
 * ("scanned, none found"). A user-supplied ("manual") genre is preserved so a
 * re-scan never clobbers it.
 */
export function recordScan(
  fileName: string,
  size: number,
  genre: string | undefined,
  art: string | undefined,
): void {
  const map = load();
  const prev = map[fileName];
  const keepManual = prev?.genreSource === 'manual';
  const next: TrackMetadataMap = {
    ...map,
    [fileName]: {
      genre: keepManual ? prev!.genre : genre,
      genreSource: keepManual ? 'manual' : 'id3',
      art,
      size,
      scanVersion: SCAN_VERSION,
      scannedAt: Date.now(),
      sourceUrl: prev?.sourceUrl,
      format: prev?.format,
    },
  };
  cache = next;
  persist(next);
}

/**
 * Record the original download link + format for a file, preserving any
 * genre/art already scanned for it. Called right after a remote download
 * completes, so a later "change format" re-download knows where to fetch
 * from.
 */
export function recordSource(
  fileName: string,
  size: number,
  sourceUrl: string,
  format: DownloadFormat,
): void {
  const map = load();
  const prev = map[fileName];
  const next: TrackMetadataMap = {
    ...map,
    [fileName]: {
      genre: prev?.genre,
      genreSource: prev?.genreSource ?? 'id3',
      art: prev?.art,
      size,
      scanVersion: prev?.scanVersion,
      scannedAt: prev?.scannedAt ?? Date.now(),
      sourceUrl,
      format,
    },
  };
  cache = next;
  persist(next);
}

/** User-supplied genre override, entered via track actions. */
export function setManualGenre(fileName: string, uri: string, genre: string): void {
  const trimmed = genre.trim();
  const size = new File(uri).size;
  const map = load();
  const prev = map[fileName];
  const next: TrackMetadataMap = {
    ...map,
    [fileName]: {
      genre: trimmed || undefined,
      genreSource: 'manual',
      art: prev?.art,
      size,
      scanVersion: SCAN_VERSION,
      scannedAt: Date.now(),
      sourceUrl: prev?.sourceUrl,
      format: prev?.format,
    },
  };
  cache = next;
  persist(next);
}

/** Drop a track's cached metadata + cover (call when a track file is deleted). */
export function forgetTrack(fileName: string): void {
  const map = load();
  if (!(fileName in map)) return;
  deleteCover(map[fileName].art);
  const next = { ...map };
  delete next[fileName];
  cache = next;
  persist(next);
}
