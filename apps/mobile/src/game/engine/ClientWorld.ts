import {
  SOLIDS,
  STATION_BY_ID,
  STATIONS,
  findNearbyStation,
  isActionDef,
  lerp,
  lerpAngle,
  resolveAction,
  splitItems,
  stepBody,
  type ActionDef,
  type ActionRejection,
  type GameStateView,
  type MoveInput,
  type MovingBody,
  type PlayerView,
  type StationDef,
  type StationSnapshot,
  type StationView,
} from '@cozinha/shared';

export type ChefAnim = 'idle' | 'walk' | 'chop' | 'celebrate';

export interface ChefRenderState {
  id: string;
  name: string;
  slot: number;
  x: number;
  y: number;
  facing: number;
  speed: number;
  moving: boolean;
  carrying: string;
  anim: ChefAnim;
  busyStationId: string;
  connected: boolean;
  /** running animation clocks */
  walkPhase: number;
  idleTime: number;
  blinkTimer: number;
  blinking: number;
  pickupT: number; // 0..1 after a pickup, for a little pop
  celebrateT: number; // >0 while celebrating
  prevCarrying: string;
  stepTimer: number;
}

export interface StationRenderState {
  def: StationDef;
  items: string[];
  progress: number;
  cookState: string;
  busyBy: string;
  /** smoothed progress for nicer bars */
  shownProgress: number;
  /** animation clocks */
  wobble: number;
  highlight: number;
  flashT: number;
  steamTimer: number;
  chopTimer: number;
  lastItems: string;
  popT: number;
}

/**
 * Client-side mirror of the synchronized state with:
 *  - local prediction for our own chef (same movement code as the server)
 *  - interpolation for the other chef
 *  - animation clocks that never depend on the network tick
 */
export class ClientWorld {
  readonly chefs = new Map<string, ChefRenderState>();
  readonly stations = new Map<string, StationRenderState>();
  localId = '';
  input: MoveInput = { x: 0, y: 0 };
  private localBody: MovingBody | null = null;
  /** station the local chef can use right now */
  nearby: StationRenderState | null = null;
  nearbyAction: ActionDef | ActionRejection | null = null;
  phase: string = 'lobby';
  clock = 0;
  matchEndsAt = 0;
  countdownEndsAt = 0;
  score = 0;
  shownScore = 0;
  scoreBumpT = 0;
  time = 0;

  constructor() {
    for (const def of STATIONS) {
      this.stations.set(def.id, {
        def,
        items: [],
        progress: 0,
        cookState: 'idle',
        busyBy: '',
        shownProgress: 0,
        wobble: Math.random() * 10,
        highlight: 0,
        flashT: 0,
        steamTimer: Math.random(),
        chopTimer: 0,
        lastItems: '',
        popT: 0,
      });
    }
  }

  celebrate(): void {
    this.chefs.forEach((c) => (c.celebrateT = 0.9));
  }

  flashStation(id: string): void {
    const s = this.stations.get(id);
    if (s) s.flashT = 0.5;
  }

  update(dt: number, state: GameStateView | null): void {
    this.time += dt;
    if (!state) return;
    this.phase = state.phase;
    this.clock = state.clock;
    this.matchEndsAt = state.matchEndsAt;
    this.countdownEndsAt = state.countdownEndsAt;
    if (state.score !== this.score) this.scoreBumpT = 1;
    this.scoreBumpT = Math.max(0, this.scoreBumpT - dt * 2.5);
    this.score = state.score;
    this.shownScore = Math.abs(this.score - this.shownScore) < 1 ? this.score : lerp(this.shownScore, this.score, Math.min(1, dt * 6));

    this.syncStations(state, dt);
    this.syncChefs(state, dt);
    this.updateNearby();
  }

  private syncStations(state: GameStateView, dt: number): void {
    state.stations.forEach((sv: StationView, id: string) => {
      const s = this.stations.get(id);
      if (!s) return;
      s.items = splitItems(sv.items);
      s.progress = sv.progress;
      s.cookState = sv.cookState;
      s.busyBy = sv.busyBy;
      if (sv.items !== s.lastItems) {
        s.lastItems = sv.items;
        s.popT = 1;
      }
    });
    this.stations.forEach((s) => {
      s.wobble += dt;
      s.shownProgress = s.progress === 0 ? 0 : lerp(s.shownProgress, s.progress, Math.min(1, dt * 10));
      s.popT = Math.max(0, s.popT - dt * 3);
      s.flashT = Math.max(0, s.flashT - dt);
      s.highlight = lerp(s.highlight, this.nearby === s && this.phase === 'playing' ? 1 : 0, Math.min(1, dt * 12));
    });
  }

