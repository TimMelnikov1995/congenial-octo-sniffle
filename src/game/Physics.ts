import type { Level } from './Level';

export interface Body {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  // Previous y position used to decide one-way platform pass-through.
  prevBottom: number;
}

export interface CollisionResult {
  grounded: boolean;
  ceiling: boolean;
  wallLeft: boolean;
  wallRight: boolean;
  onLadder: boolean;
  ladderCentered: boolean;
  inHazard: boolean;
}

export function emptyCollision(): CollisionResult {
  return {
    grounded: false,
    ceiling: false,
    wallLeft: false,
    wallRight: false,
    onLadder: false,
    ladderCentered: false,
    inHazard: false,
  };
}

export function probeGround(body: Body, level: Level): boolean {
  // AABB rest position has body.y + body.height == tileTop, so the standard
  // overlap check (which subtracts 1 to avoid edge-touch false positives) does
  // not see the floor. Probe one pixel below to detect "still standing".
  const tw = level.tileWidth;
  const th = level.tileHeight;
  const probeY = body.y + body.height;
  const ty = Math.floor(probeY / th);
  const left = Math.floor(body.x / tw);
  const right = Math.floor((body.x + body.width - 1) / tw);
  for (let tx = left; tx <= right; tx++) {
    const f = level.getTileFlagsAt(tx, ty);
    if (f.solid) return true;
    if (f.platform && body.vy >= 0) return true;
  }
  return false;
}

// Caller is responsible for setting body.prevBottom = body.y + body.height before
// applying any movement for the frame, so one-way platform tests can compare.
export function moveAndCollide(
  body: Body,
  dt: number,
  level: Level,
  ignorePlatforms: boolean,
): CollisionResult {
  const result = emptyCollision();

  // Sub-step so high-speed movement does not tunnel through tiles.
  const maxStep = Math.min(level.tileWidth, level.tileHeight) * 0.5;
  const dxTotal = body.vx * dt;
  const dyTotal = body.vy * dt;
  const stepCount = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dxTotal), Math.abs(dyTotal)) / maxStep),
  );
  // Mutable: once a collision zeros vx/vy, subsequent substeps must stop
  // pushing the body in that direction or it will embed into the tile (the
  // axis resolver only un-embeds when vx/vy still has the matching sign).
  let dx = dxTotal / stepCount;
  let dy = dyTotal / stepCount;

  for (let s = 0; s < stepCount; s++) {
    // X axis
    body.x += dx;
    const xHits = resolveAxis(body, level, 'x');
    if (xHits.hitNeg) {
      body.vx = 0;
      dx = 0;
      result.wallLeft = true;
    }
    if (xHits.hitPos) {
      body.vx = 0;
      dx = 0;
      result.wallRight = true;
    }

    // Y axis
    const prevBottom = body.y + body.height;
    body.y += dy;
    const yHits = resolveAxis(body, level, 'y', ignorePlatforms, prevBottom);
    if (yHits.hitNeg) {
      body.vy = 0;
      dy = 0;
      result.ceiling = true;
    }
    if (yHits.hitPos) {
      body.vy = 0;
      dy = 0;
      result.grounded = true;
    }
  }

  // Sample ladder/hazard overlap using the body's current position.
  const sample = sampleOverlapFlags(body, level);
  result.onLadder = sample.onLadder;
  result.ladderCentered = sample.ladderCentered;
  result.inHazard = sample.inHazard;

  body.prevBottom = body.y + body.height;
  return result;
}

interface AxisHits {
  hitNeg: boolean;
  hitPos: boolean;
}

function resolveAxis(
  body: Body,
  level: Level,
  axis: 'x' | 'y',
  ignorePlatforms = true,
  prevBottom = 0,
): AxisHits {
  const hits: AxisHits = { hitNeg: false, hitPos: false };
  const tw = level.tileWidth;
  const th = level.tileHeight;

  const left = Math.floor(body.x / tw);
  const right = Math.floor((body.x + body.width - 1) / tw);
  const top = Math.floor(body.y / th);
  const bottom = Math.floor((body.y + body.height - 1) / th);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      const flags = level.getTileFlagsAt(tx, ty);
      const isPlatform = flags.platform && !flags.solid;
      let blocks = flags.solid;

      if (isPlatform && !ignorePlatforms && axis === 'y') {
        const tileTop = ty * th;
        // Only block downward movement and only if we were above the platform.
        if (body.vy >= 0 && prevBottom <= tileTop + 0.5) {
          blocks = true;
        }
      }

      if (!blocks) continue;

      if (axis === 'x') {
        const tileLeft = tx * tw;
        const tileRight = tileLeft + tw;
        if (body.vx > 0) {
          body.x = tileLeft - body.width;
          hits.hitPos = true;
        } else if (body.vx < 0) {
          body.x = tileRight;
          hits.hitNeg = true;
        }
      } else {
        const tileTop = ty * th;
        const tileBottom = tileTop + th;
        if (body.vy > 0) {
          body.y = tileTop - body.height;
          hits.hitPos = true;
        } else if (body.vy < 0) {
          body.y = tileBottom;
          hits.hitNeg = true;
        }
      }
    }
  }

  return hits;
}

function sampleOverlapFlags(body: Body, level: Level) {
  const result = { onLadder: false, ladderCentered: false, inHazard: false };
  const tw = level.tileWidth;
  const th = level.tileHeight;
  const left = Math.floor(body.x / tw);
  const right = Math.floor((body.x + body.width - 1) / tw);
  const top = Math.floor(body.y / th);
  const bottom = Math.floor((body.y + body.height - 1) / th);

  const centerX = body.x + body.width / 2;
  const centerTileX = Math.floor(centerX / tw);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      const f = level.getTileFlagsAt(tx, ty);
      if (f.ladder) {
        result.onLadder = true;
        if (tx === centerTileX) result.ladderCentered = true;
      }
      if (f.hazard) result.inHazard = true;
    }
  }
  return result;
}
