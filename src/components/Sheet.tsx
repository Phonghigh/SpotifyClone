import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LiquidGlass } from './LiquidGlass';
import { glass } from '../liquid-theme';
import { colors, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Extra element rendered right of the title (left of the close button). */
  headerRight?: React.ReactNode;
};

/** Shared Liquid Glass bottom sheet used by all the small modal panels. */
export function Sheet({ visible, onClose, title, children, headerRight }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <LiquidGlass radius={glass.radius.xl} style={styles.sheet} intensity={70}>
          <View style={styles.inner}>
            <View style={styles.grabber} />
            {title != null ? (
              <View style={styles.headerRow}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.headerActions}>
                  {headerRight}
                  <Pressable hitSlop={10} onPress={onClose}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            {children}
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
    maxHeight: '78%',
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
    flex: 1,
    marginRight: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
});
