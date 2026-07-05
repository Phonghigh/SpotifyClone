import AsyncStorage from '@react-native-async-storage/async-storage';

export type NowPlayingSnapshot = {
  trackId: string;
  title: string;
  artist: string;
  isPlaying: boolean;
};

const KEY = 'widget:now-playing';

/**
 * Persisted outside React state so the widget's headless task handler (which
 * runs in a fresh JS context, independent of the running app) can redraw the
 * widget with the last known playback state after a reboot/process kill.
 */
export async function saveNowPlayingSnapshot(snapshot: NowPlayingSnapshot | null): Promise<void> {
  try {
    if (snapshot) await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — a stale/missing widget snapshot just shows "tap to open".
  }
}

export async function loadNowPlayingSnapshot(): Promise<NowPlayingSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
