import { describe, expect, it } from 'vitest';
import { isAtLeast } from './roles';

describe('isAtLeast', () => {
  it('is cumulative', () => {
    expect(isAtLeast('EDIT', 'POSITION')).toBe(true);
    expect(isAtLeast('READ', 'POSITION')).toBe(false);
  });
});
