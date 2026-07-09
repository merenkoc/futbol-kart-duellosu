import { useEffect, useState } from 'react';
import { motion, animate, useReducedMotion } from 'framer-motion';
import type { Card } from '@fkd/shared';
import { CardView } from './CardView.js';

interface Props {
  myCard: Card | null;
  opponentCard: Card | null;
  myScore: number | null;
  opponentScore: number | null;
  outcome: 'me' | 'other' | 'draw' | null;
  /** Bu turda kazanılan puanlar (reveal.points). null = henüz reveal yok. */
  myPoints?: number | null;
  opponentPoints?: number | null;
}

/** 0'dan değere sayan skor sayacı (1 ondalık). Reduced motion'da anında gösterir. */
function ScoreCounter({ value, delay }: { value: number; delay: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value.toFixed(1) : '0.0');
  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value.toFixed(1));
      return;
    }
    const controls = animate(0, value, {
      delay,
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v.toFixed(1)),
    });
    return () => controls.stop();
  }, [value, delay, reduceMotion]);
  return <div className="duel-score">{display}</div>;
}

/** Kazanılan puanın skor tablosuna doğru uçan chip'i. */
function PointsChip({ points, reduceMotion }: { points: number; reduceMotion: boolean }) {
  if (reduceMotion) {
    return <div className="duel-points-chip">+{points}</div>;
  }
  return (
    <motion.div
      className="duel-points-chip"
      initial={{ opacity: 0, y: 6, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: -72, scale: 1 }}
      transition={{ delay: 1.45, duration: 0.8, times: [0, 0.2, 0.8, 1], ease: 'easeOut' }}
    >
      +{points}
    </motion.div>
  );
}

/**
 * Bir turun karşılaştırma alanı: benim oynadığım kart hep açık, rakibinki
 * kilitliyken kart arkası, reveal gelince flip ile açılır (CardView `faceDown`).
 * Reveal sekansı bütçesi: flip 0.5s → sayaç 0.35–1.25s → kazanan vurgusu 1.2s →
 * puan chip'i 1.45–2.25s. Toplam < 3s (revealMs).
 */
export function DuelArea({
  myCard,
  opponentCard,
  myScore,
  opponentScore,
  outcome,
  myPoints = null,
  opponentPoints = null,
}: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  if (!myCard) return null;

  const slotClass = (side: 'me' | 'other') =>
    [
      'duel-slot',
      outcome === side ? 'duel-winner' : '',
      outcome !== null && outcome !== 'draw' && outcome !== side ? 'duel-loser' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const slotAnim = (side: 'me' | 'other') =>
    outcome === side && !reduceMotion
      ? { x: 0, opacity: 1, scale: [1, 1.07, 1] }
      : { x: 0, opacity: 1, scale: 1 };

  const slotTransition = {
    duration: 0.35,
    ease: [0.16, 1, 0.3, 1] as const,
    scale: { delay: 1.2, duration: 0.35 },
  };

  return (
    <div className="duel-area">
      <motion.div
        className={slotClass('me')}
        initial={reduceMotion ? false : { x: -40, opacity: 0 }}
        animate={slotAnim('me')}
        transition={slotTransition}
      >
        <CardView card={myCard} disabled animateEntrance={false} />
        {myScore !== null && <ScoreCounter value={myScore} delay={0.35} />}
        {outcome !== null && myPoints !== null && myPoints > 0 && (
          <PointsChip points={myPoints} reduceMotion={reduceMotion} />
        )}
      </motion.div>
      <div className="duel-vs">vs</div>
      <motion.div
        className={slotClass('other')}
        initial={reduceMotion ? false : { x: 40, opacity: 0 }}
        animate={slotAnim('other')}
        transition={slotTransition}
      >
        <CardView card={opponentCard ?? myCard} faceDown={!opponentCard} disabled animateEntrance={false} />
        {opponentScore !== null && <ScoreCounter value={opponentScore} delay={0.35} />}
        {outcome !== null && opponentPoints !== null && opponentPoints > 0 && (
          <PointsChip points={opponentPoints} reduceMotion={reduceMotion} />
        )}
      </motion.div>
    </div>
  );
}
