import {
  CHOP_DURATION_MS,
  COUNTDOWN_MS,
  MATCH_DURATION_MS,
  PAN_COOK_DURATION_MS,
  POT_COOK_DURATION_MS,
  SOLIDS,
  SPAWN_POINTS,
  STATIONS,
  STATION_BY_ID,
  SOUP_DISH,
  assembledDish,
  choppedVersion,
  clampInput,
  cookedVersion,
  deliveryPoints,
  dishRecipe,
  findNearbyStation,
  isActionDef,
  makeIngredient,
  missedPoints,
  potReadyToCook,
  ratingStars,
  resolveAction,
  stepBody,
  type GameEvent,
  type IngredientKind,
  type MoveInput,
  type MovingBody,
  type RecipeId,
  type StationSnapshot,
} from '@cozinha/shared';
import { GameState, Order, Player, Station, joinItems, splitItems } from '../schema/GameState';
import { orderPatience, planNextOrder } from './orders';

const MAX_PLAYERS = 2;
const MOVING_EPSILON = 4;

/**
 * Authoritative kitchen simulation. Pure game logic operating on the Colyseus
 * state; no networking in here so it can be unit tested directly.
 *
 * Time is expressed in `state.clock` milliseconds, which only advances while
 * the match is running (countdown/playing). Pausing therefore freezes every
 * timer (orders, cooking, chopping) for free.
 */
export class KitchenSim {
  readonly state: GameState;
  readonly events: GameEvent[] = [];
  private readonly inputs = new Map<string, MoveInput>();
  private readonly bodies = new Map<string, MovingBody>();
  private readonly cookStart = new Map<string, number>();
  private readonly chopStart = new Map<string, number>();
  private orderSeq = 0;
  private ordersCreated = 0;
  private nextOrderAt = 0;
  private phaseBeforePause: 'countdown' | 'playing' = 'playing';

  constructor(
    state: GameState,
    private readonly random: () => number = Math.random,
  ) {
    this.state = state;
    state.phase = 'lobby';
    state.clock = 0;
    state.matchDuration = MATCH_DURATION_MS;
    state.matchEndsAt = 0;
    state.countdownEndsAt = 0;
    state.score = 0;
    state.completed = 0;
    state.failed = 0;
    state.pauseReason = '';
    this.resetKitchen();
  }

  // ------------------------------------------------------------------ players

  addPlayer(id: string, name: string): Player | null {
    if (this.state.players.size >= MAX_PLAYERS) return null;
    const usedSlots = new Set<number>();
    this.state.players.forEach((p) => usedSlots.add(p.slot));
    const slot = usedSlots.has(0) ? 1 : 0;
    const spawn = SPAWN_POINTS[slot] ?? SPAWN_POINTS[0]!;
    const player = new Player({
      id,
      name,
      slot,
      x: spawn.x,
      y: spawn.y,
      facing: Math.PI / 2,
      moving: false,
      carrying: '',
      busyAction: '',
      busyStationId: '',
      busyUntil: 0,
      ready: false,
      connected: true,
    });
    this.state.players.set(id, player);
    this.bodies.set(id, { x: spawn.x, y: spawn.y, vx: 0, vy: 0, facing: Math.PI / 2 });
    this.inputs.set(id, { x: 0, y: 0 });
    return player;
  }

  removePlayer(id: string): void {
    const p = this.state.players.get(id);
    if (!p) return;
    this.cancelBusy(p);
    this.state.players.delete(id);
    this.bodies.delete(id);
    this.inputs.delete(id);
    if (this.state.phase === 'playing' || this.state.phase === 'countdown' || this.state.phase === 'paused') {
      // A partner left for good: go back to the lobby so the remaining player can wait for someone else.
      this.state.phase = 'lobby';
      this.state.pauseReason = '';
      this.resetKitchen();
      this.state.players.forEach((other) => {
        other.ready = false;
        this.respawn(other);
      });
    }
  }

  setConnected(id: string, connected: boolean): void {
    const p = this.state.players.get(id);
    if (!p) return;
    p.connected = connected;
    if (!connected) {
      this.inputs.set(id, { x: 0, y: 0 });
      if (this.state.phase === 'playing' || this.state.phase === 'countdown') {
        this.phaseBeforePause = this.state.phase;
        this.state.phase = 'paused';
        this.state.pauseReason = `${p.name} caiu da conexão…`;
        this.events.push({ t: 'paused', reason: this.state.pauseReason });
      }
    } else if (this.state.phase === 'paused') {
      let allConnected = true;
      this.state.players.forEach((other) => {
        if (!other.connected) allConnected = false;
      });
      if (allConnected) {
        this.state.phase = this.phaseBeforePause;
        this.state.pauseReason = '';
        this.events.push({ t: 'resumed' });
      }
    }
  }

