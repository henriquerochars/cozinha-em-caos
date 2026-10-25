import { CHOP_DURATION_MS, COUNTDOWN_MS, MATCH_DURATION_MS, PAN_COOK_DURATION_MS, POT_COOK_DURATION_MS, SCORE_MISSED } from '@cozinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { KitchenSim } from '../src/game/KitchenSim';
import { GameState } from '../src/schema/GameState';
import { standSpot } from './helpers';

const TICK = 50;

function makeSim() {
  const sim = new KitchenSim(new GameState(), () => 0.1);
  sim.addPlayer('a', 'Ana');
  sim.addPlayer('b', 'Bia');
  return sim;
}

function startMatch(sim: KitchenSim) {
  sim.setReady('a', true);
  sim.setReady('b', true);
  expect(sim.state.phase).toBe('countdown');
  advance(sim, COUNTDOWN_MS + TICK);
  expect(sim.state.phase).toBe('playing');
  sim.drainEvents();
}

function advance(sim: KitchenSim, ms: number) {
  for (let t = 0; t < ms; t += TICK) sim.tick(TICK);
}

function useStation(sim: KitchenSim, player: string, stationId: string) {
  const spot = standSpot(stationId);
  sim.teleport(player, spot.x, spot.y, spot.facing);
  sim.doAction(player);
}

const player = (sim: KitchenSim, id: string) => sim.state.players.get(id)!;
const station = (sim: KitchenSim, id: string) => sim.state.stations.get(id)!;

describe('KitchenSim: lobby & match flow', () => {
  it('accepts at most two players and assigns distinct slots', () => {
    const sim = makeSim();
    expect(sim.addPlayer('c', 'Caio')).toBeNull();
    expect(player(sim, 'a').slot).not.toBe(player(sim, 'b').slot);
    expect(sim.state.players.size).toBe(2);
  });
  it('starts the countdown only when both players are ready', () => {
    const sim = makeSim();
    sim.setReady('a', true);
    expect(sim.state.phase).toBe('lobby');
    sim.setReady('b', true);
    expect(sim.state.phase).toBe('countdown');
    advance(sim, COUNTDOWN_MS + TICK);
    expect(sim.state.phase).toBe('playing');
    expect(sim.state.matchEndsAt - sim.state.clock).toBeLessThanOrEqual(MATCH_DURATION_MS);
  });
  it('spawns the first order shortly after the match starts', () => {
    const sim = makeSim();
    startMatch(sim);
    advance(sim, 1000);
    expect(sim.state.orders.size).toBe(1);
    const first = [...sim.state.orders.values()][0]!;
    expect(first.recipe).toBe('salad');
  });
  it('ends the match after the duration and lets players replay', () => {
    const sim = makeSim();
    startMatch(sim);
    advance(sim, MATCH_DURATION_MS + TICK);
    expect(sim.state.phase).toBe('ended');
    const endEvent = sim.drainEvents().find((e) => e.t === 'matchEnd');
    expect(endEvent).toBeDefined();
    sim.setReady('a', true);
    sim.setReady('b', true);
    expect(sim.state.phase).toBe('countdown');
    expect(sim.state.score).toBe(0);
    expect(sim.state.orders.size).toBe(0);
  });
  it('pauses while a player is disconnected and resumes when they return', () => {
    const sim = makeSim();
    startMatch(sim);
    const before = sim.state.clock;
    sim.setConnected('b', false);
    expect(sim.state.phase).toBe('paused');
    advance(sim, 2000);
    expect(sim.state.clock).toBe(before);
    sim.setConnected('b', true);
    expect(sim.state.phase).toBe('playing');
  });
  it('returns to the lobby when a partner leaves for good mid-match', () => {
    const sim = makeSim();
    startMatch(sim);
    sim.removePlayer('b');
    expect(sim.state.phase).toBe('lobby');
    expect(sim.state.players.size).toBe(1);
  });
});

