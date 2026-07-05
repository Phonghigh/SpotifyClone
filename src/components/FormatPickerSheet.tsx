import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { DownloadFormat } from '../settings';
import { Sheet } from './Sheet';

const FORMAT_OPTIONS: { key: DownloadFormat; label: string; sub: string }[] = [
  { key: 'm4a', label: 'M4A', sub: 'Best fidelity · default' },
  { key: 'mp3', label: 'MP3', sub: 'Universal compatibility' },
  { key: 'mp3-320', label: 'MP3 320', sub: 'Max bitrate' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** The format already in use — shown disabled with a "Current format" label
   * instead of hidden, so the chip row layout stays stable. */
  currentFormat?: DownloadFormat;
  onPick: (format: DownloadFormat) => void;
};

/** Reusable chip-row format picker, shared by the single-track and bulk
 * "change format" flows (extracted from AddFromLink's quality selector). */
export function FormatPickerSheet({ visible, onClose, title = 'Change format', currentFormat, onPick }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.formatRow}>
        {FORMAT_OPTIONS.map((opt) => {
          const isCurrent = opt.key === currentFormat;
          return (
            <Pressable
              key={opt.key}
              disabled={isCurrent}
              onPress={() => onPick(opt.key)}
              style={[styles.formatChip, isCurrent && styles.formatChipDisabled]}
            >
              <Text style={[styles.formatLabel, isCurrent && styles.formatLabelDisabled]}>
                {opt.label}
              </Text>
              <Text style={styles.formatSub}>{isCurrent ? 'Current format' : opt.sub}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formatChip: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  formatChipDisabled: {
    opacity: 0.4,
  },
  formatLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  formatLabelDisabled: {
    color: colors.textSecondary,
  },
  formatSub: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
