import type { SkCanvas } from '@shopify/react-native-skia';
import { PLAYER_COLORS } from '@cozinha/shared';
import type { ChefRenderState } from '../engine/ClientWorld';
import { drawItem } from './items';
import { drawText, ellipse, paints, polygon, roundRect, type FontSet } from './paint';

const SKIN = '#FFD9B8';
const SKIN_SHADE = '#F0B998';
const PANTS = '#3C3F5C';
const SHOE = '#2B2D44';
const HAT = '#FFFFFF';
const HAT_SHADE = '#E8ECF4';

export interface ChefPose {
  bounce: number; // vertical body offset (negative = up)
  legL: number; // leg vertical offset
  legR: number;
  armL: { x: number; y: number };
  armR: { x: number; y: number };
  squash: number; // 1 = normal, >1 wider/shorter
  headTilt: number; // radians
  hatBob: number;
  blink: boolean;
  jump: number;
  knife: { angle: number; visible: boolean };
  armsUp: boolean;
}

/** Turns animation clocks + state into a concrete pose. Pure, frame-rate independent. */
export function computePose(c: ChefRenderState, time: number): ChefPose {
  const pose: ChefPose = {
    bounce: 0,
    legL: 0,
    legR: 0,
    armL: { x: 0, y: 0 },
    armR: { x: 0, y: 0 },
    squash: 1,
    headTilt: 0,
    hatBob: 0,
    blink: c.blinking > 0,
    jump: 0,
    knife: { angle: 0, visible: false },
    armsUp: false,
  };
  switch (c.anim) {
    case 'walk': {
      const ph = c.walkPhase;
      pose.bounce = -Math.abs(Math.sin(ph)) * 2.6;
      pose.legL = Math.sin(ph) * 3.2;
      pose.legR = -Math.sin(ph) * 3.2;
      pose.armL = { x: 0, y: -Math.sin(ph) * 2.5 };
      pose.armR = { x: 0, y: Math.sin(ph) * 2.5 };
      pose.squash = 1 + Math.abs(Math.sin(ph)) * 0.04;
      pose.headTilt = Math.sin(ph) * 0.05;
      pose.hatBob = Math.abs(Math.cos(ph)) * 1.2;
      break;
    }
    case 'chop': {
      const ph = time * 14;
      const swing = Math.max(0, Math.sin(ph));
      pose.knife = { angle: -0.9 + swing * 1.4, visible: true };
      pose.armR = { x: 2, y: -6 + swing * 5 };
      pose.armL = { x: 0, y: -3 };
      pose.bounce = swing * 1.2;
      pose.squash = 1 + swing * 0.03;
      pose.headTilt = -0.06 + swing * 0.08;
      break;
    }
    case 'celebrate': {
      const elapsed = 0.9 - c.celebrateT;
      const jumpT = Math.min(1, elapsed / 0.5);
      pose.jump = Math.sin(jumpT * Math.PI) * 11;
      pose.armsUp = true;
      pose.armL = { x: -3, y: -12 + Math.sin(time * 20) * 1.5 };
      pose.armR = { x: 3, y: -12 - Math.sin(time * 20) * 1.5 };
      pose.hatBob = pose.jump * 0.25;
      pose.squash = 1 - pose.jump * 0.006;
      break;
    }
    default: {
      const t = c.idleTime;
      pose.bounce = Math.sin(t * 2.2) * 0.8;
      pose.squash = 1 + Math.sin(t * 2.2) * 0.02;
      pose.headTilt = Math.sin(t * 1.1) * 0.03;
      pose.armL = { x: 0, y: Math.sin(t * 2.2) * 0.6 };
      pose.armR = { x: 0, y: Math.sin(t * 2.2 + 0.4) * 0.6 };
    }
  }
  if (c.carrying && c.anim !== 'chop' && c.anim !== 'celebrate') {
    pose.armL = { x: 0, y: -7 + pose.armL.y * 0.4 };
    pose.armR = { x: 0, y: -7 + pose.armR.y * 0.4 };
  }
  return pose;
}

/**
 * Draws one chef at its feet position (c.x, c.y). ~26 units wide, ~44 tall.
 * Rounded body, big head, chef hat with the player's color band, little legs.
 */
