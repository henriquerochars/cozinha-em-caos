import type { SkCanvas } from '@shopify/react-native-skia';
import { KITCHEN, TILE, WORLD_H, WORLD_W } from '@cozinha/shared';
import { paints, roundRect } from './paint';

const FLOOR_A = '#FFE7C7';
const FLOOR_B = '#F9D7AE';
const FLOOR_LINE = '#EFC79B';
const WALL = '#FFF1DC';
const WALL_TILE = '#F7E2CB';
const WALL_LINE = '#EBD1B5';
const BASEBOARD = '#D9A574';
const OUTSIDE = '#8C5A3C';
const OUTSIDE_DARK = '#6E4530';

/** The static part of the scene: floor, walls, baseboards. Drawn every frame (cheap). */
export function drawKitchenBackground(canvas: SkCanvas, time: number): void {
  // outside: warm wood/plaster around the kitchen
  canvas.drawRect({ x: 0, y: 0, width: WORLD_W, height: WORLD_H }, paints.fill(OUTSIDE));

  // back wall with light tiles (the band above the top counters)
  const wallTop = KITCHEN.y - 24;
  canvas.drawRect({ x: 0, y: wallTop, width: WORLD_W, height: KITCHEN.y - wallTop + 4 }, paints.fill(WALL));
  for (let x = 0; x < WORLD_W; x += 20) {
    canvas.drawLine(x, wallTop, x, KITCHEN.y, paints.stroke(WALL_LINE, 1));
  }
  canvas.drawLine(0, wallTop + 12, WORLD_W, wallTop + 12, paints.stroke(WALL_LINE, 1));
  // accent tiles row
  for (let x = 10; x < WORLD_W; x += 40) {
    roundRect(canvas, x - 4, wallTop + 2, 8, 8, 1.5, paints.fill(WALL_TILE));
  }

  // side walls (thin strips) + bottom ledge
  canvas.drawRect({ x: 0, y: KITCHEN.y, width: KITCHEN.x, height: KITCHEN.h }, paints.fill(WALL));
  canvas.drawRect({ x: KITCHEN.x + KITCHEN.w, y: KITCHEN.y, width: WORLD_W - KITCHEN.x - KITCHEN.w, height: KITCHEN.h }, paints.fill(WALL));
  canvas.drawRect({ x: 0, y: KITCHEN.y + KITCHEN.h, width: WORLD_W, height: 10 }, paints.fill(BASEBOARD));
  canvas.drawRect({ x: 0, y: KITCHEN.y + KITCHEN.h + 10, width: WORLD_W, height: WORLD_H - KITCHEN.y - KITCHEN.h - 10 }, paints.fill(OUTSIDE));
  // front wood planks pattern
  for (let y = KITCHEN.y + KITCHEN.h + 18; y < WORLD_H; y += 12) {
    canvas.drawLine(0, y, WORLD_W, y, paints.stroke(OUTSIDE_DARK, 1, 0.5));
  }

  // floor: checkerboard
  const cols = Math.ceil(KITCHEN.w / TILE);
  const rows = Math.ceil(KITCHEN.h / TILE);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = KITCHEN.x + c * TILE;
      const y = KITCHEN.y + r * TILE;
      const w = Math.min(TILE, KITCHEN.x + KITCHEN.w - x);
      const h = Math.min(TILE, KITCHEN.y + KITCHEN.h - y);
      canvas.drawRect({ x, y, width: w, height: h }, paints.fill((r + c) % 2 === 0 ? FLOOR_A : FLOOR_B));
    }
  }
  // grout lines
  for (let c = 0; c <= cols; c++) {
    const x = KITCHEN.x + c * TILE;
    canvas.drawLine(x, KITCHEN.y, x, KITCHEN.y + KITCHEN.h, paints.stroke(FLOOR_LINE, 1, 0.7));
  }
  for (let r = 0; r <= rows; r++) {
    const y = KITCHEN.y + r * TILE;
    canvas.drawLine(KITCHEN.x, y, KITCHEN.x + KITCHEN.w, y, paints.stroke(FLOOR_LINE, 1, 0.7));
  }
  // soft vignette at the walls
  canvas.drawRect({ x: KITCHEN.x, y: KITCHEN.y, width: KITCHEN.w, height: 6 }, paints.fill('#3A2418', 0.08));
  canvas.drawRect({ x: KITCHEN.x, y: KITCHEN.y, width: 5, height: KITCHEN.h }, paints.fill('#3A2418', 0.05));
  canvas.drawRect({ x: KITCHEN.x + KITCHEN.w - 5, y: KITCHEN.y, width: 5, height: KITCHEN.h }, paints.fill('#3A2418', 0.05));

  // a little rug in the middle of the floor so it is not a plain grid
  const rugX = KITCHEN.x + 3 * TILE + 6;
  const rugY = KITCHEN.y + 7 * TILE - 4;
  roundRect(canvas, rugX, rugY, 2 * TILE - 12, 28, 6, paints.fill('#F4A6A6', 0.75));
  roundRect(canvas, rugX + 4, rugY + 4, 2 * TILE - 20, 20, 4, paints.stroke('#FFFFFF', 1.5, 0.6));

  // hanging lamp glow drifting a little (life!)
  const glowX = WORLD_W / 2 + Math.sin(time * 0.6) * 2;
  canvas.drawCircle(glowX, KITCHEN.y + 190, 120, paints.fill('#FFF6E0', 0.12));
}
