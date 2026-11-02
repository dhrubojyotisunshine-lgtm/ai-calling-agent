"use server";

import { Prisma, type LeadStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CAMPAIGN_MAX_LEADS, CAMPAIGN_STATUSES, CAN_CANCEL, CAN_DELETE, CAN_EDIT, CAN_PAUSE, CAN_START,
  MAX_RETRIES, RETRY_GAPS, TIME_RE, parseIstLocal, type CampaignStatusKey,
} from "@/lib/campaigns";
import { STAGE_VALUES } from "@/lib/leads";

export type CampaignFormState = { error?: string } | undefined;

// ---------- Who gets called ----------

export type Audience = { stages: string[]; city: string; ownerId: string; addedSince: string; skipDnd: boolean; skipBusy: boolean };

const audienceSchema = z.object({
  stages: z.array(z.enum(STAGE_VALUES)).min(1, "Pick at least one lead stage to call."),
  city: z.string().trim().max(80),
  ownerId: z.string().max(40),
  addedSince: z.string().max(40),
  skipDnd: z.boolean(),
  skipBusy: z.boolean(),
});

// A lead is "busy" if another live campaign still has to call it.
const busyWhere: Prisma.LeadWhereInput = {
  campaignLeads: { some: { status: { in: ["PENDING", "CALLING"] }, campaign: { status: { in: ["SCHEDULED", "RUNNING", "PAUSED"] } } } },
};

function audienceWhere(workspaceId: string, a: z.infer<typeof audienceSchema>) {
  const base: Prisma.LeadWhereInput = { workspaceId, stage: { in: a.stages as LeadStage[] } };
  if (a.city) base.city = { contains: a.city };
  if (a.ownerId === "none") base.assignedUserId = null;
  else if (a.ownerId) base.assignedUserId = a.ownerId;
  const since = a.addedSince ? new Date(a.addedSince) : null;
  if (since && !Number.isNaN(since.getTime())) base.createdAt = { gte: since };

  const final: Prisma.LeadWhereInput = { AND: [base, ...(a.skipDnd ? [{ isDnd: false }] : []), ...(a.skipBusy ? [{ NOT: busyWhere }] : [])] };
  return { base, final };
}

export type AudienceCount = { error?: string; matched?: number; dnd?: number; busy?: number; eligible?: number };

export async function previewAudience(input: Audience): Promise<AudienceCount> {
  const user = await requireRole("OWNER", "ADMIN");
  const parsed = audienceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { base, final } = audienceWhere(user.workspaceId, parsed.data);
  const [matched, dnd, busy, eligible] = await Promise.all([
    db.lead.count({ where: base }),
    db.lead.count({ where: { AND: [base, { isDnd: true }] } }),
    db.lead.count({ where: { AND: [base, busyWhere] } }),
    db.lead.count({ where: final }),
  ]);
  return { matched, dnd, busy, eligible };
}

// ---------- Create / edit ----------

const settingsSchema = z
  .object({
    name: z.string().trim().min(1, "Give the campaign a name.").max(160, "Name is too long (max 160 characters)."),
    agentId: z.string().min(1, "Pick the agent who will make the calls."),
    startAt: z.string().max(20),
    callWindowFrom: z.string().regex(TIME_RE, "Enter calling hours as HH:MM, e.g. 10:00."),
    callWindowTo: z.string().regex(TIME_RE, "Enter calling hours as HH:MM, e.g. 19:00."),
    maxConcurrent: z.coerce.number().int().min(1, "Calls at once must be at least 1.").max(10, "At most 10 calls at once."),
    retryCount: z.coerce.number().int().min(0).max(MAX_RETRIES, `At most ${MAX_RETRIES} retries.`),
    retryGapMinutes: z.coerce.number().int().refine((v) => RETRY_GAPS.some((g) => g.value === v), "Pick a retry gap from the list."),
    skipDnd: z.boolean(),
  })
  .refine((v) => v.callWindowFrom < v.callWindowTo, { message: "Calling hours must end after they start." });

function readSettings(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "");
  return settingsSchema.safeParse({
    name: s("name"), agentId: s("agentId"), startAt: s("startAt"), callWindowFrom: s("callWindowFrom"), callWindowTo: s("callWindowTo"),
    maxConcurrent: s("maxConcurrent"), retryCount: s("retryCount"), retryGapMinutes: s("retryGapMinutes"), skipDnd: form.get("skipDnd") === "on",
  });
}

async function checkAgent(workspaceId: string, agentId: string, maxConcurrent: number, mustBeActive: boolean) {
  const agent = await db.agent.findFirst({ where: { id: agentId, workspaceId }, select: { name: true, status: true, purpose: true, maxConcurrentCalls: true } });
  if (!agent) return "That agent no longer exists. Reload and pick another.";
  if (agent.purpose === "INBOUND") return `${agent.name} only answers incoming calls. Pick an outbound agent, or change it on the agent page.`;
  if (maxConcurrent > agent.maxConcurrentCalls)
    return `${agent.name} can handle ${agent.maxConcurrentCalls} call${agent.maxConcurrentCalls > 1 ? "s" : ""} at once. Lower "Calls at once" or raise it on the agent page.`;
  if (mustBeActive && agent.status !== "ACTIVE") return `${agent.name} is paused. Turn the agent on before starting the campaign.`;
  return null;
}

