import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';

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

const PORT = process.env.PORT || 4000;
const ALLOWED_FORMATS = Object.keys(FORMATS);

const app = express();
app.use(express.json());

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

app.post('/api/download', (req, res) => {
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

  job.progress = 100;
  job.status = 'done';
  console.log(
    `[job ${job.id}] done: ${job.artist ? job.artist + ' - ' : ''}${job.title} ` +
      `[${label}, ~${job.quality.outputBitrateKbps ?? '?'} kbps, ${(size / 1e6).toFixed(1)} MB]`,
  );
}

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
