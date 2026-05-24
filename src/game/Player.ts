import * as PIXI from 'pixi.js';
import type { InputState } from './Input';
import type { Level } from './Level';
import { type Body, moveAndCollide, probeGround, findLadderCenterX } from './Physics';
import { generatePlayerTexture } from './TileTextures';

const RUN_SPEED = 220;
const GROUND_ACCEL = 2200;
const AIR_ACCEL = 1200;
const GROUND_FRICTION = 2200;
const GRAVITY = 1800;
const MAX_FALL = 900;
// Jump height = v^2 / (2g). Bumped by sqrt(1.5) for ~1.5x apex height.
const JUMP_VELOCITY = 686;
const JUMP_CUT_MULTIPLIER = 0.35;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.1;
const LADDER_SPEED = 140;

const PLAYER_W = 22;
const PLAYER_H = 28;

export class Player {
  readonly sprite: PIXI.Sprite;
  readonly body: Body;

  private grounded = false;
  private onLadder = false;
  private climbing = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private facing: 1 | -1 = 1;
  private spawn: { x: number; y: number };

  constructor(renderer: PIXI.IRenderer, spawn: { x: number; y: number }) {
    const tex = generatePlayerTexture(renderer, PLAYER_W, PLAYER_H);
    this.sprite = new PIXI.Sprite(tex);
    this.sprite.anchor.set(0, 0);
    this.spawn = spawn;
    this.body = {
      x: spawn.x - PLAYER_W / 2,
      y: spawn.y - PLAYER_H,
      width: PLAYER_W,
      height: PLAYER_H,
      vx: 0,
      vy: 0,
      prevBottom: spawn.y,
    };
    this.syncSprite();
  }

  update(dt: number, input: InputState, level: Level): void {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir as 1 | -1;

    // Climb intent: pressing up or down while overlapping a ladder grabs it.
    // Pressing up while grounded under a ladder also grabs it (so the player
    // can mount from the ground without first being mid-tile).
    if (this.onLadder && (input.up || input.down)) {
      this.climbing = true;
    }
    if (!this.onLadder) this.climbing = false;

    if (this.climbing) {
      this.updateClimb(input, level);
    } else {
      this.updateGroundAir(dt, dir, input);
    }

    const collisions = moveAndCollide(this.body, dt, level, /*ignorePlatforms*/ true);

    // A body resting on the floor sits exactly one pixel above it, so the
    // standard overlap test does not register as "grounded". A foot probe
    // catches this and keeps gravity from re-accelerating us every frame.
    const probed = probeGround(this.body, level);
    this.grounded = collisions.grounded || probed;
    if (this.grounded && this.body.vy > 0) this.body.vy = 0;
    this.onLadder = collisions.onLadder;

    if (this.grounded) {
      this.coyoteTimer = COYOTE_TIME;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // Jump buffer: remember a recent jump press and consume it if/when we land.
    if (input.jumpPressed) {
      this.jumpBufferTimer = JUMP_BUFFER;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.climbing) {
      this.body.vy = -JUMP_VELOCITY;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // Variable jump height: cut upward velocity if jump released early.
    if (input.jumpReleased && this.body.vy < 0) {
      this.body.vy *= JUMP_CUT_MULTIPLIER;
    }

    // Out-of-world respawn.
    if (this.body.y > level.pixelHeight + 200) {
      this.respawn();
    }

    this.syncSprite();
  }

  private updateGroundAir(dt: number, dir: number, input: InputState): void {
    const accel = this.grounded ? GROUND_ACCEL : AIR_ACCEL;
    const target = dir * RUN_SPEED;
    if (dir !== 0) {
      this.body.vx = approach(this.body.vx, target, accel * dt);
    } else if (this.grounded) {
      this.body.vx = approach(this.body.vx, 0, GROUND_FRICTION * dt);
    }
    // Hop off ladder if jump pressed while clinging.
    if (this.onLadder && input.jumpPressed) {
      this.climbing = false;
    }
    if (this.grounded && this.body.vy >= 0) {
      this.body.vy = 0;
    } else {
      this.body.vy = Math.min(MAX_FALL, this.body.vy + GRAVITY * dt);
    }
  }

  private updateClimb(input: InputState, level: Level): void {
    const vDir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    this.body.vy = vDir * LADDER_SPEED;

    // Snap horizontally to the ladder column center so the player rides up
    // the middle instead of clipping the edge of a solid neighbour tile.
    const ladderX = findLadderCenterX(this.body, level);
    if (ladderX !== null) {
      this.body.x = ladderX - this.body.width / 2;
    }
    this.body.vx = 0;

    // Jump detaches and gives a small hop; left/right at the moment of jump
    // chooses an escape direction.
    if (input.jumpPressed) {
      this.climbing = false;
      this.body.vy = -JUMP_VELOCITY * 0.8;
      const hDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.body.vx = hDir * RUN_SPEED;
    }
  }

  private respawn(): void {
    this.body.x = this.spawn.x - PLAYER_W / 2;
    this.body.y = this.spawn.y - PLAYER_H;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.prevBottom = this.body.y + PLAYER_H;
    this.climbing = false;
  }

  private syncSprite(): void {
    this.sprite.position.set(Math.round(this.body.x), Math.round(this.body.y));
    this.sprite.scale.x = this.facing;
    // Compensate anchor when flipped so the sprite stays inside its AABB.
    this.sprite.x += this.facing < 0 ? PLAYER_W : 0;
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return current;
}
