import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { glass } from '../liquid-theme';
import type { Track } from '../types';
import { Artwork } from './Artwork';
import { EqualizerBars } from './EqualizerBars';

type Props = {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onMore: () => void;
};

function TrackRowComponent({ track, isCurrent, isPlaying, onPress, onMore }: Props) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceHighlight }}
      style={({ pressed }) => [
        styles.row,
        isCurrent && styles.rowCurrent,
        pressed && styles.rowPressed,
      ]}
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

      <Pressable hitSlop={10} onPress={onMore} style={styles.moreBtn}>
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
  rowCurrent: {
    // Liquid Glass tint only — no BlurView in list rows (performance).
    backgroundColor: glass.light,
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
