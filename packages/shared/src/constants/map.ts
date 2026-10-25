import type { IngredientKind } from '../types/items';
import { KITCHEN, TILE } from './world';

export type StationType =
  | 'crate'
  | 'fridge'
  | 'board'
  | 'stove_pan'
  | 'stove_pot'
  | 'counter'
  | 'assembly'
  | 'delivery'
  | 'trash';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StationDef extends Rect {
  id: string;
  type: StationType;
  /** For crates/fridge: which ingredient it dispenses. */
  ingredient?: IngredientKind;
  /** Side players stand on to use it ("down" = players stand below it). */
  facing: 'up' | 'down' | 'left' | 'right';
}

const T = TILE;
const kx = KITCHEN.x;
const ky = KITCHEN.y;

/**
 * One compact kitchen that fits a portrait phone.
 * Back wall (top row): ingredient sources + stoves. Side walls: cutting boards and counters.
 * Center island: assembly. Bottom: delivery window and trash.
 */
export const STATIONS: StationDef[] = [
  // ---- back wall (top row) ----
  { id: 'fridge', type: 'fridge', ingredient: 'patty', x: kx + 0 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'crate_lettuce', type: 'crate', ingredient: 'lettuce', x: kx + 1 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'crate_tomato', type: 'crate', ingredient: 'tomato', x: kx + 2 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'stove_pan', type: 'stove_pan', x: kx + 3 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'stove_pot', type: 'stove_pot', x: kx + 4 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'crate_carrot', type: 'crate', ingredient: 'carrot', x: kx + 5 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'crate_potato', type: 'crate', ingredient: 'potato', x: kx + 6 * T, y: ky, w: T, h: T, facing: 'down' },
  { id: 'crate_bread', type: 'crate', ingredient: 'bread', x: kx + 7 * T, y: ky, w: T, h: T, facing: 'down' },

  // ---- left wall ----
  { id: 'board_left', type: 'board', x: kx, y: ky + 2 * T, w: T, h: T, facing: 'right' },
  { id: 'counter_left', type: 'counter', x: kx, y: ky + 3 * T, w: T, h: T, facing: 'right' },
  { id: 'counter_left2', type: 'counter', x: kx, y: ky + 6 * T, w: T, h: T, facing: 'right' },

  // ---- right wall ----
  { id: 'board_right', type: 'board', x: kx + 7 * T, y: ky + 2 * T, w: T, h: T, facing: 'left' },
  { id: 'counter_right', type: 'counter', x: kx + 7 * T, y: ky + 3 * T, w: T, h: T, facing: 'left' },
  { id: 'trash', type: 'trash', x: kx + 7 * T, y: ky + 6 * T, w: T, h: T, facing: 'left' },

  // ---- center island ----
  { id: 'counter_island_l', type: 'counter', x: kx + 2 * T, y: ky + 5 * T, w: T, h: T, facing: 'down' },
  { id: 'assembly', type: 'assembly', x: kx + 3 * T, y: ky + 5 * T, w: 2 * T, h: T, facing: 'down' },
  { id: 'counter_island_r', type: 'counter', x: kx + 5 * T, y: ky + 5 * T, w: T, h: T, facing: 'down' },

  // ---- front (bottom row) ----
  { id: 'delivery', type: 'delivery', x: kx + 3 * T, y: ky + 9 * T, w: 2 * T, h: T, facing: 'up' },
];

export const STATION_BY_ID: ReadonlyMap<string, StationDef> = new Map(STATIONS.map((s) => [s.id, s]));

/** Walls around the kitchen (thick so the player can never leave). */
export const WALLS: Rect[] = [
  { x: KITCHEN.x - 100, y: KITCHEN.y - 100, w: KITCHEN.w + 200, h: 100 }, // top
  { x: KITCHEN.x - 100, y: KITCHEN.y + KITCHEN.h, w: KITCHEN.w + 200, h: 100 }, // bottom
  { x: KITCHEN.x - 100, y: KITCHEN.y - 100, w: 100, h: KITCHEN.h + 200 }, // left
  { x: KITCHEN.x + KITCHEN.w, y: KITCHEN.y - 100, w: 100, h: KITCHEN.h + 200 }, // right
];

/** Every rectangle the player collides with. */
export const SOLIDS: Rect[] = [...WALLS, ...STATIONS.map(({ x, y, w, h }) => ({ x, y, w, h }))];

export const SPAWN_POINTS: { x: number; y: number }[] = [
  { x: kx + 2.5 * T, y: ky + 7.5 * T },
  { x: kx + 5.5 * T, y: ky + 7.5 * T },
];

/** Multi-slot stations (how many items they can hold). */
export function stationCapacity(type: StationType): number {
  switch (type) {
    case 'assembly':
      return 3;
    case 'stove_pot':
      return 2;
    case 'crate':
    case 'fridge':
    case 'delivery':
    case 'trash':
      return 0;
    default:
      return 1;
  }
}

export const STATION_NAMES_PT: Record<StationType, string> = {
  crate: 'Caixa',
  fridge: 'Geladeira',
  board: 'Tábua de corte',
  stove_pan: 'Frigideira',
  stove_pot: 'Panela',
  counter: 'Bancada',
  assembly: 'Montagem',
  delivery: 'Entrega',
  trash: 'Lixo',
};
