import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import type { Track } from '../types';
import { TrackLyrics, fetchLyrics, loadCachedLyrics } from '../lyrics';

type Props = {
  track: Track;
  /** Current playback position in seconds (drives the highlight). */
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
};

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; lyrics: TrackLyrics }
  | { phase: 'error' };

export function LyricsView({ track, position, duration, onSeek }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const listRef = useRef<FlatList>(null);
  const userScrolling = useRef(false);
  const userScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      setState({ phase: 'loading' });
      try {
        // Cached returns instantly; otherwise hits LRCLIB.
        const cached = force ? null : loadCachedLyrics(track.fileName);
        const lyrics = cached ?? (await fetchLyrics(track, duration || null, { force }));
        setState({ phase: 'ready', lyrics });
      } catch {
        setState({ phase: 'error' });
      }
    },
    [track, duration],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const synced = state.phase === 'ready' ? state.lyrics.synced : null;

  /** Index of the line currently being sung. */
  const activeIndex = useMemo(() => {
    if (!synced || synced.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].t <= position + 0.15) idx = i;
      else break;
    }
    return idx;
  }, [synced, position]);

  // Auto-scroll to the active line unless the user is browsing.
  useEffect(() => {
    if (activeIndex < 0 || !synced || userScrolling.current) return;
    listRef.current?.scrollToIndex({
      index: activeIndex,
      viewPosition: 0.4,
      animated: true,
    });
  }, [activeIndex, synced]);

  const markUserScroll = useCallback(() => {
    userScrolling.current = true;
    if (userScrollTimer.current) clearTimeout(userScrollTimer.current);
    userScrollTimer.current = setTimeout(() => {
      userScrolling.current = false;
    }, 4000);
  }, []);

  if (state.phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>Finding lyrics…</Text>
      </View>
    );
  }

  if (state.phase === 'error' || (!state.lyrics.synced && !state.lyrics.plain)) {
    return (
      <View style={styles.center}>
        <Ionicons name="mic-off-outline" size={40} color={colors.textMuted} />
        <Text style={styles.centerTitle}>No lyrics found</Text>
        <Text style={styles.centerText}>
          Lyrics come from LRCLIB and match best when files are named
          "Artist - Title".
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => load(true)}>
          <Ionicons name="refresh" size={15} color={colors.text} />
          <Text style={styles.retryText}>Search again</Text>
        </Pressable>
      </View>
    );
  }

  const { lyrics } = state;

  // Plain-text fallback.
  if (!lyrics.synced) {
    return (
      <ScrollView style={styles.plainScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.plainText}>{lyrics.plain}</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={lyrics.synced}
      keyExtractor={(_, i) => String(i)}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={markUserScroll}
      contentContainerStyle={styles.syncedContent}
      onScrollToIndexFailed={() => {
        // List not measured yet — retry shortly.
        setTimeout(() => {
          if (activeIndex >= 0) {
            listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.4 });
          }
        }, 250);
      }}
      renderItem={({ item, index }) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;
        return (
          <Pressable onPress={() => onSeek(item.t)} hitSlop={4}>
            <Text
              style={[
                styles.line,
                isPast && styles.linePast,
                isActive && styles.lineActive,
              ]}
            >
              {item.line}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  centerText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  retryText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  plainScroll: {
    flex: 1,
  },
  plainText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '600',
  },
  syncedContent: {
    paddingVertical: spacing.xl,
  },
  line: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
  linePast: {
    color: 'rgba(255,255,255,0.28)',
  },
  lineActive: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 29,
  },
});
