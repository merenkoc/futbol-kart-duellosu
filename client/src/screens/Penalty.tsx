import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Hand } from '@fkd/shared';
import type { PenaltyUiState } from '../types.js';
import { CardView } from '../components/CardView.js';
import { playClick, playGoal, playSave } from '../sound.js';

interface Props {
  state: PenaltyUiState;
  hand: Hand;
  myIdx: 0 | 1;
  onPick: (cardId: string) => void;
}

function ShotScene({ label, shooterName, isGoal }: { label: string; shooterName: string; isGoal: boolean }) {
  return (
    <div className="shot-scene">
      <div className="goal-frame" />
      <motion.div
        className="ball"
        initial={{ bottom: '4%', left: '50%', opacity: 1 }}
        animate={
          isGoal
            ? { bottom: '62%', left: ['50%', '70%'], opacity: [1, 1, 0] }
            : { bottom: '48%', left: ['50%', '58%'] }
        }
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <p className="shot-label">
        {label}: {shooterName} — {isGoal ? 'GOL!' : 'KURTARDI'}
      </p>
    </div>
  );
}

export function Penalty({ state, hand, myIdx, onPick }: Props) {
  const other = myIdx === 0 ? 1 : 0;
  const locked = state.myPickId !== null;
  // 5. seride (kaleci düellosu) aday kaleci olduğundan tüm el taranır.
  const candidates = [...hand.fieldCards, hand.goalkeeper].filter((c) => state.availableShooterIds.includes(c.id));
  const keeperDuel = candidates.length > 0 && candidates.every((c) => c.position === 'gk');
  const result = state.lastResult;

  useEffect(() => {
    if (!result) return;
    if (result.goals[myIdx] || result.goals[other]) playGoal();
    else playSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const seriLabel = keeperDuel
    ? 'Kaleci Düellosu'
    : state.currentExchangeIndex === 0
      ? 'İlk Seri'
      : `Ani Ölüm — Seri ${state.currentExchangeIndex + 1}`;

  const tieBreakNote =
    result?.finished && result.decidedBy === 'stats'
      ? 'Penaltılar da berabere bitti — kazananı toplam kart gücü belirledi.'
      : result?.finished && result.decidedBy === 'coin'
        ? 'Penaltılar ve kart güçleri de eşitti — kazananı yazı-tura belirledi.'
        : null;

  return (
    <div className="screen penalty-screen">
      <h2>Penaltı Turu — {seriLabel}</h2>
      <p>
        Skor — Sen: {state.totalGoals[myIdx]} / Rakip: {state.totalGoals[other]}
      </p>
      {keeperDuel && !result && (
        <p className="status">Saha atıcıların tükendi — kaleciler penaltı noktasında!</p>
      )}
      {!result && (
        <div className="card-row">
          {candidates.map((card) => (
            <CardView
              key={card.id}
              card={card}
              selected={state.myPickId === card.id}
              disabled={locked}
              onClick={() => {
                playClick();
                onPick(card.id);
              }}
            />
          ))}
        </div>
      )}
      {locked && !state.opponentPicked && !result && <p className="status">Atıcın kilitlendi, rakip bekleniyor…</p>}
      {result && (
        <div className="shot-scene-row">
          <ShotScene label="Sen" shooterName={result.shooters[myIdx].name} isGoal={result.goals[myIdx]} />
          <ShotScene label="Rakip" shooterName={result.shooters[other].name} isGoal={result.goals[other]} />
        </div>
      )}
      {tieBreakNote && <p className="status">{tieBreakNote}</p>}
    </div>
  );
}
