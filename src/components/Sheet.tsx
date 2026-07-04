import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdropTint, { opacity: backdropOpacity }]} />
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY }], maxHeight: SCREEN_H * 0.8 }}>
          <LiquidGlass radius={glass.radius.xl} style={styles.sheet} intensity={70}>
            {/* Bottom inset: keep the last row above the Android nav bar / iOS home indicator. */}
            <View
              style={[styles.inner, { paddingBottom: styles.inner.paddingBottom + insets.bottom }]}
              onLayout={(e) =>
                console.log(
                  '[DIAG 12] Sheet inner height:', Math.round(e.nativeEvent.layout.height),
                  'window:', Math.round(SCREEN_H), 'insetBottom:', insets.bottom,
                )
              }
            >
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
              {/* Scrollable so no action row can ever be pushed off-screen. */}
              <ScrollView style={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
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
    maxHeight: '90%'
  },
  scroll: {
    flexGrow: 0,
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
