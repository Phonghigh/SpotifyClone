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

export type ServerJob = {
  id: string;
  url: string;
  source: 'youtube' | 'spotify' | 'other';
  status: ServerJobStatus;
  progress: number;
  title: string | null;
  artist: string | null;
  ext: string | null;
  error: string | null;
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

export class ServerUnreachableError extends Error {
  constructor(base: string) {
    super(
      `Can't reach the server at ${base}. Make sure it's running ("npm start" in the server folder) and on the same Wi-Fi.`,
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
    res = await fetchWithTimeout(`${base}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ url, format }),
    });
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
