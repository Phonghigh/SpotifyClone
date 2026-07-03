import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors, spacing } from '../theme';

type Props<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

/** Liquid Glass pill with sliding segments (Songs | Playlists …). */
export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <LiquidGlass radius={glass.radius.lg} style={styles.container} specular={false}>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onChange(opt.key)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: glass.radius.lg - 6,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.black,
  },
});
