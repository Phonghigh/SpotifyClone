import React from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import { glass } from '../liquid-theme';
import { LiquidGlass } from './LiquidGlass';
import {
  DownloadItem,
  useDownloadQueue,
} from '../DownloadQueueContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STATUS_LABEL: Record<DownloadItem['status'], string> = {
  queued: 'Queued',
  processing: 'Finding audio…',
  downloading: 'Downloading',
  saving: 'Saving…',
  done: 'Done',
  error: 'Failed',
};

const STATUS_COLOR: Record<DownloadItem['status'], string> = {
  queued: colors.textSecondary,
  processing: colors.primaryBright,
  downloading: colors.primaryBright,
  saving: colors.primaryBright,
  done: colors.primary,
  error: '#FF6B6B',
};

function QueueRow({ item }: { item: DownloadItem }) {
  const { retry, remove } = useDownloadQueue();
  const active =
    item.status === 'processing' || item.status === 'downloading' || item.status === 'saving';
  const label =
    [item.artist, item.title].filter(Boolean).join(' – ') || item.url;
  const statusText = item.status === 'error' && item.error ? item.error : STATUS_LABEL[item.status];
  const countSuffix =
    item.batch && item.trackCount
      ? item.status === 'done'
        ? `  ${item.trackCount - (item.failedCount || 0)}/${item.trackCount} tracks${item.failedCount ? ` (${item.failedCount} failed)` : ''}`
        : `  ${item.trackCount} tracks`
      : '';

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={
            item.status === 'done'
              ? 'checkmark-circle'
              : item.status === 'error'
                ? 'alert-circle'
                : item.batch
                  ? 'albums'
                  : 'cloud-download'
          }
          size={22}
          color={STATUS_COLOR[item.status]}
        />
      </View>

      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {label}
        </Text>
        <Text numberOfLines={item.status === 'error' ? 2 : 1} style={[styles.rowStatus, { color: STATUS_COLOR[item.status] }]}>
          {statusText}
          {item.status === 'downloading' && !item.batch ? `  ${Math.round(item.progress)}%` : ''}
          {countSuffix}
        </Text>
        {active ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(item.status === 'downloading' ? item.progress : 4, 4)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>

      {item.status === 'error' ? (
        <Pressable hitSlop={8} onPress={() => retry(item.id)} style={styles.rowBtn}>
          <Ionicons name="refresh" size={20} color={colors.text} />
        </Pressable>
      ) : null}
      {!active ? (
        <Pressable hitSlop={8} onPress={() => remove(item.id)} style={styles.rowBtn}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function DownloadsSheet({ visible, onClose }: Props) {
  const { items, clearCompleted } = useDownloadQueue();
  const hasDone = items.some((i) => i.status === 'done');
  const sorted = [...items].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <LiquidGlass radius={glass.radius.xl} style={styles.sheet} intensity={70}>
          <View style={styles.inner}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Downloads</Text>
              <View style={styles.headerActions}>
                {hasDone ? (
                  <Pressable hitSlop={8} onPress={clearCompleted} style={styles.clearBtn}>
                    <Text style={styles.clearText}>Clear done</Text>
                  </Pressable>
                ) : null}
                <Pressable hitSlop={10} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {sorted.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-done-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyText}>No downloads yet</Text>
                <Text style={styles.emptySub}>
                  Links you add are queued here and processed one by one.
                </Text>
              </View>
            ) : (
              <FlatList
                data={sorted}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => <QueueRow item={item} />}
                style={styles.list}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            )}

            <Text style={styles.footerNote}>
              Downloads run while the app is open (or playing music in the background).
            </Text>
          </View>
        </LiquidGlass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(18,18,18,0.72)',
    maxHeight: '75%',
  },
  inner: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearBtn: {
    marginRight: spacing.lg,
  },
  clearText: {
    color: colors.primaryBright,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    flexGrow: 0,
  },
  sep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 32,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  rowBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  footerNote: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
