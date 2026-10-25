import type { SkCanvas } from '@shopify/react-native-skia';
import { CHOPPABLE, PLAYER_COLORS, ingredientKind, makeIngredient, type IngredientKind } from '@cozinha/shared';
import type { ChefRenderState, StationRenderState } from '../engine/ClientWorld';
import { drawItem, drawPlate } from './items';
import { clamp01, dome, ellipse, paints, polygon, roundRect, softShadow } from './paint';

const COUNTER_TOP = '#F6E2C3';
const COUNTER_EDGE = '#E9C99C';
const COUNTER_FRONT = '#C98A5B';
const COUNTER_FRONT_DARK = '#A86E45';
const STEEL = '#B9C4D0';
const STEEL_DARK = '#8E9BAA';
const WOOD = '#C98A5B';
const WOOD_DARK = '#9E6238';

/** Height of the vertical "front face" that fakes depth. */
export const FRONT_H = 9;

/**
 * Base counter block for a station rect: shadow, front face, top face.
 * The top face is the area where things get placed (returns its rect).
 */
export function drawCounterBlock(canvas: SkCanvas, x: number, y: number, w: number, h: number, top = COUNTER_TOP, front = COUNTER_FRONT, frontDark = COUNTER_FRONT_DARK): { x: number; y: number; w: number; h: number } {
  const inset = 1.5;
  const bx = x + inset;
  const bw = w - inset * 2;
  // drop shadow on the floor
  canvas.drawRRect({ rect: { x: bx + 1, y: y + 4, width: bw, height: h }, rx: 5, ry: 5 }, softShadow(0.28, 3));
  // front face
  roundRect(canvas, bx, y + h - FRONT_H - 4, bw, FRONT_H + 4, 4, paints.fill(frontDark));
  roundRect(canvas, bx, y + h - FRONT_H - 4, bw, FRONT_H + 1, 4, paints.fill(front));
  // top face
  const topH = h - FRONT_H;
  roundRect(canvas, bx, y, bw, topH, 5, paints.fill(top));
  roundRect(canvas, bx + 2, y + 2, bw - 4, topH - 4, 3.5, paints.fill('#FFFFFF', 0.25));
  // edge line between top and front
  canvas.drawLine(bx + 3, y + topH - 0.5, bx + bw - 3, y + topH - 0.5, paints.stroke(COUNTER_EDGE, 1.2));
  return { x: bx, y, w: bw, h: topH };
}

/** Pulsing highlight ring drawn under a station that the local chef can use. */
export function drawHighlight(canvas: SkCanvas, s: StationRenderState, time: number, enabled: boolean): void {
  if (s.highlight < 0.02) return;
  const { x, y, w, h } = s.def;
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  const grow = 3 * pulse * s.highlight;
  const color = enabled ? '#FFD166' : '#FFFFFF';
  canvas.drawRRect({ rect: { x: x - grow, y: y - grow, width: w + grow * 2, height: h + grow * 2 }, rx: 8, ry: 8 }, paints.stroke(color, 3, 0.9 * s.highlight));
  canvas.drawRRect({ rect: { x: x - grow - 2, y: y - grow - 2, width: w + grow * 2 + 4, height: h + grow * 2 + 4 }, rx: 10, ry: 10 }, paints.stroke(color, 2, 0.3 * s.highlight));
}

/** Progress pill above a station (chop or cook). */
function drawProgress(canvas: SkCanvas, cx: number, top: number, progress: number, color: string): void {
  if (progress <= 0.001) return;
  const w = 30;
  const h = 6;
  const x = cx - w / 2;
  const y = top - 10;
  roundRect(canvas, x - 1, y - 1, w + 2, h + 2, 4, paints.fill('#3B2A2A', 0.7));
  roundRect(canvas, x, y, w, h, 3, paints.fill('#FFF4E3'));
  roundRect(canvas, x, y, Math.max(h, w * clamp01(progress)), h, 3, paints.fill(color));
}

/** Little "pop" scale when the station contents change. */
function popScale(s: StationRenderState): number {
  return 1 + Math.sin(s.popT * Math.PI) * 0.22;
}

