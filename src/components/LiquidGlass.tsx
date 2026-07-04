import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

import { glass } from '../liquid-theme';

// Expo Go's pre-built APK does not ship eightbitlab.com.blurview (Dimezis BlurView),
// which expo-blur's Android native view instantiates unconditionally in its class
// initialiser — even when experimentalBlurMethod="none". Mounting any BlurView in Expo
// Go throws NoClassDefFoundError and kills the JVM process. Use a plain View instead.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

interface LiquidGlassProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  specular?: boolean;
}

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
      {isExpoGo ? (
        // Expo Go: plain dark tint — no BlurView native view instantiated
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, backgroundColor: 'rgba(12,12,12,0.82)' },
          ]}
        />
      ) : (
        <BlurView
          intensity={intensity}
          tint={tint}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      )}
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
