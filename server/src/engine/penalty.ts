import type { Card, GameConfig } from '@fkd/shared';
import type { RNG } from './rng.js';

/**
 * Penaltı turu:
 * - Atıcı: maçta KULLANILMIŞ 4 saha kartından biri geri çağrılır (kör seçim).
 * - Atıcı gücü = sut×0.7 + teknik×0.3 (config'ten, normalize edilir).
 * - Kurtarış gücü = kaleci 3 statının ortalaması.
 * - Gol: atıcı gücü rakip kalecininkinden KESİN büyükse (eşitlik = kurtarış).
 * - Her seri (exchange) kendi içinde karşılaştırılır; fark yoksa ani ölümle devam.
 * - 4 saha atıcısı da tükenirse 5. seri KALECİLER arasında oynanır: kalecinin
 *   atıcı gücü = kendi kurtarış gücü (stat ortalaması).
 * - 5 seri de berabere biterse: toplam el statı (5 kart, tüm statlar) yüksek
 *   olan kazanır; o da eşitse yazı-tura (rng).
 */

export interface ExchangeResult {
  shooters: [Card, Card];
  powers: [number, number];
  savePowers: [number, number];
  goals: [boolean, boolean];
}

export interface PenaltyState {
  goals: [number, number];
  usedShooterIds: [string[], string[]];
  pending: [Card | null, Card | null];
  exchanges: ExchangeResult[];
  finished: boolean;
  winner: 0 | 1 | null;
  /** Kazanan tie-break ile mi belirlendi? ('stats' = toplam el statı, 'coin' = yazı-tura) */
  decidedBy: 'goals' | 'stats' | 'coin' | null;
}

export function shooterPower(card: Card, config: GameConfig): number {
  // Kaleci atıcı olduğunda (5. seri) sut/teknik statı yoktur; atıcı gücü
  // kurtarış gücüne eşittir — kaleci düellosunu ortalaması yüksek olan kazanır.
  if (card.position === 'gk') return keeperSavePower(card);
  let sum = 0;
  let weightSum = 0;
  for (const [stat, weight] of Object.entries(config.penalty.shooterWeights)) {
    const value = card.stats[stat];
    if (value === undefined) throw new Error(`Atıcı statı eksik: ${card.id}.${stat}`);
    sum += value * weight;
    weightSum += weight;
  }
  return sum / weightSum;
}

/** Kaleci kurtarış gücü = tüm kaleci statlarının ortalaması. */
export function keeperSavePower(keeper: Card): number {
  if (keeper.position !== 'gk') throw new Error('Kurtarış gücü sadece kaleci için hesaplanır');
  const values = Object.values(keeper.stats);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Tek şut: atıcı gücü kurtarış gücünden kesin büyükse gol. */
export function resolveShot(shooter: Card, keeper: Card, config: GameConfig): boolean {
  return shooterPower(shooter, config) > keeperSavePower(keeper);
}

export function createPenalty(): PenaltyState {
  return {
    goals: [0, 0],
    usedShooterIds: [[], []],
    pending: [null, null],
    exchanges: [],
    finished: false,
    winner: null,
    decidedBy: null,
  };
}

/**
 * Atıcı seçimi (kör). `matchUsedIds`: oyuncunun maçta kullandığı kart id'leri
 * (Kilit Round nedeniyle kaleciyi de içerir) — atıcı bunların arasından gelmek
 * zorunda. Kaleci ancak `maxFieldShooters` saha atıcısı tükendikten sonra
 * (5. seri) atıcı olabilir.
 */
export function pickShooter(
  state: PenaltyState,
  playerIdx: 0 | 1,
  card: Card,
  matchUsedIds: readonly string[],
  maxFieldShooters = 4
): PenaltyState {
  if (state.finished) throw new Error('Penaltı turu bitti');
  if (state.pending[playerIdx]) throw new Error(`Oyuncu ${playerIdx} bu seride zaten atıcı seçti`);
  if (card.position === 'gk' && state.usedShooterIds[playerIdx].length < maxFieldShooters)
    throw new Error('Kaleci ancak tüm saha atıcıları tükendiğinde penaltı atabilir');
  if (!matchUsedIds.includes(card.id)) throw new Error('Atıcı, maçta kullanılan kartlardan seçilmeli');
  if (state.usedShooterIds[playerIdx].includes(card.id)) throw new Error(`Bu kart zaten penaltı attı: ${card.id}`);

  const next = clone(state);
  next.pending[playerIdx] = card;
  return next;
}

/**
 * İki atıcı da kilitlenince seriyi çözer. Seri içi fark varsa kazanan belli olur;
 * yoksa ani ölümle devam. `maxShootersPerPlayer` (4 saha kartı + kaleci = 5)
 * tükenmişse ve hâlâ eşitse tie-break uygulanır.
 */
export function resolveExchange(
  state: PenaltyState,
  keepers: [Card, Card],
  hands: [Card[], Card[]],
  config: GameConfig,
  rng: RNG,
  maxShootersPerPlayer = 5
): PenaltyState {
  if (state.finished) throw new Error('Penaltı turu bitti');
  const [shooterA, shooterB] = state.pending;
  if (!shooterA || !shooterB) throw new Error('İki oyuncu da atıcı seçmeden seri çözülemez');

  const powerA = shooterPower(shooterA, config);
  const powerB = shooterPower(shooterB, config);
  const saveA = keeperSavePower(keepers[0]);
  const saveB = keeperSavePower(keepers[1]);
  // A'nın şutunu B'nin kalecisi karşılar ve tersi.
  const goalA = powerA > saveB;
  const goalB = powerB > saveA;

  const next = clone(state);
  next.goals = [state.goals[0] + (goalA ? 1 : 0), state.goals[1] + (goalB ? 1 : 0)];
  next.usedShooterIds[0].push(shooterA.id);
  next.usedShooterIds[1].push(shooterB.id);
  next.exchanges.push({ shooters: [shooterA, shooterB], powers: [powerA, powerB], savePowers: [saveA, saveB], goals: [goalA, goalB] });
  next.pending = [null, null];

  if (goalA !== goalB) {
    next.finished = true;
    next.winner = goalA ? 0 : 1;
    next.decidedBy = 'goals';
    return next;
  }

  const exhausted =
    next.usedShooterIds[0].length >= maxShootersPerPlayer && next.usedShooterIds[1].length >= maxShootersPerPlayer;
  if (exhausted) {
    const totalA = handTotal(hands[0]);
    const totalB = handTotal(hands[1]);
    next.finished = true;
    if (totalA !== totalB) {
      next.winner = totalA > totalB ? 0 : 1;
      next.decidedBy = 'stats';
    } else {
      next.winner = rng() < 0.5 ? 0 : 1;
      next.decidedBy = 'coin';
    }
  }
  return next;
}

/** Toplam el statı: 5 kartın (4 saha + kaleci) tüm statlarının toplamı. */
export function handTotal(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + Object.values(card.stats).reduce((a, b) => a + b, 0), 0);
}

function clone(state: PenaltyState): PenaltyState {
  return {
    ...state,
    goals: [...state.goals],
    usedShooterIds: [[...state.usedShooterIds[0]], [...state.usedShooterIds[1]]],
    pending: [...state.pending] as [Card | null, Card | null],
    exchanges: [...state.exchanges],
  };
}