  setReady(id: string, ready: boolean): void {
    const p = this.state.players.get(id);
    if (!p) return;
    if (this.state.phase !== 'lobby' && this.state.phase !== 'ended') return;
    p.ready = ready;
    this.maybeStartCountdown();
  }

  setInput(id: string, input: MoveInput): void {
    if (!this.state.players.has(id)) return;
    this.inputs.set(id, clampInput(input));
  }

  // -------------------------------------------------------------- match flow

  private maybeStartCountdown(): void {
    if (this.state.players.size < MAX_PLAYERS) return;
    let all = true;
    this.state.players.forEach((p) => {
      if (!p.ready || !p.connected) all = false;
    });
    if (!all) return;
    this.startCountdown();
  }

  startCountdown(): void {
    this.resetKitchen();
    this.state.players.forEach((p) => {
      p.ready = false;
      this.respawn(p);
    });
    this.state.phase = 'countdown';
    this.state.countdownEndsAt = this.state.clock + COUNTDOWN_MS;
    this.events.push({ t: 'countdown' });
  }

  private startMatch(): void {
    this.state.phase = 'playing';
    this.state.matchEndsAt = this.state.clock + MATCH_DURATION_MS;
    this.ordersCreated = 0;
    this.nextOrderAt = this.state.clock + 800;
    this.events.push({ t: 'matchStart' });
  }

  private endMatch(): void {
    this.state.phase = 'ended';
    this.state.players.forEach((p) => {
      this.cancelBusy(p);
      p.ready = false;
      p.moving = false;
    });
    this.inputs.forEach((_, id) => this.inputs.set(id, { x: 0, y: 0 }));
    this.events.push({
      t: 'matchEnd',
      score: this.state.score,
      completed: this.state.completed,
      failed: this.state.failed,
      stars: ratingStars(this.state.score, this.state.completed),
    });
  }

  /** Resets stations, orders and score. Players are kept. */
  resetKitchen(): void {
    this.state.stations.clear();
    for (const def of STATIONS) {
      this.state.stations.set(
        def.id,
        new Station({
          id: def.id,
          type: def.type,
          ingredient: def.ingredient ?? '',
          items: '',
          progress: 0,
          cookState: 'idle',
          busyBy: '',
        }),
      );
    }
    this.state.orders.clear();
    this.cookStart.clear();
    this.chopStart.clear();
    this.state.score = 0;
    this.state.completed = 0;
    this.state.failed = 0;
    this.state.players.forEach((p) => {
      p.carrying = '';
      p.busyAction = '';
      p.busyStationId = '';
      p.busyUntil = 0;
    });
  }

  private respawn(p: Player): void {
    const spawn = SPAWN_POINTS[p.slot] ?? SPAWN_POINTS[0]!;
    p.x = spawn.x;
    p.y = spawn.y;
    p.facing = Math.PI / 2;
    p.moving = false;
    const body = this.bodies.get(p.id);
    if (body) {
      body.x = spawn.x;
      body.y = spawn.y;
      body.vx = 0;
      body.vy = 0;
      body.facing = Math.PI / 2;
    }
  }

  // -------------------------------------------------------------------- tick

  tick(dtMs: number): void {
    const phase = this.state.phase;
    if (phase === 'lobby' || phase === 'paused' || phase === 'ended') return;

    this.state.clock += dtMs;
    const dt = dtMs / 1000;

    if (phase === 'countdown') {
      if (this.state.clock >= this.state.countdownEndsAt) this.startMatch();
      return;
    }

    // playing
    this.state.players.forEach((p) => this.tickPlayer(p, dt));
    this.state.stations.forEach((s) => this.tickStation(s));
    this.tickOrders();

    if (this.state.clock >= this.state.matchEndsAt) this.endMatch();
  }

  private tickPlayer(p: Player, dt: number): void {
    const body = this.bodies.get(p.id);
    if (!body) return;
    if (p.busyAction !== '' || !p.connected) {
      body.vx = 0;
      body.vy = 0;
      p.moving = false;
      return;
    }
    const input = this.inputs.get(p.id) ?? { x: 0, y: 0 };
    stepBody(body, input, dt, SOLIDS);
    p.x = body.x;
    p.y = body.y;
    p.facing = body.facing;
    p.moving = Math.hypot(body.vx, body.vy) > MOVING_EPSILON;
  }