export function drawStation(canvas: SkCanvas, s: StationRenderState, time: number, chefs: Map<string, ChefRenderState>): void {
  const { x, y, w, h } = s.def;
  const cx = x + w / 2;
  switch (s.def.type) {
    case 'crate':
      drawCrate(canvas, s, time);
      break;
    case 'fridge':
      drawFridge(canvas, s, time);
      break;
    case 'board':
      drawBoard(canvas, s, time, chefs);
      break;
    case 'stove_pan':
      drawStovePan(canvas, s, time);
      break;
    case 'stove_pot':
      drawStovePot(canvas, s, time);
      break;
    case 'assembly':
      drawAssembly(canvas, s, time);
      break;
    case 'delivery':
      drawDelivery(canvas, s, time);
      break;
    case 'trash':
      drawTrash(canvas, s, time);
      break;
    default:
      drawPlainCounter(canvas, s);
  }
  // flash when something important happened here
  if (s.flashT > 0) {
    roundRect(canvas, x, y, w, h, 6, paints.fill('#FFFFFF', 0.55 * s.flashT));
  }
  void cx;
}

// --------------------------------------------------------------- stations

function drawPlainCounter(canvas: SkCanvas, s: StationRenderState): void {
  const { x, y, w, h } = s.def;
  const top = drawCounterBlock(canvas, x, y, w, h);
  const item = s.items[0];
  if (item) {
    const cx = top.x + top.w / 2;
    const cy = top.y + top.h / 2;
    ellipse(canvas, cx, cy + 6, 8, 2.5, paints.fill('#3A2418', 0.15));
    drawItem(canvas, item, cx, cy, 1.05 * popScale(s));
  }
}

function drawCrate(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const { x, y, w, h } = s.def;
  const kind = (s.def.ingredient ?? 'tomato') as IngredientKind;
  const inset = 2;
  const bx = x + inset;
  const bw = w - inset * 2;
  canvas.drawRRect({ rect: { x: bx + 1, y: y + 5, width: bw, height: h - 2 }, rx: 4, ry: 4 }, softShadow(0.28, 3));
  // wooden box: front face + top rim
  roundRect(canvas, bx, y + 6, bw, h - 6, 4, paints.fill(WOOD_DARK));
  roundRect(canvas, bx, y + 6, bw, h - FRONT_H - 2, 4, paints.fill(WOOD));
  // planks
  for (let i = 1; i < 3; i++) {
    const py = y + 6 + ((h - FRONT_H - 2) / 3) * i;
    canvas.drawLine(bx + 2, py, bx + bw - 2, py, paints.stroke(WOOD_DARK, 1, 0.5));
  }
  // top opening (dark) with ingredient pile
  roundRect(canvas, bx + 3, y + 2, bw - 6, 16, 3, paints.fill('#6B4226'));
  const wob = Math.sin(time * 2 + s.wobble) * 0.6;
  const item = makeIngredient(kind, 'raw');
  drawItem(canvas, item, bx + bw / 2 - 6, y + 11 + wob * 0.5, 0.78);
  drawItem(canvas, item, bx + bw / 2 + 6, y + 11.5 - wob * 0.5, 0.78);
  drawItem(canvas, item, bx + bw / 2, y + 7 + wob, 0.8);
  // label plate
  roundRect(canvas, bx + 5, y + h - FRONT_H - 1, bw - 10, 6, 2, paints.fill('#FFF4E3'));
  canvas.drawLine(bx + 8, y + h - FRONT_H + 2, bx + bw - 8, y + h - FRONT_H + 2, paints.stroke(WOOD_DARK, 1.5));
}

