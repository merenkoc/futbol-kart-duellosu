import type { Card, GameConfig, Task } from '@fkd/shared';
import rawCards from '../../shared/data/cards.json';
import rawTasks from '../../shared/data/tasks.json';
import rawConfig from '../../shared/data/config.json';

export const cards = rawCards as unknown as Card[];
export const config = rawConfig as unknown as GameConfig;
export const fieldTasks = (rawTasks as unknown as { field: Task[]; gk: Task[] }).field;
export const gkTasks = (rawTasks as unknown as { field: Task[]; gk: Task[] }).gk;

export const fieldCards = cards.filter((c) => c.position === 'field');
export const gkCards = cards.filter((c) => c.position === 'gk');

/** Testler için elle kurulmuş saha kartı (verilmeyen statlar 80). */
export function makeFieldCard(id: string, stats: Partial<Record<string, number>>): Card {
  return {
    id,
    name: id,
    position: 'field',
    stats: { dripling: 80, hiz: 80, sut: 80, teknik: 80, pas: 80, calim: 80, ...stats } as Record<string, number>,
  };
}

/** Testler için elle kurulmuş kaleci kartı. */
export function makeGkCard(id: string, atlama: number, kurtaris: number, pozisyonAlma: number): Card {
  return { id, name: id, position: 'gk', stats: { atlama, kurtaris, pozisyonAlma } };
}
