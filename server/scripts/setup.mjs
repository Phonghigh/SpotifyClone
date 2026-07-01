// Downloads the yt-dlp binary into server/bin for the current platform.
// Runs automatically on `npm install` (postinstall) and via `npm run setup`.
// Never exits non-zero so a transient network failure doesn't break install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.resolve(__dirname, '..', 'bin');
fs.mkdirSync(binDir, { recursive: true });

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const assetName = isWin ? 'yt-dlp.exe' : isMac ? 'yt-dlp_macos' : 'yt-dlp';
const destName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const dest = path.join(binDir, destName);

if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
  console.log(`[setup] yt-dlp already present at ${dest}`);
  process.exit(0);
}

const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;

try {
  console.log(`[setup] Downloading yt-dlp (${assetName}) ...`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await fs.promises.writeFile(dest, Readable.fromWeb(res.body));
  if (!isWin) fs.chmodSync(dest, 0o755);
  const mb = (fs.statSync(dest).size / 1e6).toFixed(1);
  console.log(`[setup] Saved yt-dlp (${mb} MB) to ${dest}`);
} catch (err) {
  console.warn(`[setup] WARNING: could not download yt-dlp: ${err.message}`);
  console.warn('[setup] Re-run "npm run setup" when you have a connection,');
  console.warn(`[setup] or place the binary manually at: ${dest}`);
}
