import type { Card, GameConfig, Task } from '@fkd/shared';

/**
 * Görev skoru = Σ(stat × ağırlık) / Σ(ağırlık).
 * Normalize edildiği için JSON'da {"pas":0.5,"teknik":0.5} da {"pas":1,"teknik":1} da
 * (pas+teknik)/2 anlamına gelir — yeni görev eklemek kod değişikliği gerektirmez.
 */
export function taskScore(card: Card, task: Task): number {
  let sum = 0;
  let weightSum = 0;
  for (const [stat, weight] of Object.entries(task.weights)) {
    const value = card.stats[stat];
    if (value === undefined) {
      throw new Error(`Görev '${task.id}' '${stat}' statı istiyor ama '${card.id}' kartında yok`);
    }
    sum += value * weight;
    weightSum += weight;
  }
  if (weightSum === 0) throw new Error(`Görev '${task.id}' ağırlık toplamı 0`);
  return sum / weightSum;
}

/** Kazanan: 0 | 1, beraberlik: null. */
export function compareScores(scoreA: number, scoreB: number): 0 | 1 | null {
  if (scoreA > scoreB) return 0;
  if (scoreB > scoreA) return 1;
  return null;
}

/** Tur puanları: kazanan 3, beraberlikte 1-1. */
export function roundPoints(winner: 0 | 1 | null, config: GameConfig): [number, number] {
  if (winner === 0) return [config.scoring.win, 0];
  if (winner === 1) return [0, config.scoring.win];
  return [config.scoring.draw, config.scoring.draw];
}
