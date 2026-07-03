import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import { usePlaylists } from '../PlaylistsContext';
import type { Track } from '../types';
import { PlaylistCover } from './PlaylistsView';
import { Sheet } from './Sheet';
import { toast } from './Toast';

type Props = {
  track: Track | null;
  onClose: () => void;
};

export function AddToPlaylistSheet({ track, onClose }: Props) {
  const { playlists, create, addTrack } = usePlaylists();
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const handlePick = useCallback(
    (playlistId: string, playlistName: string) => {
      if (!track) return;
      addTrack(playlistId, track.id);
      toast(`Added to "${playlistName}"`, 'success');
      onClose();
    },
    [track, addTrack, onClose],
  );

  const handleCreate = useCallback(() => {
    if (!track) return;
    const playlist = create(newName.trim() || 'My playlist');
    addTrack(playlist.id, track.id);
    toast(`Added to "${playlist.name}"`, 'success');
    setNewName('');
    setShowNew(false);
    onClose();
  }, [track, create, addTrack, newName, onClose]);

  if (!track) return null;

  return (
    <Sheet visible={track != null} onClose={onClose} title="Add to playlist">
      <Text numberOfLines={1} style={styles.subtitle}>
        {track.artist} – {track.title}
      </Text>

      {showNew ? (
        <View style={styles.newRow}>
          <TextInput
            style={styles.newInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Playlist name"
            placeholderTextColor={colors.textMuted}
            autoFocus
            selectionColor={colors.primary}
            onSubmitEditing={handleCreate}
          />
          <Pressable style={styles.newCreate} onPress={handleCreate}>
            <Text style={styles.newCreateText}>Create</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => setShowNew(true)}
        >
          <View style={styles.newIcon}>
            <Ionicons name="add" size={24} color={colors.text} />
          </View>
          <View style={styles.rowMeta}>
            <Text style={styles.rowName}>New playlist</Text>
          </View>
        </Pressable>
      )}

      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        style={styles.list}
        renderItem={({ item }) => {
          const already = item.trackIds.includes(track.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              disabled={already}
              onPress={() => handlePick(item.id, item.name)}
            >
              <PlaylistCover playlist={item} size={44} />
              <View style={styles.rowMeta}>
                <Text numberOfLines={1} style={[styles.rowName, already && styles.rowNameDim]}>
                  {item.name}
                </Text>
                <Text style={styles.rowCount}>
                  {already ? 'Already added' : `${item.trackIds.length} songs`}
                </Text>
              </View>
              {already ? (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={colors.textSecondary} />
              )}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  newIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMeta: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  rowName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowNameDim: {
    color: colors.textSecondary,
  },
  rowCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  newInput: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.text,
    fontSize: 14,
    marginRight: spacing.sm,
  },
  newCreate: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  newCreateText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 13,
  },
});
