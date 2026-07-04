import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const YTDLP = path.join(ROOT, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
export const DOWNLOADS_DIR = path.join(ROOT, 'downloads');
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

/**
 * YouTube's bot-check ("Sign in to confirm you're not a bot") blocks yt-dlp
 * unless it presents cookies from a logged-in session. Export a Netscape
 * cookies.txt (e.g. via the "Get cookies.txt LOCALLY" browser extension) and
 * either:
 *   - drop it at server/cookies.txt (or point YTDLP_COOKIES_FILE at it), or
 *   - set YTDLP_COOKIES_CONTENT to the file's contents (for hosts like
 *     Render with no persistent disk/browser) — it's written to the cookies
 *     file path once at startup.
 * Locally you can instead set YTDLP_COOKIES_FROM_BROWSER=chrome|firefox|...
 * to read cookies straight from an installed browser.
 */
const COOKIES_FILE = process.env.YTDLP_COOKIES_FILE || path.join(ROOT, 'cookies.txt');
if (process.env.YTDLP_COOKIES_CONTENT && !fs.existsSync(COOKIES_FILE)) {
  // Tolerate the content being pasted as a quoted, \n-escaped .env-style
  // value instead of the file's real (already-multiline) text.
  const content = process.env.YTDLP_COOKIES_CONTENT.trim()
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n');
  fs.writeFileSync(COOKIES_FILE, content);
  console.log(`[cookies] wrote ${COOKIES_FILE} from YTDLP_COOKIES_CONTENT (${content.length} bytes)`);
}
logCookieStatus();

/** Log (once, at startup) whether we have a usable cookies file and what's in it — names only, never values. */
function logCookieStatus() {
  if (!fs.existsSync(COOKIES_FILE)) {
    console.log(
      process.env.YTDLP_COOKIES_FROM_BROWSER
        ? `[cookies] no file at ${COOKIES_FILE}; will use --cookies-from-browser=${process.env.YTDLP_COOKIES_FROM_BROWSER}`
        : `[cookies] no cookies file and no YTDLP_COOKIES_FROM_BROWSER set — yt-dlp will run unauthenticated`,
    );
    return;
  }
  const text = fs.readFileSync(COOKIES_FILE, 'utf8');
  const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
  const names = lines.map((l) => l.split('\t')[5]).filter(Boolean);
  const AUTH_COOKIES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'LOGIN_INFO', '__Secure-1PSID', '__Secure-3PSID'];
  const hasAuth = names.some((n) => AUTH_COOKIES.includes(n));
  console.log(`[cookies] using ${COOKIES_FILE}: ${lines.length} cookie(s) — ${names.join(', ') || '(none parsed)'}`);
  if (!hasAuth) {
    console.warn(
      '[cookies] WARNING: no logged-in session cookie found (e.g. SID/LOGIN_INFO/SAPISID). ' +
        'This cookies.txt looks like an anonymous/guest session — export it again while ' +
        'actually signed into a Google account on youtube.com, or the bot-check will keep failing.',
    );
  }
}

function cookieArgs() {
  if (fs.existsSync(COOKIES_FILE)) return ['--cookies', COOKIES_FILE];
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
    return ['--cookies-from-browser', process.env.YTDLP_COOKIES_FROM_BROWSER];
  }
  return [];
}

/**
 * Output format presets. All start from the BEST available audio stream.
 * - mp3:     LAME V0 VBR (~245 kbps) — universal, great quality. Default.
 * - mp3-320: MP3 320 kbps CBR — biggest MP3 (note: source is usually <=160k).
 * - m4a:     keep the native AAC stream where possible — best fidelity vs the
 *            YouTube source, plays on iOS + Android.
 */
export const FORMATS = {
  mp3: {
    ext: 'mp3',
    label: 'MP3',
    args: ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0'],
  },
  'mp3-320': {
    ext: 'mp3',
    label: 'MP3 320',
    args: ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '320K'],
  },
  m4a: {
    ext: 'm4a',
    label: 'M4A/AAC',
    args: [
      '-f',
      'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best',
      '-x',
      '--audio-format',
      'm4a',
      '--audio-quality',
      '0',
    ],
  },
};

export function ytdlpAvailable() {
  return fs.existsSync(YTDLP);
}

