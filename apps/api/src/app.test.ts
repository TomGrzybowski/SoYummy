import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './build-app.js';
import { Store } from './store.js';
import type { AuthEmailPurpose, Mailer } from './mailer.js';

class FakeMailer implements Mailer {
  codes: Array<{ to: string; purpose: AuthEmailPurpose; code: string }> = [];
  notifications: Array<{ to: string; kind: 'reset' | 'change' }> = [];
  async sendCode(input: { to: string; purpose: AuthEmailPurpose; code: string }) {
    this.codes.push(input);
  }
  async sendPasswordChanged(input: { to: string; kind: 'reset' | 'change' }) {
    this.notifications.push(input);
  }
  code(purpose: AuthEmailPurpose) {
    const value = this.codes.findLast((item) => item.purpose === purpose)?.code;
    if (!value) throw new Error(`No ${purpose} code was sent`);
    return value;
  }
}

describe('API', () => {
  let app: FastifyInstance;
  let mailer: FakeMailer;
  beforeAll(async () => {
    mailer = new FakeMailer();
    app = await buildApp(new Store(), mailer);
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
    expect(registration.statusCode).toBe(202);
    expect(registration.headers['set-cookie']).toBeUndefined();
    const verification = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/verify',
      payload: { email: 'test@example.com', code: mailer.code('registration') },
    });
    expect(verification.statusCode).toBe(201);
    const cookie = verification.headers['set-cookie'];
    expect(cookie).toContain('HttpOnly');
    const profile = await app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: { cookie: String(cookie).split(';')[0]! },
    });
    expect(profile.json().user.email).toBe('test@example.com');
  });
  it('resets a password with a single-use code and invalidates sessions', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'test@example.com', password: 'strong-password' },
    });
    const oldCookie = String(login.headers['set-cookie']).split(';')[0]!;
    const requested = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/forgot',
      payload: { email: 'test@example.com' },
    });
    expect(requested.statusCode).toBe(202);
    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/reset',
      payload: {
        email: 'test@example.com',
        code: mailer.code('password_reset'),
        newPassword: 'a-new-strong-password',
      },
    });
    expect(reset.statusCode).toBe(204);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/users/me', headers: { cookie: oldCookie } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email: 'test@example.com', password: 'a-new-strong-password' },
        })
      ).statusCode,
    ).toBe(200);
    expect(mailer.notifications).toContainEqual({ to: 'test@example.com', kind: 'reset' });
  });
  it('requires the current password and an email code to change password', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'test@example.com', password: 'a-new-strong-password' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    const rejected = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change/request',
      headers: { cookie },
      payload: { currentPassword: 'incorrect-password' },
    });
    expect(rejected.statusCode).toBe(401);
    const requested = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change/request',
      headers: { cookie },
      payload: { currentPassword: 'a-new-strong-password' },
    });
    expect(requested.statusCode).toBe(202);
    const changed = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change/confirm',
      headers: { cookie },
      payload: {
        currentPassword: 'a-new-strong-password',
        newPassword: 'final-strong-password',
        code: mailer.code('password_change'),
      },
    });
    expect(changed.statusCode).toBe(204);
    const freshCookie = String(changed.headers['set-cookie']).split(';')[0]!;
    expect(
      (await app.inject({ method: 'GET', url: '/v1/users/me', headers: { cookie } })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/users/me', headers: { cookie: freshCookie } }))
        .statusCode,
    ).toBe(200);
  });
  it('adds and removes a favorite through the HTTP handlers', async () => {
    const email = 'favorite-actions@example.com';
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { name: 'Favorite User', email, password: 'strong-password' },
    });
    const verification = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/verify',
      payload: { email, code: mailer.code('registration') },
    });
    const cookie = String(verification.headers['set-cookie']).split(';')[0]!;
    const popular = await app.inject({ method: 'GET', url: '/v1/recipes/popular' });
    const recipeId = popular.json().items[0].id as string;

    const added = await app.inject({
      method: 'POST',
      url: `/v1/favorites/${recipeId}`,
      headers: { cookie },
    });
    expect(added.statusCode).toBe(204);
    const favorites = await app.inject({
      method: 'GET',
      url: '/v1/favorites',
      headers: { cookie },
    });
    expect(favorites.json().items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: recipeId })]),
    );

    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/favorites/${recipeId}`,
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(204);
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
