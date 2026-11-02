"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parseIstLocal } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { TITLE_MAX, buckets } from "@/lib/followups";

export type FollowUpFormState = { error?: string } | undefined;

const schema = z.object({
  kind: z.enum(["AI_CALLBACK", "STAFF_TASK"], { message: "Choose who follows up." }),
  title: z.string().trim().min(1, "Write what the follow-up is about.").max(TITLE_MAX, `Keep it under ${TITLE_MAX} characters.`),
  dueAt: z.string().min(1, "Pick when it is due."),
  agentId: z.string().max(40),
  assignedUserId: z.string().max(40),
});

// Where to go after saving: only our own pages, never an outside link.
function safeBack(v: string, fallback: string) {
  return /^\/(follow-ups|leads\/[a-z0-9]+|calls\/[a-z0-9]+)$/.test(v) ? v : fallback;
}

const refresh = (leadId?: string) => {
  revalidatePath("/follow-ups");
  revalidatePath("/leads");
  revalidatePath("/");
  if (leadId) revalidatePath(`/leads/${leadId}`);
};

export async function saveFollowUp(
  target: { id: string } | { leadId: string; callId?: string },
  _prev: FollowUpFormState,
  form: FormData,
): Promise<FollowUpFormState> {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const s = (k: string) => String(form.get(k) ?? "");
  const parsed = schema.safeParse({ kind: s("kind"), title: s("title"), dueAt: s("dueAt"), agentId: s("agentId"), assignedUserId: s("assignedUserId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Agent callbacks spend wallet money, so only owners and admins can set them up or change them.
  const isManager = user.role !== "STAFF";
  if (v.kind === "AI_CALLBACK" && !isManager) return { error: "Only owners and admins can schedule an agent callback. Create a team task instead." };

  const existing = "id" in target
    ? await db.followUp.findFirst({ where: { id: target.id, workspaceId }, select: { id: true, leadId: true, kind: true, status: true, dueAt: true } })
    : null;
  if ("id" in target) {
    if (!existing) return { error: "This follow-up no longer exists." };
    if (existing.status !== "OPEN") return { error: "Only open follow-ups can be changed. Reopen it first." };
    if (existing.kind === "AI_CALLBACK" && !isManager) return { error: "Only owners and admins can change an agent callback." };
  }
  const leadId = existing ? existing.leadId : (target as { leadId: string }).leadId;
  const lead = await db.lead.findFirst({ where: { id: leadId, workspaceId }, select: { id: true, name: true, isDnd: true } });
  if (!lead) return { error: "This lead no longer exists." };

  const dueAt = parseIstLocal(v.dueAt);
  if (!dueAt) return { error: "Enter a valid date and time." };
  const changed = !existing || dueAt.getTime() !== existing.dueAt.getTime();
  if (changed && dueAt.getTime() < Date.now() - 5 * 60_000) return { error: "That time has already passed. Pick a time from now on." };

  let agentId: string | null = null;
  if (v.kind === "AI_CALLBACK") {
    if (lead.isDnd) return { error: `${lead.name ?? "This lead"} is marked Do not call. Create a team task instead, or remove DND on the lead first.` };
    if (!v.agentId) return { error: "Pick the agent who should call back." };
    const agent = await db.agent.findFirst({ where: { id: v.agentId, workspaceId }, select: { name: true, purpose: true } });
    if (!agent) return { error: "That agent no longer exists. Reload and pick another." };
    if (agent.purpose === "INBOUND") return { error: `${agent.name} only answers incoming calls. Pick an agent that makes outgoing calls.` };
    agentId = v.agentId;
  }
  const assignedUserId = v.assignedUserId || null;
  if (assignedUserId && !(await db.user.findFirst({ where: { id: assignedUserId, workspaceId, isActive: true }, select: { id: true } })))
    return { error: "That team member is not in your workspace." };

  const data = { kind: v.kind, title: v.title, dueAt, agentId, assignedUserId };
  if (existing) {
    const res = await db.followUp.updateMany({ where: { id: existing.id, workspaceId, status: "OPEN" }, data });
    if (res.count === 0) return { error: "This follow-up was closed meanwhile. Reload to see it." };
  } else {
    // A linked call must be this lead's call in this workspace; otherwise it's simply not linked.
    const callId = (target as { callId?: string }).callId;
    const call = callId ? await db.call.findFirst({ where: { id: callId, workspaceId, leadId }, select: { id: true } }) : null;
    await db.followUp.create({ data: { ...data, workspaceId, leadId, callId: call?.id ?? null } });
  }

  refresh(leadId);
  const back = safeBack(s("back"), "/follow-ups");
  if (back !== "/follow-ups") redirect(`${back}?followup=1`);
  // Open the tab the follow-up now sits in, so the user sees what they saved.
  const b = buckets();
  const tab = dueAt < b.today.dueAt.gte ? "overdue" : dueAt < b.today.dueAt.lt ? "today" : "upcoming";
  redirect(`/follow-ups?tab=${tab}&saved=1`);
}

const NEXT = { DONE: ["OPEN"], CANCELLED: ["OPEN"], OPEN: ["DONE", "CANCELLED"] } as const;

export async function setFollowUpStatus(id: string, status: "OPEN" | "DONE" | "CANCELLED"): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(status in NEXT)) return { error: "Unknown status." };
  const f = await db.followUp.findFirst({ where: { id, workspaceId: user.workspaceId }, select: { kind: true, leadId: true, status: true } });
  if (!f) return { error: "This follow-up no longer exists." };
  if (f.kind === "AI_CALLBACK" && user.role === "STAFF") return { error: "Only owners and admins can change an agent callback." };
  const res = await db.followUp.updateMany({
    where: { id, workspaceId: user.workspaceId, status: { in: [...NEXT[status]] } },
    data: { status, doneAt: status === "DONE" ? new Date() : null },
  });
  if (res.count === 0) return { error: "This follow-up changed meanwhile. Reload to see the latest." };
  refresh(f.leadId);
  return {};
}
