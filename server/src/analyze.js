/**
 * Audio analysis: waveform energy peaks + experimental melodic pitch contour.
 *
 * - Peaks: mono 8 kHz PCM -> RMS over ~240 buckets, normalized 0..1.
 *   Reliable for any audio; drawn as the waveform in the app.
 * - Pitch: mono 11.025 kHz PCM -> YIN-lite (cumulative mean normalized
 *   difference + parabolic refinement), voicing-gated, median-smoothed,
 *   ~4 points/second, capped to the first 6 minutes. Experimental — noisy
 *   on dense mixes, best on melody-forward tracks.
 */
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const PEAK_BUCKETS = 240;
const PEAKS_SAMPLE_RATE = 8000;
const PEAKS_MAX_SECONDS = 1800; // guard against runaway memory on very long inputs
const PITCH_SAMPLE_RATE = 11025;
const PITCH_MAX_SECONDS = 360;
const PITCH_FRAME = 1024;
const PITCH_POINTS_PER_SEC = 4;
const YIN_THRESHOLD = 0.15;
const FMIN = 70; // Hz
const FMAX = 1000; // Hz

/** Decode a media file to mono s16le PCM via ffmpeg. Returns Int16Array. */
function extractPcm(filePath, sampleRate, maxSeconds = null) {
  return new Promise((resolve, reject) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-i', filePath];
    if (maxSeconds) args.push('-t', String(maxSeconds));
    args.push('-ac', '1', '-ar', String(sampleRate), '-f', 's16le', 'pipe:1');

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', (b) => chunks.push(b));
    proc.stderr.on('data', (b) => {
      stderr += b.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim().split('\n').pop() || `ffmpeg exited ${code}`));
      }
      const buf = Buffer.concat(chunks);
      // Int16Array view needs 2-byte alignment; Buffer.concat gives offset 0.
      resolve(new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2)));
    });
  });
}

/** RMS loudness in ~`buckets` windows, normalized to 0..1 (sqrt-scaled). */
function computePeaks(pcm, buckets = PEAK_BUCKETS) {
  const n = pcm.length;
  if (n === 0) return [];
  const usedBuckets = Math.min(buckets, n);
  const bucketSize = Math.floor(n / usedBuckets);
  const peaks = new Array(usedBuckets);

  let max = 0;
  for (let b = 0; b < usedBuckets; b++) {
    const start = b * bucketSize;
    const end = b === usedBuckets - 1 ? n : start + bucketSize;
    let sum = 0;
    for (let i = start; i < end; i++) {
      const v = pcm[i] / 32768;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - start));
    peaks[b] = rms;
    if (rms > max) max = rms;
  }
  if (max === 0) return peaks.map(() => 0);
  // sqrt scaling lifts quiet parts so the waveform reads better visually.
  return peaks.map((p) => Math.round(Math.sqrt(p / max) * 1000) / 1000);
}

/** YIN-lite pitch detection for one frame. Returns { freq, clarity } | null. */
function yinPitch(pcm, offset, sampleRate) {
  const tauMin = Math.max(2, Math.floor(sampleRate / FMAX));
  const tauMax = Math.min(Math.floor(sampleRate / FMIN), PITCH_FRAME - 1);
  const W = PITCH_FRAME;

  // Difference function.
  const d = new Float64Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const a = pcm[offset + j];
      const b = pcm[offset + j + tau];
      const diff = (a - b) / 32768;
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalized difference.
  const cmnd = new Float64Array(tauMax + 1);
  let running = 0;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * (tau - tauMin + 1)) / running;
  }

  // First dip under the threshold; walk to its local minimum.
  let tauEstimate = -1;
  for (let tau = tauMin + 1; tau <= tauMax; tau++) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate < 0) return null;

  // Parabolic interpolation around the minimum.
  let betterTau = tauEstimate;
  if (tauEstimate > tauMin && tauEstimate < tauMax) {
    const s0 = cmnd[tauEstimate - 1];
    const s1 = cmnd[tauEstimate];
    const s2 = cmnd[tauEstimate + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom;
  }

  return {
    freq: sampleRate / betterTau,
    clarity: 1 - cmnd[tauEstimate],
  };
}

/** Median filter that leaves nulls in place but smooths voiced runs. */
function medianSmooth(values, window = 5) {
  const half = Math.floor(window / 2);
  return values.map((v, i) => {
    if (v == null) return null;
    const neighborhood = [];
    for (let j = i - half; j <= i + half; j++) {
      const n = values[j];
      if (n != null) neighborhood.push(n);
    }
    neighborhood.sort((a, b) => a - b);
    return neighborhood[Math.floor(neighborhood.length / 2)];
  });
}

/** Full pitch track: [{ t, midi|null }] at ~4 points/second. */
function computePitch(pcm, sampleRate) {
  const hop = Math.floor(sampleRate / PITCH_POINTS_PER_SEC);
  const tauMax = Math.min(Math.floor(sampleRate / FMIN), PITCH_FRAME - 1);
  const needed = PITCH_FRAME + tauMax;
  const points = [];

  // Global RMS for the voicing gate.
  let globalSum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768;
    globalSum += v * v;
  }
  const globalRms = Math.sqrt(globalSum / Math.max(pcm.length, 1));

  const midis = [];
  const times = [];
  for (let offset = 0; offset + needed < pcm.length; offset += hop) {
    // Frame energy gate: skip near-silence.
    let sum = 0;
    for (let j = 0; j < PITCH_FRAME; j++) {
      const v = pcm[offset + j] / 32768;
      sum += v * v;
    }
    const frameRms = Math.sqrt(sum / PITCH_FRAME);

    let midi = null;
    if (frameRms > globalRms * 0.35) {
      const res = yinPitch(pcm, offset, sampleRate);
      if (res && res.clarity > 0.6 && res.freq >= FMIN && res.freq <= FMAX) {
        midi = 69 + 12 * Math.log2(res.freq / 440);
      }
    }
    midis.push(midi);
    times.push(offset / sampleRate);
  }

  const smoothed = medianSmooth(midis, 5);
  for (let i = 0; i < smoothed.length; i++) {
    points.push({
      t: Math.round(times[i] * 100) / 100,
      midi: smoothed[i] == null ? null : Math.round(smoothed[i] * 10) / 10,
    });
  }
  return points;
}

/**
 * Analyze an audio file: full-length waveform peaks + capped pitch contour.
 * Returns { peaks, pitch, durationSec }.
 */
export async function analyzeFile(filePath) {
  const peaksPcm = await extractPcm(filePath, PEAKS_SAMPLE_RATE, PEAKS_MAX_SECONDS);
  const durationSec = Math.round((peaksPcm.length / PEAKS_SAMPLE_RATE) * 10) / 10;
  const peaks = computePeaks(peaksPcm);

  let pitch = [];
  try {
    const pitchPcm = await extractPcm(filePath, PITCH_SAMPLE_RATE, PITCH_MAX_SECONDS);
    pitch = computePitch(pitchPcm, PITCH_SAMPLE_RATE);
  } catch (err) {
    console.warn('[analyze] pitch pass failed:', err.message);
  }

  return { peaks, pitch, durationSec };
}
