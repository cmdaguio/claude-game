const FRAME_SIZE = 1024;
const HOP_SIZE = 256;   // ~5.8ms per frame at 44100 Hz
const MIN_GAP_MS = 180;
const SMOOTHING = 2;
// Fraction of the global peak used as detection threshold.
// Clicks in synthetic tests are ~5000x above background, so 0.05 separates well.
const PEAK_FRACTION = 0.05;

function downmix(buf) {
  const len = buf.length;
  const numCh = buf.numberOfChannels;
  if (numCh === 1) return buf.getChannelData(0);
  const out = new Float32Array(len);
  for (let c = 0; c < numCh; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += ch[i];
  }
  for (let i = 0; i < len; i++) out[i] /= numCh;
  return out;
}

export function detectOnsets(buf) {
  const samples = downmix(buf);
  const sr = buf.sampleRate;
  const numFrames = Math.max(0, Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE));
  if (numFrames < 2) return [];

  // short-time energy
  const energy = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let e = 0;
    const start = f * HOP_SIZE;
    for (let i = 0; i < FRAME_SIZE; i++) {
      const s = samples[start + i];
      e += s * s;
    }
    energy[f] = e;
  }

  // positive spectral flux (half-wave rectified energy difference)
  const flux = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f++) {
    flux[f] = Math.max(0, energy[f] - energy[f - 1]);
  }

  // smooth flux
  const smoothed = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let s = 0, n = 0;
    for (let k = -SMOOTHING; k <= SMOOTHING; k++) {
      const idx = f + k;
      if (idx >= 0 && idx < numFrames) { s += flux[idx]; n++; }
    }
    smoothed[f] = s / n;
  }

  // global max for normalised threshold
  let maxSmoothed = 0;
  for (let f = 0; f < numFrames; f++) {
    if (smoothed[f] > maxSmoothed) maxSmoothed = smoothed[f];
  }
  if (maxSmoothed === 0) return [];

  const absoluteThreshold = maxSmoothed * PEAK_FRACTION;
  const minGapFrames = Math.max(1, Math.ceil((MIN_GAP_MS / 1000) * (sr / HOP_SIZE)));

  // Gather all frames above threshold that are local maxima
  const candidates = [];
  for (let f = 1; f < numFrames - 1; f++) {
    if (smoothed[f] < absoluteThreshold) continue;
    // Allow non-strict equality for plateau peaks (use >= on left side)
    if (smoothed[f] < smoothed[f + 1]) continue; // definitely not a peak
    if (f > 1 && smoothed[f] < smoothed[f - 1]) continue; // definitely not a peak
    candidates.push(f);
  }

  // Non-maximum suppression: keep strongest peak in each min_gap window
  const onsets = [];
  let i = 0;
  while (i < candidates.length) {
    // Find all candidates within min_gap of candidates[i]
    let best = candidates[i];
    let j = i + 1;
    while (j < candidates.length && candidates[j] - candidates[i] < minGapFrames) {
      if (smoothed[candidates[j]] > smoothed[best]) best = candidates[j];
      j++;
    }
    onsets.push(best * HOP_SIZE / sr);
    // Skip all candidates within min_gap of the winner
    while (i < candidates.length && candidates[i] - best < minGapFrames) i++;
  }

  return onsets;
}
