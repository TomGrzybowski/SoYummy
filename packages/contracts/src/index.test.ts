import { describe, expect, it } from 'vitest';
import { paginationQuerySchema, registerSchema, verificationCodeSchema } from './index.js';

describe('contracts', () => {
  it('normalizes e-mail addresses', () => {
    expect(
      registerSchema.parse({ name: 'Tomasz', email: ' TEST@EXAMPLE.COM ', password: 'password123' })
        .email,
    ).toBe('test@example.com');
  });
  it('applies safe pagination defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
  });

  it('accepts only six-digit verification codes', () => {
    expect(verificationCodeSchema.parse('012345')).toBe('012345');
    expect(() => verificationCodeSchema.parse('12345')).toThrow();
    expect(() => verificationCodeSchema.parse('12345a')).toThrow();
  });
});
