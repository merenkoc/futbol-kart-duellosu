import { describe, expect, it } from 'vitest';
import type { Card, PenaltyExchangeResultPayload } from '@fkd/shared';
import { reducer } from '../src/reducer.js';
import { initialClientState } from '../src/types.js';

function makeCard(id: string): Card {
  return { id, name: id, position: 'field', stats: { dripling: 80, hiz: 80, sut: 80, teknik: 80, pas: 80, calim: 80 } };
}

function makeExchangeResult(exchangeIndex: number, finished: boolean): PenaltyExchangeResultPayload {
  return {
    exchangeIndex,
    shooters: [makeCard('a'), makeCard('b')],
    powers: [80, 80],
    savePowers: [75, 75],
    goals: [true, true],
    totalGoals: [exchangeIndex + 1, exchangeIndex + 1],
    finished,
    winner: finished ? 0 : null,
    decidedBy: finished ? 'goals' : null,
  };
}

function penaltyStart(
  availableShooterIds: string[],
  exchangeIndex: number,
  totalGoals: [number, number] = [exchangeIndex, exchangeIndex]
) {
  return {
    type: 'PENALTY_START' as const,
    availableShooterIds,
    totalGoals,
    exchangeIndex,
    pendingCardId: null,
    opponentPicked: false,
  };
}

describe('reducer — penaltı ani ölüm (docs/faz4-duzeltme-plani.md Sorun 2)', () => {
  it('PENALTY_START -> PENALTY_RESULT -> PENALTY_START sonrası yeni seride kart seçimi tekrar açılır', () => {
    let state = reducer(initialClientState, penaltyStart(['c1', 'c2'], 0, [0, 0]));
    expect(state.penalty?.lastResult).toBeNull();
    expect(state.penalty?.currentExchangeIndex).toBe(0);

    state = reducer(state, { type: 'PENALTY_PICK_LOCAL', cardId: 'c1' });
    expect(state.penalty?.myPickId).toBe('c1');

    // İlk seri berabere biter (finished:false) -> ani ölüme geçilir.
    state = reducer(state, { type: 'PENALTY_RESULT', result: makeExchangeResult(0, false) });
    expect(state.penalty?.lastResult).not.toBeNull();

    // Sunucu yeni seri için penalty:start gönderir (seri no artık sunucudan gelir).
    state = reducer(state, penaltyStart(['c3', 'c4'], 1));

    // Regresyon: bug'da lastResult korunuyordu ve Penalty.tsx kart listesini
    // hiç göstermiyordu (oyun kilitleniyordu). Artık null olmalı.
    expect(state.penalty?.lastResult).toBeNull();
    expect(state.penalty?.myPickId).toBeNull();
    expect(state.penalty?.opponentPicked).toBe(false);
    expect(state.penalty?.availableShooterIds).toEqual(['c3', 'c4']);
    expect(state.penalty?.currentExchangeIndex).toBe(1);
  });

  it('birden fazla ani ölüm serisinde currentExchangeIndex artmaya devam eder', () => {
    let state = reducer(initialClientState, penaltyStart(['c1'], 0, [0, 0]));
    state = reducer(state, { type: 'PENALTY_RESULT', result: makeExchangeResult(0, false) });
    state = reducer(state, penaltyStart(['c2'], 1));
    expect(state.penalty?.currentExchangeIndex).toBe(1);

    state = reducer(state, { type: 'PENALTY_RESULT', result: makeExchangeResult(1, false) });
    state = reducer(state, penaltyStart(['c3'], 2));
    expect(state.penalty?.currentExchangeIndex).toBe(2);
    expect(state.penalty?.lastResult).toBeNull();
  });

  it('seri maçı bitirirse (finished:true) lastResult MATCH_END\'e kadar okunabilir kalır', () => {
    let state = reducer(initialClientState, penaltyStart(['c1'], 0, [0, 0]));
    state = reducer(state, { type: 'PENALTY_RESULT', result: makeExchangeResult(0, true) });
    expect(state.penalty?.lastResult?.finished).toBe(true);
    expect(state.penalty?.lastResult?.winner).toBe(0);
  });

  it('reconnect: sunucudan gelen seri durumu (skor, seri no, kilitli seçim) aynen yansır', () => {
    const state = reducer(initialClientState, {
      type: 'PENALTY_START',
      availableShooterIds: ['c4'],
      totalGoals: [2, 2],
      exchangeIndex: 3,
      pendingCardId: 'c3',
      opponentPicked: true,
    });
    expect(state.penalty?.totalGoals).toEqual([2, 2]);
    expect(state.penalty?.currentExchangeIndex).toBe(3);
    expect(state.penalty?.myPickId).toBe('c3'); // seçim kilitli görünür, tekrar seçtirmez
    expect(state.penalty?.opponentPicked).toBe(true);
  });
});
