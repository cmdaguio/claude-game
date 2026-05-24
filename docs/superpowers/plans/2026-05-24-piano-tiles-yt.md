# Piano Tiles × YouTube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first browser Piano Tiles game where pasting a YouTube URL produces a tile chart beat-synced to the song's audio.

**Architecture:** Static single-page app (no backend). Audio fetched via public Piped instance → decoded with Web Audio API → energy-based onset detection produces beat timestamps → canvas-based game loop renders tiles synced to `<audio>` element playback.

**Tech Stack:** Vanilla ES modules, HTML5 Canvas, Web Audio API, Vitest for unit tests. No bundler — `index.html` loads `src/*.js` directly via `<script type="module">`. Hosted on GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-05-24-piano-tiles-yt-design.md`

---

## File Structure

```
index.html               — markup, screens, canvas
style.css                — styling, mobile-first portrait layout
src/audio.js             — parseYouTubeId, fetchYouTubeAudio (Piped + decode)
src/beats.js             — detectOnsets (energy-based onset detection)
src/game.js              — assignLanes, scoreTap, GameLoop class
src/main.js              — state machine, UI wiring
tests/audio.test.js      — parseYouTubeId tests
tests/beats.test.js      — detectOnsets tests (synthetic AudioBuffer fixture)
tests/game.test.js       — assignLanes + scoreTap tests
package.json             — vitest dev dep
vitest.config.js         — minimal config
README.md                — how to run, play, swap proxy
```

Pure functions live next to the module that owns them. `audio.js` owns URL parsing and audio I/O. `beats.js` owns the onset detector. `game.js` owns gameplay logic (lane assignment, hit-test, render loop). `main.js` is the only file that touches the DOM screens — everything else is pure or canvas-only.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vitest.config.js`, `index.html`, `style.css`, `src/main.js`, `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "claude-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
export default {
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
};
```

- [ ] **Step 3: Append to `.gitignore`**

```
node_modules/
```

- [ ] **Step 4: Create minimal `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Piano Tiles × YouTube</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main id="app">
    <section id="screen-idle" class="screen">
      <h1>Piano Tiles × YouTube</h1>
      <input id="url-input" type="url" placeholder="Paste a YouTube URL" autocomplete="off" inputmode="url">
      <button id="start-btn">Start</button>
      <p id="url-error" class="error" hidden></p>
    </section>

    <section id="screen-loading" class="screen" hidden>
      <p id="loading-status">Loading…</p>
      <div class="spinner"></div>
    </section>

    <section id="screen-ready" class="screen" hidden>
      <p id="ready-text">Ready</p>
      <button id="play-btn">Tap to start</button>
    </section>

    <section id="screen-playing" class="screen" hidden>
      <header id="hud">
        <span id="score">0</span>
        <span id="combo">×0</span>
        <span id="lives">♥♥♥</span>
      </header>
      <canvas id="game-canvas"></canvas>
    </section>

    <section id="screen-ended" class="screen" hidden>
      <h2>Game Over</h2>
      <p id="final-score"></p>
      <button id="replay-btn">Play again</button>
      <button id="new-song-btn">New song</button>
    </section>

    <section id="screen-error" class="screen" hidden>
      <h2>Audio source unavailable</h2>
      <p id="error-text"></p>
      <button id="retry-btn">Retry</button>
      <button id="new-song-error-btn">New song</button>
    </section>
  </main>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create minimal `style.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #fafafa; font-family: system-ui, sans-serif; color: #111; }
