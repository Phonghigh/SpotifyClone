import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { glass } from '../liquid-theme';
import type { Track } from '../types';
import { Artwork } from './Artwork';
import { EqualizerBars } from './EqualizerBars';
import { PressableScale } from './PressableScale';

type Props = {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onMore: () => void;
  onLongPress?: () => void;
  /** Bulk-select mode (Library screen): shows a checkbox instead of the
   * "more" button, and onPress toggles selection instead of playing. */
  selectionMode?: boolean;
  selected?: boolean;
};

function TrackRowComponent({
  track,
  isCurrent,
  isPlaying,
  onPress,
  onMore,
  onLongPress,
  selectionMode,
  selected,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.985}
      android_ripple={{ color: colors.surfaceHighlight }}
      style={[styles.row, isCurrent && styles.rowCurrent]}
    >
      {selectionMode ? (
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.black} /> : null}
        </View>
      ) : (
        <Artwork trackKey={track.id} size={52} uri={track.artworkUri} />
      )}

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

      {!selectionMode && isCurrent ? (
        <View style={styles.indicator}>
          <EqualizerBars playing={isPlaying} />
        </View>
      ) : null}

      {selectionMode ? null : (
        <Pressable hitSlop={10} onPress={onMore} style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      )}
    </PressableScale>
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
