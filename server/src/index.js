import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DOWNLOADS_DIR,
  FORMATS,
  classifyLink,
  downloadAudio,
  getInfoAndProbe,
  getSpotifyMeta,
  getSpotifyPlaylistMeta,
  getYoutubePlaylistMeta,
  probeAudio,
  ytdlpAvailable,
} from './downloader.js';
import { analyzeFile } from './analyze.js';
import { runWithConcurrency } from './concurrency.js';

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY;
const ALLOWED_FORMATS = Object.keys(FORMATS);
// Cap how many tracks of ONE playlist/album batch download concurrently, so
// a large playlist doesn't spawn dozens of simultaneous yt-dlp/ffmpeg
// processes on this host.
const BATCH_CONCURRENCY = Number(process.env.BATCH_CONCURRENCY) || 3;

const app = express();
// Render sits behind a reverse proxy; trust its X-Forwarded-For so
// express-rate-limit keys on the real client IP instead of the proxy's.
app.set('trust proxy', 1);
app.use(express.json());

/** Constant-time string compare (avoids leaking key length/prefix via timing). */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Require a matching API key on every route except the health check, so a
// publicly-hosted instance can't be used by anyone but this app.
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.get('x-api-key');
  if (!API_KEY || !key || !safeEqual(key, API_KEY)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Downloads/analysis are expensive (spawn yt-dlp/ffmpeg, use bandwidth) — cap
// how often one client can kick them off so a leaked key can't run up costs.
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory job store. Jobs are ephemeral; files live in DOWNLOADS_DIR.
/** @type {Map<string, any>} */
const jobs = new Map();

// Neither job entries nor their downloaded files were ever cleaned up —
// on a long album/playlist batch (dozens of tracks, all processed inside one
// continuous request) that grows both the Map and disk usage without bound,
// contributing to OOM on memory-constrained hosts. Sweep periodically instead
// of waiting for the whole batch job to finish, so a big album frees each
// track's memory/disk as it goes.
const JOB_TTL_MS = 10 * 60 * 1000; // long enough for the phone to have polled + fetched the file
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

function sweepOldJobs() {
  const now = Date.now();
  let removed = 0;
  for (const [id, job] of jobs) {
    // Batch-child file entries (registered in processChildTrack) have no
    // .status — they're "ready to serve" the moment they exist, so age alone
    // decides. Top-level jobs (single-track or batch) only once settled.
    const settled = job.status == null || job.status === 'done' || job.status === 'error';
    if (!settled) continue;
    const age = now - (job.createdAt || 0);
    if (age < JOB_TTL_MS) continue;

    if (job.file && fs.existsSync(job.file)) {
      try {
        fs.rmSync(job.file, { force: true });
      } catch (err) {
        console.warn(`[cleanup] failed to remove ${job.file}:`, err.message);
      }
    }
    jobs.delete(id);
    removed++;
  }
  if (removed) {
    console.log(`[cleanup] removed ${removed} stale job(s)/file(s) (rss ${Math.round(process.memoryUsage().rss / 1e6)}MB)`);
  }
}

setInterval(sweepOldJobs, SWEEP_INTERVAL_MS).unref();

// Run downloads one at a time — each spawns yt-dlp/ffmpeg/node child
// processes, and this host's memory budget is too small to run several
// of those pipelines concurrently without risking an OOM kill.
let jobQueue = Promise.resolve();
function enqueueJob(job) {
  const run = job.batch ? processBatchJob : processJob;
  jobQueue = jobQueue.then(() =>
    run(job).catch((err) => {
      job.status = 'error';
      job.error = String(err?.message || err);
      console.error(`[job ${job.id}] failed:`, job.error);
    }),
  );
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'spotaclone-downloader',
    ytdlp: ytdlpAvailable(),
    formats: ALLOWED_FORMATS,
  });
});

