import { describe, expect, it } from 'vitest';
import { compareKeys, keyBetween, keysBetween } from './fractional-index';

describe('keyBetween', () => {
  it('creates a first key', () => {
    expect(keyBetween(null, null)).toBe('V');
  });

  it('creates keys strictly between bounds', () => {
    const cases: [string | null, string | null][] = [
      [null, 'V'],
      ['V', null],
      ['V', 'W'],
      ['V', 'V1'],
      ['a', 'a01'],
      ['z', null],
      ['zzz', null],
      [null, '01'],
      ['0z', '1'],
    ];
    for (const [a, b] of cases) {
      const key = keyBetween(a, b);
      if (a !== null) expect(key > a, `${key} > ${a}`).toBe(true);
      if (b !== null) expect(key < b, `${key} < ${b}`).toBe(true);
      expect(key.endsWith('0')).toBe(false);
    }
  });

  it('rejects inverted or equal bounds', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
    expect(() => keyBetween('a', 'a')).toThrow();
  });

  it('rejects invalid keys', () => {
    expect(() => keyBetween('a0', null)).toThrow();
    expect(() => keyBetween('a-b', null)).toThrow();
    expect(() => keyBetween('', null)).toThrow();
  });

  it('keeps a total order after many random insertions', () => {
    const keys: string[] = [];
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 500; i++) {
      const index = Math.floor(random() * (keys.length + 1));
      const key = keyBetween(keys[index - 1] ?? null, keys[index] ?? null);
      keys.splice(index, 0, key);
    }
    expect([...keys].sort(compareKeys)).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('grows slowly when appending at the end', () => {
    let last: string | null = null;
    for (let i = 0; i < 200; i++) last = keyBetween(last, null);
    expect(last!.length).toBeLessThanOrEqual(40);
  });
});

describe('keysBetween', () => {
  it('returns n ordered keys between bounds', () => {
    const keys = keysBetween('a', 'b', 5);
    expect(keys).toHaveLength(5);
    expect([...keys].sort(compareKeys)).toEqual(keys);
    expect(keys.every((k) => k > 'a' && k < 'b')).toBe(true);
  });
});
