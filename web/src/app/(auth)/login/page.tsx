import { login } from "../actions";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthForm
      mode="login"
      title="Welcome back"
      subtitle="Sign in to your Voxura workspace."
      action={login}
      submit="Sign in"
      fields={[
        { name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", placeholder: "••••••••", autoComplete: "current-password" },
      ]}
    />
  );
}
