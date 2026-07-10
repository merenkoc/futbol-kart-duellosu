import { useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PoolInfo } from '@fkd/shared';
import type { PendingMode } from '../types.js';
import { pools } from '../pools.js';
import { playClick } from '../sound.js';

interface Props {
  mode: PendingMode;
  onConfirm: (poolId: string) => void;
  onBack: () => void;
}

const modeLabels: Record<Exclude<PendingMode, null>, string> = {
  bot: 'Bota Karşı',
  friend: 'Arkadaşla Oyna',
  queue: 'Rastgele Eşleş',
};

/**
 * Takım seçme ekranı: yuvarlak rozetler iki yatay şeritte (Milli Takımlar /
 * Ligler), parmakla/tekerle kaydırılır (scroll-snap). Seçilen havuz maçın
 * ortak kart havuzu olur — iki oyuncu da ondan draft eder.
 */
export function TeamSelect({ mode, onConfirm, onBack }: Props) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const nationals = pools.filter((p) => p.type === 'national');
  const leagues = pools.filter((p) => p.type === 'league');

  const strip = (title: string, list: PoolInfo[], offset: number) => (
    <section className="pool-section">
      <h3>{title}</h3>
      <div className="pool-strip">
        {list.map((p, i) => (
          <motion.button
            key={p.id}
            type="button"
            className={`pool-badge ${selected === p.id ? 'selected' : ''}`}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : (offset + i) * 0.04, duration: 0.25 }}
            style={{ '--pool-c1': p.colors[0], '--pool-c2': p.colors[1] } as CSSProperties}
            onClick={() => {
              playClick();
              setSelected(p.id);
            }}
          >
            <span className={`pool-badge-face ${p.emoji ? '' : 'pool-badge-mono'}`}>{p.emoji ?? p.short}</span>
            <span className="pool-badge-label">{p.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="screen team-select-screen">
      <h2>Takımını Seç</h2>
      <p className="status">
        {mode ? modeLabels[mode] : ''} — iki oyuncu da bu havuzun yıldızlarından kadro kurar
      </p>
      {strip('Milli Takımlar', nationals, 0)}
      {strip('Ligler', leagues, nationals.length)}
      <div className="menu-buttons team-select-actions">
        <button
          className="menu-btn menu-btn-primary"
          disabled={!selected}
          onClick={() => {
            playClick();
            onConfirm(selected!);
          }}
        >
          {selected ? 'Bu Takımla Başla' : 'Bir takım seç'}
        </button>
        <button className="menu-btn menu-btn-secondary" onClick={onBack}>
          Geri
        </button>
      </div>
    </div>
  );
}