export function detectSource(url) {
  if (/(^|\.)spotify\.com/i.test(url)) return 'spotify';
  if (/(^|\.)(youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  return 'other';
}

/** Run yt-dlp and resolve with collected stdout. */
function ytdlp(args, { onLine } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (buf) => {
      const text = buf.toString();
      stdout += text;
      if (onLine) for (const line of text.split(/\r|\n/)) if (line) onLine(line);
    });
    proc.stderr.on('data', (buf) => {
      stderr += buf.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        const last = stderr.split('\n').map((l) => l.trim()).filter(Boolean).pop();
        reject(new Error(last || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

function clean(v) {
  return v && v !== 'NA' && v !== 'none' ? v : '';
}
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read public metadata for a Spotify track WITHOUT touching the protected
 * audio stream (no DRM is involved). We then look the song up on YouTube.
 */
export async function getSpotifyMeta(url) {
  const m = url.match(/spotify\.com\/(?:intl-[\w-]+\/)?(track|episode)\/([A-Za-z0-9]+)/i);
  if (!m) {
    throw new Error('Only Spotify track/episode links are supported (not playlists/albums).');
  }
  const [, type, id] = m;

  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Spotaclone/1.0)' },
  });
  if (!res.ok) throw new Error(`Spotify returned HTTP ${res.status}`);
  const html = await res.text();

  let title;
  let artist;

  const nd = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
  if (nd) {
    try {
      const data = JSON.parse(nd[1]);
      const entity =
        data?.props?.pageProps?.state?.data?.entity ??
        data?.props?.pageProps?.state?.data ??
        null;
      if (entity) {
        title = entity.title || entity.name;
        if (Array.isArray(entity.artists)) {
          artist = entity.artists.map((a) => a.name).filter(Boolean).join(', ');
        }
        artist = artist || entity.subtitle;
      }
    } catch {
      /* fall through to og tags */
    }
  }

  if (!title) {
    title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1];
  }
  if (!artist) {
    const desc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i)?.[1];
    if (desc) artist = desc.split('·')[0].trim();
  }

  title = decodeHtml(title || '').trim();
  artist = decodeHtml(artist || '').trim();
  if (!title) throw new Error('Could not read the Spotify track title.');
  return { title, artist };
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

/** Get a display title/artist for a direct URL (YouTube or other). */
export async function getInfo(target) {
  try {
    const { stdout } = await ytdlp([
      ...cookieArgs(),
      '--no-playlist',
      '--skip-download',
      '--no-warnings',
      '--print',
      '%(title)s\t%(artist)s\t%(uploader)s',
      target,
    ]);
    const [title, artist, uploader] = stdout.trim().split('\t');
    const cleanArtist = clean(artist) || clean(uploader) || '';
    return { title: clean(title) || 'Unknown title', artist: cleanArtist };
  } catch {
    return { title: 'Unknown title', artist: '' };
  }
}

/**
 * Inspect the BEST available audio stream so we can show its real quality
 * (codec, bitrate, sample rate) — this is the ceiling the source allows.
 */
export async function probeAudio(target) {
  try {
    const { stdout } = await ytdlp([
      ...cookieArgs(),
      '-f',
      'bestaudio/best',
      '--no-playlist',
      '--skip-download',
      '--no-warnings',
      '--print',
      '%(acodec)s\t%(abr)s\t%(asr)s\t%(ext)s\t%(format_note)s\t%(duration)s',
      target,
    ]);
    const [acodec, abr, asr, ext, note, duration] = stdout.trim().split('\t');
    return {
      sourceCodec: clean(acodec),
      sourceAbrKbps: abr ? Math.round(num(abr) ?? 0) || null : null,
      sampleRateHz: num(asr),
      sourceExt: clean(ext),
      sourceNote: clean(note),
      durationSec: num(duration),
    };
  } catch {
    return {};
  }
}

/**
 * Download `target` (a URL or `ytsearch1:...`) as the chosen format into
 * DOWNLOADS_DIR as `<jobId>.<ext>`. Calls onProgress(percent) while running.
 */
export async function downloadAudio({ target, jobId, format = 'mp3', onProgress }) {
  const cfg = FORMATS[format] || FORMATS.mp3;
  const outTemplate = path.join(DOWNLOADS_DIR, `${jobId}.%(ext)s`);
  await ytdlp(
    [
      ...cfg.args,
      ...cookieArgs(),
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      outTemplate,
      target,
    ],
    {
      onLine: (line) => {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m && onProgress) onProgress(Math.min(parseFloat(m[1]), 99));
      },
    },
  );

  const file = path.join(DOWNLOADS_DIR, `${jobId}.${cfg.ext}`);
  if (!fs.existsSync(file)) throw new Error('Download completed but the audio file was not produced.');
  return { file, ext: cfg.ext, label: cfg.label };
}
