import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Task } from '@fkd/shared';
import type { MatchUiState } from '../types.js';
import { CardView } from '../components/CardView.js';
import { DuelArea } from '../components/DuelArea.js';
import { TaskTimeline } from '../components/TaskTimeline.js';
import { statLabel } from '../gameConfig.js';
import { playClick, playFlip } from '../sound.js';

interface Props {
  state: MatchUiState;
  myIdx: 0 | 1;
  /** Maçın tur sıralı görevleri — geçmiş soluk, aktif vurgulu gösterilir. */
  tasks?: Task[] | null;
  banner: string | null;
  onBannerDone: () => void;
  onPlay: (cardId: string) => void;
}

export function MatchScreen({ state, myIdx, tasks, banner, onBannerDone, onPlay }: Props) {
  const reduceMotion = useReducedMotion();
  const locked = state.myPickId !== null;
  const other = myIdx === 0 ? 1 : 0;
  const reveal = state.lastReveal;
  const myPlayedCard =
    (reveal && reveal.round === state.round ? reveal.cards[myIdx] : null) ??
    state.hand.fieldCards.find((c) => c.id === state.myPickId) ??
    null;
  const opponentCard = reveal && reveal.round === state.round ? reveal.cards[other] : null;
  const revealActive = reveal !== null && reveal.round === state.round;
  const outcome: 'me' | 'other' | 'draw' | null =
    !reveal || reveal.round !== state.round ? null : reveal.winner === null ? 'draw' : reveal.winner === myIdx ? 'me' : 'other';

  // Rakibin kalan saha kartı sayısı = benim kalan saha kartı sayım (oyun simetrik:
  // her tur iki taraf da bir kart oynar). Rakibin gerçek kartları client'a gelmez;
  // bu yüzden sadece kapalı sırt sayısını gösteriyoruz.
  const oppRemaining = state.hand.fieldCards.filter((c) => !state.usedCardIds.includes(c.id)).length;

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
    <div className={`screen match-screen${state.task ? ` task-${state.task.id}` : ''}`}>
      <div className="scoreboard">
        <span>Sen: {state.scores[myIdx]}</span>
        <span>
          Tur {state.round}/{state.totalRounds}
        </span>
        <span>Rakip: {state.scores[other]}</span>
      </div>

      {tasks && tasks.length > 0 && <TaskTimeline tasks={tasks} currentRound={state.round} />}

      {/* Rakip tarafı — üstte kapalı kart sırtları (kalan el kadar) */}
      {oppRemaining > 0 && (
        <div className="opp-hand" aria-hidden>
          {Array.from({ length: oppRemaining }).map((_, i) => (
            <div className="opp-card-back" key={i} />
          ))}
        </div>
      )}

      {state.task && (
        <motion.div
          className="task-panel"
          key={state.task.id}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="task-panel-label">GÖREV</span>
          <span className="task-panel-name">{state.task.name}</span>
          <span className="task-panel-stats">
            {Object.keys(state.task.weights).map((k) => (
              <span key={k} className="stat-chip">
                {statLabel(k)}
              </span>
            ))}
          </span>
        </motion.div>
      )}

      {/* Benim tarafım — oyun alanı dibe hizalı (orta-alt) */}
      <div className="arena-play">
        {myPlayedCard ? (
          <DuelArea
            myCard={myPlayedCard}
            opponentCard={opponentCard}
            myScore={revealActive && reveal ? reveal.scores[myIdx] : null}
            opponentScore={revealActive && reveal ? reveal.scores[other] : null}
            outcome={outcome}
            myPoints={revealActive && reveal ? reveal.points[myIdx] : null}
            opponentPoints={revealActive && reveal ? reveal.points[other] : null}
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
        {revealActive && reveal && (
          <p className="status">
            {outcome === 'me' && 'Bu turu sen kazandın! (+' + reveal.points[myIdx] + ')'}
            {outcome === 'other' && 'Bu turu rakip kazandı. (+' + reveal.points[other] + ')'}
            {outcome === 'draw' && 'Berabere! (+1 -+1)'}
          </p>
        )}
      </div>
    </div>
  );
}
