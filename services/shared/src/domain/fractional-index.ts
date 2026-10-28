/**
 * Fractional indexing: positions are strings compared in plain code-unit order.
 * A key is a non-empty sequence of base-62 digits that never ends with '0', read as a fraction in [0, 1).
 * Inserting between two keys never renumbers the others.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const VALID_KEY = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isValidKey(key: string): boolean {
  return VALID_KEY.test(key);
}

/** Midpoint of two digit strings, `a` < `b`; `b === null` stands for 1. */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]!) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]!) : BASE;
  if (digitB - digitA > 1) return DIGITS[Math.round((digitA + digitB) / 2)]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

/** Returns a key strictly between `a` and `b`; `null` means unbounded on that side. */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValidKey(a)) throw new Error(`Invalid key: ${a}`);
  if (b !== null && !isValidKey(b)) throw new Error(`Invalid key: ${b}`);
  if (a !== null && b !== null && a >= b) throw new Error(`Keys out of order: ${a} >= ${b}`);
  return midpoint(a ?? '', b);
}

/** Returns `n` ordered keys strictly between `a` and `b`. */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  const keys: string[] = [];
  let previous = a;
  for (let i = 0; i < n; i++) {
    previous = keyBetween(previous, b);
    keys.push(previous);
  }
  return keys;
}
