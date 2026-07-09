import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { EndUiState } from '../types.js';
import { taskName } from '../gameConfig.js';
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

const penaltyTieBreakLabel: Record<'goals' | 'stats' | 'coin', string | null> = {
  goals: null,
  stats: 'Penaltılar da berabere bitti — kazananı toplam kart gücü belirledi.',
  coin: 'Penaltılar ve kart güçleri de eşitti — kazananı yazı-tura belirledi.',
};

const CONFETTI_COLORS = ['var(--accent)', 'var(--gold)', 'var(--sky)', 'var(--text-dim)'];

/** Hafif konfeti: 24 motion parçacığı, tek sefer düşer (loop yok). */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 1.6 + Math.random() * 1.2,
        rotate: (Math.random() - 0.5) * 540,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 5,
      })),
    []
  );
  return (
    <div className="end-confetti" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.45, background: p.color }}
          initial={{ y: -24, opacity: 0, rotate: 0 }}
          animate={{ y: '46vh', opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ delay: p.delay, duration: p.duration, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export function MatchEnd({ state, myIdx, onRematch, onMenu }: Props) {
  const reduceMotion = useReducedMotion();
  const other = myIdx === 0 ? 1 : 0;
  const youWon = state.winner === myIdx;
  const ease = [0.16, 1, 0.3, 1] as const;

  useEffect(() => {
    if (youWon) playWin();
    else playLose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`screen match-end-screen ${youWon ? 'is-win' : 'is-loss'}`}>
      {youWon && !reduceMotion && <Confetti />}
      {youWon && (
        <motion.div
          className="end-trophy"
          aria-hidden
          initial={reduceMotion ? false : { y: -16, opacity: 0, scale: 0.7 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease }}
        >
          <div className="end-trophy-cup" />
          <div className="end-trophy-stem" />
          <div className="end-trophy-base" />
        </motion.div>
      )}
      <motion.h1
        initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease }}
      >
        {youWon ? 'KAZANDIN!' : 'Kaybettin'}
      </motion.h1>
      <motion.div
        className="end-scoreline"
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduceMotion ? { duration: 0 } : { delay: 0.25, type: 'spring', stiffness: 260, damping: 20 }
        }
      >
        <span className="end-score-num">{state.finalScores[myIdx]}</span>
        <span className="end-score-sep">–</span>
        <span className="end-score-num">{state.finalScores[other]}</span>
      </motion.div>
      {state.penalty && (
        <p className="end-penalty-score">
          Penaltılar: {state.penalty.goals[myIdx]} – {state.penalty.goals[other]}
        </p>
      )}
      <p className="end-decided">({decidedByLabel[state.decidedBy]})</p>
      {state.penalty && penaltyTieBreakLabel[state.penalty.decidedBy] && (
        <p className="end-decided">{penaltyTieBreakLabel[state.penalty.decidedBy]}</p>
      )}
      <ol className="round-history end-timeline">
        {state.history.map((r, i) => {
          const won = r.winner === myIdx;
          const lost = r.winner === other;
          const icon = won ? '✓' : lost ? '✕' : '=';
          const cls = won ? 'end-round-win' : lost ? 'end-round-loss' : 'end-round-draw';
          return (
            <motion.li
              key={r.round}
              className={cls}
              initial={reduceMotion ? false : { opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.5 + i * 0.09, duration: 0.3, ease }}
            >
              <span className="end-round-icon" aria-hidden>
                {icon}
              </span>
              <span>
                <strong>Tur {r.round}</strong> · {taskName(r.taskId)}: {r.cards[myIdx].name}{' '}
                {r.scores[myIdx].toFixed(1)} — {r.cards[other].name} {r.scores[other].toFixed(1)} →{' '}
                {won ? 'sen kazandın' : lost ? 'rakip kazandı' : 'berabere'}
              </span>
            </motion.li>
          );
        })}
      </ol>
      {state.rematchRequestedByOpponent && !state.rematchRequestedByMe && (
        <p className="status">Rakip tekrar oynamak istiyor.</p>
      )}
      <div className="menu-buttons">
        <button className="end-btn-primary" onClick={onRematch} disabled={state.rematchRequestedByMe}>
          {state.rematchRequestedByMe ? 'Rakip bekleniyor…' : 'Tekrar Oyna'}
        </button>
        <button className="end-btn-secondary" onClick={onMenu}>
          Ana Menü
        </button>
      </div>
    </div>
  );
}
