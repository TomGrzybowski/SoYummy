import { AuthForm } from '@/components/auth-form';
export const metadata = { title: 'Registration' };
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
