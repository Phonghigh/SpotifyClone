/**
 * Spotify-inspired dark theme tokens.
 */
export const colors = {
  background: '#121212',
  surface: '#181818',
  surfaceHighlight: '#282828',
  elevated: '#242424',
  primary: '#1DB954', // Spotify green
  primaryBright: '#1ED760',
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#727272',
  white: '#FFFFFF',
  black: '#000000',
  divider: '#2A2A2A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
};

/**
 * Deterministic gradient pairs used to render colorful artwork tiles for
 * tracks that have no embedded album art. Picked to feel vibrant on dark UI.
 */
export const artworkGradients: [string, string][] = [
  ['#1DB954', '#0D5C2A'],
  ['#E1306C', '#5B1230'],
  ['#7F00FF', '#2B0050'],
  ['#FF8C00', '#5C2E00'],
  ['#2196F3', '#0A2E54'],
  ['#FF3B30', '#5C0E0A'],
  ['#00BCD4', '#003B43'],
  ['#FFD60A', '#5C4D00'],
  ['#FF5E7E', '#52131F'],
  ['#43E97B', '#0E5C32'],
  ['#A18CD1', '#332552'],
  ['#F7971E', '#5C3A00'],
];

/** Pick a stable gradient for a string key (e.g. track id / title). */
export function gradientFor(key: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % artworkGradients.length;
  return artworkGradients[index];
}
