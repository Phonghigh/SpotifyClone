/**
 * Liquid Glass design tokens (dark theme variant) — per ~/.claude/skills/liquid-ui.md.
 * Dark-tinted glass at low opacity for the #121212 background.
 */
export const glass = {
  light: 'rgba(255,255,255,0.08)',
  mid: 'rgba(255,255,255,0.14)',
  strong: 'rgba(255,255,255,0.22)',
  border: 'rgba(255,255,255,0.18)',
  blurIntensity: 60,
  blurTint: 'dark' as const,
  specularStart: 'rgba(255,255,255,0.10)',
  specularEnd: 'rgba(255,255,255,0.00)',
  radius: { sm: 16, md: 24, lg: 32, xl: 40 },
  spring: { damping: 15, stiffness: 150, mass: 1 },
};
