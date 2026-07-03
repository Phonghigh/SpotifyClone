import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, gradientFor, radius, spacing } from '../theme';
import { glass } from '../liquid-theme';
import { LiquidGlass } from './LiquidGlass';
import { usePlaylists } from '../PlaylistsContext';
import type { Playlist } from '../playlists';

const COVER_SIZE = 56;

/** 2×2 gradient collage built from the playlist's first four tracks. */
export function PlaylistCover({ playlist, size = COVER_SIZE }: { playlist: Playlist; size?: number }) {
  const cells = [0, 1, 2, 3].map((i) => {
    const trackId = playlist.trackIds[i];
    return trackId ? gradientFor(trackId) : null;
  });
  const half = size / 2;

  return (
    <View style={[styles.cover, { width: size, height: size, borderRadius: radius.md }]}>
      {playlist.trackIds.length === 0 ? (
        <View style={[styles.coverEmpty, { width: size, height: size }]}>
          <Ionicons name="musical-notes" size={size * 0.4} color={colors.textMuted} />
        </View>
      ) : (
        <View style={styles.coverGrid}>
          {cells.map((g, i) => (
            <LinearGradient
              key={i}
              colors={g ?? ['#2a2a2a', '#1c1c1c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: half, height: half }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type Props = {
  onOpenPlaylist: (playlistId: string) => void;
};

export function PlaylistsView({ onOpenPlaylist }: Props) {
  const { playlists, create } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = useCallback(() => {
    const playlist = create(name.trim() || 'My playlist');
    setCreating(false);
    setName('');
    onOpenPlaylist(playlist.id);
  }, [create, name, onOpenPlaylist]);

  return (
    <View style={styles.root}>
      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Pressable
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.newRow, pressed && styles.pressed]}
          >
            <View style={styles.newIcon}>
              <Ionicons name="add" size={26} color={colors.text} />
            </View>
            <Text style={styles.newText}>New playlist</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Group your songs into playlists — tap "New playlist" to start.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpenPlaylist(item.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <PlaylistCover playlist={item} />
            <View style={styles.meta}>
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <Text style={styles.count}>
                {item.trackIds.length} song{item.trackIds.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />

      {/* Create-playlist dialog */}
      <Modal visible={creating} animationType="fade" transparent onRequestClose={() => setCreating(false)}>
        <View style={styles.dialogBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <LiquidGlass radius={glass.radius.md} style={styles.dialog} intensity={70}>
              <View style={styles.dialogInner}>
                <Text style={styles.dialogTitle}>New playlist</Text>
                <TextInput
                  style={styles.dialogInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Playlist name"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  selectionColor={colors.primary}
                  onSubmitEditing={handleCreate}
                />
                <View style={styles.dialogActions}>
                  <Pressable
                    onPress={() => {
                      setCreating(false);
                      setName('');
                    }}
                    style={styles.dialogBtn}
                  >
                    <Text style={styles.dialogCancel}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleCreate} style={[styles.dialogBtn, styles.dialogCreate]}>
                    <Text style={styles.dialogCreateText}>Create</Text>
                  </Pressable>
                </View>
              </View>
            </LiquidGlass>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 140,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  newIcon: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  empty: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cover: {
    overflow: 'hidden',
  },
  coverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  coverEmpty: {
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: 320,
    backgroundColor: 'rgba(24,24,24,0.8)',
  },
  dialogInner: {
    padding: spacing.xl,
  },
  dialogTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  dialogInput: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  dialogBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  dialogCancel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dialogCreate: {
    backgroundColor: colors.primary,
  },
  dialogCreateText: {
    color: colors.black,
    fontWeight: '800',
  },
});
