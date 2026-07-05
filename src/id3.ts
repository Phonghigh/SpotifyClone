import { File } from 'expo-file-system';

export type Id3Tags = {
  title?: string;
  artist?: string;
  genre?: string;
};

/** Cap how much of a tag we're willing to read (embedded art can be huge). */
const MAX_TAG_BYTES = 2_000_000;
/** Cap a single wanted frame's payload (title/artist/genre are always tiny). */
const MAX_FRAME_BYTES = 4096;

const WANTED_FRAMES: Record<string, 'title' | 'artist' | 'genre'> = {
  // ID3v2.2 (3-char ids)
  TT2: 'title',
  TP1: 'artist',
  TCO: 'genre',
  // ID3v2.3 / ID3v2.4 (4-char ids)
  TIT2: 'title',
  TPE1: 'artist',
  TCON: 'genre',
};

function syncsafe(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function decodeLatin1(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  let out = '';
  for (let i = 0; i < end; i++) out += String.fromCharCode(bytes[i]);
  return out.trim();
}

function decodeUtf8(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  let out = '';
  let i = 0;
  while (i < end) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if ((b0 & 0xe0) === 0xc0 && i + 1 < end) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((b0 & 0xf0) === 0xe0 && i + 2 < end) {
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else if ((b0 & 0xf8) === 0xf0 && i + 3 < end) {
      const cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    } else {
      i += 1;
    }
  }
  return out.trim();
}

function decodeUtf16(bytes: Uint8Array, hasBom: boolean): string {
  let start = 0;
  let littleEndian = false;
  if (hasBom && bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      littleEndian = true;
      start = 2;
    } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      littleEndian = false;
      start = 2;
    }
  }
  let end = bytes.length;
  while (end - start >= 2 && bytes[end - 1] === 0 && bytes[end - 2] === 0) end -= 2;
  let out = '';
  for (let i = start; i + 1 < end; i += 2) {
    const code = littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1];
    if (code === 0) continue;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const encoding = bytes[0];
  const body = bytes.subarray(1);
  switch (encoding) {
    case 1:
      return decodeUtf16(body, true);
    case 2:
      return decodeUtf16(body, false);
    case 3:
      return decodeUtf8(body);
    default:
      return decodeLatin1(body);
  }
}

/** Standard ID3v1 genre table (indices double as legacy TCON numeric refs). */
const ID3V1_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock',
  'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
  'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop',
  'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic',
  'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40',
  'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave',
  'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk',
  'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock', 'Folk',
  'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion', 'Bebop', 'Latin', 'Revival',
  'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock',
  'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus',
  'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera', 'Chamber Music',
  'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam',
  'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul',
  'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'A Cappella', 'Euro-House',
  'Dance Hall',
];

function resolveGenre(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const parenMatch = trimmed.match(/^\((\d+)\)(.*)$/);
  if (parenMatch) {
    const rest = parenMatch[2].trim();
    if (rest) return rest;
    return ID3V1_GENRES[parseInt(parenMatch[1], 10)] ?? undefined;
  }

  if (/^\d+$/.test(trimmed)) {
    return ID3V1_GENRES[parseInt(trimmed, 10)] ?? trimmed;
  }

  return trimmed;
}

/**
 * Best-effort ID3v2 tag reader. Reads only frame headers plus the small text
 * frames we care about — never loads embedded artwork into memory. Never
 * throws; returns null when the file has no readable ID3v2 tag.
 */
