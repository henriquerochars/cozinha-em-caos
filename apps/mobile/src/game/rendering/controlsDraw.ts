import type { SkCanvas } from '@shopify/react-native-skia';
import { isActionDef } from '@cozinha/shared';
import type { ClientWorld } from '../engine/ClientWorld';
import type { TouchControls } from '../engine/controls';
import { clamp01, drawText, measureText, paints, roundRect, type FontSet } from './paint';
import { playerColor } from './stations';

const PANEL = '#3B2A2A';
const PANEL_LIGHT = '#4C3838';
const GOLD = '#FFD166';
const GOLD_DARK = '#C9962B';
const INK = '#3B2A2A';
const DISABLED = '#6B5757';
const DISABLED_DARK = '#4F3F3F';

/** The touch controls strip (joystick + action button), in canvas pixels. */
export function drawControls(canvas: SkCanvas, controls: TouchControls, world: ClientWorld, fonts: FontSet, time: number, mySlot: number): void {
  const L = controls.layout;

  // panel
  canvas.drawRect({ x: 0, y: L.zoneY, width: L.width, height: L.zoneH }, paints.fill(PANEL));
  canvas.drawRect({ x: 0, y: L.zoneY, width: L.width, height: 3 }, paints.fill(GOLD));
  // subtle wood grain
  for (let y = L.zoneY + 14; y < L.zoneY + L.zoneH; y += 16) {
    canvas.drawLine(0, y, L.width, y, paints.stroke(PANEL_LIGHT, 1, 0.5));
  }

  drawStick(canvas, controls, mySlot, time);
  drawActionButton(canvas, controls, world, fonts, time);
}

function drawStick(canvas: SkCanvas, controls: TouchControls, mySlot: number, time: number): void {
  const s = controls.stick;
  const R = controls.layout.stickRadius;
  const color = playerColor(mySlot);
  const alpha = s.active ? 1 : 0.55;
  const breathe = s.active ? 1 : 1 + Math.sin(time * 2) * 0.02;

  // base
  canvas.drawCircle(s.baseX, s.baseY + 3, R * breathe, paints.fill('#000000', 0.18 * alpha));
  canvas.drawCircle(s.baseX, s.baseY, R * breathe, paints.fill('#FFFFFF', 0.12 * alpha));
  canvas.drawCircle(s.baseX, s.baseY, R * breathe, paints.stroke('#FFFFFF', 2, 0.5 * alpha));
  // direction hints (little triangles) when idle
  if (!s.active) {
    const d = R * 0.72;
    const t = 5;
    const tri = (cx: number, cy: number, rot: number): void => {
      canvas.save();
      canvas.rotate((rot * 180) / Math.PI, cx, cy);
      const p = [
        [cx, cy - t],
        [cx + t, cy + t * 0.7],
        [cx - t, cy + t * 0.7],
      ] as Array<[number, number]>;
      const path = p.reduce((b, [x, y], i) => (i === 0 ? b.moveTo(x, y) : b.lineTo(x, y)), pathBuilder()).close().build();
      canvas.drawPath(path, paints.fill('#FFFFFF', 0.35 * alpha));
      canvas.restore();
    };
    tri(s.baseX, s.baseY - d, 0);
    tri(s.baseX, s.baseY + d, Math.PI);
    tri(s.baseX - d, s.baseY, -Math.PI / 2);
    tri(s.baseX + d, s.baseY, Math.PI / 2);
  }
  // knob
  const kr = R * 0.46;
  canvas.drawCircle(s.knobX, s.knobY + 3, kr, paints.fill('#000000', 0.25 * alpha));
  canvas.drawCircle(s.knobX, s.knobY, kr, paints.fill(color, alpha));
  canvas.drawCircle(s.knobX - kr * 0.25, s.knobY - kr * 0.3, kr * 0.45, paints.fill('#FFFFFF', 0.35 * alpha));
  canvas.drawCircle(s.knobX, s.knobY, kr, paints.stroke('#FFFFFF', 2, 0.6 * alpha));
}

function drawActionButton(canvas: SkCanvas, controls: TouchControls, world: ClientWorld, fonts: FontSet, time: number): void {
  const b = controls.layout.button;
  const action = world.nearbyAction;
  const enabled = action !== null && isActionDef(action) && world.phase === 'playing';
  const label = enabled && action && isActionDef(action) ? action.labelPt : '';
  const reason = !enabled && action && !isActionDef(action) ? action.reasonPt : '';

  const squash = 1 - Math.sin(clamp01(controls.button.pressT) * Math.PI) * 0.12;
  const pulse = enabled ? 1 + Math.sin(time * 5) * 0.025 : 1;
  const r = b.r * squash * pulse;
  const fill = enabled ? GOLD : DISABLED;
  const rim = enabled ? GOLD_DARK : DISABLED_DARK;
  const lift = controls.button.pressed ? 2 : 6;

  // 3D-ish button: dark rim, lifted face
  canvas.drawCircle(b.x, b.y + lift + 2, r, paints.fill('#000000', 0.25));
  canvas.drawCircle(b.x, b.y + lift, r, paints.fill(rim));
  canvas.drawCircle(b.x, b.y, r, paints.fill(fill));
  canvas.drawCircle(b.x - r * 0.25, b.y - r * 0.32, r * 0.42, paints.fill('#FFFFFF', enabled ? 0.3 : 0.12));
  if (enabled) canvas.drawCircle(b.x, b.y, r + 4 + Math.sin(time * 5) * 2, paints.stroke(GOLD, 2, 0.35));

  // label inside (shrink to fit)
  if (label) {
    let size = 17;
    const maxW = r * 1.7;
    while (size > 9 && measureText(fonts, label, size) > maxW) size -= 1;
    drawText(canvas, fonts, label, b.x, b.y + size * 0.36, size, INK, { align: 'center' });
  } else {
    // hand icon: a simple rounded rect "palm" + dot, hinting "action"
    roundRect(canvas, b.x - 9, b.y - 6, 18, 14, 5, paints.fill('#FFFFFF', 0.35));
    canvas.drawCircle(b.x, b.y - 10, 4, paints.fill('#FFFFFF', 0.35));
  }

  // why not? (reason) above the button
  if (reason) {
    let size = 12;
    const maxW = Math.min(controls.layout.width * 0.55, 220);
    while (size > 8 && measureText(fonts, reason, size) > maxW) size -= 1;
    const w = measureText(fonts, reason, size) + 16;
    const y = b.y - r - 22;
    roundRect(canvas, b.x - w / 2, y - size, w, size + 10, 7, paints.fill('#FFFFFF', 0.12));
    drawText(canvas, fonts, reason, b.x, y + 2, size, '#FFF4E3', { align: 'center' });
  }
}

import { Skia } from '@shopify/react-native-skia';
function pathBuilder() {
  return Skia.PathBuilder.Make();
}
