/**
 * Generates the "Music F" app icon assets from an inline SVG mark.
 * Run: npm run generate:icon
 *
 * Keep these hex values in sync with src/theme.ts (`colors`).
 */
const path = require('path');
const sharp = require('sharp');

const THEME_BACKGROUND = '#121212';
const THEME_PRIMARY = '#1DB954';
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

/**
 * The mark: an "F" whose vertical stem doubles as a musical note stem, with
 * a note head at its base — reads as "Music" + "F" in one bold glyph.
 * Built on a 1024x1024 canvas; `inset` shrinks the glyph toward the center
 * (used for the Android adaptive-icon foreground, which gets masked/cropped).
 */
function glyphSvg({ size = 1024, background, fill, inset = 0 } = {}) {
  const s = (1024 - inset * 2) / 1024; // uniform scale factor
  const cx = 512;
  const cy = 512;
  const scalePoint = (x, y) => [cx + (x - cx) * s, cy + (y - cy) * s];

  const stemW = 92 * s;
  const stemX = 400 * s + (cx - 512 * s);
  const stemTop = 190 * s + (cy - 512 * s);
  const stemBottom = 786 * s + (cy - 512 * s);

  const topBarY = stemTop;
  const topBarH = 92 * s;
  const topBarW = 270 * s;

  const midBarY = 448 * s + (cy - 512 * s);
  const midBarH = 84 * s;
  const midBarW = 190 * s;

  const noteCx = stemX + stemW / 2;
  const noteCy = stemBottom - 4 * s;
  const noteR = 88 * s;

  const bg = background
    ? `<rect x="0" y="0" width="1024" height="1024" fill="${background}"/>`
    : '';

  return `
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${bg}
  <g fill="${fill}">
    <rect x="${stemX}" y="${stemTop}" width="${stemW}" height="${stemBottom - stemTop}" rx="${stemW / 2}" />
    <rect x="${stemX}" y="${topBarY}" width="${topBarW}" height="${topBarH}" rx="${topBarH / 2}" />
    <rect x="${stemX}" y="${midBarY}" width="${midBarW}" height="${midBarH}" rx="${midBarH / 2}" />
    <circle cx="${noteCx}" cy="${noteCy}" r="${noteR}" />
  </g>
</svg>`;
}

async function render(svg, size, outFile) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outFile);
  console.log('wrote', path.relative(process.cwd(), outFile));
}

async function main() {
  // Full-color icon on the dark theme background (OS applies its own mask/corners).
  await render(
    glyphSvg({ background: THEME_BACKGROUND, fill: THEME_PRIMARY }),
    1024,
    path.join(ASSETS_DIR, 'icon.png'),
  );

  // Android adaptive icon — foreground (glyph only, inset for the safe zone).
  await render(
    glyphSvg({ fill: THEME_PRIMARY, inset: 180 }),
    512,
    path.join(ASSETS_DIR, 'android-icon-foreground.png'),
  );

  // Android adaptive icon — flat background layer.
  await render(
    `<svg width="512" height="512" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="${THEME_BACKGROUND}"/></svg>`,
    512,
    path.join(ASSETS_DIR, 'android-icon-background.png'),
  );

  // Android 13+ themed monochrome layer — flat white silhouette, transparent bg.
  await render(
    glyphSvg({ fill: '#FFFFFF', inset: 180 }),
    432,
    path.join(ASSETS_DIR, 'android-icon-monochrome.png'),
  );

  // Web favicon.
  await render(
    glyphSvg({ background: THEME_BACKGROUND, fill: THEME_PRIMARY }),
    48,
    path.join(ASSETS_DIR, 'favicon.png'),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
