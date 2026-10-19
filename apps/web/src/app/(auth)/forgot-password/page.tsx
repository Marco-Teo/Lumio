import { AuthForm } from '../auth-form';
export default function Forgot() {
  return (
    <>
      <h1>Recupera password</h1>
      <AuthForm mode="forgot" />
    </>
  );
}
