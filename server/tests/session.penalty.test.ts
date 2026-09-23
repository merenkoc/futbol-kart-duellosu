import { describe, expect, it } from 'vitest';
import type { MatchState } from '../src/engine/index.js';
import { MatchSession } from '../src/game/session.js';
import { cards, config, fieldTasks, gkTasks, makeFieldCard, makeGkCard } from './helpers.js';

/**
 * Penaltı ani ölümde art arda berabere
 * seriler yaşandığında hem motor+session'ın doğru ilerlediğini (bu test) hem de
 * client'ın kilitlenmediğini (client/tests/reducer.test.ts) ayrı ayrı doğruluyoruz.
 * Draft/maç aşamalarını atlayıp session'ı doğrudan penaltı fazına taşıyoruz —
 * `MatchSession`'ın phase/hands/matchState/penaltyState alanları bunun için
 * kasıtlı olarak public (ince orkestrasyon kabuğu, motor değil).
 */
function buildPenaltySession(): MatchSession {
  const session = new MatchSession('test-match', 'bot', ['tok0', 'tok1'], config, cards, fieldTasks, gkTasks, 42);

  const strong = (id: string) => makeFieldCard(id, { sut: 90, teknik: 90 });
  const weak = (id: string) => makeFieldCard(id, { sut: 10, teknik: 10 });
  const weakKeeper = (id: string) => makeGkCard(id, 40, 40, 40);

  const hand0 = { fieldCards: [strong('h0-1'), strong('h0-2'), strong('h0-3'), strong('h0-4')], goalkeeper: weakKeeper('gk0') };
  const hand1 = {
    fieldCards: [strong('h1-1'), strong('h1-2'), strong('h1-3'), weak('h1-4')],
    goalkeeper: weakKeeper('gk1'),
  };
  session.hands = [hand0, hand1];
  session.matchState = {
    usedCardIds: [hand0.fieldCards.map((c) => c.id), hand1.fieldCards.map((c) => c.id)],
  } as unknown as MatchState;
  session.phase = 'penalty';
  // createPenalty() engine'den import etmek yerine session zaten pickShooter/resolveExchange
  // çağrılarında penaltyState'i bekliyor; ilk durumu doğrudan kuruyoruz.
  session.penaltyState = {
    goals: [0, 0],
    usedShooterIds: [[], []],
    pending: [null, null],
    exchanges: [],
    finished: false,
    winner: null,
    decidedBy: null,
  };
  return session;
}

