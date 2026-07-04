import React, { useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors, spacing } from '../theme';

type Props<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

/** Liquid Glass pill with a sliding indicator that springs between segments. */
export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const [rowWidth, setRowWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const activeIndex = options.findIndex((o) => o.key === value);

  const segmentWidth = rowWidth / options.length;

  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setRowWidth(w);
    translateX.setValue((w / options.length) * Math.max(activeIndex, 0));
  };

  React.useEffect(() => {
    if (rowWidth === 0) return;
    Animated.spring(translateX, {
      toValue: segmentWidth * Math.max(activeIndex, 0),
      damping: glass.spring.damping,
      stiffness: glass.spring.stiffness,
      mass: glass.spring.mass,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, rowWidth]);

  return (
    <LiquidGlass radius={glass.radius.lg} style={styles.container} specular={false}>
      <View style={styles.row} onLayout={onRowLayout}>
        {rowWidth > 0 ? (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: segmentWidth - 8,
                transform: [{ translateX: Animated.add(translateX, new Animated.Value(4)) }],
              },
            ]}
          />
        ) : null}
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable key={opt.key} onPress={() => onChange(opt.key)} style={styles.segment}>
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
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: colors.primary,
    borderRadius: glass.radius.lg - 6,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: glass.radius.lg - 6,
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
