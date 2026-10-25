import type { SkCanvas } from '@shopify/react-native-skia';
import { MATCH_DURATION_MS, RECIPES, RECIPE_DISPLAY_INGREDIENTS, WORLD_W, makeDish, type GameStateView, type OrderView } from '@cozinha/shared';
import type { ClientWorld } from '../engine/ClientWorld';
import { drawItem } from './items';
import { clamp01, drawText, paints, roundRect, type FontSet } from './paint';

const HUD_H = 56;
const CARD_W = 58;
const CARD_H = 46;
const CARD_GAP = 5;

/** Orders strip + timer + score, drawn inside the world at the top (above the back wall). */
export function drawHud(canvas: SkCanvas, world: ClientWorld, state: GameStateView, fonts: FontSet, time: number): void {
  // background strip
  canvas.drawRect({ x: 0, y: 0, width: WORLD_W, height: HUD_H }, paints.fill('#3B2A2A'));
  canvas.drawRect({ x: 0, y: HUD_H - 2, width: WORLD_W, height: 2 }, paints.fill('#FFD166'));

  // ---- orders (left-to-right, oldest first)
  const orders: OrderView[] = [];
  state.orders.forEach((o) => orders.push(o));
  orders.sort((a, b) => a.createdAt - b.createdAt);
  const maxCards = 4;
  const startX = 6;
  orders.slice(0, maxCards).forEach((o, i) => {
    drawOrderCard(canvas, o, startX + i * (CARD_W + CARD_GAP), 5, state.clock, fonts, time, i);
  });
  if (orders.length === 0 && state.phase === 'playing') {
    drawText(canvas, fonts, 'Aguardando pedidos…', startX + 4, 32, 11, '#FFF4E3', { alpha: 0.7 });
  }

  // ---- right column: timer + score
  const colX = WORLD_W - 6;
  // before the match starts, show the full duration (fields may still be unset on a fresh room)
  const clock = state.clock || 0;
  const inMatch = state.phase === 'playing' || state.phase === 'paused' || state.phase === 'ended';
  const endsAt = inMatch ? state.matchEndsAt || 0 : clock + (state.matchDuration || MATCH_DURATION_MS);
  const remainingMs = Math.max(0, endsAt - clock);
  const secs = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const urgent = secs <= 15 && state.phase === 'playing';
  const pulse = urgent ? 1 + Math.sin(time * 10) * 0.08 : 1;
  const timerColor = urgent ? '#FF6B6B' : '#FFFFFF';
  roundRect(canvas, colX - 70, 5, 70, 20, 10, paints.fill('#FFFFFF', 0.12));
  drawText(canvas, fonts, `${mm}:${ss.toString().padStart(2, '0')}`, colX - 8, 20.5, 15 * pulse, timerColor, { align: 'right' });
  drawClockIcon(canvas, colX - 60, 15, time, urgent);

  const score = Math.round(world.shownScore || 0);
  const scoreBump = 1 + Math.max(0, Math.sin(world.scoreBumpT * Math.PI)) * 0.25;
  roundRect(canvas, colX - 70, 29, 70, 20, 10, paints.fill('#FFD166'));
  drawText(canvas, fonts, `${score}`, colX - 8, 44.5, 15 * scoreBump, '#3B2A2A', { align: 'right' });
  drawStarIcon(canvas, colX - 60, 39);
}

function drawOrderCard(canvas: SkCanvas, o: OrderView, x: number, y: number, clock: number, fonts: FontSet, time: number, index: number): void {
  const total = Math.max(1, o.expiresAt - o.createdAt);
  const remaining = clamp01((o.expiresAt - clock) / total);
  const urgent = remaining < 0.25;
  const age = (clock - o.createdAt) / 1000;
  // slide-in animation for brand new orders
  const enter = clamp01(age / 0.35);
  const slide = (1 - enter) * -20;
  const wob = urgent ? Math.sin(time * 14 + index) * 1.2 : 0;
  canvas.save();
  canvas.translate(0, slide + wob);
  roundRect(canvas, x, y, CARD_W, CARD_H, 7, paints.fill(urgent ? '#FFE3E3' : '#FFF9F0'));
  roundRect(canvas, x, y, CARD_W, 5, 2.5, paints.fill(urgent ? '#FF6B6B' : '#5FD39A'));
  // dish picture
  drawItem(canvas, makeDish(o.recipe), x + 15, y + 20, 1.05);
  // ingredient chips
  const ings = RECIPE_DISPLAY_INGREDIENTS[o.recipe];
  ings.forEach((ing, i) => {
    const ix = x + 36 + (i % 2) * 11;
    const iy = y + 14 + Math.floor(i / 2) * 11;
    canvas.drawCircle(ix, iy, 5.5, paints.fill('#FFFFFF'));
    drawItem(canvas, ing, ix, iy, 0.45);
  });
  // name
  drawText(canvas, fonts, RECIPES[o.recipe].namePt, x + CARD_W / 2, y + 34.5, 7.5, '#3B2A2A', { align: 'center' });
  // patience bar
  roundRect(canvas, x + 5, y + CARD_H - 7, CARD_W - 10, 3.5, 2, paints.fill('#3B2A2A', 0.12));
  roundRect(canvas, x + 5, y + CARD_H - 7, Math.max(3.5, (CARD_W - 10) * remaining), 3.5, 2, paints.fill(remaining < 0.25 ? '#FF6B6B' : remaining < 0.5 ? '#FFB347' : '#5FD39A'));
  canvas.restore();
}

function drawClockIcon(canvas: SkCanvas, cx: number, cy: number, time: number, urgent: boolean): void {
  canvas.drawCircle(cx, cy, 6.5, paints.fill(urgent ? '#FF6B6B' : '#FFFFFF'));
  canvas.drawCircle(cx, cy, 5, paints.fill('#3B2A2A'));
  const a = time * 2;
  canvas.drawLine(cx, cy, cx + Math.cos(a) * 3.2, cy + Math.sin(a) * 3.2, paints.stroke('#FFFFFF', 1.2));
  canvas.drawLine(cx, cy, cx, cy - 2.4, paints.stroke('#FFFFFF', 1.2));
}

function drawStarIcon(canvas: SkCanvas, cx: number, cy: number): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 6.5 : 3;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const path = pts.reduce((b, [px, py], i) => (i === 0 ? b.moveTo(px, py) : b.lineTo(px, py)), skiaBuilder()).close().build();
  canvas.drawPath(path, paints.fill('#3B2A2A'));
}

import { Skia } from '@shopify/react-native-skia';
function skiaBuilder() {
  return Skia.PathBuilder.Make();
}

export { HUD_H };
