'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@so-yummy/api-client';

export function EmailVerificationForm({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function verifyCode(formData: FormData) {
    setPending(true);
    setError('');
    try {
      await apiClient.post('/auth/register/verify', { email, code: formData.get('code') });
      router.replace('/main');
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await apiClient.post('/auth/register/resend', { email });
      setMessage('A new code was sent.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!email) {
    return (
      <section className="authCard">
        <h1>Verify email</h1>
        <p>Start registration to receive a code.</p>
        <Link href="/register">Registration</Link>
      </section>
    );
  }
  return (
    <form className="authCard" action={verifyCode}>
      <h1>Verify email</h1>
      <p className="formHint">
        Enter the six-digit code sent to {email}. It expires in 10 minutes.
      </p>
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
      <button disabled={pending}>{pending ? 'Please wait…' : 'Verify account'}</button>
      <button className="textButton" type="button" onClick={resend} disabled={pending}>
        Resend code
      </button>
      <Link href="/register">Use a different email</Link>
    </form>
  );
}
