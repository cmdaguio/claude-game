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
