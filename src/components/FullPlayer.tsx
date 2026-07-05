console.log('[DIAG 7] FullPlayer loading');
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { colors, gradientFor, gradientWashFor, spacing } from '../theme';
import { glass } from '../liquid-theme';
import { usePlayer } from '../PlayerContext';
import { formatTime } from '../utils';
import { UpNextSheet } from './UpNextSheet';
import { LiquidGlass } from './LiquidGlass';
import { LyricsView } from './LyricsView';
import { ContourView } from './ContourView';
import { BarGridVisualizer } from './BarGridVisualizer';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ART_SIZE = Math.min(SCREEN_W - 96, SCREEN_H * 0.36);
const PAGES = ['art', 'lyrics', 'contour', 'visualizer'] as const;

export function FullPlayer({ visible, onClose }: Props) {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    shuffle,
    repeat,
    togglePlay,
    playNext,
    playPrev,
    seekTo,
    toggleShuffle,
    cycleRepeat,
    queueSource,
  } = usePlayer();

  // Local seek state so the thumb doesn't snap back while dragging.
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const artScale = useRef(new Animated.Value(0.9)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      artScale.setValue(0.9);
      Animated.spring(translateY, {
        toValue: 0,
        damping: glass.spring.damping,
        stiffness: glass.spring.stiffness,
        mass: glass.spring.mass,
        useNativeDriver: true,
      }).start();
      Animated.spring(artScale, {
        toValue: 1,
        damping: 14,
        stiffness: 140,
        mass: 1,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 240,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    setSeeking(false);
  }, [currentTrack?.id]);

  // Play/pause micro-bounce + a soft pulsing ring behind the button while playing.
  useEffect(() => {
    playBtnScale.setValue(0.85);
    Animated.spring(playBtnScale, {
      toValue: 1,
      damping: glass.spring.damping,
      stiffness: glass.spring.stiffness,
      mass: glass.spring.mass,
      useNativeDriver: true,
    }).start();

    pulseLoop.current?.stop();
    if (isPlaying) {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.35);
      pulseLoop.current = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.35, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseOpacity.setValue(0);
    }
    return () => pulseLoop.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  if (!currentTrack || !mounted) return null;

  const wash = gradientWashFor(currentTrack.id);
  const sliderMax = duration > 0 ? duration : 1;
  const sliderValue = seeking ? seekValue : Math.min(position, sliderMax);

  const repeatActive = repeat !== 'off';
  const repeatIcon = repeat === 'one' ? 'repeat-one' : 'repeat';

  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== page && next >= 0 && next < PAGES.length) setPage(next);
  };

  return (
    <Modal visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.root, { transform: [{ translateY }] }]}>
        <LinearGradient
          colors={wash}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable hitSlop={12} onPress={onClose} style={styles.headerBtn}>
              <Ionicons name="chevron-down" size={28} color={colors.text} />
            </Pressable>
            <Text numberOfLines={1} style={styles.headerLabel}>
              {queueSource.type === 'playlist'
                ? `PLAYLIST · ${queueSource.name.toUpperCase()}`
                : 'PLAYING FROM YOUR LIBRARY'}
            </Text>
            <Pressable hitSlop={12} onPress={() => setQueueOpen(true)} style={styles.headerBtn}>
              <Ionicons name="list" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Pager: Artwork | Lyrics | Sound map */}
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPagerScrollEnd}
            style={styles.pager}
            contentContainerStyle={{ width: SCREEN_W * PAGES.length }}
          >
            {/* Page 1 — artwork */}
            <View style={styles.page}>
              <View style={styles.artWrap}>
                <Animated.View style={{ transform: [{ scale: artScale }] }}>
                  {currentTrack.artworkUri ? (
                    <Image
                      source={{ uri: currentTrack.artworkUri }}
                      resizeMode="cover"
                      style={styles.art}
                    />
                  ) : (
                    <LinearGradient
                      colors={gradientFor(currentTrack.id)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.art}
                    >
                      <Ionicons
                        name="musical-notes"
                        size={ART_SIZE * 0.32}
                        color="rgba(255,255,255,0.92)"
                      />
                    </LinearGradient>
                  )}
                </Animated.View>
              </View>
            </View>

            {/* Page 2 — lyrics */}
            <View style={styles.page}>
              <LyricsView
                track={currentTrack}
                position={position}
                duration={duration}
                onSeek={seekTo}
              />
            </View>

            {/* Page 3 — waveform + melodic contour */}
            <View style={styles.page}>
              <ContourView
                track={currentTrack}
                position={position}
                duration={duration}
                onSeek={seekTo}
              />
            </View>

            {/* Page 4 — bar-grid visualizer */}
            <View style={styles.page}>
              <BarGridVisualizer
                track={currentTrack}
                position={position}
                duration={duration}
                isPlaying={isPlaying}
              />
            </View>
          </ScrollView>

          {/* Page dots */}
          <View style={styles.dots}>
            {PAGES.map((key, i) => (
              <View key={key} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>

          {/* Bottom control sheet — Liquid Glass over the gradient backdrop */}
          <View style={styles.controlsSheetWrap}>
            <LinearGradient
              colors={[glass.specularStart, glass.specularEnd]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.controlsRim}
              pointerEvents="none"
            />
            <LiquidGlass radius={glass.radius.lg} style={styles.controlsSheet} intensity={35}>
          {/* Title + artist */}
          <View style={styles.infoRow}>
            <View style={styles.infoText}>
              <Text numberOfLines={1} style={styles.title}>
                {currentTrack.title}
              </Text>
              <Text numberOfLines={1} style={styles.artist}>
                {currentTrack.artist}
              </Text>
            </View>
            <Ionicons name="heart-outline" size={26} color={colors.textSecondary} />
          </View>

          {/* Seek bar */}
          <View style={styles.seekWrap}>
            <SeekBar
              value={sliderValue}
              maximumValue={sliderMax}
              onValueChange={(v) => {
                setSeeking(true);
                setSeekValue(v);
              }}
              onSlidingComplete={(v) => {
                seekTo(v);
                setSeeking(false);
              }}
            />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatTime(sliderValue)}</Text>
              <Text style={styles.time}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <Pressable hitSlop={10} onPress={toggleShuffle}>
              <Ionicons
                name="shuffle"
                size={26}
                color={shuffle ? colors.primary : colors.textSecondary}
              />
            </Pressable>

            <Pressable hitSlop={10} onPress={playPrev}>
              <Ionicons name="play-skip-back" size={36} color={colors.text} />
            </Pressable>

            <View style={styles.playBtnWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pulseRing,
                  { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                ]}
              />
              <Pressable onPress={togglePlay}>
                <Animated.View style={[styles.playBtn, { transform: [{ scale: playBtnScale }] }]}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={36}
                    color={colors.black}
                    style={isPlaying ? undefined : { marginLeft: 4 }}
                  />
                </Animated.View>
              </Pressable>
            </View>

            <Pressable hitSlop={10} onPress={playNext}>
              <Ionicons name="play-skip-forward" size={36} color={colors.text} />
            </Pressable>

            <Pressable hitSlop={10} onPress={cycleRepeat}>
              <MaterialIcons
                name={repeatIcon}
                size={26}
                color={repeatActive ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          </View>
            </LiquidGlass>
          </View>
        </View>

        <UpNextSheet visible={queueOpen} onClose={() => setQueueOpen(false)} />
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pure-JS seek bar (replaces @react-native-community/slider, which is not
// available in Expo Go because it requires a custom native module).
// ---------------------------------------------------------------------------

type SeekBarProps = {
  value: number;
  maximumValue: number;
  onValueChange: (v: number) => void;
  onSlidingComplete: (v: number) => void;
};

function SeekBar({ value, maximumValue, onValueChange, onSlidingComplete }: SeekBarProps) {
  const widthRef = useRef(0);
  const isScrubbing = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const setScrubbingState = (active: boolean) => {
    isScrubbing.current = active;
    setScrubbing(active);
    Animated.spring(thumbScale, {
      toValue: active ? 1.6 : 1,
      damping: 14,
      stiffness: 220,
      mass: 1,
      useNativeDriver: true,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setScrubbingState(true);
        const frac = Math.min(Math.max(evt.nativeEvent.locationX / (widthRef.current || 1), 0), 1);
        onValueChange(frac * maximumValue);
      },
      onPanResponderMove: (evt) => {
        const frac = Math.min(Math.max(evt.nativeEvent.locationX / (widthRef.current || 1), 0), 1);
        onValueChange(frac * maximumValue);
      },
      onPanResponderRelease: (evt) => {
        const frac = Math.min(Math.max(evt.nativeEvent.locationX / (widthRef.current || 1), 0), 1);
        onSlidingComplete(frac * maximumValue);
        setScrubbingState(false);
      },
      onPanResponderTerminate: () => {
        setScrubbingState(false);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const frac = maximumValue > 0 ? Math.min(value / maximumValue, 1) : 0;

  return (
    <View style={seekStyles.root} onLayout={onLayout} {...pan.panHandlers}>
      {scrubbing ? <View style={[seekStyles.glow, { width: `${frac * 100}%` as any }]} /> : null}
      <View style={seekStyles.track}>
        <View style={[seekStyles.filled, { flex: frac }]} />
        <View style={[seekStyles.unfilled, { flex: 1 - frac }]} />
      </View>
      <Animated.View
        style={[
          seekStyles.thumb,
          { left: `${frac * 100}%` as any, transform: [{ scale: thumbScale }] },
        ]}
      />
    </View>
  );
}

const seekStyles = StyleSheet.create({
  root: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 3,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  filled: {
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  unfilled: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  glow: {
    position: 'absolute',
    top: '50%' as any,
    left: 0,
    height: 8,
    marginTop: -4,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.55,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.text,
    marginLeft: -7,
    top: '50%' as any,
    marginTop: -7,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  headerBtn: {
    width: 32,
    alignItems: 'center',
  },
  headerLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  pager: {
    flex: 1,
    marginTop: spacing.md,
  },
  page: {
    width: SCREEN_W,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: colors.text,
  },
  controlsSheetWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  controlsRim: {
    position: 'absolute',
    top: -24,
    left: 12,
    right: 12,
    height: 48,
    borderTopLeftRadius: glass.radius.lg + 12,
    borderTopRightRadius: glass.radius.lg + 12,
  },
  controlsSheet: {
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(18,18,18,0.35)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  infoText: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 3,
  },
  seekWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  playBtnWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
