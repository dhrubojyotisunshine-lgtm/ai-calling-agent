"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const registerSchema = z.object({
  company: z.string().trim().min(2, "Enter your company name.").max(120),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["company", "name", "email", "phone", "password"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = registerSchema.safeParse({ ...raw, phone: raw.phone.replace(/[\s-]/g, "") });
  const keep = { ...raw, password: "" };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: keep };

  const { company, name, email, phone, password } = parsed.data;
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { error: "An account with this email already exists. Sign in instead.", fields: keep };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: {
      name,
      email,
      phone: phone.startsWith("+91") ? phone : `+91${phone}`,
      passwordHash,
      role: "OWNER",
      workspace: { create: { name: company } },
    },
  });

  await createSession({ userId: user.id, workspaceId: user.workspaceId });
  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && user.isActive && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "Email or password is incorrect.", fields: { email } };

  await createSession({ userId: user.id, workspaceId: user.workspaceId });
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
