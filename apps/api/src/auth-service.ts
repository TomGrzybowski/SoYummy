import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { RegisterInput, User } from '@so-yummy/contracts';
import type { AuthEmailPurpose, Mailer } from './mailer.js';
import { StoreError } from './store.js';

export type AuthUser = User & { passwordHash: string };
export type PendingRegistration = Omit<RegisterInput, 'password'> & {
  passwordHash: string;
  expiresAt: Date;
};
export type AuthChallenge = {
  id: string;
  purpose: AuthEmailPurpose;
  email: string;
  userId?: string;
  codeHash: string;
  requestIpHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  sentAt: Date;
};

export interface AuthRepository {
  authUserByEmail(email: string): Promise<AuthUser | undefined>;
  authUserById(id: string): Promise<AuthUser | undefined>;
  savePendingRegistration(value: PendingRegistration): Promise<void>;
  pendingRegistration(email: string): Promise<PendingRegistration | undefined>;
  challengeCounts(
    email: string,
    purpose: AuthEmailPurpose,
    ipHash: string,
    since: Date,
  ): Promise<{ target: number; ip: number }>;
  latestChallenge(email: string, purpose: AuthEmailPurpose): Promise<AuthChallenge | undefined>;
  invalidateChallenges(email: string, purpose: AuthEmailPurpose, at: Date): Promise<void>;
  createChallenge(value: AuthChallenge): Promise<void>;
  deleteChallenge(id: string): Promise<void>;
  failChallenge(id: string): Promise<void>;
  consumeChallenge(id: string, at: Date): Promise<boolean>;
  activateRegistration(email: string, session: SessionRecord): Promise<User>;
  replacePassword(userId: string, passwordHash: string, session?: SessionRecord): Promise<void>;
}

