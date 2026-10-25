import { MAX_ACTIVE_ORDERS, RECIPES, type RecipeId } from '@cozinha/shared';

/**
 * Simple difficulty curve for a 3 minute match:
 *  - first order is always a salad (easy), arrives right after the match starts
 *  - a second order arrives soon after so both players have something to do
 *  - orders get more varied and more frequent as time passes
 */
export interface OrderPlan {
  recipe: RecipeId;
  /** delay (ms) until the next order after this one is created */
  nextDelayMs: number;
}

export function planNextOrder(elapsedMs: number, orderIndex: number, activeCount: number, random: () => number): OrderPlan | null {
  if (activeCount >= MAX_ACTIVE_ORDERS) return null;

  let recipe: RecipeId;
  if (orderIndex === 0) recipe = 'salad';
  else if (orderIndex === 1) recipe = random() < 0.5 ? 'burger' : 'soup';
  else if (elapsedMs < 60_000) recipe = pick(random, ['salad', 'salad', 'burger', 'soup']);
  else recipe = pick(random, ['salad', 'burger', 'burger', 'soup', 'soup']);

  let nextDelayMs: number;
  if (orderIndex === 0) nextDelayMs = 9_000;
  else if (elapsedMs < 60_000) nextDelayMs = 22_000;
  else if (elapsedMs < 120_000) nextDelayMs = 18_000;
  else nextDelayMs = 15_000;

  return { recipe, nextDelayMs };
}

export function orderPatience(recipe: RecipeId): number {
  return RECIPES[recipe].patienceMs;
}

function pick<T>(random: () => number, arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)] as T;
}
