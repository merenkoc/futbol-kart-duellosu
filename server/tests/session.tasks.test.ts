import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/game/session.js';
import { cards, config, fieldTasks, gkTasks } from './helpers.js';

/**
 * Görev önizlemesi: görevler session kurulur kurulmaz (draft başlamadan) bellidir,
 * draft bitince maç AYNI listeyle oynanır ve seed determinizmi korunur.
 */
function newSession(seed: number): MatchSession {
  return new MatchSession(`m-${seed}`, 'bot', ['t0', 't1'], config, cards, fieldTasks, gkTasks, seed);
}

describe('MatchSession — görev önizlemesi', () => {
  it('görevler draft başlamadan hazır: tur sıralı 5 görev, Kilit Round kaleci görevi', () => {
    const session = newSession(7);
    expect(session.phase).toBe('draft');
    expect(session.matchTasks).toHaveLength(config.match.rounds);
    session.matchTasks.forEach((task, i) => {
      const round = i + 1;
      expect(task.type).toBe(round === config.match.gkRound ? 'gk' : 'field');
    });
    // Saha görevleri tekrarsız.
    const ids = session.matchTasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draft bitince maç önizlenen görevlerle birebir oynanır', () => {
    const session = newSession(11);
    const preview = session.matchTasks;
    // Draft'ı bitir: her turda ilk seçenek alınır, bot için botDraftChoice.
    while (session.phase === 'draft') {
      session.draftPick(0, session.draftState.options[0][0]!.id);
      session.draftPick(1, session.botDraftChoice().id);
    }
    expect(session.phase).toBe('match');
    expect(session.matchState!.tasks).toEqual(preview);
  });

  it('aynı seed aynı görevleri üretir (determinizm)', () => {
    const a = newSession(42).matchTasks.map((t) => t.id);
    const b = newSession(42).matchTasks.map((t) => t.id);
    const c = newSession(43).matchTasks.map((t) => t.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c); // farklı seed büyük ihtimalle farklı dizilim
  });
});