  private syncChefs(state: GameStateView, dt: number): void {
    const seen = new Set<string>();
    state.players.forEach((pv: PlayerView, id: string) => {
      seen.add(id);
      let c = this.chefs.get(id);
      if (!c) {
        c = {
          id,
          name: pv.name,
          slot: pv.slot,
          x: pv.x,
          y: pv.y,
          facing: pv.facing,
          speed: 0,
          moving: false,
          carrying: pv.carrying,
          anim: 'idle',
          busyStationId: '',
          connected: pv.connected,
          walkPhase: 0,
          idleTime: Math.random() * 3,
          blinkTimer: 2 + Math.random() * 2,
          blinking: 0,
          pickupT: 0,
          celebrateT: 0,
          prevCarrying: pv.carrying,
          stepTimer: 0,
        };
        this.chefs.set(id, c);
        if (id === this.localId) this.localBody = { x: pv.x, y: pv.y, vx: 0, vy: 0, facing: pv.facing };
      }
      c.name = pv.name;
      c.slot = pv.slot;
      c.connected = pv.connected;
      c.busyStationId = pv.busyStationId;
      if (pv.carrying !== c.prevCarrying) {
        if (pv.carrying !== '') c.pickupT = 1;
        c.prevCarrying = pv.carrying;
      }
      c.carrying = pv.carrying;

      const prevX = c.x;
      const prevY = c.y;
      const busy = pv.busyAction !== '';
      const canMove = this.phase === 'playing' && !busy && pv.connected;

      if (id === this.localId && this.localBody) {
        this.predictLocal(c, pv, dt, canMove);
      } else {
        // remote: smooth follow of the authoritative position
        const k = 1 - Math.exp(-dt * 14);
        c.x = lerp(c.x, pv.x, k);
        c.y = lerp(c.y, pv.y, k);
        c.facing = lerpAngle(c.facing, pv.facing, Math.min(1, dt * 16));
        const far = Math.hypot(pv.x - c.x, pv.y - c.y) > 60;
        if (far) {
          c.x = pv.x;
          c.y = pv.y;
        }
      }

      const vx = (c.x - prevX) / Math.max(dt, 1e-4);
      const vy = (c.y - prevY) / Math.max(dt, 1e-4);
      c.speed = Math.hypot(vx, vy);
      c.moving = id === this.localId ? c.speed > 12 : pv.moving || c.speed > 12;

      // animation clocks
      if (busy && pv.busyAction === 'chop') c.anim = 'chop';
      else if (c.celebrateT > 0) c.anim = 'celebrate';
      else if (c.moving) c.anim = 'walk';
      else c.anim = 'idle';

      if (c.moving) {
        c.walkPhase += dt * Math.min(1.4, 0.6 + c.speed / 150) * 11;
        c.stepTimer += dt;
      } else {
        // ease the legs back to neutral
        c.walkPhase += dt * 6;
        c.stepTimer = 0;
      }
      c.idleTime += dt;
      c.celebrateT = Math.max(0, c.celebrateT - dt);
      c.pickupT = Math.max(0, c.pickupT - dt * 3);
      c.blinkTimer -= dt;
      if (c.blinkTimer <= 0) {
        c.blinking = 0.12;
        c.blinkTimer = 2.2 + Math.random() * 2.5;
      }
      c.blinking = Math.max(0, c.blinking - dt);
    });
    for (const id of [...this.chefs.keys()]) {
      if (!seen.has(id)) this.chefs.delete(id);
    }
  }

  private predictLocal(c: ChefRenderState, pv: PlayerView, dt: number, canMove: boolean): void {
    const body = this.localBody!;
    if (canMove) {
      stepBody(body, this.input, dt, SOLIDS);
    } else {
      body.vx = 0;
      body.vy = 0;
      body.facing = pv.facing;
    }
    // reconciliation with the authoritative position
    const err = Math.hypot(pv.x - body.x, pv.y - body.y);
    const stationary = this.input.x === 0 && this.input.y === 0 && Math.hypot(body.vx, body.vy) < 2;
    if (err > 56 || !canMove) {
      body.x = pv.x;
      body.y = pv.y;
    } else if (stationary || err > 24) {
      const k = Math.min(1, dt * (stationary ? 10 : 4));
      body.x = lerp(body.x, pv.x, k);
      body.y = lerp(body.y, pv.y, k);
    }
    c.x = body.x;
    c.y = body.y;
    c.facing = body.facing;
  }

  private updateNearby(): void {
    const me = this.chefs.get(this.localId);
    if (!me || this.phase !== 'playing') {
      this.nearby = null;
      this.nearbyAction = null;
      return;
    }
    const def = findNearbyStation(me.x, me.y, me.facing, STATIONS);
    const s = def ? this.stations.get(def.id) ?? null : null;
    this.nearby = s;
    if (!s) {
      this.nearbyAction = null;
      return;
    }
    const snap: StationSnapshot = {
      id: s.def.id,
      type: s.def.type,
      ingredient: s.def.ingredient ?? '',
      items: s.items,
      cookState: s.cookState as StationSnapshot['cookState'],
      busyBy: s.busyBy,
    };
    this.nearbyAction = resolveAction(me.carrying, snap, this.localId);
  }

  /** Label for the big action button ("" when nothing can be done). */
  actionLabel(): { label: string; enabled: boolean } {
    const a = this.nearbyAction;
    if (!a) return { label: '', enabled: false };
    if (isActionDef(a)) return { label: a.labelPt, enabled: true };
    return { label: a.reasonPt, enabled: false };
  }

  stationCenter(id: string): { x: number; y: number } {
    const def = STATION_BY_ID.get(id);
    if (!def) return { x: 0, y: 0 };
    return { x: def.x + def.w / 2, y: def.y + def.h / 2 };
  }
}
