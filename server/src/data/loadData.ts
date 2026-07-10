import type { Card, GameConfig, PoolInfo, Task } from '@fkd/shared';
import rawCards from '../../../shared/data/cards.json' with { type: 'json' };
import rawTasks from '../../../shared/data/tasks.json' with { type: 'json' };
import rawConfig from '../../../shared/data/config.json' with { type: 'json' };
import rawPools from '../../../shared/data/pools.json' with { type: 'json' };

export const cards = rawCards as unknown as Card[];
export const config = rawConfig as unknown as GameConfig;
export const fieldTasks = (rawTasks as unknown as { field: Task[]; gk: Task[] }).field;
export const gkTasks = (rawTasks as unknown as { field: Task[]; gk: Task[] }).gk;
export const pools = rawPools as unknown as PoolInfo[];

/** Havuz id -> o havuzun kartları. Maç kurulurken draft bu alt-havuzdan yapılır. */
export const cardsByPool = new Map<string, Card[]>();
for (const card of cards) {
  const key = card.pool ?? 'default';
  const list = cardsByPool.get(key);
  if (list) list.push(card);
  else cardsByPool.set(key, [card]);
}

export const DEFAULT_POOL_ID = pools[0]?.id ?? 'default';

/** Geçerli bir havuz id'siyse onu, değilse varsayılan havuzu döndürür (payload doğrulama). */
export function resolvePoolId(poolId: unknown): string {
  return typeof poolId === 'string' && cardsByPool.has(poolId) ? poolId : DEFAULT_POOL_ID;
}
