import type { SkCanvas } from '@shopify/react-native-skia';
import { WORLD_H, WORLD_W } from '@cozinha/shared';
import type { FxSystem } from '../engine/fx';
import { drawItem } from './items';
import { clamp01, drawText, easeInOut, easeOutBack, paints, roundRect, star, type FontSet } from './paint';

/** Particles, popups and flying dishes (drawn after the world, before the overlay). */
export function drawFx(canvas: SkCanvas, fx: FxSystem, fonts: FontSet): void {
  for (const f of fx.flying) {
    const t = clamp01(f.t / f.duration);
    const e = easeInOut(t);
    const x = f.fromX + (f.toX - f.fromX) * e;
    const arc = Math.sin(t * Math.PI) * 30;
    const y = f.fromY + (f.toY - f.fromY) * e - arc;
    const s = 1.1 - t * 0.3;
    canvas.drawOval({ x: x - 8, y: f.fromY + (f.toY - f.fromY) * e + 4, width: 16, height: 5 }, paints.fill('#3A2418', 0.18 * (1 - t)));
    drawItem(canvas, f.item, x, y, s);
  }

  for (const p of fx.particles) {
    const life = clamp01(p.life / p.maxLife);
    const alpha = p.shape === 'puff' ? life * 0.8 : Math.min(1, life * 1.6);
    switch (p.shape) {
      case 'star': {
        const s = p.size * (0.6 + life * 0.6);
        canvas.drawPath(star(p.x, p.y, s, s * 0.45, p.rot), paints.fill(p.color, alpha));
        break;
      }
      case 'square': {
        canvas.save();
        canvas.rotate((p.rot * 180) / Math.PI, p.x, p.y);
        canvas.drawRect({ x: p.x - p.size / 2, y: p.y - p.size / 2, width: p.size, height: p.size }, paints.fill(p.color, alpha));
        canvas.restore();
        break;
      }
      case 'puff': {
        const s = p.size * (1 + (1 - life) * 1.4);
        canvas.drawCircle(p.x, p.y, s, paints.fill('#FFFFFF', alpha * 0.7));
        break;
      }
      default:
        canvas.drawCircle(p.x, p.y, p.size * (0.5 + life * 0.5), paints.fill(p.color, alpha));
    }
  }

  for (const p of fx.popups) {
    const life = clamp01(p.life / p.maxLife);
    const appear = easeOutBack(clamp01((1 - life) * 4));
    const alpha = Math.min(1, life * 3);
    drawText(canvas, fonts, p.text, p.x, p.y, p.size * appear, p.color, { align: 'center', outline: '#3B2A2A', outlineWidth: 3, alpha });
  }
}

/** Full-screen banners: countdown numbers, "VALENDO!", pause, end of match. */
export function drawBanner(canvas: SkCanvas, fx: FxSystem, fonts: FontSet): void {
  const b = fx.banner;
  if (!b) return;
  const t = 1 - clamp01(b.life / b.maxLife);
  const scale = easeOutBack(clamp01(t * 3));
  const fade = b.life < 0.3 ? b.life / 0.3 : 1;
  const cx = WORLD_W / 2;
  const cy = WORLD_H * 0.42;
  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(scale, scale);
  canvas.translate(-cx, -cy);
  const size = 34;
  const w = Math.max(120, b.text.length * size * 0.6 + 40);
  roundRect(canvas, cx - w / 2, cy - 30, w, b.sub ? 64 : 50, 16, paints.fill('#3B2A2A', 0.75 * fade));
  drawText(canvas, fonts, b.text, cx, cy + 8, size, b.color, { align: 'center', outline: '#3B2A2A', outlineWidth: 5, alpha: fade });
  if (b.sub) drawText(canvas, fonts, b.sub, cx, cy + 27, 12, '#FFF4E3', { align: 'center', alpha: fade });
  canvas.restore();
}
