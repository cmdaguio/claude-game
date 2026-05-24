import { describe, it, expect } from 'vitest';
import { assignLanes, scoreTap, LANES, HIT_TOLERANCE_MS } from '../src/game.js';

describe('assignLanes', () => {
  it('returns one lane per beat', () => {
    const beats = [0.5, 1.0, 1.5, 2.0, 2.5];
    const lanes = assignLanes(beats);
    expect(lanes).toHaveLength(5);
  });

  it('never produces two consecutive same lanes', () => {
    const beats = Array.from({ length: 500 }, (_, i) => i * 0.5);
    const lanes = assignLanes(beats);
    for (let i = 1; i < lanes.length; i++) {
      expect(lanes[i]).not.toBe(lanes[i - 1]);
    }
  });

  it('only uses valid lane indices', () => {
    const beats = Array.from({ length: 100 }, (_, i) => i);
    const lanes = assignLanes(beats);
    for (const l of lanes) {
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThan(LANES);
    }
  });

  it('returns [] for empty input', () => {
    expect(assignLanes([])).toEqual([]);
  });
});

describe('scoreTap', () => {
  const tiles = [
    { time: 1.0, lane: 0, consumed: false },
    { time: 1.5, lane: 2, consumed: false },
    { time: 2.0, lane: 0, consumed: false },
  ];

  it('hits when within tolerance and lane matches', () => {
    const r = scoreTap(tiles, 1.0, 0);
    expect(r.hit).toBe(true);
    expect(r.tile).toBe(tiles[0]);
  });

  it('hits when tap is slightly early or late within tolerance', () => {
    const earlyMs = HIT_TOLERANCE_MS - 10;
    const lateMs = HIT_TOLERANCE_MS - 10;
    expect(scoreTap(tiles, 1.0 - earlyMs / 1000, 0).hit).toBe(true);
    expect(scoreTap(tiles, 1.0 + lateMs / 1000, 0).hit).toBe(true);
  });

  it('misses when tap is outside tolerance', () => {
    const farMs = HIT_TOLERANCE_MS + 50;
    expect(scoreTap(tiles, 1.0 + farMs / 1000, 0).hit).toBe(false);
  });

  it('misses when lane does not match', () => {
    expect(scoreTap(tiles, 1.0, 1).hit).toBe(false);
  });

  it('ignores consumed tiles', () => {
    const consumed = [{ time: 1.0, lane: 0, consumed: true }];
    expect(scoreTap(consumed, 1.0, 0).hit).toBe(false);
  });
});
