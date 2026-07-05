import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

console.log('[DIAG 1] index.ts loaded');
import App from './App';
console.log('[DIAG 2] App.tsx loaded');

import { nowPlayingWidgetTaskHandler } from './src/widget/widgetTaskHandler';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// No-op outside a native Android build (Expo Go / other platforms) — the
// widget's native side that would invoke this handler simply doesn't exist there.
registerWidgetTaskHandler(nowPlayingWidgetTaskHandler);
