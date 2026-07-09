import { describe, expect, it } from 'vitest';
import { tierOf } from '../src/engine/cards.js';
import { applyPick, createDraft, createDraftPlan, drawOptions, isGkRound, splitHand } from '../src/engine/draft.js';
import { mulberry32 } from '../src/engine/rng.js';
import { cards, config } from './helpers.js';

/** Draft'ı iki oyuncu için otomatik oynar (her tur ilk seçenek seçilir). */
function playFullDraft(seed: number) {
  const rng = mulberry32(seed);
  let state = createDraft(cards, config, rng);
  while (!state.complete) {
    state = applyPick(state, 0, state.options[0][0]!.id, cards, config, rng);
    state = applyPick(state, 1, state.options[1][0]!.id, cards, config, rng);
  }
  return state;
}

describe('draft planı', () => {
  it('5 turluk plan üretir, 3. tur kaleci kompozisyonu', () => {
    const plan = createDraftPlan(config, mulberry32(42));
    expect(plan.length).toBe(5);
    expect(isGkRound(3, config)).toBe(true);
    // GK kompozisyonu, config'teki gkCompositions'lardan birinin permütasyonu olmalı.
    const sorted = [...plan[2]!].sort().join(',');
    const allowed = config.draft.gkCompositions.map((c) => [...c].sort().join(','));
    expect(allowed).toContain(sorted);
  });

  it('saha turu kompozisyonları config listesinden gelir', () => {
    const plan = createDraftPlan(config, mulberry32(7));
    const allowed = config.draft.fieldCompositions.map((c) => [...c].sort().join(','));
    for (const r of [0, 1, 3, 4]) {
      expect(allowed).toContain([...plan[r]!].sort().join(','));
    }
  });

  it('aynı seed aynı planı üretir (determinizm)', () => {
    expect(createDraftPlan(config, mulberry32(99))).toEqual(createDraftPlan(config, mulberry32(99)));
  });
});

describe('drawOptions', () => {
  it('kompozisyona uyan kademelerde 3 farklı kart döner', () => {
    const rng = mulberry32(1);
    const opts = drawOptions(cards, 'field', ['alt', 'orta', 'ust'], new Set(), config, rng);
    expect(opts.length).toBe(3);
    expect(new Set(opts.map((c) => c.id)).size).toBe(3);
    expect(opts.map((c) => tierOf(c, config)).sort()).toEqual(['alt', 'orta', 'ust']);
  });

  it('excludeIds\'teki kartlar (oyuncunun eli) asla sunulmaz', () => {
    const exclude = new Set(cards.filter((c) => c.position === 'field').slice(0, 15).map((c) => c.id));
    for (let seed = 0; seed < 20; seed++) {
      const opts = drawOptions(cards, 'field', ['orta', 'orta', 'orta'], exclude, config, mulberry32(seed));
      for (const c of opts) expect(exclude.has(c.id)).toBe(false);
    }
  });

  it('kademede kart kalmazsa en yakın kademeye düşer (fallback)', () => {
    // Sadece alt kademe kaleciler kalsın; üst istenirse alt'a düşmeli (orta da yok).
    const onlyAltGk = cards.filter((c) => c.position === 'gk' && tierOf(c, config) === 'alt');
    const opts = drawOptions(onlyAltGk, 'gk', ['ust', 'orta', 'alt'], new Set(), config, mulberry32(3));
    expect(opts.length).toBe(3);
  });

  it('hiç kart kalmazsa hata fırlatır', () => {
    expect(() => drawOptions([], 'gk', ['orta'], new Set(), config, mulberry32(1))).toThrow();
  });
});

describe('draft akışı', () => {
  it('tam draft: her oyuncuda 4 saha + 1 kaleci biter', () => {
    for (let seed = 0; seed < 10; seed++) {
      const state = playFullDraft(seed);
      expect(state.complete).toBe(true);
      for (const p of [0, 1] as const) {
        const { fieldCards, goalkeeper } = splitHand(state.hands[p]);
        expect(fieldCards.length).toBe(4);
        expect(goalkeeper.position).toBe('gk');
      }
    }
  });

  it('bir oyuncunun elinde aynı kart iki kez olamaz', () => {
    for (let seed = 0; seed < 10; seed++) {
      const state = playFullDraft(seed);
      for (const p of [0, 1] as const) {
        const ids = state.hands[p].map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('iki oyuncu aynı kartı seçebilir (kopya serbest)', () => {
    // Aynı seçenekler sunulmasa da kural motoru bunu engellememeli:
    // iki oyuncuya aynı kartın sunulduğu bir senaryo kuralım.
    const rng = mulberry32(5);
    let state = createDraft(cards, config, rng);
    // p0'ın ilk seçeneğini bul; p1'in seçeneklerinde de varsa ikisi de seçsin.
    // (Garanti için: motor engel koymuyor mu diye sadece p0/p1 farklı turlarda
    //  aynı kartı seçtiğinde el kontrolü yapıyoruz.)
    const shared = state.options[0].find((c) => state.options[1].some((o) => o.id === c.id));
    if (shared) {
      state = applyPick(state, 0, shared.id, cards, config, rng);
      expect(() => applyPick(state, 1, shared.id, cards, config, rng)).not.toThrow();
    }
  });

  it('seçenekte olmayan kart seçilemez', () => {
    const rng = mulberry32(8);
    const state = createDraft(cards, config, rng);
    expect(() => applyPick(state, 0, 'olmayan_kart', cards, config, rng)).toThrow();
  });

  it('aynı turda ikinci seçim yapılamaz', () => {
    const rng = mulberry32(8);
    let state = createDraft(cards, config, rng);
    state = applyPick(state, 0, state.options[0][0]!.id, cards, config, rng);
    expect(() => applyPick(state, 0, state.options[0][1]!.id, cards, config, rng)).toThrow();
  });

  it('3. turda kaleci seçenekleri sunulur', () => {
    const rng = mulberry32(11);
    let state = createDraft(cards, config, rng);
    while (state.round < 3) {
      state = applyPick(state, 0, state.options[0][0]!.id, cards, config, rng);
      state = applyPick(state, 1, state.options[1][0]!.id, cards, config, rng);
    }
    for (const p of [0, 1] as const) {
      for (const c of state.options[p]) expect(c.position).toBe('gk');
    }
  });

  it('iki oyuncuya aynı turda aynı kademe kompozisyonu uygulanır', () => {
    const rng = mulberry32(13);
    const state = createDraft(cards, config, rng);
    const tiersOf = (opts: typeof state.options[0]) => opts.map((c) => tierOf(c, config)).sort().join(',');
    expect(tiersOf(state.options[0])).toBe(tiersOf(state.options[1]));
  });
});
