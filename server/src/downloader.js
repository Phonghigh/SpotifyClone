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

// YouTube's stream URLs are signature-obfuscated with a JS challenge; the
// bundled yt-dlp needs an external JS runtime to solve it or it can only see
// storyboard/thumbnail formats. This host always has Node available (it's
// what runs this server), so use that rather than requiring Deno.
const JS_RUNTIME_ARGS = ['--js-runtimes', 'node'];

/**
 * Some videos are blocked by YouTube's bot-check specifically for this
 * host's (datacenter) IP even with valid cookies — cookies alone don't fix
 * an IP-reputation block. Routing through a proxy (residential/rotating,
 * from any provider) makes requests look like they come from a normal
 * consumer IP instead. Set YTDLP_PROXY to the provider's proxy URL, e.g.
 * "http://user:pass@host:port".
 */
function proxyArgs() {
  return process.env.YTDLP_PROXY ? ['--proxy', process.env.YTDLP_PROXY] : [];
}

/**
 * Output format presets. All start from the BEST available audio stream.
 * - mp3:     LAME V0 VBR (~245 kbps) — universal, great quality. Default.
 * - mp3-320: MP3 320 kbps CBR — biggest MP3 (note: source is usually <=160k).
 * - m4a:     keep the native AAC stream where possible — best fidelity vs the
 *            YouTube source, plays on iOS + Android.
 */
// Embed the video's thumbnail as cover art (converted to JPEG first — mp3's
// ID3 APIC frame and m4a's cover atom don't reliably accept YouTube's native
// WebP thumbnails). Without this, downloaded files carry no artwork at all,
// since the client (src/id3.ts) only ever reads art embedded in the file.
const THUMBNAIL_ARGS = ['--embed-thumbnail', '--convert-thumbnails', 'jpg'];

export const FORMATS = {
  mp3: {
    ext: 'mp3',
    label: 'MP3',
    args: [
      '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      ...THUMBNAIL_ARGS,
    ],
  },
  'mp3-320': {
    ext: 'mp3',
    label: 'MP3 320',
    args: [
      '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '320K',
      ...THUMBNAIL_ARGS,
    ],
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
      ...THUMBNAIL_ARGS,
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

/** Spotify link shape, including the `intl-xx/` locale prefix some links use. */
const SPOTIFY_RE = /spotify\.com\/(?:intl-[\w-]+\/)?(track|episode|playlist|album)\/([A-Za-z0-9]+)/i;

/** YouTube "list=" playlist param — present on /playlist and on /watch?v=...&list=... links. */
const YT_LIST_RE = /[?&]list=([A-Za-z0-9_-]+)/i;

/**
 * Classify a URL as a single track/episode vs. a whole playlist/album, for
 * both Spotify and YouTube. `detectSource` above stays source-only (used for
 * job.source display); this adds the track/playlist/album distinction.
 */
export function classifyLink(url) {
  const sm = url.match(SPOTIFY_RE);
  if (sm) {
    const [, type] = sm;
    const kind = type === 'playlist' ? 'playlist' : type === 'album' ? 'album' : 'track';
    return { source: 'spotify', kind };
  }
  if (/(^|\.)(youtube\.com|youtu\.be)/i.test(url)) {
    return { source: 'youtube', kind: YT_LIST_RE.test(url) ? 'playlist' : 'track' };
  }
  return { source: 'other', kind: 'unknown' };
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
  const m = url.match(SPOTIFY_RE);
  if (!m || (m[1] !== 'track' && m[1] !== 'episode')) {
    const err = new Error('Only Spotify track/episode links are supported here (not playlists/albums).');
    err.permanent = true; // malformed input — retrying won't help
    throw err;
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

/**
 * Read public metadata for a Spotify playlist or album via the same
 * no-auth embed page used by getSpotifyMeta. The embed page's __NEXT_DATA__
 * blob only carries a bounded slice of the tracklist — long playlists/albums
 * are truncated (no pagination without registering real Spotify Web API
 * credentials, which is out of scope here). Callers get `truncated: true`
 * when a declared total is larger than what was parsed.
 */
export async function getSpotifyPlaylistMeta(url) {
  const m = url.match(SPOTIFY_RE);
  if (!m || (m[1] !== 'playlist' && m[1] !== 'album')) {
    throw new Error('Not a Spotify playlist/album link.');
  }
  const [, type, id] = m;

  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Spotaclone/1.0)' },
  });
  if (!res.ok) throw new Error(`Spotify returned HTTP ${res.status}`);
  const html = await res.text();

  const nd = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
  if (!nd) throw new Error('Could not read the Spotify playlist/album data.');
  const data = JSON.parse(nd[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Could not read the Spotify playlist/album data.');

  const name = decodeHtml(entity.name || entity.title || 'Untitled playlist').trim();

  const rawTracks = entity.trackList || entity.tracks?.items || [];
  const tracks = rawTracks
    .map((t) => ({
      title: decodeHtml(t.title || t.name || '').trim(),
      artist: decodeHtml(
        t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a) => a.name).join(', ') : ''),
      ).trim(),
    }))
    .filter((t) => t.title);

  if (!tracks.length) throw new Error('No tracks found in this Spotify playlist/album.');

  const declaredTotal = entity.trackCount ?? entity.totalTracks ?? null;
  const truncated = typeof declaredTotal === 'number' && declaredTotal > tracks.length;

  return { name, tracks, truncated };
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
  const { info } = await getInfoAndProbe(target);
  return info;
}

