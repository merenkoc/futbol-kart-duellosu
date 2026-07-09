# Faz 2 — Kod Paketi (tasarım ajanına yapıştır)

Konu: **normal tur düello animasyonu**. Design ajanına önce brief'teki
**ORTAK BAĞLAM** bloğunu (Faz 1'de verdiğin), sonra bu dosyayı ver.

**Değiştirilecek dosyalar:** `client/src/components/DuelArea.tsx` ve
`client/src/screens/MatchScreen.tsx`. Gerekirse `client/src/index.css`'e duel
stilleri **ekleyebilir** (mevcut token'ları kullan, yeni sabit hex ekleme) ve
`client/src/sound.ts`'e opsiyonel bir vuruş sesi ekleyebilir.
**Dokunma:** `shared/`, `server/`, socket event isimleri, `reducer.ts`, `types.ts`
(ClientState/action şekli). DuelArea'nın iç props'unu genişletebilirsin ama tek
çağıranı MatchScreen; veriyi yine ClientState'ten al, reducer'ı değiştirme.

---

## FAZ 2 PROMPTU

```
GÖREV: Her turun kart karşılaştırmasını "yayın grafiği" gibi dramatize et.
Dosyalar: client/src/components/DuelArea.tsx, client/src/screens/MatchScreen.tsx,
(gerekirse) index.css'e ekleme, (opsiyonel) sound.ts.

ZAMAN BÜTÇESİ — KRİTİK: Tüm reveal sekansı revealMs = 3000ms İÇİNDE bitmeli.
Sunucu, reveal'den 3 sn sonra bir sonraki round:task'ı gönderiyor; sekans taşarsa
yarıda kesilir. Giriş + flip + skor sayacı + kazanan vurgusu toplam < 3 sn.

BEAT'LER:
1. Görev geldiğinde (kart seçimi ekranı): üstte "GÖREV: {task.name}
   ({stat listesi})" yayın alt-bandı (ribbon) belirsin. (Şu an düz <h2>.)
2. Kartlar oynanınca (DuelArea): benim kartım soldan, rakip kartı (kapalı=faceDown)
   sağdan kayarak girsin.
3. Reveal (lastReveal.round === state.round): rakip kartı flip ile açılır
   (CardView faceDown -> false zaten flip yapıyor; playFlip mevcut). İki skor
   sayısı 0'dan gerçek değerine "sayaç" animasyonuyla artsın (ondalık 1 hane).
4. Sonuç: kazanan kart altın/yeşil parlama + hafif "pop" (scale) alsın; kaybeden
   hafif kararsın; berabere nötr. İstersen çok hafif bir ekran sarsıntısı.
   Kazanılan puan (+3 / +1) küçük bir "chip" olarak skor tablosuna doğru uçsun.

VERİ (bunları KULLAN, değiştirme):
- MatchScreen ClientState.match'ten besleniyor. reveal = state.lastReveal;
  reveal geçerli mi kontrolü: reveal && reveal.round === state.round.
- outcome zaten hesaplanıyor: 'me' | 'other' | 'draw' | null.
- Skorlar reveal.scores[myIdx]/[other]; puan reveal.points[myIdx]/[other];
  toplam skor tablosu state.scores.
- DuelArea props'u (myCard, opponentCard, myScore, opponentScore, outcome)
  genişletilebilir (ör. points/taskWeights eklenebilir) ama MatchScreen bunları
  yine mevcut ClientState'ten geçmeli.

KISITLAR:
- Sekans 3sn'yi AŞMASIN. prefers-reduced-motion'da useReducedMotion ile anında/sade
  göster (sayaç, slide, pop kapansın).
- index.css'e eklerken :root token'larını kullan (--accent, --gold, --glow-*,
  --dur-*, --ease-out, --surface* vb.). Mevcut .duel-* class isimlerini koru,
  gerekiyorsa yenilerini ekle.
- Class isimlerini ve DuelArea'nın MatchScreen dışında bir yerde kullanılmadığını
  varsayabilirsin. Kilit Round KENDİ komponenti (KeeperRound) — ona dokunma.

KABUL: kazan/kaybet/berabere üçü net; skor sayacı + flip 3sn'ye sığıyor;
reduced-motion sade; `npm test` (91+3) ve iki typecheck yeşil.
```

---

## BAĞLAM DOSYALARI

### 1) İlgili tipler (`@fkd/shared` + `client/src/types.ts`)

```ts
// @fkd/shared
export interface Card { id: string; name: string; position: 'field' | 'gk'; stats: Record<string, number>; }
export interface Task { id: string; name: string; type: 'field' | 'gk'; weights: Record<string, number>; }
export interface Hand { fieldCards: Card[]; goalkeeper: Card; }
export interface RoundResult {
  round: number;
  taskId: string;
  cards: [Card, Card];
  scores: [number, number];
  winner: 0 | 1 | null;   // kazanan oyuncu indeksi, null = berabere
  points: [number, number];
}

// client/src/types.ts
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
```

### 2) DEĞİŞTİRİLECEK — `client/src/components/DuelArea.tsx` (mevcut)

```tsx
import { motion } from 'framer-motion';
import type { Card } from '@fkd/shared';
import { CardView } from './CardView.js';

interface Props {
  myCard: Card | null;
  opponentCard: Card | null;
  myScore: number | null;
  opponentScore: number | null;
  outcome: 'me' | 'other' | 'draw' | null;
}

/**
 * Bir turun karşılaştırma alanı: benim oynadığım kart hep açık, rakibinki
 * kilitliyken kart arkası, reveal gelince flip ile açılır (CardView `faceDown`).
 */
export function DuelArea({ myCard, opponentCard, myScore, opponentScore, outcome }: Props) {
  if (!myCard) return null;
  return (
    <div className="duel-area">
      <motion.div
        className={`duel-slot ${outcome === 'me' ? 'duel-winner' : ''}`}
        animate={outcome === 'me' ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 0.4 }}
      >
        <CardView card={myCard} disabled animateEntrance={false} />
        {myScore !== null && <div className="duel-score">{myScore.toFixed(1)}</div>}
      </motion.div>
      <div className="duel-vs">vs</div>
      <motion.div
        className={`duel-slot ${outcome === 'other' ? 'duel-winner' : ''}`}
        animate={outcome === 'other' ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 0.4 }}
      >
        <CardView card={opponentCard ?? myCard} faceDown={!opponentCard} disabled animateEntrance={false} />
        {opponentScore !== null && <div className="duel-score">{opponentScore.toFixed(1)}</div>}
      </motion.div>
    </div>
  );
}
```

### 3) DEĞİŞTİRİLECEK — `client/src/screens/MatchScreen.tsx` (mevcut)

```tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { MatchUiState } from '../types.js';
import { CardView } from '../components/CardView.js';
import { DuelArea } from '../components/DuelArea.js';
import { playClick, playFlip } from '../sound.js';

interface Props {
  state: MatchUiState;
  myIdx: 0 | 1;
  banner: string | null;
  onBannerDone: () => void;
  onPlay: (cardId: string) => void;
}

export function MatchScreen({ state, myIdx, banner, onBannerDone, onPlay }: Props) {
  const locked = state.myPickId !== null;
  const other = myIdx === 0 ? 1 : 0;
  const reveal = state.lastReveal;
  const myPlayedCard =
    (reveal && reveal.round === state.round ? reveal.cards[myIdx] : null) ??
    state.hand.fieldCards.find((c) => c.id === state.myPickId) ??
    null;
  const opponentCard = reveal && reveal.round === state.round ? reveal.cards[other] : null;
  const outcome: 'me' | 'other' | 'draw' | null =
    !reveal || reveal.round !== state.round ? null : reveal.winner === null ? 'draw' : reveal.winner === myIdx ? 'me' : 'other';

  useEffect(() => {
    if (opponentCard) playFlip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(onBannerDone, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner]);

  return (
    <div className="screen match-screen">
      {banner && (
        <motion.div
          className="keeper-banner"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {banner}
        </motion.div>
      )}
      <div className="scoreboard">
        <span>Sen: {state.scores[myIdx]}</span>
        <span>
          Tur {state.round}/{state.totalRounds}
        </span>
        <span>Rakip: {state.scores[other]}</span>
      </div>
      {state.task && (
        <h2>
          Görev: {state.task.name} ({Object.keys(state.task.weights).join(' + ')})
        </h2>
      )}
      {myPlayedCard ? (
        <DuelArea
          myCard={myPlayedCard}
          opponentCard={opponentCard}
          myScore={reveal && reveal.round === state.round ? reveal.scores[myIdx] : null}
          opponentScore={reveal && reveal.round === state.round ? reveal.scores[other] : null}
          outcome={outcome}
        />
      ) : (
        <div className="card-row">
          {state.hand.fieldCards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              used={state.usedCardIds.includes(card.id)}
              disabled={locked}
              onClick={() => {
                playClick();
                onPlay(card.id);
              }}
            />
          ))}
        </div>
      )}
      {state.waitingOpponent && <p className="status">Kartın kilitlendi, rakip bekleniyor…</p>}
      {reveal && reveal.round === state.round && (
        <p className="status">
          {outcome === 'me' && 'Bu turu sen kazandın! (+' + reveal.points[myIdx] + ')'}
          {outcome === 'other' && 'Bu turu rakip kazandı. (+' + reveal.points[other] + ')'}
          {outcome === 'draw' && 'Berabere! (+1 -+1)'}
        </p>
      )}
    </div>
  );
}
```

### 4) Ses fonksiyonları — `client/src/sound.ts` (mevcut imzalar)

```ts
export function playClick(): void   // kart tıklama
export function playFlip(): void    // reveal flip (MatchScreen'de zaten reveal'da çağrılıyor)
export function playWhistle(): void
export function playGoal(): void
export function playSave(): void
export function playWin(): void
export function playLose(): void
```

Yeni bir "vuruş/çarpışma" sesi istersen sound.ts'e aynı desende (Web Audio osilatör
+ gain zarfı) bir `playImpact()` ekleyip DuelArea/MatchScreen'de reveal anında çağır.

### 5) Mevcut duel stilleri (`index.css` — koru/genişlet, token kullan)

```css
.duel-area { display: flex; align-items: center; gap: 1.5rem; }
.duel-slot { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.duel-winner .card {
  background: linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 65%) padding-box,
    linear-gradient(150deg, var(--accent), var(--accent)) border-box;
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.5);
}
.duel-vs { font-weight: 700; color: var(--text-faint); }
.duel-score { font-weight: 700; font-size: 1.1rem; }
/* Mobil: .duel-area { flex-wrap: wrap; justify-content: center; } (@media 640px) */
```

Kullanılabilir token'lar (Faz 1'de eklendi): `--bg --surface --surface-2 --text
--text-dim --text-muted --text-faint --border --accent --gold --sky
--glow-accent --glow-gold --glow-sky --r-* --shadow-card* --dur-fast/med/slow/slower --ease-out`.

---

## Döngü hatırlatma

Ajan çıktı verince (yeni DuelArea.tsx + MatchScreen.tsx, varsa index.css/sound.ts
ekleri) **tam kodu bana yapıştır** → ben senin projene işleyip typecheck + build +
test koşarım, 3sn tempoya ve kısıtlara uyup uymadığını söylerim.