app.post('/api/download', downloadLimiter, (req, res) => {
  const url = req.body?.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Provide a "url" in the request body.' });
  }
  if (!ytdlpAvailable()) {
    return res.status(503).json({ error: 'yt-dlp is not installed. Run "npm run setup" in the server folder.' });
  }

  const format = ALLOWED_FORMATS.includes(req.body?.format) ? req.body.format : 'm4a';
  const link = classifyLink(url);
  const isBatch = link.kind === 'playlist' || link.kind === 'album';
  const id = crypto.randomUUID();
  const job = {
    id,
    url,
    format,
    source: link.source,
    kind: link.kind, // 'track' | 'playlist' | 'album' | 'unknown'
    batch: isBatch,
    status: 'pending', // pending -> resolving -> downloading -> done | error
    progress: 0,
    title: null,
    artist: null,
    ext: null,
    quality: null,
    analysis: null,
    error: null,
    file: null,
    attempts: [], // [{ attempt, error, at }] — one entry per failed try before success/giveup
    trackCount: null, // batch jobs only
    truncated: null, // batch jobs only — Spotify embed scrape hit its listing limit
    children: null, // batch jobs only — per-track sub-status
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  enqueueJob(job);

  res.status(202).json({ id, batch: isBatch });
});

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Batch tracks were being requested back-to-back with zero pause between
// them — a dozen+ yt-dlp calls to YouTube in rapid succession reads as
// automated scraping regardless of valid cookies/proxy, and triggers bot-check
// on nearly every track. A human pause between tracks, plus a couple of
// retries on the (often transient) bot-check error, fixes most of these.
const BATCH_TRACK_DELAY_MS = 4000;
const BATCH_CHILD_MAX_ATTEMPTS = 2;

/** Retries the job pipeline on transient failures (e.g. the flaky YouTube
 * bot-check seen on some videos), recording each failed try in job.attempts.
 * Permanent errors (bad input) are marked `.permanent` and skip retries. */
