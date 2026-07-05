import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import { glass } from '../liquid-theme';
import { usePlayer } from '../PlayerContext';
import { Artwork } from './Artwork';
import { LiquidGlass } from './LiquidGlass';

type Props = {
  onPress: () => void;
};

export function MiniPlayer({ onPress }: Props) {
  const { currentTrack, isPlaying, togglePlay, playNext, position, duration } = usePlayer();

  const btnScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    btnScale.setValue(0.8);
    Animated.spring(btnScale, {
      toValue: 1,
      damping: glass.spring.damping,
      stiffness: glass.spring.stiffness,
      mass: glass.spring.mass,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <LiquidGlass radius={glass.radius.sm} style={styles.wrapper} intensity={70}>
      <Pressable style={styles.bar} onPress={onPress}>
        <Artwork
          trackKey={currentTrack.id}
          size={44}
          borderRadius={radius.sm}
          uri={currentTrack.artworkUri}
        />

        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>
            {currentTrack.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {currentTrack.artist}
          </Text>
        </View>

        <Pressable hitSlop={8} onPress={togglePlay} style={styles.btn}>
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={colors.text} />
          </Animated.View>
        </Pressable>
        <Pressable hitSlop={8} onPress={playNext} style={styles.btn}>
          <Ionicons name="play-skip-forward" size={22} color={colors.text} />
        </Pressable>
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }, styles.progressGlow]} />
      </View>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.sm,
    backgroundColor: 'rgba(24,24,24,0.5)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  btn: {
    paddingHorizontal: spacing.sm,
  },
  progressTrack: {
    height: 2.5,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 2,
  },
  progressGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.text,
    borderRadius: 2,
  },
});
