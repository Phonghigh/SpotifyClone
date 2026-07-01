import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import type { Track } from '../types';
import { Artwork } from './Artwork';
import { EqualizerBars } from './EqualizerBars';

type Props = {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onRemove: () => void;
};

function TrackRowComponent({ track, isCurrent, isPlaying, onPress, onRemove }: Props) {
  const confirmRemove = () => {
    Alert.alert('Remove song', `Remove “${track.title}” from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceHighlight }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Artwork trackKey={track.id} size={52} />

      <View style={styles.meta}>
        <Text
          numberOfLines={1}
          style={[styles.title, isCurrent && styles.titleActive]}
        >
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.artist}>
          {track.artist}
        </Text>
      </View>

      {isCurrent ? (
        <View style={styles.indicator}>
          <EqualizerBars playing={isPlaying} />
        </View>
      ) : null}

      <Pressable
        hitSlop={10}
        onPress={confirmRemove}
        style={styles.moreBtn}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

export const TrackRow = React.memo(TrackRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  titleActive: {
    color: colors.primary,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  indicator: {
    marginRight: spacing.md,
  },
  moreBtn: {
    padding: spacing.xs,
  },
});
