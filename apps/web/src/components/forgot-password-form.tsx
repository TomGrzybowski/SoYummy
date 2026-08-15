'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@so-yummy/api-client';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function requestCode(formData: FormData) {
    const value = String(formData.get('email'));
    setPending(true);
    setError('');
    try {
      await apiClient.post('/auth/password/forgot', { email: value });
      setEmail(value);
      setRequested(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(formData: FormData) {
    const newPassword = String(formData.get('newPassword'));
    if (newPassword !== formData.get('confirmPassword')) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await apiClient.post('/auth/password/reset', {
        email,
        code: formData.get('code'),
        newPassword,
      });
      router.replace('/signin?passwordReset=1');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!requested)
    return (
      <form className="authCard" action={requestCode}>
        <h1>Reset password</h1>
        <p className="formHint">
          We will send a verification code if an account exists for this email.
        </p>
        <input
          aria-label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          required
        />
        {error && (
          <p role="alert" className="formError">
            {error}
          </p>
        )}
        <button disabled={pending}>{pending ? 'Please wait…' : 'Send code'}</button>
        <Link href="/signin">Back to sign in</Link>
      </form>
    );
  return (
    <form className="authCard" action={resetPassword}>
      <h1>Choose a new password</h1>
      <p className="formHint">Enter the code sent to {email}.</p>
      <input
        aria-label="Verification code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="000000"
        required
      />
      <input
        aria-label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        placeholder="New password"
        required
      />
      <input
        aria-label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        placeholder="Confirm new password"
        required
      />
      {error && (
        <p role="alert" className="formError">
          {error}
        </p>
      )}
      <button disabled={pending}>{pending ? 'Please wait…' : 'Reset password'}</button>
      <button
        className="textButton"
        type="button"
        onClick={() => setRequested(false)}
        disabled={pending}
      >
        Request another code
      </button>
    </form>
  );
}
