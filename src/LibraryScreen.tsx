console.log('[DIAG 6] LibraryScreen loading');
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from './theme';
import { usePlayer } from './PlayerContext';
import { usePlaylists } from './PlaylistsContext';
import { useDownloadQueue } from './DownloadQueueContext';
import type { Track } from './types';
import { TrackRow } from './components/TrackRow';
import { PressableScale } from './components/PressableScale';
import { MiniPlayer } from './components/MiniPlayer';
import { FullPlayer } from './components/FullPlayer';
import { AddFromLink } from './components/AddFromLink';
import { SearchScreen } from './components/SearchScreen';
import { DownloadsSheet } from './components/DownloadsSheet';
import { ClipboardBanner } from './components/ClipboardBanner';
import { SegmentedTabs } from './components/SegmentedTabs';
import { PlaylistsView } from './components/PlaylistsView';
import { PlaylistDetail } from './components/PlaylistDetail';
import { TrackActionsSheet } from './components/TrackActionsSheet';
import { AddToPlaylistSheet } from './components/AddToPlaylistSheet';
import { SelectionBar } from './components/SelectionBar';
import { FormatPickerSheet } from './components/FormatPickerSheet';
import { toast } from './components/Toast';
import { searchQueryFor } from './downloaderClient';
import { useClipboardLinkDetect } from './hooks/useClipboardLinkDetect';
import { useDeepLinkIntake } from './hooks/useDeepLinkIntake';
import { useWidgetDeepLinks } from './hooks/useWidgetDeepLinks';
import { ShareIntentIntake, shareIntentAvailable } from './hooks/ShareIntentIntake';
import { setLastOfferedClipboardUrl } from './settings';
import type { DownloadFormat } from './settings';

