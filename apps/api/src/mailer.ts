export type AuthEmailPurpose = 'registration' | 'password_reset' | 'password_change';

export interface Mailer {
  sendCode(input: {
    to: string;
    purpose: AuthEmailPurpose;
    code: string;
    expiresInMinutes: number;
  }): Promise<void>;
  sendPasswordChanged(input: { to: string; kind: 'reset' | 'change' }): Promise<void>;
}

const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';

const subjects: Record<AuthEmailPurpose, string> = {
  registration: 'Verify your So Yummy account',
  password_reset: 'Reset your So Yummy password',
  password_change: 'Confirm your So Yummy password change',
};

const actions: Record<AuthEmailPurpose, string> = {
  registration: 'finish creating your account',
  password_reset: 'reset your password',
  password_change: 'change your password',
};

type MailjetMessage = {
  From: { Email: string; Name: string };
  To: Array<{ Email: string }>;
  Subject: string;
  TextPart: string;
  HTMLPart: string;
};

type MailjetResponse = {
  Messages?: Array<{ Status?: string }>;
};

class MailjetDeliveryError extends Error {
  readonly response: { statusCode: number; body: { provider: 'mailjet'; outcome: string } };

  constructor(statusCode: number, outcome: string) {
    super(`Mailjet delivery failed (${outcome}, HTTP ${statusCode})`);
    this.name = 'MailjetDeliveryError';
    this.response = { statusCode, body: { provider: 'mailjet', outcome } };
  }
}

export class MailjetMailer implements Mailer {
  private readonly authorization: string;

  constructor(
    apiKey: string,
    secretKey: string,
    private readonly from: { email: string; name: string },
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.authorization = `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`;
  }

  async sendCode({ to, purpose, code, expiresInMinutes }: Parameters<Mailer['sendCode']>[0]) {
    const action = actions[purpose];
    await this.send({
      From: { Email: this.from.email, Name: this.from.name },
      To: [{ Email: to }],
      Subject: subjects[purpose],
      TextPart: `Use code ${code} to ${action}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
      HTMLPart: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937"><h1 style="color:#8baa36">So Yummy</h1><p>Use this code to ${action}:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>The code expires in ${expiresInMinutes} minutes.</p><p style="color:#6b7280">If you did not request this, you can ignore this email.</p></div>`,
    });
  }

  async sendPasswordChanged({ to, kind }: Parameters<Mailer['sendPasswordChanged']>[0]) {
    const action = kind === 'reset' ? 'reset' : 'changed';
    await this.send({
      From: { Email: this.from.email, Name: this.from.name },
      To: [{ Email: to }],
      Subject: 'Your So Yummy password was changed',
      TextPart: `Your So Yummy password was ${action}. If this was not you, contact support immediately.`,
      HTMLPart: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937"><h1 style="color:#8baa36">So Yummy</h1><p>Your password was ${action} successfully.</p><p>If this was not you, contact support immediately.</p></div>`,
    });
  }

  private async send(message: MailjetMessage) {
    let response: Response;
    try {
      response = await this.fetcher(MAILJET_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: this.authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Messages: [message] }),
      });
    } catch {
      throw new MailjetDeliveryError(0, 'network_error');
    }

    if (!response.ok) {
      throw new MailjetDeliveryError(response.status, 'request_rejected');
    }

    let result: MailjetResponse;
    try {
      result = (await response.json()) as MailjetResponse;
    } catch {
      throw new MailjetDeliveryError(response.status, 'invalid_response');
    }

    if (
      !Array.isArray(result.Messages) ||
      result.Messages.length === 0 ||
      result.Messages.some((item) => item.Status !== 'success')
    ) {
      throw new MailjetDeliveryError(response.status, 'message_rejected');
    }
  }
}

export class LoggingMailer implements Mailer {
  async sendCode(input: Parameters<Mailer['sendCode']>[0]) {
    console.info(`[email:${input.purpose}] recipient=${input.to} code=${input.code}`);
  }
  async sendPasswordChanged(input: Parameters<Mailer['sendPasswordChanged']>[0]) {
    console.info(`[email:password_${input.kind}] recipient=${input.to}`);
  }
}

export function createMailer(): Mailer {
  const mode =
    process.env.EMAIL_DELIVERY_MODE ?? (process.env.NODE_ENV === 'production' ? 'send' : 'log');
  if (mode === 'log') return new LoggingMailer();
  if (mode !== 'send') throw new Error('EMAIL_DELIVERY_MODE must be "send" or "log"');
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error(
      'MAILJET_API_KEY and MAILJET_SECRET_KEY are required when EMAIL_DELIVERY_MODE=send',
    );
  }
  return new MailjetMailer(apiKey, secretKey, {
    email: process.env.EMAIL_FROM_ADDRESS ?? 't.grzybowski94@gmail.com',
    name: process.env.EMAIL_FROM_NAME ?? 'So Yummy',
  });
}
