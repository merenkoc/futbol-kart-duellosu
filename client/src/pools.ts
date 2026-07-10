import type { PoolInfo } from '@fkd/shared';
import rawPools from '../../shared/data/pools.json';

/** Havuz meta verisi (takım seçme ekranı + havuz etiketi gösterimleri). */
export const pools = rawPools as unknown as PoolInfo[];

export function poolLabel(id: string | null): string | null {
  return pools.find((p) => p.id === id)?.label ?? null;
}
