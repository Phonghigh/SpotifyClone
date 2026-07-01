import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { usePlayer } from '../PlayerContext';
import { importRemoteTrack } from '../library';
import {
  DownloadFormat,
  getDownloadFormat,
  getServerUrl,
  normalizeServerUrl,
  setDownloadFormat,
  setServerUrl,
} from '../settings';
import { formatBytes } from '../utils';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Phase = 'idle' | 'working' | 'done' | 'error';

const FORMAT_OPTIONS: { key: DownloadFormat; label: string; sub: string }[] = [
  { key: 'mp3', label: 'MP3', sub: 'High · universal' },
  { key: 'm4a', label: 'M4A', sub: 'Best fidelity' },
  { key: 'mp3-320', label: 'MP3 320', sub: 'Max bitrate' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** "MP3 · 242 kbps · 48 kHz · 7.8 MB" */
function qualityLine(q: any): string {
  if (!q) return '';
  const parts: string[] = [];
  if (q.outputFormat) parts.push(q.outputFormat);
  if (q.outputBitrateKbps) parts.push(`${q.outputBitrateKbps} kbps`);
  if (q.sampleRateHz) parts.push(`${Math.round(q.sampleRateHz / 1000)} kHz`);
  const size = formatBytes(q.fileSizeBytes);
  if (size) parts.push(size);
  return parts.join('  ·  ');
}

/** "source: aac 388 kbps" */
function sourceLine(q: any): string {
  if (!q || (!q.sourceCodec && !q.sourceAbrKbps)) return '';
  const codec = String(q.sourceCodec || '').replace(/^mp4a.*/i, 'aac').split('.')[0] || 'source';
  const abr = q.sourceAbrKbps ? ` ${q.sourceAbrKbps} kbps` : '';
  return `source: ${codec}${abr}`;
}

export function AddFromLink({ visible, onClose }: Props) {
  const { reloadLibrary } = usePlayer();

  const [url, setUrl] = useState('');
  const [server, setServer] = useState('');
  const [format, setFormat] = useState<DownloadFormat>('mp3');
  const [showServer, setShowServer] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [resultLabel, setResultLabel] = useState('');
  const [resultQuality, setResultQuality] = useState('');
  const [resultSource, setResultSource] = useState('');

  const cancelled = useRef(false);

  useEffect(() => {
    if (visible) {
      cancelled.current = false;
      setUrl('');
      setServer(getServerUrl());
      setFormat(getDownloadFormat());
      setShowServer(false);
      setPhase('idle');
      setStatusText('');
      setProgress(0);
      setResultLabel('');
      setResultQuality('');
      setResultSource('');
    } else {
      cancelled.current = true;
    }
  }, [visible]);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text.trim());
  }, []);

  const pickFormat = useCallback((f: DownloadFormat) => {
    setFormat(f);
    setDownloadFormat(f);
  }, []);

  const fail = useCallback((message: string) => {
    if (cancelled.current) return;
    setPhase('error');
    setStatusText(message);
  }, []);

  const start = useCallback(async () => {
    const link = url.trim();
    if (!link) return;

    const base = normalizeServerUrl(server);
    setServerUrl(base);
    cancelled.current = false;
    setPhase('working');
    setProgress(0);
    setStatusText('Connecting to server…');

    let id: string;
    try {
      const res = await fetchWithTimeout(`${base}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, format }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
      id = data.id;
      if (!id) throw new Error('Server did not return a job id.');
    } catch (err: any) {
      if (err?.name === 'AbortError' || /network/i.test(String(err?.message))) {
        return fail(
          `Can't reach the server at ${base}. Make sure it's running ("npm start" in the server folder) and on the same Wi-Fi.`,
        );
      }
      return fail(String(err?.message || err));
    }

    for (let i = 0; i < 300 && !cancelled.current; i++) {
      await sleep(800);
      if (cancelled.current) return;

      let job: any;
      try {
        const res = await fetchWithTimeout(`${base}/api/jobs/${id}`);
        job = await res.json();
      } catch {
        continue;
      }

      if (job.status === 'error') return fail(job.error || 'Download failed.');

      if (job.status === 'resolving' || job.status === 'pending') {
        setStatusText('Finding the best audio…');
      } else if (job.status === 'downloading') {
        setProgress(job.progress || 0);
        setStatusText(job.title ? `Downloading: ${job.title}` : 'Downloading…');
      } else if (job.status === 'done') {
        setProgress(100);
        setStatusText('Saving to your library…');
        try {
          await importRemoteTrack({
            fileUrl: `${base}/api/file/${id}`,
            title: job.title || 'Unknown title',
            artist: job.artist || '',
            ext: job.ext || 'mp3',
          });
          reloadLibrary();
          if (cancelled.current) return;
          setPhase('done');
          setResultLabel([job.artist, job.title].filter(Boolean).join(' – ') || 'Track added');
          setResultQuality(qualityLine(job.quality));
          setResultSource(sourceLine(job.quality));
        } catch (err: any) {
          return fail(`Saved on server but couldn't download to phone: ${err?.message || err}`);
        }
        return;
      }
    }

    if (!cancelled.current) fail('Timed out waiting for the download.');
  }, [url, server, format, fail, reloadLibrary]);

  const busy = phase === 'working';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={busy ? undefined : onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.headerRow}>
              <Text style={styles.title}>Add from link</Text>
              <Pressable hitSlop={10} onPress={onClose} disabled={busy}>
                <Ionicons name="close" size={24} color={busy ? colors.textMuted : colors.text} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>Paste a YouTube or Spotify song link</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!busy}
                selectionColor={colors.primary}
              />
              <Pressable style={styles.pasteBtn} onPress={handlePaste} disabled={busy}>
                <Ionicons name="clipboard-outline" size={16} color={colors.text} />
                <Text style={styles.pasteText}>Paste</Text>
              </Pressable>
            </View>

            {/* Quality selector */}
            <Text style={styles.sectionLabel}>Quality</Text>
            <View style={styles.formatRow}>
              {FORMAT_OPTIONS.map((opt) => {
                const active = format === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => pickFormat(opt.key)}
                    disabled={busy}
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
              Online audio is compressed (~128–160 kbps). “Best” grabs the highest the
              source offers — it can’t add quality that isn’t there.
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
                  editable={!busy}
                />
                <Text style={styles.helper}>
                  Address of the downloader server running on your computer.
                </Text>
              </View>
            ) : null}

            {/* Status / progress */}
            {phase === 'working' ? (
              <View style={styles.statusBox}>
                <View style={styles.statusHeader}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.statusText} numberOfLines={1}>
                    {statusText}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(progress, 3)}%` }]} />
                </View>
              </View>
            ) : null}
            {phase === 'done' ? (
              <View style={[styles.statusBox, styles.doneBox]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <View style={styles.doneTextWrap}>
                  <Text style={styles.doneText} numberOfLines={2}>
                    {resultLabel}
                  </Text>
                  {resultQuality ? <Text style={styles.qualityText}>{resultQuality}</Text> : null}
                  {resultSource ? <Text style={styles.sourceText}>{resultSource}</Text> : null}
                </View>
              </View>
            ) : null}
            {phase === 'error' ? (
              <View style={[styles.statusBox, styles.errorBox]}>
                <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
                <Text style={styles.errorText}>{statusText}</Text>
              </View>
            ) : null}

            {/* Primary action */}
            {phase === 'done' ? (
              <Pressable style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryBtn, (!url.trim() || busy) && styles.primaryBtnDisabled]}
                onPress={start}
                disabled={!url.trim() || busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.black} />
                ) : (
                  <>
                    <Ionicons name="cloud-download" size={18} color={colors.black} />
                    <Text style={styles.primaryBtnText}>
                      {phase === 'error' ? 'Try again' : 'Download'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            <Text style={styles.legal}>
              Only download content you own or have the right to use.
            </Text>
          </View>
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
    backgroundColor: colors.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
  statusBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  doneTextWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  doneText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  qualityText: {
    color: colors.primaryBright,
    fontSize: 12,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  sourceText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  errorText: {
    color: '#FF9D9D',
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
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
