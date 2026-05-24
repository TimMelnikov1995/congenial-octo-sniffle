import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import type {
  TiledMap,
  TiledObject,
  TiledTileLayer,
  TiledObjectLayer,
  TileFlags,
} from './types';
import { EMPTY_TILE_FLAGS } from './types';
import { generateTestTileset } from './TileTextures';

export interface LevelTilesetBinding {
  firstgid: number;
  frames: PIXI.Texture[];
  tileSize: number;
}

export class Level {
  readonly map: TiledMap;
  readonly container: PIXI.Container;
  readonly tilemap: CompositeTilemap;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly widthInTiles: number;
  readonly heightInTiles: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;

  private readonly collisionGrid: TileFlags[];
  private readonly tilesetBindings: LevelTilesetBinding[];

  constructor(map: TiledMap, tilesetBindings: LevelTilesetBinding[]) {
    this.map = map;
    this.tilesetBindings = tilesetBindings;
    this.tileWidth = map.tilewidth;
    this.tileHeight = map.tileheight;
    this.widthInTiles = map.width;
    this.heightInTiles = map.height;
    this.pixelWidth = map.width * map.tilewidth;
    this.pixelHeight = map.height * map.tileheight;

    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    this.tilemap = new CompositeTilemap();
    this.tilemap.zIndex = 0;
    this.container.addChild(this.tilemap);

    this.collisionGrid = this.buildCollisionGrid();
    this.renderTileLayers();
  }

  static async load(
    url: string,
    renderer: PIXI.IRenderer,
  ): Promise<Level> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load level ${url}: ${res.status}`);
    const map = (await res.json()) as TiledMap;

    // For now we generate the tileset procedurally regardless of the image path
    // the JSON declares. When real art lands, swap this for PIXI.Assets.load(image).
    const bindings: LevelTilesetBinding[] = map.tilesets.map((ts) => {
      const generated = generateTestTileset(renderer, ts.tilewidth);
      return {
        firstgid: ts.firstgid,
        frames: generated.frames,
        tileSize: ts.tilewidth,
      };
    });

    return new Level(map, bindings);
  }

  getSpawn(): { x: number; y: number } {
    for (const layer of this.map.layers) {
      if (layer.type !== 'objectgroup') continue;
      const obj = (layer as TiledObjectLayer).objects.find(
        (o) => o.type === 'spawn' || o.name === 'spawn',
      );
      if (obj) return { x: obj.x, y: obj.y };
    }
    return { x: this.tileWidth * 2, y: this.tileHeight * 2 };
  }

  getObjects(filter?: (o: TiledObject) => boolean): TiledObject[] {
    const result: TiledObject[] = [];
    for (const layer of this.map.layers) {
      if (layer.type !== 'objectgroup') continue;
      for (const obj of (layer as TiledObjectLayer).objects) {
        if (!filter || filter(obj)) result.push(obj);
      }
    }
    return result;
  }

  getTileFlagsAt(tileX: number, tileY: number): TileFlags {
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= this.widthInTiles ||
      tileY >= this.heightInTiles
    ) {
      // Treat outside-map as solid on left/right/top but empty below so the
      // player can fall out and we respawn. Simpler to start as fully empty.
      return EMPTY_TILE_FLAGS;
    }
    return this.collisionGrid[tileY * this.widthInTiles + tileX];
  }

  private buildCollisionGrid(): TileFlags[] {
    const size = this.widthInTiles * this.heightInTiles;
    const grid: TileFlags[] = new Array(size);
    for (let i = 0; i < size; i++) grid[i] = { ...EMPTY_TILE_FLAGS };

    for (const layer of this.map.layers) {
      if (layer.type !== 'tilelayer') continue;
      const tl = layer as TiledTileLayer;
      for (let i = 0; i < tl.data.length; i++) {
        const gid = tl.data[i];
        if (gid === 0) continue;
        const flags = this.flagsForGid(gid);
        const cell = grid[i];
        cell.solid ||= flags.solid;
        cell.ladder ||= flags.ladder;
        cell.platform ||= flags.platform;
        cell.hazard ||= flags.hazard;
      }
    }
    return grid;
  }

  private flagsForGid(gid: number): TileFlags {
    const ts = this.findTilesetForGid(gid);
    if (!ts) return EMPTY_TILE_FLAGS;
    const localId = gid - ts.firstgid;
    const tileDef = ts.tiles?.find((t) => t.id === localId);
    if (!tileDef?.properties) return EMPTY_TILE_FLAGS;
    const flags: TileFlags = { ...EMPTY_TILE_FLAGS };
    for (const p of tileDef.properties) {
      if (p.type !== 'bool' || typeof p.value !== 'boolean') continue;
      if (p.name === 'solid') flags.solid = p.value;
      else if (p.name === 'ladder') flags.ladder = p.value;
      else if (p.name === 'platform') flags.platform = p.value;
      else if (p.name === 'hazard') flags.hazard = p.value;
    }
    return flags;
  }

  private findTilesetForGid(gid: number) {
    let match = this.map.tilesets[0];
    for (const ts of this.map.tilesets) {
      if (ts.firstgid <= gid && ts.firstgid >= match.firstgid) match = ts;
    }
    return match;
  }

  private textureForGid(gid: number): PIXI.Texture | undefined {
    let bestBinding: LevelTilesetBinding | undefined;
    for (const b of this.tilesetBindings) {
      if (b.firstgid <= gid && (!bestBinding || b.firstgid >= bestBinding.firstgid)) {
        bestBinding = b;
      }
    }
    if (!bestBinding) return undefined;
    const localId = gid - bestBinding.firstgid;
    return bestBinding.frames[localId];
  }

  private renderTileLayers(): void {
    this.tilemap.clear();
    for (const layer of this.map.layers) {
      if (layer.type !== 'tilelayer') continue;
      const tl = layer as TiledTileLayer;
      if (!tl.visible) continue;
      for (let y = 0; y < tl.height; y++) {
        for (let x = 0; x < tl.width; x++) {
          const gid = tl.data[y * tl.width + x];
          if (gid === 0) continue;
          const tex = this.textureForGid(gid);
          if (!tex) continue;
          this.tilemap.tile(tex, x * this.tileWidth, y * this.tileHeight);
        }
      }
    }
  }
}
