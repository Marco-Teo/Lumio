import { AuthForm } from '../auth-form';
export default function Reset() {
  return (
    <>
      <h1>Nuova password</h1>
      <AuthForm mode="reset" />
    </>
  );
}
