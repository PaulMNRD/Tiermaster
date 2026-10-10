import { describe, expect, it } from 'vitest';
import { OperationSchema } from './index';

describe('OperationSchema', () => {
  it('accepts a valid moveCard operation', () => {
    const op = { type: 'moveCard', opId: 'o1', cardId: 'c1', categoryId: null, position: 'a0' };
    expect(OperationSchema.safeParse(op).success).toBe(true);
  });
  it('rejects an unknown operation type', () => {
    expect(OperationSchema.safeParse({ type: 'nope' }).success).toBe(false);
  });
});
