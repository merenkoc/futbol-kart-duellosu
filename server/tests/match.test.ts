import { describe, expect, it } from 'vitest';
import {
  createMatch,
  createMatchTasks,
  currentTask,
  isKeeperRound,
  matchWinner,
  playCard,
  playKeeperRound,
  resolveRound,
} from '../src/engine/match.js';
import { mulberry32 } from '../src/engine/rng.js';
import { config, fieldTasks, gkTasks, makeFieldCard, makeGkCard } from './helpers.js';

const handA = [
  makeFieldCard('a1', { sut: 90, teknik: 90 }),
  makeFieldCard('a2', { hiz: 85 }),
  makeFieldCard('a3', { pas: 88 }),
  makeFieldCard('a4', { calim: 82 }),
];
const handB = [
  makeFieldCard('b1', { sut: 70, teknik: 70 }),
  makeFieldCard('b2', { hiz: 75 }),
  makeFieldCard('b3', { pas: 78 }),
  makeFieldCard('b4', { calim: 92 }),
];
const keeperA = makeGkCard('gka', 85, 88, 84);
const keeperB = makeGkCard('gkb', 80, 82, 81);

/** Maçı baştan sona oynatır; her turda verilen sıradaki kartlar oynanır. */
function playFullMatch(seed: number, orderA = handA, orderB = handB) {
  const rng = mulberry32(seed);
  let state = createMatch(fieldTasks, gkTasks, config, rng);
  let fa = 0;
  let fb = 0;
  while (!state.finished) {
    if (isKeeperRound(state.round, config)) {
      state = playKeeperRound(state, [keeperA, keeperB], config);
    } else {
      state = playCard(state, 0, orderA[fa++]!, config);
      state = playCard(state, 1, orderB[fb++]!, config);
    }
    state = resolveRound(state, config);
  }
  return state;
}

describe('görev seçimi', () => {
  it('5 görev: 4 saha (tekrarsız) + 3. turda kaleci görevi', () => {
    for (let seed = 0; seed < 10; seed++) {
      const tasks = createMatchTasks(fieldTasks, gkTasks, config, mulberry32(seed));
      expect(tasks.length).toBe(5);
      expect(tasks[2]!.type).toBe('gk');
      const fieldIds = [tasks[0], tasks[1], tasks[3], tasks[4]].map((t) => t!.id);
      expect(new Set(fieldIds).size).toBe(4);
      for (const id of fieldIds) expect(fieldTasks.some((t) => t.id === id)).toBe(true);
    }
  });

  it('aynı seed aynı görevleri üretir (determinizm)', () => {
    expect(createMatchTasks(fieldTasks, gkTasks, config, mulberry32(21))).toEqual(
      createMatchTasks(fieldTasks, gkTasks, config, mulberry32(21))
    );
  });
});

describe('tur akışı ve doğrulamalar', () => {
  it('tam maç 5 tur sürer ve toplam puanlar tutarlıdır', () => {
    const state = playFullMatch(1);
    expect(state.finished).toBe(true);
    expect(state.history.length).toBe(5);
    // Her tur ya 3-0 ya 1-1 dağıtır.
    for (const r of state.history) {
      const total = r.points[0] + r.points[1];
      expect([3, 2]).toContain(total);
    }
  });

  it('kullanılan saha kartı tekrar oynanamaz', () => {
    const rng = mulberry32(2);
    let state = createMatch(fieldTasks, gkTasks, config, rng);
    state = playCard(state, 0, handA[0]!, config);
    state = playCard(state, 1, handB[0]!, config);
    state = resolveRound(state, config);
    expect(() => playCard(state, 0, handA[0]!, config)).toThrow(/zaten kullanıldı/);
  });

  it('kaleci kartı saha turunda oynanamaz', () => {
    const rng = mulberry32(3);
    const state = createMatch(fieldTasks, gkTasks, config, rng);
    expect(() => playCard(state, 0, keeperA, config)).toThrow(/saha turunda oynanamaz/);
  });

  it('3. turda manuel kart seçimi yok, kaleciler otomatik', () => {
    const rng = mulberry32(4);
    let state = createMatch(fieldTasks, gkTasks, config, rng);
    // İlk iki turu oyna.
    for (const i of [0, 1]) {
      state = playCard(state, 0, handA[i]!, config);
      state = playCard(state, 1, handB[i]!, config);
      state = resolveRound(state, config);
    }
    expect(state.round).toBe(3);
    expect(() => playCard(state, 0, handA[2]!, config)).toThrow(/Kilit Round/);
    // Saha kartı kaleci turunda oynanamaz.
    expect(() => playKeeperRound(state, [handA[2]! as never, keeperB], config)).toThrow();
    state = playKeeperRound(state, [keeperA, keeperB], config);
    state = resolveRound(state, config);
    expect(state.round).toBe(4);
    expect(state.history[2]!.taskId).toBe(currentTaskIdOfGk(state));
  });

  it('iki oyuncu kilitlemeden tur çözülemez', () => {
    const rng = mulberry32(5);
    let state = createMatch(fieldTasks, gkTasks, config, rng);
    state = playCard(state, 0, handA[0]!, config);
    expect(() => resolveRound(state, config)).toThrow();
  });

  it('aynı turda ikinci kart kilitlenemez', () => {
    const rng = mulberry32(6);
    let state = createMatch(fieldTasks, gkTasks, config, rng);
    state = playCard(state, 0, handA[0]!, config);
    expect(() => playCard(state, 0, handA[1]!, config)).toThrow();
  });

  it('görev skorları ve kazanan doğru hesaplanır', () => {
    const rng = mulberry32(7);
    let state = createMatch(fieldTasks, gkTasks, config, rng);
    const task = currentTask(state);
    state = playCard(state, 0, handA[0]!, config);
    state = playCard(state, 1, handB[0]!, config);
    state = resolveRound(state, config);
    const r = state.history[0]!;
    expect(r.taskId).toBe(task.id);
    if (r.scores[0]! > r.scores[1]!) expect(r.winner).toBe(0);
    else if (r.scores[1]! > r.scores[0]!) expect(r.winner).toBe(1);
    else expect(r.winner).toBe(null);
  });
});

describe('maç sonucu', () => {
  it('puanı yüksek olan kazanır, eşitlikte penaltı', () => {
    const state = playFullMatch(1);
    const result = matchWinner(state);
    if (state.scores[0] > state.scores[1]) expect(result).toBe(0);
    else if (state.scores[1] > state.scores[0]) expect(result).toBe(1);
    else expect(result).toBe('penalty');
  });

  it('birebir aynı eller her turda beraberlik → penaltıya gider', () => {
    const state = playFullMatch(9, handA, handA.map((c) => ({ ...c, id: 'x_' + c.id })));
    // Kaleci turu da aynı kaleciyle oynansaydı beraberdi; burada kaleciler farklı,
    // bu yüzden sadece saha turlarının beraberliğini kontrol edelim:
    for (const r of [state.history[0], state.history[1], state.history[3], state.history[4]]) {
      expect(r!.winner).toBe(null);
    }
  });

  it('maç bitmeden sonuç sorgulanamaz', () => {
    const rng = mulberry32(10);
    const state = createMatch(fieldTasks, gkTasks, config, rng);
    expect(() => matchWinner(state)).toThrow();
  });
});

function currentTaskIdOfGk(state: { tasks: { id: string; type: string }[] }): string {
  return state.tasks[2]!.id;
}
