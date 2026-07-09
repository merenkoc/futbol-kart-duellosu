# Faz 4 — Kod Paketi (tasarım ajanına yapıştır)

Konu: **maç sonu kutlaması**. Design ajanına önce brief'teki **ORTAK BAĞLAM**
bloğunu, sonra bu dosyayı ver.

**Değiştirilecek dosyalar:** `client/src/screens/MatchEnd.tsx`. Gerekirse
`client/src/index.css`'e kutlama stilleri **ekleyebilir** (token kullan, yeni
sabit hex ekleme). `sound.ts`'te `playWin`/`playLose` zaten var ve MatchEnd
mount'ta çağırıyor.
**Dokunma:** `shared/`, `server/`, socket event isimleri, `reducer.ts`, `types.ts`
(EndUiState/action şekli), diğer ekran komponentleri.

---

## FAZ 4 PROMPTU

```
GÖREV: Bitiş ekranını "yayın finali" gibi dramatize et.
Dosya: client/src/screens/MatchEnd.tsx, (gerekirse) index.css'e ekleme.

İSTENEN:
- Kazandın: stadyum ışıkları/spot hissi, hafif KONFETİ, bir kupa ve büyüyerek
  gelen final skoru. Tur geçmişi (state.history) bir zaman çizelgesi gibi
  sırayla (stagger) belirsin.
- Kaybettin: kararmış, saygılı, sade ton (konfeti yok).
- decidedBy etiketi korunsun: 'score' → "normal skorla", 'penalty' →
  "penaltılarla", 'forfeit' → "rakip bağlantıyı kaybetti".
- "Tekrar Oyna" ve "Ana Menü" butonları yayın stilinde. Rematch bekleme durumu
  korunsun: state.rematchRequestedByMe iken buton "Rakip bekleniyor…" ve disabled;
  state.rematchRequestedByOpponent iken "Rakip tekrar oynamak istiyor" bilgisi.

KISITLAR:
- Konfeti HAFİF olsun (birkaç motion parçacığı ya da küçük bir canvas); performansı
  düşürmesin. prefers-reduced-motion (useReducedMotion) iken konfeti + büyüme
  animasyonları KAPALI, statik göster.
- EndUiState alanlarını (winner, decidedBy, finalScores, history,
  rematchRequestedByMe/ByOpponent) ve buton davranışını (onRematch/onMenu, disabled)
  DEĞİŞTİRME. Veriyi mevcut prop'lardan al; reducer'a dokunma.
- index.css'e eklerken :root token'larını kullan (--accent --gold --sky --surface*
  --glow-* --r-* --dur-* --ease-out). Mevcut class isimlerini bozma.

KABUL: kazan/kaybet belirgin ve farklı; skor + tur geçmişi okunur; konfeti hafif;
reduced-motion sade; `npm test` (91+3) ve iki typecheck yeşil.
```

---

## BAĞLAM DOSYALARI

### 1) İlgili tipler (`client/src/types.ts` + `@fkd/shared`)

```ts
export interface EndUiState {
  winner: 0 | 1;
  decidedBy: 'score' | 'penalty' | 'forfeit';
  finalScores: [number, number];
  history: RoundResult[];
  rematchRequestedByMe: boolean;
  rematchRequestedByOpponent: boolean;
}

// @fkd/shared
export interface RoundResult {
  round: number;
  taskId: string;
  cards: [Card, Card];   // Card: { id, name, position, stats }
  scores: [number, number];
  winner: 0 | 1 | null;
  points: [number, number];
}
```

### 2) DEĞİŞTİRİLECEK — `client/src/screens/MatchEnd.tsx` (mevcut)

```tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { EndUiState } from '../types.js';
import { playLose, playWin } from '../sound.js';

interface Props {
  state: EndUiState;
  myIdx: 0 | 1;
  onRematch: () => void;
  onMenu: () => void;
}

const decidedByLabel: Record<EndUiState['decidedBy'], string> = {
  score: 'normal skorla',
  penalty: 'penaltılarla',
  forfeit: 'rakip bağlantıyı kaybetti',
};

export function MatchEnd({ state, myIdx, onRematch, onMenu }: Props) {
  const other = myIdx === 0 ? 1 : 0;
  const youWon = state.winner === myIdx;

  useEffect(() => {
    if (youWon) playWin();
    else playLose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen match-end-screen">
      <motion.h1 initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}>
        {youWon ? 'Kazandın!' : 'Kaybettin'}
      </motion.h1>
      <p>
        Skor: {state.finalScores[myIdx]} - {state.finalScores[other]} ({decidedByLabel[state.decidedBy]})
      </p>
      <ol className="round-history">
        {state.history.map((r) => (
          <li key={r.round}>
            Tur {r.round} ({r.taskId}): {r.cards[myIdx].name} {r.scores[myIdx].toFixed(1)} —{' '}
            {r.cards[other].name} {r.scores[other].toFixed(1)} →{' '}
            {r.winner === null ? 'berabere' : r.winner === myIdx ? 'sen kazandın' : 'rakip kazandı'}
          </li>
        ))}
      </ol>
      {state.rematchRequestedByOpponent && !state.rematchRequestedByMe && (
        <p className="status">Rakip tekrar oynamak istiyor.</p>
      )}
      <div className="menu-buttons">
        <button onClick={onRematch} disabled={state.rematchRequestedByMe}>
          {state.rematchRequestedByMe ? 'Rakip bekleniyor…' : 'Tekrar Oyna'}
        </button>
        <button onClick={onMenu}>Ana Menü</button>
      </div>
    </div>
  );
}
```

### 3) Ses (`client/src/sound.ts` — mevcut, MatchEnd zaten çağırıyor)

```ts
export function playWin(): void   // yükselen zafer arpejı
export function playLose(): void  // alçalan üzgün ton
```

### 4) Kullanılabilir token'lar

`--bg --surface --surface-2 --text --text-dim --text-muted --text-faint --border
--accent --gold --sky --glow-accent --glow-gold --glow-sky --r-card --r-lg --r-md
--r-sm --shadow-card --shadow-card-hover --dur-fast/med/slow/slower --ease-out`

Mevcut ilgili class'lar: `.match-end-screen` (henüz stil yok — ekleyebilirsin),
`.round-history` (mevcut), `.menu-buttons` (mevcut), `.status` (mevcut).

---

## Döngü hatırlatma

Ajan çıktı verince (yeni MatchEnd.tsx, varsa index.css ekleri) **tam kodu bana
yapıştır** → projene işleyip typecheck + build + test koşarım, EndUiState/buton
davranışına dokunulmadığını ve reduced-motion'ı doğrularım.

Bu, brief'teki 4 tasarım fazının sonuncusu. Bittikten sonra planımıza göre
projeyi GitHub'a alırız.
