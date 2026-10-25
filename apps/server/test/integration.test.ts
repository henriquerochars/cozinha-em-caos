/**
 * Real multiplayer integration test: boots the Colyseus server on a random port,
 * connects two independent SDK clients, creates/joins a room by code, and
 * completes a cooperative salad order purely through network messages.
 */
import { Client, type Room } from '@colyseus/sdk';
import { MSG, type GameStateView, type GameEvent } from '@cozinha/shared';
import type { Server } from '@colyseus/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGameServer } from '../src/createServer';
import { standSpot, waitFor } from './helpers';

type GameRoom = Room<any, GameStateView>;

let server: Server;
let port: number;
let endpoint: string;

beforeAll(async () => {
  server = createGameServer();
  port = 20_000 + Math.floor(Math.random() * 10_000);
  await server.listen(port);
  endpoint = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

function me(room: GameRoom) {
  return room.state.players.get(room.sessionId)!;
}

/** Drives a player through waypoints using only `input` messages. */
async function navigate(room: GameRoom, waypoints: { x: number; y: number }[], timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  for (const wp of waypoints) {
    for (;;) {
      const p = me(room);
      const dx = wp.x - p.x;
      const dy = wp.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) break;
      if (Date.now() - start > timeoutMs) throw new Error(`navigate timed out near (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) heading to (${wp.x}, ${wp.y})`);
      const speed = dist < 20 ? 0.35 : 1;
      room.send(MSG.INPUT, { x: (dx / dist) * speed, y: (dy / dist) * speed });
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  room.send(MSG.INPUT, { x: 0, y: 0 });
  await new Promise((r) => setTimeout(r, 120));
}

async function useStation(room: GameRoom, stationId: string, approach: { x: number; y: number }[]) {
  const spot = standSpot(stationId);
  await navigate(room, [...approach, { x: spot.x, y: spot.y }]);
  // face the station
  room.send(MSG.INPUT, { x: Math.cos(spot.facing) * 0.2, y: Math.sin(spot.facing) * 0.2 });
  await new Promise((r) => setTimeout(r, 60));
  room.send(MSG.INPUT, { x: 0, y: 0 });
  await new Promise((r) => setTimeout(r, 80));
  room.send(MSG.ACTION, {});
}

describe('two phones, one kitchen', () => {
  let clientA: Client;
  let clientB: Client;
  let roomA: GameRoom;
  let roomB: GameRoom;
  const eventsA: GameEvent[] = [];
  const eventsB: GameEvent[] = [];

  it('creates a room with a six character code and lets a second player join by code', async () => {
    clientA = new Client(endpoint);
    clientB = new Client(endpoint);
    roomA = (await clientA.create('kitchen', { name: 'Ana' })) as GameRoom;
    roomA.onMessage(MSG.EVENT, (ev: GameEvent) => eventsA.push(ev));
    expect(roomA.roomId).toMatch(/^[A-Z2-9]{6}$/);
    await waitFor(() => roomA.state.code === roomA.roomId, 5000, 'state.code');

    roomB = (await clientB.joinById(roomA.roomId, { name: 'Bia' })) as GameRoom;
    roomB.onMessage(MSG.EVENT, (ev: GameEvent) => eventsB.push(ev));
    await waitFor(() => roomA.state.players.size === 2 && roomB.state.players.size === 2, 5000, 'both players visible');
    expect(roomB.state.players.get(roomA.sessionId)?.name).toBe('Ana');
    expect(roomA.state.players.get(roomB.sessionId)?.name).toBe('Bia');
  });

  it('rejects a third player and unknown codes', async () => {
    const clientC = new Client(endpoint);
    await expect(clientC.joinById(roomA.roomId, { name: 'Caio' })).rejects.toThrow();
    await expect(clientC.joinById('ZZZZZZ', { name: 'Caio' })).rejects.toThrow();
  });

  it('starts the match when both players are ready', async () => {
    roomA.send(MSG.READY, { ready: true });
    await new Promise((r) => setTimeout(r, 150));
    expect(roomA.state.phase).toBe('lobby');
    roomB.send(MSG.READY, { ready: true });
    await waitFor(() => roomA.state.phase === 'countdown', 3000, 'countdown');
    await waitFor(() => roomA.state.phase === 'playing' && roomB.state.phase === 'playing', 6000, 'playing');
  });

  it('synchronizes authoritative movement between both clients', async () => {
    const before = me(roomA).x;
    roomA.send(MSG.INPUT, { x: 1, y: 0 });
    await new Promise((r) => setTimeout(r, 400));
    roomA.send(MSG.INPUT, { x: 0, y: 0 });
    await new Promise((r) => setTimeout(r, 200));
    const a = me(roomA);
    expect(a.x).toBeGreaterThan(before + 20);
    const seenByB = roomB.state.players.get(roomA.sessionId)!;
    expect(Math.abs(seenByB.x - a.x)).toBeLessThan(2);
    expect(Math.abs(seenByB.y - a.y)).toBeLessThan(2);
  });

  it('completes a cooperative salad order via real messages', async () => {
    await waitFor(() => roomA.state.orders.size >= 1, 5000, 'first order');
    const firstOrder = [...(roomA.state.orders as any).values()][0] as { recipe: string };
    expect(firstOrder.recipe).toBe('salad');

    const stations = roomA.state.stations;
    const LEFT_LANE = 80;
    const RIGHT_LANE = 280;
    const ISLAND_TOP = 264;
    const ISLAND_BOTTOM = 337;

    // Ana: lettuce -> left board -> assembly
    const ana = (async () => {
      const p = me(roomA);
      await useStation(roomA, 'crate_lettuce', [{ x: LEFT_LANE, y: p.y }, { x: LEFT_LANE, y: 136 }]);
      await waitFor(() => me(roomA).carrying === 'lettuce:raw', 3000, 'Ana takes lettuce');
      await useStation(roomA, 'board_left', []);
      await waitFor(() => stations.get('board_left')!.items === 'lettuce:raw', 3000, 'lettuce on board');
      roomA.send(MSG.ACTION, {});
      await waitFor(() => stations.get('board_left')!.items === 'lettuce:chopped', 6000, 'lettuce chopped');
      roomA.send(MSG.ACTION, {});
      await waitFor(() => me(roomA).carrying === 'lettuce:chopped', 3000, 'Ana holds chopped lettuce');
      await useStation(roomA, "assembly", [{ x: LEFT_LANE, y: ISLAND_TOP }, { x: LEFT_LANE, y: ISLAND_BOTTOM }, { x: 180, y: ISLAND_BOTTOM }]);
      await waitFor(() => me(roomA).carrying === '', 3000, 'Ana places lettuce');
    })();

    // Bia: tomato -> right board -> assembly -> deliver
    const bia = (async () => {
      const p = me(roomB);
      await useStation(roomB, 'crate_tomato', [{ x: RIGHT_LANE, y: p.y }, { x: RIGHT_LANE, y: 136 }, { x: 120, y: 136 }]);
      await waitFor(() => me(roomB).carrying === 'tomato:raw', 3000, 'Bia takes tomato');
      await useStation(roomB, 'board_right', [{ x: RIGHT_LANE, y: 136 }]);
      await waitFor(() => stations.get('board_right')!.items === 'tomato:raw', 3000, 'tomato on board');
      roomB.send(MSG.ACTION, {});
      await waitFor(() => stations.get('board_right')!.items === 'tomato:chopped', 6000, 'tomato chopped');
      roomB.send(MSG.ACTION, {});
      await waitFor(() => me(roomB).carrying === 'tomato:chopped', 3000, 'Bia holds chopped tomato');
      await useStation(roomB, "assembly", [{ x: RIGHT_LANE, y: ISLAND_TOP }, { x: RIGHT_LANE, y: ISLAND_BOTTOM }, { x: 180, y: ISLAND_BOTTOM }]);
      await waitFor(() => me(roomB).carrying === '', 3000, 'Bia places tomato');
    })();

    await Promise.all([ana, bia]);
    await waitFor(() => stations.get('assembly')!.items === 'plate:salad', 3000, 'salad assembled');
    expect(roomB.state.stations.get('assembly')!.items).toBe('plate:salad');

    roomB.send(MSG.ACTION, {});
    await waitFor(() => me(roomB).carrying === 'plate:salad', 3000, 'Bia picks the salad');
    const scoreBefore = roomA.state.score;
    await useStation(roomB, "delivery", [{ x: 180, y: 424 }]);
    await waitFor(() => roomA.state.completed === 1 && roomB.state.completed === 1, 4000, 'order delivered');
    expect(roomA.state.score).toBeGreaterThanOrEqual(scoreBefore + 100);
    expect(roomA.state.score).toBe(roomB.state.score);
    expect(eventsA.some((e) => e.t === 'delivered')).toBe(true);
    expect(eventsB.some((e) => e.t === 'delivered')).toBe(true);
    expect(eventsA.some((e) => e.t === 'chopDone')).toBe(true);
  }, 60_000);

  it('pauses on an unexpected disconnect and resumes after reconnection', async () => {
    const token = roomB.reconnectionToken;
    roomB.reconnection.enabled = false; // simulate a real drop without the SDK auto-reconnecting
    await roomB.leave(false);
    await waitFor(() => roomA.state.phase === 'paused', 4000, 'paused');
    expect(roomA.state.players.get(roomB.sessionId)?.connected).toBe(false);
    roomB = (await clientB.reconnect(token)) as GameRoom;
    await waitFor(() => roomA.state.phase === 'playing', 4000, 'resumed');
    expect(roomA.state.players.get(roomB.sessionId)?.connected).toBe(true);
  });

  it('returns to the lobby when a player leaves for good', async () => {
    await roomB.leave(true);
    await waitFor(() => roomA.state.players.size === 1, 4000, 'player removed');
    expect(roomA.state.phase).toBe('lobby');
    await roomA.leave(true);
  });
});
