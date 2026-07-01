import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { gradientFor, radius } from '../theme';

type Props = {
  /** Key used to pick a stable gradient (track id or title). */
  trackKey: string;
  size: number;
  borderRadius?: number;
  iconRatio?: number;
};

/**
 * A colorful gradient tile standing in for album art. The gradient is derived
 * deterministically from the track key, so a song always looks the same.
 */
export function Artwork({ trackKey, size, borderRadius, iconRatio = 0.42 }: Props) {
  const [from, to] = gradientFor(trackKey);
  const br = borderRadius ?? radius.md;
  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { width: size, height: size, borderRadius: br }]}
    >
      <View style={styles.iconShadow}>
        <Ionicons name="musical-notes" size={size * iconRatio} color="rgba(255,255,255,0.92)" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
