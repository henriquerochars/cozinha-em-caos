import { describe, expect, it } from 'vitest';
import {
  assembledDish,
  choppedVersion,
  cookedVersion,
  couldBecomeRecipe,
  isActionDef,
  matchRecipe,
  potReadyToCook,
  resolveAction,
  type StationSnapshot,
} from '../src';

const station = (partial: Partial<StationSnapshot> & Pick<StationSnapshot, 'type'>): StationSnapshot => ({
  id: partial.id ?? partial.type,
  type: partial.type,
  ingredient: partial.ingredient ?? '',
  items: partial.items ?? [],
  cookState: partial.cookState ?? 'idle',
  busyBy: partial.busyBy ?? '',
});

const action = (carrying: string, s: StationSnapshot, player = 'p1') => {
  const r = resolveAction(carrying, s, player);
  return isActionDef(r) ? r.type : `reject:${r.reasonPt}`;
};

describe('recipes', () => {
  it('matches recipes regardless of order', () => {
    expect(matchRecipe(['tomato:chopped', 'lettuce:chopped'])?.id).toBe('salad');
    expect(matchRecipe(['lettuce:chopped', 'patty:cooked', 'bread:raw'])?.id).toBe('burger');
    expect(matchRecipe(['soup:cooked'])?.id).toBe('soup');
    expect(matchRecipe(['tomato:raw', 'lettuce:chopped'])).toBeNull();
  });
  it('knows partial recipes', () => {
    expect(couldBecomeRecipe(['bread:raw'])).toBe(true);
    expect(couldBecomeRecipe(['bread:raw', 'tomato:chopped'])).toBe(false);
    expect(couldBecomeRecipe(['lettuce:chopped', 'lettuce:chopped'])).toBe(false);
  });
  it('transforms ingredients', () => {
    expect(choppedVersion('tomato:raw')).toBe('tomato:chopped');
    expect(choppedVersion('bread:raw')).toBeNull();
    expect(cookedVersion('patty:raw')).toBe('patty:cooked');
    expect(cookedVersion('tomato:raw')).toBeNull();
    expect(potReadyToCook(['carrot:chopped', 'potato:chopped'])).toBe(true);
    expect(potReadyToCook(['carrot:chopped'])).toBe(false);
    expect(assembledDish(['lettuce:chopped', 'tomato:chopped'])).toBe('plate:salad');
  });
});

describe('resolveAction', () => {
  it('crates give ingredients to empty hands only', () => {
    expect(action('', station({ type: 'crate', ingredient: 'tomato' }))).toBe('take');
    expect(action('tomato:raw', station({ type: 'crate', ingredient: 'tomato' }))).toMatch(/^reject/);
  });
  it('cutting board flow: place -> chop -> pickup', () => {
    expect(action('tomato:raw', station({ type: 'board' }))).toBe('place');
    expect(action('bread:raw', station({ type: 'board' }))).toMatch(/^reject/);
    expect(action('', station({ type: 'board', items: ['tomato:raw'] }))).toBe('chop');
    expect(action('', station({ type: 'board', items: ['tomato:chopped'] }))).toBe('pickup');
    expect(action('lettuce:raw', station({ type: 'board', items: ['tomato:chopped'] }))).toMatch(/^reject/);
    expect(action('', station({ type: 'board', items: ['tomato:raw'], busyBy: 'p2' }))).toMatch(/^reject/);
  });
  it('frying pan only takes raw patties and gives cooked ones back', () => {
    expect(action('patty:raw', station({ type: 'stove_pan' }))).toBe('place');
    expect(action('tomato:raw', station({ type: 'stove_pan' }))).toMatch(/^reject/);
    expect(action('', station({ type: 'stove_pan', items: ['patty:raw'], cookState: 'cooking' }))).toMatch(/^reject/);
    expect(action('', station({ type: 'stove_pan', items: ['patty:cooked'], cookState: 'done' }))).toBe('pickup');
  });
  it('soup pot accepts chopped vegetables and serves soup', () => {
    expect(action('carrot:chopped', station({ type: 'stove_pot' }))).toBe('place');
    expect(action('carrot:raw', station({ type: 'stove_pot' }))).toMatch(/^reject/);
    expect(action('carrot:chopped', station({ type: 'stove_pot', items: ['carrot:chopped'] }))).toMatch(/^reject/);
    expect(action('', station({ type: 'stove_pot', items: ['soup:cooked'], cookState: 'done' }))).toBe('serve');
  });
  it('assembly accepts only ingredients that fit a recipe', () => {
    expect(action('lettuce:chopped', station({ type: 'assembly' }))).toBe('place');
    expect(action('tomato:chopped', station({ type: 'assembly', items: ['bread:raw'] }))).toMatch(/^reject/);
    expect(action('', station({ type: 'assembly', items: ['plate:salad'] }))).toBe('pickup');
    expect(action('plate:salad', station({ type: 'assembly' }))).toMatch(/^reject/);
  });
  it('delivery only takes plates; trash takes anything', () => {
    expect(action('plate:salad', station({ type: 'delivery' }))).toBe('deliver');
    expect(action('tomato:chopped', station({ type: 'delivery' }))).toMatch(/^reject/);
    expect(action('tomato:chopped', station({ type: 'trash' }))).toBe('trash');
    expect(action('', station({ type: 'trash' }))).toMatch(/^reject/);
  });
});
