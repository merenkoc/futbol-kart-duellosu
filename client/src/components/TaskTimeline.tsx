import type { Task } from '@fkd/shared';
import { gameConfig } from '../gameConfig.js';

interface Props {
  /** Tur sıralı 5 görev (görev önizlemesi). */
  tasks: Task[];
  /** Maç sırasında aktif tur (1 bazlı). Draft'ta verilmez — hepsi "gelecek" görünür. */
  currentRound?: number;
  /** Başına "GÖREVLER" etiketi koy (draft ekranında bağlam için). */
  showLabel?: boolean;
}

/**
 * Görev zaman çizelgesi: maçın 5 görevi tur sırasıyla çip olarak dizilir.
 * Geçmiş turlar soluk/üstü çizili, aktif tur vurgulu, Kilit Round altın çerçeveli.
 */
export function TaskTimeline({ tasks, currentRound, showLabel = false }: Props) {
  const gkRound = gameConfig.match.gkRound;
  return (
    <ol className="task-timeline" aria-label="Maç görevleri">
      {showLabel && (
        <li className="task-timeline-label" aria-hidden>
          GÖREVLER
        </li>
      )}
      {tasks.map((task, i) => {
        const round = i + 1;
        const cls = [
          'task-timeline-chip',
          round === gkRound ? 'is-gk' : '',
          currentRound !== undefined && round < currentRound ? 'is-done' : '',
          currentRound === round ? 'is-active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={task.id} className={cls}>
            <span className="task-timeline-round">{round}</span>
            <span className="task-timeline-name">{task.name}</span>
          </li>
        );
      })}
    </ol>
  );
}
