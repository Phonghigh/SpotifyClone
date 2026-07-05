import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

import { coverUri, extractCover } from './covers';
import { authHeaders } from './downloaderClient';
import { readId3Tags } from './id3';
import {
  forgetTrack,
  getArt,
  getGenre,
  getSourceUrl,
  isScanned,
  recordScan,
  recordSource,
} from './trackMetadata';
import type { DownloadFormat } from './settings';
import type { Track } from './types';
import { isAudioFileName, trackFromFile } from './utils';

const MUSIC_DIR_NAME = 'music';

/** The persistent folder that holds imported songs. */
function musicDir(): Directory {
  return new Directory(Paths.document, MUSIC_DIR_NAME);
}

function ensureMusicDir(): Directory {
  const dir = musicDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/** Remove characters that are unsafe in file names, keeping spaces/hyphens. */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : `track-${Date.now()}`;
}

/** Pick a destination File inside the music dir, avoiding name collisions. */
function uniqueDestination(dir: Directory, fileName: string): File {
  const safe = sanitizeFileName(fileName);
  let candidate = new File(dir, safe);
  if (!candidate.exists) return candidate;

  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let n = 2;
  do {
    candidate = new File(dir, `${stem} (${n})${ext}`);
    n += 1;
  } while (candidate.exists);
  return candidate;
}

/** Build a Track with its genre + cover art filled in, scanning at most once per file. */
function trackWithGenre(file: File): Track {
  const track = trackFromFile(file.name, file.uri);
  const size = file.size;
  if (!isScanned(file.name, size)) {
    const tags = readId3Tags(file.uri);
    const art = extractCover(file.name, file.uri);
    recordScan(file.name, size, tags?.genre, art);
  }
  const genre = getGenre(file.name);
  const artworkUri = coverUri(getArt(file.name));
  const sourceUrl = getSourceUrl(file.name);
  return { ...track, genre, artworkUri, sourceUrl };
}

/**
 * Read every song already imported into the app's music folder.
 * Called on launch so the library persists between sessions.
 */
export function loadLibrary(): Track[] {
  const dir = musicDir();
  if (!dir.exists) return [];

  const tracks: Track[] = [];
  for (const entry of dir.list()) {
    if (entry instanceof File && isAudioFileName(entry.name)) {
      tracks.push(trackWithGenre(entry));
    }
  }
  tracks.sort((a, b) => a.title.localeCompare(b.title));
  return tracks;
}

export type ImportResult = {
  /** Tracks that were newly added (excludes ones already present). */
  added: Track[];
  /** Number of selected files skipped because they already existed. */
  skipped: number;
};

/**
 * Open the system file picker (audio only, multi-select) and copy the chosen
 * files into the persistent music folder. Returns the imported tracks.
 */
export async function importSongs(): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets) {
    return { added: [], skipped: 0 };
  }

  const dir = ensureMusicDir();
  const added: Track[] = [];
  let skipped = 0;

  for (const asset of result.assets) {
    const sourceName = asset.name || asset.uri.split('/').pop() || 'track';
    const dest = uniqueDestination(dir, sourceName);
    try {
      const source = new File(asset.uri);
      await source.copy(dest);
      added.push(trackWithGenre(dest));
    } catch (err) {
      console.warn('Failed to import', sourceName, err);
      skipped += 1;
    }
  }

  added.sort((a, b) => a.title.localeCompare(b.title));
  return { added, skipped };
}

/** Stem (name without extension), lowercased, for duplicate comparisons. */
function normalizedStem(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  return stem.trim().toLowerCase();
}

/** True when a previously downloaded file (by exact file name) still exists. */
export function trackFileExists(fileName: string): boolean {
  const dir = musicDir();
  if (!dir.exists) return false;
  return new File(dir, fileName).exists;
}

/**
 * Look up a track already saved in the music folder that matches the given
 * title/artist (the same "Artist - Title" naming importRemoteTrack uses).
 * Used to skip re-downloading songs that are already in the library.
 */
export function findExistingTrack(title: string, artist?: string): Track | null {
  const dir = musicDir();
  if (!dir.exists) return null;

  const cleanArtist = artist?.trim();
  const base = cleanArtist ? `${cleanArtist} - ${title}` : title;
  const wanted = normalizedStem(sanitizeFileName(base));
  if (!wanted) return null;

  for (const entry of dir.list()) {
    if (entry instanceof File && isAudioFileName(entry.name)) {
      if (normalizedStem(entry.name) === wanted) {
        return trackFromFile(entry.name, entry.uri);
      }
    }
  }
  return null;
}

/**
 * Download an already-prepared audio file (e.g. produced by the companion
 * downloader server) straight into the persistent music folder.
 */
export async function importRemoteTrack(params: {
  fileUrl: string;
  title: string;
  artist?: string;
  ext?: string;
  /** Original remote link (e.g. the pasted YouTube/Spotify URL), if known —
   * persisted so a later "change format" re-download knows where to fetch from. */
  sourceUrl?: string;
  format?: DownloadFormat;
}): Promise<Track> {
  const dir = ensureMusicDir();
  const artist = params.artist?.trim();
  const ext = (params.ext || 'mp3').replace(/[^a-z0-9]/gi, '') || 'mp3';
  const base = artist ? `${artist} - ${params.title}` : params.title;
  const dest = uniqueDestination(dir, `${base}.${ext}`);
  await File.downloadFileAsync(params.fileUrl, dest, { headers: authHeaders() });
  if (params.sourceUrl && params.format) {
    recordSource(dest.name, dest.size, params.sourceUrl, params.format);
  }
  return trackWithGenre(dest);
}

/** Permanently delete an imported song from the device. */
export function deleteTrack(track: Track): void {
  try {
    const file = new File(track.uri);
    if (file.exists) file.delete();
  } catch (err) {
    console.warn('Failed to delete', track.fileName, err);
  }
  forgetTrack(track.fileName);
}
