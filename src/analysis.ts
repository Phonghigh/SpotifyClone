import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { authHeaders } from './downloaderClient';
import type { Track } from './types';
import { getServerUrl } from './settings';

/** Audio analysis produced by the companion server (waveform + pitch). */
export type TrackAnalysis = {
  /** ~240 normalized loudness values (0..1) across the track. */
  peaks: number[];
  /** Experimental melodic pitch track: time (s) → MIDI note (null = unvoiced). */
  pitch?: { t: number; midi: number | null }[];
  durationSec?: number | null;
};

const ANALYSIS_DIR = 'analysis';

function analysisDir(): Directory {
  return new Directory(Paths.document, ANALYSIS_DIR);
}

function sidecarFile(trackFileName: string): File {
  return new File(analysisDir(), `${trackFileName}.json`);
}

export function saveAnalysis(trackFileName: string, data: TrackAnalysis): void {
  try {
    const dir = analysisDir();
    if (!dir.exists) dir.create({ intermediates: true });
    sidecarFile(trackFileName).write(JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save analysis sidecar', err);
  }
}

export function loadAnalysis(trackFileName: string): TrackAnalysis | null {
  try {
    const f = sidecarFile(trackFileName);
    if (!f.exists) return null;
    const data = JSON.parse(f.textSync()) as TrackAnalysis;
    return Array.isArray(data?.peaks) ? data : null;
  } catch {
    return null;
  }
}

export function deleteAnalysis(trackFileName: string): void {
  try {
    const f = sidecarFile(trackFileName);
    if (f.exists) f.delete();
  } catch {
    /* ignore */
  }
}

/**
 * Upload a phone-imported track to the companion server for analysis
 * (POST /api/analyze with the raw bytes) and cache the result as a sidecar.
 */
export async function analyzeRemoteTrack(track: Track): Promise<TrackAnalysis> {
  const base = getServerUrl();
  const result = await LegacyFileSystem.uploadAsync(`${base}/api/analyze`, track.uri, {
    httpMethod: 'POST',
    uploadType: LegacyFileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'application/octet-stream', ...authHeaders() },
  });
  if (result.status !== 200) {
    let message = `Server error (${result.status})`;
    try {
      message = JSON.parse(result.body)?.error || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  const data = JSON.parse(result.body) as TrackAnalysis;
  if (!Array.isArray(data?.peaks) || data.peaks.length === 0) {
    throw new Error('Server returned no analysis data.');
  }
  saveAnalysis(track.fileName, data);
  return data;
}
