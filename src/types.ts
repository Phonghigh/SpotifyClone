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
};

export type RepeatMode = 'off' | 'all' | 'one';
