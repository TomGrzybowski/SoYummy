import { describe, expect, it } from 'vitest';
import { AuthService } from './auth-service.js';
import type { AuthEmailPurpose, Mailer } from './mailer.js';
import { Store, StoreError } from './store.js';

class CapturingMailer implements Mailer {
  messages: Array<{ to: string; purpose: AuthEmailPurpose; code: string }> = [];
  async sendCode(input: { to: string; purpose: AuthEmailPurpose; code: string }) {
    this.messages.push(input);
  }
  async sendPasswordChanged() {}
}

class RejectingMailer implements Mailer {
  async sendCode() {
    const error = new Error(
      'Mailjet delivery failed (authentication_failed, HTTP 401)',
    ) as Error & {
      response: { statusCode: number; body: unknown };
    };
    error.response = {
      statusCode: 401,
      body: { provider: 'mailjet', outcome: 'authentication_failed' },
    };
    throw error;
  }
  async sendPasswordChanged() {}
}

const registration = { name: 'Tomasz', email: 'person@example.com', password: 'strong-password' };

describe('AuthService', () => {
  it('enforces resend cooldown and consumes a registration code once', async () => {
    const store = new Store();
    const mailer = new CapturingMailer();
    let now = new Date('2026-08-15T12:00:00Z');
    const service = new AuthService(
      store,
      mailer,
      'a-secure-test-pepper',
      () => now,
      () => '012345',
    );
    await service.requestRegistration(registration, '127.0.0.1');
    await expect(service.resendRegistration(registration.email, '127.0.0.1')).rejects.toMatchObject(
      { code: 'CODE_RATE_LIMITED' },
    );
    const result = await service.verifyRegistration(registration.email, '012345');
    expect(result.user.email).toBe(registration.email);
    await expect(service.verifyRegistration(registration.email, '012345')).rejects.toMatchObject({
      code: 'INVALID_OR_EXPIRED_CODE',
    });
    now = new Date(now.getTime() + 61_000);
  });

  it('locks a challenge after five invalid attempts', async () => {
    const store = new Store();
    const service = new AuthService(
      store,
      new CapturingMailer(),
      'a-secure-test-pepper',
      undefined,
      () => '654321',
    );
    await service.requestRegistration(registration, '127.0.0.2');
    for (let attempt = 0; attempt < 5; attempt += 1)
      await expect(service.verifyRegistration(registration.email, '000000')).rejects.toBeInstanceOf(
        StoreError,
      );
    await expect(service.verifyRegistration(registration.email, '654321')).rejects.toMatchObject({
      code: 'INVALID_OR_EXPIRED_CODE',
    });
  });

  it('returns the same accepted reset request for an unknown address without sending mail', async () => {
    const mailer = new CapturingMailer();
    const service = new AuthService(new Store(), mailer, 'a-secure-test-pepper');
    await expect(
      service.requestPasswordReset('missing@example.com', '127.0.0.3'),
    ).resolves.toBeUndefined();
    expect(mailer.messages).toHaveLength(0);
    await expect(
      service.requestPasswordReset('missing@example.com', '127.0.0.3'),
    ).rejects.toMatchObject({ code: 'CODE_RATE_LIMITED' });
  });

  it('explains that provider authentication failure is not invalid form input', async () => {
    const service = new AuthService(new Store(), new RejectingMailer(), 'a-secure-test-pepper');

    await expect(service.requestRegistration(registration, '127.0.0.4')).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_FAILED',
      statusCode: 503,
      message:
        "Your details are valid, but this site's email service credentials were rejected. Please use the demo account or contact the site owner.",
    });
  });
});
