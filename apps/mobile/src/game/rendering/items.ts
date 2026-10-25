import type { SkCanvas } from '@shopify/react-native-skia';
import { dishRecipe, ingredientKind, ingredientState, type ItemCode } from '@cozinha/shared';
import { dome, ellipse, paints, polygon, roundRect } from './paint';

export const ITEM_COLORS: Record<string, string[]> = {
  tomato: ['#FF5A5A', '#E03C3C', '#FFD0D0'],
  lettuce: ['#6DD47E', '#43B35A', '#C9F5CF'],
  bread: ['#F2B36A', '#D9924A', '#FFE3B8'],
  patty: ['#B86A4A', '#8A4A33', '#6A3323'],
  carrot: ['#FF9A3C', '#E67E22', '#58C25C'],
  potato: ['#E3C089', '#C9A067', '#FFF0C8'],
  soup: ['#FFA94D', '#F08C2E', '#FFE0B0'],
  plate: ['#FFFFFF', '#E6ECF2'],
};

/** Colors used by chopping particles for an item. */
export function itemParticleColors(code: ItemCode): string[] {
  const kind = ingredientKind(code) ?? dishRecipe(code) ?? 'plate';
  return ITEM_COLORS[kind] ?? ['#ffffff'];
}

/**
 * Draws an ingredient or dish centered at (cx, cy). `s` scales a ~16 unit icon.
 * Everything is procedural vector art so it stays crisp at any resolution.
 */
export function drawItem(canvas: SkCanvas, code: ItemCode, cx: number, cy: number, s = 1): void {
  if (!code) return;
  const recipe = dishRecipe(code);
  if (recipe) {
    drawDish(canvas, recipe, cx, cy, s);
    return;
  }
  const kind = ingredientKind(code);
  const state = ingredientState(code);
  if (!kind) return;
  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(s, s);
  switch (kind) {
    case 'tomato':
      state === 'chopped' ? drawTomatoSlices(canvas) : drawTomato(canvas);
      break;
    case 'lettuce':
      state === 'chopped' ? drawLettuceChopped(canvas) : drawLettuce(canvas);
      break;
    case 'bread':
      drawBun(canvas, 0, 0, 1);
      break;
    case 'patty':
      drawPatty(canvas, 0, 0, state === 'cooked');
      break;
    case 'carrot':
      state === 'chopped' ? drawCarrotSlices(canvas) : drawCarrot(canvas);
      break;
    case 'potato':
      state === 'chopped' ? drawPotatoCubes(canvas) : drawPotato(canvas);
      break;
    default:
      if (kind === 'soup') drawSoupBowl(canvas, 0, 0);
  }
  canvas.restore();
}

