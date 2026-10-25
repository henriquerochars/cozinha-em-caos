import { Client, type Room } from '@colyseus/sdk';
import { MSG, normalizeRoomCode, type GameEvent, type GameStateView, type MatchPhase } from '@cozinha/shared';
import { useSyncExternalStore } from 'react';
import { resolveServerUrl } from '../config/server';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
export type GameRoom = Room<any, GameStateView>;
export const ROOM_NAME = 'kitchen';

export interface SessionSnapshot {
  status: ConnectionStatus;
  error: string;
  roomCode: string;
  myId: string;
  phase: MatchPhase | 'none';
  serverUrl: string;
  /** bumps on every state patch so lobby/results screens re-render */
  version: number;
}

type Listener = () => void;
type EventListener = (ev: GameEvent) => void;

/**
 * Single multiplayer session for the app: owns the Colyseus client/room and
 * exposes a tiny external store for React screens. Gameplay reads `room.state`
 * directly every frame (no React re-render per patch).
 */
class Session {
  private client: Client | null = null;
  room: GameRoom | null = null;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  private snapshot: SessionSnapshot = {
    status: 'idle',
    error: '',
    roomCode: '',
    myId: '',
    phase: 'none',
    serverUrl: resolveServerUrl(),
    version: 0,
  };
  private lastInput = { x: 0, y: 0 };
  private lastInputSentAt = 0;

  // ---------------------------------------------------------------- store
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): SessionSnapshot => this.snapshot;

  onEvent(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  private set(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  /** Our session id in the current room ("" when not connected). */
  myId(): string {
    return this.room?.sessionId ?? this.snapshot.myId;
  }

  get state(): GameStateView | null {
    return (this.room?.state as GameStateView | undefined) ?? null;
  }

  setServerUrl(url: string): void {
    this.set({ serverUrl: url.trim() });
  }

  // ------------------------------------------------------------- connect
  async createRoom(name: string): Promise<void> {
    await this.connect((client) => client.create<GameStateView>(ROOM_NAME, { name }));
  }

  async joinRoom(code: string, name: string): Promise<void> {
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 6) {
      this.set({ status: 'error', error: 'O código da sala tem 6 letras/números.' });
      throw new Error('invalid code');
    }
    await this.connect((client) => client.joinById<GameStateView>(normalized, { name }));
  }

  private async connect(open: (client: Client) => Promise<Room<any, GameStateView>>): Promise<void> {
    await this.leave();
    this.set({ status: 'connecting', error: '' });
    try {
      this.client = new Client(this.snapshot.serverUrl);
      const room = await open(this.client);
      this.attach(room);
      this.set({ status: 'connected', roomCode: room.roomId, myId: room.sessionId, phase: this.readPhase() });
    } catch (err) {
      this.room = null;
      this.set({ status: 'error', error: friendlyError(err) });
      throw err;
    }
  }

  private attach(room: GameRoom): void {
    this.room = room;
    room.onStateChange(() => {
      const phase = this.readPhase();
      this.set({ phase, version: this.snapshot.version + 1 });
    });
    room.onMessage<GameEvent>(MSG.EVENT, (ev) => {
      for (const l of this.eventListeners) l(ev);
    });
    room.onDrop(() => this.set({ status: 'reconnecting' }));
    room.onReconnect(() => this.set({ status: 'connected' }));
    room.onError((code, message) => this.set({ error: message ?? `Erro ${code}` }));
    room.onLeave((code) => {
      if (this.room !== room) return;
      this.room = null;
      const unexpected = code !== 4000 && code !== 1000;
      this.set({
        status: unexpected ? 'disconnected' : 'idle',
        error: unexpected ? 'Conexão com a sala perdida.' : '',
        phase: 'none',
        roomCode: '',
      });
    });
  }

  private readPhase(): MatchPhase | 'none' {
    return (this.room?.state as GameStateView | undefined)?.phase ?? 'none';
  }

  async leave(): Promise<void> {
    const room = this.room;
    this.room = null;
    if (room) {
      try {
        await room.leave(true);
      } catch {
        // ignore
      }
    }
    this.set({ status: 'idle', phase: 'none', roomCode: '', myId: '', error: '' });
  }

  // ------------------------------------------------------------ gameplay
  setReady(ready: boolean): void {
    this.room?.send(MSG.READY, { ready });
  }

  playAgain(): void {
    this.room?.send(MSG.PLAY_AGAIN, {});
  }

  sendAction(): void {
    this.room?.send(MSG.ACTION, {});
  }

  /** Sends joystick input at most every `intervalMs` unless it changed meaningfully. */
  sendInput(x: number, y: number, now: number, intervalMs: number): void {
    if (!this.room) return;
    const changed = Math.abs(x - this.lastInput.x) > 0.02 || Math.abs(y - this.lastInput.y) > 0.02;
    const stoppedNow = x === 0 && y === 0 && (this.lastInput.x !== 0 || this.lastInput.y !== 0);
    if (!changed && !stoppedNow && now - this.lastInputSentAt < intervalMs) return;
    if (!changed && !stoppedNow && x === 0 && y === 0) return; // idle: nothing to say
    this.lastInput = { x, y };
    this.lastInputSentAt = now;
    this.room.send(MSG.INPUT, { x, y });
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found|Not Found|MATCHMAKE_INVALID_ROOM_ID|invalid room/i.test(msg)) return 'Sala não encontrada. Confira o código.';
  if (/locked|full|cheia|max/i.test(msg)) return 'A sala já está cheia.';
  if (/Failed to fetch|Network|ECONNREFUSED|fetch failed|Load failed/i.test(msg)) return 'Não deu para conectar ao servidor. Ele está rodando? Confira o endereço.';
  return msg || 'Erro desconhecido.';
}

export const session = new Session();

// Dev only: expose the session to the browser console / automation scripts.
declare const __DEV__: boolean | undefined;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  (globalThis as unknown as { __cozinha?: Session }).__cozinha = session;
}

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
