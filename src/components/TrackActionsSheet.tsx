import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { usePlayer } from '../PlayerContext';
import { usePlaylists } from '../PlaylistsContext';
import { useDownloadQueue } from '../DownloadQueueContext';
import { searchQueryFor } from '../downloaderClient';
import { getFormat } from '../trackMetadata';
import type { Track } from '../types';
import { Artwork } from './Artwork';
import { FormatPickerSheet } from './FormatPickerSheet';
import { Sheet } from './Sheet';
import { toast } from './Toast';

type Props = {
  track: Track | null;
  onClose: () => void;
  onAddToPlaylist: (track: Track) => void;
  /** When opened from inside a playlist, allows "remove from this playlist". */
  playlistContext?: { id: string; name: string; removeTrack: (trackId: string) => void };
};

type ActionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

function ActionRow({ icon, label, destructive, onPress }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? '#FF6B6B' : colors.text}
      />
      <Text style={[styles.actionLabel, destructive && styles.actionDestructive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TrackActionsSheet({ track, onClose, onAddToPlaylist, playlistContext }: Props) {
  const { addToQueue, playNextInQueue, removeTrack, setTrackGenre } = usePlayer();
  const { stripTrack } = usePlaylists();
  const { changeFormat } = useDownloadQueue();
  const [genreEditorTrack, setGenreEditorTrack] = useState<Track | null>(null);
  const [genreValue, setGenreValue] = useState('');
  const [formatPickerTrack, setFormatPickerTrack] = useState<Track | null>(null);

  const confirmDelete = (t: Track) => {
    // Keep the sheet open while the alert is up — dismissing the modal first
    // can swallow the alert on iOS, so nothing would appear to happen.
    Alert.alert('Delete song', `Delete "${t.title}" from this phone?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeTrack(t.id);
          stripTrack(t.id); // keep playlists consistent
          onClose();
          toast('Deleted from library', 'success');
        },
      },
    ]);
  };

  const openGenreEditor = (t: Track) => {
    setGenreValue(t.genre ?? '');
    setGenreEditorTrack(t);
  };

  const saveGenre = () => {
    if (genreEditorTrack) {
      setTrackGenre(genreEditorTrack.id, genreValue);
      toast('Genre updated', 'success');
    }
    setGenreEditorTrack(null);
  };

  return (
    <>
      <Sheet visible={track != null} onClose={onClose}>
        {track ? (
          <>
            {/* Track header */}
            <View style={styles.trackHeader}>
              <Artwork trackKey={track.id} size={48} uri={track.artworkUri} />
              <View style={styles.trackMeta}>
                <Text numberOfLines={1} style={styles.trackTitle}>
                  {track.title}
                </Text>
                <Text numberOfLines={1} style={styles.trackArtist}>
                  {track.artist}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />

            <ActionRow
              icon="play-skip-forward-outline"
              label="Play next"
              onPress={() => {
                playNextInQueue(track.id);
                toast('Will play next', 'success');
                onClose();
              }}
            />
            <ActionRow
              icon="list-outline"
              label="Add to queue"
              onPress={() => {
                addToQueue(track.id);
                toast('Added to queue', 'success');
                onClose();
              }}
            />
            <ActionRow
              icon="albums-outline"
              label="Add to playlist…"
              onPress={() => {
                onClose();
                onAddToPlaylist(track);
              }}
            />
            <ActionRow
              icon="pricetag-outline"
              label={track.genre ? `Genre: ${track.genre}` : 'Edit genre…'}
              onPress={() => {
                onClose();
                openGenreEditor(track);
              }}
            />
            <ActionRow
              icon="swap-horizontal-outline"
              label="Change format…"
              onPress={() => setFormatPickerTrack(track)}
            />
            {playlistContext ? (
              <ActionRow
                icon="remove-circle-outline"
                label={`Remove from "${playlistContext.name}"`}
                onPress={() => {
                  playlistContext.removeTrack(track.id);
                  onClose();
                }}
              />
            ) : null}
            <ActionRow
              icon="trash-outline"
              label="Delete from library"
              destructive
              onPress={() => confirmDelete(track)}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={genreEditorTrack != null}
        onClose={() => setGenreEditorTrack(null)}
        title="Edit genre"
      >
        <TextInput
          value={genreValue}
          onChangeText={setGenreValue}
          placeholder="e.g. Pop, Lo-fi, Hip-Hop"
          placeholderTextColor={colors.textMuted}
          style={styles.genreInput}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveGenre}
        />
        <Pressable onPress={saveGenre} style={({ pressed }) => [styles.saveBtn, pressed && styles.actionPressed]}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </Sheet>

      <FormatPickerSheet
        visible={formatPickerTrack != null}
        onClose={() => setFormatPickerTrack(null)}
        currentFormat={formatPickerTrack ? getFormat(formatPickerTrack.fileName) : undefined}
        onPick={(format) => {
          const t = formatPickerTrack;
          setFormatPickerTrack(null);
          onClose();
          if (!t) return;
          if (t.sourceUrl) {
            changeFormat(t, format);
          } else {
            // No saved link (downloaded before sourceUrl persistence, or
            // imported from a local file) — search for it automatically
            // instead of asking the user to paste the original link.
            const query = searchQueryFor(t.title, t.artist);
            changeFormat({ ...t, sourceUrl: query }, format);
            toast('Searching online for a match…', 'info');
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  trackArtist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
  },
  actionPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15.5,
    fontWeight: '500',
    marginLeft: spacing.lg,
  },
  actionDestructive: {
    color: '#FF6B6B',
  },
  genreInput: {
    color: colors.text,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.black,
    fontSize: 15.5,
    fontWeight: '700',
  },
});