function drawFridge(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const { x, y, w, h } = s.def;
  const bx = x + 2;
  const bw = w - 4;
  const topY = y - 10; // taller than a counter: sticks up along the back wall
  canvas.drawRRect({ rect: { x: bx + 1, y: topY + 6, width: bw, height: h + 8 }, rx: 5, ry: 5 }, softShadow(0.3, 3));
  roundRect(canvas, bx, topY, bw, h + 10, 5, paints.fill('#8FB8E8'));
  roundRect(canvas, bx, topY, bw, h + 10 - FRONT_H + 2, 5, paints.fill('#CFE6FF'));
  // door split + handles
  const split = topY + 20;
  canvas.drawLine(bx + 2, split, bx + bw - 2, split, paints.stroke('#8FB8E8', 1.5));
  roundRect(canvas, bx + bw - 9, topY + 7, 3, 9, 1.5, paints.fill('#5B86B8'));
  roundRect(canvas, bx + bw - 9, split + 4, 3, 10, 1.5, paints.fill('#5B86B8'));
  // frost shine
  roundRect(canvas, bx + 3, topY + 3, 5, 12, 2.5, paints.fill('#FFFFFF', 0.6));
  // meat sticker
  const pulse = 1 + Math.sin(time * 3 + s.wobble) * 0.03;
  canvas.drawCircle(bx + bw / 2 - 2, split + 11, 7.5 * pulse, paints.fill('#FFFFFF'));
  drawItem(canvas, makeIngredient('patty', 'raw'), bx + bw / 2 - 2, split + 11, 0.7 * pulse);
}

function drawBoard(canvas: SkCanvas, s: StationRenderState, time: number, chefs: Map<string, ChefRenderState>): void {
  const { x, y, w, h } = s.def;
  const top = drawCounterBlock(canvas, x, y, w, h);
  const cx = top.x + top.w / 2;
  const cy = top.y + top.h / 2 + 1;
  // cutting board
  const chopping = s.busyBy !== '' && chefs.has(s.busyBy);
  const hit = chopping ? Math.max(0, Math.sin(time * 14)) : 0;
  roundRect(canvas, cx - 13, cy - 8 + hit * 0.6, 26, 16, 3, paints.fill('#D9A066'));
  roundRect(canvas, cx - 11, cy - 6 + hit * 0.6, 22, 12, 2, paints.fill('#E8B77C'));
  canvas.drawCircle(cx + 10, cy - 5 + hit * 0.6, 1.2, paints.fill('#B47A42'));
  const item = s.items[0];
  if (item) {
    const kind = ingredientKind(item);
    const squash = chopping ? 1 + hit * 0.12 : 1;
    canvas.save();
    canvas.translate(cx, cy);
    canvas.scale(squash, 1 / squash);
    drawItem(canvas, item, 0, 0, 1.0 * popScale(s));
    canvas.restore();
    if (chopping && kind && CHOPPABLE.has(kind)) {
      // cut lines appear as progress grows
      const cuts = Math.floor(s.shownProgress * 4);
      for (let i = 0; i < cuts; i++) {
        const lx = cx - 6 + i * 4;
        canvas.drawLine(lx, cy - 7, lx + 1, cy + 7, paints.stroke('#FFFFFF', 1, 0.7));
      }
    }
  } else {
    // idle knife resting on the board
    canvas.save();
    canvas.translate(cx + 7, cy + 1);
    canvas.rotate(-40, 0, 0);
    roundRect(canvas, -1.2, 1, 2.4, 5, 1, paints.fill('#5B3A29'));
    canvas.drawPath(polygon([[-1, 1], [1, 1], [1.4, -8], [-2.2, -6.5]]), paints.fill('#DDE5EE'));
    canvas.restore();
  }
  drawProgress(canvas, cx, y, s.shownProgress, '#5FD39A');
}

function drawBurner(canvas: SkCanvas, cx: number, cy: number, lit: boolean, time: number, seed: number): void {
  canvas.drawCircle(cx, cy, 11, paints.fill('#3A3F4A'));
  canvas.drawCircle(cx, cy, 8.5, paints.fill('#2A2E36'));
  if (lit) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + time * 3;
      const r = 6 + Math.sin(time * 18 + i * 1.7 + seed) * 1.2;
      const fx = cx + Math.cos(a) * r;
      const fy = cy + Math.sin(a) * r * 0.6;
      canvas.drawCircle(fx, fy, 2.2, paints.fill('#FF9A3C', 0.9));
      canvas.drawCircle(fx, fy, 1.1, paints.fill('#FFE08A'));
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      canvas.drawCircle(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6 * 0.6, 0.9, paints.fill('#55606E'));
    }
  }
}

