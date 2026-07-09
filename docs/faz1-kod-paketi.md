# Faz 1 — Kod Paketi (tasarım ajanına yapıştır)

Bu dosya, "Claude design" ajanının Faz 1 (kart tasarımı) için istediği kaynak
dosyaları içerir. Ajana önce brief'teki **ORTAK BAĞLAM + FAZ 1** promptunu, sonra
aşağıdaki dosyaları ver. Not: `index.css` artık **design token'larıyla** geliyor;
ajan renkleri `var(--...)` üzerinden kullanmalı, yeni sabit hex eklememeli.

Değiştirilecek dosyalar: `client/src/components/CardView.tsx` ve `client/src/index.css`.
Diğerleri sadece **bağlam** (bunları değiştirme): tipler, `overall`/`tierOf`, `gameConfig`, `config.json`.

---

## 1) Tipler — `shared/src/types.ts` (client'ta `@fkd/shared` olarak import edilir)

```ts
export type Tier = 'alt' | 'orta' | 'ust';
export type Position = 'field' | 'gk';

export interface Card {
  id: string;
  name: string;
  position: Position;
  /** Stat adı -> değer (0-99). Anahtarlar config.stats listesiyle eşleşir. */
  stats: Record<string, number>;
}

// GameConfig'in kartla ilgili kısmı (tierOf bunu kullanır):
export interface GameConfig {
  stats: { field: string[]; gk: string[] };
  tiers: Record<Tier, { min: number; max: number }>;
  // ... (draft/match/scoring/penalty/bot/timing alanları da var, kart için gerekmez)
}
```

## 2) `overall` / `tierOf` / `validateCard` — `shared/src/cards.ts`

```ts
import type { Card, GameConfig, Tier } from './types.js';

/** Overall = tüm statların yuvarlanmış ortalaması (saha: 6 stat, kaleci: 3 stat). */
export function overall(card: Card): number {
  const values = Object.values(card.stats);
  if (values.length === 0) throw new Error(`Kartın statı yok: ${card.id}`);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Overall'a göre kademe. */
export function tierOf(card: Card, config: GameConfig): Tier {
  const ov = overall(card);
  for (const [tier, range] of Object.entries(config.tiers) as [Tier, { min: number; max: number }][]) {
    if (ov >= range.min && ov <= range.max) return tier;
  }
  throw new Error(`Kart hiçbir kademeye oturmuyor: ${card.id} (overall ${ov})`);
}
```

CardView bunları şöyle kullanır: `import { overall, tierOf } from '@fkd/shared';`

## 3) Client config köprüsü — `client/src/gameConfig.ts`

```ts
import type { GameConfig } from '@fkd/shared';
import rawConfig from '../../shared/data/config.json';

export const gameConfig = rawConfig as unknown as GameConfig;
```

## 4) İlgili `config.json` bölümleri (`tiers` + `timing`)

```json
{
  "tiers": {
    "alt":  { "min": 75, "max": 82 },
    "orta": { "min": 83, "max": 88 },
    "ust":  { "min": 89, "max": 95 }
  },
  "timing": {
    "revealMs": 3000,
    "keeperIntroMs": 2500,
    "keeperRevealMs": 3500,
    "penaltyResultMs": 3000
  }
}
```

Statlar: saha = `["dripling","hiz","sut","teknik","pas","calim"]`,
kaleci = `["atlama","kurtaris","pozisyonAlma"]`. Stat değerleri 0-99.

---

## 5) DEĞİŞTİRİLECEK — `client/src/components/CardView.tsx` (mevcut hâli)

