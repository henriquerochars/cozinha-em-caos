import type { ItemCode } from '@cozinha/shared';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: 'circle' | 'square' | 'star' | 'puff';
  gravity: number;
  spin: number;
  rot: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  rise: number;
}

export interface FlyingItem {
  item: ItemCode;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  duration: number;
}

export interface Banner {
  text: string;
  sub: string;
  life: number;
  maxLife: number;
  color: string;
}

/** Lightweight client-only effects: particles, floating text, flying dishes. */
export class FxSystem {
  particles: Particle[] = [];
  popups: Popup[] = [];
  flying: FlyingItem[] = [];
  banner: Banner | null = null;
  shakeT = 0;

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
      else p.y -= p.rise * dt;
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!;
      f.t += dt;
      if (f.t >= f.duration) this.flying.splice(i, 1);
    }
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
  }

  burst(x: number, y: number, count: number, colors: string[], opts: Partial<Particle> & { speed?: number } = {}): void {
    const speed = opts.speed ?? 70;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      const life = (opts.maxLife ?? 0.6) * (0.7 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.4,
        life,
        maxLife: life,
        size: opts.size ?? 3,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
        shape: opts.shape ?? 'circle',
        gravity: opts.gravity ?? 160,
        spin: (Math.random() - 0.5) * 10,
        rot: Math.random() * Math.PI,
      });
    }
  }

  stars(x: number, y: number, count = 10): void {
    this.burst(x, y, count, ['#FFD166', '#FFF3B0', '#FFB347'], { shape: 'star', size: 5, speed: 110, gravity: 120, maxLife: 0.9 });
  }

  steam(x: number, y: number): void {
    const life = 0.9 + Math.random() * 0.5;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: -22 - Math.random() * 14,
      life,
      maxLife: life,
      size: 3 + Math.random() * 3,
      color: 'rgba(255,255,255,0.75)',
      shape: 'puff',
      gravity: -6,
      spin: 0,
      rot: 0,
    });
  }

  chips(x: number, y: number, colors: string[]): void {
    this.burst(x, y, 4, colors, { shape: 'square', size: 2.5, speed: 55, gravity: 260, maxLife: 0.45 });
  }

  popup(x: number, y: number, text: string, color = '#FFFFFF', size = 13, life = 1.1): void {
    this.popups.push({ x, y, text, color, life, maxLife: life, size, rise: 26 });
  }

  fly(item: ItemCode, fromX: number, fromY: number, toX: number, toY: number, duration = 0.45): void {
    this.flying.push({ item, fromX, fromY, toX, toY, t: 0, duration });
  }

  showBanner(text: string, sub = '', color = '#FFFFFF', life = 1.4): void {
    this.banner = { text, sub, life, maxLife: life, color };
  }

  shake(amount = 0.3): void {
    this.shakeT = Math.max(this.shakeT, amount);
  }

  clear(): void {
    this.particles.length = 0;
    this.popups.length = 0;
    this.flying.length = 0;
    this.banner = null;
    this.shakeT = 0;
  }
}
