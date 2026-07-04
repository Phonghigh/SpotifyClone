import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors, spacing } from '../theme';
import { classifyLink } from '../downloaderClient';

const TOP = (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 52) + 6;
const AUTO_HIDE_MS = 8000;

type Props = {
  url: string;
  onAccept: () => void;
  onDismiss: () => void;
};

/** Slide-in banner offering to download a link found on the clipboard. */
export function ClipboardBanner({ url, onAccept, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
    // Re-arm when a different URL is offered.
  }, [url, translateY, onDismiss]);

  const host = url.replace(/^https?:\/\/(www\.|m\.|music\.)?/i, '').split('/')[0];
  const { kind } = classifyLink(url);
  const title =
    kind === 'playlist'
      ? 'Playlist copied — download it all?'
      : kind === 'album'
        ? 'Album copied — download it all?'
        : 'Link copied — download it?';

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }] }]}>
      <LiquidGlass radius={glass.radius.sm} style={styles.glass} intensity={70}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={/spotify/i.test(host) ? 'musical-notes' : 'logo-youtube'}
              size={18}
              color={colors.primaryBright}
            />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            <Text numberOfLines={1} style={styles.url}>
              {url}
            </Text>
          </View>
          <Pressable style={styles.acceptBtn} onPress={onAccept} hitSlop={6}>
            <Text style={styles.acceptText}>Download</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={10}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </LiquidGlass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: TOP,
    left: spacing.md,
    right: spacing.md,
    zIndex: 900,
    elevation: 900,
  },
  glass: {
    backgroundColor: 'rgba(18,18,18,0.6)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(29,185,84,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700',
  },
  url: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 1,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  acceptText: {
    color: colors.black,
    fontSize: 12.5,
    fontWeight: '800',
  },
  closeBtn: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});
