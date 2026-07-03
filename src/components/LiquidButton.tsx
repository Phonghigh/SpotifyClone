import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors } from '../theme';

interface LiquidButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** 'glass' (default) or 'primary' (solid Spotify green). */
  variant?: 'glass' | 'primary';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/** Spring-animated pressable button with a Liquid Glass (or solid) surface. */
export function LiquidButton({
  label,
  onPress,
  icon,
  variant = 'glass',
  disabled = false,
  style,
  textStyle,
}: LiquidButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      damping: glass.spring.damping,
      stiffness: glass.spring.stiffness,
      mass: glass.spring.mass,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: glass.spring.damping,
      stiffness: glass.spring.stiffness,
      mass: glass.spring.mass,
      useNativeDriver: true,
    }).start();
  };

  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={variant === 'primary' ? colors.black : colors.text}
          style={styles.icon}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelPrimary,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && styles.disabled, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
      >
        {variant === 'primary' ? (
          <View style={[styles.inner, styles.primary]}>{content}</View>
        ) : (
          <LiquidGlass radius={glass.radius.lg} style={styles.inner}>
            {content}
          </LiquidGlass>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: glass.radius.lg,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  labelPrimary: {
    color: colors.black,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
});
