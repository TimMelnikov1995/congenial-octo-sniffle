import * as PIXI from 'pixi.js';

// Generates a procedural tileset texture for the test level so we can iterate
// on gameplay before any real art exists. The layout matches the firstgid=1
// tileset described in `public/levels/test-level.json`:
//   index 0 -> solid block, 1 -> ladder, 2 -> platform, 3 -> hazard

export interface GeneratedTileset {
  baseTexture: PIXI.BaseTexture;
  frames: PIXI.Texture[];
  tileSize: number;
}

export function generateTestTileset(
  renderer: PIXI.IRenderer,
  tileSize: number,
): GeneratedTileset {
  const tileCount = 4;
  const renderTex = PIXI.RenderTexture.create({
    width: tileSize * tileCount,
    height: tileSize,
    resolution: 1,
  });

  const drawers: Array<(g: PIXI.Graphics) => void> = [
    (g) => drawSolid(g, tileSize),
    (g) => drawLadder(g, tileSize),
    (g) => drawPlatform(g, tileSize),
    (g) => drawHazard(g, tileSize),
  ];

  for (let i = 0; i < tileCount; i++) {
    const g = new PIXI.Graphics();
    drawers[i](g);
    g.x = i * tileSize;
    renderer.render(g, { renderTexture: renderTex, clear: false });
    g.destroy();
  }

  const frames: PIXI.Texture[] = [];
  for (let i = 0; i < tileCount; i++) {
    frames.push(
      new PIXI.Texture(
        renderTex.baseTexture,
        new PIXI.Rectangle(i * tileSize, 0, tileSize, tileSize),
      ),
    );
  }

  return { baseTexture: renderTex.baseTexture, frames, tileSize };
}

function drawSolid(g: PIXI.Graphics, size: number): void {
  g.beginFill(0x3a4252);
  g.drawRect(0, 0, size, size);
  g.endFill();
  // Top highlight
  g.beginFill(0x5a6478);
  g.drawRect(0, 0, size, 3);
  g.endFill();
  // Bottom shadow
  g.beginFill(0x252b36);
  g.drawRect(0, size - 3, size, 3);
  g.endFill();
  // Subtle grout lines on sides
  g.beginFill(0x2a3140);
  g.drawRect(0, 0, 2, size);
  g.drawRect(size - 2, 0, 2, size);
  g.endFill();
}

function drawLadder(g: PIXI.Graphics, size: number): void {
  g.beginFill(0x6b4423);
  g.drawRect(size * 0.2, 0, size * 0.1, size);
  g.drawRect(size * 0.7, 0, size * 0.1, size);
  g.endFill();
  g.beginFill(0x8a5a2d);
  const rungHeight = size * 0.1;
  for (let i = 0; i < 3; i++) {
    const y = size * (0.1 + i * 0.35);
    g.drawRect(size * 0.15, y, size * 0.7, rungHeight);
  }
  g.endFill();
}

function drawPlatform(g: PIXI.Graphics, size: number): void {
  g.beginFill(0x7a5a3d);
  g.drawRect(0, 0, size, size * 0.3);
  g.endFill();
  g.beginFill(0x5a4028);
  g.drawRect(0, size * 0.25, size, size * 0.05);
  g.endFill();
}

function drawHazard(g: PIXI.Graphics, size: number): void {
  g.beginFill(0x1a1d24);
  g.drawRect(0, size * 0.6, size, size * 0.4);
  g.endFill();
  g.beginFill(0xd84a3a);
  const spikeCount = 4;
  const spikeW = size / spikeCount;
  for (let i = 0; i < spikeCount; i++) {
    const baseX = i * spikeW;
    g.moveTo(baseX, size);
    g.lineTo(baseX + spikeW / 2, size * 0.1);
    g.lineTo(baseX + spikeW, size);
    g.lineTo(baseX, size);
  }
  g.endFill();
}

export function generatePlayerTexture(
  renderer: PIXI.IRenderer,
  width: number,
  height: number,
): PIXI.Texture {
  const rt = PIXI.RenderTexture.create({ width, height, resolution: 1 });
  const g = new PIXI.Graphics();
  // Body
  g.beginFill(0xc94a4a);
  g.drawRoundedRect(0, 0, width, height, 4);
  g.endFill();
  // Head highlight
  g.beginFill(0xe06a6a);
  g.drawRoundedRect(2, 2, width - 4, height * 0.35, 3);
  g.endFill();
  // Eye
  g.beginFill(0xffffff);
  g.drawRect(width * 0.6, height * 0.15, 4, 4);
  g.endFill();
  g.beginFill(0x000000);
  g.drawRect(width * 0.6 + 1, height * 0.15 + 1, 2, 2);
  g.endFill();
  // Belt
  g.beginFill(0x402020);
  g.drawRect(0, height * 0.55, width, 3);
  g.endFill();
  renderer.render(g, { renderTexture: rt });
  g.destroy();
  return rt;
}
