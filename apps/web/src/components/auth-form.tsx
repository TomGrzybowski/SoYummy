'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@so-yummy/api-client';

export function AuthForm({ mode }: { mode: 'signin' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    setError('');
    try {
      const payload = Object.fromEntries(formData);
      await apiClient.post(`/auth/${mode === 'signin' ? 'login' : 'register'}`, payload);
      router.push('/main');
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="authCard" action={submit}>
      <h1>{mode === 'signin' ? 'Sign In' : 'Registration'}</h1>
      {mode === 'register' && (
        <input aria-label="Name" name="name" placeholder="Name" minLength={2} required />
      )}
      <input aria-label="Email" name="email" type="email" placeholder="Email" required />
      <input
        aria-label="Password"
        name="password"
        type="password"
        placeholder="Password"
        minLength={8}
        required
      />
      {error && (
        <p role="alert" className="formError">
          {error}
        </p>
      )}
      <button disabled={pending}>
        {pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
      </button>
      <Link href={mode === 'signin' ? '/register' : '/signin'}>
        {mode === 'signin' ? 'Registration' : 'Sign in'}
      </Link>
    </form>
  );
}
