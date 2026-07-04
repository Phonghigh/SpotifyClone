/**
 * Thin HTTP client for the companion downloader server (server/).
 * Shared by the download queue processor and the Add-from-link sheet.
 */
import { API_KEY } from './config';
import type { DownloadFormat } from './settings';

/** Header sent on every request so the server can reject unauthorized callers. */
export function authHeaders(): Record<string, string> {
  return { 'x-api-key': API_KEY };
}

export type ServerJobStatus = 'pending' | 'resolving' | 'downloading' | 'done' | 'error';

export type LinkKind = 'track' | 'playlist' | 'album' | 'unknown';

export type ServerJobChild = {
  index: number;
  title: string;
  artist: string;
  status: ServerJobStatus;
  progress: number;
  error: string | null;
  fileJobId: string | null;
  ext: string | null;
};

export type ServerJob = {
  id: string;
  url: string;
  source: 'youtube' | 'spotify' | 'other';
  kind?: LinkKind;
  batch?: boolean;
  status: ServerJobStatus;
  progress: number;
  title: string | null;
  artist: string | null;
  ext: string | null;
  error: string | null;
  trackCount?: number | null;
  truncated?: boolean | null;
  children?: ServerJobChild[] | null;
  quality: {
    outputFormat?: string;
    outputBitrateKbps?: number | null;
    sampleRateHz?: number | null;
    fileSizeBytes?: number;
    sourceCodec?: string | null;
    sourceAbrKbps?: number | null;
  } | null;
  analysis?: {
    peaks?: number[];
    pitch?: { t: number; midi: number | null }[];
    durationSec?: number | null;
  } | null;
};

const SPOTIFY_RE = /spotify\.com\/(?:intl-[\w-]+\/)?(track|episode|playlist|album)\/[A-Za-z0-9]+/i;
const YT_LIST_RE = /[?&]list=[A-Za-z0-9_-]+/i;

/** Classify a link as a single track vs. a whole playlist/album, mirroring server/src/downloader.js's classifyLink. */
export function classifyLink(url: string): { source: 'spotify' | 'youtube' | 'other'; kind: LinkKind } {
  const sm = url.match(SPOTIFY_RE);
  if (sm) {
    const type = sm[1];
    const kind: LinkKind = type === 'playlist' ? 'playlist' : type === 'album' ? 'album' : 'track';
    return { source: 'spotify', kind };
  }
  if (/(youtube\.com|youtu\.be)/i.test(url)) {
    return { source: 'youtube', kind: YT_LIST_RE.test(url) ? 'playlist' : 'track' };
  }
  return { source: 'other', kind: 'unknown' };
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** True when the text contains a link the downloader server can handle. */
export function extractSupportedLink(text: string): string | null {
  const match = text.match(
    /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|open\.spotify\.com)\/\S+/i,
  );
  return match ? match[0].replace(/[)\]}>,.]+$/, '') : null;
}

/**
 * Canonicalize a link so the same track shared/pasted twice compares equal
 * even though each share carries its own tracking query params (Spotify's
 * `si`, YouTube's `si`/`feature`/etc.) — used to dedupe the download queue.
 */
export function normalizeLink(url: string): string {
  const sm = url.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|episode|playlist|album)\/([A-Za-z0-9]+)/i);
  if (sm) return `spotify:${sm[1]}:${sm[2]}`;

  const ytList = url.match(/[?&]list=([A-Za-z0-9_-]+)/i);
  if (ytList) return `youtube:playlist:${ytList[1]}`;

  const ytId =
    url.match(/(?:youtube\.com\/watch\?[^#]*\bv=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (ytId) return `youtube:track:${ytId[1]}`;

  return url;
}

export class ServerUnreachableError extends Error {
  constructor(base: string) {
    const isLocal = /^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i.test(base);
    super(
      isLocal
        ? `Can't reach the server at ${base}. Make sure it's running ("npm start" in the server folder) and your phone is on the same Wi-Fi.`
        : `Can't reach ${base}. Check your phone's internet connection, or the server may be slow to wake up — try again in a moment.`,
    );
    this.name = 'ServerUnreachableError';
  }
}

/** Submit a download job. Resolves with the server job id. */
export async function submitDownload(
  base: string,
  url: string,
  format: DownloadFormat,
): Promise<string> {
  let res: Response;
  try {
    // Render's free tier can take 30-60s to wake from an idle spin-down —
    // give this one-shot call enough headroom, since (unlike job polling)
    // there's no retry loop around it.
    res = await fetchWithTimeout(
      `${base}/api/download`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url, format }),
      },
      60000,
    );
  } catch (err: any) {
    if (err?.name === 'AbortError' || /network/i.test(String(err?.message))) {
      throw new ServerUnreachableError(base);
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
  if (!data.id) throw new Error('Server did not return a job id.');
  return data.id;
}

/** Fetch current job state. Throws on HTTP errors; caller decides retry. */
export async function getJob(base: string, id: string): Promise<ServerJob> {
  const res = await fetchWithTimeout(`${base}/api/jobs/${id}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
  return data as ServerJob;
}

export function jobFileUrl(base: string, id: string): string {
  return `${base}/api/file/${id}`;
}
