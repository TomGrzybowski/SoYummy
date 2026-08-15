import type { Metadata } from 'next';
import { PasswordChangeForm } from '@/components/password-change-form';

export const metadata: Metadata = { title: 'Account security' };

export default function AccountSecurityPage() {
  return (
    <main className="contentPage">
      <PasswordChangeForm />
    </main>
  );
}
