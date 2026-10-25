import { SCORE_DELIVER, SCORE_MISSED, SCORE_SPEED_BONUS_MAX } from '../constants/world';

export function deliveryPoints(createdAt: number, expiresAt: number, now: number): { points: number; bonus: number } {
  const total = Math.max(1, expiresAt - createdAt);
  const remaining = Math.max(0, Math.min(total, expiresAt - now));
  const bonus = Math.round((remaining / total) * SCORE_SPEED_BONUS_MAX);
  return { points: SCORE_DELIVER + bonus, bonus };
}

export function missedPoints(): number {
  return SCORE_MISSED;
}

/** 0..3 stars for the results screen. */
export function ratingStars(score: number, completed: number): number {
  if (completed === 0) return 0;
  if (score >= 700) return 3;
  if (score >= 400) return 2;
  if (score >= 150) return 1;
  return completed > 0 ? 1 : 0;
}

export function ratingLabelPt(stars: number): string {
  switch (stars) {
    case 3:
      return 'Chefs de elite!';
    case 2:
      return 'Cozinha afiada!';
    case 1:
      return 'Bom começo!';
    default:
      return 'A cozinha pegou fogo…';
  }
}