  private tickStation(s: Station): void {
    const now = this.state.clock;
    if (s.type === 'board' && s.busyBy !== '') {
      const start = this.chopStart.get(s.id) ?? now;
      const progress = Math.min(1, (now - start) / CHOP_DURATION_MS);
      s.progress = progress;
      if (progress >= 1) this.finishChop(s);
      return;
    }
    if ((s.type === 'stove_pan' || s.type === 'stove_pot') && s.cookState === 'cooking') {
      const duration = s.type === 'stove_pan' ? PAN_COOK_DURATION_MS : POT_COOK_DURATION_MS;
      const start = this.cookStart.get(s.id) ?? now;
      const progress = Math.min(1, (now - start) / duration);
      s.progress = progress;
      if (progress >= 1) {
        s.cookState = 'done';
        s.progress = 1;
        if (s.type === 'stove_pan') {
          s.items = cookedVersion(s.items) ?? s.items;
        } else {
          s.items = 'soup:cooked';
        }
        this.events.push({ t: 'cookDone', stationId: s.id });
      }
    }
  }

  private tickOrders(): void {
    const now = this.state.clock;
    const expired: Order[] = [];
    this.state.orders.forEach((o) => {
      if (now >= o.expiresAt) expired.push(o);
    });
    for (const o of expired) {
      this.state.orders.delete(o.id);
      const points = missedPoints();
      this.state.score = Math.max(0, this.state.score + points);
      this.state.failed += 1;
      this.events.push({ t: 'orderFailed', orderId: o.id, recipe: o.recipe as RecipeId, points });
    }
    const timeLeft = this.state.matchEndsAt - now;
    if (now >= this.nextOrderAt && timeLeft > 20_000) {
      const elapsed = now - (this.state.matchEndsAt - MATCH_DURATION_MS);
      const plan = planNextOrder(elapsed, this.ordersCreated, this.state.orders.size, this.random);
      if (plan) {
        this.createOrder(plan.recipe);
        this.nextOrderAt = now + plan.nextDelayMs;
      } else {
        this.nextOrderAt = now + 3_000;
      }
    }
  }

  createOrder(recipe: RecipeId): Order {
    const now = this.state.clock;
    const id = `o${++this.orderSeq}`;
    const patience = Math.min(orderPatience(recipe), Math.max(15_000, this.state.matchEndsAt - now));
    const order = new Order({ id, recipe, createdAt: now, expiresAt: now + patience });
    this.state.orders.set(id, order);
    this.ordersCreated += 1;
    this.events.push({ t: 'newOrder', orderId: id, recipe });
    return order;
  }

  // ----------------------------------------------------------------- actions

  /** The station the player could interact with right now (or null). */
  nearbyStation(p: Player): Station | null {
    const def = findNearbyStation(p.x, p.y, p.facing, STATIONS);
    if (!def) return null;
    return this.state.stations.get(def.id) ?? null;
  }

  snapshot(s: Station): StationSnapshot {
    return {
      id: s.id,
      type: s.type as StationSnapshot['type'],
      ingredient: s.ingredient,
      items: splitItems(s.items),
      cookState: s.cookState as StationSnapshot['cookState'],
      busyBy: s.busyBy,
    };
  }

