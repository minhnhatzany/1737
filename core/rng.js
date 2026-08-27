/**
 * Mulberry32 32-bit PRNG
 * Seeded deterministic random number generator.
 */

export function initSeed(seed) {
  if (typeof seed === "number" && !isNaN(seed)) return seed >>> 0;
  if (typeof seed === "string") {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  return ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0);
}

let _fallbackSeed = 1737;

/** Reseed the stateless fallback generator (world-gen before a state exists). */
export function seedRng(seed) {
  _fallbackSeed = initSeed(seed);
}

/**
 * Steps state.rngState forward using Mulberry32 and returns float in [0, 1).
 */
export function rng(state = null) {
  if (state && typeof state === "object") {
    if (typeof state.rngState !== "number") {
      state.rngSeed = state.rngSeed || initSeed(Date.now());
      state.rngState = initSeed(state.rngSeed);
    }
    let t = (state.rngState += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    state.rngState = t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  
  // Fallback if state is omitted
  let t = (_fallbackSeed += 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  _fallbackSeed = t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Returns integer in [min, max] inclusive using state PRNG.
 */
export function rngInt(state, min, max) {
  if (typeof max === "undefined") {
    // If called as rngInt(min, max) without state
    max = min;
    min = state;
    state = null;
  }
  const r = rng(state);
  return Math.floor(r * (max - min + 1)) + min;
}

/**
 * Returns true with probability `chance` (0.0 to 1.0).
 */
export function rngChance(state, chance) {
  if (typeof chance === "undefined") {
    chance = state;
    state = null;
  }
  return rng(state) < chance;
}

/**
 * Returns random element from array using state PRNG.
 */
export function rngChoice(state, arr) {
  if (Array.isArray(state) && typeof arr === "undefined") {
    arr = state;
    state = null;
  }
  if (!arr || arr.length === 0) return null;
  return arr[rngInt(state, 0, arr.length - 1)];
}

export const randInt = rngInt;
export const random = rng;
