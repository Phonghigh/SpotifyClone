import { registerRootComponent } from 'expo';

console.log('[DIAG 1] index.ts loaded');
import App from './App';
console.log('[DIAG 2] App.tsx loaded');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
