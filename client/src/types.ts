import type { Card, Hand, PenaltyExchangeResultPayload, RoundResult, Task } from '@fkd/shared';

export type Screen = 'menu' | 'teamSelect' | 'lobby' | 'draft' | 'match' | 'keeperRound' | 'penalty' | 'end';

/** Takım seçiminden sonra hangi modda maç başlatılacak. */
export type PendingMode = 'bot' | 'friend' | 'queue' | null;

export interface LobbyUiState {
  mode: 'creating' | 'joining' | 'queue';
  roomId: string | null;
}

export interface DraftUiState {
  round: number;
  totalRounds: number;
  isGkRound: boolean;
  options: Card[];
  myPickId: string | null;
  opponentPicked: boolean;
}

export interface MatchUiState {
  round: number;
  totalRounds: number;
  task: Task | null;
  scores: [number, number];
  hand: Hand;
  usedCardIds: string[];
  myPickId: string | null;
  waitingOpponent: boolean;
  lastReveal: RoundResult | null;
  history: RoundResult[];
}

export interface KeeperRoundUiState {
  round: number;
  task: Task;
  keepers: [Card, Card];
  reveal: RoundResult | null;
}

export interface PenaltyUiState {
  availableShooterIds: string[];
  myPickId: string | null;
  opponentPicked: boolean;
  totalGoals: [number, number];
  lastResult: PenaltyExchangeResultPayload | null;
  /** 0-bazlı: 0 = ilk seri, 1+ = ani ölüm. */
  currentExchangeIndex: number;
}

export interface EndUiState {
  winner: 0 | 1;
  decidedBy: 'score' | 'penalty' | 'forfeit';
  finalScores: [number, number];
  history: RoundResult[];
  /** Maç penaltılarla bittiyse gol sayıları ve kararın kaynağı. */
  penalty: { goals: [number, number]; decidedBy: 'goals' | 'stats' | 'coin' } | null;
  rematchRequestedByMe: boolean;
  rematchRequestedByOpponent: boolean;
}

export interface ClientState {
  screen: Screen;
  /** Takım seçme ekranı hangi mod için açık. */
  pendingMode: PendingMode;
  /** Maçın oynandığı (ya da host'un seçtiği) havuz. */
  poolId: string | null;
  /** Maçın tur sıralı 5 görevi (görev önizlemesi) — draft başında sunucudan gelir. */
  matchTasks: Task[] | null;
  matchId: string | null;
  /** Sunucudaki RoundResult/PenaltyExchange gibi [0,1] indeksli verilerde "ben" hangisiyim. */
  myIdx: 0 | 1;
  error: string | null;
  lobby: LobbyUiState | null;
  opponentDisconnected: { graceMs: number } | null;
  draft: DraftUiState | null;
  match: MatchUiState | null;
  keeperRound: KeeperRoundUiState | null;
  /** Kilit Round'dan maç ekranına dönüşte 2-3sn görünen sonuç banner'ı. */
  keeperBanner: string | null;
  penalty: PenaltyUiState | null;
  end: EndUiState | null;
}

export const initialClientState: ClientState = {
  screen: 'menu',
  pendingMode: null,
  poolId: null,
  matchTasks: null,
  matchId: null,
  myIdx: 0,
  error: null,
  lobby: null,
  opponentDisconnected: null,
  draft: null,
  match: null,
  keeperRound: null,
  keeperBanner: null,
  penalty: null,
  end: null,
};
