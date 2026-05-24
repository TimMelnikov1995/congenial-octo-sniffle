// Subset of the Tiled JSON map format we currently consume.
// Reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/

export type TiledPropertyType = 'string' | 'int' | 'float' | 'bool' | 'color' | 'file' | 'object';

export interface TiledProperty {
  name: string;
  type: TiledPropertyType;
  value: string | number | boolean;
}

export interface TiledTileDef {
  id: number;
  properties?: TiledProperty[];
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  image: string;
  imagewidth: number;
  imageheight: number;
  tilewidth: number;
  tileheight: number;
  columns: number;
  tilecount: number;
  spacing: number;
  margin: number;
  tiles?: TiledTileDef[];
}

export interface TiledTileLayer {
  type: 'tilelayer';
  id: number;
  name: string;
  width: number;
  height: number;
  data: number[];
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  point?: boolean;
  properties?: TiledProperty[];
}

export interface TiledObjectLayer {
  type: 'objectgroup';
  id: number;
  name: string;
  objects: TiledObject[];
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}

export type TiledLayer = TiledTileLayer | TiledObjectLayer;

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal';
  renderorder: string;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

// Per-tile gameplay flags derived from Tiled custom properties.
export interface TileFlags {
  solid: boolean;
  ladder: boolean;
  platform: boolean;
  hazard: boolean;
}

export const EMPTY_TILE_FLAGS: TileFlags = {
  solid: false,
  ladder: false,
  platform: false,
  hazard: false,
};
