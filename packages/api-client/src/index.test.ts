import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './index.js';

describe('ApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not send a JSON content type for a bodyless mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient('/api/v1');

    await client.post<void>('/favorites/recipe-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/favorites/recipe-1',
      expect.objectContaining({
        method: 'POST',
        headers: {},
      }),
    );
  });

  it('sets the JSON content type when a JSON body is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ item: { ingredientId: 'ingredient-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient('/api/v1');

    await client.post('/shopping-list', { ingredientId: 'ingredient-1', measure: '2 cups' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/shopping-list',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"ingredientId":"ingredient-1","measure":"2 cups"}',
      }),
    );
  });
});
