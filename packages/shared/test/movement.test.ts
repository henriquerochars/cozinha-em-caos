import { describe, expect, it } from 'vitest';
import { KITCHEN, PLAYER_RADIUS, SOLIDS, STATIONS, SPAWN_POINTS, circleHitsAny, findNearbyStation, stepBody, type MovingBody } from '../src';

const body = (x: number, y: number): MovingBody => ({ x, y, vx: 0, vy: 0, facing: 0 });

describe('movement', () => {
  it('moves smoothly toward the input direction', () => {
    const b = body(180, 400);
    for (let i = 0; i < 30; i++) stepBody(b, { x: 1, y: 0 }, 1 / 60, SOLIDS);
    expect(b.x).toBeGreaterThan(200);
    expect(b.y).toBeCloseTo(400, 3);
    expect(b.facing).toBeCloseTo(0);
  });
  it('clamps diagonal input to unit length', () => {
    const a = body(180, 340);
    const b = body(180, 340);
    for (let i = 0; i < 30; i++) {
      stepBody(a, { x: 1, y: 0 }, 1 / 60, SOLIDS);
      stepBody(b, { x: 1, y: 1 }, 1 / 60, SOLIDS);
    }
    const da = a.x - 180;
    const db = Math.hypot(b.x - 180, b.y - 340);
    expect(db).toBeCloseTo(da, 0);
  });
  it('never enters walls or stations', () => {
    const b = body(SPAWN_POINTS[0]!.x, SPAWN_POINTS[0]!.y);
    for (let i = 0; i < 600; i++) {
      stepBody(b, { x: 0, y: 1 }, 1 / 60, SOLIDS); // push down into the bottom wall
      expect(circleHitsAny(b.x, b.y, PLAYER_RADIUS, SOLIDS)).toBe(false);
    }
    expect(b.y).toBeLessThanOrEqual(KITCHEN.y + KITCHEN.h - PLAYER_RADIUS + 0.01);
    for (let i = 0; i < 600; i++) {
      stepBody(b, { x: -1, y: -1 }, 1 / 60, SOLIDS);
      expect(circleHitsAny(b.x, b.y, PLAYER_RADIUS, SOLIDS)).toBe(false);
    }
  });
  it('slides along obstacles instead of sticking', () => {
    const b = body(80, 330); // left of island, moving diagonally down-right into it
    const startX = b.x;
    for (let i = 0; i < 60; i++) stepBody(b, { x: 1, y: -1 }, 1 / 60, SOLIDS);
    expect(b.x).toBeGreaterThan(startX + 20);
  });
  it('spawn points are free space', () => {
    for (const s of SPAWN_POINTS) expect(circleHitsAny(s.x, s.y, PLAYER_RADIUS, SOLIDS)).toBe(false);
  });
});

describe('findNearbyStation', () => {
  it('finds the station in front of the player and nothing when far away', () => {
    const crate = STATIONS.find((s) => s.id === 'crate_tomato')!;
    const px = crate.x + crate.w / 2;
    const py = crate.y + crate.h + PLAYER_RADIUS + 4;
    expect(findNearbyStation(px, py, -Math.PI / 2, STATIONS)?.id).toBe('crate_tomato');
    expect(findNearbyStation(180, 400, 0, STATIONS)).toBeNull();
  });
  it('prefers the station the player is facing when two are in reach', () => {
    const left = STATIONS.find((s) => s.id === 'crate_lettuce')!;
    const right = STATIONS.find((s) => s.id === 'crate_tomato')!;
    const px = right.x; // exactly on the seam between the two crates
    const py = left.y + left.h + PLAYER_RADIUS + 2;
    expect(findNearbyStation(px, py, Math.atan2(-1, -0.6), STATIONS)?.id).toBe('crate_lettuce');
    expect(findNearbyStation(px, py, Math.atan2(-1, 0.6), STATIONS)?.id).toBe('crate_tomato');
  });
});
