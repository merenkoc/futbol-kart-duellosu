# Faz 3 — Kod Paketi (tasarım ajanına yapıştır)

Konu: **ekran geçişleri + draft açılışı**. Design ajanına önce brief'teki
**ORTAK BAĞLAM** bloğunu, sonra bu dosyayı ver.

**Değiştirilecek dosyalar:** `client/src/App.tsx` (AnimatePresence bloğu) ve
`client/src/screens/Draft.tsx`. Gerekirse `client/src/index.css`'e geçiş/draft
stilleri **ekleyebilir** (token kullan, yeni sabit hex ekleme).
**Dokunma:** `shared/`, `server/`, socket event isimleri, `reducer.ts`, `types.ts`
(ClientState/action şekli), diğer ekran komponentleri (MatchScreen, KeeperRound,
Penalty, MatchEnd — bunların KENDİ sahne animasyonları var).

---

## FAZ 3 PROMPTU

```
GÖREV: Ekranlar arası geçişleri ve draft seçenek açılışını "yayın" hissiyle
canlandır. Dosyalar: client/src/App.tsx (AnimatePresence bloğu),
client/src/screens/Draft.tsx, (gerekirse) index.css'e ekleme.

İSTENEN:
1. Ekran geçişleri (menu→lobby→draft→match→keeperRound→penalty→end): şu anki
   basit fade+slide yerine daha karakterli ama KISA bir broadcast "wipe/cut"
   geçişi. AnimatePresence mode="wait" ve key={state.screen} korunacak.
2. Draft: seçenek kartları bir desteden "dağıtılıyor" gibi sırayla girsin
   (deal-in, stagger). Kart seçilince kilit "damgası"/parıltısı; rakip seçince
   mevcut "rakip bekleniyor / rakip de seçti" bilgisini koru ama daha görünür yap.

KRİTİK KISITLAR:
- Geçişler KISA olsun (~0.25–0.4s); kullanıcı girişini geciktirmesin. Draft'ta
  kart tıklanabilirliği (onPick) hemen çalışmalı.
- match/keeperRound/penalty/end ekranlarının KENDİ giriş animasyonları var; ekran
  seviyesindeki geçiş onlarla yarışmayacak kadar hafif olmalı (kısa fade/scale/wipe).
- prefers-reduced-motion (useReducedMotion): geçişleri ve deal-in'i anında/sade göster.
- index.css'e eklerken :root token'larını kullan (--accent, --gold, --surface*,
  --glow-*, --dur-*, --ease-out, --r-*). Mevcut class isimlerini koru.
- CardView'in props API'sini ve Draft'ın onPick/disabled/locked mantığını değiştirme.
- ClientState/reducer'a dokunma; veriyi mevcut prop'lardan al.

KABUL: geçişler akıcı ve hızlı; draft açılışı "dağıtılıyor" hissi verir; giriş
gecikmiyor; reduced-motion sade; `npm test` (91+3) ve iki typecheck yeşil.
```

---

## BAĞLAM DOSYALARI

### 1) Ekran durum makinesi (`client/src/types.ts`)

```ts
export type Screen = 'menu' | 'lobby' | 'draft' | 'match' | 'keeperRound' | 'penalty' | 'end';

export interface DraftUiState {
  round: number;
  totalRounds: number;
  isGkRound: boolean;
  options: Card[];       // @fkd/shared Card
  myPickId: string | null;
  opponentPicked: boolean;
}
```

`state.screen` bu 7 değerden biri; App.tsx AnimatePresence bunu key olarak kullanıyor.

### 2) DEĞİŞTİRİLECEK — `client/src/App.tsx` (mevcut)