```tsx
import { motion } from 'framer-motion';
import type { Card } from '@fkd/shared';
import { overall, tierOf } from '@fkd/shared';
import { gameConfig } from '../gameConfig.js';

interface Props {
  card: Card;
  disabled?: boolean;
  selected?: boolean;
  used?: boolean;
  /** true iken kartın arkası gösterilir (ör. rakibin henüz açılmamış kartı). */
  faceDown?: boolean;
  /** Draft'ta seçenekler geldiğinde sırayla beliren giriş animasyonu için (0,1,2...). */
  index?: number;
  /** false ise fade/slide giriş animasyonu atlanır. */
  animateEntrance?: boolean;
  onClick?: () => void;
}

export function CardView({
  card,
  disabled,
  selected,
  used,
  faceDown = false,
  index = 0,
  animateEntrance = true,
  onClick,
}: Props) {
  const ov = overall(card);
  const tier = tierOf(card, gameConfig);
  const positionLabel = card.position === 'gk' ? 'KALECİ' : 'SAHA';
  const nameIsLong = card.name.length > 14;
  const classes = [
    'card',
    `tier-${tier}`,
    card.position,
    selected ? 'selected' : '',
    used ? 'used' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      className={classes}
      disabled={disabled || used}
      onClick={onClick}
      initial={animateEntrance ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
    >
      <div className="card-flip-outer">
        <motion.div
          className="card-flip-inner"
          animate={{ rotateY: faceDown ? 180 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="card-face">
            {used && <div className="card-used-badge">OYNANDI</div>}
            <div className="card-top">
              <div className="card-badge-col">
                <div className="card-overall-badge">{ov}</div>
                <div className="card-position-label">{positionLabel}</div>
              </div>
              <div className={`card-name ${nameIsLong ? 'card-name-long' : ''}`}>{card.name}</div>
            </div>
            <ul className="card-stats">
              {Object.entries(card.stats).map(([stat, value]) => (
                <li key={stat}>
                  <div className="card-stat-row">
                    <span>{stat}</span>
                    <span>{value}</span>
                  </div>
                  <div className="card-stat-bar-track">
                    <div className="card-stat-bar-fill" style={{ width: `${(value / 99) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-back-face" aria-hidden>
            FKD
          </div>
        </motion.div>
      </div>
    </motion.button>
  );
}
```

---

## 6) DEĞİŞTİRİLECEK — `client/src/index.css` (token'lı güncel hâli)

```css
:root {
  /* Yüzey & metin */
  --bg: #0f172a;
  --surface: #1e293b;
  --surface-2: #334155;
  --text: #f1f5f9;
  --text-dim: #cbd5e1;
  --text-muted: #94a3b8;
  --text-faint: #64748b;
  --border: #334155;

  /* Vurgu renkleri */
  --accent: #22c55e;
  --gold: #fbbf24;
  --sky: #38bdf8;

  /* Kademe (bronz / gümüş / altın) */
  --tier-alt-frame: #92400e;
  --tier-alt-fill: #d97706;
  --tier-alt-grad: #3f2a14;
  --tier-orta-frame: #94a3b8;
  --tier-orta-fill: #cbd5e1;
  --tier-orta-grad: #334155;
  --tier-ust-frame: #eab308;
  --tier-ust-fill: #eab308;
  --tier-ust-grad: #4a3b06;

  /* Uyarı */
  --danger-bg: #7f1d1d;
  --danger-text: #fecaca;

  /* Köşe yarıçapı */
  --r-card: 10px;
  --r-lg: 12px;
  --r-md: 8px;
  --r-sm: 6px;

  /* Gölge & glow */
  --glow-accent: 0 0 12px rgba(34, 197, 94, 0.5);
  --glow-gold: 0 0 22px rgba(251, 191, 36, 0.7);
  --glow-sky: 0 0 18px rgba(56, 189, 248, 0.6);
  --glow-ust: 0 0 10px rgba(234, 179, 8, 0.25);

  /* Hareket — framer-motion'daki JS süreleriyle uyumlu tutulmalı */
  --dur-fast: 0.15s;
  --dur-med: 0.25s;
  --dur-slow: 0.4s;
  --dur-slower: 0.6s;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

* { box-sizing: border-box; }

body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }

