import type { MoveInput } from '@cozinha/shared';

export interface ControlsLayout {
  /** canvas size in pixels */
  width: number;
  height: number;
  /** where the world is drawn (pixels) and its uniform scale */
  worldX: number;
  worldY: number;
  scale: number;
  /** control strip below the world */
  zoneY: number;
  zoneH: number;
  bottomInset: number;
  /** joystick resting position + radius */
  stickHome: { x: number; y: number };
  stickRadius: number;
  /** action button */
  button: { x: number; y: number; r: number };
}

export interface StickState {
  active: boolean;
  id: number;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  /** normalized direction (-1..1), magnitude <= 1 */
  x: number;
  y: number;
}

export interface ButtonState {
  pressed: boolean;
  id: number;
  /** 1 right after a press, decays to 0 (for the squash animation) */
  pressT: number;
}

const DEADZONE = 0.14;
const NO_ID = -1;

/**
 * Multi-touch controls drawn by Skia and fed by raw touch/pointer events:
 *  - a floating joystick that appears wherever the thumb lands (left side),
 *  - a big action button on the right,
 *  - keyboard support on the web (WASD / arrows + space / enter) for desktop testing.
 * Touch ids are tracked so both can be used at the same time.
 */
export class TouchControls {
  stick: StickState;
  button: ButtonState = { pressed: false, id: NO_ID, pressT: 0 };
  private pendingActions = 0;
  private keys = new Set<string>();

  constructor(public layout: ControlsLayout) {
    this.stick = {
      active: false,
      id: NO_ID,
      baseX: layout.stickHome.x,
      baseY: layout.stickHome.y,
      knobX: layout.stickHome.x,
      knobY: layout.stickHome.y,
      x: 0,
      y: 0,
    };
  }

  setLayout(layout: ControlsLayout): void {
    this.layout = layout;
    if (!this.stick.active) {
      this.stick.baseX = this.stick.knobX = layout.stickHome.x;
      this.stick.baseY = this.stick.knobY = layout.stickHome.y;
    }
  }

  // ------------------------------------------------------------ pointers
  pointerDown(id: number, x: number, y: number): void {
    if (this.hitsButton(x, y)) {
      if (this.button.id !== NO_ID) return;
      this.button.id = id;
      this.button.pressed = true;
      this.button.pressT = 1;
      this.pendingActions++;
      return;
    }
    if (this.stick.active) return;
    const L = this.layout;
    const r = L.stickRadius;
    this.stick.active = true;
    this.stick.id = id;
    // keep the base fully on screen
    this.stick.baseX = Math.min(Math.max(x, r + 4), L.width - r - 4);
    this.stick.baseY = Math.min(Math.max(y, r + 4), L.height - r - 4);
    this.stick.knobX = this.stick.baseX;
    this.stick.knobY = this.stick.baseY;
    this.updateStickVector(x, y);
  }

  pointerMove(id: number, x: number, y: number): void {
    if (this.stick.active && this.stick.id === id) this.updateStickVector(x, y);
  }

  pointerUp(id: number): void {
    if (this.stick.id === id) {
      this.stick.active = false;
      this.stick.id = NO_ID;
      this.stick.x = 0;
      this.stick.y = 0;
      this.stick.baseX = this.stick.knobX = this.layout.stickHome.x;
      this.stick.baseY = this.stick.knobY = this.layout.stickHome.y;
    }
    if (this.button.id === id) {
      this.button.id = NO_ID;
      this.button.pressed = false;
    }
  }

  releaseAll(): void {
    this.pointerUp(this.stick.id);
    this.pointerUp(this.button.id);
    this.keys.clear();
  }

  private updateStickVector(x: number, y: number): void {
    const R = this.layout.stickRadius;
    let dx = x - this.stick.baseX;
    let dy = y - this.stick.baseY;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    this.stick.knobX = this.stick.baseX + dx;
    this.stick.knobY = this.stick.baseY + dy;
    const mag = Math.min(1, len / R);
    if (mag < DEADZONE) {
      this.stick.x = 0;
      this.stick.y = 0;
      return;
    }
    // re-map so the deadzone edge is 0 and the rim is 1
    const m = (mag - DEADZONE) / (1 - DEADZONE);
    const nx = dx / (len || 1);
    const ny = dy / (len || 1);
    this.stick.x = nx * m;
    this.stick.y = ny * m;
  }

  hitsButton(x: number, y: number): boolean {
    const b = this.layout.button;
    return Math.hypot(x - b.x, y - b.y) <= b.r * 1.25;
  }

  // ------------------------------------------------------------ keyboard
  keyDown(key: string): void {
    const k = key.toLowerCase();
    if (k === ' ' || k === 'enter' || k === 'e') {
      if (!this.keys.has('action')) {
        this.keys.add('action');
        this.pendingActions++;
        this.button.pressT = 1;
        this.button.pressed = true;
      }
      return;
    }
    this.keys.add(k);
  }

  keyUp(key: string): void {
    const k = key.toLowerCase();
    if (k === ' ' || k === 'enter' || k === 'e') {
      this.keys.delete('action');
      if (this.button.id === NO_ID) this.button.pressed = false;
      return;
    }
    this.keys.delete(k);
  }

  // ------------------------------------------------------------ per frame
  update(dt: number): void {
    this.button.pressT = Math.max(0, this.button.pressT - dt * 4);
  }

  /** Current movement input (stick wins over keyboard). */
  input(): MoveInput {
    if (this.stick.x !== 0 || this.stick.y !== 0) return { x: this.stick.x, y: this.stick.y };
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** Returns true once per queued press. */
  consumeAction(): boolean {
    if (this.pendingActions <= 0) return false;
    this.pendingActions--;
    return true;
  }
}

/** Fits the virtual world on top and leaves a control strip at the bottom. */
export function computeLayout(width: number, height: number, bottomInset: number, worldW: number, worldH: number): ControlsLayout {
  const minZone = 150 + bottomInset;
  const scale = Math.max(0.5, Math.min(width / worldW, (height - minZone) / worldH));
  const drawnW = worldW * scale;
  const drawnH = worldH * scale;
  const worldX = (width - drawnW) / 2;
  const worldY = 0;
  const zoneY = drawnH;
  const zoneH = Math.max(minZone, height - drawnH);
  const usableH = zoneH - bottomInset;
  const r = Math.max(34, Math.min(50, usableH * 0.3));
  const stickRadius = Math.max(36, Math.min(50, usableH * 0.3));
  const centerY = zoneY + usableH / 2;
  return {
    width,
    height,
    worldX,
    worldY,
    scale,
    zoneY,
    zoneH,
    bottomInset,
    stickHome: { x: 32 + stickRadius, y: centerY },
    stickRadius,
    button: { x: width - r - 34, y: centerY, r },
  };
}
