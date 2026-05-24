import { describe, it, expect } from 'vitest';
import { detectOnsets } from '../src/beats.js';

function makeBuffer({ sampleRate = 44100, durationSec = 5, clickTimes = [] } = {}) {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  // low background noise
  for (let i = 0; i < length; i++) data[i] = (Math.random() - 0.5) * 0.02;
  // sharp clicks at given timestamps (50ms burst of loud noise)
  for (const t of clickTimes) {
    const start = Math.floor(t * sampleRate);
    const end = Math.min(length, start + Math.floor(sampleRate * 0.05));
    for (let i = start; i < end; i++) data[i] = (Math.random() - 0.5) * 1.5;
  }
  return {
    sampleRate,
    numberOfChannels: 1,
    length,
    duration: durationSec,
    getChannelData: () => data,
  };
}

describe('detectOnsets', () => {
  it('returns an array of timestamps', () => {
    const buf = makeBuffer({ clickTimes: [1, 2, 3] });
    const onsets = detectOnsets(buf);
    expect(Array.isArray(onsets)).toBe(true);
  });

  it('finds clicks at expected times within ±50ms', () => {
    const expected = [0.5, 1.5, 2.5, 3.5];
    const buf = makeBuffer({ clickTimes: expected });
    const onsets = detectOnsets(buf);
    // every expected click should have an onset within 50ms
    for (const t of expected) {
      const closest = onsets.reduce((best, o) =>
        Math.abs(o - t) < Math.abs(best - t) ? o : best, Infinity);
      expect(Math.abs(closest - t)).toBeLessThan(0.05);
    }
  });

  it('returns empty or near-empty for silent input', () => {
    const sampleRate = 44100;
    const length = sampleRate * 3;
    const silent = new Float32Array(length); // all zeros
    const buf = {
      sampleRate, numberOfChannels: 1, length, duration: 3,
      getChannelData: () => silent
    };
    const onsets = detectOnsets(buf);
    expect(onsets.length).toBeLessThan(5);
  });

  it('respects minimum gap (no double-trigger on a single click)', () => {
    const buf = makeBuffer({ clickTimes: [1.0] });
    const onsets = detectOnsets(buf);
    // there should be at most 2 onsets near 1.0 (one start, maybe one at end of burst)
    const near = onsets.filter(o => Math.abs(o - 1.0) < 0.2);
    expect(near.length).toBeLessThanOrEqual(2);
  });
});
