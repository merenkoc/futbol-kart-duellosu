import { describe, expect, it } from 'vitest';
import {
  createPenalty,
  handTotal,
  keeperSavePower,
  pickShooter,
  resolveExchange,
  resolveShot,
  shooterPower,
} from '../src/engine/penalty.js';
import { mulberry32 } from '../src/engine/rng.js';
import { config, makeFieldCard, makeGkCard } from './helpers.js';

const strongShooter = makeFieldCard('strong', { sut: 95, teknik: 90 }); // 95*.7+90*.3 = 93.5
const weakShooter = makeFieldCard('weak', { sut: 60, teknik: 60 }); // 60
const keeper85 = makeGkCard('k85', 85, 85, 85); // kurtarış 85

describe('güç formülleri', () => {
  it('atıcı gücü = sut×0.7 + teknik×0.3', () => {
    expect(shooterPower(strongShooter, config)).toBeCloseTo(95 * 0.7 + 90 * 0.3, 10);
  });

  it('kurtarış gücü = (atlama + kurtaris + pozisyonAlma) / 3', () => {
    expect(keeperSavePower(makeGkCard('k', 80, 90, 88))).toBeCloseTo((80 + 90 + 88) / 3, 10);
  });

  it('saha kartından kurtarış gücü hesaplanamaz', () => {
    expect(() => keeperSavePower(strongShooter)).toThrow();
  });

  it('kalecinin atıcı gücü kurtarış gücüne eşittir (5. seri kaleci düellosu)', () => {
    expect(shooterPower(keeper85, config)).toBeCloseTo(keeperSavePower(keeper85), 10);
  });

  it('gol sadece atıcı gücü KESİN büyükse (eşitlik = kurtarış)', () => {
    expect(resolveShot(strongShooter, keeper85, config)).toBe(true); // 93.5 > 85
    expect(resolveShot(weakShooter, keeper85, config)).toBe(false); // 60 < 85
    const equalShooter = makeFieldCard('eq', { sut: 85, teknik: 85 }); // tam 85
    expect(resolveShot(equalShooter, keeper85, config)).toBe(false); // 85 > 85 değil
  });
});

describe('atıcı seçimi doğrulamaları', () => {
  const usedInMatch = ['strong', 'weak'];

  it('atıcı maçta kullanılan kartlardan seçilmeli', () => {
    const state = createPenalty();
    const unused = makeFieldCard('unused', {});
    expect(() => pickShooter(state, 0, unused, usedInMatch)).toThrow(/maçta kullanılan/);
    expect(() => pickShooter(state, 0, strongShooter, usedInMatch)).not.toThrow();
  });

  it('aynı kart iki kez penaltı atamaz', () => {
    let state = createPenalty();
    state = pickShooter(state, 0, strongShooter, usedInMatch);
    state = pickShooter(state, 1, weakShooter, usedInMatch);
    state = resolveExchange(state, [keeper85, keeper85], [[], []], config, mulberry32(1));
    if (!state.finished) {
      expect(() => pickShooter(state, 0, strongShooter, usedInMatch)).toThrow(/zaten penaltı attı/);
    }
  });

  it('kaleci, saha atıcıları tükenmeden atıcı olamaz', () => {
    const state = createPenalty();
    expect(() => pickShooter(state, 0, keeper85, ['k85'])).toThrow(/saha atıcıları tükendiğinde/);
  });
});

