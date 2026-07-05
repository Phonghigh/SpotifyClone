import { File, Paths } from 'expo-file-system';

import { DEFAULT_SERVER_URL, LOCAL_SERVER_URL } from './config';
import type { QueueSource, RepeatMode } from './types';

const SETTINGS_FILE = 'settings.json';

export type DownloadFormat = 'mp3' | 'mp3-320' | 'm4a';
export const DEFAULT_FORMAT: DownloadFormat = 'm4a';

/** 'cloud' = the deployed server (DEFAULT_SERVER_URL); 'local' = a dev
 * server on your own machine, e.g. `npm run dev` in server/ on the same
 * Wi-Fi — needed when the cloud host is IP-blocked for a given video. */
export type ServerMode = 'cloud' | 'local';
export const DEFAULT_SERVER_MODE: ServerMode = 'cloud';

/** Snapshot of the play session, restored (paused) on next launch. */
export type PlaybackState = {
  queueIds: string[];
  currentId: string | null;
  source: QueueSource;
  shuffle: boolean;
  repeat: RepeatMode;
};

type Settings = {
  serverMode?: ServerMode;
  /** Address of a local dev server (e.g. http://10.0.0.5:4000), remembered
   * separately from the cloud URL so switching modes doesn't lose either. */
  localServerUrl?: string;
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

export function getServerMode(): ServerMode {
  return readSettings().serverMode || DEFAULT_SERVER_MODE;
}

export function setServerMode(mode: ServerMode): void {
  update({ serverMode: mode });
}

export function getLocalServerUrl(): string {
  return readSettings().localServerUrl || LOCAL_SERVER_URL || '';
}

export function setLocalServerUrl(url: string): void {
  update({ localServerUrl: normalizeServerUrl(url) });
}

/** The server URL to actually use, based on the current mode. Falls back to
 * the cloud URL if local mode is selected but no local address is set yet. */
export function getServerUrl(): string {
  if (getServerMode() === 'local') {
    const local = getLocalServerUrl();
    if (local) return local;
  }
  return DEFAULT_SERVER_URL;
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
