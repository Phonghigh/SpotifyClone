/**
 * Persistent cache of album-cover images extracted from tracks' embedded ID3
 * artwork. Each cover is stored as a standalone image file whose name is derived
 * from the (unique) audio file name, so a track always maps to the same cover.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { readId3Art } from './id3';

const COVERS_DIR_NAME = 'covers';

function coversDir(): Directory {
  return new Directory(Paths.document, COVERS_DIR_NAME);
}

function ensureCoversDir(): Directory {
  const dir = coversDir();
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** A playable file:// uri for a stored cover, or undefined if it's missing. */
export function coverUri(coverName: string | undefined): string | undefined {
  if (!coverName) return undefined;
  try {
    const f = new File(coversDir(), coverName);
    return f.exists ? f.uri : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pull the embedded cover out of an audio file and cache it as an image.
 * Returns the stored cover file name, or undefined when the track carries no
 * usable embedded artwork.
 */
export function extractCover(audioFileName: string, audioUri: string): string | undefined {
  const art = readId3Art(audioUri);
  if (!art) return undefined;

  const coverName = `${audioFileName}.${art.ext}`;
  try {
    const dir = ensureCoversDir();
    const dest = new File(dir, coverName);
    if (dest.exists) dest.delete();
    dest.create();
    dest.write(art.bytes);
    return coverName;
  } catch (err) {
    console.warn('Failed to cache cover for', audioFileName, err);
    return undefined;
  }
}

/** Remove a cached cover (call when its track is deleted). */
export function deleteCover(coverName: string | undefined): void {
  if (!coverName) return;
  try {
    const f = new File(coversDir(), coverName);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}
