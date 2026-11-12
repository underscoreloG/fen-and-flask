// mulberry32. Its whole state is one uint32 kept in GameState, so saves and replays stay exact.

export interface RngHolder {
  rng: number;
}

export function seedRng(seed: number): number {
  return seed >>> 0;
}

function nextU32(s: RngHolder): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

// Uniform in [0, 1).
export function nextFloat(s: RngHolder): number {
  return nextU32(s) / 4294967296;
}

// Uniform integer in [min, max], both inclusive.
export function nextInt(s: RngHolder, min: number, max: number): number {
  return min + Math.floor(nextFloat(s) * (max - min + 1));
}

// Uniform float in [min, max).
export function nextRange(s: RngHolder, min: number, max: number): number {
  return min + nextFloat(s) * (max - min);
}