describe('KitchenSim: movement', () => {
  it('moves players according to their input and respects collisions', () => {
    const sim = makeSim();
    startMatch(sim);
    const p = player(sim, 'a');
    const x0 = p.x;
    sim.setInput('a', { x: 1, y: 0 });
    advance(sim, 500);
    expect(p.x).toBeGreaterThan(x0 + 40);
    expect(p.moving).toBe(true);
    sim.setInput('a', { x: 0, y: 1 });
    advance(sim, 5000);
    expect(p.y).toBeLessThan(480); // bottom wall
    expect(p.moving).toBe(false);
  });
  it('ignores movement while chopping', () => {
    const sim = makeSim();
    startMatch(sim);
    useStation(sim, 'a', 'crate_tomato');
    useStation(sim, 'a', 'board_left');
    sim.doAction('a'); // chop
    expect(player(sim, 'a').busyAction).toBe('chop');
    const { x, y } = player(sim, 'a');
    sim.setInput('a', { x: 1, y: 1 });
    advance(sim, 500);
    expect(player(sim, 'a').x).toBe(x);
    expect(player(sim, 'a').y).toBe(y);
  });
  it('does nothing before the match starts', () => {
    const sim = makeSim();
    useStation(sim, 'a', 'crate_tomato');
    expect(player(sim, 'a').carrying).toBe('');
  });
});

