import type { Track } from './types';

/** Format a duration in seconds as m:ss (or h:mm:ss for long tracks). */
export function formatTime(seconds: number | undefined | null): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'oga', 'wma', 'aiff', 'caf'];

export function isAudioFileName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.includes(ext);
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Parse a file name into { title, artist }. Recognises the common
 * "Artist - Title" convention; otherwise falls back to the whole name.
 */
export function parseTrackName(fileName: string): { title: string; artist: string } {
  const base = stripExtension(fileName)
    .replace(/_/g, ' ')
    .trim();

  // Match "Artist - Title" (hyphen, en dash or em dash with surrounding spaces).
  const match = base.match(/^(.*\S)\s+[-–—]\s+(\S.*)$/);
  if (match) {
    const artist = match[1].trim();
    const title = match[2].trim();
    if (artist && title) return { title, artist };
  }
  return { title: base || fileName, artist: 'Unknown artist' };
}

/** Build a Track from a persisted file name + playable uri. */
export function trackFromFile(fileName: string, uri: string): Track {
  const { title, artist } = parseTrackName(fileName);
  return { id: fileName, uri, title, artist, fileName };
}

/** Human-readable file size, e.g. "7.8 MB". */
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffled<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
