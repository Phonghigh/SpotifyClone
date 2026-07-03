import { File, Paths } from 'expo-file-system';

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
};

const PLAYLISTS_FILE = 'playlists.json';

function playlistsFile(): File {
  return new File(Paths.document, PLAYLISTS_FILE);
}

export function loadPlaylists(): Playlist[] {
  try {
    const f = playlistsFile();
    if (!f.exists) return [];
    const raw = JSON.parse(f.textSync());
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: Playlist[]): void {
  try {
    playlistsFile().write(JSON.stringify(playlists));
  } catch (err) {
    console.warn('Failed to save playlists', err);
  }
}

let nextPlaylistId = Date.now();

export function createPlaylist(name: string): Playlist {
  const now = Date.now();
  return {
    id: `pl-${nextPlaylistId++}`,
    name: name.trim() || 'New playlist',
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Pure helpers — all return a NEW array; callers persist via savePlaylists. */

export function addTrackToPlaylist(
  playlists: Playlist[],
  playlistId: string,
  trackId: string,
): Playlist[] {
  return playlists.map((p) =>
    p.id === playlistId && !p.trackIds.includes(trackId)
      ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: Date.now() }
      : p,
  );
}

export function removeTrackFromPlaylist(
  playlists: Playlist[],
  playlistId: string,
  trackId: string,
): Playlist[] {
  return playlists.map((p) =>
    p.id === playlistId
      ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId), updatedAt: Date.now() }
      : p,
  );
}

export function moveTrackInPlaylist(
  playlists: Playlist[],
  playlistId: string,
  from: number,
  to: number,
): Playlist[] {
  return playlists.map((p) => {
    if (p.id !== playlistId) return p;
    if (from < 0 || from >= p.trackIds.length || to < 0 || to >= p.trackIds.length) return p;
    const ids = [...p.trackIds];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    return { ...p, trackIds: ids, updatedAt: Date.now() };
  });
}

export function renamePlaylist(
  playlists: Playlist[],
  playlistId: string,
  name: string,
): Playlist[] {
  const trimmed = name.trim();
  if (!trimmed) return playlists;
  return playlists.map((p) =>
    p.id === playlistId ? { ...p, name: trimmed, updatedAt: Date.now() } : p,
  );
}

export function deletePlaylist(playlists: Playlist[], playlistId: string): Playlist[] {
  return playlists.filter((p) => p.id !== playlistId);
}

/** Strip a deleted library track from every playlist. */
export function stripTrackEverywhere(playlists: Playlist[], trackId: string): Playlist[] {
  let changed = false;
  const next = playlists.map((p) => {
    if (!p.trackIds.includes(trackId)) return p;
    changed = true;
    return { ...p, trackIds: p.trackIds.filter((t) => t !== trackId), updatedAt: Date.now() };
  });
  return changed ? next : playlists;
}
