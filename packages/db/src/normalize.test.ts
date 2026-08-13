import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from './normalize';

describe('source normalization', () => {
  it('rejects incomplete source datasets before touching the database', () => {
    expect(() => normalizeCatalog([], [], [])).toThrow('Unexpected source totals');
  });
});
