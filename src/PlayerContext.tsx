import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import type { RepeatMode, Track } from './types';
import {
  deleteTrack as deleteTrackFromDisk,
  importSongs,
  loadLibrary,
} from './library';
import { shuffled } from './utils';

type PlayerContextValue = {
  // Library
  tracks: Track[];
  isImporting: boolean;
  addSongs: () => Promise<{ added: number; skipped: number }>;
  removeTrack: (id: string) => void;
  reloadLibrary: () => void;

  // Now playing
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number; // seconds
  duration: number; // seconds

  // Modes
  shuffle: boolean;
  repeat: RepeatMode;

  // Controls
  playTrack: (id: string) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [isImporting, setIsImporting] = useState(false);

  // Refs mirror state so the finish handler / controls read fresh values
  // without re-subscribing to the audio status on every render.
  const tracksRef = useRef<Track[]>([]);
  const currentIdRef = useRef<string | null>(null);
  const repeatRef = useRef<RepeatMode>('off');
  const orderRef = useRef<string[]>([]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const reloadLibrary = useCallback(() => {
    try {
      const lib = loadLibrary();
      tracksRef.current = lib;
      setTracks(lib);
    } catch (err) {
      console.warn('Failed to load library', err);
    }
  }, []);

  // One-time setup: configure audio session + load the persisted library.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});

    reloadLibrary();
  }, [reloadLibrary]);

  /** Compute the play order; with shuffle the chosen track stays first. */
  const buildOrder = useCallback(
    (startId: string | null, list: Track[], doShuffle: boolean): string[] => {
      const ids = list.map((t) => t.id);
      if (!doShuffle) return ids;
      if (startId == null) return shuffled(ids);
      return [startId, ...shuffled(ids.filter((id) => id !== startId))];
    },
    [],
  );

  const loadAndPlay = useCallback(
    (track: Track) => {
      setCurrentId(track.id);
      currentIdRef.current = track.id;
      try {
        player.replace({ uri: track.uri });
        player.play();
      } catch (err) {
        console.warn('Playback failed', err);
      }
      // Best-effort lock-screen metadata (works in a dev build / standalone).
      try {
        player.setActiveForLockScreen(true, {
          title: track.title,
          artist: track.artist,
        });
      } catch {
        // Not supported in this runtime (e.g. Expo Go) — ignore.
      }
    },
    [player],
  );

  const playTrack = useCallback(
    (id: string) => {
      const list = tracksRef.current;
      const track = list.find((t) => t.id === id);
      if (!track) return;
      orderRef.current = buildOrder(id, list, shuffle);
      loadAndPlay(track);
    },
    [buildOrder, loadAndPlay, shuffle],
  );

  const togglePlay = useCallback(() => {
    if (!currentIdRef.current) {
      const first = tracksRef.current[0];
      if (first) playTrack(first.id);
      return;
    }
    if (player.playing) player.pause();
    else player.play();
  }, [player, playTrack]);

  /** Advance to the next track. `fromFinish` honours repeat-one. */
  const advance = useCallback(
    (fromFinish: boolean) => {
      const order = orderRef.current;
      const curId = currentIdRef.current;
      const list = tracksRef.current;
      if (order.length === 0 || !curId) return;

      if (fromFinish && repeatRef.current === 'one') {
        const same = list.find((t) => t.id === curId);
        if (same) loadAndPlay(same);
        return;
      }

      const idx = order.indexOf(curId);
      let nextIdx = idx + 1;
      if (nextIdx >= order.length) {
        if (repeatRef.current === 'all') {
          nextIdx = 0;
        } else {
          if (fromFinish) {
            player.pause();
            player.seekTo(0).catch(() => {});
          }
          return;
        }
      }
      const next = list.find((t) => t.id === order[nextIdx]);
      if (next) loadAndPlay(next);
    },
    [loadAndPlay, player],
  );

  const playNext = useCallback(() => advance(false), [advance]);

  const playPrev = useCallback(() => {
    // Restart the current track if we're more than 3s in.
    if ((player.currentTime ?? 0) > 3) {
      player.seekTo(0).catch(() => {});
      return;
    }
    const order = orderRef.current;
    const curId = currentIdRef.current;
    const list = tracksRef.current;
    if (!curId || order.length === 0) return;

    const idx = order.indexOf(curId);
    let prevIdx = idx - 1;
    if (prevIdx < 0) {
      if (repeatRef.current === 'all') prevIdx = order.length - 1;
      else {
        player.seekTo(0).catch(() => {});
        return;
      }
    }
    const prev = list.find((t) => t.id === order[prevIdx]);
    if (prev) loadAndPlay(prev);
  }, [player, loadAndPlay]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(seconds).catch(() => {});
    },
    [player],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev;
      orderRef.current = buildOrder(
        currentIdRef.current,
        tracksRef.current,
        next,
      );
      return next;
    });
  }, [buildOrder]);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) =>
      prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off',
    );
  }, []);

  const addSongs = useCallback(async () => {
    setIsImporting(true);
    try {
      const { added, skipped } = await importSongs();
      if (added.length > 0) {
        setTracks((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          const merged = [...prev];
          for (const t of added) if (!seen.has(t.id)) merged.push(t);
          merged.sort((a, b) => a.title.localeCompare(b.title));
          tracksRef.current = merged;
          return merged;
        });
      }
      return { added: added.length, skipped };
    } finally {
      setIsImporting(false);
    }
  }, []);

  const removeTrack = useCallback(
    (id: string) => {
      const track = tracksRef.current.find((t) => t.id === id);
      if (!track) return;
      deleteTrackFromDisk(track);

      const next = tracksRef.current.filter((t) => t.id !== id);
      tracksRef.current = next;
      setTracks(next);
      orderRef.current = orderRef.current.filter((x) => x !== id);

      if (currentIdRef.current === id) {
        try {
          player.pause();
        } catch {}
        setCurrentId(null);
        currentIdRef.current = null;
      }
    },
    [player],
  );

  // Auto-advance when a track finishes.
  useEffect(() => {
    if (status?.didJustFinish) advance(true);
  }, [status?.didJustFinish, advance]);

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentId) ?? null,
    [tracks, currentId],
  );

  const rawDuration = status?.duration ?? 0;
  const value = useMemo<PlayerContextValue>(
    () => ({
      tracks,
      isImporting,
      addSongs,
      removeTrack,
      reloadLibrary,
      currentTrack,
      isPlaying: status?.playing ?? false,
      isBuffering: status?.isBuffering ?? false,
      position: status?.currentTime ?? 0,
      duration: isFinite(rawDuration) ? rawDuration : 0,
      shuffle,
      repeat,
      playTrack,
      togglePlay,
      playNext,
      playPrev,
      seekTo,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      tracks,
      isImporting,
      addSongs,
      removeTrack,
      reloadLibrary,
      currentTrack,
      status?.playing,
      status?.isBuffering,
      status?.currentTime,
      rawDuration,
      shuffle,
      repeat,
      playTrack,
      togglePlay,
      playNext,
      playPrev,
      seekTo,
      toggleShuffle,
      cycleRepeat,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return ctx;
}
