import { describe, expect, it } from 'vitest';
import { botDelayMs, botDraftPick, botPenaltyPick, botRoundPick } from '../src/game/bot.js';
import { overall } from '../src/engine/cards.js';
import { shooterPower } from '../src/engine/penalty.js';
import { mulberry32 } from '../src/engine/rng.js';
import { config, makeFieldCard } from './helpers.js';

describe('botDraftPick', () => {
  it('en yüksek overall\'a sahip kartı seçer', () => {
    const low = makeFieldCard('low', { dripling: 76, hiz: 76, sut: 76, teknik: 76, pas: 76, calim: 76 });
    const mid = makeFieldCard('mid', { dripling: 85, hiz: 85, sut: 85, teknik: 85, pas: 85, calim: 85 });
    const high = makeFieldCard('high', { dripling: 92, hiz: 92, sut: 92, teknik: 92, pas: 92, calim: 92 });
    const picked = botDraftPick([mid, high, low]);
    expect(picked.id).toBe('high');
    expect(overall(picked)).toBe(92);
  });
});

describe('botRoundPick', () => {
  const task = { id: 'ara_pasi', name: 'Ara Pası', type: 'field' as const, weights: { teknik: 0.5, pas: 0.5 } };
  const weak = makeFieldCard('weak', { teknik: 76, pas: 76 });
  const strong = makeFieldCard('strong', { teknik: 95, pas: 95 });

  it('rng düşükken (bestPickProbability altında) her zaman göreve en uygun kartı seçer', () => {
    const rng = () => 0; // her zaman 0 < bestPickProbability -> "en iyi" dal
    const picked = botRoundPick([weak, strong], task, config, rng);
    expect(picked.id).toBe('strong');
  });

  it('rng yüksekken (bestPickProbability üstünde) rastgele seçer', () => {
    const rng = () => 0.999; // her zaman >= bestPickProbability -> rastgele dal
    const picked = botRoundPick([weak, strong], task, config, rng);
    expect(['weak', 'strong']).toContain(picked.id);
  });

  it('tek kart kaldığında onu seçer', () => {
    const picked = botRoundPick([weak], task, config, () => 0);
    expect(picked.id).toBe('weak');
  });
});

describe('botPenaltyPick', () => {
  it('sut*0.7+teknik*0.3 değeri en yüksek olan kartı seçer', () => {
    const a = makeFieldCard('a', { sut: 80, teknik: 80 });
    const b = makeFieldCard('b', { sut: 95, teknik: 70 });
    const picked = botPenaltyPick([a, b], config);
    expect(picked.id).toBe('b');
    expect(shooterPower(picked, config)).toBeGreaterThan(shooterPower(a, config));
  });
});

describe('botDelayMs', () => {
  it('config sınırları içinde bir gecikme döner', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const delay = botDelayMs(config, rng);
      expect(delay).toBeGreaterThanOrEqual(config.bot.minDelayMs);
      expect(delay).toBeLessThanOrEqual(config.bot.maxDelayMs);
    }
  });
});