type Tab = 'songs' | 'playlists';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function LibraryScreen() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    isImporting,
    playTrack,
    addSongs,
    removeTrack,
  } = usePlayer();
  const { playlists, removeTrack: removeFromPlaylist } = usePlaylists();
  const { activeCount, enqueue, changeFormat } = useDownloadQueue();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('songs');
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [actionsTrack, setActionsTrack] = useState<Track | null>(null);
  const [actionsFromPlaylist, setActionsFromPlaylist] = useState<string | null>(null);
  const [playlistPickTrack, setPlaylistPickTrack] = useState<Track | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFormatOpen, setBulkFormatOpen] = useState(false);

  // Link intake: clipboard banner (confirm), deep link + share sheet (direct).
  const { offer: clipboardOffer, dismiss: dismissClipboard } = useClipboardLinkDetect();
  useDeepLinkIntake(enqueue);
  useWidgetDeepLinks();

  const acceptClipboard = useCallback(() => {
    if (clipboardOffer) {
      setLastOfferedClipboardUrl(clipboardOffer);
      enqueue(clipboardOffer);
      setDownloadsOpen(true);
    }
    dismissClipboard();
  }, [clipboardOffer, enqueue, dismissClipboard]);

  const handleAdd = useCallback(async () => {
    const { added, skipped } = await addSongs();
    if (added === 0 && skipped > 0) {
      Alert.alert('Import failed', 'Those files could not be imported.');
    }
  }, [addSongs]);

  const openTrackActions = useCallback((track: Track, fromPlaylistId?: string) => {
    setActionsFromPlaylist(fromPlaylistId ?? null);
    setActionsTrack(track);
  }, []);

  const enterSelectionMode = useCallback((id?: string) => {
    setSelectionMode(true);
    setSelectedIds(id ? new Set([id]) : new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === tracks.length ? new Set() : new Set(tracks.map((t) => t.id)),
    );
  }, [tracks]);

  const bulkRemove = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      `Remove ${ids.length} song${ids.length === 1 ? '' : 's'}?`,
      'This deletes the selected songs from this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            ids.forEach((id) => removeTrack(id));
            exitSelectionMode();
            toast(`Removed ${ids.length} song${ids.length === 1 ? '' : 's'}`, 'success');
          },
        },
      ],
    );
  }, [selectedIds, removeTrack, exitSelectionMode]);

  const bulkChangeFormat = useCallback(
    (format: DownloadFormat) => {
      const selected = tracks.filter((t) => selectedIds.has(t.id));
      selected.forEach((t) => {
        // No saved link (downloaded before sourceUrl persistence, or a local
        // import) — search for it automatically instead of skipping it.
        const sourceUrl = t.sourceUrl ?? searchQueryFor(t.title, t.artist);
        changeFormat({ ...t, sourceUrl }, format);
      });
      setBulkFormatOpen(false);
      exitSelectionMode();
    },
    [tracks, selectedIds, changeFormat, exitSelectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <TrackRow
        track={item}
        isCurrent={item.id === currentTrack?.id}
        isPlaying={isPlaying && item.id === currentTrack?.id}
        onPress={() => (selectionMode ? toggleSelect(item.id) : playTrack(item.id))}
        onMore={() => openTrackActions(item)}
        onLongPress={() => (selectionMode ? toggleSelect(item.id) : enterSelectionMode(item.id))}
        selectionMode={selectionMode}
        selected={selectedIds.has(item.id)}
      />
    ),
    [
      currentTrack?.id,
      isPlaying,
      playTrack,
      openTrackActions,
      selectionMode,
      selectedIds,
      toggleSelect,
      enterSelectionMode,
    ],
  );

  const openPlaylist = playlists.find((p) => p.id === openPlaylistId);
  const actionsPlaylist = playlists.find((p) => p.id === actionsFromPlaylist);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + spacing.md }}>
        {selectionMode ? (
          <SelectionBar
            count={selectedIds.size}
            allSelected={tracks.length > 0 && selectedIds.size === tracks.length}
            onCancel={exitSelectionMode}
            onToggleSelectAll={toggleSelectAll}
            onChangeFormat={() => setBulkFormatOpen(true)}
            onRemove={bulkRemove}
          />
        ) : (
          <View style={styles.header}>
            {/* Brand row */}
            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Ionicons name="musical-note" size={20} color={colors.black} />
              </View>
              <View style={styles.brandText}>
                <Text style={styles.wordmark}>MUSIC F</Text>
                <Text style={styles.greeting}>{greeting()}</Text>
              </View>
              <Text style={styles.headerTitle}>Your Library</Text>
            </View>

            {/* Action bar: search pill + select + download + add */}
            <View style={styles.actionBar}>
              <PressableScale
                onPress={() => setSearchOpen(true)}
                style={styles.searchPill}
                hitSlop={4}
              >
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <Text style={styles.searchPillText} numberOfLines={1}>
                  Search your library
                </Text>
              </PressableScale>

              {tracks.length > 0 ? (
                <PressableScale
                  onPress={() => enterSelectionMode()}
                  style={styles.iconBtn}
                  hitSlop={8}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} />
                </PressableScale>
              ) : null}

              <PressableScale onPress={() => setDownloadsOpen(true)} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="cloud-download-outline" size={20} color={colors.text} />
                {activeCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{activeCount}</Text>
                  </View>
                ) : null}
              </PressableScale>

              <PressableScale onPress={() => setLinkOpen(true)} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="link" size={20} color={colors.text} />
              </PressableScale>

              <PressableScale
                onPress={handleAdd}
                disabled={isImporting}
                style={styles.addBtn}
                hitSlop={8}
              >
                {isImporting ? (
                  <ActivityIndicator color={colors.black} size="small" />
                ) : (
                  <>
                    <Ionicons name="add" size={20} color={colors.black} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </>
                )}
              </PressableScale>
            </View>
          </View>
        )}
      </View>

      {/* Body: playlist drill-down or tabbed views */}
      {openPlaylist ? (
        <PlaylistDetail
          playlistId={openPlaylist.id}
          onBack={() => setOpenPlaylistId(null)}
          onTrackMore={(track) => openTrackActions(track, openPlaylist.id)}
        />
      ) : (
        <>
          <SegmentedTabs<Tab>
            options={[
              { key: 'songs', label: 'Songs' },
              { key: 'playlists', label: 'Playlists' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'playlists' ? (
            <PlaylistsView onOpenPlaylist={setOpenPlaylistId} />
          ) : tracks.length === 0 ? (
            <EmptyState onAdd={handleAdd} onLink={() => setLinkOpen(true)} busy={isImporting} />
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(t) => t.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <Text style={styles.count}>
                  {tracks.length} song{tracks.length === 1 ? '' : 's'}
                </Text>
              }
            />
          )}
        </>
      )}

      {/* Mini player */}
      {currentTrack ? (
        <View style={styles.miniWrap}>
          <MiniPlayer onPress={() => setPlayerOpen(true)} />
        </View>
      ) : null}

      <FullPlayer visible={playerOpen} onClose={() => setPlayerOpen(false)} />
      <SearchScreen
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        tracks={tracks}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onTrackPress={(t) => {
          playTrack(t.id);
          setSearchOpen(false);
        }}
        onTrackMore={(t) => {
          setSearchOpen(false);
          openTrackActions(t);
        }}
      />
      <AddFromLink visible={linkOpen} onClose={() => setLinkOpen(false)} />
      <DownloadsSheet visible={downloadsOpen} onClose={() => setDownloadsOpen(false)} />
      <TrackActionsSheet
        track={actionsTrack}
        onClose={() => setActionsTrack(null)}
        onAddToPlaylist={(track) => setPlaylistPickTrack(track)}
        playlistContext={
          actionsPlaylist
            ? {
                id: actionsPlaylist.id,
                name: actionsPlaylist.name,
                removeTrack: (trackId) => removeFromPlaylist(actionsPlaylist.id, trackId),
              }
            : undefined
        }
      />
      <AddToPlaylistSheet
        track={playlistPickTrack}
        onClose={() => setPlaylistPickTrack(null)}
      />
      <FormatPickerSheet
        visible={bulkFormatOpen}
        onClose={() => setBulkFormatOpen(false)}
        title="Change format"
        onPick={bulkChangeFormat}
      />

      {clipboardOffer ? (
        <ClipboardBanner
          url={clipboardOffer}
          onAccept={acceptClipboard}
          onDismiss={dismissClipboard}
        />
      ) : null}
      {shareIntentAvailable ? <ShareIntentIntake onLink={enqueue} /> : null}
    </View>
  );
}

function EmptyState({
  onAdd,
  onLink,
  busy,
}: {
  onAdd: () => void;
  onLink: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="musical-notes" size={56} color={colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>Your library is empty</Text>
      <Text style={styles.emptySubtitle}>
        Import songs from your phone, or paste a YouTube / Spotify link.
      </Text>
      <Pressable
        onPress={onAdd}
        disabled={busy}
        style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.black} />
        ) : (
          <Text style={styles.emptyBtnText}>Add music from phone</Text>
        )}
      </Pressable>
      <Pressable onPress={onLink} style={styles.emptyLinkBtn} hitSlop={8}>
        <Ionicons name="link" size={16} color={colors.primary} />
        <Text style={styles.emptyLinkText}>Paste a link instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    flex: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  wordmark: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 1,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  searchPillText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: spacing.sm,
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.black,
    fontSize: 10,
    fontWeight: '800',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    minWidth: 72,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  addBtnText: {
    color: colors.black,
    fontWeight: '700',
    marginLeft: 2,
  },
  listContent: {
    paddingBottom: 120,
  },
  count: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  miniWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 28 : 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  emptyIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
  },
  emptyBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  emptyLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
