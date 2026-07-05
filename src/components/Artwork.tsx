import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { gradientFor, radius } from '../theme';

type Props = {
  /** Key used to pick a stable gradient (track id or title). */
  trackKey: string;
  size: number;
  borderRadius?: number;
  iconRatio?: number;
  /** Real cover image, if one was extracted for this track. Falls back to
   * the gradient placeholder when absent. */
  uri?: string;
};

/**
 * The track's real cover image when available; otherwise a colorful gradient
 * tile standing in for album art, derived deterministically from the track
 * key so a song without art always looks the same.
 */
export function Artwork({ trackKey, size, borderRadius, iconRatio = 0.42, uri }: Props) {
  const br = borderRadius ?? radius.md;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={[styles.container, { width: size, height: size, borderRadius: br }]}
      />
    );
  }

  const [from, to] = gradientFor(trackKey);
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
