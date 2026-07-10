import type { Card, GameConfig, Hand, MatchMode, Task } from '@fkd/shared';
import {
  applyPick,
  createDraft,
  createMatch,
  createPenalty,
  currentTask,
  isGkRound,
  isKeeperRound,
  matchWinner,
  mulberry32,
  playCard as enginePlayCard,
  playKeeperRound,
  pickShooter as enginePickShooter,
  resolveExchange,
  resolveRound,
  splitHand,
  type DraftState,
  type MatchState,
  type PenaltyState,
  type RNG,
} from '../engine/index.js';
import { botDelayMs, botDraftPick, botPenaltyPick, botRoundPick } from './bot.js';

/**
 * Tek bir maçın orkestrasyonu. Motorun saf fonksiyonlarını (draft/match/penalty)
 * sırayla çağıran ince, mutable bir kabuk — CLAUDE.md kuralı gereği tüm oyun
 * mantığı `engine/` içinde saf kalmaya devam ediyor, burada sadece phase geçişi var.
 * `mode==='bot'` dışında playerIdx 1 de gerçek bir insan olabilir (Faz 3);
 * bot'a özel metodlar (botXChoice) sadece mode==='bot' iken handler katmanınca çağrılır.
 */
export type Phase = 'draft' | 'match' | 'penalty' | 'finished';

export class MatchSession {
  readonly id: string;
  readonly config: GameConfig;
  readonly mode: MatchMode;
  readonly playerTokens: [string, string];
  private readonly rng: RNG;
  private readonly pool: Card[];

  phase: Phase = 'draft';
  draftState: DraftState;
  matchState?: MatchState;
  penaltyState?: PenaltyState;
  hands?: [Hand, Hand];
  finalWinner?: 0 | 1;
  finalDecidedBy?: 'score' | 'penalty' | 'forfeit';

  /** Maçın oynandığı havuz (rematch aynı havuzla kurulur). */
  readonly poolId: string;

  constructor(
    id: string,
    mode: MatchMode,
    playerTokens: [string, string],
    config: GameConfig,
    pool: Card[],
    fieldTasks: Task[],
    gkTasks: Task[],
    seed: number,
    poolId = 'default'
  ) {
    this.id = id;
    this.mode = mode;
    this.playerTokens = playerTokens;
    this.config = config;
    this.pool = pool;
    this.poolId = poolId;
    this.rng = mulberry32(seed);
    this.draftState = createDraft(pool, config, this.rng);
    this.fieldTasks = fieldTasks;
    this.gkTasks = gkTasks;
  }

  private fieldTasks: Task[];
  private gkTasks: Task[];

  get isDraftGkRound(): boolean {
    return isGkRound(this.draftState.round, this.config);
  }

  draftPick(playerIdx: 0 | 1, cardId: string): void {
    if (this.phase !== 'draft') throw new Error('Draft aşamasında değil');
    this.draftState = applyPick(this.draftState, playerIdx, cardId, this.pool, this.config, this.rng);
    if (this.draftState.complete) {
      const hand0 = splitHand(this.draftState.hands[0]);
      const hand1 = splitHand(this.draftState.hands[1]);
      this.hands = [hand0, hand1];
      this.matchState = createMatch(this.fieldTasks, this.gkTasks, this.config, this.rng);
      this.phase = 'match';
    }
  }

  get currentMatchTask(): Task {
    return currentTask(this.matchState!);
  }

  get isKeeperRound(): boolean {
    return isKeeperRound(this.matchState!.round, this.config);
  }

  playCard(playerIdx: 0 | 1, cardId: string): void {
    if (this.phase !== 'match') throw new Error('Maç aşamasında değil');
    const hand = this.hands![playerIdx].fieldCards;
    const card = hand.find((c) => c.id === cardId);
    if (!card) throw new Error(`Kart elde değil: ${cardId}`);
    this.matchState = enginePlayCard(this.matchState!, playerIdx, card, this.config);
    if (this.matchState.pending[0] && this.matchState.pending[1]) this.resolveCurrentRound();
  }