describe('MatchSession — penaltı ani ölüm birden fazla seri', () => {
  it('güçler eşitken art arda beraberlik olur, session kilitlenmez (phase penalty, finished false)', () => {
    const session = buildPenaltySession();

    session.pickShooter(0, 'h0-1');
    session.pickShooter(1, 'h1-1');
    expect(session.phase).toBe('penalty');
    expect(session.penaltyState!.finished).toBe(false);
    expect(session.penaltyState!.exchanges).toHaveLength(1);

    session.pickShooter(0, 'h0-2');
    session.pickShooter(1, 'h1-2');
    expect(session.phase).toBe('penalty');
    expect(session.penaltyState!.finished).toBe(false);
    expect(session.penaltyState!.exchanges).toHaveLength(2);

    session.pickShooter(0, 'h0-3');
    session.pickShooter(1, 'h1-3');
    expect(session.phase).toBe('penalty');
    expect(session.penaltyState!.finished).toBe(false);
    expect(session.penaltyState!.exchanges).toHaveLength(3);
  });

  it('fark oluşunca maç biter (phase finished, finalWinner set)', () => {
    const session = buildPenaltySession();
    session.pickShooter(0, 'h0-1');
    session.pickShooter(1, 'h1-1');
    session.pickShooter(0, 'h0-2');
    session.pickShooter(1, 'h1-2');
    session.pickShooter(0, 'h0-3');
    session.pickShooter(1, 'h1-3');

    // 4. seri: h1-4 zayıf atıcı -> gol atamaz, h0-4 güçlü -> gol atar -> karar.
    session.pickShooter(0, 'h0-4');
    session.pickShooter(1, 'h1-4');

    expect(session.penaltyState!.finished).toBe(true);
    expect(session.phase).toBe('finished');
    expect(session.finalWinner).toBe(0);
    expect(session.finalDecidedBy).toBe('penalty');
  });

  it('availableShooterIds her seriden sonra kullanılan atıcıyı düşer', () => {
    const session = buildPenaltySession();
    expect(session.availableShooterIds(0)).toEqual(['h0-1', 'h0-2', 'h0-3', 'h0-4']);
    session.pickShooter(0, 'h0-1');
    session.pickShooter(1, 'h1-1');
    expect(session.availableShooterIds(0)).toEqual(['h0-2', 'h0-3', 'h0-4']);
  });

  // Kilit Round'da motor kalecinin id'sini de
  // matchState.usedCardIds'e ekler (oynanan her kart "kullanıldı" işaretlenir).
  // availableShooterIds bunu saha kartı sanıp döndürürse bot `hand.fieldCards.find`
  // ile eşleyemez -> undefined -> shooterPower çöker (canlıda gözlemlenen kilitlenme).
  it('regresyon: Kilit Round sonrası kalecinin id\'si atıcı listesine sızmaz', () => {
    const session = buildPenaltySession();
    const gk0Id = session.hands![0].goalkeeper.id;
    const gk1Id = session.hands![1].goalkeeper.id;

    // Gerçek akışta resolveRound kaleci turunda kalecinin id'sini de usedCardIds'e ekler.
    session.matchState = {
      usedCardIds: [
        [...session.hands![0].fieldCards.map((c) => c.id), gk0Id],
        [...session.hands![1].fieldCards.map((c) => c.id), gk1Id],
      ],
    } as unknown as MatchState;

    for (const idx of [0, 1] as const) {
      const ids = session.availableShooterIds(idx);
      expect(ids).not.toContain(session.hands![idx].goalkeeper.id);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(session.hands![idx].fieldCards.some((c) => c.id === id)).toBe(true);
      }
    }

    // Bot'un gerçek yolu: availableShooterIds -> kart eşleme (session.ts botShooterChoice).
    // Kaleci sızsaydı bu `undefined!` ile çökerdi.
    expect(() => session.botShooterChoice()).not.toThrow();
  });

  it('4 saha atıcısı tükenince kaleci 5. atıcı olur ve düelloyu ortalaması yüksek kaleci kazanır', () => {
    const session = buildPenaltySession();
    const strong = (id: string) => makeFieldCard(id, { sut: 90, teknik: 90 });
    // İki el de eşit güçte → 4 seri berabere; gk0 ortalaması (50) gk1'den (40) yüksek.
    const hand0 = {
      fieldCards: [strong('h0-1'), strong('h0-2'), strong('h0-3'), strong('h0-4')],
      goalkeeper: makeGkCard('gk0', 50, 50, 50),
    };
    const hand1 = {
      fieldCards: [strong('h1-1'), strong('h1-2'), strong('h1-3'), strong('h1-4')],
      goalkeeper: makeGkCard('gk1', 40, 40, 40),
    };
    session.hands = [hand0, hand1];
    // Gerçek akıştaki gibi Kilit Round kalecileri de usedCardIds'e ekler.
    session.matchState = {
      usedCardIds: [
        [...hand0.fieldCards.map((c) => c.id), 'gk0'],
        [...hand1.fieldCards.map((c) => c.id), 'gk1'],
      ],
    } as unknown as MatchState;

    for (let i = 1; i <= 4; i++) {
      session.pickShooter(0, `h0-${i}`);
      session.pickShooter(1, `h1-${i}`);
      expect(session.penaltyState!.finished).toBe(false); // 90 > 40 ve 90 > 50 → hep gol-gol
    }

    // 5. seri: sadece kaleci sunulur, bot da kaleciyi seçebilir.
    expect(session.availableShooterIds(0)).toEqual(['gk0']);
    expect(session.availableShooterIds(1)).toEqual(['gk1']);
    expect(session.botShooterChoice().id).toBe('gk1');

    session.pickShooter(0, 'gk0');
    session.pickShooter(1, 'gk1');
    expect(session.penaltyState!.finished).toBe(true);
    expect(session.penaltyState!.decidedBy).toBe('goals');
    expect(session.phase).toBe('finished');
    expect(session.finalWinner).toBe(0);
    expect(session.finalDecidedBy).toBe('penalty');
  });
});
