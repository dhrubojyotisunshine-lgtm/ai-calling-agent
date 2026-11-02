import { register } from "../actions";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Create workspace" };

export default function RegisterPage() {
  return (
    <AuthForm
      mode="register"
      title="Create your workspace"
      subtitle="Set up your company account in a minute."
      action={register}
      submit="Create workspace"
      fields={[
        { name: "company", label: "Company name", placeholder: "Brightlane Software", autoComplete: "organization" },
        { name: "name", label: "Your name", placeholder: "Anita Sharma", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" },
        { name: "phone", label: "Mobile", type: "tel", placeholder: "98765 43210", autoComplete: "tel" },
        { name: "password", label: "Password", type: "password", placeholder: "At least 8 characters", autoComplete: "new-password" },
      ]}
    />
  );
}