.app { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
.screen { display: flex; flex-direction: column; gap: 1rem; }

.menu-buttons { display: flex; flex-direction: column; gap: 0.5rem; max-width: 320px; }
.menu-buttons button { padding: 0.75rem 1rem; font-size: 1rem; cursor: pointer; }

.card-row { display: flex; gap: 1rem; flex-wrap: wrap; }

.card {
  width: 160px; height: 224px; padding: 0;
  border-radius: var(--r-card); border: 2px solid var(--border);
  background: var(--surface); color: inherit; text-align: left;
  cursor: pointer; overflow: hidden;
}
.card.tier-alt  { border-color: var(--tier-alt-frame);  background: linear-gradient(160deg, var(--tier-alt-grad) 0%, var(--surface) 65%); }
.card.tier-orta { border-color: var(--tier-orta-frame); background: linear-gradient(160deg, var(--tier-orta-grad) 0%, var(--surface) 65%); }
.card.tier-ust  { border-color: var(--tier-ust-frame);  background: linear-gradient(160deg, var(--tier-ust-grad) 0%, var(--surface) 65%); box-shadow: var(--glow-ust); }
.card.selected  { border-color: var(--accent); box-shadow: var(--glow-accent); }
.card.used, .card:disabled { opacity: 0.45; cursor: not-allowed; }

.card-flip-outer { width: 100%; height: 100%; perspective: 1000px; }
.card-flip-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
.card-face, .card-back-face { position: absolute; inset: 0; backface-visibility: hidden; padding: 0.6rem; }
.card-back-face {
  transform: rotateY(180deg); display: flex; align-items: center; justify-content: center;
  font-weight: 700; letter-spacing: 0.1em; color: #475569;
  background: repeating-linear-gradient(45deg, var(--surface), var(--surface) 10px, #24324a 10px, #24324a 20px);
}

.card-used-badge {
  position: absolute; top: 4px; right: 4px;
  background: var(--danger-bg); color: var(--danger-text);
  font-size: 0.55rem; font-weight: 700; letter-spacing: 0.03em;
  padding: 2px 4px; border-radius: 3px;
}

.card-top { display: flex; align-items: flex-start; gap: 0.4rem; margin-bottom: 0.4rem; }
.card-badge-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.card-overall-badge {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.85rem; background: rgba(0, 0, 0, 0.35);
}
.card-position-label { font-size: 0.5rem; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 2px; }
.card-name { flex: 1; font-weight: 700; font-size: 0.95rem; line-height: 1.15; padding-top: 3px; }
.card-name-long { font-size: 0.75rem; }

.card-stats { list-style: none; margin: 0; padding: 0; font-size: 0.68rem; display: flex; flex-direction: column; gap: 0.3rem; }
.card-stat-row { display: flex; justify-content: space-between; }
.card-stat-bar-track { height: 5px; margin-top: 1px; background: rgba(255, 255, 255, 0.15); border-radius: 3px; overflow: hidden; }
.card-stat-bar-fill { height: 100%; }
.tier-alt  .card-stat-bar-fill { background: var(--tier-alt-fill); }
.tier-orta .card-stat-bar-fill { background: var(--tier-orta-fill); }
.tier-ust  .card-stat-bar-fill { background: var(--tier-ust-fill); }
.card.gk .card-stats { font-size: 0.8rem; gap: 0.55rem; }
.card.gk .card-stat-bar-track { height: 8px; }

.scoreboard { display: flex; justify-content: space-between; font-weight: 600; }
.status { font-style: italic; color: var(--text-muted); }
.reveal { background: var(--surface); border-radius: var(--r-md); padding: 1rem; }
.round-history { font-size: 0.9rem; color: var(--text-dim); }

.error-banner { background: var(--danger-bg); color: var(--danger-text); padding: 0.5rem 1rem; border-radius: var(--r-sm); margin-bottom: 1rem; }

.room-link { display: flex; align-items: center; gap: 0.5rem; background: var(--surface); padding: 0.5rem 0.75rem; border-radius: var(--r-sm); }
.room-link code { overflow-wrap: anywhere; }
.room-link button { white-space: nowrap; padding: 0.4rem 0.75rem; cursor: pointer; }

.duel-area { display: flex; align-items: center; gap: 1.5rem; }
.duel-slot { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.duel-winner .card { border-color: var(--accent); box-shadow: 0 0 16px rgba(34, 197, 94, 0.5); }
.duel-vs { font-weight: 700; color: var(--text-faint); }
.duel-score { font-weight: 700; font-size: 1.1rem; }

.keeper-banner { background: linear-gradient(90deg, #78350f, #b45309); color: #fef3c7; font-weight: 700; text-align: center; padding: 0.6rem 1rem; border-radius: var(--r-sm); }
.keeper-round-screen { align-items: center; }
.keeper-overlay {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 1rem;
  padding: 2.5rem 1.5rem; border-radius: var(--r-lg);
  background: radial-gradient(ellipse at center, rgba(30, 41, 59, 0.9) 0%, rgba(2, 6, 23, 0.95) 75%);
}
.keeper-title { margin: 0; font-size: 2rem; letter-spacing: 0.15em; color: var(--gold); text-shadow: 0 0 20px rgba(251, 191, 36, 0.5); }
.keeper-task-name { margin: 0; color: var(--text-dim); font-size: 1.1rem; }
.keeper-clash { display: flex; align-items: center; gap: 2.5rem; padding: 1.5rem 0; }
.keeper-card-large {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  transform: scale(1.3); transition: opacity var(--dur-slow); border-radius: var(--r-card);
}
.keeper-card-large.keeper-faded { opacity: 0.5; }
.keeper-card-large.keeper-gold-glow .card { border-color: var(--gold); box-shadow: var(--glow-gold); }
.keeper-card-large.keeper-blue-glow .card { border-color: var(--sky); box-shadow: var(--glow-sky); }
.keeper-flash { font-size: 2rem; }
.keeper-score-bar-track { position: relative; width: 140px; height: 14px; background: var(--surface); border-radius: 7px; overflow: hidden; }
.keeper-score-bar-fill { height: 100%; background: linear-gradient(90deg, var(--sky), var(--gold)); }
.keeper-score-bar-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #f8fafc; text-shadow: 0 0 3px #000; }
.keeper-result-text { font-size: 1.2rem; font-weight: 700; margin: 0; }

.shot-scene-row { display: flex; gap: 2rem; flex-wrap: wrap; }
.shot-scene { position: relative; width: 180px; height: 160px; background: #14532d; border-radius: var(--r-md); overflow: hidden; }
.goal-frame { position: absolute; top: 8%; left: 15%; width: 70%; height: 20%; border: 4px solid #e2e8f0; border-bottom: none; }
.ball { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #f8fafc; transform: translateX(-50%); }
.shot-label { position: absolute; bottom: 0.4rem; left: 0; right: 0; text-align: center; font-size: 0.85rem; background: rgba(15, 23, 42, 0.6); margin: 0; padding: 0.2rem 0; }

@media (max-width: 640px) {
  .app { padding: 1rem 0.75rem; }
  .menu-buttons button, .room-link button, .card { min-height: 44px; }
  .card-row, .shot-scene-row {
    flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x mandatory;
    padding-bottom: 0.5rem; margin: 0 -0.75rem; padding-left: 0.75rem; padding-right: 0.75rem;
  }
  .card-row > *, .shot-scene-row > * { scroll-snap-align: start; flex: 0 0 auto; }
  .card { width: 128px; height: 180px; }
  .card-overall-badge { width: 22px; height: 22px; font-size: 0.7rem; }
  .card-name { font-size: 0.8rem; }
  .card-name-long { font-size: 0.62rem; }
  .card-stats { font-size: 0.58rem; }
  .scoreboard { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
  .duel-area, .keeper-clash { flex-wrap: wrap; justify-content: center; }
  .keeper-card-large { transform: scale(1.1); }
  .keeper-title { font-size: 1.5rem; }
  .room-link { flex-direction: column; align-items: stretch; }
  .round-history { padding-left: 1.1rem; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```
```
```
