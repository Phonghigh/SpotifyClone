console.log('[DIAG 3] PlayerContext loading');
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

import type { QueueSource, RepeatMode, Track } from './types';
import {
  deleteTrack as deleteTrackFromDisk,
  importSongs,
  loadLibrary,
} from './library';
import { getPlaybackState, setPlaybackState } from './settings';
import { shuffled } from './utils';

/** A playback context: the ordered tracks a queue is built from. */
export type PlayContext = {
  ids: string[];
  source: QueueSource;
};

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

  // Queue
  queue: Track[]; // full queue in play order
  upNext: Track[]; // tracks after the current one
  queueSource: QueueSource;
  addToQueue: (trackId: string) => void;
  playNextInQueue: (trackId: string) => void;
  removeFromQueue: (trackId: string) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpTo: (trackId: string) => void;

  // Modes
  shuffle: boolean;
  repeat: RepeatMode;

  // Controls
  playTrack: (id: string, context?: PlayContext) => void;
  playPlaylist: (context: PlayContext, options?: { shuffle?: boolean }) => void;
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
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueSource, setQueueSource] = useState<QueueSource>({ type: 'library' });
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [isImporting, setIsImporting] = useState(false);

  // Refs mirror state so async handlers read fresh values without
  // re-subscribing to the audio status on every render.
  const tracksRef = useRef<Track[]>([]);
  const currentIdRef = useRef<string | null>(null);
  const repeatRef = useRef<RepeatMode>('off');
  const queueRef = useRef<string[]>([]);
  /** The un-shuffled order of the active context (to restore on shuffle-off). */
  const sourceOrderRef = useRef<string[]>([]);
  const shuffleRef = useRef(false);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  const setQueue = useCallback((ids: string[]) => {
    queueRef.current = ids;
    setQueueIds(ids);
  }, []);

  const reloadLibrary = useCallback(() => {
    try {
      const lib = loadLibrary();
      tracksRef.current = lib;
      setTracks(lib);
    } catch (err) {
      console.warn('Failed to load library', err);
    }
  }, []);

  /** True once the initial session restore has run (gates persistence). */
  const restored = useRef(false);

  // One-time setup: configure audio session, load the persisted library,
  // and restore the last play session (paused).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});

    reloadLibrary();

    try {
      const saved = getPlaybackState();
      if (saved) {
        const existing = new Set(tracksRef.current.map((t) => t.id));
        const ids = saved.queueIds.filter((id) => existing.has(id));
        if (ids.length > 0) {
          queueRef.current = ids;
          setQueueIds(ids);
          sourceOrderRef.current = [...ids];
          setQueueSource(saved.source);
          shuffleRef.current = saved.shuffle;
          setShuffle(saved.shuffle);
          repeatRef.current = saved.repeat;
          setRepeat(saved.repeat);

          const cur =
            saved.currentId && existing.has(saved.currentId)
              ? tracksRef.current.find((t) => t.id === saved.currentId)!
              : null;
          if (cur) {
            currentIdRef.current = cur.id;
            setCurrentId(cur.id);
            try {
              player.replace({ uri: cur.uri }); // load, but stay paused
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('Failed to restore session', err);
    } finally {
      restored.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadLibrary]);

  // Persist the play session whenever it changes (after restore).
  useEffect(() => {
    if (!restored.current) return;
    setPlaybackState({
      queueIds,
      currentId,
      source: queueSource,
      shuffle,
      repeat,
    });
  }, [queueIds, currentId, queueSource, shuffle, repeat]);

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

  /** Build a queue from a context order, honoring shuffle with `first` first. */
  const buildQueue = useCallback(
    (contextIds: string[], first: string | null, doShuffle: boolean): string[] => {
      if (!doShuffle) return [...contextIds];
      if (first == null) return shuffled(contextIds);
      return [first, ...shuffled(contextIds.filter((id) => id !== first))];
    },
    [],
  );

  const playTrack = useCallback(
    (id: string, context?: PlayContext) => {
      const list = tracksRef.current;
      const track = list.find((t) => t.id === id);
      if (!track) return;

      const ctxIds = context?.ids ?? list.map((t) => t.id);
      sourceOrderRef.current = [...ctxIds];
      setQueue(buildQueue(ctxIds, id, shuffleRef.current));
      setQueueSource(context?.source ?? { type: 'library' });
      loadAndPlay(track);
    },
    [buildQueue, loadAndPlay, setQueue],
  );

  const playPlaylist = useCallback(
    (context: PlayContext, options?: { shuffle?: boolean }) => {
      const list = tracksRef.current;
      const playable = context.ids.filter((id) => list.some((t) => t.id === id));
      if (playable.length === 0) return;

      const wantShuffle = options?.shuffle ?? shuffleRef.current;
      if (options?.shuffle != null) {
        shuffleRef.current = options.shuffle;
        setShuffle(options.shuffle);
      }

      const order = wantShuffle ? shuffled(playable) : playable;
      sourceOrderRef.current = [...playable];
      setQueue(order);
      setQueueSource(context.source);

      const first = list.find((t) => t.id === order[0]);
      if (first) loadAndPlay(first);
    },
    [loadAndPlay, setQueue],
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
      const order = queueRef.current;
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
    const order = queueRef.current;
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
      shuffleRef.current = next;
      const cur = currentIdRef.current;
      if (next) {
        // Shuffle everything after keeping the current track first.
        const others = queueRef.current.filter((id) => id !== cur);
        setQueue(cur ? [cur, ...shuffled(others)] : shuffled(others));
      } else {
        // Restore the context's original order.
        const source = sourceOrderRef.current;
        // Keep any manual queue additions that aren't in the source order.
        const extras = queueRef.current.filter((id) => !source.includes(id));
        setQueue([...source, ...extras]);
      }
      return next;
    });
  }, [setQueue]);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) =>
      prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off',
    );
  }, []);

  // ------------------------------------------------------------------
  // Queue editing
  // ------------------------------------------------------------------

  const addToQueue = useCallback(
    (trackId: string) => {
      if (!tracksRef.current.some((t) => t.id === trackId)) return;
      const q = queueRef.current;
      if (q.length === 0) {
        // Nothing playing: start a queue with just this track.
        sourceOrderRef.current = [trackId];
        setQueue([trackId]);
        return;
      }
      if (q.includes(trackId)) {
        // Move an existing entry to the end (after current) instead of duping.
        setQueue([...q.filter((id) => id !== trackId), trackId]);
        return;
      }
      setQueue([...q, trackId]);
    },
    [setQueue],
  );

  const playNextInQueue = useCallback(
    (trackId: string) => {
      if (!tracksRef.current.some((t) => t.id === trackId)) return;
      const q = queueRef.current.filter((id) => id !== trackId);
      const cur = currentIdRef.current;
      const idx = cur ? q.indexOf(cur) : -1;
      const next = [...q];
      next.splice(idx + 1, 0, trackId);
      setQueue(next);
    },
    [setQueue],
  );

  const removeFromQueue = useCallback(
    (trackId: string) => {
      if (trackId === currentIdRef.current) return; // never remove the playing track
      setQueue(queueRef.current.filter((id) => id !== trackId));
    },
    [setQueue],
  );

  const moveInQueue = useCallback(
    (from: number, to: number) => {
      const q = [...queueRef.current];
      if (from < 0 || from >= q.length || to < 0 || to >= q.length) return;
      const [moved] = q.splice(from, 1);
      q.splice(to, 0, moved);
      setQueue(q);
    },
    [setQueue],
  );

  const jumpTo = useCallback(
    (trackId: string) => {
      const track = tracksRef.current.find((t) => t.id === trackId);
      if (track && queueRef.current.includes(trackId)) loadAndPlay(track);
    },
    [loadAndPlay],
  );

  // ------------------------------------------------------------------
  // Library management
  // ------------------------------------------------------------------

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
      setQueue(queueRef.current.filter((x) => x !== id));
      sourceOrderRef.current = sourceOrderRef.current.filter((x) => x !== id);

      if (currentIdRef.current === id) {
        try {
          player.pause();
        } catch {}
        setCurrentId(null);
        currentIdRef.current = null;
      }
    },
    [player, setQueue],
  );

  // Auto-advance when a track finishes.
  useEffect(() => {
    if (status?.didJustFinish) advance(true);
  }, [status?.didJustFinish, advance]);

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentId) ?? null,
    [tracks, currentId],
  );

  const queue = useMemo(() => {
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return queueIds.map((id) => byId.get(id)).filter((t): t is Track => t != null);
  }, [tracks, queueIds]);

  const upNext = useMemo(() => {
    if (!currentId) return queue;
    const idx = queue.findIndex((t) => t.id === currentId);
    return idx >= 0 ? queue.slice(idx + 1) : queue;
  }, [queue, currentId]);

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
      queue,
      upNext,
      queueSource,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      moveInQueue,
      jumpTo,
      shuffle,
      repeat,
      playTrack,
      playPlaylist,
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
      queue,
      upNext,
      queueSource,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      moveInQueue,
      jumpTo,
      shuffle,
      repeat,
      playTrack,
      playPlaylist,
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
