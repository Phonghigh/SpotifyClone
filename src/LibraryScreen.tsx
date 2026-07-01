import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from './theme';
import { usePlayer } from './PlayerContext';
import type { Track } from './types';
import { TrackRow } from './components/TrackRow';
import { MiniPlayer } from './components/MiniPlayer';
import { FullPlayer } from './components/FullPlayer';
import { AddFromLink } from './components/AddFromLink';

const TOP_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 56;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function LibraryScreen() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    isImporting,
    playTrack,
    removeTrack,
    addSongs,
  } = usePlayer();

  const [playerOpen, setPlayerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const handleAdd = useCallback(async () => {
    const { added, skipped } = await addSongs();
    if (added === 0 && skipped > 0) {
      Alert.alert('Import failed', 'Those files could not be imported.');
    }
  }, [addSongs]);

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <TrackRow
        track={item}
        isCurrent={item.id === currentTrack?.id}
        isPlaying={isPlaying && item.id === currentTrack?.id}
        onPress={() => playTrack(item.id)}
        onRemove={() => removeTrack(item.id)}
      />
    ),
    [currentTrack?.id, isPlaying, playTrack, removeTrack],
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + spacing.md }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Ionicons name="musical-note" size={20} color={colors.black} />
          </View>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.headerTitle}>Your Library</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setLinkOpen(true)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="link" size={20} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={handleAdd}
            disabled={isImporting}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            {isImporting ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <>
                <Ionicons name="add" size={20} color={colors.black} />
                <Text style={styles.addBtnText}>Add</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Library list / empty state */}
      {tracks.length === 0 ? (
        <EmptyState onAdd={handleAdd} onLink={() => setLinkOpen(true)} busy={isImporting} />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.count}>
              {tracks.length} song{tracks.length === 1 ? '' : 's'}
            </Text>
          }
        />
      )}

      {/* Mini player */}
      {currentTrack ? (
        <View style={styles.miniWrap}>
          <MiniPlayer onPress={() => setPlayerOpen(true)} />
        </View>
      ) : null}

      <FullPlayer visible={playerOpen} onClose={() => setPlayerOpen(false)} />
      <AddFromLink visible={linkOpen} onClose={() => setLinkOpen(false)} />
    </View>
  );
}

function EmptyState({
  onAdd,
  onLink,
  busy,
}: {
  onAdd: () => void;
  onLink: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="musical-notes" size={56} color={colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>Your library is empty</Text>
      <Text style={styles.emptySubtitle}>
        Import songs from your phone, or paste a YouTube / Spotify link.
      </Text>
      <Pressable
        onPress={onAdd}
        disabled={busy}
        style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.black} />
        ) : (
          <Text style={styles.emptyBtnText}>Add music from phone</Text>
        )}
      </Pressable>
      <Pressable onPress={onLink} style={styles.emptyLinkBtn} hitSlop={8}>
        <Ionicons name="link" size={16} color={colors.primary} />
        <Text style={styles.emptyLinkText}>Paste a link instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    minWidth: 72,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  addBtnText: {
    color: colors.black,
    fontWeight: '700',
    marginLeft: 2,
  },
  listContent: {
    paddingBottom: 120,
  },
  count: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  miniWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 28 : 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  emptyIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
  },
  emptyBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  emptyLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
