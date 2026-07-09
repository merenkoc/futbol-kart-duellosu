import type { Card, GameConfig, Tier } from './types.js';

/** Overall = tüm statların yuvarlanmış ortalaması (saha: 6 stat, kaleci: 3 stat). */
export function overall(card: Card): number {
  const values = Object.values(card.stats);
  if (values.length === 0) throw new Error(`Kartın statı yok: ${card.id}`);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Overall'a göre kademe. Aralık dışıysa hata — veri doğrulama testi bunu yakalar. */
export function tierOf(card: Card, config: GameConfig): Tier {
  const ov = overall(card);
  for (const [tier, range] of Object.entries(config.tiers) as [Tier, { min: number; max: number }][]) {
    if (ov >= range.min && ov <= range.max) return tier;
  }
  throw new Error(`Kart hiçbir kademeye oturmuyor: ${card.id} (overall ${ov})`);
}

/** Kartın statları config'teki stat listesiyle birebir eşleşiyor mu? */
export function validateCard(card: Card, config: GameConfig): string[] {
  const errors: string[] = [];
  const expected = card.position === 'field' ? config.stats.field : config.stats.gk;
  const keys = Object.keys(card.stats);
  for (const s of expected) {
    if (!(s in card.stats)) errors.push(`${card.id}: eksik stat '${s}'`);
  }
  for (const k of keys) {
    if (!expected.includes(k)) errors.push(`${card.id}: tanımsız stat '${k}'`);
    const v = card.stats[k];
    if (typeof v !== 'number' || v < 0 || v > 99) errors.push(`${card.id}: geçersiz değer ${k}=${v}`);
  }
  return errors;
}
