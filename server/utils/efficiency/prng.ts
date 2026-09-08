/**
 * Seeded PRNG (mulberry32) — детерминированная база для bootstrap (TZ §5 п.3).
 * Одинаковый seed → одинаковая последовательность → воспроизводимость при перезапуске.
 * Не для криптографии — только для статистических симуляций.
 */

export type Rng = () => number

/** Создаёт генератор [0, 1) из целочисленного seed */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a += 0x6D2B79F5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seed из строки (стабилен между процессами, в отличие от string→int хеша Date) */
export function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
