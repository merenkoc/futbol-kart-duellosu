import { motion, useReducedMotion } from 'framer-motion';
import type { Task } from '@fkd/shared';
import type { DraftUiState } from '../types.js';
import { CardView } from '../components/CardView.js';
import { TaskTimeline } from '../components/TaskTimeline.js';
import { playClick } from '../sound.js';

interface Props {
  state: DraftUiState;
  poolLabel?: string | null;
  /** Maçın tur sıralı görevleri (önizleme) — karta göre plan yapılabilsin. */
  tasks?: Task[] | null;
  onPick: (cardId: string) => void;
}

export function Draft({ state, poolLabel, tasks, onPick }: Props) {
  const reduceMotion = useReducedMotion();
  const locked = state.myPickId !== null;
  return (
    <div className="screen draft-screen">
      {poolLabel && <p className="pool-tag">⚽ {poolLabel}</p>}
      <h2>
        Draft — Tur {state.round}/{state.totalRounds}
        {state.isGkRound && ' (Kaleci Turu)'}
      </h2>
      {tasks && tasks.length > 0 && <TaskTimeline tasks={tasks} showLabel />}
      {state.isGkRound && (
        <p className="status">
          Bu kart Kilit Round'da otomatik oynar ve penaltıda kurtarış gücünü belirler.
        </p>
      )}
      {/* key={state.round}: her draft turunda deste yeniden dağıtılır */}
      <div className="card-row" key={state.round}>
        {state.options.map((card, i) => (
          <motion.div
            key={card.id}
            className="draft-deal-slot"
            initial={reduceMotion ? false : { y: -36, rotate: -7, scale: 0.92, opacity: 0 }}
            animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : i * 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <CardView
              card={card}
              index={0}
              animateEntrance={false}
              selected={state.myPickId === card.id}
              disabled={locked}
              onClick={() => {
                playClick();
                onPick(card.id);
              }}
            />
          </motion.div>
        ))}
      </div>
      {locked && (
        <motion.div
          className={`draft-status-chip ${state.opponentPicked ? 'is-ready' : 'is-waiting'}`}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="draft-status-dot" aria-hidden />
          {state.opponentPicked
            ? 'Rakip de seçti, sonraki tur hazırlanıyor…'
            : 'Seçimin kilitlendi, rakip bekleniyor…'}
        </motion.div>
      )}
    </div>
  );
}