describe('seri çözümü', () => {
  const used = ['strong', 'weak'];

  it('biri gol atar diğeri atamazsa kazanan belli olur', () => {
    let state = createPenalty();
    state = pickShooter(state, 0, strongShooter, used); // 93.5 > 85 → gol
    state = pickShooter(state, 1, weakShooter, used); // 60 < 85 → kurtarış
    state = resolveExchange(state, [keeper85, keeper85], [[], []], config, mulberry32(1));
    expect(state.finished).toBe(true);
    expect(state.winner).toBe(0);
    expect(state.decidedBy).toBe('goals');
    expect(state.goals).toEqual([1, 0]);
  });

  it('ikisi de gol atarsa (veya ikisi de kaçırırsa) devam edilir', () => {
    let state = createPenalty();
    const s2 = makeFieldCard('s2', { sut: 92, teknik: 92 });
    state = pickShooter(state, 0, strongShooter, ['strong']);
    state = pickShooter(state, 1, s2, ['s2']);
    state = resolveExchange(state, [keeper85, keeper85], [[], []], config, mulberry32(1));
    expect(state.finished).toBe(false);
    expect(state.goals).toEqual([1, 1]);
    expect(state.pending).toEqual([null, null]);
  });

  it('4 saha atıcısı tükenince 5. seri kaleci düellosudur; ortalaması yüksek kaleci kazanır', () => {
    // Saha atıcıları hep kaçırsın: elit savunan kaleciler.
    const shootersA = [1, 2, 3, 4].map((i) => makeFieldCard(`a${i}`, { sut: 70, teknik: 70 }));
    const shootersB = [1, 2, 3, 4].map((i) => makeFieldCard(`b${i}`, { sut: 70, teknik: 70 }));
    const gkA = makeGkCard('gkA', 96, 96, 96); // ortalama 96
    const gkB = makeGkCard('gkB', 90, 90, 90); // ortalama 90
    const usedA = [...shootersA.map((c) => c.id), gkA.id];
    const usedB = [...shootersB.map((c) => c.id), gkB.id];
    const handAFull = [...shootersA, gkA];
    const handBFull = [...shootersB, gkB];

    let state = createPenalty();
    const rng = mulberry32(2);
    for (let i = 0; i < 4; i++) {
      // Kaleci bu aşamada henüz atıcı olamaz.
      expect(() => pickShooter(state, 0, gkA, usedA)).toThrow(/saha atıcıları/);
      state = pickShooter(state, 0, shootersA[i]!, usedA);
      state = pickShooter(state, 1, shootersB[i]!, usedB);
      state = resolveExchange(state, [gkA, gkB], [handAFull, handBFull], config, rng);
      expect(state.finished).toBe(false);
    }
    // 5. seri: kaleciler atıcı. gkA (96) gkB'yi (90) geçer, gkB gkA'yı geçemez.
    state = pickShooter(state, 0, gkA, usedA);
    state = pickShooter(state, 1, gkB, usedB);
    state = resolveExchange(state, [gkA, gkB], [handAFull, handBFull], config, rng);
    expect(state.finished).toBe(true);
    expect(state.decidedBy).toBe('goals');
    expect(state.winner).toBe(0);
  });

  it('kaleci düellosu da berabere kalırsa toplam el statı kazananı belirler', () => {
    const shootersA = [1, 2, 3, 4].map((i) => makeFieldCard(`a${i}`, { sut: 70, teknik: 70 }));
    const shootersB = [1, 2, 3, 4].map((i) => makeFieldCard(`b${i}`, { sut: 70, teknik: 70 }));
    const gkA = makeGkCard('gkA', 96, 96, 96);
    const gkB = makeGkCard('gkB', 96, 96, 96); // eşit ortalama → kaleci düellosu berabere
    const usedA = [...shootersA.map((c) => c.id), gkA.id];
    const usedB = [...shootersB.map((c) => c.id), gkB.id];
    // A'nın eli toplamda daha güçlü olsun.
    const handAFull = [...shootersA.map((c) => ({ ...c, stats: { ...c.stats, pas: 90 } })), gkA];
    const handBFull = [...shootersB, gkB];
    const totalA = handTotal(handAFull);
    const totalB = handTotal(handBFull);
    expect(totalA).toBeGreaterThan(totalB);

    let state = createPenalty();
    const rng = mulberry32(2);
    for (let i = 0; i < 4; i++) {
      state = pickShooter(state, 0, shootersA[i]!, usedA);
      state = pickShooter(state, 1, shootersB[i]!, usedB);
      state = resolveExchange(state, [gkA, gkB], [handAFull, handBFull], config, rng);
    }
    state = pickShooter(state, 0, gkA, usedA);
    state = pickShooter(state, 1, gkB, usedB);
    state = resolveExchange(state, [gkA, gkB], [handAFull, handBFull], config, rng);
    expect(state.finished).toBe(true);
    expect(state.decidedBy).toBe('stats');
    expect(state.winner).toBe(0);
  });

  it('el statları da eşitse yazı-tura ile kazanan belirlenir', () => {
    const shootersA = [1, 2, 3, 4].map((i) => makeFieldCard(`a${i}`, {}));
    const shootersB = [1, 2, 3, 4].map((i) => makeFieldCard(`b${i}`, {}));
    const gkA = makeGkCard('gkA', 96, 96, 96);
    const gkB = makeGkCard('gkB', 96, 96, 96);
    const usedA = [...shootersA.map((c) => c.id), gkA.id];
    const usedB = [...shootersB.map((c) => c.id), gkB.id];
    const handAFull = [...shootersA, gkA];
    const handBFull = [...shootersB, gkB];
    expect(handTotal(handAFull)).toBe(handTotal(handBFull));

    let state = createPenalty();
    const rng = mulberry32(3);
    for (let i = 0; i < 4; i++) {
      state = pickShooter(state, 0, shootersA[i]!, usedA);
      state = pickShooter(state, 1, shootersB[i]!, usedB);
      state = resolveExchange(state, [gkA, gkB], [handAFull, handBFull], config, rng);
    }
    state = pickShooter(state, 0, gkA, usedA);
    state = pickShooter(state, 1, gkB, usedB);
    state = resolveExchange(state, [gkA, gkB], [handAFull, handBFull], config, rng);
    expect(state.finished).toBe(true);
    expect(state.decidedBy).toBe('coin');
    expect([0, 1]).toContain(state.winner);
  });

  it('iki atıcı kilitlenmeden seri çözülemez', () => {
    let state = createPenalty();
    state = pickShooter(state, 0, strongShooter, used);
    expect(() => resolveExchange(state, [keeper85, keeper85], [[], []], config, mulberry32(1))).toThrow();
  });
});

describe('handTotal', () => {
  it('5 kartın tüm statlarının toplamı', () => {
    const hand = [makeFieldCard('f', {}), makeGkCard('g', 80, 80, 80)];
    // makeFieldCard default: 6 stat × 80 = 480; kaleci 240.
    expect(handTotal(hand)).toBe(480 + 240);
  });
});
