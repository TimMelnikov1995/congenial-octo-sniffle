import * as PIXI from 'pixi.js';
import { Level } from './Level';
import { Player } from './Player';
import { InputManager } from './Input';
import { TouchControls } from './TouchControls';

// Virtual viewport: minimum world dimensions we promise to keep visible.
// Camera scale = min(screenW / TARGET_W, screenH / TARGET_H), so on a typical
// landscape phone the player sees roughly TARGET_W x TARGET_H of the world.
const TARGET_W = 512;
const TARGET_H = 384;

const CAMERA_LERP = 8;       // higher = snappier
const CAMERA_DEADZONE_X = 32;
const CAMERA_DEADZONE_Y = 32;

export class Game {
  readonly app: PIXI.Application;
  private readonly input = new InputManager();
  private readonly touchControls = new TouchControls(this.input);

  private level: Level | null = null;
  private player: Player | null = null;

  private readonly worldContainer = new PIXI.Container();
  private readonly hud = new PIXI.Container();
  private readonly hudText: PIXI.Text;
  private readonly hpBarBg = new PIXI.Graphics();
  private readonly hpBarFg = new PIXI.Graphics();
  private readonly hpLabel: PIXI.Text;
  private lastDrawnHp = -1;

  private cameraX = 0;
  private cameraY = 0;

  constructor(private readonly parent: HTMLElement) {
    this.app = new PIXI.Application({
      resizeTo: parent,
      backgroundColor: 0x10141c,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    parent.appendChild(this.app.view as HTMLCanvasElement);

    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.hud);

    // HP bar (top-left): dark background + red fill.
    this.hpBarBg.beginFill(0x000000, 0.55);
    this.hpBarBg.lineStyle(2, 0x000000, 0.8);
    this.hpBarBg.drawRoundedRect(0, 0, 140, 16, 3);
    this.hpBarBg.endFill();
    this.hpBarBg.position.set(8, 8);
    this.hud.addChild(this.hpBarBg);

    this.hpBarFg.position.set(11, 11);
    this.hud.addChild(this.hpBarFg);

    this.hpLabel = new PIXI.Text('HP 100', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 11,
      fontWeight: '600',
      fill: 0xffffff,
    });
    this.hpLabel.position.set(14, 9);
    this.hud.addChild(this.hpLabel);

    this.hudText = new PIXI.Text('loading...', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 12,
      fill: 0xbac0c8,
    });
    this.hudText.position.set(8, 30);
    this.hud.addChild(this.hudText);
  }

  async start(): Promise<void> {
    const levelUrl = `${import.meta.env.BASE_URL}levels/test-level.json`;
    this.level = await Level.load(levelUrl, this.app.renderer);
    this.worldContainer.addChild(this.level.container);

    const spawn = this.level.getSpawn();
    this.player = new Player(this.app.renderer, spawn);
    this.level.container.addChild(this.player.sprite);

    this.touchControls.mount(this.parent);

    // Snap camera to player on first frame.
    this.cameraX = this.player.body.x + this.player.body.width / 2;
    this.cameraY = this.player.body.y + this.player.body.height / 2;
    this.applyCamera(true);

    this.app.ticker.add(this.tick);
  }

  stop(): void {
    this.app.ticker.remove(this.tick);
    this.input.dispose();
    this.touchControls.unmount();
    this.app.destroy(true, { children: true });
  }

  private tick = (): void => {
    if (!this.level || !this.player) return;
    const dtRaw = this.app.ticker.deltaMS / 1000;
    const dt = Math.min(dtRaw, 1 / 30); // cap to avoid tunneling on stalls
    const input = this.input.poll();
    this.player.update(dt, input, this.level);
    this.updateCamera(dt);
    this.applyCamera(false);

    if (this.player.hp !== this.lastDrawnHp) {
      const hpRatio = this.player.hp / this.player.maxHp;
      this.hpBarFg.clear();
      this.hpBarFg.beginFill(hpRatio > 0.33 ? 0xd84a3a : 0xff7060);
      this.hpBarFg.drawRoundedRect(0, 0, 134 * hpRatio, 10, 2);
      this.hpBarFg.endFill();
      this.hpLabel.text = `HP ${this.player.hp}`;
      this.lastDrawnHp = this.player.hp;
    }

    this.hudText.text =
      `pos ${this.player.body.x.toFixed(0)},${this.player.body.y.toFixed(0)} ` +
      `v ${this.player.body.vx.toFixed(0)},${this.player.body.vy.toFixed(0)} ` +
      `fps ${this.app.ticker.FPS.toFixed(0)}`;
  };

  private updateCamera(dt: number): void {
    if (!this.player) return;
    const targetX = this.player.body.x + this.player.body.width / 2;
    const targetY = this.player.body.y + this.player.body.height / 2;
    const dx = targetX - this.cameraX;
    const dy = targetY - this.cameraY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const t = 1 - Math.exp(-CAMERA_LERP * dt);
    if (absDx > CAMERA_DEADZONE_X) {
      const overshoot = (absDx - CAMERA_DEADZONE_X) * Math.sign(dx);
      this.cameraX += overshoot * t;
    }
    if (absDy > CAMERA_DEADZONE_Y) {
      const overshoot = (absDy - CAMERA_DEADZONE_Y) * Math.sign(dy);
      this.cameraY += overshoot * t;
    }
  }

  private applyCamera(snap: boolean): void {
    if (!this.level) return;
    const screenW = this.app.renderer.width / this.app.renderer.resolution;
    const screenH = this.app.renderer.height / this.app.renderer.resolution;
    const scale = Math.min(screenW / TARGET_W, screenH / TARGET_H);

    // Clamp camera target to keep view inside the level when possible.
    const viewW = screenW / scale;
    const viewH = screenH / scale;
    let camX = this.cameraX;
    let camY = this.cameraY;
    if (viewW < this.level.pixelWidth) {
      camX = clamp(camX, viewW / 2, this.level.pixelWidth - viewW / 2);
    } else {
      camX = this.level.pixelWidth / 2;
    }
    if (viewH < this.level.pixelHeight) {
      camY = clamp(camY, viewH / 2, this.level.pixelHeight - viewH / 2);
    } else {
      camY = this.level.pixelHeight / 2;
    }
    if (snap) {
      this.cameraX = camX;
      this.cameraY = camY;
    }

    this.worldContainer.scale.set(scale);
    this.worldContainer.position.set(
      Math.round(screenW / 2 - camX * scale),
      Math.round(screenH / 2 - camY * scale),
    );
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
