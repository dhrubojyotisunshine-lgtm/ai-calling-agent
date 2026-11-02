"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type ServiceFormState = { error?: string } | undefined;

const text = (max: number, msg?: string) => z.string().trim().max(max, msg).transform((v) => v || null);

const schema = z
  .object({
    type: z.enum(["SERVICE", "PRODUCT"]),
    name: z.string().trim().min(2, "Enter a name (at least 2 characters).").max(120, "Name is too long (max 120 characters)."),
    description: text(3000, "Description is too long (max 3,000 characters)."),
    priceText: text(120, "Price text is too long (max 120 characters)."),
    mayQuotePrice: z.boolean(),
    whenToOffer: text(255, "\"When to offer\" is too long (max 255 characters)."),
    nextAction: text(255, "\"Next step\" is too long (max 255 characters)."),
    trialDays: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 365), "Free trial must be 0–365 days."),
    signupUrl: z
      .string()
      .trim()
      .transform((v) => v || null)
      .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "Sign-up link must start with http:// or https://")
      .refine((v) => v === null || v.length <= 500, "Sign-up link is too long."),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.description) ctx.addIssue({ code: "custom", message: "Write a short description. The agent uses it to explain the item." });
  });

function read(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "");
  return {
    type: s("type"), name: s("name"), description: s("description"), priceText: s("priceText"),
    mayQuotePrice: s("mayQuotePrice") === "yes", whenToOffer: s("whenToOffer"), nextAction: s("nextAction"),
    trialDays: s("trialDays"), signupUrl: s("signupUrl"), isActive: form.get("isActive") === "on",
  };
}

export async function saveService(itemId: string | null, _prev: ServiceFormState, form: FormData): Promise<ServiceFormState> {
  const user = await requireRole("OWNER", "ADMIN");
  const workspaceId = user.workspaceId;

  const parsed = schema.safeParse(read(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Trial and sign-up link only apply to products.
  const data = parsed.data.type === "PRODUCT" ? parsed.data : { ...parsed.data, trialDays: null, signupUrl: null };

  const agentIds = [...new Set(form.getAll("agents").map(String))];
  const owned = await db.agent.count({ where: { workspaceId, id: { in: agentIds } } });
  if (owned !== agentIds.length) return { error: "One of the selected agents no longer exists. Reload and try again." };
  if (itemId) {
    const existing = await db.catalogItem.findFirst({ where: { id: itemId, workspaceId }, select: { id: true } });
    if (!existing) return { error: "This item no longer exists." };
  }

  try {
    await db.$transaction(async (tx) => {
      const item = itemId
        ? await tx.catalogItem.update({ where: { id: itemId }, data })
        : await tx.catalogItem.create({ data: { ...data, workspaceId } });
      await tx.agentCatalogItem.deleteMany({ where: { catalogItemId: item.id } });
      if (agentIds.length) await tx.agentCatalogItem.createMany({ data: agentIds.map((agentId) => ({ agentId, catalogItemId: item.id })) });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: `You already have a service or product called "${data.name}". Choose another name.` };
    throw e;
  }

  revalidatePath("/services");
  revalidatePath("/agents");
  redirect("/services?saved=1");
}

export async function deleteService(itemId: string): Promise<{ error?: string }> {
  const user = await requireRole("OWNER", "ADMIN");
  const item = await db.catalogItem.findFirst({ where: { id: itemId, workspaceId: user.workspaceId }, select: { id: true } });
  if (!item) return { error: "This item no longer exists." };
  // Links to agents are removed automatically; leads that showed interest keep their record without the link.
  await db.catalogItem.delete({ where: { id: item.id } });
  revalidatePath("/services");
  revalidatePath("/agents");
  return {};
}