async function processJob(job) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await runJobAttempt(job);
      return;
    } catch (err) {
      lastErr = err;
      job.attempts.push({ attempt, error: String(err?.message || err), at: Date.now() });
      if (err?.permanent || attempt === MAX_ATTEMPTS) break;
      console.warn(`[job ${job.id}] attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying: ${lastErr.message}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastErr;
}

/**
 * Given an already-resolved download target + source-quality probe, run the
 * download and post-download analysis that's identical for a single-track
 * job and for one child track inside a playlist/album batch.
 */
async function downloadResolvedTrack({ id, target, format, probe, onProgress, skipAnalysis = false }) {
  const { file, ext, label } = await downloadAudio({ target, jobId: id, format, onProgress });

  const size = fs.statSync(file).size;
  const quality = {
    sourceCodec: probe.sourceCodec || null,
    sourceAbrKbps: probe.sourceAbrKbps || null,
    sampleRateHz: probe.sampleRateHz || null,
    outputFormat: label,
    fileSizeBytes: size,
    outputBitrateKbps: probe.durationSec ? Math.round((size * 8) / probe.durationSec / 1000) : null,
    durationSec: probe.durationSec || null,
  };

  // Batch (playlist/album) children never surface this to the app, so skip
  // the ffmpeg PCM decode + pitch detection entirely — real memory/CPU cost
  // for no benefit, and this host's RAM budget is already tight.
  let analysis = null;
  if (!skipAnalysis) {
    try {
      analysis = await analyzeFile(file);
    } catch (err) {
      console.warn(`[track ${id}] analysis failed:`, err.message);
    }
  }

  return { file, ext, label, quality, analysis };
}

async function runJobAttempt(job) {
  job.status = 'resolving';

  let target = job.url;
  let probe;
  if (job.source === 'spotify') {
    const meta = await getSpotifyMeta(job.url);
    job.title = meta.title;
    job.artist = meta.artist;
    target = `ytsearch1:${[meta.artist, meta.title].filter(Boolean).join(' ')}`;
    console.log(`[job ${job.id}] spotify -> "${target}"`);
    // Inspect the best available source audio (the quality ceiling).
    probe = await probeAudio(target);
  } else {
    // One yt-dlp call instead of two (getInfo + probeAudio) — same target,
    // halves the per-job process/memory overhead.
    const combined = await getInfoAndProbe(target);
    job.title = combined.info.title;
    job.artist = combined.info.artist;
    probe = combined.probe;
  }

  job.status = 'downloading';
  const result = await downloadResolvedTrack({
    id: job.id,
    target,
    format: job.format,
    probe,
    onProgress: (p) => {
      job.progress = p;
    },
  });

  job.file = result.file;
  job.ext = result.ext;
  job.quality = result.quality;
  job.analysis = result.analysis;
  job.progress = 100;
  job.status = 'done';
  console.log(
    `[job ${job.id}] done: ${job.artist ? job.artist + ' - ' : ''}${job.title} ` +
      `[${result.label}, ~${job.quality.outputBitrateKbps ?? '?'} kbps, ${(result.quality.fileSizeBytes / 1e6).toFixed(1)} MB] ${memLine()}`,
  );
}

/**
 * Resolve a playlist/album's track list, then download each track through
 * the same probe/download/analyze pipeline as a single-track job — throttled
 * to BATCH_CONCURRENCY at a time. A track that fails to resolve/download does
 * NOT fail the batch; only a failure while listing the playlist/album itself
 * (private, deleted, unparseable) does.
 */
async function processBatchJob(job) {
  job.status = 'resolving';

  const meta =
    job.source === 'spotify'
      ? await getSpotifyPlaylistMeta(job.url)
      : await getYoutubePlaylistMeta(job.url);

  job.title = meta.name;
  job.trackCount = meta.tracks.length;
  job.truncated = meta.truncated || false;
  job.children = meta.tracks.map((t, index) => ({
    index,
    title: t.title,
    artist: t.artist || '',
    status: 'pending', // pending -> resolving -> downloading -> done | error
    progress: 0,
    error: null,
    fileJobId: null,
    ext: null,
  }));
  job.status = 'downloading';
  console.log(
    `[job ${job.id}] batch "${job.title}": ${job.trackCount} track(s), concurrency=${BATCH_CONCURRENCY} ${memLine()}`,
  );

  await runWithConcurrency(job.children, BATCH_CONCURRENCY, async (child) => {
    await processChildTrack(job, child, meta.tracks[child.index]);
    // Pace requests to YouTube so a 20+ track album doesn't read as scraping.
    await sleep(BATCH_TRACK_DELAY_MS);
  });

  job.status = 'done';
  job.progress = 100;
  console.log(`[job ${job.id}] batch "${job.title}" done ${memLine()}`);
}

/** One-line RSS snapshot, logged around each batch track so Render's memory
 * chart can be correlated with exactly which track was running at a spike. */
function memLine() {
  const { rss } = process.memoryUsage();
  return `(rss ${Math.round(rss / 1e6)}MB)`;
}

async function processChildTrack(job, child, raw) {
  let lastErr;
  for (let attempt = 1; attempt <= BATCH_CHILD_MAX_ATTEMPTS; attempt++) {
    try {
      await processChildTrackAttempt(job, child, raw);
      return;
    } catch (err) {
      lastErr = err;
      if (err?.permanent || attempt === BATCH_CHILD_MAX_ATTEMPTS) break;
      console.warn(
        `[job ${job.id}] track ${child.index + 1}/${job.trackCount} "${child.title}" ` +
          `attempt ${attempt}/${BATCH_CHILD_MAX_ATTEMPTS} failed, retrying: ${err.message}`,
      );
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  child.status = 'error';
  child.error = String(lastErr?.message || lastErr);
  console.warn(`[job ${job.id}] child ${child.index} (${child.title}) failed: ${child.error} ${memLine()}`);
}

async function processChildTrackAttempt(job, child, raw) {
  child.status = 'resolving';
  console.log(`[job ${job.id}] track ${child.index + 1}/${job.trackCount} "${child.title}" start ${memLine()}`);

  let target;
  let probe;
  if (job.source === 'spotify') {
    target = `ytsearch1:${[child.artist, child.title].filter(Boolean).join(' ')}`;
    probe = await probeAudio(target);
  } else {
    target = `https://www.youtube.com/watch?v=${raw.videoId}`;
    const combined = await getInfoAndProbe(target);
    child.title = combined.info.title || child.title;
    child.artist = combined.info.artist || child.artist;
    probe = combined.probe;
  }

  child.status = 'downloading';
  const fileJobId = crypto.randomUUID();
  const result = await downloadResolvedTrack({
    id: fileJobId,
    target,
    format: job.format,
    probe,
    skipAnalysis: true,
    onProgress: (p) => {
      child.progress = p;
    },
  });

  // Register a minimal entry so GET /api/file/:id can serve this child's
  // file without any changes to that route.
  jobs.set(fileJobId, {
    id: fileJobId,
    file: result.file,
    ext: result.ext,
    title: child.title,
    artist: child.artist,
    createdAt: Date.now(),
  });

  child.fileJobId = fileJobId;
  child.ext = result.ext;
  child.progress = 100;
  child.status = 'done';
  console.log(
    `[job ${job.id}] track ${child.index + 1}/${job.trackCount} "${child.title}" done ` +
      `(${(fs.statSync(result.file).size / 1e6).toFixed(1)} MB) ${memLine()}`,
  );
}