describe('KitchenSim: cooking', () => {
  let sim: KitchenSim;
  beforeEach(() => {
    sim = makeSim();
    startMatch(sim);
  });

  it('picks up, chops and assembles a salad, then delivers it for points', () => {
    useStation(sim, 'a', 'crate_lettuce');
    expect(player(sim, 'a').carrying).toBe('lettuce:raw');
    useStation(sim, 'a', 'crate_lettuce'); // hands full -> rejected
    expect(sim.drainEvents().some((e) => e.t === 'invalid')).toBe(true);

    useStation(sim, 'a', 'board_left'); // place
    expect(station(sim, 'board_left').items).toBe('lettuce:raw');
    sim.doAction('a'); // chop
    expect(station(sim, 'board_left').busyBy).toBe('a');
    advance(sim, CHOP_DURATION_MS / 2);
    expect(station(sim, 'board_left').progress).toBeGreaterThan(0.3);
    expect(station(sim, 'board_left').items).toBe('lettuce:raw');
    advance(sim, CHOP_DURATION_MS / 2 + TICK);
    expect(station(sim, 'board_left').items).toBe('lettuce:chopped');
    expect(player(sim, 'a').busyAction).toBe('');
    sim.doAction('a'); // pickup
    expect(player(sim, 'a').carrying).toBe('lettuce:chopped');
    useStation(sim, 'a', 'assembly');
    expect(station(sim, 'assembly').items).toBe('lettuce:chopped');

    // partner does the tomato in parallel
    useStation(sim, 'b', 'crate_tomato');
    useStation(sim, 'b', 'board_right');
    sim.doAction('b');
    advance(sim, CHOP_DURATION_MS + TICK);
    sim.doAction('b');
    useStation(sim, 'b', 'assembly');
    expect(station(sim, 'assembly').items).toBe('plate:salad');
    expect(sim.drainEvents().some((e) => e.t === 'assembled')).toBe(true);

    sim.doAction('b'); // pick the plate
    expect(player(sim, 'b').carrying).toBe('plate:salad');
    expect(sim.state.orders.size).toBe(1);
    useStation(sim, 'b', 'delivery');
    expect(player(sim, 'b').carrying).toBe('');
    expect(sim.state.completed).toBe(1);
    expect(sim.state.score).toBeGreaterThanOrEqual(100);
    expect(sim.state.score).toBeLessThanOrEqual(150);
    expect(sim.state.orders.size).toBe(0);
    const delivered = sim.drainEvents().find((e) => e.t === 'delivered');
    expect(delivered && delivered.t === 'delivered' && delivered.recipe).toBe('salad');
  });

  it('rejects a dish nobody ordered and keeps it in hand', () => {
    useStation(sim, 'a', 'crate_bread');
    useStation(sim, 'a', 'assembly');
    useStation(sim, 'a', 'crate_lettuce');
    useStation(sim, 'a', 'board_left');
    sim.doAction('a');
    advance(sim, CHOP_DURATION_MS + TICK);
    sim.doAction('a');
    useStation(sim, 'a', 'assembly');
    // burger needs a patty too -> not assembled yet
    expect(station(sim, 'assembly').items).toBe('bread:raw,lettuce:chopped');
    useStation(sim, 'a', 'fridge');
    useStation(sim, 'a', 'stove_pan');
    expect(station(sim, 'stove_pan').cookState).toBe('cooking');
    sim.doAction('a'); // still cooking -> rejected
    expect(player(sim, 'a').carrying).toBe('');
    advance(sim, PAN_COOK_DURATION_MS + TICK);
    expect(station(sim, 'stove_pan').cookState).toBe('done');
    expect(station(sim, 'stove_pan').items).toBe('patty:cooked');
    sim.doAction('a');
    expect(player(sim, 'a').carrying).toBe('patty:cooked');
    useStation(sim, 'a', 'assembly');
    expect(station(sim, 'assembly').items).toBe('plate:burger');
    sim.doAction('a');
    sim.drainEvents();
    useStation(sim, 'a', 'delivery'); // only a salad was ordered so far
    expect(player(sim, 'a').carrying).toBe('plate:burger');
    expect(sim.state.completed).toBe(0);
    expect(sim.drainEvents().some((e) => e.t === 'wrongDish')).toBe(true);
    // trash it
    useStation(sim, 'a', 'trash');
    expect(player(sim, 'a').carrying).toBe('');
  });

  it('cooks soup in the pot and serves it', () => {
    useStation(sim, 'a', 'crate_carrot');
    useStation(sim, 'a', 'board_left');
    sim.doAction('a');
    useStation(sim, 'b', 'crate_potato');
    useStation(sim, 'b', 'board_right');
    sim.doAction('b');
    advance(sim, CHOP_DURATION_MS + TICK);
    sim.doAction('a');
    sim.doAction('b');
    useStation(sim, 'a', 'stove_pot');
    expect(station(sim, 'stove_pot').cookState).toBe('idle');
    useStation(sim, 'b', 'stove_pot');
    expect(station(sim, 'stove_pot').cookState).toBe('cooking');
    sim.doAction('b'); // nothing to do while cooking
    advance(sim, POT_COOK_DURATION_MS + TICK);
    expect(station(sim, 'stove_pot').cookState).toBe('done');
    useStation(sim, 'a', 'stove_pot');
    expect(player(sim, 'a').carrying).toBe('plate:soup');
    expect(station(sim, 'stove_pot').items).toBe('');
    sim.createOrder('soup');
    useStation(sim, 'a', 'delivery');
    expect(sim.state.completed).toBe(1);
  });

  it('prevents two players from taking the same item', () => {
    useStation(sim, 'a', 'crate_tomato');
    useStation(sim, 'a', 'counter_left');
    expect(station(sim, 'counter_left').items).toBe('tomato:raw');
    useStation(sim, 'a', 'counter_left'); // a picks it back
    useStation(sim, 'b', 'counter_left'); // b finds nothing
    expect(player(sim, 'a').carrying).toBe('tomato:raw');
    expect(player(sim, 'b').carrying).toBe('');
    expect(sim.drainEvents().filter((e) => e.t === 'invalid').length).toBe(1);
  });

  it('expires orders and applies the penalty without going negative', () => {
    advance(sim, 1000);
    expect(sim.state.orders.size).toBe(1);
    const order = [...sim.state.orders.values()][0]!;
    advance(sim, order.expiresAt - sim.state.clock + TICK);
    expect(sim.state.orders.has(order.id)).toBe(false);
    expect(sim.state.failed).toBe(1);
    expect(sim.state.score).toBe(Math.max(0, SCORE_MISSED));
    expect(sim.drainEvents().some((e) => e.t === 'orderFailed')).toBe(true);
  });
});
