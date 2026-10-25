/** Virtual world size (portrait). Rendered with uniform scale + letterboxing. */
export const WORLD_W = 360;
export const WORLD_H = 560;

/** Kitchen interior bounds (walkable area), in world units. */
export const KITCHEN = { x: 20, y: 80, w: 320, h: 400 } as const;
export const TILE = 40;

export const PLAYER_RADIUS = 13;
export const PLAYER_SPEED = 150; // world units per second
export const PLAYER_ACCEL = 1400; // units/s^2 used for smoothing velocity
export const INTERACT_REACH = 20; // distance from station rect edge to allow interaction

export const SERVER_TICK_RATE = 20; // Hz
export const INPUT_SEND_INTERVAL_MS = 50;

export const MATCH_DURATION_MS = 180_000;
export const COUNTDOWN_MS = 3_000;

export const CHOP_DURATION_MS = 2_400;
export const PAN_COOK_DURATION_MS = 6_000;
export const POT_COOK_DURATION_MS = 7_000;

export const SCORE_DELIVER = 100;
export const SCORE_SPEED_BONUS_MAX = 50;
export const SCORE_MISSED = -25;

export const MAX_ACTIVE_ORDERS = 4;
export const ROOM_CODE_LENGTH = 6;
export const RECONNECT_GRACE_SECONDS = 45;

export const PLAYER_COLORS = ['#FF6B6B', '#4D96FF'] as const;
export const PLAYER_COLOR_NAMES = ['Vermelho', 'Azul'] as const;
