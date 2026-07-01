import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { PlayerProvider } from './src/PlayerContext';
import { LibraryScreen } from './src/LibraryScreen';
import { colors } from './src/theme';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <PlayerProvider>
        <LibraryScreen />
      </PlayerProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