function drawStoveBase(canvas: SkCanvas, s: StationRenderState): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = s.def;
  const top = drawCounterBlock(canvas, x, y, w, h, '#4D5563', '#3A414C', '#2B3039');
  // knobs on the front face
  for (const kx of [x + 12, x + w - 12]) {
    canvas.drawCircle(kx, y + h - FRONT_H / 2 - 1, 2.4, paints.fill('#FFD166'));
    canvas.drawLine(kx, y + h - FRONT_H / 2 - 3, kx, y + h - FRONT_H / 2 - 1, paints.stroke('#8A5A00', 1));
  }
  return top;
}

function drawStovePan(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const top = drawStoveBase(canvas, s);
  const cx = top.x + top.w / 2;
  const cy = top.y + top.h / 2 + 1;
  const cooking = s.cookState === 'cooking';
  drawBurner(canvas, cx, cy, cooking, time, s.wobble);
  // pan with handle (points toward the player, i.e. down-right)
  const jiggle = cooking ? Math.sin(time * 22) * 0.6 : 0;
  canvas.save();
  canvas.translate(jiggle, 0);
  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate(35, 0, 0);
  roundRect(canvas, 8, -2, 14, 4, 2, paints.fill('#2B2D44'));
  canvas.restore();
  ellipse(canvas, cx, cy + 1, 11, 7, paints.fill('#2E3340'));
  ellipse(canvas, cx, cy, 10, 6, paints.fill('#55606E'));
  ellipse(canvas, cx, cy, 8, 4.6, paints.fill('#3A3F4A'));
  const item = s.items[0];
  if (item) {
    const sizzle = cooking ? Math.sin(time * 30) * 0.4 : 0;
    drawItem(canvas, item, cx, cy - 1 + sizzle, 0.9 * popScale(s));
    if (cooking) {
      // oil sparkles
      for (let i = 0; i < 3; i++) {
        const a = time * 9 + i * 2.1;
        canvas.drawCircle(cx + Math.cos(a) * 6, cy + Math.sin(a * 1.3) * 3, 0.8, paints.fill('#FFF3B0', 0.8));
      }
    }
    if (s.cookState === 'done') {
      // ready sparkle
      const tw = (Math.sin(time * 5) + 1) / 2;
      canvas.drawCircle(cx + 8, cy - 7, 1.5 + tw, paints.fill('#FFFFFF', 0.9));
    }
  }
  canvas.restore();
  drawProgress(canvas, cx, s.def.y, cooking ? s.shownProgress : 0, '#FF9A3C');
}

