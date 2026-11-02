"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { IMPORT_MAX_ROWS, STAGE_VALUES } from "@/lib/leads";
import { formatPhone, normalizePhone } from "@/lib/phone";

export type LeadFormState = { error?: string } | undefined;

const text = (max: number, msg: string) => z.string().trim().max(max, msg).transform((v) => v || null);

const schema = z.object({
  name: text(160, "Name is too long (max 160 characters)."),
  phone: z.string().transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 98765 43210 or +44 7700 900123." });
    return p ?? "";
  }),
  city: text(80, "City is too long (max 80 characters)."),
  stage: z.enum(STAGE_VALUES),
  interestedItemId: z.string().transform((v) => v || null),
  dealValue: z
    .string()
    .transform((v) => v.replace(/[₹,\s]/g, ""))
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), "Deal value must be a positive amount in rupees."),
  assignedUserId: z.string().transform((v) => v || null),
  isDnd: z.boolean(),
  notes: text(5000, "Notes are too long (max 5,000 characters)."),
});

export async function saveLead(leadId: string | null, _prev: LeadFormState, form: FormData): Promise<LeadFormState> {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const s = (k: string) => String(form.get(k) ?? "");
  const parsed = schema.safeParse({
    name: s("name"), phone: s("phone"), city: s("city"), stage: s("stage"), interestedItemId: s("interestedItemId"),
    dealValue: s("dealValue"), assignedUserId: s("assignedUserId"), isDnd: form.get("isDnd") === "on", notes: s("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Linked records must belong to this workspace.
  if (data.interestedItemId && !(await db.catalogItem.findFirst({ where: { id: data.interestedItemId, workspaceId }, select: { id: true } })))
    return { error: "That service or product no longer exists. Reload and try again." };
  if (data.assignedUserId && !(await db.user.findFirst({ where: { id: data.assignedUserId, workspaceId, isActive: true }, select: { id: true } })))
    return { error: "That team member is not in your workspace." };
  if (leadId && !(await db.lead.findFirst({ where: { id: leadId, workspaceId }, select: { id: true } })))
    return { error: "This lead no longer exists." };

  let id = leadId;
  try {
    if (leadId) await db.lead.update({ where: { id: leadId }, data });
    else id = (await db.lead.create({ data: { ...data, workspaceId } })).id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const other = await db.lead.findFirst({ where: { workspaceId, phone: data.phone }, select: { name: true } });
      return { error: `${formatPhone(data.phone)} is already saved${other?.name ? ` as ${other.name}` : ""}. Search for it instead of adding it again.` };
    }
    throw e;
  }

  revalidatePath("/leads");
  redirect(`/leads/${id}?saved=1`);
}

export async function setLeadStage(leadId: string, stage: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = z.enum(STAGE_VALUES).safeParse(stage);
  if (!parsed.success) return { error: "Unknown stage." };
  const res = await db.lead.updateMany({ where: { id: leadId, workspaceId: user.workspaceId }, data: { stage: parsed.data } });
  if (res.count === 0) return { error: "This lead no longer exists." };
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function deleteLead(leadId: string): Promise<{ error?: string }> {
  const user = await requireRole("OWNER", "ADMIN");
  const res = await db.lead.deleteMany({ where: { id: leadId, workspaceId: user.workspaceId } });
  if (res.count === 0) return { error: "This lead no longer exists." };
  revalidatePath("/leads");
  return {};
}

export async function deleteLeadAndReturn(leadId: string): Promise<{ error?: string }> {
  const res = await deleteLead(leadId);
  if (res.error) return res;
  redirect("/leads?deleted=1");
}

// ---------- Import ----------

const rowSchema = z.object({
  phone: z.string().max(40),
  name: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  fields: z.record(z.string().max(60), z.string().max(500)).optional(),
});

export type ImportResult = { error?: string; since?: string; created?: number; skippedExisting?: number; skippedInvalid?: number; skippedDuplicateInFile?: number };

export async function importLeads(rows: unknown): Promise<ImportResult> {
  const user = await requireRole("OWNER", "ADMIN");
  const workspaceId = user.workspaceId;
  const parsed = z.array(rowSchema).max(IMPORT_MAX_ROWS, `A file can have at most ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows.`).safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let skippedInvalid = 0;
  let skippedDuplicateInFile = 0;
  const byPhone = new Map<string, Prisma.LeadCreateManyInput>();
  for (const r of parsed.data) {
    const phone = normalizePhone(r.phone);
    if (!phone) { skippedInvalid++; continue; }
    if (byPhone.has(phone)) { skippedDuplicateInFile++; continue; }
    const fields = r.fields && Object.keys(r.fields).length ? Object.fromEntries(Object.entries(r.fields).slice(0, 30)) : undefined;
    byPhone.set(phone, { workspaceId, phone, name: r.name?.trim() || null, city: r.city?.trim() || null, fields });
  }
  if (byPhone.size === 0) return { error: "No valid phone numbers found in the file.", skippedInvalid, skippedDuplicateInFile };

  const phones = [...byPhone.keys()];
  const existing = new Set<string>();
  for (let i = 0; i < phones.length; i += 1000) {
    const found = await db.lead.findMany({ where: { workspaceId, phone: { in: phones.slice(i, i + 1000) } }, select: { phone: true } });
    found.forEach((f) => existing.add(f.phone));
  }
  const toCreate = phones.filter((p) => !existing.has(p)).map((p) => byPhone.get(p)!);
  const since = new Date(Date.now() - 1000); // lets "start a campaign with these leads" find this import
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 1000) {
    // skipDuplicates also covers a lead added by someone else at the same moment.
    created += (await db.lead.createMany({ data: toCreate.slice(i, i + 1000), skipDuplicates: true })).count;
  }

  revalidatePath("/leads");
  return { since: since.toISOString(), created, skippedExisting: phones.length - created, skippedInvalid, skippedDuplicateInFile };
}
