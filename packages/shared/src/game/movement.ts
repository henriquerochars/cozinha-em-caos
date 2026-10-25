import type { Rect } from '../constants/map';
import { INTERACT_REACH, PLAYER_RADIUS, PLAYER_SPEED } from '../constants/world';

export interface Vec2 {
  x: number;
  y: number;
}

export interface MovingBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** facing angle in radians (0 = right, PI/2 = down) */
  facing: number;
}

export interface MoveInput {
  x: number;
  y: number;
}

export function clampInput(input: MoveInput): MoveInput {
  let x = Number.isFinite(input.x) ? input.x : 0;
  let y = Number.isFinite(input.y) ? input.y : 0;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

/** Deterministic step shared by server and client (prediction). */
export function stepBody(body: MovingBody, input: MoveInput, dtSeconds: number, solids: readonly Rect[], speed = PLAYER_SPEED): void {
  const inp = clampInput(input);
  const targetVx = inp.x * speed;
  const targetVy = inp.y * speed;

  // snappy acceleration, a bit softer deceleration -> playful feel without sliding
  const accel = inp.x !== 0 || inp.y !== 0 ? 18 : 22;
  const k = Math.min(1, accel * dtSeconds);
  body.vx += (targetVx - body.vx) * k;
  body.vy += (targetVy - body.vy) * k;
  if (Math.abs(body.vx) < 0.5) body.vx = 0;
  if (Math.abs(body.vy) < 0.5) body.vy = 0;

  if (inp.x !== 0 || inp.y !== 0) {
    body.facing = Math.atan2(inp.y, inp.x);
  }

  // move axis-separated for smooth sliding along obstacles
  const nx = body.x + body.vx * dtSeconds;
  if (!circleHitsAny(nx, body.y, PLAYER_RADIUS, solids)) {
    body.x = nx;
  } else {
    body.vx = 0;
  }
  const ny = body.y + body.vy * dtSeconds;
  if (!circleHitsAny(body.x, ny, PLAYER_RADIUS, solids)) {
    body.y = ny;
  } else {
    body.vy = 0;
  }
}

export function circleHitsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export function circleHitsAny(cx: number, cy: number, r: number, solids: readonly Rect[]): boolean {
  for (const s of solids) {
    if (circleHitsRect(cx, cy, r, s)) return true;
  }
  return false;
}

export function distanceToRect(cx: number, cy: number, rect: Rect): number {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return Math.hypot(cx - closestX, cy - closestY);
}

/**
 * Finds the station the player can interact with: the closest one within reach,
 * with a preference for the one the player is facing.
 */
export function findNearbyStation<T extends Rect & { id: string }>(
  px: number,
  py: number,
  facing: number,
  stations: readonly T[],
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  for (const s of stations) {
    const d = distanceToRect(px, py, s);
    if (d > PLAYER_RADIUS + INTERACT_REACH) continue;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const toX = cx - px;
    const toY = cy - py;
    const len = Math.hypot(toX, toY) || 1;
    const dot = (toX / len) * fx + (toY / len) * fy; // 1 = facing it, -1 = facing away
    const score = d - dot * 12;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