/**
 * Analyze an audio file the phone already has (imported from local storage).
 * Body: raw audio bytes. Response: { peaks, pitch, durationSec }.
 */
app.post(
  '/api/analyze',
  downloadLimiter,
  express.raw({ type: () => true, limit: '200mb' }),
  async (req, res) => {
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Send the raw audio file as the request body.' });
    }
    const tmp = path.join(os.tmpdir(), `spotaclone-analyze-${crypto.randomUUID()}`);
    try {
      fs.writeFileSync(tmp, req.body);
      const analysis = await analyzeFile(tmp);
      res.json(analysis);
    } catch (err) {
      res.status(422).json({ error: `Analysis failed: ${err.message}` });
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  },
);

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.batch && job.children) {
    const total = job.children.length || 1;
    job.progress = Math.round(
      job.children.reduce((sum, c) => sum + (c.progress || 0), 0) / total,
    );
  }
  const { file, ...publicJob } = job;
  res.json(publicJob);
});

app.get('/api/file/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || !job.file || !fs.existsSync(job.file)) {
    return res.status(404).json({ error: 'File not ready.' });
  }
  const base = [job.artist, job.title].filter(Boolean).join(' - ') || job.id;
  const ext = job.ext || 'mp3';
  const filePath = job.file;
  res.setHeader('Content-Type', ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(base)}.${ext}`);
  // The phone copies this into its own storage right away — no reason to
  // keep our copy around. Only on a fully successful send ('finish'), not on
  // a dropped connection, so a flaky network can still retry against the
  // same job before the periodic sweep would otherwise catch it.
  res.on('finish', () => {
    fs.rm(filePath, { force: true }, (err) => {
      if (err) console.warn(`[file] failed to remove ${filePath}:`, err.message);
    });
    job.file = null;
  });
  fs.createReadStream(job.file).pipe(res);
});

/** Non-internal IPv4 addresses this machine has, one per network interface. */
function lanAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) addrs.push({ name, address: net.address });
    }
  }
  return addrs;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(' Spotaclone downloader server');
  console.log(`  Local:   http://localhost:${PORT}`);
  const addrs = lanAddresses();
  if (addrs.length) {
    for (const { name, address } of addrs) {
      console.log(`  Network: http://${address}:${PORT}  (${name})`);
    }
  } else {
    console.log(`  Network: no LAN interface found — phone won't be able to reach this server`);
  }
  console.log(`  yt-dlp:  ${ytdlpAvailable() ? 'ready' : 'MISSING (run: npm run setup)'}`);
  console.log(`  proxy:   ${process.env.YTDLP_PROXY ? 'enabled' : 'none'}`);
  console.log(`  formats: ${ALLOWED_FORMATS.join(', ')}`);
  console.log(`  output:  ${DOWNLOADS_DIR}`);
  console.log('========================================');
});
