import type { Card, GameConfig, Task } from '@fkd/shared';
import rawCards from '../../../shared/data/cards.json' with { type: 'json' };
import rawTasks from '../../../shared/data/tasks.json' with { type: 'json' };
import rawConfig from '../../../shared/data/config.json' with { type: 'json' };

export const cards = rawCards as unknown as Card[];
export const config = rawConfig as unknown as GameConfig;
export const fieldTasks = (rawTasks as unknown as { field: Task[]; gk: Task[] }).field;
export const gkTasks = (rawTasks as unknown as { field: Task[]; gk: Task[] }).gk;