export function drawChef(canvas: SkCanvas, c: ChefRenderState, time: number, fonts: FontSet, isLocal: boolean): void {
  const color = PLAYER_COLORS[c.slot] ?? PLAYER_COLORS[0];
  const dark = shade(color);
  const pose = computePose(c, time);
  const fx = Math.cos(c.facing);
  const fy = Math.sin(c.facing);
  const facingUp = fy < -0.45;
  const sideSign = fx >= 0 ? 1 : -1;

  const x = c.x;
  const feet = c.y;
  const lift = pose.jump;
  const alpha = c.connected ? 1 : 0.45;

  // shadow (shrinks when jumping)
  const shadowScale = 1 - lift / 40;
  ellipse(canvas, x, feet + 1, 13 * shadowScale, 5 * shadowScale, paints.fill('#3A2418', 0.22 * alpha));

  canvas.save();
  canvas.translate(x, feet - lift);

  // item carried behind the chef when facing up (drawn first)
  if (c.carrying && facingUp) drawCarried(canvas, c, pose, fx, fy, time, true);

  // legs
  const legW = 7;
  const legH = 8;
  for (const [side, off] of [[-1, pose.legL], [1, pose.legR]] as const) {
    const lx = side * 5 - legW / 2;
    const ly = -legH + off * 0.35 - 1;
    roundRect(canvas, lx, ly - 3, legW, legH + 3, 3, paints.fill(PANTS, alpha));
    roundRect(canvas, lx - 0.5, ly + legH - 4 + Math.max(0, -off) * 0.3, legW + 1, 4, 2, paints.fill(SHOE, alpha));
  }

  // body (apron + colored jacket)
  const bodyW = 24 * pose.squash;
  const bodyH = 21 / pose.squash;
  const bodyBottom = -6 + pose.bounce;
  const bodyTop = bodyBottom - bodyH;
  roundRect(canvas, -bodyW / 2, bodyTop, bodyW, bodyH, 9, paints.fill(color, alpha));
  // belly highlight
  roundRect(canvas, -bodyW / 2 + 3, bodyTop + 3, bodyW * 0.35, bodyH * 0.45, 5, paints.fill('#FFFFFF', 0.18 * alpha));
  // apron
  if (!facingUp) {
    const apronW = bodyW * 0.56;
    roundRect(canvas, -apronW / 2 + fx * 2, bodyTop + 6, apronW, bodyH - 7, 5, paints.fill('#FFF8EE', alpha));
    roundRect(canvas, -apronW / 2 + fx * 2 + 3, bodyTop + 10, apronW - 6, 3, 1.5, paints.fill('#E8DCCB', 0.9 * alpha));
    // apron straps
    canvas.drawLine(-apronW / 2 + fx * 2 + 2, bodyTop + 6, -3 + fx * 2, bodyTop + 1, paints.stroke('#FFF8EE', 2, alpha));
    canvas.drawLine(apronW / 2 + fx * 2 - 2, bodyTop + 6, 3 + fx * 2, bodyTop + 1, paints.stroke('#FFF8EE', 2, alpha));
  } else {
    // back: belt knot
    canvas.drawLine(-5, bodyTop + 7, 5, bodyTop + 7, paints.stroke('#FFF8EE', 2.5, alpha));
  }

  // arms
  const armY = bodyTop + 9;
  const drawArm = (side: number, a: { x: number; y: number }) => {
    const ax = side * (bodyW / 2 + 1) + a.x + (c.carrying && !facingUp ? fx * 6 - side * 4 : 0);
    const ay = armY + a.y;
    canvas.drawLine(side * (bodyW / 2 - 4), bodyTop + 6, ax, ay, paints.stroke(color, 5.5, alpha));
    canvas.drawCircle(ax, ay, 3.6, paints.fill(SKIN, alpha));
  };
  drawArm(-1, pose.armL);
  drawArm(1, pose.armR);

  // knife while chopping
  if (pose.knife.visible) {
    const hx = sideSign * (bodyW / 2 + 1) + pose.armR.x;
    const hy = armY + pose.armR.y;
    canvas.save();
    canvas.translate(hx, hy);
    canvas.rotate((pose.knife.angle * 180) / Math.PI * sideSign, 0, 0);
    roundRect(canvas, -1.5, -3, 3, 6, 1, paints.fill('#5B3A29'));
    canvas.drawPath(polygon([[-1.2, -3], [1.2, -3], [1.6, -14], [-2.8, -12]]), paints.fill('#DDE5EE'));
    canvas.restore();
  }

  // head
  const headR = 11;
  const headY = bodyTop - headR + 4 + pose.bounce * 0.3;
  canvas.save();
  canvas.rotate((pose.headTilt * 180) / Math.PI, 0, headY);
  canvas.drawCircle(0, headY, headR, paints.fill(SKIN, alpha));
  // cheeks/shade
  ellipse(canvas, 0, headY + 7, headR * 0.8, 3, paints.fill(SKIN_SHADE, 0.5 * alpha));
  if (!facingUp) {
    const ex = fx * 3.2;
    const ey = headY + 1 + fy * 1.5;
    const eyeGap = 4.2 - Math.abs(fx) * 1.2;
    if (pose.blink) {
      canvas.drawLine(ex - eyeGap - 1.4, ey, ex - eyeGap + 1.4, ey, paints.stroke('#3B2A2A', 1.4, alpha));
      canvas.drawLine(ex + eyeGap - 1.4, ey, ex + eyeGap + 1.4, ey, paints.stroke('#3B2A2A', 1.4, alpha));
    } else {
      ellipse(canvas, ex - eyeGap, ey, 1.7, 2.1, paints.fill('#3B2A2A', alpha));
      ellipse(canvas, ex + eyeGap, ey, 1.7, 2.1, paints.fill('#3B2A2A', alpha));
      canvas.drawCircle(ex - eyeGap + 0.6, ey - 0.7, 0.6, paints.fill('#FFFFFF', alpha));
      canvas.drawCircle(ex + eyeGap + 0.6, ey - 0.7, 0.6, paints.fill('#FFFFFF', alpha));
    }
    // blush
    ellipse(canvas, ex - eyeGap - 1.5, ey + 3.5, 2, 1.1, paints.fill('#FF9D9D', 0.45 * alpha));
    ellipse(canvas, ex + eyeGap + 1.5, ey + 3.5, 2, 1.1, paints.fill('#FF9D9D', 0.45 * alpha));
    // mouth
    const smile = c.anim === 'celebrate' ? 1.6 : 1;
    canvas.drawArc({ x: ex - 2.5 * smile, y: ey + 2.5, width: 5 * smile, height: 3.5 * smile }, 20, 140, false, paints.stroke('#8B3A3A', 1.2, alpha));
  } else {
    // back of the head: a little hair tuft
    ellipse(canvas, 0, headY + 5, 7, 4, paints.fill('#8B5A3C', alpha));
  }
  // hat: band + puffy top
  const hatBase = headY - headR + 3;
  roundRect(canvas, -headR - 1, hatBase - 3, (headR + 1) * 2, 7, 3, paints.fill(HAT, alpha));
  roundRect(canvas, -headR - 1, hatBase - 1, (headR + 1) * 2, 2.5, 1, paints.fill(dark, alpha));
  const puffY = hatBase - 8 - pose.hatBob;
  canvas.drawCircle(-6, puffY + 1, 6, paints.fill(HAT_SHADE, alpha));
  canvas.drawCircle(6, puffY + 1, 6, paints.fill(HAT_SHADE, alpha));
  canvas.drawCircle(0, puffY - 2, 7.5, paints.fill(HAT, alpha));
  canvas.drawCircle(-5, puffY + 1.5, 5, paints.fill(HAT, alpha));
  canvas.drawCircle(5, puffY + 1.5, 5, paints.fill(HAT, alpha));
  canvas.restore();

  // carried item in front
  if (c.carrying && !facingUp) drawCarried(canvas, c, pose, fx, fy, time, false);

  canvas.restore();

  // name tag
  const tagY = feet - lift - 58 - pose.hatBob;
  const label = c.name;
  const size = 9;
  const font = fonts.at(size);
  if (font) {
    const w = font.measureText(label).width + 10;
    roundRect(canvas, x - w / 2, tagY - 9, w, 12, 6, paints.fill(isLocal ? color : '#3B2A2A', 0.85 * alpha));
    drawText(canvas, fonts, label, x, tagY, size, '#FFFFFF', { align: 'center', alpha });
  }
  if (!c.connected) {
    drawText(canvas, fonts, '…', x, tagY - 12, 12, '#FFFFFF', { align: 'center', outline: '#3B2A2A' });
  }
}

function drawCarried(canvas: SkCanvas, c: ChefRenderState, pose: ChefPose, fx: number, fy: number, time: number, behind: boolean): void {
  const pop = 1 + Math.sin(c.pickupT * Math.PI) * 0.35;
  const bob = Math.sin(time * 6) * 0.8 + pose.bounce * 0.5;
  const ix = fx * 7;
  const iy = (behind ? -36 : -27) + bob + (behind ? 0 : fy * 2);
  ellipse(canvas, ix, iy + 7, 7, 2.2, paints.fill('#3A2418', 0.15));
  drawItem(canvas, c.carrying, ix, iy, 1.05 * pop);
}

export function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) * 0.7);
  const g = Math.max(0, ((n >> 8) & 255) * 0.7);
  const b = Math.max(0, (n & 255) * 0.7);
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