function drawTomato(c: SkCanvas): void {
  ellipse(c, 0, 1, 7.5, 7, paints.fill('#FF5A5A'));
  ellipse(c, -2.5, -1.5, 2.2, 1.4, paints.fill('#FFD0D0', 0.8));
  // leaf
  c.drawPath(polygon([[0, -6], [-4, -8.5], [-1, -6.5], [0, -9.5], [1, -6.5], [4, -8.5]]), paints.fill('#43B35A'));
}
function drawTomatoSlices(c: SkCanvas): void {
  const slice = (x: number, y: number, r: number) => {
    c.drawCircle(x, y, r, paints.fill('#FF5A5A'));
    c.drawCircle(x, y, r * 0.62, paints.fill('#FF8B8B'));
    c.drawCircle(x, y, r * 0.2, paints.fill('#FFD0D0'));
  };
  slice(-4, 2, 4.2);
  slice(4.5, 1, 4.2);
  slice(0.5, -4, 4);
}
function drawLettuce(c: SkCanvas): void {
  ellipse(c, 0, 1, 8, 6.5, paints.fill('#43B35A'));
  ellipse(c, 0, 0, 6.5, 5, paints.fill('#6DD47E'));
  ellipse(c, -1, -1, 3.5, 2.5, paints.fill('#C9F5CF', 0.75));
  c.drawPath(polygon([[-7, 2], [-5, -2], [-3, 1]]), paints.fill('#43B35A'));
  c.drawPath(polygon([[7, 2], [5, -2], [3, 1]]), paints.fill('#43B35A'));
}
function drawLettuceChopped(c: SkCanvas): void {
  const bits: Array<[number, number, number]> = [[-5, 2, 0.4], [0, -3, -0.3], [5, 1, 0.8], [-1, 4, 1.2], [3, -4, 0.1]];
  for (const [x, y, rot] of bits) {
    c.save();
    c.rotate((rot * 180) / Math.PI, x, y);
    roundRect(c, x - 3.5, y - 2.5, 7, 5, 2, paints.fill('#6DD47E'));
    roundRect(c, x - 2, y - 1.5, 3, 2, 1, paints.fill('#C9F5CF', 0.8));
    c.restore();
  }
}
export function drawBun(c: SkCanvas, x: number, y: number, s: number): void {
  // bottom
  roundRect(c, x - 8 * s, y + 1 * s, 16 * s, 5 * s, 2.5 * s, paints.fill('#D9924A'));
  // top dome
  c.drawPath(dome(x - 8 * s, x + 8 * s, y + 1 * s, 7 * s), paints.fill('#F2B36A'));
  // sesame
  for (const [sx, sy] of [[-3, -3], [1, -4.5], [4, -2]] as const) ellipse(c, x + sx * s, y + sy * s, 1.1 * s, 0.7 * s, paints.fill('#FFF3D6'));
}
export function drawPatty(c: SkCanvas, x: number, y: number, cooked: boolean): void {
  const top = cooked ? '#8A4A33' : '#D97A6E';
  const side = cooked ? '#6A3323' : '#B85E55';
  ellipse(c, x, y + 2, 8, 3.5, paints.fill(side));
  ellipse(c, x, y, 8, 4, paints.fill(top));
  if (cooked) {
    c.drawLine(x - 4, y - 1.2, x + 1, y - 1.2, paints.stroke('#4A2316', 1));
    c.drawLine(x - 2, y + 1, x + 4, y + 1, paints.stroke('#4A2316', 1));
  } else {
    ellipse(c, x - 2, y - 1, 2, 1, paints.fill('#F1A69C', 0.7));
  }
}
function drawCarrot(c: SkCanvas): void {
  c.save();
  c.rotate(-35, 0, 0);
  c.drawPath(polygon([[-3.5, -4], [3.5, -4], [0.6, 9], [-0.6, 9]]), paints.fill('#FF9A3C'));
  c.drawLine(-1.5, -1, 1.5, -1, paints.stroke('#E67E22', 0.8));
  c.drawLine(-1, 2.5, 1, 2.5, paints.stroke('#E67E22', 0.8));
  c.drawPath(polygon([[-2, -4], [-4, -9], [-0.5, -5]]), paints.fill('#58C25C'));
  c.drawPath(polygon([[2, -4], [4, -9], [0.5, -5]]), paints.fill('#58C25C'));
  c.drawPath(polygon([[-0.5, -4.5], [0, -10], [0.8, -4.5]]), paints.fill('#43B35A'));
  c.restore();
}
function drawCarrotSlices(c: SkCanvas): void {
  for (const [x, y] of [[-4.5, 2], [4, 2.5], [0, -3.5]] as const) {
    c.drawCircle(x, y, 3.8, paints.fill('#FF9A3C'));
    c.drawCircle(x, y, 2.2, paints.fill('#FFB46A'));
    c.drawCircle(x, y, 0.8, paints.fill('#FFD9A8'));
  }
}
function drawPotato(c: SkCanvas): void {
  c.save();
  c.rotate(-15, 0, 0);
  ellipse(c, 0, 0, 8, 5.5, paints.fill('#E3C089'));
  ellipse(c, -2.5, -1.5, 2.5, 1.5, paints.fill('#FFF0C8', 0.6));
  for (const [x, y] of [[3, 1.5], [-1, 2.5], [4.5, -1.5]] as const) c.drawCircle(x, y, 0.8, paints.fill('#B38A4D'));
  c.restore();
}
function drawPotatoCubes(c: SkCanvas): void {
  for (const [x, y, r] of [[-4.5, 2, 10], [3.5, 2.5, -15], [-0.5, -3.5, 25]] as const) {
    c.save();
    c.rotate(r, x, y);
    roundRect(c, x - 3.2, y - 3.2, 6.4, 6.4, 1.5, paints.fill('#F3D9A4'));
    roundRect(c, x - 2, y - 2, 2.4, 2.4, 0.8, paints.fill('#FFF4D6', 0.8));
    c.restore();
  }
}
export function drawSoupBowl(c: SkCanvas, x: number, y: number, s = 1): void {
  ellipse(c, x, y + 3 * s, 9 * s, 4 * s, paints.fill('#E6ECF2'));
  ellipse(c, x, y + 1.5 * s, 9 * s, 5 * s, paints.fill('#FFFFFF'));
  ellipse(c, x, y, 7.2 * s, 3.4 * s, paints.fill('#FFA94D'));
  c.drawCircle(x - 2.5 * s, y - 0.5 * s, 1.1 * s, paints.fill('#FF9A3C'));
  c.drawCircle(x + 2.5 * s, y + 0.5 * s, 1 * s, paints.fill('#F3D9A4'));
  c.drawCircle(x + 0.5 * s, y - 1.2 * s, 0.9 * s, paints.fill('#58C25C'));
}

