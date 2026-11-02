"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditWallet, TOPUP_MAX, TOPUP_MIN } from "@/lib/wallet";

export type BillingFormState = { error?: string; ok?: string } | undefined;

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter the amount in whole rupees, e.g. 500.")
  .transform(Number)
  .refine((n) => n >= TOPUP_MIN && n <= TOPUP_MAX, `Top-ups must be between ₹${TOPUP_MIN} and ₹${TOPUP_MAX.toLocaleString("en-IN")}.`);

// TEST MODE: adds funds without a payment. Replace with the payment gateway before going live.
export async function addFunds(_prev: BillingFormState, form: FormData): Promise<BillingFormState> {
  const user = await requireRole("OWNER", "ADMIN");
  const parsed = amountSchema.safeParse(String(form.get("amount") ?? "").replace(/[₹,\s]/g, ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await creditWallet(user.workspaceId, parsed.data, "TOPUP", `Test top-up by ${user.name}`);
  revalidatePath("/billing");
  revalidatePath("/");
  return { ok: `₹${parsed.data.toLocaleString("en-IN")} added to your wallet.` };
}

const alertSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter the alert level in whole rupees, e.g. 200.")
  .transform(Number)
  .refine((n) => n <= TOPUP_MAX, `The alert level can be at most ₹${TOPUP_MAX.toLocaleString("en-IN")}.`);

export async function setLowBalanceAlert(_prev: BillingFormState, form: FormData): Promise<BillingFormState> {
  const user = await requireRole("OWNER", "ADMIN");
  const parsed = alertSchema.safeParse(String(form.get("lowBalanceAt") ?? "").replace(/[₹,\s]/g, ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.workspace.update({ where: { id: user.workspaceId }, data: { lowBalanceAt: parsed.data } });
  revalidatePath("/billing");
  revalidatePath("/");
  return { ok: parsed.data === 0 ? "Low-balance warning turned off." : `You'll be warned when the balance drops below ₹${parsed.data.toLocaleString("en-IN")}.` };
}
