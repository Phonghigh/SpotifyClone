import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { colors, gradientFor, spacing } from '../theme';
import { usePlayer } from '../PlayerContext';
import { formatTime } from '../utils';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const { width, height } = Dimensions.get('window');
const ART_SIZE = Math.min(width - 64, height * 0.42);

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
  } = usePlayer();

  // Local seek state so the thumb doesn't snap back while dragging.
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    setSeeking(false);
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const [gradientTop] = gradientFor(currentTrack.id);
  const sliderMax = duration > 0 ? duration : 1;
  const sliderValue = seeking ? seekValue : Math.min(position, sliderMax);

  const repeatActive = repeat !== 'off';
  const repeatIcon = repeat === 'one' ? 'repeat-one' : 'repeat';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <LinearGradient
          colors={[gradientTop, colors.background, colors.background]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable hitSlop={12} onPress={onClose} style={styles.headerBtn}>
              <Ionicons name="chevron-down" size={28} color={colors.text} />
            </Pressable>
            <Text style={styles.headerLabel}>PLAYING FROM YOUR LIBRARY</Text>
            <View style={styles.headerBtn} />
          </View>

          {/* Artwork */}
          <View style={styles.artWrap}>
            <LinearGradient
              colors={gradientFor(currentTrack.id)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.art}
            >
              <Ionicons name="musical-notes" size={ART_SIZE * 0.32} color="rgba(255,255,255,0.92)" />
            </LinearGradient>
          </View>

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
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={sliderMax}
              value={sliderValue}
              minimumTrackTintColor={colors.text}
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor={colors.text}
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

            <Pressable onPress={togglePlay} style={styles.playBtn}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={36}
                color={colors.black}
                style={isPlaying ? undefined : { marginLeft: 4 }}
              />
            </Pressable>

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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  artWrap: {
    flex: 1,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  infoText: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  seekWrap: {
    marginTop: spacing.lg,
  },
  slider: {
    width: '100%',
    height: 36,
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
    marginTop: spacing.xl,
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
