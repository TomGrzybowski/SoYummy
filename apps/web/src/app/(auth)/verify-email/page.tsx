import { EmailVerificationForm } from '@/components/email-verification-form';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = '' } = await searchParams;
  return <EmailVerificationForm email={email} />;
}