export type SessionRecord = { id: string; tokenHash: string; expiresAt: Date; token: string };
const CODE_TTL_MS = 10 * 60_000;
const PENDING_TTL_MS = 24 * 60 * 60_000;
const SEND_WINDOW_MS = 60 * 60_000;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly mailer: Mailer,
    private readonly pepper: string,
    private readonly now: () => Date = () => new Date(),
    private readonly generateCode: () => string = () =>
      randomInt(0, 1_000_000).toString().padStart(6, '0'),
  ) {}

  async requestRegistration(input: RegisterInput, ip: string) {
    if (await this.repository.authUserByEmail(input.email))
      throw new StoreError('EMAIL_TAKEN', 'An account with this e-mail already exists.', 409);
    const at = this.now();
    await this.ensureCanSend(input.email, 'registration', ip, at);
    await this.repository.savePendingRegistration({
      name: input.name,
      email: input.email,
      passwordHash: await hash(input.password),
      expiresAt: new Date(at.getTime() + PENDING_TTL_MS),
    });
    await this.issueCode(input.email, 'registration', ip, undefined, at);
  }

  async resendRegistration(email: string, ip: string) {
    const pending = await this.repository.pendingRegistration(email);
    const at = this.now();
    if (!pending || pending.expiresAt <= at)
      throw new StoreError('REGISTRATION_NOT_FOUND', 'Start registration again.', 404);
    await this.ensureCanSend(email, 'registration', ip, at);
    await this.issueCode(email, 'registration', ip, undefined, at);
  }

  async verifyRegistration(email: string, code: string) {
    const challenge = await this.verifyChallenge(email, 'registration', code);
    const pending = await this.repository.pendingRegistration(email);
    if (!pending || pending.expiresAt <= this.now()) throw this.invalidCode();
    if (!(await this.repository.consumeChallenge(challenge.id, this.now())))
      throw this.invalidCode();
    const session = this.newSession();
    const user = await this.repository.activateRegistration(email, session);
    return { user, token: session.token };
  }

  async requestPasswordReset(email: string, ip: string) {
    const at = this.now();
    await this.ensureCanSend(email, 'password_reset', ip, at);
    const user = await this.repository.authUserByEmail(email);
    await this.issueCode(email, 'password_reset', ip, user?.id, at, Boolean(user));
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.repository.authUserByEmail(email);
    if (!user) throw this.invalidCode();
    const challenge = await this.verifyChallenge(email, 'password_reset', code);
    if (await verify(user.passwordHash, newPassword))
      throw new StoreError('PASSWORD_REUSED', 'Choose a password you have not just used.', 400);
    if (!(await this.repository.consumeChallenge(challenge.id, this.now())))
      throw this.invalidCode();
    await this.repository.replacePassword(user.id, await hash(newPassword));
    await this.notifyPasswordChanged(email, 'reset');
  }

  async requestPasswordChange(userId: string, currentPassword: string, ip: string) {
    const user = await this.requireCurrentPassword(userId, currentPassword);
    const at = this.now();
    await this.ensureCanSend(user.email, 'password_change', ip, at);
    await this.issueCode(user.email, 'password_change', ip, user.id, at);
  }

  async confirmPasswordChange(
    userId: string,
    currentPassword: string,
    newPassword: string,
    code: string,
  ) {
    const user = await this.requireCurrentPassword(userId, currentPassword);
    if (await verify(user.passwordHash, newPassword))
      throw new StoreError('PASSWORD_REUSED', 'Choose a different password.', 400);
    const challenge = await this.verifyChallenge(user.email, 'password_change', code);
    if (
      challenge.userId !== user.id ||
      !(await this.repository.consumeChallenge(challenge.id, this.now()))
    )
      throw this.invalidCode();
    const session = this.newSession();
    await this.repository.replacePassword(user.id, await hash(newPassword), session);
    await this.notifyPasswordChanged(user.email, 'change');
    return { token: session.token };
  }

  private async requireCurrentPassword(userId: string, password: string) {
    const user = await this.repository.authUserById(userId);
    if (!user || !(await verify(user.passwordHash, password)))
      throw new StoreError('INVALID_CURRENT_PASSWORD', 'The current password is incorrect.', 401);
    return user;
  }

  private async ensureCanSend(email: string, purpose: AuthEmailPurpose, ip: string, at: Date) {
    const ipHash = this.digest(`ip:${ip}`);
    const latest = await this.repository.latestChallenge(email, purpose);
    if (latest && at.getTime() - latest.sentAt.getTime() < 60_000)
      throw new StoreError('CODE_RATE_LIMITED', 'Wait before requesting another code.', 429);
    const counts = await this.repository.challengeCounts(
      email,
      purpose,
      ipHash,
      new Date(at.getTime() - SEND_WINDOW_MS),
    );
    if (counts.target >= 5 || counts.ip >= 20)
      throw new StoreError('CODE_RATE_LIMITED', 'Too many code requests. Try again later.', 429);
  }

  private async issueCode(
    email: string,
    purpose: AuthEmailPurpose,
    ip: string,
    userId: string | undefined,
    at: Date,
    deliver = true,
  ) {
    const code = this.generateCode();
    await this.repository.invalidateChallenges(email, purpose, at);
    const challenge: AuthChallenge = {
      id: randomUUID(),
      purpose,
      email,
      ...(userId ? { userId } : {}),
      codeHash: this.digest(`code:${purpose}:${email}:${code}`),
      requestIpHash: this.digest(`ip:${ip}`),
      attempts: 0,
      expiresAt: new Date(at.getTime() + CODE_TTL_MS),
      sentAt: at,
    };
    await this.repository.createChallenge(challenge);
    if (!deliver) return;
    try {
      await this.mailer.sendCode({ to: email, purpose, code, expiresInMinutes: 10 });
    } catch (error) {
      const deliveryError = error as {
        code?: number;
        message?: string;
        response?: { body?: unknown; statusCode?: number };
      };
      console.error(
        JSON.stringify({
          event: 'verification_email_delivery_failed',
          message: deliveryError.message ?? 'Unknown email delivery error',
          statusCode: deliveryError.response?.statusCode ?? deliveryError.code,
          response: deliveryError.response?.body,
        }),
      );
      await this.repository.deleteChallenge(challenge.id);
      const providerOutcome = (deliveryError.response?.body as { outcome?: string } | undefined)
        ?.outcome;
      const deliveryMessage =
        providerOutcome === 'api_key_suspended'
          ? "Your details are valid, but this site's email provider has suspended its API key. Please use the demo account or contact the site owner."
          : deliveryError.response?.statusCode === 401 || deliveryError.response?.statusCode === 403
            ? "Your details are valid, but this site's email service credentials were rejected. Please use the demo account or contact the site owner."
            : deliveryError.response?.statusCode === 429
              ? 'Your details are valid, but the email service is temporarily rate-limited. Please try again later.'
              : 'Your details are valid, but the email service is temporarily unavailable. Please try again later.';
      throw new StoreError('EMAIL_DELIVERY_FAILED', deliveryMessage, 503);
    }
  }

  private async verifyChallenge(email: string, purpose: AuthEmailPurpose, code: string) {
    const challenge = await this.repository.latestChallenge(email, purpose);
    const at = this.now();
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= at || challenge.attempts >= 5)
      throw this.invalidCode();
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(this.digest(`code:${purpose}:${email}:${code}`), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.repository.failChallenge(challenge.id);
      throw this.invalidCode();
    }
    return challenge;
  }

  private digest(value: string) {
    return createHmac('sha256', this.pepper).update(value).digest('hex');
  }
  private async notifyPasswordChanged(to: string, kind: 'reset' | 'change') {
    try {
      await this.mailer.sendPasswordChanged({ to, kind });
    } catch (error) {
      console.error(`Password ${kind} notification could not be sent`, error);
    }
  }
  private invalidCode() {
    return new StoreError('INVALID_OR_EXPIRED_CODE', 'The code is invalid or expired.', 400);
  }
  private newSession(): SessionRecord {
    const token = randomBytes(32).toString('base64url');
    return {
      id: randomUUID(),
      token,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(this.now().getTime() + 30 * 86_400_000),
    };
  }
}