#app { height: 100%; }
.screen { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 16px; }
.screen[hidden] { display: none; }
h1 { font-size: 1.6rem; margin: 0; text-align: center; }
h2 { margin: 0; }
input[type="url"] { width: 100%; max-width: 360px; padding: 12px 14px; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; }
button { padding: 12px 20px; font-size: 1rem; background: #111; color: white; border: 0; border-radius: 6px; cursor: pointer; }
button:disabled { opacity: 0.5; }
.error { color: #b91c1c; margin: 0; }
.spinner { width: 28px; height: 28px; border: 3px solid #ddd; border-top-color: #111; border-radius: 50%; animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

#screen-playing { padding: 0; }
#hud { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(250,250,250,0.85); font-variant-numeric: tabular-nums; z-index: 10; }
#hud #combo { color: #6b7280; }
#hud #lives { color: #ef4444; letter-spacing: 2px; }
#game-canvas { display: block; width: 100vw; height: 100vh; background: white; touch-action: none; }
```

- [ ] **Step 6: Create stub `src/main.js`**

```js
console.log('Piano Tiles × YouTube — loaded');
```

- [ ] **Step 7: Create minimal `README.md`**

```markdown
# Piano Tiles × YouTube

Paste a YouTube URL, get a Piano Tiles chart synced to its beats.

## Run locally
Open `index.html` in a browser. Or use any static server:
```
python3 -m http.server 8000
```

## Tests
```
npm install
npm test
```

## Known caveats
Audio is fetched from a public Piped instance. These instances occasionally die or get blocked. The error screen lets you retry; you can also edit the `PIPED_INSTANCES` array in `src/audio.js`.
```

- [ ] **Step 8: Install vitest and run smoke test**

Run: `npm install`
Expected: vitest installed, no errors.

Run: `npx vitest run`
Expected: "No test files found" — that's fine for now.

- [ ] **Step 9: Commit**

```bash
git add package.json vitest.config.js .gitignore index.html style.css src/main.js README.md
git commit -m "scaffold: HTML, CSS, vitest, empty modules"
```

---

## Task 2: parseYouTubeId (TDD)

**Files:**
- Create: `src/audio.js`, `tests/audio.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/audio.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseYouTubeId } from '../src/audio.js';

describe('parseYouTubeId', () => {
  it('parses youtube.com/watch?v= URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtu.be short URLs', () => {
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtube.com/shorts URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtube.com/embed URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('ignores trailing query params', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(parseYouTubeId('https://vimeo.com/12345')).toBe(null);
  });

  it('returns null for garbage input', () => {
    expect(parseYouTubeId('not a url')).toBe(null);
    expect(parseYouTubeId('')).toBe(null);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/audio.test.js`
Expected: FAIL — `parseYouTubeId` not exported.

- [ ] **Step 3: Implement parseYouTubeId**

Create `src/audio.js`:

```js
export function parseYouTubeId(url) {
  if (typeof url !== 'string' || !url) return null;
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/audio.test.js`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/audio.js tests/audio.test.js
git commit -m "feat(audio): parseYouTubeId for common URL shapes"
```

---

## Task 3: assignLanes + scoreTap (TDD)

**Files:**
- Create: `src/game.js`, `tests/game.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/game.test.js`:

```js
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
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/game.test.js`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Implement assignLanes and scoreTap**

Create `src/game.js`:

```js
export const LANES = 4;
export const FALL_SPEED = 600; // px/sec
export const HIT_TOLERANCE_MS = 150;
export const TILE_HEIGHT = 80;

export function assignLanes(beats) {
  const lanes = [];
  let prev = -1;
  for (let i = 0; i < beats.length; i++) {
    let lane;
    do {
      lane = Math.floor(Math.random() * LANES);
    } while (lane === prev);
    lanes.push(lane);
    prev = lane;
  }
  return lanes;
}

export function scoreTap(tiles, currentTime, lane) {
  const tol = HIT_TOLERANCE_MS / 1000;
  let best = null;
  let bestDist = Infinity;
  for (const tile of tiles) {
    if (tile.consumed) continue;
    if (tile.lane !== lane) continue;
    const d = Math.abs(tile.time - currentTime);
    if (d <= tol && d < bestDist) {
      best = tile;
      bestDist = d;
    }
  }
  return best ? { hit: true, tile: best } : { hit: false };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/game.test.js`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "feat(game): assignLanes and scoreTap with TDD coverage"
```

---

## Task 4: detectOnsets (TDD)

**Files:**
- Create: `src/beats.js`, `tests/beats.test.js`

The detector accepts a duck-typed AudioBuffer (`getChannelData`, `sampleRate`, `numberOfChannels`, `length`). Tests build a synthetic buffer where energy spikes happen at known timestamps and assert returned onsets land within ±50ms.

- [ ] **Step 1: Write failing tests**

Create `tests/beats.test.js`:

```js
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
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/beats.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement detectOnsets**

Create `src/beats.js`:

```js
const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const MIN_GAP_MS = 180;
const THRESHOLD_MULT = 1.5;
const SMOOTHING = 3;

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

  // positive spectral flux
  const flux = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f++) {
    flux[f] = Math.max(0, energy[f] - energy[f - 1]);
  }

  // smooth
  const smoothed = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let s = 0, n = 0;
    for (let k = -SMOOTHING; k <= SMOOTHING; k++) {
      const idx = f + k;
      if (idx >= 0 && idx < numFrames) { s += flux[idx]; n++; }
    }
    smoothed[f] = s / n;
  }

  // adaptive threshold via local median, peak-pick
  const framesPerSec = sr / HOP_SIZE;
  const windowFrames = Math.max(1, Math.floor(framesPerSec));
  const minGapFrames = Math.max(1, Math.ceil((MIN_GAP_MS / 1000) * framesPerSec));
  const onsets = [];
  let lastOnset = -Infinity;

  for (let f = 1; f < numFrames - 1; f++) {
    if (smoothed[f] <= smoothed[f - 1] || smoothed[f] <= smoothed[f + 1]) continue;

    const lo = Math.max(0, f - windowFrames);
    const hi = Math.min(numFrames, f + windowFrames);
    const slice = smoothed.slice(lo, hi).filter(v => v > 0);
    if (slice.length === 0) continue;
    slice.sort((a, b) => a - b);
    const median = slice[Math.floor(slice.length / 2)];

    if (smoothed[f] > median * THRESHOLD_MULT && f - lastOnset >= minGapFrames) {
      onsets.push(f * HOP_SIZE / sr);
      lastOnset = f;
    }
  }

  return onsets;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/beats.test.js`
Expected: all passed. If the "finds clicks" test is flaky (synthetic noise variance), re-run; if still failing, lower THRESHOLD_MULT to 1.3 and re-test. The synthetic clicks should be detected reliably.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all tests across audio/game/beats pass.

- [ ] **Step 6: Commit**

```bash
git add src/beats.js tests/beats.test.js
git commit -m "feat(beats): energy-based onset detection with synthetic-audio tests"
```

---

## Task 5: fetchYouTubeAudio (no tests — network/Web-Audio-bound)

**Files:**
- Modify: `src/audio.js`

This is an integration boundary (network + Web Audio API). Skip unit tests — exercised by manual play.

- [ ] **Step 1: Append fetchYouTubeAudio to `src/audio.js`**

After the existing `parseYouTubeId` export, add:

```js
export const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.leptons.xyz',
];

export async function fetchYouTubeAudio(videoId, onStatus = () => {}) {
  const errors = [];
  for (const instance of PIPED_INSTANCES) {
    const host = new URL(instance).host;
    try {
      onStatus(`Fetching stream info from ${host}…`);
      const res = await fetch(`${instance}/streams/${videoId}`);
      if (!res.ok) throw new Error(`streams API ${res.status}`);
      const data = await res.json();
      const streams = (data.audioStreams || []).filter(s => (s.mimeType || '').startsWith('audio'));
      if (!streams.length) throw new Error('no audio streams');
      streams.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
      const stream = streams[0];

      onStatus(`Downloading audio…`);
      const audioRes = await fetch(stream.url);
      if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
      const bytes = await audioRes.arrayBuffer();

      onStatus('Decoding audio…');
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const audioBuffer = await ctx.decodeAudioData(bytes.slice(0));
      ctx.close();

      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: stream.mimeType }));
      return { audioBuffer, blobUrl, instance: host };
    } catch (e) {
      errors.push(`${host}: ${e.message}`);
      console.warn(`Piped instance ${host} failed:`, e);
    }
  }
  throw new Error(`All Piped instances failed:\n${errors.join('\n')}`);
}
```

- [ ] **Step 2: Sanity-check the file still parses**

Run: `node --check src/audio.js`
Expected: no output (parses OK).

- [ ] **Step 3: Re-run tests (parseYouTubeId must still pass)**

Run: `npx vitest run tests/audio.test.js`
Expected: still passing.

- [ ] **Step 4: Commit**

```bash
git add src/audio.js
git commit -m "feat(audio): fetchYouTubeAudio via Piped instance fallback chain"
```

---

## Task 6: GameLoop class

**Files:**
- Modify: `src/game.js`

The GameLoop renders tiles to a canvas, listens for pointer/keydown, scores hits, decrements lives on missed tiles. It does NOT touch DOM screens or audio fetch — only canvas + callbacks.

- [ ] **Step 1: Append GameLoop class to `src/game.js`**

After the existing `scoreTap` export, add:

```js
const KEY_TO_LANE = { d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3 };

export class GameLoop {
  constructor(canvas, schedule, audio, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tiles = schedule.map(b => ({ time: b.time, lane: b.lane, consumed: false, missed: false }));
    this.audio = audio;
    this.cb = callbacks; // { onScore, onMiss, onLifeLost, onEnd }
    this.score = 0;
    this.combo = 0;
    this.lives = 3;
    this.running = false;
    this._raf = null;
    this._resize = this._resize.bind(this);
    this._tick = this._tick.bind(this);
    this._onPointer = this._onPointer.bind(this);
    this._onKey = this._onKey.bind(this);
  }

  start() {
    this._resize();
    window.addEventListener('resize', this._resize);
    this.canvas.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('keydown', this._onKey);
    this.running = true;
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('keydown', this._onKey);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
    this.laneWidth = w / LANES;
    this.hitLineY = h - 80;
  }

  _laneFromX(x) {
    return Math.min(LANES - 1, Math.max(0, Math.floor(x / this.laneWidth)));
  }

  _onPointer(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const lane = this._laneFromX(x);
    this._tap(lane);
  }

  _onKey(e) {
    if (!this.running) return;
    const lane = KEY_TO_LANE[e.key];
    if (lane !== undefined) this._tap(lane);
  }

  _tap(lane) {
    const t = this.audio.currentTime;
    const r = scoreTap(this.tiles, t, lane);
    if (r.hit) {
      r.tile.consumed = true;
      this.score += 1;
      this.combo += 1;
      this.cb.onScore?.(this.score, this.combo);
    } else {
      this.combo = 0;
      this.cb.onScore?.(this.score, this.combo);
    }
  }

  _tick() {
    if (!this.running) return;
    const t = this.audio.currentTime;
    const travel = this.hitLineY / FALL_SPEED; // seconds tile takes to fall to hit line
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.width, this.height);

    // lane separators
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * this.laneWidth, 0);
      ctx.lineTo(i * this.laneWidth, this.height);
      ctx.stroke();
    }

    // hit line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.hitLineY);
    ctx.lineTo(this.width, this.hitLineY);
    ctx.stroke();

    // tiles
    ctx.fillStyle = '#111';
    for (const tile of this.tiles) {
      if (tile.consumed) continue;
      // Y = hitLineY - (tile.time - t) * FALL_SPEED   (Y grows downward)
      const y = this.hitLineY - (tile.time - t) * FALL_SPEED;
      if (y < -TILE_HEIGHT) continue;
      if (y > this.height + TILE_HEIGHT) continue;
      const x = tile.lane * this.laneWidth + 4;
      const w = this.laneWidth - 8;
      ctx.fillRect(x, y - TILE_HEIGHT, w, TILE_HEIGHT);

      // missed if past hit line by >150ms
      if (!tile.missed && (t - tile.time) > (HIT_TOLERANCE_MS / 1000)) {
        tile.missed = true;
        this.lives -= 1;
        this.combo = 0;
        this.cb.onLifeLost?.(this.lives);
        this.cb.onScore?.(this.score, this.combo);
        if (this.lives <= 0) {
          this.stop();
          this.cb.onEnd?.({ score: this.score, total: this.tiles.length });
          return;
        }
      }
    }

    // end of song
    if (this.audio.ended || (this.audio.duration && t >= this.audio.duration - 0.05)) {
      this.stop();
      this.cb.onEnd?.({ score: this.score, total: this.tiles.length });
      return;
    }

    this._raf = requestAnimationFrame(this._tick);
  }
}
```

- [ ] **Step 2: Sanity-check syntax**

Run: `node --check src/game.js`
Expected: no output.

- [ ] **Step 3: Re-run tests**

Run: `npx vitest run`
Expected: all still pass (no new tests, but no regression).

- [ ] **Step 4: Commit**

```bash
git add src/game.js
git commit -m "feat(game): GameLoop class — canvas render, input, life tracking"
```

---

## Task 7: main.js state machine

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Replace `src/main.js` with full implementation**

```js
import { parseYouTubeId, fetchYouTubeAudio } from './audio.js';
import { detectOnsets } from './beats.js';
import { assignLanes, GameLoop } from './game.js';

const screens = {
  idle: document.getElementById('screen-idle'),
  loading: document.getElementById('screen-loading'),
  ready: document.getElementById('screen-ready'),
  playing: document.getElementById('screen-playing'),
  ended: document.getElementById('screen-ended'),
  error: document.getElementById('screen-error'),
};

const el = {
  urlInput: document.getElementById('url-input'),
  startBtn: document.getElementById('start-btn'),
  urlError: document.getElementById('url-error'),
  loadingStatus: document.getElementById('loading-status'),
  readyText: document.getElementById('ready-text'),
  playBtn: document.getElementById('play-btn'),
  canvas: document.getElementById('game-canvas'),
  score: document.getElementById('score'),
  combo: document.getElementById('combo'),
  lives: document.getElementById('lives'),
  finalScore: document.getElementById('final-score'),
  replayBtn: document.getElementById('replay-btn'),
  newSongBtn: document.getElementById('new-song-btn'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  newSongErrorBtn: document.getElementById('new-song-error-btn'),
};

let audioEl = null;
let schedule = null;
let game = null;
let lastVideoId = null;

function show(name) {
  for (const k of Object.keys(screens)) screens[k].hidden = (k !== name);
}

function setLives(n) {
  el.lives.textContent = '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, 3 - n));
}

function setScore(score, combo) {
  el.score.textContent = String(score);
  el.combo.textContent = '×' + combo;
}

async function loadVideo(videoId) {
  lastVideoId = videoId;
  show('loading');
  el.loadingStatus.textContent = 'Starting…';
  try {
    const { audioBuffer, blobUrl, instance } = await fetchYouTubeAudio(videoId, msg => {
      el.loadingStatus.textContent = msg;
    });
    el.loadingStatus.textContent = 'Analyzing beats…';
    // yield to paint
    await new Promise(r => setTimeout(r, 16));
    const onsets = detectOnsets(audioBuffer);
    const lanes = assignLanes(onsets);
    schedule = onsets.map((time, i) => ({ time, lane: lanes[i] }));

    audioEl = new Audio(blobUrl);
    audioEl.preload = 'auto';

    if (schedule.length < 20) {
      el.readyText.textContent = `Only ${schedule.length} beats detected — the song may be too quiet or sparse. Tap to play anyway.`;
    } else {
      el.readyText.textContent = `Found ${schedule.length} beats from ${instance}. Tap to play.`;
    }
    show('ready');
  } catch (e) {
    el.errorText.textContent = e.message;
    show('error');
  }
}

el.startBtn.addEventListener('click', () => {
  const url = el.urlInput.value.trim();
  const id = parseYouTubeId(url);
  if (!id) {
    el.urlError.textContent = 'Please paste a valid YouTube URL.';
    el.urlError.hidden = false;
    return;
  }
  el.urlError.hidden = true;
  loadVideo(id);
});

el.playBtn.addEventListener('click', async () => {
  show('playing');
  setScore(0, 0);
  setLives(3);
  await audioEl.play();
  game = new GameLoop(el.canvas, schedule, audioEl, {
    onScore: setScore,
    onLifeLost: setLives,
    onEnd: ({ score, total }) => {
      audioEl.pause();
      el.finalScore.textContent = `${score} / ${total} (${total ? Math.round(score / total * 100) : 0}%)`;
      show('ended');
    },
  });
  game.start();
});

el.replayBtn.addEventListener('click', async () => {
  if (game) game.stop();
  audioEl.currentTime = 0;
  show('ready');
});

el.newSongBtn.addEventListener('click', () => {
  if (game) game.stop();
  if (audioEl) audioEl.pause();
  el.urlInput.value = '';
  show('idle');
});

el.retryBtn.addEventListener('click', () => {
  if (lastVideoId) loadVideo(lastVideoId);
});

el.newSongErrorBtn.addEventListener('click', () => {
  el.urlInput.value = '';
  show('idle');
});

show('idle');
```

- [ ] **Step 2: Sanity-check syntax**

Run: `node --check src/main.js`
Expected: no output.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat(main): state machine wiring all screens to audio + game"
```

---

## Task 8: Polish & README

**Files:**
- Modify: `style.css`, `README.md`

- [ ] **Step 1: Polish `style.css`** — append at the end:

```css
/* HUD readability on mobile, safe-area aware */
#hud {
  padding-top: max(8px, env(safe-area-inset-top));
  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));
  font-size: 1.1rem;
  font-weight: 600;
}

/* Big tap-friendly buttons on mobile */
button { min-height: 48px; min-width: 120px; }

/* Prevent text selection during gameplay */
#screen-playing, #game-canvas { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
```

- [ ] **Step 2: Replace `README.md` with the final version**

````markdown
# Piano Tiles × YouTube

Paste a YouTube URL, get a Piano Tiles chart synced to the song's beats. Mobile-first, no backend, GitHub-Pages ready.

## How it works

1. Paste a YouTube URL
2. The app fetches the audio through a public Piped instance, decodes it, and runs an energy-based onset detector to find beats
3. Each beat becomes a tile in one of 4 lanes
4. Tap (or press **D / F / J / K**) when a tile crosses the blue hit line. 3 misses = game over.

## Run locally

Open `index.html` directly, or serve the directory:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

```bash
npm install
npm test
```

## Known caveats

- **Audio source is flaky.** Public Piped instances occasionally die or get blocked by YouTube. If loading fails, hit "Retry" or edit `PIPED_INSTANCES` in `src/audio.js` to point at a working instance ([list](https://github.com/TeamPiped/Piped/wiki/Instances)).
- **Beat detection is heuristic.** Acoustic tracks with soft onsets produce sparse tiles; dense electronic tracks may produce too many. The detector is tuned for typical pop/rock.
- **Mobile audio requires a tap.** Browsers block audio without a user gesture — the "Tap to play" button doubles as the audio unlock.

## Deploy to GitHub Pages

1. Push to `main`
2. Repo Settings → Pages → Source: `main` / root
3. Visit `https://<username>.github.io/<repo>/`
````

- [ ] **Step 3: Commit**

```bash
git add style.css README.md
git commit -m "polish: safe-area HUD, no text selection, full README"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full test suite one more time**

Run: `npx vitest run`
Expected: all tests pass (parseYouTubeId × 7, assignLanes × 4, scoreTap × 5, detectOnsets × 4 = 20 tests).

- [ ] **Step 2: Sanity-check all source files parse**

Run: `for f in src/*.js; do node --check "$f"; done`
Expected: no errors.

- [ ] **Step 3: Print the final tree**

Run: `ls -la && echo '---' && ls -la src/ tests/`
Expected: all expected files present.

- [ ] **Step 4: Print a manual-test checklist for the user**

Print the following so the user can verify on a real phone:

```
Manual test checklist (open index.html on a phone or in a desktop browser):
1. Paste any YouTube URL → click Start. Should show "Fetching…" then "Analyzing…" then "Tap to play."
2. Tap "Tap to play." Audio should start. Tiles should fall and reach the blue line in time with the beat.
3. Tap a lane when a tile is at the line → score increments, combo grows.
4. Miss 3 tiles → game-over screen shows score X / Y.
5. "Play again" replays the same chart. "New song" returns to URL input.
6. If audio source fails: error screen with Retry / New song.
```

This is the end of the plan. There is no further commit; verification is read-only.

---

## Self-Review Notes

Spec coverage check:
- Goal/scope/architecture: ✓ (Tasks 1, 7)
- 4 lanes, mobile portrait, touch + keyboard: ✓ (Tasks 1, 6)
- Piped fetch with fallback: ✓ (Task 5)
- Energy-based onset detection: ✓ (Task 4)
- AudioBuffer + blob URL playback: ✓ (Task 5)
- assignLanes / scoreTap / lives: ✓ (Tasks 3, 6)
- 3 lives, end-of-song, score screen: ✓ (Task 7)
- Error screen with retry: ✓ (Task 7)
- Vitest tests on pure functions: ✓ (Tasks 2, 3, 4)
- GitHub Pages deploy notes: ✓ (Task 8)

No placeholders, no "TODO" left in the plan. Method names consistent across tasks (`assignLanes`, `scoreTap`, `detectOnsets`, `fetchYouTubeAudio`, `GameLoop`).
