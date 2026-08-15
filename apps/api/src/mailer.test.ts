import { afterEach, describe, expect, it } from 'vitest';
import { createMailer, LoggingMailer, MailjetMailer } from './mailer.js';

type CapturedRequest = { url: string | URL | Request; init: RequestInit | undefined };

function successfulResponse() {
  return new Response(JSON.stringify({ Messages: [{ Status: 'success' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createHarness(response: Response = successfulResponse()) {
  const requests: CapturedRequest[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url, init });
    return response;
  };
  const mailer = new MailjetMailer(
    'test-api-key',
    'test-secret-key',
    { email: 'sender@example.com', name: 'So Yummy' },
    fetcher,
  );
  return { mailer, requests };
}

function requestBody(request: CapturedRequest) {
  return JSON.parse(String(request.init?.body)) as {
    Messages: Array<{
      From: { Email: string; Name: string };
      To: Array<{ Email: string }>;
      Subject: string;
      TextPart: string;
      HTMLPart: string;
    }>;
  };
}

describe('MailjetMailer', () => {
  it('sends a verification code through Mailjet Send API v3.1', async () => {
    const { mailer, requests } = createHarness();

    await mailer.sendCode({
      to: 'recipient@example.com',
      purpose: 'registration',
      code: '123456',
      expiresInMinutes: 10,
    });

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe('https://api.mailjet.com/v3.1/send');
    expect(request?.init?.method).toBe('POST');
    expect(request?.init?.headers).toEqual({
      Authorization: `Basic ${Buffer.from('test-api-key:test-secret-key').toString('base64')}`,
      'Content-Type': 'application/json',
    });
    expect(requestBody(request!).Messages[0]).toMatchObject({
      From: { Email: 'sender@example.com', Name: 'So Yummy' },
      To: [{ Email: 'recipient@example.com' }],
      Subject: 'Verify your So Yummy account',
    });
    expect(requestBody(request!).Messages[0]?.TextPart).toContain('123456');
    expect(requestBody(request!).Messages[0]?.HTMLPart).toContain('123456');
  });

  it('sends password-change completion notifications', async () => {
    const { mailer, requests } = createHarness();

    await mailer.sendPasswordChanged({ to: 'recipient@example.com', kind: 'change' });

    const message = requestBody(requests[0]!).Messages[0];
    expect(message).toMatchObject({
      Subject: 'Your So Yummy password was changed',
      To: [{ Email: 'recipient@example.com' }],
    });
    expect(message?.TextPart).toContain('password was changed');
    expect(message?.HTMLPart).toContain('password was changed successfully');
  });

  it('rejects non-2xx responses without exposing provider response contents', async () => {
    const response = new Response(
      JSON.stringify({ ErrorCode: 'mj-0015', ErrorMessage: 'request contained 654321' }),
      { status: 401 },
    );
    const { mailer } = createHarness(response);

    await expect(
      mailer.sendCode({
        to: 'recipient@example.com',
        purpose: 'password_reset',
        code: '654321',
        expiresInMinutes: 10,
      }),
    ).rejects.toMatchObject({
      message: 'Mailjet delivery failed (authentication_failed, HTTP 401)',
      response: {
        statusCode: 401,
        body: {
          provider: 'mailjet',
          outcome: 'authentication_failed',
          providerCode: 'mj-0015',
        },
      },
    });
  });

  it('distinguishes a suspended API key using only Mailjet safe error metadata', async () => {
    const response = new Response(
      JSON.stringify({ ErrorCode: 'mj-0001', ErrorMessage: 'sensitive provider details' }),
      { status: 401 },
    );
    const { mailer } = createHarness(response);

    await expect(
      mailer.sendCode({
        to: 'recipient@example.com',
        purpose: 'registration',
        code: '123456',
        expiresInMinutes: 10,
      }),
    ).rejects.toMatchObject({
      response: {
        statusCode: 401,
        body: {
          provider: 'mailjet',
          outcome: 'api_key_suspended',
          providerCode: 'mj-0001',
        },
      },
    });
  });

  it('classifies provider throttling without exposing provider response contents', async () => {
    const { mailer } = createHarness(new Response('sensitive response', { status: 429 }));

    await expect(
      mailer.sendCode({
        to: 'recipient@example.com',
        purpose: 'registration',
        code: '123456',
        expiresInMinutes: 10,
      }),
    ).rejects.toMatchObject({
      response: {
        statusCode: 429,
        body: { provider: 'mailjet', outcome: 'rate_limited' },
      },
    });
  });

  it('rejects a message status other than success', async () => {
    const response = new Response(JSON.stringify({ Messages: [{ Status: 'error' }] }), {
      status: 200,
    });
    const { mailer } = createHarness(response);

    await expect(
      mailer.sendCode({
        to: 'recipient@example.com',
        purpose: 'password_change',
        code: '123456',
        expiresInMinutes: 10,
      }),
    ).rejects.toThrow('Mailjet delivery failed (message_rejected, HTTP 200)');
  });

  it('rejects malformed successful responses', async () => {
    const { mailer } = createHarness(new Response('not-json', { status: 200 }));

    await expect(
      mailer.sendPasswordChanged({ to: 'recipient@example.com', kind: 'reset' }),
    ).rejects.toThrow('Mailjet delivery failed (invalid_response, HTTP 200)');
  });
});

describe('createMailer', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('requires both Mailjet credentials in send mode', () => {
    process.env.EMAIL_DELIVERY_MODE = 'send';
    delete process.env.MAILJET_API_KEY;
    delete process.env.MAILJET_SECRET_KEY;

    expect(() => createMailer()).toThrow(
      'MAILJET_API_KEY and MAILJET_SECRET_KEY are required when EMAIL_DELIVERY_MODE=send',
    );
  });

  it('preserves logging mode for local development', () => {
    process.env.EMAIL_DELIVERY_MODE = 'log';

    expect(createMailer()).toBeInstanceOf(LoggingMailer);
  });

  it('trims accidental whitespace and wrapping quotes from provider credentials', async () => {
    process.env.EMAIL_DELIVERY_MODE = 'send';
    process.env.MAILJET_API_KEY = '  "test-api-key"  ';
    process.env.MAILJET_SECRET_KEY = "  'test-secret-key'  ";
    const originalFetch = global.fetch;
    let authorization = '';
    global.fetch = async (_url, init) => {
      authorization = String((init?.headers as Record<string, string>).Authorization);
      return successfulResponse();
    };

    try {
      await createMailer().sendCode({
        to: 'recipient@example.com',
        purpose: 'registration',
        code: '123456',
        expiresInMinutes: 10,
      });
    } finally {
      global.fetch = originalFetch;
    }

    expect(authorization).toBe(
      `Basic ${Buffer.from('test-api-key:test-secret-key').toString('base64')}`,
    );
  });
});
