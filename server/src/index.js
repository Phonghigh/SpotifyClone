import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DOWNLOADS_DIR,
  FORMATS,
  detectSource,
  downloadAudio,
  getInfo,
  getSpotifyMeta,
  probeAudio,
  ytdlpAvailable,
} from './downloader.js';
import { analyzeFile } from './analyze.js';

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY;
const ALLOWED_FORMATS = Object.keys(FORMATS);

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

  const format = ALLOWED_FORMATS.includes(req.body?.format) ? req.body.format : 'mp3';
  const id = crypto.randomUUID();
  const job = {
    id,
    url,
    format,
    source: detectSource(url),
    status: 'pending', // pending -> resolving -> downloading -> done | error
    progress: 0,
    title: null,
    artist: null,
    ext: null,
    quality: null,
    analysis: null,
    error: null,
    file: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  processJob(job).catch((err) => {
    job.status = 'error';
    job.error = String(err?.message || err);
    console.error(`[job ${id}] failed:`, job.error);
  });

  res.status(202).json({ id });
});

async function processJob(job) {
  job.status = 'resolving';

  let target = job.url;
  if (job.source === 'spotify') {
    const meta = await getSpotifyMeta(job.url);
    job.title = meta.title;
    job.artist = meta.artist;
    target = `ytsearch1:${[meta.artist, meta.title].filter(Boolean).join(' ')}`;
    console.log(`[job ${job.id}] spotify -> "${target}"`);
  } else {
    const info = await getInfo(job.url);
    job.title = info.title;
    job.artist = info.artist;
  }

  // Inspect the best available source audio (the quality ceiling).
  const probe = await probeAudio(target);
  job.quality = {
    sourceCodec: probe.sourceCodec || null,
    sourceAbrKbps: probe.sourceAbrKbps || null,
    sampleRateHz: probe.sampleRateHz || null,
  };

  job.status = 'downloading';
  const { file, ext, label } = await downloadAudio({
    target,
    jobId: job.id,
    format: job.format,
    onProgress: (p) => {
      job.progress = p;
    },
  });

  // Measure the actual output quality.
  const size = fs.statSync(file).size;
  job.file = file;
  job.ext = ext;
  job.quality.outputFormat = label;
  job.quality.fileSizeBytes = size;
  job.quality.outputBitrateKbps = probe.durationSec
    ? Math.round((size * 8) / probe.durationSec / 1000)
    : null;
  job.quality.durationSec = probe.durationSec || null;

  // Waveform + pitch analysis for the app's contour view (best effort).
  try {
    job.analysis = await analyzeFile(file);
  } catch (err) {
    console.warn(`[job ${job.id}] analysis failed:`, err.message);
  }

  job.progress = 100;
  job.status = 'done';
  console.log(
    `[job ${job.id}] done: ${job.artist ? job.artist + ' - ' : ''}${job.title} ` +
      `[${label}, ~${job.quality.outputBitrateKbps ?? '?'} kbps, ${(size / 1e6).toFixed(1)} MB]`,
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
  res.setHeader('Content-Type', ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(base)}.${ext}`);
  fs.createReadStream(job.file).pipe(res);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(' Spotaclone downloader server');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://<your-LAN-IP>:${PORT}`);
  console.log(`  yt-dlp:  ${ytdlpAvailable() ? 'ready' : 'MISSING (run: npm run setup)'}`);
  console.log(`  formats: ${ALLOWED_FORMATS.join(', ')}`);
  console.log(`  output:  ${DOWNLOADS_DIR}`);
  console.log('========================================');
});
