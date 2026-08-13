import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

describe('API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => app.close());
  it('reports a validated catalog', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json().catalog).toEqual({ categories: 14, ingredients: 574, recipes: 285 });
  });
  it('supports register, profile and logout with an opaque cookie', async () => {
    const registration = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { name: 'Tomasz', email: 'test@example.com', password: 'strong-password' },
    });
    expect(registration.statusCode).toBe(201);
    const cookie = registration.headers['set-cookie'];
    expect(cookie).toContain('HttpOnly');
    const profile = await app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: { cookie: String(cookie).split(';')[0]! },
    });
    expect(profile.json().user.email).toBe('test@example.com');
  });
  it('returns the standard error envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/users/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
    });
    expect(response.json().requestId).toBeTruthy();
  });
});
