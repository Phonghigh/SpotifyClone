import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { usePlayer } from '../PlayerContext';
import { usePlaylists } from '../PlaylistsContext';
import type { Track } from '../types';
import { Artwork } from './Artwork';
import { EqualizerBars } from './EqualizerBars';
import { PlaylistCover } from './PlaylistsView';
import { Sheet } from './Sheet';

type Props = {
  playlistId: string;
  onBack: () => void;
  onTrackMore: (track: Track) => void;
};

export function PlaylistDetail({ playlistId, onBack, onTrackMore }: Props) {
  const { tracks, currentTrack, isPlaying, playTrack, playPlaylist } = usePlayer();
  const { playlists, remove, removeTrack, moveTrack, addTrack } = usePlaylists();
  const [pickerOpen, setPickerOpen] = useState(false);

  const playlist = playlists.find((p) => p.id === playlistId);

  const playlistTracks = useMemo(() => {
    if (!playlist) return [];
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return playlist.trackIds
      .map((id) => byId.get(id))
      .filter((t): t is Track => t != null);
  }, [playlist, tracks]);

  const context = useMemo(
    () =>
      playlist
        ? {
            ids: playlistTracks.map((t) => t.id),
            source: { type: 'playlist' as const, id: playlist.id, name: playlist.name },
          }
        : null,
    [playlist, playlistTracks],
  );

  const handleDelete = useCallback(() => {
    if (!playlist) return;
    Alert.alert('Delete playlist', `Delete "${playlist.name}"? Songs stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove(playlist.id);
          onBack();
        },
      },
    ]);
  }, [playlist, remove, onBack]);

  if (!playlist) return null;

  const notInPlaylist = tracks.filter((t) => !playlist.trackIds.includes(t.id));

  return (
    <View style={styles.root}>
      {/* Playlist header */}
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <PlaylistCover playlist={playlist} size={72} />
        <View style={styles.headerMeta}>
          <Text numberOfLines={2} style={styles.name}>
            {playlist.name}
          </Text>
          <Text style={styles.count}>
            {playlistTracks.length} song{playlistTracks.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, playlistTracks.length === 0 && styles.actionDisabled]}
          disabled={playlistTracks.length === 0 || !context}
          onPress={() => context && playPlaylist(context, { shuffle: false })}
        >
          <Ionicons name="play" size={18} color={colors.black} />
          <Text style={styles.actionText}>Play</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            styles.actionSecondary,
            playlistTracks.length === 0 && styles.actionDisabled,
          ]}
          disabled={playlistTracks.length === 0 || !context}
          onPress={() => context && playPlaylist(context, { shuffle: true })}
        >
          <Ionicons name="shuffle" size={18} color={colors.text} />
          <Text style={[styles.actionText, styles.actionTextSecondary]}>Shuffle</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionSecondary]}
          onPress={() => setPickerOpen(true)}
        >
          <Ionicons name="add" size={18} color={colors.text} />
          <Text style={[styles.actionText, styles.actionTextSecondary]}>Add songs</Text>
        </Pressable>
      </View>

      {/* Track list */}
      <FlatList
        data={playlistTracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No songs yet — tap "Add songs".</Text>
        }
        renderItem={({ item, index }) => {
          const isCurrent = item.id === currentTrack?.id;
          return (
            <View style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => context && playTrack(item.id, context)}
              >
                <Artwork trackKey={item.id} size={44} uri={item.artworkUri} />
                <View style={styles.rowMeta}>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowTitle, isCurrent && styles.rowTitleActive]}
                  >
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowArtist}>
                    {item.artist}
                  </Text>
                </View>
                {isCurrent ? <EqualizerBars playing={isPlaying} size={14} /> : null}
              </Pressable>

              <View style={styles.rowActions}>
                <Pressable
                  hitSlop={6}
                  disabled={index === 0}
                  onPress={() => moveTrack(playlist.id, index, index - 1)}
                  style={index === 0 && styles.rowBtnDisabled}
                >
                  <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  hitSlop={6}
                  disabled={index === playlistTracks.length - 1}
                  onPress={() => moveTrack(playlist.id, index, index + 1)}
                  style={index === playlistTracks.length - 1 && styles.rowBtnDisabled}
                >
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable hitSlop={6} onPress={() => removeTrack(playlist.id, item.id)}>
                  <Ionicons name="remove-circle-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable hitSlop={6} onPress={() => onTrackMore(item)}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Add-songs picker */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add songs">
        <FlatList
          data={notInPlaylist}
          keyExtractor={(t) => t.id}
          style={styles.pickerList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Every library song is already here.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
              onPress={() => addTrack(playlist.id, item.id)}
            >
              <Artwork trackKey={item.id} size={40} uri={item.artworkUri} />
              <View style={styles.rowMeta}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.rowArtist}>
                  {item.artist}
                </Text>
              </View>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backBtn: {
    marginRight: spacing.sm,
  },
  headerMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  count: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionSecondary: {
    backgroundColor: colors.surfaceHighlight,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 13.5,
    marginLeft: 4,
  },
  actionTextSecondary: {
    color: colors.text,
  },
  listContent: {
    paddingBottom: 140,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    padding: spacing.xl,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMeta: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  rowTitleActive: {
    color: colors.primary,
  },
  rowArtist: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 1,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.sm,
  },
  rowBtnDisabled: {
    opacity: 0.25,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
