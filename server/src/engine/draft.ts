import type { Card, GameConfig, Position, Tier } from '@fkd/shared';
import { tierOf } from './cards.js';
import { pickOne, shuffle, type RNG } from './rng.js';

/**
 * Draft kuralları:
 * - Her turda bir "kademe kompozisyonu" seçilir (örn. [alt,orta,ust] veya [orta,orta,ust]).
 *   İKİ OYUNCUYA AYNI KOMPOZİSYON uygulanır (adalet), ama kartlar bağımsız çekilir
 *   (aynı kart ikisine de sunulabilir — kopyalar rakipler arasında serbest).
 * - Oyuncunun kendi elindeki kart ona tekrar sunulmaz; seçilmeyenler havuza döner
 *   (havuz hiç küçülmediği için bu otomatik sağlanır).
 * - 3. tur kaleci turudur.
 */

export interface DraftState {
  round: number; // 1 bazlı
  /** Her turun kademe kompozisyonu — maç başında sabitlenir, iki oyuncu için aynıdır. */
  plan: Tier[][];
  hands: [Card[], Card[]];
  options: [Card[], Card[]];
  /** Bu turda kilitlenen seçimler. */
  picked: [Card | null, Card | null];
  complete: boolean;
}

export function isGkRound(round: number, config: GameConfig): boolean {
  return round === config.draft.gkRound;
}

/** Maç başında tur planı: her tur için rastgele kompozisyon, slot sırası karıştırılır. */
export function createDraftPlan(config: GameConfig, rng: RNG): Tier[][] {
  const plan: Tier[][] = [];
  for (let r = 1; r <= config.draft.rounds; r++) {
    const pool = isGkRound(r, config) ? config.draft.gkCompositions : config.draft.fieldCompositions;
    plan.push(shuffle(rng, pickOne(rng, pool)));
  }
  return plan;
}

/**
 * Bir oyuncu için 3'lü seçenek çeker.
 * - `excludeIds`: oyuncunun elindeki kartlar (kendi elinde kopya olamaz).
 * - Aynı 3'lü içinde kart tekrarı olmaz.
 * - Kademede uygun kart kalmazsa en yakın kademeye düşer (fallback) — küçük havuzda
 *   oyunun kilitlenmemesi için.
 */
export function drawOptions(
  pool: Card[],
  position: Position,
  composition: Tier[],
  excludeIds: ReadonlySet<string>,
  config: GameConfig,
  rng: RNG
): Card[] {
  const byTier = new Map<Tier, Card[]>();
  for (const card of pool) {
    if (card.position !== position || excludeIds.has(card.id)) continue;
    const t = tierOf(card, config);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(card);
  }

  const tierOrder: Tier[] = ['alt', 'orta', 'ust'];
  const options: Card[] = [];
  const taken = new Set<string>();

  for (const wanted of composition) {
    // İstenen kademeden başlayıp mesafeye göre en yakın kademelere bak.
    const fallback = [...tierOrder].sort(
      (a, b) => Math.abs(tierOrder.indexOf(a) - tierOrder.indexOf(wanted)) - Math.abs(tierOrder.indexOf(b) - tierOrder.indexOf(wanted))
    );
    let found: Card | null = null;
    for (const t of fallback) {
      const candidates = (byTier.get(t) ?? []).filter((c) => !taken.has(c.id));
      if (candidates.length > 0) {
        found = pickOne(rng, candidates);
        break;
      }
    }
    if (!found) throw new Error(`Havuzda yeterli '${position}' kartı yok (kompozisyon: ${composition.join(',')})`);
    taken.add(found.id);
    options.push(found);
  }
  return options;
}

export function createDraft(pool: Card[], config: GameConfig, rng: RNG): DraftState {
  const plan = createDraftPlan(config, rng);
  const state: DraftState = {
    round: 1,
    plan,
    hands: [[], []],
    options: [[], []],
    picked: [null, null],
    complete: false,
  };
  dealOptions(state, pool, config, rng);
  return state;
}

function dealOptions(state: DraftState, pool: Card[], config: GameConfig, rng: RNG): void {
  const composition = state.plan[state.round - 1];
  if (!composition) throw new Error(`Plan eksik: tur ${state.round}`);
  const position: Position = isGkRound(state.round, config) ? 'gk' : 'field';
  for (const p of [0, 1] as const) {
    const exclude = new Set(state.hands[p].map((c) => c.id));
    state.options[p] = drawOptions(pool, position, composition, exclude, config, rng);
  }
}

/**
 * Oyuncunun seçimini uygular. İki oyuncu da seçince tur ilerler ve yeni
 * seçenekler dağıtılır. Yeni state döner (girdi mutate edilmez).
 */
export function applyPick(
  state: DraftState,
  playerIdx: 0 | 1,
  cardId: string,
  pool: Card[],
  config: GameConfig,
  rng: RNG
): DraftState {
  if (state.complete) throw new Error('Draft zaten tamamlandı');
  if (state.picked[playerIdx]) throw new Error(`Oyuncu ${playerIdx} bu turda zaten seçim yaptı`);
  const card = state.options[playerIdx].find((c) => c.id === cardId);
  if (!card) throw new Error(`Kart sunulan seçenekler arasında değil: ${cardId}`);

  const next: DraftState = {
    ...state,
    hands: [[...state.hands[0]], [...state.hands[1]]],
    options: [[...state.options[0]], [...state.options[1]]],
    picked: [...state.picked] as [Card | null, Card | null],
  };
  next.picked[playerIdx] = card;

  if (next.picked[0] && next.picked[1]) {
    next.hands[0].push(next.picked[0]);
    next.hands[1].push(next.picked[1]);
    next.picked = [null, null];
    if (next.round >= config.draft.rounds) {
      next.complete = true;
      next.options = [[], []];
    } else {
      next.round += 1;
      dealOptions(next, pool, config, rng);
    }
  }
  return next;
}

/** Draft sonunda el: 4 saha + 1 kaleci. */
export function splitHand(hand: Card[]): { fieldCards: Card[]; goalkeeper: Card } {
  const fieldCards = hand.filter((c) => c.position === 'field');
  const goalkeeper = hand.find((c) => c.position === 'gk');
  if (!goalkeeper) throw new Error('Elde kaleci yok');
  return { fieldCards, goalkeeper };
}
