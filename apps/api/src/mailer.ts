import sgMail from '@sendgrid/mail';

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

export class SendGridMailer implements Mailer {
  constructor(
    apiKey: string,
    private readonly from: { email: string; name: string },
  ) {
    sgMail.setApiKey(apiKey);
  }

  async sendCode({ to, purpose, code, expiresInMinutes }: Parameters<Mailer['sendCode']>[0]) {
    const action = actions[purpose];
    const text = `Use code ${code} to ${action}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`;
    const [response] = await sgMail.send({
      to,
      from: this.from,
      subject: subjects[purpose],
      text,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937"><h1 style="color:#8baa36">So Yummy</h1><p>Use this code to ${action}:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>The code expires in ${expiresInMinutes} minutes.</p><p style="color:#6b7280">If you did not request this, you can ignore this email.</p></div>`,
    });
    if (response.statusCode !== 202) throw new Error(`SendGrid returned ${response.statusCode}`);
  }

  async sendPasswordChanged({ to, kind }: Parameters<Mailer['sendPasswordChanged']>[0]) {
    const action = kind === 'reset' ? 'reset' : 'changed';
    const text = `Your So Yummy password was ${action}. If this was not you, contact support immediately.`;
    const [response] = await sgMail.send({
      to,
      from: this.from,
      subject: 'Your So Yummy password was changed',
      text,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937"><h1 style="color:#8baa36">So Yummy</h1><p>Your password was ${action} successfully.</p><p>If this was not you, contact support immediately.</p></div>`,
    });
    if (response.statusCode !== 202) throw new Error(`SendGrid returned ${response.statusCode}`);
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
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY is required when EMAIL_DELIVERY_MODE=send');
  return new SendGridMailer(apiKey, {
    email: process.env.EMAIL_FROM_ADDRESS ?? 't.grzybowski94@gmail.com',
    name: process.env.EMAIL_FROM_NAME ?? 'So Yummy',
  });
}
