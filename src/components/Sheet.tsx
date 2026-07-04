import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Extra element rendered right of the title (left of the close button). */
  headerRight?: React.ReactNode;
};

const SCREEN_H = Dimensions.get('window').height;

/** Shared Liquid Glass bottom sheet used by all the small modal panels. */
export function Sheet({ visible, onClose, title, children, headerRight }: Props) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: glass.spring.damping,
          stiffness: glass.spring.stiffness,
          mass: glass.spring.mass,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdropTint, { opacity: backdropOpacity }]} />
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY }] }}>
          <LiquidGlass radius={glass.radius.xl} style={styles.sheet} intensity={70}>
            <View style={styles.inner}>
              <View style={styles.grabber} />
              {title != null ? (
                <View style={styles.headerRow}>
                  <Text style={styles.title}>{title}</Text>
                  <View style={styles.headerActions}>
                    {headerRight}
                    <Pressable hitSlop={10} onPress={onClose}>
                      <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {children}
            </View>
          </LiquidGlass>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(18,18,18,0.72)',
    maxHeight: '78%',
  },
  inner: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginRight: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
});
