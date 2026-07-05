import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, gradientFor, spacing } from '../theme';
import type { Track } from '../types';
import { TrackAnalysis, analyzeRemoteTrack, loadAnalysis } from '../analysis';
import { resamplePeaks } from '../utils';
import { EqualizerBars } from './EqualizerBars';

type Props = {
  track: Track;
  position: number;
  duration: number;
  isPlaying: boolean;
};

const BAR_COUNT = 48;
const DISPLAY_RESOLUTION = 240;
const FLOOR = 0.08; // bars never fully disappear during quiet passages
const GAP_FRAC = 0.3; // gap between bars, as a fraction of each bar's slot width
const EASE_MS = 170; // how long bars take to ease toward a newly-polled amplitude
const JITTER_AMOUNT = 0.06; // decorative per-frame wiggle, on top of the eased target

/** Deterministic per-bar variation (not Math.random — must be stable across renders). */
function seededMultiplier(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return 0.55 + 0.45 * (x - Math.floor(x));
}
const MULTIPLIERS = Array.from({ length: BAR_COUNT }, (_, i) => seededMultiplier(i));

/**
 * An animated bar-grid "equalizer" for the full-screen player, driven by the
 * track's precomputed loudness curve (analysis.peaks) rather than live audio
 * — expo-audio exposes no real-time frequency data. Bar targets are read
 * directly from the peaks array at the current (coarsely-polled, ~4Hz)
 * playback position, then eased + given a decorative continuous jitter so
 * motion still looks smooth at 60fps between polls. See the project plan for
 * why this avoids building a separate position-extrapolation clock.
 */
export function BarGridVisualizer({ track, position, duration, isPlaying }: Props) {
  const [analysis, setAnalysis] = useState<TrackAnalysis | null>(() =>
    loadAnalysis(track.fileName),
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    setAnalysis(loadAnalysis(track.fileName));
    setAnalyzeError(null);
  }, [track.fileName]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeRemoteTrack(track);
      setAnalysis(result);
    } catch (err: any) {
      setAnalyzeError(String(err?.message || err));
    } finally {
      setAnalyzing(false);
    }
  }, [track]);

  const displayPeaks = useMemo(
    () => (analysis ? resamplePeaks(analysis.peaks, DISPLAY_RESOLUTION) : []),
    [analysis],
  );
  const analysisDuration = analysis?.durationSec || duration || 1;

  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    height.value = e.nativeEvent.layout.height;
  }, []);

  // Eased "how loud is it right now" target, resynced every time `position`
  // is polled (~4x/sec by expo-audio).
  const amplitude = useSharedValue(0);
  useEffect(() => {
    if (!displayPeaks.length) return;
    const frac = analysisDuration > 0 ? Math.min(Math.max(position / analysisDuration, 0), 1) : 0;
    const idx = Math.round(frac * (displayPeaks.length - 1));
    amplitude.value = withTiming(displayPeaks[idx] ?? 0, {
      duration: EASE_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [position, displayPeaks, analysisDuration]);

  // Decorative clock for the continuous jitter — only advances while
  // playing, so bars freeze (no jitter) on pause/background.
  const clock = useSharedValue(0);
  const frameCallback = useFrameCallback((info) => {
    clock.value += (info.timeSincePreviousFrame ?? 16) / 1000;
  });
  useEffect(() => {
    frameCallback.setActive(isPlaying);
  }, [isPlaying]);

  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const w = width.value;
    const h = height.value;
    if (w <= 0 || h <= 0) return p;
    const slot = w / BAR_COUNT;
    const barW = slot * (1 - GAP_FRAC);
    for (let i = 0; i < BAR_COUNT; i++) {
      const jitter = 1 + JITTER_AMOUNT * Math.sin(clock.value * 3 + i * 0.7);
      const amp = Math.min(Math.max(amplitude.value * MULTIPLIERS[i] * jitter, 0), 1);
      const barH = Math.max(h * (FLOOR + (1 - FLOOR) * amp), 3);
      const x = i * slot + (slot - barW) / 2;
      const y = h - barH;
      p.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, barW, barH), barW * 0.3, barW * 0.3));
    }
    return p;
  });

  if (!analysis) {
    return (
      <View style={styles.center}>
        <View style={styles.fallbackBars}>
          <EqualizerBars playing size={42} color={colors.primary} />
        </View>
        <Text style={styles.centerTitle}>No visualizer data yet</Text>
        <Text style={styles.centerText}>
          Songs downloaded from a link are analyzed automatically. For this file, the app can
          send it to your computer's server to build the loudness curve the visualizer reacts to.
        </Text>
        {analyzeError ? <Text style={styles.errorText}>{analyzeError}</Text> : null}
        <Pressable style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
          {analyzing ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <>
              <Ionicons name="pulse" size={16} color={colors.black} />
              <Text style={styles.analyzeText}>Analyze on server</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.caption}>Visualizer</Text>
      <View style={styles.canvasWrap} onLayout={onLayout}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={path}>
            <LinearGradient start={vec(0, 0)} end={vec(0, 220)} colors={gradientFor(track.id)} />
          </Path>
        </Canvas>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  caption: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  canvasWrap: {
    height: 220,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fallbackBars: {
    marginBottom: spacing.lg,
    opacity: 0.7,
  },
  centerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  centerText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  errorText: {
    color: '#FF9D9D',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    minWidth: 170,
    justifyContent: 'center',
  },
  analyzeText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
});
