console.log('[DIAG 4] PlaylistsContext loading');
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Playlist,
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  loadPlaylists,
  moveTrackInPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
  savePlaylists,
  stripTrackEverywhere,
} from './playlists';

type PlaylistsContextValue = {
  playlists: Playlist[];
  create: (name: string) => Playlist;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  addTrack: (playlistId: string, trackId: string) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  moveTrack: (playlistId: string, from: number, to: number) => void;
  /** Called when a track is deleted from the library. */
  stripTrack: (trackId: string) => void;
};

const PlaylistsContext = createContext<PlaylistsContextValue | null>(null);

export function PlaylistsProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<Playlist[]>(loadPlaylists());
  const [playlists, setPlaylists] = useState<Playlist[]>(ref.current);

  const mutate = useCallback((updater: (prev: Playlist[]) => Playlist[]) => {
    ref.current = updater(ref.current);
    setPlaylists(ref.current);
    savePlaylists(ref.current);
  }, []);

  const create = useCallback(
    (name: string): Playlist => {
      const playlist = createPlaylist(name);
      mutate((prev) => [...prev, playlist]);
      return playlist;
    },
    [mutate],
  );

  const rename = useCallback(
    (id: string, name: string) => mutate((prev) => renamePlaylist(prev, id, name)),
    [mutate],
  );

  const remove = useCallback(
    (id: string) => mutate((prev) => deletePlaylist(prev, id)),
    [mutate],
  );

  const addTrack = useCallback(
    (playlistId: string, trackId: string) =>
      mutate((prev) => addTrackToPlaylist(prev, playlistId, trackId)),
    [mutate],
  );

  const removeTrack = useCallback(
    (playlistId: string, trackId: string) =>
      mutate((prev) => removeTrackFromPlaylist(prev, playlistId, trackId)),
    [mutate],
  );

  const moveTrack = useCallback(
    (playlistId: string, from: number, to: number) =>
      mutate((prev) => moveTrackInPlaylist(prev, playlistId, from, to)),
    [mutate],
  );

  const stripTrack = useCallback(
    (trackId: string) => mutate((prev) => stripTrackEverywhere(prev, trackId)),
    [mutate],
  );

  const value = useMemo<PlaylistsContextValue>(
    () => ({
      playlists,
      create,
      rename,
      remove,
      addTrack,
      removeTrack,
      moveTrack,
      stripTrack,
    }),
    [playlists, create, rename, remove, addTrack, removeTrack, moveTrack, stripTrack],
  );

  return <PlaylistsContext.Provider value={value}>{children}</PlaylistsContext.Provider>;
}

export function usePlaylists(): PlaylistsContextValue {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistsProvider');
  return ctx;
}
