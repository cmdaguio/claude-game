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
    // Cap DPR at 1 — solid black tiles don't benefit from retina rendering,
    // but on a DPR=3 phone the cost is ~9x. The blue hit line and lane
    // separators look fine at 1x for this UI.
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
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

    // tiles — tiles are sorted by time, so once we see one above the screen
    // (not yet spawned), all later tiles are even further in the future.
    ctx.fillStyle = '#111';
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      if (tile.consumed) continue;
      // Y = hitLineY - (tile.time - t) * FALL_SPEED   (Y grows downward)
      const y = this.hitLineY - (tile.time - t) * FALL_SPEED;
      if (y < -TILE_HEIGHT) break; // future tile not yet spawned; rest are too
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