async function checkWallet(workspaceId: string) {
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { walletBalance: true } });
  return Number(ws.walletBalance) > 0 ? null : "Your wallet is empty. Add funds on the Billing page before starting a campaign.";
}

function nameTaken(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createCampaign(_prev: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  const user = await requireRole("OWNER", "ADMIN");
  const workspaceId = user.workspaceId;
  const settings = readSettings(form);
  if (!settings.success) return { error: settings.error.issues[0].message };
  const v = settings.data;
  const schedule = form.get("intent") === "schedule";

  const audience = audienceSchema.safeParse({
    stages: form.getAll("stages").map(String), city: String(form.get("city") ?? ""), ownerId: String(form.get("ownerId") ?? ""),
    addedSince: String(form.get("addedSince") ?? ""), skipDnd: v.skipDnd, skipBusy: form.get("skipBusy") === "on",
  });
  if (!audience.success) return { error: audience.error.issues[0].message };

  let startAt: Date | null = null;
  if (v.startAt) {
    startAt = parseIstLocal(v.startAt);
    if (!startAt) return { error: "Enter a valid start date and time." };
    if (startAt.getTime() < Date.now() - 5 * 60_000) return { error: "The start time is in the past. Leave it empty to start right away." };
  }

  const agentError = await checkAgent(workspaceId, v.agentId, v.maxConcurrent, schedule);
  if (agentError) return { error: agentError };
  if (schedule) {
    const walletError = await checkWallet(workspaceId);
    if (walletError) return { error: walletError };
  }

  const { final } = audienceWhere(workspaceId, audience.data);
  const count = await db.lead.count({ where: final });
  if (count === 0) return { error: "No leads match these filters, so there is nobody to call. Change the filters and try again." };
  if (count > CAMPAIGN_MAX_LEADS)
    return { error: `${count.toLocaleString("en-IN")} leads match. A campaign can call at most ${CAMPAIGN_MAX_LEADS.toLocaleString("en-IN")}; narrow the filters or split it into two campaigns.` };

  let id: string;
  try {
    id = await db.$transaction(
      async (tx) => {
        const c = await tx.campaign.create({
          data: {
            workspaceId, agentId: v.agentId, name: v.name, status: schedule ? "SCHEDULED" : "DRAFT",
            startAt: schedule ? (startAt ?? new Date()) : startAt, callWindowFrom: v.callWindowFrom, callWindowTo: v.callWindowTo,
            maxConcurrent: v.maxConcurrent, retryCount: v.retryCount, retryGapMinutes: v.retryGapMinutes, skipDnd: v.skipDnd,
          },
        });
        const leads = await tx.lead.findMany({ where: final, select: { id: true }, orderBy: { createdAt: "asc" }, take: CAMPAIGN_MAX_LEADS });
        for (let i = 0; i < leads.length; i += 1000)
          await tx.campaignLead.createMany({ data: leads.slice(i, i + 1000).map((l) => ({ campaignId: c.id, leadId: l.id })) });
        return c.id;
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (nameTaken(e)) return { error: `You already have a campaign called “${v.name}”. Pick another name.` };
    throw e;
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${id}?saved=${schedule ? "scheduled" : "draft"}`);
}

export async function updateCampaign(campaignId: string, _prev: CampaignFormState, form: FormData): Promise<CampaignFormState> {
  const user = await requireRole("OWNER", "ADMIN");
  const workspaceId = user.workspaceId;
  const settings = readSettings(form);
  if (!settings.success) return { error: settings.error.issues[0].message };
  const v = settings.data;

  const current = await db.campaign.findFirst({ where: { id: campaignId, workspaceId }, select: { status: true, startAt: true } });
  if (!current) return { error: "This campaign no longer exists." };
  if (!CAN_EDIT.includes(current.status)) return { error: `This campaign is ${CAMPAIGN_STATUSES[current.status].label.toLowerCase()} and can't be changed.` };

  let startAt: Date | null = null;
  if (v.startAt) {
    startAt = parseIstLocal(v.startAt);
    if (!startAt) return { error: "Enter a valid start date and time." };
    const changed = startAt.getTime() !== current.startAt?.getTime();
    if (changed && startAt.getTime() < Date.now() - 5 * 60_000) return { error: "The start time is in the past. Leave it empty to start right away." };
  }
  if (current.status === "SCHEDULED" && !startAt) startAt = new Date();

  const agentError = await checkAgent(workspaceId, v.agentId, v.maxConcurrent, current.status === "SCHEDULED");
  if (agentError) return { error: agentError };

  try {
    // Status in the filter: if the campaign started running meanwhile, nothing is changed.
    const res = await db.campaign.updateMany({
      where: { id: campaignId, workspaceId, status: { in: CAN_EDIT } },
      data: {
        name: v.name, agentId: v.agentId, startAt, callWindowFrom: v.callWindowFrom, callWindowTo: v.callWindowTo,
        maxConcurrent: v.maxConcurrent, retryCount: v.retryCount, retryGapMinutes: v.retryGapMinutes, skipDnd: v.skipDnd,
      },
    });
    if (res.count === 0) return { error: "This campaign started or changed while you were editing. Reload to see it." };
  } catch (e) {
    if (nameTaken(e)) return { error: `You already have a campaign called “${v.name}”. Pick another name.` };
    throw e;
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaignId}?saved=1`);
}

// ---------- Start / pause / cancel / delete ----------

type Result = { error?: string };

async function load(workspaceId: string, id: string) {
  return db.campaign.findFirst({ where: { id, workspaceId }, select: { status: true, startAt: true, agentId: true, maxConcurrent: true } });
}
const wrongStatus = (s: CampaignStatusKey, what: string) => ({ error: `This campaign is ${CAMPAIGN_STATUSES[s].label.toLowerCase()}, so it can't be ${what}. Reload to see the latest.` });
const refresh = (id: string) => { revalidatePath("/campaigns"); revalidatePath(`/campaigns/${id}`); revalidatePath("/"); };

export async function startCampaign(id: string): Promise<Result> {
  const user = await requireRole("OWNER", "ADMIN");
  const ws = user.workspaceId;
  const c = await load(ws, id);
  if (!c) return { error: "This campaign no longer exists." };
  if (!CAN_START.includes(c.status)) return wrongStatus(c.status, "started");
  const agentError = await checkAgent(ws, c.agentId, c.maxConcurrent, true);
  if (agentError) return { error: agentError };
  if ((await db.campaignLead.count({ where: { campaignId: id, status: "PENDING" } })) === 0)
    return { error: "Everyone in this campaign has already been called. Create a new campaign to call them again." };
  const walletError = await checkWallet(ws);
  if (walletError) return { error: walletError };

  const startAt = c.startAt && c.startAt.getTime() > Date.now() ? c.startAt : new Date();
  const res = await db.campaign.updateMany({ where: { id, workspaceId: ws, status: { in: CAN_START } }, data: { status: "SCHEDULED", startAt } });
  if (res.count === 0) return { error: "This campaign changed meanwhile. Reload to see the latest." };
  refresh(id);
  return {};
}

export async function pauseCampaign(id: string): Promise<Result> {
  const user = await requireRole("OWNER", "ADMIN");
  const c = await load(user.workspaceId, id);
  if (!c) return { error: "This campaign no longer exists." };
  if (!CAN_PAUSE.includes(c.status)) return wrongStatus(c.status, "paused");
  const res = await db.campaign.updateMany({ where: { id, workspaceId: user.workspaceId, status: { in: CAN_PAUSE } }, data: { status: "PAUSED" } });
  if (res.count === 0) return { error: "This campaign changed meanwhile. Reload to see the latest." };
  refresh(id);
  return {};
}

export async function cancelCampaign(id: string): Promise<Result> {
  const user = await requireRole("OWNER", "ADMIN");
  const c = await load(user.workspaceId, id);
  if (!c) return { error: "This campaign no longer exists." };
  if (!CAN_CANCEL.includes(c.status)) return wrongStatus(c.status, "cancelled");
  const done = await db.$transaction(async (tx) => {
    const res = await tx.campaign.updateMany({ where: { id, workspaceId: user.workspaceId, status: { in: CAN_CANCEL } }, data: { status: "CANCELLED", completedAt: new Date() } });
    if (res.count === 0) return false;
    // Calls already in progress finish normally; nobody new is called.
    await tx.campaignLead.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "SKIPPED", lastError: "Campaign cancelled" } });
    return true;
  });
  if (!done) return { error: "This campaign changed meanwhile. Reload to see the latest." };
  refresh(id);
  return {};
}

export async function deleteCampaign(id: string): Promise<Result> {
  const user = await requireRole("OWNER", "ADMIN");
  const c = await load(user.workspaceId, id);
  if (!c) return { error: "This campaign no longer exists." };
  if (!CAN_DELETE.includes(c.status)) return { error: "Cancel the campaign before deleting it." };
  // Call records stay in Call history; they just lose the link to this campaign.
  const res = await db.campaign.deleteMany({ where: { id, workspaceId: user.workspaceId, status: { in: CAN_DELETE } } });
  if (res.count === 0) return { error: "This campaign changed meanwhile. Reload to see the latest." };
  revalidatePath("/campaigns");
  revalidatePath("/");
  return {};
}

export async function deleteCampaignAndReturn(id: string): Promise<Result> {
  const res = await deleteCampaign(id);
  if (res.error) return res;
  redirect("/campaigns?deleted=1");
}