/**
 * Inspect the BEST available audio stream so we can show its real quality
 * (codec, bitrate, sample rate) — this is the ceiling the source allows.
 */
export async function probeAudio(target) {
  const { probe } = await getInfoAndProbe(target);
  return probe;
}

/**
 * Combines getInfo + probeAudio into a single yt-dlp invocation. Each
 * yt-dlp call (and the Node subprocess it spawns to solve YouTube's JS
 * challenge) has real memory overhead, and both calls hit the same target
 * URL — merging them halves that overhead per job.
 */
export async function getInfoAndProbe(target) {
  try {
    const { stdout } = await ytdlp([
      ...cookieArgs(),
      ...JS_RUNTIME_ARGS,
      ...proxyArgs(),
      '-f',
      'bestaudio/best',
      '--no-playlist',
      '--skip-download',
      '--no-warnings',
      '--print',
      '%(title)s\t%(artist)s\t%(uploader)s\t%(acodec)s\t%(abr)s\t%(asr)s\t%(ext)s\t%(format_note)s\t%(duration)s',
      target,
    ]);
    const [title, artist, uploader, acodec, abr, asr, ext, note, duration] = stdout.trim().split('\t');
    return {
      info: { title: clean(title) || 'Unknown title', artist: clean(artist) || clean(uploader) || '' },
      probe: {
        sourceCodec: clean(acodec),
        sourceAbrKbps: abr ? Math.round(num(abr) ?? 0) || null : null,
        sampleRateHz: num(asr),
        sourceExt: clean(ext),
        sourceNote: clean(note),
        durationSec: num(duration),
      },
    };
  } catch {
    return { info: { title: 'Unknown title', artist: '' }, probe: {} };
  }
}

/**
 * List a YouTube playlist's videos WITHOUT downloading or resolving full
 * per-video metadata (fast) — uses --flat-playlist so yt-dlp only reads the
 * playlist page itself, not each video page. Each listed video is later
 * resolved/downloaded individually through the normal getInfoAndProbe /
 * downloadAudio path (those keep --no-playlist, which is correct there).
 */
export async function getYoutubePlaylistMeta(url) {
  const { stdout } = await ytdlp([
    ...cookieArgs(),
    ...proxyArgs(),
    '--flat-playlist',
    '--dump-single-json',
    '--no-warnings',
    url,
  ]);
  const data = JSON.parse(stdout);
  const name = clean(data.title) || 'Untitled playlist';
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const tracks = entries
    .filter((e) => e && e.id)
    .map((e) => ({
      videoId: e.id,
      title: clean(e.title) || 'Unknown title',
      artist: clean(e.uploader) || clean(e.channel) || '',
    }));
  if (!tracks.length) throw new Error('No videos found in this YouTube playlist.');
  return { name, tracks };
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
      ...JS_RUNTIME_ARGS,
      ...proxyArgs(),
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