export function readId3Tags(uri: string): Id3Tags | null {
  let handle: ReturnType<File['open']> | undefined;
  try {
    const file = new File(uri);
    if (!file.exists) return null;

    handle = file.open();
    handle.offset = 0;
    const header = handle.readBytes(10);
    if (
      header.length < 10 ||
      header[0] !== 0x49 || // 'I'
      header[1] !== 0x44 || // 'D'
      header[2] !== 0x33 // '3'
    ) {
      return null;
    }

    const majorVersion = header[3];
    const tagSize = syncsafe(header[6], header[7], header[8], header[9]);
    const tagEnd = Math.min(10 + tagSize, 10 + MAX_TAG_BYTES);
    const frameHeaderSize = majorVersion === 2 ? 6 : 10;

    const result: Id3Tags = {};
    let pos = 10;

    while (pos + frameHeaderSize <= tagEnd) {
      handle.offset = pos;
      const fh = handle.readBytes(frameHeaderSize);
      if (fh.length < frameHeaderSize) break;

      let id: string;
      let size: number;
      if (majorVersion === 2) {
        id = String.fromCharCode(fh[0], fh[1], fh[2]);
        size = (fh[3] << 16) + (fh[4] << 8) + fh[5];
      } else {
        id = String.fromCharCode(fh[0], fh[1], fh[2], fh[3]);
        size =
          majorVersion >= 4
            ? syncsafe(fh[4], fh[5], fh[6], fh[7])
            : fh[4] * 0x1000000 + (fh[5] << 16) + (fh[6] << 8) + fh[7];
      }

      // Hit padding (zeroed id) or a corrupt/oversized frame — stop scanning.
      if (!id.trim() || size <= 0 || pos + frameHeaderSize + size > tagEnd) break;

      const wanted = WANTED_FRAMES[id];
      if (wanted && !result[wanted]) {
        handle.offset = pos + frameHeaderSize;
        const content = handle.readBytes(Math.min(size, MAX_FRAME_BYTES));
        const text = wanted === 'genre' ? resolveGenre(decodeText(content)) : decodeText(content);
        if (text) result[wanted] = text;
      }

      pos += frameHeaderSize + size;
    }

    return result.title || result.artist || result.genre ? result : null;
  } catch {
    return null;
  } finally {
    try {
      handle?.close();
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Embedded cover art (APIC / PIC frames)
// ---------------------------------------------------------------------------

/** Largest embedded picture we're willing to pull into memory (~4MB). */
const MAX_ART_BYTES = 4_000_000;

export type Id3Art = {
  bytes: Uint8Array;
  /** File extension for the decoded image, derived from its magic bytes. */
  ext: 'jpg' | 'png';
};

/** Sniff the image type from its leading bytes; null for anything unsupported. */
function imageExt(bytes: Uint8Array): 'jpg' | 'png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  return null;
}

/** Parse the payload of an APIC (v2.3/2.4) or PIC (v2.2) frame into raw image bytes. */
function parsePictureFrame(
  frame: Uint8Array,
  majorVersion: number,
): { type: number; art: Id3Art } | null {
  if (frame.length < 2) return null;
  const encoding = frame[0];
  let p = 1;
  let pictureType: number;

  if (majorVersion === 2) {
    // PIC: encoding, 3-char image format, picture type, description…
    if (frame.length < 5) return null;
    pictureType = frame[4];
    p = 5;
  } else {
    // APIC: encoding, MIME (latin1, null-terminated), picture type, description…
    while (p < frame.length && frame[p] !== 0) p += 1;
    p += 1; // skip the MIME terminator
    if (p >= frame.length) return null;
    pictureType = frame[p];
    p += 1;
  }

  // Skip the (unused) description string up to its terminator.
  if (encoding === 1 || encoding === 2) {
    // UTF-16: terminated by a 0x00 0x00 pair on an even boundary.
    while (p + 1 < frame.length && !(frame[p] === 0 && frame[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    while (p < frame.length && frame[p] !== 0) p += 1;
    p += 1;
  }
  if (p >= frame.length) return null;

  // Copy out of the (larger) frame buffer so it can be GC'd.
  const bytes = frame.slice(p);
  const ext = imageExt(bytes);
  if (!ext) return null;
  return { type: pictureType, art: { bytes, ext } };
}

/**
 * Read the embedded cover image from an audio file's ID3v2 tag. Prefers the
 * "front cover" picture (type 3) but falls back to the first usable image.
 * Never throws; returns null when there is no readable embedded artwork.
 */
export function readId3Art(uri: string): Id3Art | null {
  let handle: ReturnType<File['open']> | undefined;
  try {
    const file = new File(uri);
    if (!file.exists) return null;

    handle = file.open();
    handle.offset = 0;
    const header = handle.readBytes(10);
    if (header.length < 10 || header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) {
      return null;
    }

    const majorVersion = header[3];
    const tagSize = syncsafe(header[6], header[7], header[8], header[9]);
    const tagEnd = 10 + tagSize;
    const frameHeaderSize = majorVersion === 2 ? 6 : 10;
    const pictureId = majorVersion === 2 ? 'PIC' : 'APIC';

    let fallback: Id3Art | null = null;
    let pos = 10;

    while (pos + frameHeaderSize <= tagEnd) {
      handle.offset = pos;
      const fh = handle.readBytes(frameHeaderSize);
      if (fh.length < frameHeaderSize) break;

      let id: string;
      let size: number;
      if (majorVersion === 2) {
        id = String.fromCharCode(fh[0], fh[1], fh[2]);
        size = (fh[3] << 16) + (fh[4] << 8) + fh[5];
      } else {
        id = String.fromCharCode(fh[0], fh[1], fh[2], fh[3]);
        size =
          majorVersion >= 4
            ? syncsafe(fh[4], fh[5], fh[6], fh[7])
            : fh[4] * 0x1000000 + (fh[5] << 16) + (fh[6] << 8) + fh[7];
      }

      if (!id.trim() || size <= 0 || pos + frameHeaderSize + size > tagEnd) break;

      if (id === pictureId && size <= MAX_ART_BYTES) {
        handle.offset = pos + frameHeaderSize;
        const frame = handle.readBytes(size);
        const parsed = parsePictureFrame(frame, majorVersion);
        if (parsed) {
          if (parsed.type === 3) return parsed.art; // front cover — best match
          if (!fallback) fallback = parsed.art;
        }
      }

      pos += frameHeaderSize + size;
    }

    return fallback;
  } catch {
    return null;
  } finally {
    try {
      handle?.close();
    } catch {
      // ignore
    }
  }
}
