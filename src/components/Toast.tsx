import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors, spacing } from '../theme';

type ToastKind = 'success' | 'error' | 'info';
type ToastMessage = { id: number; text: string; kind: ToastKind };

type Listener = (msg: ToastMessage) => void;
let listener: Listener | null = null;
let nextId = 1;

/** Imperative toast API — callable from anywhere (queue processor, hooks…). */
export function toast(text: string, kind: ToastKind = 'info') {
  listener?.({ id: nextId++, text, kind });
}

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const ICON_COLORS: Record<ToastKind, string> = {
  success: colors.primaryBright,
  error: '#FF6B6B',
  info: colors.text,
};

/** Mount once near the root. Renders queued toasts, one at a time. */
export function ToastHost() {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const queue = useRef<ToastMessage[]>([]);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) return;
    setCurrent(next);
    translateY.setValue(-80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => {
        setCurrent(null);
      });
    }, 3200);
  }, [translateY, opacity]);

  // When current clears, show the next queued toast.
  useEffect(() => {
    if (current == null && queue.current.length > 0) showNext();
  }, [current, showNext]);

  useEffect(() => {
    listener = (msg) => {
      queue.current.push(msg);
      if (queue.current.length === 1) {
        // Only kick if idle; otherwise the clear-effect chains it.
        setCurrent((cur) => {
          if (cur == null) {
            // Defer to let state settle before animating.
            setTimeout(showNext, 0);
          }
          return cur;
        });
      }
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showNext]);

  if (!current) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View style={{ transform: [{ translateY }], opacity }}>
        <LiquidGlass radius={glass.radius.sm} style={styles.toast}>
          <View style={styles.row}>
            <Ionicons
              name={ICONS[current.kind]}
              size={18}
              color={ICON_COLORS[current.kind]}
            />
            <Text numberOfLines={2} style={styles.text}>
              {current.text}
            </Text>
          </View>
        </LiquidGlass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 54,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    backgroundColor: 'rgba(20,20,20,0.55)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: 380,
  },
  text: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
});