```tsx
import { useEffect, useReducer, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { socket } from './socket.js';
import { reducer } from './reducer.js';
import { initialClientState } from './types.js';
import { MainMenu } from './screens/MainMenu.js';
import { Lobby } from './screens/Lobby.js';
import { Draft } from './screens/Draft.js';
import { MatchScreen } from './screens/MatchScreen.js';
import { KeeperRound } from './screens/KeeperRound.js';
import { Penalty } from './screens/Penalty.js';
import { MatchEnd } from './screens/MatchEnd.js';

const STORAGE_KEY = 'fkd:match';

interface StoredMatch {
  matchId: string;
  playerToken: string;
  playerIdx: 0 | 1;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialClientState);
  const reconnecting = useRef(false);
  const mountEffectRan = useRef(false);

  useEffect(() => {
    socket.on('room:created', ({ roomId }) => dispatch({ type: 'ROOM_CREATED', roomId }));
    socket.on('queue:waiting', () => dispatch({ type: 'QUEUE_WAITING' }));
    socket.on('match:start', ({ matchId, playerToken, playerIdx }) => {
      // Bot maçı dahil tüm maçları sakla ki sayfa yenilemede reconnect edilebilsin.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ matchId, playerToken, playerIdx } satisfies StoredMatch));
      reconnecting.current = false;
      dispatch({ type: 'MATCH_START', matchId, playerIdx });
    });
    socket.on('draft:options', (payload) => dispatch({ type: 'DRAFT_OPTIONS', ...payload }));
    socket.on('draft:opponentPicked', ({ round }) => dispatch({ type: 'DRAFT_OPPONENT_PICKED', round }));
    socket.on('draft:complete', ({ hand }) => dispatch({ type: 'DRAFT_COMPLETE', hand }));
    socket.on('round:task', (payload) => dispatch({ type: 'ROUND_TASK', ...payload }));
    socket.on('round:waitingOpponent', () => dispatch({ type: 'ROUND_WAITING_OPPONENT' }));
    socket.on('round:reveal', (result) => dispatch({ type: 'ROUND_REVEAL', result }));
    socket.on('match:score', ({ scores }) => dispatch({ type: 'MATCH_SCORE', scores }));
    socket.on('keeperRound:start', (payload) => dispatch({ type: 'KEEPER_ROUND_START', ...payload }));
    socket.on('penalty:start', ({ availableShooterIds }) => dispatch({ type: 'PENALTY_START', availableShooterIds }));
    socket.on('penalty:opponentPicked', () => dispatch({ type: 'PENALTY_OPPONENT_PICKED' }));
    socket.on('penalty:result', (result) => dispatch({ type: 'PENALTY_RESULT', result }));
    socket.on('match:rematchRequested', () => dispatch({ type: 'MATCH_REMATCH_REQUESTED' }));
    socket.on('opponent:disconnected', ({ graceMs }) => dispatch({ type: 'OPPONENT_DISCONNECTED', graceMs }));
    socket.on('opponent:reconnected', () => dispatch({ type: 'OPPONENT_RECONNECTED' }));
    socket.on('match:end', (payload) => {
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: 'MATCH_END', ...payload });
    });
    socket.on('error', ({ message }) => {
      if (reconnecting.current) {
        localStorage.removeItem(STORAGE_KEY);
        reconnecting.current = false;
      }
      dispatch({ type: 'ERROR', message });
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (mountEffectRan.current) return;
    mountEffectRan.current = true;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { matchId, playerToken, playerIdx } = JSON.parse(saved) as StoredMatch;
        reconnecting.current = true;
        dispatch({ type: 'RESTORE_SESSION', matchId, playerIdx });
        socket.emit('match:reconnect', { matchId, playerToken });
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (roomId) {
      dispatch({ type: 'LOBBY_JOINING' });
      socket.emit('room:join', { roomId });
    }
  }, []);

  return (
    <div className="app">
      {state.error && <div className="error-banner">{state.error}</div>}
      {state.opponentDisconnected && (
        <div className="error-banner">
          Rakip bağlantısı koptu — {Math.round(state.opponentDisconnected.graceMs / 1000)} sn içinde dönmezse maçı
          kazanacaksın.
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.screen}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {state.screen === 'menu' && (
            <MainMenu
              onStartBot={() => {
                socket.emit('bot:start');
              }}
              onCreateRoom={() => {
                dispatch({ type: 'LOBBY_CREATING' });
                socket.emit('room:create');
              }}
              onJoinQueue={() => {
                dispatch({ type: 'LOBBY_QUEUE' });
                socket.emit('queue:join');
              }}
            />
          )}
          {state.screen === 'lobby' && state.lobby && <Lobby state={state.lobby} />}
          {state.screen === 'draft' && state.draft && (
            <Draft
              state={state.draft}
              onPick={(cardId) => {
                dispatch({ type: 'DRAFT_PICK_LOCAL', cardId });
                socket.emit('draft:pick', { cardId });
              }}
            />
          )}
          {state.screen === 'match' && state.match && (
            <MatchScreen
              state={state.match}
              myIdx={state.myIdx}
              banner={state.keeperBanner}
              onBannerDone={() => dispatch({ type: 'CLEAR_KEEPER_BANNER' })}
              onPlay={(cardId) => {
                dispatch({ type: 'ROUND_PLAY_LOCAL', cardId });
                socket.emit('round:playCard', { cardId });
              }}
            />
          )}
          {state.screen === 'keeperRound' && state.keeperRound && (
            <KeeperRound state={state.keeperRound} myIdx={state.myIdx} />
          )}
          {state.screen === 'penalty' && state.penalty && state.match && (
            <Penalty
              state={state.penalty}
              hand={state.match.hand}
              myIdx={state.myIdx}
              onPick={(cardId) => {
                dispatch({ type: 'PENALTY_PICK_LOCAL', cardId });
                socket.emit('penalty:pickShooter', { cardId });
              }}
            />
          )}
          {state.screen === 'end' && state.end && (
            <MatchEnd
              state={state.end}
              myIdx={state.myIdx}
              onRematch={() => {
                dispatch({ type: 'REMATCH_LOCAL' });
                socket.emit('match:rematch');
              }}
              onMenu={() => dispatch({ type: 'RESET' })}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

### 3) DEĞİŞTİRİLECEK — `client/src/screens/Draft.tsx` (mevcut)

```tsx
import type { DraftUiState } from '../types.js';
import { CardView } from '../components/CardView.js';
import { playClick } from '../sound.js';

