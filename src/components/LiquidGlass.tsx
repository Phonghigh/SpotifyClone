import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { glass } from '../liquid-theme';

interface LiquidGlassProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  specular?: boolean;
}

/**
 * Composable Liquid Glass surface: BlurView base + dark tint overlay +
 * specular top-edge highlight + hairline border. Android uses the
 * experimental blur method (falls back to translucent tint when
 * unavailable, e.g. some Expo Go devices).
 */
export function LiquidGlass({
  children,
  intensity = glass.blurIntensity,
  tint = glass.blurTint,
  radius = glass.radius.md,
  style,
  specular = true,
}: LiquidGlassProps) {
  return (
    <View style={[styles.container, { borderRadius: radius }, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Glass tint overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: glass.light, borderRadius: radius },
        ]}
      />
      {/* Specular highlight — white shimmer on top edge */}
      {specular && (
        <LinearGradient
          colors={[glass.specularStart, glass.specularEnd]}
          style={[
            styles.specular,
            { borderTopLeftRadius: radius, borderTopRightRadius: radius },
          ]}
        />
      )}
      {/* Glass border */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.border,
          { borderRadius: radius, borderColor: glass.border },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  border: {
    borderWidth: 1,
    pointerEvents: 'none',
  },
});
