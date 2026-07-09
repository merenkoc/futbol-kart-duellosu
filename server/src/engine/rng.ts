/**
 * Deterministik, seed'lenebilir RNG (mulberry32).
 * Motorun tüm rastgeleliği bu tip üzerinden enjekte edilir —
 * testlerde sabit seed ile birebir tekrarlanabilirlik sağlar.
 */
export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [0, maxExclusive) arası tamsayı. */
export function randInt(rng: RNG, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function pickOne<T>(rng: RNG, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pickOne: boş dizi');
  return arr[randInt(rng, arr.length)] as T;
}

/** Fisher-Yates — orijinali değiştirmez, yeni dizi döner. */
export function shuffle<T>(rng: RNG, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
