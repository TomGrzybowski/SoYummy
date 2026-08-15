'use client';

import { useState } from 'react';
import { apiClient } from '@so-yummy/api-client';

export function PasswordChangeForm() {
  const [credentials, setCredentials] = useState<{
    currentPassword: string;
    newPassword: string;
  }>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function requestCode(formData: FormData) {
    const currentPassword = String(formData.get('currentPassword'));
    const newPassword = String(formData.get('newPassword'));
    if (newPassword !== formData.get('confirmPassword')) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      await apiClient.post('/auth/password/change/request', { currentPassword });
      setCredentials({ currentPassword, newPassword });
      setMessage('A verification code was sent to your email.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function confirmChange(formData: FormData) {
    if (!credentials) return;
    setPending(true);
    setError('');
    try {
      await apiClient.post('/auth/password/change/confirm', {
        ...credentials,
        code: formData.get('code'),
      });
      setCredentials(undefined);
      setMessage('Your password has been changed. Other sessions were signed out.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="securityCard">
      <h1>Account security</h1>
      {!credentials ? (
        <form className="securityForm" action={requestCode}>
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <label>
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button disabled={pending}>{pending ? 'Please wait…' : 'Email verification code'}</button>
        </form>
      ) : (
        <form className="securityForm" action={confirmChange}>
          <p>Enter the six-digit code. It expires in 10 minutes.</p>
          <label>
            Verification code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          <button disabled={pending}>{pending ? 'Please wait…' : 'Change password'}</button>
          <button
            className="textButton"
            type="button"
            onClick={() => setCredentials(undefined)}
            disabled={pending}
          >
            Start over
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="formError">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="formSuccess">
          {message}
        </p>
      )}
    </section>
  );
}
