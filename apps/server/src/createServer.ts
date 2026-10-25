import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KitchenRoom } from './rooms/KitchenRoom';

export const ROOM_NAME = 'kitchen';

/** The bits of an Express response the health route uses (avoids pulling in @types/express). */
interface HealthResponse {
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
}

/**
 * Creates (but does not start) the game server.
 *
 * Colyseus owns the HTTP server: it serves the matchmaking routes (with CORS)
 * and a built-in `GET /__healthcheck`. Extra routes go through the `express`
 * hook so they never race with the matchmaker for the same response.
 */
export function createGameServer(): Server {
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: (app) => {
      app.get('/health', (_req: unknown, res: HealthResponse) => {
        res.setHeader('access-control-allow-origin', '*');
        res.json({ ok: true, game: 'cozinha-em-caos' });
      });
    },
  });
  server.define(ROOM_NAME, KitchenRoom);
  return server;
}
