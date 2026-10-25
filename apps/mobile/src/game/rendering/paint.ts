import { BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkFont, type SkPaint, type SkPath, type SkRRect, type SkRect, type SkTypeface } from '@shopify/react-native-skia';

/** Cached paints so a frame never allocates more than it needs. */
class PaintCache {
  private fills = new Map<string, SkPaint>();
  private strokes = new Map<string, SkPaint>();

  fill(color: string, alpha = 1): SkPaint {
    const a = alpha >= 1 ? 1 : Math.round(alpha * 20) / 20;
    const key = a === 1 ? color : `${color}@${a}`;
    let p = this.fills.get(key);
    if (!p) {
      p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(color));
      if (a < 1) p.setAlphaf(a * p.getAlphaf());
      this.fills.set(key, p);
    }
    return p;
  }

  stroke(color: string, width: number, alpha = 1): SkPaint {
    const a = alpha >= 1 ? 1 : Math.round(alpha * 20) / 20;
    const key = `${color}|${width}|${a}`;
    let p = this.strokes.get(key);
    if (!p) {
      p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(color));
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(width);
      p.setStrokeCap(StrokeCap.Round);
      p.setStrokeJoin(StrokeJoin.Round);
      if (a < 1) p.setAlphaf(a * p.getAlphaf());
      this.strokes.set(key, p);
    }
    return p;
  }
}

export const paints = new PaintCache();

const shadowPaints = new Map<string, SkPaint>();
export function softShadow(alpha: number, sigma: number): SkPaint {
  const key = `${Math.round(alpha * 20)}|${sigma}`;
  let p = shadowPaints.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color('#3A2418'));
    p.setAlphaf(alpha);
    p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
    shadowPaints.set(key, p);
  }
  return p;
}

const gradientPaints = new Map<string, SkPaint>();
/** Vertical gradient paint over the given rect (cached by colors + rect). */
export function vGradient(x: number, y: number, h: number, colors: string[]): SkPaint {
  const key = `${colors.join(',')}|${Math.round(y)}|${Math.round(h)}`;
  let p = gradientPaints.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(x, y),
        Skia.Point(x, y + h),
        colors.map((c) => Skia.Color(c)),
        null,
        TileMode.Clamp,
      ),
    );
    gradientPaints.set(key, p);
  }
  return p;
}

export const rect = (x: number, y: number, w: number, h: number): SkRect => Skia.XYWHRect(x, y, w, h);
export const rrect = (x: number, y: number, w: number, h: number, r: number): SkRRect => Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r);

export function ellipse(canvas: SkCanvas, cx: number, cy: number, rx: number, ry: number, paint: SkPaint): void {
  canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
}

export function roundRect(canvas: SkCanvas, x: number, y: number, w: number, h: number, r: number, paint: SkPaint): void {
  canvas.drawRRect(rrect(x, y, w, h, r), paint);
}

export function polygon(points: Array<[number, number]>): SkPath {
  const b = Skia.PathBuilder.Make();
  points.forEach(([px, py], i) => (i === 0 ? b.moveTo(px, py) : b.lineTo(px, py)));
  b.close();
  return b.build();
}

/** Half-dome (bun top, pot lid): flat base from x0..x1 at y, arc rising to y - rise. */
export function dome(x0: number, x1: number, y: number, rise: number): SkPath {
  const b = Skia.PathBuilder.Make();
  b.moveTo(x0, y);
  b.lineTo(x1, y);
  b.arcToOval(Skia.XYWHRect(x0, y - rise, x1 - x0, rise * 2), 0, -180, false);
  b.close();
  return b.build();
}

export function star(cx: number, cy: number, outer: number, inner: number, rot = 0): SkPath {
  const path = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  path.close();
  return path.build();
}

export function heart(cx: number, cy: number, s: number): SkPath {
  const p = Skia.PathBuilder.Make();
  p.moveTo(cx, cy + s * 0.9);
  p.cubicTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.8, cy - s * 1.3, cx, cy - s * 0.5);
  p.cubicTo(cx + s * 0.8, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
  p.close();
  return p.build();
}

/** Fonts at several sizes built from one typeface. */
export class FontSet {
  private cache = new Map<number, SkFont>();
  constructor(private readonly typeface: SkTypeface | null) {}
  get ready(): boolean {
    return this.typeface !== null;
  }
  at(size: number): SkFont | null {
    if (!this.typeface) return null;
    const s = Math.max(4, Math.round(size));
    let f = this.cache.get(s);
    if (!f) {
      f = Skia.Font(this.typeface, s);
      this.cache.set(s, f);
    }
    return f;
  }
}

export interface TextOpts {
  align?: 'left' | 'center' | 'right';
  outline?: string;
  outlineWidth?: number;
  alpha?: number;
}

/** Draws cartoon text (optional outline). `y` is the baseline. */
export function drawText(canvas: SkCanvas, fonts: FontSet, text: string, x: number, y: number, size: number, color: string, opts: TextOpts = {}): number {
  const font = fonts.at(size);
  if (!font) return 0;
  const width = font.measureText(text).width;
  let dx = x;
  if (opts.align === 'center') dx = x - width / 2;
  else if (opts.align === 'right') dx = x - width;
  const alpha = opts.alpha ?? 1;
  if (opts.outline) {
    canvas.drawText(text, dx, y, paints.stroke(opts.outline, opts.outlineWidth ?? Math.max(2, size * 0.22), alpha), font);
  }
  canvas.drawText(text, dx, y, paints.fill(color, alpha), font);
  return width;
}

export function measureText(fonts: FontSet, text: string, size: number): number {
  const font = fonts.at(size);
  return font ? font.measureText(text).width : 0;
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
