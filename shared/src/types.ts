/**
 * Ortak tipler — hem server hem client kullanır.
 * Stat listeleri hard-code DEĞİLDİR: config.json'dan gelir,
 * kart statları Record<string, number> olarak tutulur.
 */

export type Tier = 'alt' | 'orta' | 'ust';
export type Position = 'field' | 'gk';

export interface Card {
  id: string;
  name: string;
  position: Position;
  /** Ait olduğu havuz (milli takım / lig id'si, pools.json). */
  pool?: string;
  /**
   * Havuz-içi göreli kademe. Set ise tierOf overall aralığı yerine bunu kullanır —
   * "en iyi 30" havuzlarında herkes yüksek overall'lı olduğundan mutlak aralıkla
   * herkes üst çıkardı, draft kademe kompozisyonları anlamını yitirirdi.
   */
  tier?: Tier;
  /** Stat adı -> değer (0-99). Anahtarlar config.stats listesiyle eşleşmeli. */
  stats: Record<string, number>;
}

/** Takım seçme ekranı + havuz doğrulaması için havuz meta verisi (pools.json). */
export interface PoolInfo {
  id: string;
  label: string;
  type: 'national' | 'league';
  /** EA veri setindeki karşılığı (üretim script'i kullanır). */
  nation?: string;
  league?: string;
  /** Rozet görseli: bayrak emojisi (milli) ya da kısaltma monogramı (lig). */
  emoji?: string;
  short: string;
  /** Rozet gradyanı [üst, alt]. */
  colors: [string, string];
}

export interface Task {
  id: string;
  name: string;
  type: Position;
  /**
   * Stat -> ağırlık. Skor = Σ(stat × ağırlık) / Σ(ağırlık).
   * Normalize edildiği için {"pas":1,"teknik":1} = (pas+teknik)/2 demektir.
   */
  weights: Record<string, number>;
}

export interface TierRange {
  min: number;
  max: number;
}

export interface GameConfig {
  stats: {
    field: string[];
    gk: string[];
  };
  tiers: Record<Tier, TierRange>;
  draft: {
    rounds: number;
    /** Kaleci turu (1 bazlı). */
    gkRound: number;
    optionsPerRound: number;
    /** Saha turlarında seçilebilecek kademe kompozisyonları (her turda biri rastgele seçilir, iki oyuncuya aynısı uygulanır). */
    fieldCompositions: Tier[][];
    /** Kaleci turunda seçilebilecek kompozisyonlar. */
    gkCompositions: Tier[][];
  };
  match: {
    rounds: number;
    /** Kilit Round — kaleci turu (1 bazlı). */
    gkRound: number;
  };
  scoring: {
    win: number;
    draw: number;
  };
  penalty: {
    /** Atıcı gücü ağırlıkları (normalize edilir): sut 0.7, teknik 0.3. */
    shooterWeights: Record<string, number>;
  };
  bot: {
    /** Göreve göre en iyi kartı oynama olasılığı (kalanı rastgele). */
    bestPickProbability: number;
    minDelayMs: number;
    maxDelayMs: number;
  };
  /** Sahne temposu: server, emit'ler arasına bu sürelerle gecikme koyar ki client animasyonları/reveal'leri gösterebilsin. */
  timing: {
    /** Saha turu reveal'i -> sonraki round:task. */
    revealMs: number;
    /** keeperRound:start -> round:reveal (kaleci giriş sekansı payı). */
    keeperIntroMs: number;
    /** Kaleci reveal -> sonraki adım (banner payı). */
    keeperRevealMs: number;
    /** penalty:result -> yeni penalty:start veya match:end. */
    penaltyResultMs: number;
  };
}

export interface RoundResult {
  round: number;
  taskId: string;
  cards: [Card, Card];
  scores: [number, number];
  /** 0 | 1 = kazanan oyuncu indeksi, null = beraberlik. */
  winner: 0 | 1 | null;
  points: [number, number];
}

/**
 * Socket.io event sözleşmesi.
 * Modlar: "bota karşı", "arkadaşla oyna" (room), "rastgele eşleş" (queue); hepsinde reconnect var.
 */
export type MatchMode = 'bot' | 'friend' | 'matchmaking';

export interface Hand {
  fieldCards: Card[];
  goalkeeper: Card;
}

export interface PenaltyExchangeResultPayload {
  exchangeIndex: number;
  shooters: [Card, Card];
  powers: [number, number];
  savePowers: [number, number];
  goals: [boolean, boolean];
  totalGoals: [number, number];
  finished: boolean;
  winner: 0 | 1 | null;
  decidedBy: 'goals' | 'stats' | 'coin' | null;
}

export interface ClientToServerEvents {
  'bot:start': (payload?: { poolId?: string }) => void;
  'room:create': (payload?: { poolId?: string }) => void;
  'room:join': (payload: { roomId: string }) => void;
  'queue:join': (payload?: { poolId?: string }) => void;
  'match:reconnect': (payload: { matchId: string; playerToken: string }) => void;
  'draft:pick': (payload: { cardId: string }) => void;
  'round:playCard': (payload: { cardId: string }) => void;
  'penalty:pickShooter': (payload: { cardId: string }) => void;
  'match:rematch': () => void;
}

export interface ServerToClientEvents {
  'room:created': (payload: { roomId: string }) => void;
  'queue:waiting': () => void;
  'match:start': (payload: { matchId: string; playerIdx: 0 | 1; playerToken: string; poolId: string }) => void;
  'draft:options': (payload: {
    round: number;
    totalRounds: number;
    isGkRound: boolean;
    options: Card[];
    /** Maçın tur sıralı 5 görevi (görev önizlemesi) — iki oyuncuya da aynı gider. */
    tasks: Task[];
  }) => void;
  'draft:opponentPicked': (payload: { round: number }) => void;
  'draft:complete': (payload: { hand: Hand; tasks: Task[] }) => void;
  'round:task': (payload: { round: number; totalRounds: number; task: Task }) => void;
  'round:waitingOpponent': () => void;
  'round:reveal': (payload: RoundResult) => void;
  'match:score': (payload: { scores: [number, number] }) => void;
  'keeperRound:start': (payload: { round: number; task: Task; keepers: [Card, Card] }) => void;
  'penalty:start': (payload: {
    availableShooterIds: string[];
    /** Seri başı kümülatif gol durumu (reconnect senkronu için de kullanılır). */
    totalGoals: [number, number];
    /** 0-bazlı seri numarası: 0 = ilk seri, 1+ = ani ölüm, 4 = kaleci düellosu. */
    exchangeIndex: number;
    /** Bu oyuncunun bu seride kilitlediği atıcı (reconnect'te null değilse seçim kapalı). */
    pendingCardId: string | null;
    /** Rakip bu seride seçimini kilitledi mi (kart kimliği asla gönderilmez). */
    opponentPicked: boolean;
  }) => void;
  'penalty:opponentPicked': () => void;
  'penalty:result': (payload: PenaltyExchangeResultPayload) => void;
  'match:end': (payload: {
    winner: 0 | 1;
    decidedBy: 'score' | 'penalty' | 'forfeit';
    finalScores: [number, number];
    history: RoundResult[];
    /** Maç penaltılarla bittiyse gol sayıları ve kararın kaynağı; aksi hâlde null. */
    penalty: { goals: [number, number]; decidedBy: 'goals' | 'stats' | 'coin' } | null;
  }) => void;
  'match:rematchRequested': () => void;
  'opponent:disconnected': (payload: { graceMs: number }) => void;
  'opponent:reconnected': () => void;
  error: (payload: { message: string }) => void;
}