  /** Validates and executes the contextual action for `playerId`. */
  doAction(playerId: string): void {
    const p = this.state.players.get(playerId);
    if (!p || this.state.phase !== 'playing') return;
    if (p.busyAction !== '') return;
    const station = this.nearbyStation(p);
    if (!station) {
      this.events.push({ t: 'invalid', playerId, reason: 'Aproxime-se de uma estação' });
      return;
    }
    const result = resolveAction(p.carrying, this.snapshot(station), playerId);
    if (!isActionDef(result)) {
      this.events.push({ t: 'invalid', playerId, reason: result.reasonPt });
      return;
    }
    const items = splitItems(station.items);
    switch (result.type) {
      case 'take': {
        const kind = (station.ingredient || STATION_BY_ID.get(station.id)?.ingredient) as IngredientKind | undefined;
        if (!kind) return;
        p.carrying = makeIngredient(kind, 'raw');
        this.events.push({ t: 'pickup', playerId, stationId: station.id, item: p.carrying });
        return;
      }
      case 'place': {
        const item = p.carrying;
        p.carrying = '';
        items.push(item);
        station.items = joinItems(items);
        this.events.push({ t: 'place', playerId, stationId: station.id, item });
        if (station.type === 'stove_pan') {
          station.cookState = 'cooking';
          station.progress = 0;
          this.cookStart.set(station.id, this.state.clock);
          this.events.push({ t: 'cookStart', stationId: station.id });
        } else if (station.type === 'stove_pot' && potReadyToCook(items)) {
          station.cookState = 'cooking';
          station.progress = 0;
          this.cookStart.set(station.id, this.state.clock);
          this.events.push({ t: 'cookStart', stationId: station.id });
        } else if (station.type === 'assembly') {
          const dish = assembledDish(items);
          if (dish) {
            station.items = dish;
            this.events.push({ t: 'assembled', stationId: station.id, recipe: dishRecipe(dish) as RecipeId });
          }
        }
        return;
      }
      case 'chop': {
        p.busyAction = 'chop';
        p.busyStationId = station.id;
        p.busyUntil = this.state.clock + CHOP_DURATION_MS;
        p.moving = false;
        station.busyBy = playerId;
        station.progress = 0;
        this.chopStart.set(station.id, this.state.clock);
        const def = STATION_BY_ID.get(station.id);
        if (def) {
          const cx = def.x + def.w / 2;
          const cy = def.y + def.h / 2;
          p.facing = Math.atan2(cy - p.y, cx - p.x);
          const body = this.bodies.get(playerId);
          if (body) body.facing = p.facing;
        }
        this.events.push({ t: 'chopStart', playerId, stationId: station.id });
        return;
      }
      case 'pickup': {
        let item: string | undefined;
        if (station.type === 'assembly' || station.type === 'stove_pot') {
          item = items.pop();
          station.items = joinItems(items);
        } else {
          item = items[0];
          station.items = '';
        }
        if (!item) return;
        p.carrying = item;
        if (station.type === 'stove_pan') {
          station.cookState = 'idle';
          station.progress = 0;
          this.cookStart.delete(station.id);
        }
        this.events.push({ t: 'pickup', playerId, stationId: station.id, item });
        return;
      }
      case 'serve': {
        p.carrying = SOUP_DISH;
        station.items = '';
        station.cookState = 'idle';
        station.progress = 0;
        this.cookStart.delete(station.id);
        this.events.push({ t: 'pickup', playerId, stationId: station.id, item: SOUP_DISH });
        return;
      }
      case 'deliver': {
        const recipe = dishRecipe(p.carrying);
        if (!recipe) return;
        let target: Order | null = null;
        this.state.orders.forEach((o) => {
          if (o.recipe === recipe && (target === null || o.createdAt < target.createdAt)) target = o;
        });
        if (!target) {
          this.events.push({ t: 'wrongDish', playerId });
          this.events.push({ t: 'invalid', playerId, reason: 'Nenhum pedido pede isso' });
          return;
        }
        const order: Order = target;
        const { points, bonus } = deliveryPoints(order.createdAt, order.expiresAt, this.state.clock);
        this.state.orders.delete(order.id);
        this.state.score += points;
        this.state.completed += 1;
        p.carrying = '';
        this.events.push({ t: 'delivered', playerId, orderId: order.id, recipe, points, bonus });
        return;
      }
      case 'trash': {
        const item = p.carrying;
        p.carrying = '';
        this.events.push({ t: 'trash', playerId, item });
        return;
      }
    }
  }

  private finishChop(s: Station): void {
    const playerId = s.busyBy;
    const p = this.state.players.get(playerId);
    const chopped = choppedVersion(s.items);
    if (chopped) s.items = chopped;
    s.busyBy = '';
    s.progress = 0;
    this.chopStart.delete(s.id);
    if (p) {
      p.busyAction = '';
      p.busyStationId = '';
      p.busyUntil = 0;
    }
    this.events.push({ t: 'chopDone', playerId, stationId: s.id, item: s.items });
  }

  private cancelBusy(p: Player): void {
    if (p.busyAction === '') return;
    const s = this.state.stations.get(p.busyStationId);
    if (s && s.busyBy === p.id) {
      s.busyBy = '';
      s.progress = 0;
      this.chopStart.delete(s.id);
    }
    p.busyAction = '';
    p.busyStationId = '';
    p.busyUntil = 0;
  }

  /** Test helper: move a player instantly (not reachable from the network). */
  teleport(id: string, x: number, y: number, facing: number): void {
    const p = this.state.players.get(id);
    const body = this.bodies.get(id);
    if (!p || !body) return;
    p.x = body.x = x;
    p.y = body.y = y;
    p.facing = body.facing = facing;
    body.vx = body.vy = 0;
  }

  /** Drains queued events (the room broadcasts them). */
  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
