import { AuthForm } from '../auth-form';
export default function TwoFactor() {
  return (
    <>
      <h1>Verifica accesso</h1>
      <AuthForm mode="two-factor" />
    </>
  );
}
