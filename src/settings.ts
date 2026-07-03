import { File, Paths } from 'expo-file-system';

import { DEFAULT_SERVER_URL } from './config';
import type { QueueSource, RepeatMode } from './types';

const SETTINGS_FILE = 'settings.json';

export type DownloadFormat = 'mp3' | 'mp3-320' | 'm4a';
export const DEFAULT_FORMAT: DownloadFormat = 'mp3';

/** Snapshot of the play session, restored (paused) on next launch. */
export type PlaybackState = {
  queueIds: string[];
  currentId: string | null;
  source: QueueSource;
  shuffle: boolean;
  repeat: RepeatMode;
};

type Settings = {
  serverUrl?: string;
  downloadFormat?: DownloadFormat;
  /** Last clipboard link we offered to download — never offer it twice. */
  lastOfferedClipboardUrl?: string;
  playbackState?: PlaybackState;
};

function settingsFile(): File {
  return new File(Paths.document, SETTINGS_FILE);
}

function readSettings(): Settings {
  try {
    const f = settingsFile();
    if (!f.exists) return {};
    return JSON.parse(f.textSync()) as Settings;
  } catch {
    return {};
  }
}

function writeSettings(next: Settings): void {
  try {
    settingsFile().write(JSON.stringify(next));
  } catch (err) {
    console.warn('Failed to save settings', err);
  }
}

function update(changes: Partial<Settings>): void {
  writeSettings({ ...readSettings(), ...changes });
}

/** Normalize a base URL: trim, add scheme if missing, drop trailing slash. */
export function normalizeServerUrl(url: string): string {
  let u = url.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, '');
}

export function getServerUrl(): string {
  const saved = readSettings().serverUrl;
  return (saved && saved.trim()) || DEFAULT_SERVER_URL;
}

export function setServerUrl(url: string): void {
  update({ serverUrl: normalizeServerUrl(url) });
}

export function getDownloadFormat(): DownloadFormat {
  return readSettings().downloadFormat || DEFAULT_FORMAT;
}

export function setDownloadFormat(format: DownloadFormat): void {
  update({ downloadFormat: format });
}

export function getLastOfferedClipboardUrl(): string {
  return readSettings().lastOfferedClipboardUrl || '';
}

export function setLastOfferedClipboardUrl(url: string): void {
  update({ lastOfferedClipboardUrl: url });
}

export function getPlaybackState(): PlaybackState | null {
  return readSettings().playbackState ?? null;
}

export function setPlaybackState(state: PlaybackState): void {
  update({ playbackState: state });
}
