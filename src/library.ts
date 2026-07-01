import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

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
      tracks.push(trackFromFile(entry.name, entry.uri));
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
      added.push(trackFromFile(dest.name, dest.uri));
    } catch (err) {
      console.warn('Failed to import', sourceName, err);
      skipped += 1;
    }
  }

  added.sort((a, b) => a.title.localeCompare(b.title));
  return { added, skipped };
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
}): Promise<Track> {
  const dir = ensureMusicDir();
  const artist = params.artist?.trim();
  const ext = (params.ext || 'mp3').replace(/[^a-z0-9]/gi, '') || 'mp3';
  const base = artist ? `${artist} - ${params.title}` : params.title;
  const dest = uniqueDestination(dir, `${base}.${ext}`);
  await File.downloadFileAsync(params.fileUrl, dest);
  return trackFromFile(dest.name, dest.uri);
}

/** Permanently delete an imported song from the device. */
export function deleteTrack(track: Track): void {
  try {
    const file = new File(track.uri);
    if (file.exists) file.delete();
  } catch (err) {
    console.warn('Failed to delete', track.fileName, err);
  }
}
