console.log('[DIAG 8] ContourView loading (react-native-svg)');
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polyline, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import type { Track } from '../types';
import {
  TrackAnalysis,
  analyzeRemoteTrack,
  loadAnalysis,
} from '../analysis';
import { EqualizerBars } from './EqualizerBars';
import { formatTime } from '../utils';

type Props = {
  track: Track;
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
};

const BAR_COUNT = 96;
const WAVE_HEIGHT = 180;
const PITCH_HEIGHT = 90;

/** Downsample peaks to the number of bars we render. */
function resample(peaks: number[], count: number): number[] {
  if (peaks.length === 0) return [];
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i / count) * peaks.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / count) * peaks.length));
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j]);
    out[i] = max;
  }
  return out;
}

export function ContourView({ track, position, duration, onSeek }: Props) {
  const [analysis, setAnalysis] = useState<TrackAnalysis | null>(() =>
    loadAnalysis(track.fileName),
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  // Refs so the PanResponder (created once) reads fresh values.
  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const [scrubX, setScrubX] = useState<number | null>(null);
  const scrubXRef = useRef<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Claim the gesture so the surrounding pager doesn't swipe.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        scrubXRef.current = evt.nativeEvent.locationX;
        setScrubX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        scrubXRef.current = evt.nativeEvent.locationX;
        setScrubX(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        const w = widthRef.current;
        const x = scrubXRef.current;
        if (w > 0 && x != null && durationRef.current > 0) {
          const frac = Math.min(Math.max(x / w, 0), 1);
          onSeekRef.current(frac * durationRef.current);
        }
        scrubXRef.current = null;
        setScrubX(null);
      },
      onPanResponderTerminate: () => {
        scrubXRef.current = null;
        setScrubX(null);
      },
    }),
  ).current;

  const bars = useMemo(
    () => (analysis ? resample(analysis.peaks, BAR_COUNT) : []),
    [analysis],
  );

  const analysisDuration = analysis?.durationSec || duration || 1;

  /** Pitch polyline points scaled into the pitch lane. */
  const pitchPoints = useMemo(() => {
    const pitch = analysis?.pitch?.filter((p) => p.midi != null) as
      | { t: number; midi: number }[]
      | undefined;
    if (!pitch || pitch.length < 3 || width === 0) return null;
    const midis = pitch.map((p) => p.midi);
    const lo = Math.min(...midis) - 2;
    const hi = Math.max(...midis) + 2;
    const span = Math.max(hi - lo, 1);
    return pitch
      .map((p) => {
        const x = (p.t / analysisDuration) * width;
        const y = PITCH_HEIGHT - ((p.midi - lo) / span) * PITCH_HEIGHT;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [analysis, width, analysisDuration]);

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

  // ---- No analysis yet: offer server analysis -------------------------
  if (!analysis) {
    return (
      <View style={styles.center}>
        <View style={styles.fallbackBars}>
          <EqualizerBars playing size={42} color={colors.primary} />
        </View>
        <Text style={styles.centerTitle}>No sound map yet</Text>
        <Text style={styles.centerText}>
          Songs downloaded from a link are analyzed automatically. For this
          file, the app can send it to your computer's server to build the
          waveform and melody contour.
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

  // ---- Waveform + pitch ------------------------------------------------
  const playedFrac =
    scrubX != null && width > 0
      ? Math.min(Math.max(scrubX / width, 0), 1)
      : duration > 0
        ? Math.min(position / duration, 1)
        : 0;
  const playedBars = Math.round(playedFrac * bars.length);
  const barWidth = width > 0 ? width / bars.length : 0;
  const previewTime = playedFrac * (duration || analysisDuration);
  const hasPitch = pitchPoints != null;

  return (
    <View style={styles.root}>
      <Text style={styles.caption}>
        {scrubX != null ? `Seek to ${formatTime(previewTime)}` : 'Sound map'}
      </Text>

      <View onLayout={onLayout} style={styles.waveWrap} {...pan.panHandlers}>
        {width > 0 ? (
          <Svg width={width} height={WAVE_HEIGHT}>
            {bars.map((v, i) => {
              const h = Math.max(v * (WAVE_HEIGHT - 8), 2);
              const x = i * barWidth;
              const y = (WAVE_HEIGHT - h) / 2;
              return (
                <Rect
                  key={i}
                  x={x + barWidth * 0.15}
                  y={y}
                  width={barWidth * 0.7}
                  height={h}
                  rx={barWidth * 0.3}
                  fill={i < playedBars ? colors.primary : 'rgba(255,255,255,0.28)'}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>

      {hasPitch ? (
        <>
          <View style={styles.pitchHeader}>
            <Text style={styles.pitchLabel}>MELODIC CONTOUR</Text>
            <Text style={styles.pitchBadge}>experimental</Text>
          </View>
          <View style={styles.pitchWrap}>
            {width > 0 ? (
              <Svg width={width} height={PITCH_HEIGHT}>
                <Polyline
                  points={pitchPoints}
                  fill="none"
                  stroke={colors.primaryBright}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  opacity={0.9}
                />
                {/* progress cursor */}
                <Rect
                  x={Math.max(playedFrac * width - 0.75, 0)}
                  y={0}
                  width={1.5}
                  height={PITCH_HEIGHT}
                  fill="rgba(255,255,255,0.7)"
                />
              </Svg>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.noPitch}>
          No clear melody detected — the pitch tracker works best on
          melody-forward songs.
        </Text>
      )}

      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.timeHint}>drag the waveform to seek</Text>
        <Text style={styles.time}>{formatTime(duration || analysisDuration)}</Text>
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
  waveWrap: {
    height: WAVE_HEIGHT,
    justifyContent: 'center',
  },
  pitchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  pitchLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pitchBadge: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontStyle: 'italic',
    marginLeft: spacing.sm,
  },
  pitchWrap: {
    height: PITCH_HEIGHT,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  noPitch: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  timeHint: {
    color: colors.textMuted,
    fontSize: 10.5,
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
