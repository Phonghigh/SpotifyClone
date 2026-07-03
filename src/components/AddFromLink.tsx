import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import { glass } from '../liquid-theme';
import { LiquidGlass } from './LiquidGlass';
import { useDownloadQueue } from '../DownloadQueueContext';
import { extractSupportedLink } from '../downloaderClient';
import {
  DownloadFormat,
  getDownloadFormat,
  getServerUrl,
  normalizeServerUrl,
  setDownloadFormat,
  setServerUrl,
} from '../settings';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const FORMAT_OPTIONS: { key: DownloadFormat; label: string; sub: string }[] = [
  { key: 'mp3', label: 'MP3', sub: 'High · universal' },
  { key: 'm4a', label: 'M4A', sub: 'Best fidelity' },
  { key: 'mp3-320', label: 'MP3 320', sub: 'Max bitrate' },
];

export function AddFromLink({ visible, onClose }: Props) {
  const { enqueue } = useDownloadQueue();

  const [url, setUrl] = useState('');
  const [server, setServer] = useState('');
  const [format, setFormat] = useState<DownloadFormat>('mp3');
  const [showServer, setShowServer] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (visible) {
      setUrl('');
      setServer(getServerUrl());
      setFormat(getDownloadFormat());
      setShowServer(false);
      setInvalid(false);
    }
  }, [visible]);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text.trim());
      setInvalid(false);
    }
  }, []);

  const pickFormat = useCallback((f: DownloadFormat) => {
    setFormat(f);
    setDownloadFormat(f);
  }, []);

  const handleAdd = useCallback(() => {
    const link = extractSupportedLink(url) ?? url.trim();
    if (!link || !/^https?:\/\//i.test(link)) {
      setInvalid(true);
      return;
    }
    setServerUrl(normalizeServerUrl(server));
    enqueue(link, format);
    onClose();
  }, [url, server, format, enqueue, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <LiquidGlass radius={glass.radius.xl} style={styles.sheet} intensity={70}>
            <View style={styles.inner}>
              <View style={styles.grabber} />

              <View style={styles.headerRow}>
                <Text style={styles.title}>Add from link</Text>
                <Pressable hitSlop={10} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.subtitle}>
                Paste a YouTube or Spotify song link — it downloads in the queue.
              </Text>

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, invalid && styles.inputInvalid]}
                  value={url}
                  onChangeText={(t) => {
                    setUrl(t);
                    setInvalid(false);
                  }}
                  placeholder="https://…"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  selectionColor={colors.primary}
                />
                <Pressable style={styles.pasteBtn} onPress={handlePaste}>
                  <Ionicons name="clipboard-outline" size={16} color={colors.text} />
                  <Text style={styles.pasteText}>Paste</Text>
                </Pressable>
              </View>
              {invalid ? (
                <Text style={styles.invalidText}>That doesn't look like a valid link.</Text>
              ) : null}

              {/* Quality selector */}
              <Text style={styles.sectionLabel}>Quality</Text>
              <View style={styles.formatRow}>
                {FORMAT_OPTIONS.map((opt) => {
                  const active = format === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => pickFormat(opt.key)}
                      style={[styles.formatChip, active && styles.formatChipActive]}
                    >
                      <Text style={[styles.formatLabel, active && styles.formatLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.formatSub, active && styles.formatSubActive]}>
                        {opt.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helper}>
                Online audio is compressed (~128–160 kbps). "Best" grabs the highest the
                source offers — it can't add quality that isn't there.
              </Text>

              {/* Server settings (collapsible) */}
              <Pressable style={styles.serverToggle} onPress={() => setShowServer((s) => !s)}>
                <Ionicons
                  name={showServer ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.serverToggleText}>Server settings</Text>
              </Pressable>
              {showServer ? (
                <View>
                  <TextInput
                    style={styles.serverInput}
                    value={server}
                    onChangeText={setServer}
                    placeholder="http://192.168.x.x:4000"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.helper}>
                    Address of the downloader server running on your computer.
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.primaryBtn, !url.trim() && styles.primaryBtnDisabled]}
                onPress={handleAdd}
                disabled={!url.trim()}
              >
                <Ionicons name="cloud-download" size={18} color={colors.black} />
                <Text style={styles.primaryBtnText}>Add to queue</Text>
              </Pressable>

              <Text style={styles.legal}>
                Only download content you own or have the right to use.
              </Text>
            </View>
          </LiquidGlass>
        </KeyboardAvoidingView>
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
  },
  inner: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
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
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.text,
    fontSize: 15,
    marginRight: spacing.sm,
  },
  inputInvalid: {
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  invalidText: {
    color: '#FF9D9D',
    fontSize: 12,
    marginTop: spacing.xs,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  pasteText: {
    color: colors.text,
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 13,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formatChip: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  formatChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(29,185,84,0.12)',
  },
  formatLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  formatLabelActive: {
    color: colors.primaryBright,
  },
  formatSub: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  formatSubActive: {
    color: colors.textSecondary,
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  serverToggleText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginLeft: 4,
  },
  serverInput: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
    lineHeight: 15,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
  },
  legal: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
