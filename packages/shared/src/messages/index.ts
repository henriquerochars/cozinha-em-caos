import type { ItemCode, RecipeId } from '../types/items';

/** client -> server */
export const MSG = {
  INPUT: 'input',
  ACTION: 'action',
  READY: 'ready',
  PLAY_AGAIN: 'playAgain',
  /** server -> client one-shot gameplay events (for sound/FX) */
  EVENT: 'ev',
} as const;

export interface InputMessage {
  x: number;
  y: number;
}

export interface ReadyMessage {
  ready: boolean;
}

export type GameEvent =
  | { t: 'pickup'; playerId: string; stationId: string; item: ItemCode }
  | { t: 'place'; playerId: string; stationId: string; item: ItemCode }
  | { t: 'chopStart'; playerId: string; stationId: string }
  | { t: 'chopDone'; playerId: string; stationId: string; item: ItemCode }
  | { t: 'cookStart'; stationId: string }
  | { t: 'cookDone'; stationId: string }
  | { t: 'assembled'; stationId: string; recipe: RecipeId }
  | { t: 'delivered'; playerId: string; orderId: string; recipe: RecipeId; points: number; bonus: number }
  | { t: 'wrongDish'; playerId: string }
  | { t: 'orderFailed'; orderId: string; recipe: RecipeId; points: number }
  | { t: 'newOrder'; orderId: string; recipe: RecipeId }
  | { t: 'trash'; playerId: string; item: ItemCode }
  | { t: 'invalid'; playerId: string; reason: string }
  | { t: 'countdown' }
  | { t: 'matchStart' }
  | { t: 'matchEnd'; score: number; completed: number; failed: number; stars: number }
  | { t: 'paused'; reason: string }
  | { t: 'resumed' };

export interface JoinOptions {
  name: string;
}

export interface CreateOptions extends JoinOptions {
  create: true;
}
