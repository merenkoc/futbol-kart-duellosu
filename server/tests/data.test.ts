import { describe, expect, it } from 'vitest';
import { overall, tierOf, validateCard } from '../src/engine/cards.js';
import type { Card, PoolInfo, Tier } from '@fkd/shared';
import rawPools from '../../shared/data/pools.json';
import { cards, config, fieldTasks, gkTasks } from './helpers.js';

const pools = rawPools as unknown as PoolInfo[];
const byPool = new Map<string, Card[]>();
for (const c of cards) {
  const list = byPool.get(c.pool ?? 'default') ?? [];
  list.push(c);
  byPool.set(c.pool ?? 'default', list);
}

describe('cards.json + pools.json doğrulama', () => {
  it('kart id\'leri benzersiz', () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pools.json\'daki her havuz için kart var, kartlardaki her havuz pools.json\'da tanımlı', () => {
    const poolIds = new Set(pools.map((p) => p.id));
    expect(new Set(byPool.keys())).toEqual(poolIds);
  });

  it('her havuz tam 25 saha + 5 kaleci', () => {
    for (const [poolId, list] of byPool) {
      const field = list.filter((c) => c.position === 'field');
      const gk = list.filter((c) => c.position === 'gk');
      expect(field.length, `${poolId} saha`).toBe(25);
      expect(gk.length, `${poolId} kaleci`).toBe(5);
    }
  });

  it('her kartın statları config listesiyle eşleşiyor ve 0-99 aralığında', () => {
    for (const card of cards) {
      expect(validateCard(card, config)).toEqual([]);
    }
  });

  it('her kartın havuz-içi kademesi atanmış ve tierOf onu kullanıyor', () => {
    for (const card of cards) {
      expect(card.tier, card.id).toBeDefined();
      expect(tierOf(card, config)).toBe(card.tier);
    }
  });

  it('her havuzda draft kompozisyonlarını besleyecek kademe dağılımı var (saha 7/10/8, kaleci 1/2/2)', () => {
    for (const [poolId, list] of byPool) {
      const count = (pos: string, tier: Tier) => list.filter((c) => c.position === pos && c.tier === tier).length;
      expect(count('field', 'ust'), `${poolId} saha üst`).toBe(7);
      expect(count('field', 'orta'), `${poolId} saha orta`).toBe(10);
      expect(count('field', 'alt'), `${poolId} saha alt`).toBe(8);
      expect(count('gk', 'ust'), `${poolId} kaleci üst`).toBe(1);
      expect(count('gk', 'orta'), `${poolId} kaleci orta`).toBe(2);
      expect(count('gk', 'alt'), `${poolId} kaleci alt`).toBe(2);
    }
  });

  it('overall doğru hesaplanıyor (statların yuvarlanmış ortalaması)', () => {
    const card = cards[0]!;
    const vals = Object.values(card.stats);
    const expected = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    expect(overall(card)).toBe(expected);
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
