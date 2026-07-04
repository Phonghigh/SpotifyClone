import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

import { glass } from '../liquid-theme';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far to shrink on press (1 = no shrink). Default 0.96. */
  scaleTo?: number;
  children: React.ReactNode;
};

/** Pressable that gives a liquid spring "squish" on press, instead of a flat opacity change. */
export function PressableScale({ style, scaleTo = 0.96, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      damping: glass.spring.damping,
      stiffness: glass.spring.stiffness,
      mass: glass.spring.mass,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={style}
        onPressIn={(e) => {
          spring(scaleTo);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          spring(1);
          onPressOut?.(e);
        }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
