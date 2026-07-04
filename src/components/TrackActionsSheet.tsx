import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { usePlayer } from '../PlayerContext';
import { usePlaylists } from '../PlaylistsContext';
import type { Track } from '../types';
import { Artwork } from './Artwork';
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
  const { addToQueue, playNextInQueue, removeTrack } = usePlayer();
  const { stripTrack } = usePlaylists();

  if (!track) return null;

  console.log('[DIAG 11] TrackActionsSheet open — rows: play-next, add-queue, add-playlist,', playlistContext ? 'remove-from-playlist,' : '', 'DELETE');

  const confirmDelete = () => {
    // Keep the sheet open while the alert is up — dismissing the modal first
    // can swallow the alert on iOS, so nothing would appear to happen.
    Alert.alert('Delete song', `Delete "${track.title}" from this phone?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeTrack(track.id);
          stripTrack(track.id); // keep playlists consistent
          onClose();
          toast('Deleted from library', 'success');
        },
      },
    ]);
  };

  return (
    <Sheet visible={track != null} onClose={onClose}>
      {/* Track header */}
      <View style={styles.trackHeader}>
        <Artwork trackKey={track.id} size={48} />
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
        onPress={confirmDelete}
      />
    </Sheet>
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
});
