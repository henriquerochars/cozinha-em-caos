import { schema, t, type SchemaType } from '@colyseus/schema';

export const Player = schema(
  {
    id: t.string(),
    name: t.string(),
    slot: t.uint8(),
    x: t.float32(),
    y: t.float32(),
    facing: t.float32(),
    moving: t.boolean(),
    carrying: t.string(),
    busyAction: t.string(),
    busyStationId: t.string(),
    busyUntil: t.number(),
    ready: t.boolean(),
    connected: t.boolean(),
  },
  'Player',
);
export type Player = SchemaType<typeof Player>;

export const Station = schema(
  {
    id: t.string(),
    type: t.string(),
    ingredient: t.string(),
    /** comma-separated item codes ("" when empty) */
    items: t.string(),
    progress: t.float32(),
    cookState: t.string(),
    busyBy: t.string(),
  },
  'Station',
);
export type Station = SchemaType<typeof Station>;

export const Order = schema(
  {
    id: t.string(),
    recipe: t.string(),
    createdAt: t.number(),
    expiresAt: t.number(),
  },
  'Order',
);
export type Order = SchemaType<typeof Order>;

export const GameState = schema(
  {
    phase: t.string(),
    code: t.string(),
    clock: t.number(),
    matchDuration: t.number(),
    matchEndsAt: t.number(),
    countdownEndsAt: t.number(),
    score: t.int32(),
    completed: t.uint16(),
    failed: t.uint16(),
    pauseReason: t.string(),
    players: t.map(Player),
    stations: t.map(Station),
    orders: t.map(Order),
  },
  'GameState',
);
export type GameState = SchemaType<typeof GameState>;

export { splitItems, joinItems } from "@cozinha/shared";
