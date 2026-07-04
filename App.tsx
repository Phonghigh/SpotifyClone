import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlayerProvider } from './src/PlayerContext';
import { PlaylistsProvider } from './src/PlaylistsContext';
import { DownloadQueueProvider } from './src/DownloadQueueContext';
import { LibraryScreen } from './src/LibraryScreen';
import { ToastHost } from './src/components/Toast';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <PlayerProvider>
          <PlaylistsProvider>
            <DownloadQueueProvider>
              <LibraryScreen />
              <ToastHost />
            </DownloadQueueProvider>
          </PlaylistsProvider>
        </PlayerProvider>
      </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