interface Props {
  state: DraftUiState;
  onPick: (cardId: string) => void;
}

export function Draft({ state, onPick }: Props) {
  const locked = state.myPickId !== null;
  return (
    <div className="screen draft-screen">
      <h2>
        Draft — Tur {state.round}/{state.totalRounds}
        {state.isGkRound && ' (Kaleci Turu)'}
      </h2>
      {state.isGkRound && (
        <p className="status">
          Bu kart Kilit Round'da otomatik oynar ve penaltıda kurtarış gücünü belirler.
        </p>
      )}
      <div className="card-row">
        {state.options.map((card, i) => (
          <CardView
            key={card.id}
            card={card}
            index={i}
            selected={state.myPickId === card.id}
            disabled={locked}
            onClick={() => {
              playClick();
              onPick(card.id);
            }}
          />
        ))}
      </div>
      {locked && !state.opponentPicked && <p className="status">Seçimin kilitlendi, rakip bekleniyor…</p>}
      {locked && state.opponentPicked && <p className="status">Rakip de seçti, sonraki tur hazırlanıyor…</p>}
    </div>
  );
}
```

Not: `CardView` zaten `index` prop'uyla stagger'lı bir giriş animasyonu yapıyor
(`delay: index * 0.06`). Deal-in'i bunun üstüne kurabilir ya da Draft'ta
kendi motion sarmalayıcınla zenginleştirebilirsin.

### 4) CardView props hatırlatma (değiştirme)

```
card, disabled?, selected?, used?, faceDown?, index?, animateEntrance?, onClick?
```

Kullanılabilir token'lar: `--bg --surface --surface-2 --text --text-dim
--text-muted --text-faint --border --accent --gold --sky --glow-* --r-*
--shadow-card* --dur-fast/med/slow/slower --ease-out`.

---

## Döngü hatırlatma

Ajan çıktı verince (yeni App.tsx + Draft.tsx, varsa index.css ekleri) **tam kodu
bana yapıştır** → projene işleyip typecheck + build + test koşarım, geçişlerin
girişi geciktirmediğini ve kısıtlara uyduğunu doğrularım.
