export type IngredientKind = 'tomato' | 'lettuce' | 'bread' | 'patty' | 'carrot' | 'potato';
export type IngredientState = 'raw' | 'chopped' | 'cooked';
export type RecipeId = 'salad' | 'burger' | 'soup';

/**
 * Items are encoded as compact strings so they can travel inside Colyseus schema
 * fields without nested objects:
 *   - ""                 nothing
 *   - "tomato:raw"       raw ingredient
 *   - "tomato:chopped"   chopped ingredient
 *   - "patty:cooked"     cooked ingredient
 *   - "plate:salad"      finished dish, ready to deliver
 */
export type ItemCode = string;

export const NO_ITEM: ItemCode = '';

export function makeIngredient(kind: IngredientKind, state: IngredientState): ItemCode {
  return `${kind}:${state}`;
}

export function makeDish(recipe: RecipeId): ItemCode {
  return `plate:${recipe}`;
}

export function parseItem(code: ItemCode): { kind: string; state: string } | null {
  if (!code) return null;
  const idx = code.indexOf(':');
  if (idx < 0) return { kind: code, state: '' };
  return { kind: code.slice(0, idx), state: code.slice(idx + 1) };
}

export function isDish(code: ItemCode): boolean {
  return code.startsWith('plate:');
}

export function dishRecipe(code: ItemCode): RecipeId | null {
  if (!isDish(code)) return null;
  return code.slice('plate:'.length) as RecipeId;
}

export function ingredientKind(code: ItemCode): IngredientKind | null {
  const p = parseItem(code);
  if (!p || p.kind === 'plate') return null;
  return p.kind as IngredientKind;
}

export function ingredientState(code: ItemCode): IngredientState | null {
  const p = parseItem(code);
  if (!p || p.kind === 'plate') return null;
  return p.state as IngredientState;
}

export const INGREDIENT_NAMES_PT: Record<IngredientKind, string> = {
  tomato: 'Tomate',
  lettuce: 'Alface',
  bread: 'Pão',
  patty: 'Hambúrguer',
  carrot: 'Cenoura',
  potato: 'Batata',
};

/** Ingredients that must be chopped before use. */
export const CHOPPABLE: ReadonlySet<IngredientKind> = new Set(['tomato', 'lettuce', 'carrot', 'potato']);
/** Ingredients cooked on the frying pan. */
export const PAN_COOKABLE: ReadonlySet<IngredientKind> = new Set(['patty']);

/** Station contents travel as a single comma-separated string. */
export function splitItems(items: string): ItemCode[] {
  return items === '' ? [] : items.split(',');
}

export function joinItems(items: readonly ItemCode[]): string {
  return items.join(',');
}
