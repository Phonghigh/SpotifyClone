import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '../theme';
import { glass } from '../liquid-theme';
import type { Track } from '../types';
import { TrackRow } from './TrackRow';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  tracks: Track[];
  currentTrackId?: string | null;
  isPlaying?: boolean;
  onTrackPress: (track: Track) => void;
  onTrackMore: (track: Track) => void;
};

const SCREEN_H = Dimensions.get('window').height;

export function SearchScreen({
  visible,
  onClose,
  tracks,
  currentTrackId,
  isPlaying,
  onTrackPress,
  onTrackMore,
}: Props) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;

  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [artist, setArtist] = useState<string | null>(null);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      Animated.spring(translateY, {
        toValue: 0,
        damping: glass.spring.damping,
        stiffness: glass.spring.stiffness,
        mass: glass.spring.mass,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reset filters each time the screen is freshly opened.
  useEffect(() => {
    if (visible) {
      setQuery('');
      setGenre(null);
      setArtist(null);
    }
  }, [visible]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const t of tracks) if (t.genre) set.add(t.genre);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const artists = useMemo(() => {
    const set = new Set<string>();
    for (const t of tracks) set.add(t.artist);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (genre && t.genre !== genre) return false;
      if (artist && t.artist !== artist) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [tracks, query, genre, artist]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.root, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Search</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Song or artist"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chipsRow}>
          <FilterChip
            icon="pricetag-outline"
            label={genre ?? 'Genre'}
            active={genre != null}
            onPress={() => setGenrePickerOpen(true)}
            onClear={genre != null ? () => setGenre(null) : undefined}
          />
          <FilterChip
            icon="person-outline"
            label={artist ?? 'Artist'}
            active={artist != null}
            onPress={() => setArtistPickerOpen(true)}
            onClear={artist != null ? () => setArtist(null) : undefined}
          />
        </View>

        {results.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {tracks.length === 0 ? 'Your library is empty' : 'No matches'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TrackRow
                track={item}
                isCurrent={item.id === currentTrackId}
                isPlaying={!!isPlaying && item.id === currentTrackId}
                onPress={() => onTrackPress(item)}
                onMore={() => onTrackMore(item)}
              />
            )}
          />
        )}

        <PickerSheet
          visible={genrePickerOpen}
          onClose={() => setGenrePickerOpen(false)}
          title="Filter by genre"
          options={genres}
          onPick={(v) => {
            setGenre(v);
            setGenrePickerOpen(false);
          }}
        />
        <PickerSheet
          visible={artistPickerOpen}
          onClose={() => setArtistPickerOpen(false)}
          title="Filter by artist"
          options={artists}
          onPick={(v) => {
            setArtist(v);
            setArtistPickerOpen(false);
          }}
        />
      </Animated.View>
    </Modal>
  );
}

function FilterChip({
  icon,
  label,
  active,
  onPress,
  onClear,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Ionicons name={icon} size={14} color={active ? colors.black : colors.textSecondary} />
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {onClear ? (
        <Pressable hitSlop={8} onPress={onClear}>
          <Ionicons name="close" size={14} color={active ? colors.black : colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function PickerSheet({
  visible,
  onClose,
  title,
  options,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.length === 0 ? (
        <Text style={styles.pickerEmpty}>Nothing to filter by yet.</Text>
      ) : (
        options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onPick(opt)}
            style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
          >
            <Text style={styles.pickerRowText}>{opt}</Text>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerBtn: {
    width: 32,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    marginLeft: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    maxWidth: 160,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.black,
  },
  listContent: {
    paddingBottom: 120,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  pickerEmpty: {
    color: colors.textSecondary,
    fontSize: 14,
    paddingVertical: spacing.md,
  },
  pickerRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  pickerRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pickerRowText: {
    color: colors.text,
    fontSize: 15.5,
  },
});