function drawStovePot(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const top = drawStoveBase(canvas, s);
  const cx = top.x + top.w / 2;
  const cy = top.y + top.h / 2 + 1;
  const cooking = s.cookState === 'cooking';
  const done = s.cookState === 'done';
  drawBurner(canvas, cx, cy + 3, cooking, time, s.wobble);
  // pot body
  const bob = cooking ? Math.sin(time * 16) * 0.5 : 0;
  canvas.save();
  canvas.translate(0, bob);
  roundRect(canvas, cx - 11, cy - 6, 22, 15, 4, paints.fill('#B8413E'));
  roundRect(canvas, cx - 11, cy - 6, 22, 11, 4, paints.fill('#E05A55'));
  // handles
  roundRect(canvas, cx - 15, cy - 3, 5, 3, 1.5, paints.fill('#3A3F4A'));
  roundRect(canvas, cx + 10, cy - 3, 5, 3, 1.5, paints.fill('#3A3F4A'));
  // opening: liquid or empty
  ellipse(canvas, cx, cy - 6, 11, 4.5, paints.fill('#8E2F2C'));
  const n = s.items.length;
  if (done) {
    ellipse(canvas, cx, cy - 6, 9.5, 3.5, paints.fill('#FFA94D'));
    canvas.drawCircle(cx - 3, cy - 6.5, 1.3, paints.fill('#FF9A3C'));
    canvas.drawCircle(cx + 3, cy - 5.5, 1.2, paints.fill('#F3D9A4'));
    canvas.drawCircle(cx + 0.5, cy - 7.5, 1, paints.fill('#58C25C'));
  } else if (cooking) {
    ellipse(canvas, cx, cy - 6, 9.5, 3.5, paints.fill('#FFB86B'));
    for (let i = 0; i < 4; i++) {
      const t = (time * 1.6 + i * 0.37) % 1;
      const bx = cx - 6 + ((i * 37) % 12);
      canvas.drawCircle(bx, cy - 6 - t * 2, 1.2 + (1 - t) * 1.2, paints.fill('#FFFFFF', 0.7 * (1 - t)));
    }
  } else if (n > 0) {
    ellipse(canvas, cx, cy - 6, 9.5, 3.5, paints.fill('#BFE3F5'));
    s.items.forEach((it, i) => drawItem(canvas, it, cx - 4 + i * 8, cy - 7, 0.55 * popScale(s)));
  } else {
    ellipse(canvas, cx, cy - 6, 9.5, 3.5, paints.fill('#C9D2DD'));
  }
  canvas.restore();
  drawProgress(canvas, cx, s.def.y, cooking ? s.shownProgress : 0, '#FF9A3C');
}

function drawAssembly(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const { x, y, w, h } = s.def;
  const top = drawCounterBlock(canvas, x, y, w, h, '#FFE9B8', '#E0AD3A', '#B98A22');
  const cx = top.x + top.w / 2;
  const cy = top.y + top.h / 2;
  // checkered towel
  for (let i = 0; i < 4; i++) {
    roundRect(canvas, top.x + 6 + i * 7, top.y + 3, 3.5, top.h - 6, 1, paints.fill('#FFFFFF', 0.45));
  }
  // plate
  const hasDish = s.items.some((it) => it.startsWith('plate:'));
  const glow = hasDish ? (Math.sin(time * 5) + 1) / 2 : 0;
  if (glow > 0) canvas.drawCircle(cx, cy, 14 + glow * 3, paints.fill('#FFF3B0', 0.35 * glow));
  if (!hasDish) drawPlate(canvas, cx, cy + 2, 1.15);
  // stacked ingredients (or the finished dish)
  const pop = popScale(s);
  if (hasDish) {
    const dish = s.items.find((it) => it.startsWith('plate:'))!;
    drawItem(canvas, dish, cx, cy - 1, 1.2 * pop);
  } else {
    s.items.forEach((it, i) => {
      const ox = (i - (s.items.length - 1) / 2) * 9;
      drawItem(canvas, it, cx + ox, cy - 2 - i * 1.5, 0.78 * (i === s.items.length - 1 ? pop : 1));
    });
  }
  // slots indicator (3 dots)
  for (let i = 0; i < 3; i++) {
    const filled = i < s.items.length;
    canvas.drawCircle(top.x + top.w - 8, top.y + 6 + i * 6, 1.8, paints.fill(filled ? '#5FD39A' : '#FFFFFF', filled ? 1 : 0.6));
  }
}

