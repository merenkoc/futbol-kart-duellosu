import { describe, expect, it } from 'vitest';
import { overall, tierOf, validateCard } from '../src/engine/cards.js';
import { cards, config, fieldCards, fieldTasks, gkCards, gkTasks } from './helpers.js';

describe('cards.json doğrulama', () => {
  it('kart id\'leri benzersiz', () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('havuz boyutları: ~30 saha + ~10 kaleci', () => {
    expect(fieldCards.length).toBe(30);
    expect(gkCards.length).toBe(10);
  });

  it('her kartın statları config listesiyle eşleşiyor ve 0-99 aralığında', () => {
    for (const card of cards) {
      expect(validateCard(card, config)).toEqual([]);
    }
  });

  it('her kartın overall\'ı bir kademeye oturuyor (75-95)', () => {
    for (const card of cards) {
      expect(() => tierOf(card, config)).not.toThrow();
    }
  });

  it('her kademede dengeli dağılım var (saha: her kademeden en az 8, kaleci: en az 3)', () => {
    const countByTier = (list: typeof cards) => {
      const counts = { alt: 0, orta: 0, ust: 0 };
      for (const c of list) counts[tierOf(c, config)]++;
      return counts;
    };
    const f = countByTier(fieldCards);
    expect(f.alt).toBeGreaterThanOrEqual(8);
    expect(f.orta).toBeGreaterThanOrEqual(8);
    expect(f.ust).toBeGreaterThanOrEqual(8);
    const g = countByTier(gkCards);
    expect(g.alt).toBeGreaterThanOrEqual(3);
    expect(g.orta).toBeGreaterThanOrEqual(3);
    expect(g.ust).toBeGreaterThanOrEqual(3);
  });

  it('overall doğru hesaplanıyor (statların yuvarlanmış ortalaması)', () => {
    const arda = cards.find((c) => c.id === 'arda_guler')!;
    const vals = Object.values(arda.stats);
    const expected = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    expect(overall(arda)).toBe(expected);
  });
});

describe('tasks.json doğrulama', () => {
  it('10 saha + 4 kaleci görevi var', () => {
    expect(fieldTasks.length).toBe(10);
    expect(gkTasks.length).toBe(4);
  });

  it('görev ağırlıkları geçerli statlara referans veriyor', () => {
    for (const t of fieldTasks) {
      for (const stat of Object.keys(t.weights)) expect(config.stats.field).toContain(stat);
    }
    for (const t of gkTasks) {
      for (const stat of Object.keys(t.weights)) expect(config.stats.gk).toContain(stat);
    }
  });

  it('görev id\'leri benzersiz', () => {
    const ids = [...fieldTasks, ...gkTasks].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('config.json doğrulama', () => {
  it('kompozisyonlar 3 slotlu ve geçerli kademelerden oluşuyor', () => {
    for (const comp of [...config.draft.fieldCompositions, ...config.draft.gkCompositions]) {
      expect(comp.length).toBe(config.draft.optionsPerRound);
      for (const t of comp) expect(['alt', 'orta', 'ust']).toContain(t);
    }
  });

  it('kademe aralıkları boşluksuz ve çakışmasız', () => {
    expect(config.tiers.alt.max + 1).toBe(config.tiers.orta.min);
    expect(config.tiers.orta.max + 1).toBe(config.tiers.ust.min);
  });
});
