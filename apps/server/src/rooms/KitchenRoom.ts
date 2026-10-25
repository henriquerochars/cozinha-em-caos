import { CloseCode, Room, matchMaker, type Client } from '@colyseus/core';
import {
  MSG,
  RECONNECT_GRACE_SECONDS,
  SERVER_TICK_RATE,
  generateRoomCode,
  type GameEvent,
  type InputMessage,
  type JoinOptions,
  type ReadyMessage,
} from '@cozinha/shared';
import { KitchenSim } from '../game/KitchenSim';
import { GameState } from '../schema/GameState';

const MAX_NAME_LENGTH = 12;

export function sanitizeName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  const clean = s.replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, MAX_NAME_LENGTH);
  return clean.length > 0 ? clean : fallback;
}

/**
 * One private room = one kitchen for exactly two chefs.
 * The room id *is* the six character code the players share.
 */
export class KitchenRoom extends Room<{ state: GameState }> {
  override maxClients = 2;
  sim!: KitchenSim;

  override async onCreate(): Promise<void> {
    this.roomId = await this.uniqueCode();
    this.setState(new GameState());
    this.sim = new KitchenSim(this.state);
    this.state.code = this.roomId;
    await this.setPrivate(true);

    this.setPatchRate(1000 / SERVER_TICK_RATE);
    this.setSimulationInterval((dtMs) => this.tick(dtMs), 1000 / SERVER_TICK_RATE);

    this.onMessage<InputMessage>(MSG.INPUT, (client, msg) => {
      if (!msg || typeof msg !== 'object') return;
      this.sim.setInput(client.sessionId, { x: Number(msg.x) || 0, y: Number(msg.y) || 0 });
    });
    this.onMessage(MSG.ACTION, (client) => {
      this.sim.doAction(client.sessionId);
      this.flushEvents();
    });
    this.onMessage<ReadyMessage>(MSG.READY, (client, msg) => {
      this.sim.setReady(client.sessionId, Boolean(msg?.ready));
      this.flushEvents();
    });
    this.onMessage(MSG.PLAY_AGAIN, (client) => {
      this.sim.setReady(client.sessionId, true);
      this.flushEvents();
    });
  }

  override onJoin(client: Client, options?: JoinOptions): void {
    const name = sanitizeName(options?.name, `Chef ${this.clients.length}`);
    const player = this.sim.addPlayer(client.sessionId, name);
    if (!player) {
      client.leave(CloseCode.CONSENTED, 'Sala cheia');
      return;
    }
    if (this.state.players.size >= this.maxClients) void this.lock();
  }

  override async onLeave(client: Client, code?: number): Promise<void> {
    const consented = code === CloseCode.CONSENTED;
    if (consented) {
      this.sim.removePlayer(client.sessionId);
      this.flushEvents();
      void this.unlock();
      return;
    }
    this.sim.setConnected(client.sessionId, false);
    this.flushEvents();
    try {
      await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
      this.sim.setConnected(client.sessionId, true);
    } catch {
      this.sim.removePlayer(client.sessionId);
      void this.unlock();
    }
    this.flushEvents();
  }

  private tick(dtMs: number): void {
    this.sim.tick(dtMs);
    this.flushEvents();
  }

  private flushEvents(): void {
    const events = this.sim.drainEvents();
    for (const ev of events) this.dispatch(ev);
  }

  private dispatch(ev: GameEvent): void {
    if (ev.t === 'invalid') {
      const target = this.clients.getById(ev.playerId);
      if (target) this.send(target, MSG.EVENT, ev);
      return;
    }
    this.broadcast(MSG.EVENT as never, ev as never);
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateRoomCode();
      let existing: unknown;
      try {
        existing = await Promise.resolve(matchMaker.getRoomById(code));
      } catch {
        existing = undefined;
      }
      if (!existing) return code;
    }
    return generateRoomCode() + Date.now().toString(36).slice(-2);
  }
}
