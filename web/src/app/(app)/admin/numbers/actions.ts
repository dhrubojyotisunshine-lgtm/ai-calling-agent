"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHANNELS_MAX, normalizeDid } from "@/lib/numbers";
import { formatPhone } from "@/lib/phone";

export type AdminState = { error?: string; ok?: string } | undefined;

const refresh = () => { revalidatePath("/admin/numbers"); revalidatePath("/phone-numbers"); revalidatePath("/agents"); };

const addSchema = z.object({
  e164: z.string().transform((v, ctx) => {
    const n = normalizeDid(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid number, e.g. +91 80 4567 8901 or 1800 123 4567." });
    return n ?? "";
  }),
  channels: z.coerce.number().int().min(1, "Lines must be at least 1.").max(CHANNELS_MAX, `At most ${CHANNELS_MAX} lines.`),
  monthlyRent: z.string().transform((v) => Number(v.replace(/[₹,\s]/g, "") || "0"))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100000, "Rent must be between ₹0 and ₹1,00,000."),
  sipTrunkId: z.string().trim().max(120, "Trunk id is too long.").transform((v) => v || null),
});

export async function addPoolNumber(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePlatformAdmin();
  const s = (k: string) => String(form.get(k) ?? "");
  const parsed = addSchema.safeParse({ e164: s("e164"), channels: s("channels"), monthlyRent: s("monthlyRent"), sipTrunkId: s("sipTrunkId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.phoneNumber.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: `${formatPhone(parsed.data.e164)} is already in the system.` };
    throw e;
  }
  refresh();
  return { ok: `${formatPhone(parsed.data.e164)} added to the pool.` };
}

export async function assignNumber(numberId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePlatformAdmin();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const renews = String(form.get("renewsOn") ?? "");
  if (!workspaceId) return { error: "Pick the company." };
  if (!(await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } }))) return { error: "That company no longer exists." };
  let renewsOn: Date | null = null;
  if (renews) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(renews)) return { error: "Enter a valid renewal date." };
    renewsOn = new Date(`${renews}T00:00:00+05:30`);
  }
  // Only from the pool: a number in use must be taken back first.
  const res = await db.phoneNumber.updateMany({ where: { id: numberId, workspaceId: null }, data: { workspaceId, renewsOn } });
  if (res.count === 0) return { error: "This number is no longer in the pool. Reload to see who has it." };
  refresh();
  return { ok: "Assigned." };
}

export async function unassignNumber(numberId: string): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const n = await db.phoneNumber.findUnique({ where: { id: numberId }, select: { workspaceId: true } });
  if (!n?.workspaceId) return { error: "This number is already in the pool." };
  await db.$transaction([
    // Agents of the old company stop using it.
    db.agent.updateMany({ where: { phoneNumberId: numberId }, data: { phoneNumberId: null } }),
    db.phoneNumber.update({ where: { id: numberId }, data: { workspaceId: null, renewsOn: null } }),
  ]);
  refresh();
  return {};
}

export async function deletePoolNumber(numberId: string): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const res = await db.phoneNumber.deleteMany({ where: { id: numberId, workspaceId: null } });
  if (res.count === 0) return { error: "Take the number back from the company before deleting it." };
  refresh();
  return {};
}
