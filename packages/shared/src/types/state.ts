import type { StationType } from '../constants/map';
import type { ItemCode, RecipeId } from './items';

export type MatchPhase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'ended';
export type CookState = 'idle' | 'cooking' | 'done';
export type PlayerBusyAction = '' | 'chop';

/** Read-only view of a player as seen in the synchronized state. */
export interface PlayerView {
  id: string;
  name: string;
  slot: number;
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  carrying: ItemCode;
  busyAction: PlayerBusyAction;
  busyStationId: string;
  busyUntil: number;
  ready: boolean;
  connected: boolean;
}

export interface StationView {
  id: string;
  type: StationType;
  ingredient: string;
  /** comma-separated item codes ("" when empty); use splitItems() */
  items: string;
  /** 0..1 progress of the current chop/cook */
  progress: number;
  cookState: CookState;
  /** session id of the player currently chopping here, or "" */
  busyBy: string;
}

export interface OrderView {
  id: string;
  recipe: RecipeId;
  createdAt: number;
  expiresAt: number;
}

export interface MapLike<V> {
  get(key: string): V | undefined;
  forEach(cb: (value: V, key: string) => void): void;
  readonly size: number;
}

export interface GameStateView {
  phase: MatchPhase;
  code: string;
  /** ms since the match started (frozen while paused) */
  clock: number;
  matchDuration: number;
  matchEndsAt: number;
  countdownEndsAt: number;
  score: number;
  completed: number;
  failed: number;
  pauseReason: string;
  players: MapLike<PlayerView>;
  stations: MapLike<StationView>;
  orders: MapLike<OrderView>;
}

/** Plain snapshot of a station used by the pure rules functions. */
export interface StationSnapshot {
  id: string;
  type: StationType;
  ingredient: string;
  items: readonly ItemCode[];
  cookState: CookState;
  busyBy: string;
}