function drawDelivery(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const { x, y, w, h } = s.def;
  // serving hatch: a dark opening framed in wood, with a bell and a tray
  canvas.drawRRect({ rect: { x: x + 2, y: y + 5, width: w - 4, height: h }, rx: 6, ry: 6 }, softShadow(0.3, 3));
  roundRect(canvas, x + 1, y, w - 2, h, 6, paints.fill(WOOD_DARK));
  roundRect(canvas, x + 1, y, w - 2, h - FRONT_H + 1, 6, paints.fill(WOOD));
  roundRect(canvas, x + 6, y + 4, w - 12, h - FRONT_H - 7, 4, paints.fill('#5A3A2A'));
  // moving tray belt stripes inside the hatch
  const off = (time * 20) % 10;
  canvas.save();
  canvas.clipRRect({ rect: { x: x + 6, y: y + 4, width: w - 12, height: h - FRONT_H - 7 }, rx: 4, ry: 4 }, 0, true);
  for (let i = -1; i < (w - 12) / 10 + 1; i++) {
    const sx = x + 6 + i * 10 + off;
    canvas.drawLine(sx, y + 4, sx - 4, y + h - FRONT_H - 3, paints.stroke('#6B4636', 2));
  }
  canvas.restore();
  // "ENTREGA" sign strip
  roundRect(canvas, x + 10, y + h - FRONT_H - 1, w - 20, 7, 3, paints.fill('#5FD39A'));
  for (let i = 0; i < 5; i++) {
    const tw = (Math.sin(time * 6 + i) + 1) / 2;
    canvas.drawCircle(x + 16 + i * ((w - 32) / 4), y + h - FRONT_H + 2.5, 1.3, paints.fill('#FFFFFF', 0.4 + tw * 0.6));
  }
  // bell on the right
  const ring = Math.max(0, Math.sin(time * 1.5)) > 0.97 ? 1 : 0;
  const bx = x + w - 10;
  const by = y + 12;
  canvas.save();
  canvas.rotate(ring * 10, bx, by + 6);
  canvas.drawPath(dome(bx - 5, bx + 5, by + 5, 7), paints.fill('#FFD166'));
  roundRect(canvas, bx - 6, by + 4, 12, 2.5, 1, paints.fill('#E0AD3A'));
  canvas.drawCircle(bx, by - 2.5, 1.5, paints.fill('#E0AD3A'));
  canvas.restore();
  // tiny customer peeking through the hatch
  const peek = Math.sin(time * 1.2 + s.wobble) * 1.5;
  const px = x + 18;
  const py = y + 14 + peek;
  canvas.drawCircle(px, py, 6, paints.fill('#FFD9B8'));
  canvas.drawCircle(px - 2, py - 1, 0.9, paints.fill('#3B2A2A'));
  canvas.drawCircle(px + 2, py - 1, 0.9, paints.fill('#3B2A2A'));
  canvas.drawArc({ x: px - 2, y: py + 1, width: 4, height: 2.5 }, 20, 140, false, paints.stroke('#8B3A3A', 0.9));
  roundRect(canvas, px - 6.5, py - 9, 13, 4, 2, paints.fill('#9B6BFF'));
}

function drawTrash(canvas: SkCanvas, s: StationRenderState, time: number): void {
  const { x, y, w, h } = s.def;
  const cx = x + w / 2;
  const cy = y + h / 2;
  canvas.drawRRect({ rect: { x: cx - 11, y: cy - 8, width: 22, height: 24 }, rx: 5, ry: 5 }, softShadow(0.3, 3));
  // bin body
  roundRect(canvas, cx - 11, cy - 10, 22, 24, 5, paints.fill(STEEL_DARK));
  roundRect(canvas, cx - 11, cy - 10, 22, 19, 5, paints.fill(STEEL));
  for (let i = -1; i <= 1; i++) canvas.drawLine(cx + i * 6, cy - 6, cx + i * 6, cy + 6, paints.stroke(STEEL_DARK, 1.2, 0.6));
  // lid with a slow wobble when recently used
  const wob = s.flashT > 0 ? Math.sin(time * 25) * 3 : 0;
  canvas.save();
  canvas.rotate(wob, cx, cy - 10);
  ellipse(canvas, cx, cy - 10, 12.5, 4.5, paints.fill('#55606E'));
  ellipse(canvas, cx, cy - 11, 11.5, 3.5, paints.fill('#8E9BAA'));
  roundRect(canvas, cx - 3, cy - 14.5, 6, 3, 1.5, paints.fill('#55606E'));
  canvas.restore();
  // recycling-ish mark
  canvas.drawCircle(cx, cy + 1, 3.5, paints.stroke('#5FD39A', 1.4, 0.8));
}

/** Colors for a station highlight depending on player (used by the HUD/button). */
export function playerColor(slot: number): string {
  return PLAYER_COLORS[slot] ?? PLAYER_COLORS[0];
}
