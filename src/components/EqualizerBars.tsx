import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  playing: boolean;
  color?: string;
  size?: number;
};

/** Three little bars that bounce while a track is playing (Spotify-style). */
export function EqualizerBars({ playing, color = colors.primary, size = 16 }: Props) {
  const bars = useRef([new Animated.Value(0.4), new Animated.Value(0.9), new Animated.Value(0.6)]).current;

  useEffect(() => {
    if (!playing) {
      bars.forEach((b) => b.stopAnimation());
      return;
    }
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1,
            duration: 300 + i * 90,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: 0.3,
            duration: 300 + i * 90,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [playing, bars]);

  return (
    <View style={[styles.row, { height: size, width: size }]}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: size * 0.18,
            backgroundColor: color,
            borderRadius: 2,
            height: bar.interpolate({ inputRange: [0, 1], outputRange: [size * 0.2, size] }),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
});
