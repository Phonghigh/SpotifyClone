import { File, Paths } from 'expo-file-system';

import { DEFAULT_SERVER_URL } from './config';

const SETTINGS_FILE = 'settings.json';

export type DownloadFormat = 'mp3' | 'mp3-320' | 'm4a';
export const DEFAULT_FORMAT: DownloadFormat = 'mp3';

type Settings = { serverUrl?: string; downloadFormat?: DownloadFormat };

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
  const next = readSettings();
  next.serverUrl = normalizeServerUrl(url);
  writeSettings(next);
}

export function getDownloadFormat(): DownloadFormat {
  return readSettings().downloadFormat || DEFAULT_FORMAT;
}

export function setDownloadFormat(format: DownloadFormat): void {
  const next = readSettings();
  next.downloadFormat = format;
  writeSettings(next);
}
