import type { Card, GameConfig, Task } from '@fkd/shared';
import { overall, taskScore } from '../engine/index.js';
import { pickOne, type RNG } from '../engine/rng.js';
import { shooterPower } from '../engine/penalty.js';

/**
 * Kural bazlı bot (tasarım dokümanı §9). Saf fonksiyonlar — karar gecikmesi
 * (config.bot.min/maxDelayMs) çağıran socket katmanında uygulanır, burada yok.
 */

/** Draft: sunulan 3 karttan en yüksek overall'a sahip olanı seçer. */
export function botDraftPick(options: readonly Card[]): Card {
  return options.reduce((best, c) => (overall(c) > overall(best) ? c : best));
}

/**
 * Tur kart seçimi: %`config.bot.bestPickProbability` ihtimalle göreve göre en
 * yüksek skoru verecek kart, kalan ihtimalle rastgele bir kart.
 */
export function botRoundPick(hand: readonly Card[], task: Task, config: GameConfig, rng: RNG): Card {
  if (hand.length === 0) throw new Error('Bot elinde oynanacak kart yok');
  if (rng() < config.bot.bestPickProbability) {
    return hand.reduce((best, c) => (taskScore(c, task) > taskScore(best, task) ? c : best));
  }
  return pickOne(rng, hand);
}

/** Penaltı: en yüksek shooterPower değerli kartı seçer. */
export function botPenaltyPick(candidates: readonly Card[], config: GameConfig): Card {
  return candidates.reduce((best, c) => (shooterPower(c, config) > shooterPower(best, config) ? c : best));
}

/** İnsansı his için 1-2 sn (config'ten) yapay gecikme. */
export function botDelayMs(config: GameConfig, rng: RNG): number {
  const { minDelayMs, maxDelayMs } = config.bot;
  return minDelayMs + Math.floor(rng() * (maxDelayMs - minDelayMs + 1));
}