  /** Kilit Round: kaleciler otomatik sahaya sürülür ve tur hemen çözülür. */
  playKeeperRoundAuto(): [Card, Card] {
    if (this.phase !== 'match') throw new Error('Maç aşamasında değil');
    const keepers: [Card, Card] = [this.hands![0].goalkeeper, this.hands![1].goalkeeper];
    this.matchState = playKeeperRound(this.matchState!, keepers, this.config);
    this.resolveCurrentRound();
    return keepers;
  }

  private resolveCurrentRound(): void {
    this.matchState = resolveRound(this.matchState!, this.config);
    if (this.matchState.finished) {
      const winner = matchWinner(this.matchState);
      if (winner === 'penalty') {
        this.penaltyState = createPenalty();
        this.phase = 'penalty';
      } else {
        this.finalWinner = winner;
        this.finalDecidedBy = 'score';
        this.phase = 'finished';
      }
    }
  }

  availableShooterIds(playerIdx: 0 | 1): string[] {
    // usedCardIds Kilit Round'da kalecinin id'sini de içerir (motor oynanan her
    // kartı "kullanıldı" işaretler) — saha atıcıları bitmeden kaleci listeye
    // sızmaz (docs/saglik-fix-plani.md K1); 4 saha atıcısı tükenince 5. seri
    // için SADECE kaleci sunulur.
    const fieldIds = new Set(this.hands![playerIdx].fieldCards.map((c) => c.id));
    const usedInMatch = this.matchState!.usedCardIds[playerIdx];
    const usedAsShooter = this.penaltyState!.usedShooterIds[playerIdx];
    const fieldAvailable = usedInMatch.filter((id) => fieldIds.has(id) && !usedAsShooter.includes(id));
    if (fieldAvailable.length > 0) return fieldAvailable;
    const gk = this.hands![playerIdx].goalkeeper;
    return usedAsShooter.includes(gk.id) ? [] : [gk.id];
  }

  pickShooter(playerIdx: 0 | 1, cardId: string): void {
    if (this.phase !== 'penalty') throw new Error('Penaltı aşamasında değil');
    const hand = this.hands![playerIdx];
    const card = [...hand.fieldCards, hand.goalkeeper].find((c) => c.id === cardId);
    if (!card) throw new Error(`Kart elde değil: ${cardId}`);
    const usedInMatch = this.matchState!.usedCardIds[playerIdx];
    this.penaltyState = enginePickShooter(this.penaltyState!, playerIdx, card, usedInMatch);
    if (this.penaltyState.pending[0] && this.penaltyState.pending[1]) this.resolveCurrentExchange();
  }

  private resolveCurrentExchange(): void {
    const keepers: [Card, Card] = [this.hands![0].goalkeeper, this.hands![1].goalkeeper];
    const fullHands: [Card[], Card[]] = [
      [...this.hands![0].fieldCards, this.hands![0].goalkeeper],
      [...this.hands![1].fieldCards, this.hands![1].goalkeeper],
    ];
    this.penaltyState = resolveExchange(this.penaltyState!, keepers, fullHands, this.config, this.rng);
    if (this.penaltyState.finished) {
      this.finalWinner = this.penaltyState.winner!;
      this.finalDecidedBy = 'penalty';
      this.phase = 'finished';
    }
  }

  // --- Bot kararları (rng oturuma özel kaldığı için burada, session içinde) ---

  botDraftChoice(): Card {
    return botDraftPick(this.draftState.options[1]);
  }

  botRoundChoice(): Card {
    const used = this.matchState!.usedCardIds[1];
    const hand = this.hands![1].fieldCards.filter((c) => !used.includes(c.id));
    return botRoundPick(hand, this.currentMatchTask, this.config, this.rng);
  }

  botShooterChoice(): Card {
    const availableIds = this.availableShooterIds(1);
    const all = [...this.hands![1].fieldCards, this.hands![1].goalkeeper];
    const candidates = availableIds.map((id) => all.find((c) => c.id === id)!);
    return botPenaltyPick(candidates, this.config);
  }

  botDelay(): number {
    return botDelayMs(this.config, this.rng);
  }
}
