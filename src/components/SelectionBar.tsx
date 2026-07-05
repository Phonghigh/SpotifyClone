import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';

type Props = {
  count: number;
  allSelected: boolean;
  onCancel: () => void;
  onToggleSelectAll: () => void;
  onChangeFormat: () => void;
  onRemove: () => void;
};

/** Contextual action bar shown while bulk-selecting tracks in the Library. */
export function SelectionBar({
  count,
  allSelected,
  onCancel,
  onToggleSelectAll,
  onChangeFormat,
  onRemove,
}: Props) {
  const hasSelection = count > 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.count}>{count} selected</Text>
        <Pressable onPress={onToggleSelectAll} hitSlop={8}>
          <Text style={styles.selectAll}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={onChangeFormat}
          disabled={!hasSelection}
          style={[styles.actionBtn, !hasSelection && styles.actionBtnDisabled]}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.text} />
          <Text style={styles.actionLabel}>Change format</Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          disabled={!hasSelection}
          style={[styles.actionBtn, !hasSelection && styles.actionBtnDisabled]}
        >
          <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
          <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  cancel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  count: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  selectAll: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 999,
    paddingVertical: spacing.sm,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionLabelDestructive: {
    color: '#FF6B6B',
  },
});
