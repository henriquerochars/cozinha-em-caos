import type { ItemCode, RecipeId } from '../types/items';

export interface RecipeDef {
  id: RecipeId;
  namePt: string;
  /** Items that must be on the assembly counter to produce the dish (unordered). */
  ingredients: ItemCode[];
  /** How long the customer waits (ms). */
  patienceMs: number;
  /** Relative difficulty used by the order generator. */
  difficulty: 1 | 2 | 3;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  salad: {
    id: 'salad',
    namePt: 'Salada',
    ingredients: ['lettuce:chopped', 'tomato:chopped'],
    patienceMs: 70_000,
    difficulty: 1,
  },
  burger: {
    id: 'burger',
    namePt: 'Hambúrguer',
    ingredients: ['bread:raw', 'patty:cooked', 'lettuce:chopped'],
    patienceMs: 85_000,
    difficulty: 2,
  },
  soup: {
    id: 'soup',
    namePt: 'Sopa de Legumes',
    ingredients: ['soup:cooked'],
    patienceMs: 85_000,
    difficulty: 2,
  },
};

/** What the soup pot needs before it starts cooking. */
export const POT_RECIPE: ItemCode[] = ['carrot:chopped', 'potato:chopped'];

/** Ingredients shown on an order card (what the players must gather). */
export const RECIPE_DISPLAY_INGREDIENTS: Record<RecipeId, ItemCode[]> = {
  salad: ['lettuce:chopped', 'tomato:chopped'],
  burger: ['bread:raw', 'patty:cooked', 'lettuce:chopped'],
  soup: ['carrot:chopped', 'potato:chopped'],
};

export const RECIPE_LIST: RecipeDef[] = [RECIPES.salad, RECIPES.burger, RECIPES.soup];

/** Returns the recipe whose ingredient multiset equals `items`, or null. */
export function matchRecipe(items: readonly ItemCode[]): RecipeDef | null {
  const sorted = [...items].sort().join('|');
  for (const r of RECIPE_LIST) {
    if ([...r.ingredients].sort().join('|') === sorted) return r;
  }
  return null;
}

/** True if `items` is a strict subset (multiset) of some recipe – i.e. still useful. */
export function couldBecomeRecipe(items: readonly ItemCode[]): boolean {
  for (const r of RECIPE_LIST) {
    const pool = [...r.ingredients];
    let ok = true;
    for (const it of items) {
      const i = pool.indexOf(it);
      if (i < 0) {
        ok = false;
        break;
      }
      pool.splice(i, 1);
    }
    if (ok) return true;
  }
  return false;
}
