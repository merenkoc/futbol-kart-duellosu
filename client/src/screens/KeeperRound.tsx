import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '@fkd/shared';
import type { KeeperRoundUiState } from '../types.js';
import { CardView } from '../components/CardView.js';
import { playWhistle } from '../sound.js';

type Outcome = 'win' | 'lose' | 'draw' | null;

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 99) * 100));
  return (
    <div className="keeper-score-bar-track">
      <motion.div
        className="keeper-score-bar-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <span className="keeper-score-bar-label">{score.toFixed(1)}</span>
    </div>
  );
}

function outcomeClass(outcome: Outcome): string {
  if (outcome === 'win') return 'keeper-gold-glow';
  if (outcome === 'lose') return 'keeper-faded';
  if (outcome === 'draw') return 'keeper-blue-glow';
  return '';
}

const NET_V = [40, 64, 88, 112, 136, 160, 180];
const NET_H = [36, 52, 68, 84, 100, 116];

/** Tek kale + kaleci sahnesi (SVG). Kaleci figürü/animasyonu her kaleci için aynı. */
function KeeperGoal({
  card,
  score,
  outcome,
  revealed,
  side,
}: {
  card: Card;
  score: number | null;
  outcome: Outcome;
  revealed: boolean;
  side: 'me' | 'other';
}) {
  const jersey = side === 'me' ? '#38bdf8' : '#f59e0b';
  const fromX = side === 'me' ? -70 : 70;
  return (
    <motion.div
      className={`keeper-goal ${outcomeClass(outcome)}`}
      initial={{ x: fromX, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="keeper-goal-side">{side === 'me' ? 'SEN' : 'RAKİP'}</span>
      <CardView card={card} disabled animateEntrance={false} />
      <div className="keeper-goal-scene">
        <svg viewBox="0 0 220 150" className="keeper-goal-svg" aria-hidden>
          {/* file (net) */}
          {NET_V.map((x) => (
            <line key={`v${x}`} x1={x} y1={22} x2={x} y2={120} stroke="rgba(255,255,255,0.13)" strokeWidth="0.7" />
          ))}
          {NET_H.map((y) => (
            <line key={`h${y}`} x1={28} y1={y} x2={192} y2={y} stroke="rgba(255,255,255,0.13)" strokeWidth="0.7" />
          ))}
          {/* kale çerçevesi */}
          <rect x="24" y="18" width="172" height="5" rx="2" fill="rgba(255,255,255,0.9)" />
          <rect x="24" y="18" width="5" height="104" fill="rgba(255,255,255,0.9)" />
          <rect x="191" y="18" width="5" height="104" fill="rgba(255,255,255,0.9)" />
          <rect x="20" y="120" width="180" height="3" fill="rgba(255,255,255,0.25)" />

          {/* penaltı noktasından gelen top */}
          <motion.circle
            r="7"
            fill="#f8fafc"
            stroke="#0f172a"
            strokeWidth="1"
            initial={{ cx: 110, cy: 150, opacity: 0 }}
            animate={revealed ? { cx: 110, cy: 46, opacity: [0, 1, 1] } : { cx: 110, cy: 150, opacity: 0 }}
            transition={{ delay: 0.35, duration: 0.55, ease: 'easeOut' }}
          />

          {/* kaleci — reveal'de topa uzanır (aynı animasyon) */}
          <motion.g
            initial={{ y: 0 }}
            animate={revealed ? { y: -10 } : { y: 0 }}
            transition={{ delay: 0.5, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* bacaklar */}
            <path d="M105 88 L100 120" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
            <path d="M115 88 L120 120" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
            {/* gövde (forma) */}
            <rect x="100" y="56" width="20" height="34" rx="7" fill={jersey} />
            {/* kollar yukarı */}
            <path d="M104 60 L86 38" stroke={jersey} strokeWidth="6" strokeLinecap="round" />
            <path d="M116 60 L134 38" stroke={jersey} strokeWidth="6" strokeLinecap="round" />
            {/* eldivenler */}
            <circle cx="85" cy="36" r="6" fill="#f8fafc" stroke={jersey} strokeWidth="1.5" />
            <circle cx="135" cy="36" r="6" fill="#f8fafc" stroke={jersey} strokeWidth="1.5" />
            {/* baş */}
            <circle cx="110" cy="47" r="9" fill="#e9b98f" />
          </motion.g>

          {/* kurtarış parıltısı */}
          {revealed && (
            <motion.circle
              cx="110"
              cy="42"
              r="14"
              fill="none"
              stroke={jersey}
              strokeWidth="2"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.4], opacity: [0, 0.7, 0] }}
              transition={{ delay: 0.85, duration: 0.5 }}
              style={{ transformOrigin: '110px 42px' }}
            />
          )}
        </svg>
      </div>
      {score !== null && <ScoreBar score={score} />}
    </motion.div>
  );
}

export function KeeperRound({ state, myIdx }: { state: KeeperRoundUiState; myIdx: 0 | 1 }) {
  const other = myIdx === 0 ? 1 : 0;
  const reveal = state.reveal;
  const revealed = reveal !== null;
  const myOutcome: Outcome = !reveal ? null : reveal.winner === null ? 'draw' : reveal.winner === myIdx ? 'win' : 'lose';
  const otherOutcome: Outcome = !reveal ? null : reveal.winner === null ? 'draw' : reveal.winner === other ? 'win' : 'lose';

  useEffect(() => {
    playWhistle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.round]);

  return (
    <div className="screen keeper-round-screen">
      <div className="keeper-overlay">
        <motion.h1
          className="keeper-title"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          KİLİT ROUND
        </motion.h1>
        <motion.p
          className="keeper-task-name"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {state.task.name}
        </motion.p>

        <div className="keeper-goals">
          <KeeperGoal
            card={state.keepers[myIdx]}
            score={reveal ? reveal.scores[myIdx] : null}
            outcome={myOutcome}
            revealed={revealed}
            side="me"
          />
          <KeeperGoal
            card={state.keepers[other]}
            score={reveal ? reveal.scores[other] : null}
            outcome={otherOutcome}
            revealed={revealed}
            side="other"
          />
        </div>

        {reveal && (
          <motion.p
            className="keeper-result-text"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {reveal.winner === myIdx && 'Kalecin bu turu kazandı!'}
            {reveal.winner === other && 'Rakip kaleci bu turu kazandı.'}
            {reveal.winner === null && 'Berabere!'}
          </motion.p>
        )}
      </div>
    </div>
  );
}
