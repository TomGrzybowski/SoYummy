import { describe, expect, it } from 'vitest';
import { paginationQuerySchema, registerSchema } from './index.js';

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
});
