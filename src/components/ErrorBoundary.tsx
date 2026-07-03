import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string | null };

/**
 * Catches render/runtime JS errors anywhere below it and shows them on screen
 * (instead of a silent crash), so problems are visible and screenshot-able.
 * Note: this only catches JavaScript errors — native crashes still require
 * `adb logcat`.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ info: info.componentStack });
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.heading}>⚠️ Something went wrong</Text>
        <Text style={styles.subheading}>
          A JavaScript error crashed the screen. Screenshot this to report it.
        </Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.errorName}>{error.name}: {error.message}</Text>
          {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
          {info ? (
            <>
              <Text style={styles.sectionLabel}>Component stack</Text>
              <Text style={styles.stack}>{info}</Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
  },
  heading: {
    color: '#FF6B6B',
    fontSize: 20,
    fontWeight: '800',
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  errorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  stack: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
