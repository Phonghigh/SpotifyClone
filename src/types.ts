export type Track = {
  /** Stable unique id (derived from the persisted file name). */
  id: string;
  /** Playable URI for expo-audio (file:// inside the app's music folder). */
  uri: string;
  /** Display title, parsed from the file name. */
  title: string;
  /** Display artist, parsed from the file name (or "Unknown artist"). */
  artist: string;
  /** The on-disk file name, used as the persistence key. */
  fileName: string;
  /** Genre/style, auto-read from ID3 tags or set manually. Absent if unknown. */
  genre?: string;
  /** file:// uri of the cached album cover (from embedded art). Absent if none. */
  artworkUri?: string;
  /** Original remote link this track was downloaded from. Absent for tracks
   * imported from local files, or downloaded before this field existed. */
  sourceUrl?: string;
};

export type RepeatMode = 'off' | 'all' | 'one';

/** Where the current playback queue came from. */
export type QueueSource =
  | { type: 'library' }
  | { type: 'playlist'; id: string; name: string };