export function drawPlate(c: SkCanvas, x: number, y: number, s = 1): void {
  ellipse(c, x, y + 2.5 * s, 11 * s, 4.5 * s, paints.fill('#D5DEE8'));
  ellipse(c, x, y + 1.5 * s, 11 * s, 4.5 * s, paints.fill('#FFFFFF'));
  ellipse(c, x, y + 1.5 * s, 7.5 * s, 2.8 * s, paints.fill('#EEF3F8'));
}

export function drawDish(canvas: SkCanvas, recipe: string, cx: number, cy: number, s = 1): void {
  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(s, s);
  switch (recipe) {
    case 'salad':
      drawPlate(canvas, 0, 2);
      ellipse(canvas, 0, -0.5, 7, 4, paints.fill('#43B35A'));
      ellipse(canvas, -1, -2, 5, 3, paints.fill('#6DD47E'));
      canvas.drawCircle(3, -1, 2.2, paints.fill('#FF5A5A'));
      canvas.drawCircle(-3.5, 0, 1.9, paints.fill('#FF5A5A'));
      canvas.drawCircle(0.5, -3.5, 1.6, paints.fill('#FF8B8B'));
      break;
    case 'burger':
      drawPlate(canvas, 0, 5);
      roundRect(canvas, -7, 1, 14, 4, 2, paints.fill('#D9924A')); // bottom bun
      ellipse(canvas, 0, 0.5, 7.5, 2.4, paints.fill('#8A4A33')); // patty
      ellipse(canvas, 0, -1.5, 8, 2.2, paints.fill('#6DD47E')); // lettuce
      canvas.drawPath(dome(-7, 7, -1.5, 6.5), paints.fill('#F2B36A'));
      for (const [sx, sy] of [[-2.5, -4.5], [1, -6], [3.5, -4]] as const) ellipse(canvas, sx, sy, 1, 0.65, paints.fill('#FFF3D6'));
      break;
    case 'soup':
      drawSoupBowl(canvas, 0, 0, 1.05);
      break;
    default:
      drawPlate(canvas, 0, 0);
  }
  canvas.restore();
}
