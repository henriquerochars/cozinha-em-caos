import { PLAYER_RADIUS, STATION_BY_ID, type StationDef } from '@cozinha/shared';

/** Where a player should stand (and which way to face) to use a station. */
export function standSpot(stationId: string): { x: number; y: number; facing: number } {
  const def = STATION_BY_ID.get(stationId) as StationDef;
  const gap = PLAYER_RADIUS + 4;
  const cx = def.x + def.w / 2;
  const cy = def.y + def.h / 2;
  switch (def.facing) {
    case 'down':
      return { x: cx, y: def.y + def.h + gap, facing: -Math.PI / 2 };
    case 'up':
      return { x: cx, y: def.y - gap, facing: Math.PI / 2 };
    case 'left':
      return { x: def.x - gap, y: cy, facing: 0 };
    case 'right':
      return { x: def.x + def.w + gap, y: cy, facing: Math.PI };
  }
}

export async function waitFor(cond: () => boolean, timeoutMs = 10_000, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
