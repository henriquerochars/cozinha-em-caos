import { RECIPES, SCORE_MISSED, type GameEvent } from '@cozinha/shared';
import type { ClientWorld } from './ClientWorld';
import type { FxSystem } from './fx';
import type { SfxName } from '../../audio/sfx';
import { itemParticleColors } from '../rendering/items';

export interface EventSink {
  play(name: SfxName, opts?: { volume?: number; minGapMs?: number }): void;
  haptic(kind: 'light' | 'medium' | 'success' | 'error' | 'select'): void;
}

const GOLD = '#FFD166';
const RED = '#FF6B6B';
const MINT = '#5FD39A';
const WHITE = '#FFFFFF';

/**
 * Turns one-shot server events into client-side feedback: particles, popups,
 * sounds and haptics. Everything here is cosmetic; the state is authoritative.
 */
export function reactToEvent(ev: GameEvent, world: ClientWorld, fx: FxSystem, out: EventSink, localId: string): void {
  const mine = 'playerId' in ev && ev.playerId === localId;
  const at = (stationId: string): { x: number; y: number } => world.stationCenter(stationId);

  switch (ev.t) {
    case 'pickup': {
      const p = at(ev.stationId);
      fx.chips(p.x, p.y - 8, itemParticleColors(ev.item));
      out.play('pickup', { volume: mine ? 0.9 : 0.5 });
      if (mine) out.haptic('light');
      break;
    }
    case 'place': {
      const p = at(ev.stationId);
      fx.chips(p.x, p.y - 6, itemParticleColors(ev.item));
      world.flashStation(ev.stationId);
      out.play('place', { volume: mine ? 0.9 : 0.5 });
      if (mine) out.haptic('light');
      break;
    }
    case 'chopStart':
      // the repeating chop sound/particles are driven by the frame loop
      if (mine) out.haptic('select');
      break;
    case 'chopDone': {
      const p = at(ev.stationId);
      fx.burst(p.x, p.y - 10, 8, itemParticleColors(ev.item), { speed: 60, size: 2.5, maxLife: 0.5 });
      fx.popup(p.x, p.y - 26, 'Cortado!', MINT, 11, 0.9);
      world.flashStation(ev.stationId);
      out.play('ding', { volume: 0.6 });
      break;
    }
    case 'cookStart': {
      out.play('sizzle', { volume: 0.7 });
      break;
    }
    case 'cookDone': {
      const p = at(ev.stationId);
      fx.popup(p.x, p.y - 26, 'Pronto!', GOLD, 12, 1.1);
      fx.stars(p.x, p.y - 8, 8);
      world.flashStation(ev.stationId);
      out.play('bell', { volume: 0.8 });
      break;
    }
    case 'assembled': {
      const p = at(ev.stationId);
      fx.stars(p.x, p.y - 10, 12);
      fx.popup(p.x, p.y - 30, RECIPES[ev.recipe].namePt, GOLD, 12, 1.2);
      world.flashStation(ev.stationId);
      out.play('success', { volume: 0.7 });
      break;
    }
    case 'delivered': {
      const p = at('delivery');
      fx.stars(p.x, p.y - 16, 16);
      fx.popup(p.x, p.y - 36, `+${ev.points}`, GOLD, 18, 1.3);
      if (ev.bonus > 0) fx.popup(p.x, p.y - 52, `rapidez +${ev.bonus}`, WHITE, 9, 1.3);
      fx.fly(`plate:${ev.recipe}`, p.x, p.y - 10, 330, 44, 0.55);
      world.celebrate();
      out.play('success');
      out.play('ding', { volume: 0.8 });
      out.haptic('success');
      break;
    }
    case 'wrongDish': {
      const p = at('delivery');
      fx.popup(p.x, p.y - 30, 'Pedido errado!', RED, 12, 1.2);
      fx.shake(0.25);
      out.play('invalid');
      if (mine) out.haptic('error');
      break;
    }
    case 'orderFailed': {
      fx.popup(180, 70, `${ev.points || SCORE_MISSED}  ${RECIPES[ev.recipe].namePt}`, RED, 12, 1.4);
      fx.shake(0.35);
      out.play('fail', { volume: 0.9 });
      out.haptic('error');
      break;
    }
    case 'newOrder':
      out.play('bell', { volume: 0.35, minGapMs: 200 });
      break;
    case 'trash': {
      const p = at('trash');
      fx.burst(p.x, p.y - 10, 6, ['#9AA3AD', '#C3CAD2'], { shape: 'puff', speed: 30, gravity: -20, maxLife: 0.7, size: 3 });
      out.play('place', { volume: 0.5 });
      break;
    }
    case 'invalid': {
      if (!mine) break;
      const me = world.chefs.get(localId);
      if (me) fx.popup(me.x, me.y - 62, ev.reason, WHITE, 10, 1.1);
      out.play('invalid', { volume: 0.6, minGapMs: 250 });
      out.haptic('error');
      break;
    }
    case 'matchStart':
      fx.showBanner('VALENDO!', 'Cozinhem juntos!', GOLD, 1.3);
      out.play('go');
      out.haptic('medium');
      break;
    case 'matchEnd':
      fx.showBanner('TEMPO!', `${ev.score} pontos`, WHITE, 2.2);
      fx.stars(180, 240, 24);
      out.play('end');
      out.haptic('success');
      break;
    case 'paused':
      fx.showBanner('PAUSA', ev.reason, WHITE, 1.6);
      break;
    case 'resumed':
      fx.showBanner('VOLTOU!', '', MINT, 1.0);
      out.play('go', { volume: 0.5 });
      break;
    case 'countdown':
      // the numbers are drawn by the frame loop from countdownEndsAt
      break;
    default:
      break;
  }
}
