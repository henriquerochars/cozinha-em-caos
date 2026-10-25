import { POT_RECIPE, RECIPES, couldBecomeRecipe, matchRecipe } from '../constants/recipes';
import { stationCapacity } from '../constants/map';
import type { StationSnapshot } from '../types/state';
import { CHOPPABLE, PAN_COOKABLE, ingredientKind, ingredientState, isDish, makeDish, makeIngredient, type ItemCode } from '../types/items';

export type ActionType = 'take' | 'place' | 'chop' | 'pickup' | 'serve' | 'deliver' | 'trash';

export interface ActionDef {
  type: ActionType;
  labelPt: string;
}

export interface ActionRejection {
  reasonPt: string;
}

export const ACTION_LABELS: Record<ActionType, string> = {
  take: 'Pegar',
  place: 'Colocar',
  chop: 'Cortar',
  pickup: 'Pegar',
  serve: 'Servir',
  deliver: 'Entregar',
  trash: 'Jogar fora',
};

/**
 * Pure rule: what can a player holding `carrying` do at `station` right now?
 * Returns an ActionDef when something is possible, an ActionRejection with a
 * user-facing reason when the player is near but nothing can be done.
 * Used both by the server (validation) and the client (button label).
 */
export function resolveAction(carrying: ItemCode, station: StationSnapshot, playerId: string): ActionDef | ActionRejection {
  const hasItem = carrying !== '';
  const items = station.items;
  const first = items[0] ?? '';

  switch (station.type) {
    case 'crate':
    case 'fridge':
      if (!hasItem) return { type: 'take', labelPt: 'Pegar' };
      return { reasonPt: 'Mãos ocupadas' };

    case 'board': {
      if (station.busyBy && station.busyBy !== playerId) return { reasonPt: 'Alguém está cortando' };
      if (first === '') {
        if (!hasItem) return { reasonPt: 'Nada para cortar' };
        const kind = ingredientKind(carrying);
        if (kind && CHOPPABLE.has(kind) && ingredientState(carrying) === 'raw') {
          return { type: 'place', labelPt: 'Colocar' };
        }
        return { reasonPt: 'Isso não se corta' };
      }
      if (hasItem) return { reasonPt: 'Tábua ocupada' };
      if (ingredientState(first) === 'raw') return { type: 'chop', labelPt: 'Cortar' };
      return { type: 'pickup', labelPt: 'Pegar' };
    }

    case 'stove_pan': {
      if (first === '') {
        if (!hasItem) return { reasonPt: 'Frigideira vazia' };
        const kind = ingredientKind(carrying);
        if (kind && PAN_COOKABLE.has(kind) && ingredientState(carrying) === 'raw') {
          return { type: 'place', labelPt: 'Cozinhar' };
        }
        return { reasonPt: 'Isso não vai na frigideira' };
      }
      if (station.cookState === 'cooking') return { reasonPt: 'Ainda cozinhando…' };
      if (hasItem) return { reasonPt: 'Mãos ocupadas' };
      return { type: 'pickup', labelPt: 'Pegar' };
    }

    case 'stove_pot': {
      if (station.cookState === 'done') {
        if (hasItem) return { reasonPt: 'Mãos ocupadas' };
        return { type: 'serve', labelPt: 'Servir' };
      }
      if (station.cookState === 'cooking') return { reasonPt: 'Sopa cozinhando…' };
      if (!hasItem) {
        if (items.length > 0) return { type: 'pickup', labelPt: 'Pegar' };
        return { reasonPt: 'Panela vazia' };
      }
      if (!POT_RECIPE.includes(carrying)) return { reasonPt: 'Isso não vai na sopa' };
      if (items.includes(carrying)) return { reasonPt: 'Já tem isso na panela' };
      return { type: 'place', labelPt: 'Adicionar' };
    }

    case 'counter': {
      if (first === '') {
        if (hasItem) return { type: 'place', labelPt: 'Colocar' };
        return { reasonPt: 'Bancada vazia' };
      }
      if (hasItem) return { reasonPt: 'Bancada ocupada' };
      return { type: 'pickup', labelPt: 'Pegar' };
    }

    case 'assembly': {
      if (!hasItem) {
        if (items.length === 0) return { reasonPt: 'Nada para montar' };
        return { type: 'pickup', labelPt: 'Pegar' };
      }
      if (isDish(carrying)) return { reasonPt: 'Leve o prato para a entrega' };
      if (items.some(isDish)) return { reasonPt: 'Pegue o prato primeiro' };
      if (items.length >= stationCapacity('assembly')) return { reasonPt: 'Montagem cheia' };
      if (!couldBecomeRecipe([...items, carrying])) return { reasonPt: 'Não combina com nenhuma receita' };
      return { type: 'place', labelPt: 'Montar' };
    }

    case 'delivery': {
      if (!hasItem) return { reasonPt: 'Nada para entregar' };
      if (!isDish(carrying)) return { reasonPt: 'Monte o prato primeiro' };
      return { type: 'deliver', labelPt: 'Entregar' };
    }

    case 'trash': {
      if (!hasItem) return { reasonPt: 'Nada para jogar fora' };
      return { type: 'trash', labelPt: 'Jogar fora' };
    }
  }
  return { reasonPt: 'Nada a fazer' };
}

export function isActionDef(a: ActionDef | ActionRejection): a is ActionDef {
  return (a as ActionDef).type !== undefined;
}

/** Result of chopping an item. */
export function choppedVersion(code: ItemCode): ItemCode | null {
  const kind = ingredientKind(code);
  if (!kind || !CHOPPABLE.has(kind) || ingredientState(code) !== 'raw') return null;
  return makeIngredient(kind, 'chopped');
}

/** Result of frying an item. */
export function cookedVersion(code: ItemCode): ItemCode | null {
  const kind = ingredientKind(code);
  if (!kind || !PAN_COOKABLE.has(kind) || ingredientState(code) !== 'raw') return null;
  return makeIngredient(kind, 'cooked');
}

/** When all POT_RECIPE items are in the pot it is ready to cook. */
export function potReadyToCook(items: readonly ItemCode[]): boolean {
  return POT_RECIPE.every((it) => items.includes(it)) && items.length === POT_RECIPE.length;
}

export const SOUP_DISH: ItemCode = makeDish('soup');

/** If the items on the assembly counter form a recipe, returns the dish item. */
export function assembledDish(items: readonly ItemCode[]): ItemCode | null {
  const r = matchRecipe(items);
  return r ? makeDish(r.id) : null;
}

export function recipeName(id: string): string {
  return (RECIPES as Record<string, { namePt: string }>)[id]?.namePt ?? id;
}
