import type { SkCanvas } from '@shopify/react-native-skia';
import { WORLD_H, WORLD_W, isActionDef, type GameStateView } from '@cozinha/shared';
import type { ClientWorld } from '../engine/ClientWorld';
import type { FxSystem } from '../engine/fx';
import { drawChef } from './chef';
import { drawBanner, drawFx } from './fxDraw';
import { drawHud } from './hud';
import { drawKitchenBackground } from './kitchen';
import type { FontSet } from './paint';
import { drawText, paints, roundRect } from './paint';
import { drawHighlight, drawStation } from './stations';

interface Drawable {
  y: number;
  draw: () => void;
}

/** Draws one frame of the kitchen in world coordinates (0..WORLD_W, 0..WORLD_H). */
export function drawScene(canvas: SkCanvas, world: ClientWorld, fx: FxSystem, state: GameStateView | null, fonts: FontSet, localId: string): void {
  const time = world.time;

  // camera shake
  canvas.save();
  if (fx.shakeT > 0) {
    const a = fx.shakeT * 6;
    canvas.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
  }

  drawKitchenBackground(canvas, time);

  if (world.nearby) {
    const enabled = world.nearbyAction !== null && isActionDef(world.nearbyAction);
    drawHighlight(canvas, world.nearby, time, enabled);
  }

  // painter's algorithm: stations and chefs sorted by their "feet" position
  const drawables: Drawable[] = [];
  world.stations.forEach((s) => {
    drawables.push({ y: s.def.y + s.def.h, draw: () => drawStation(canvas, s, time, world.chefs) });
  });
  world.chefs.forEach((c) => {
    drawables.push({ y: c.y, draw: () => drawChef(canvas, c, time, fonts, c.id === localId) });
  });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  drawFx(canvas, fx, fonts);
  canvas.restore();

  if (state) drawHud(canvas, world, state, fonts, time);
  else drawLobbyNote(canvas, fonts);

  drawBanner(canvas, fx, fonts);
}

function drawLobbyNote(canvas: SkCanvas, fonts: FontSet): void {
  roundRect(canvas, WORLD_W / 2 - 90, WORLD_H * 0.42 - 16, 180, 32, 10, paints.fill('#3B2A2A', 0.7));
  drawText(canvas, fonts, 'Conectando…', WORLD_W / 2, WORLD_H * 0.42 + 6, 14, '#FFFFFF', { align: 'center' });
}
