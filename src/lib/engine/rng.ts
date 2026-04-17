// =============================================================================
// RNG e utilitários de embaralhamento
// =============================================================================
//
// Usamos um RNG determinístico (mulberry32) para que a partida seja
// reproduzível dado uma seed. Isso facilita testes e debugging.
// =============================================================================

export interface Rng {
  next: () => number; // [0, 1)
  nextInt: (maxExclusive: number) => number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (max: number) => Math.floor(next() * max),
  };
}

export function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffled<T>(arr: T[], rng: Rng): T[] {
  return shuffleInPlace([...arr], rng);
}
