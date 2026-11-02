"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "./actions";

type Field = { name: string; label: string; type?: string; placeholder?: string; autoComplete?: string };

export function AuthForm(props: {
  title: string;
  subtitle: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  mode: "login" | "register";
}) {
  const [state, formAction, pending] = useActionState(props.action, undefined);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">{props.title}</h2>
        <p className="mt-1 text-sm text-muted">{props.subtitle}</p>
      </div>
      <div className="grid grid-cols-2 rounded-lg bg-paper p-1 text-sm font-semibold">
        <Link href="/login" className={`rounded-md py-2 text-center ${props.mode === "login" ? "bg-white shadow-sm" : "text-muted"}`}>Sign in</Link>
        <Link href="/register" className={`rounded-md py-2 text-center ${props.mode === "register" ? "bg-white shadow-sm" : "text-muted"}`}>Register</Link>
      </div>
      <form action={formAction} className="space-y-4" noValidate>
        {props.fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <label htmlFor={f.name} className="label">{f.label}</label>
            <input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              defaultValue={f.type === "password" ? undefined : state?.fields?.[f.name]}
              className="input"
              required
            />
          </div>
        ))}
        {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
          {pending ? "Please wait…" : props.submit}
        </button>
      </form>
      <p className="text-center text-xs text-muted">New accounts start with a ₹0 wallet. Recharge to place calls.</p>
    </div>
  );
}
