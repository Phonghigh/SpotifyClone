import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { usePlayer } from '../PlayerContext';
import { Artwork } from './Artwork';
import { EqualizerBars } from './EqualizerBars';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function UpNextSheet({ visible, onClose }: Props) {
  const {
    queue,
    currentTrack,
    isPlaying,
    queueSource,
    jumpTo,
    removeFromQueue,
    moveInQueue,
  } = usePlayer();

  const sourceLabel =
    queueSource.type === 'playlist' ? `Playing from: ${queueSource.name}` : 'Playing from: Your Library';

  const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;

  return (
    <Sheet visible={visible} onClose={onClose} title="Up next">
      <Text style={styles.source}>{sourceLabel}</Text>

      <FlatList
        data={queue}
        keyExtractor={(t) => t.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>The queue is empty.</Text>}
        renderItem={({ item, index }) => {
          const isCurrent = index === currentIndex;
          const isPast = currentIndex >= 0 && index < currentIndex;
          return (
            <View style={[styles.row, isPast && styles.rowPast]}>
              <Pressable style={styles.rowMain} onPress={() => jumpTo(item.id)}>
                <Artwork trackKey={item.id} size={40} uri={item.artworkUri} />
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

              {!isCurrent ? (
                <View style={styles.rowActions}>
                  <Pressable
                    hitSlop={6}
                    disabled={index === 0}
                    onPress={() => moveInQueue(index, index - 1)}
                    style={index === 0 && styles.dim}
                  >
                    <Ionicons name="chevron-up" size={17} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    hitSlop={6}
                    disabled={index === queue.length - 1}
                    onPress={() => moveInQueue(index, index + 1)}
                    style={index === queue.length - 1 && styles.dim}
                  >
                    <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable hitSlop={6} onPress={() => removeFromQueue(item.id)}>
                    <Ionicons name="close" size={17} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  source: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowPast: {
    opacity: 0.45,
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
    fontSize: 14.5,
    fontWeight: '500',
  },
  rowTitleActive: {
    color: colors.primary,
  },
  rowArtist: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.sm,
  },
  dim: {
    opacity: 0.25,
  },
});
