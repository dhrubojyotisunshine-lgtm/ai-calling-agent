"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { LANGUAGES, LLM_MODELS, PERSONALITIES, STT_PROVIDERS, TTS_PROVIDERS, VOICES } from "@/lib/agent-options";

export type AgentFormState = { error?: string } | undefined;

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const schema = z
  .object({
    name: z.string().trim().min(2, "Give the agent a name (at least 2 characters).").max(120),
    status: z.enum(["ACTIVE", "PAUSED"]),
    mode: z.enum(["ASSISTANT", "ANNOUNCEMENT"]),
    purpose: z.enum(["OUTBOUND", "INBOUND", "BOTH"]),
    phoneNumberId: z.string().transform((v) => v || null),
    greeting: text(2000),
    systemPrompt: text(20000),
    fallbackResponse: text(1000),
    noResponseTimeoutSec: z.coerce.number().int().min(5, "No-response timeout must be 5–120 seconds.").max(120, "No-response timeout must be 5–120 seconds."),
    noResponseClosing: text(1000),
    announcementScript: text(5000),
    endAfterAnnouncement: z.boolean(),
    knowledgeText: text(200000),
    personality: z.enum(PERSONALITIES),
    language: z.enum(LANGUAGES.map((l) => l.value) as [string, ...string[]]),
    voiceGender: z.enum(["female", "male"]),
    voiceId: z.string(),
    llmModel: z.enum(LLM_MODELS.map((m) => m.model) as [string, ...string[]]),
    sttProvider: z.enum(STT_PROVIDERS.map((p) => p.value) as [string, ...string[]]),
    ttsProvider: z.enum(TTS_PROVIDERS.map((p) => p.value) as [string, ...string[]]),
    memoryEnabled: z.boolean(),
    recordingEnabled: z.boolean(),
    maxConcurrentCalls: z.coerce.number().int().min(1, "Max concurrent calls must be 1–20.").max(20, "Max concurrent calls must be 1–20."),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "ANNOUNCEMENT" && !v.announcementScript)
      ctx.addIssue({ code: "custom", message: "Announcement agents need the message to play." });
    if (v.mode === "ASSISTANT" && !v.greeting)
      ctx.addIssue({ code: "custom", message: "Write the greeting the agent says when the call connects." });
    if (!(VOICES[v.voiceGender] as readonly string[]).includes(v.voiceId))
      ctx.addIssue({ code: "custom", message: "Pick a voice." });
  });

function read(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "");
  return {
    name: s("name"), status: s("status"), mode: s("mode"), purpose: s("purpose"), phoneNumberId: s("phoneNumberId"),
    greeting: s("greeting"), systemPrompt: s("systemPrompt"), fallbackResponse: s("fallbackResponse"),
    noResponseTimeoutSec: s("noResponseTimeoutSec"), noResponseClosing: s("noResponseClosing"),
    announcementScript: s("announcementScript"), endAfterAnnouncement: form.get("endAfterAnnouncement") === "on",
    knowledgeText: s("knowledgeText"), personality: s("personality"), language: s("language"),
    voiceGender: s("voiceGender"), voiceId: s("voiceId"), llmModel: s("llmModel"),
    sttProvider: s("sttProvider"), ttsProvider: s("ttsProvider"),
    memoryEnabled: form.get("memoryEnabled") === "on", recordingEnabled: form.get("recordingEnabled") === "on",
    maxConcurrentCalls: s("maxConcurrentCalls"),
  };
}

function readFaqs(form: FormData) {
  const qs = form.getAll("faqQ").map(String);
  const as = form.getAll("faqA").map(String);
  return qs
    .map((q, i) => ({ question: q.trim(), answer: (as[i] ?? "").trim() }))
    .filter((f) => f.question || f.answer);
}

export async function saveAgent(agentId: string | null, _prev: AgentFormState, form: FormData): Promise<AgentFormState> {
  const user = await requireRole("OWNER", "ADMIN");
  const workspaceId = user.workspaceId;

  const parsed = schema.safeParse(read(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const faqs = readFaqs(form);
  if (faqs.some((f) => !f.question || !f.answer)) return { error: "Each FAQ needs both a question and an answer." };
  if (faqs.length > 200) return { error: "An agent can have at most 200 FAQs." };

  // Only allow ids that belong to this workspace.
  const catalogIds = [...new Set(form.getAll("catalog").map(String))];
  const ownedCatalog = await db.catalogItem.findMany({ where: { workspaceId, id: { in: catalogIds } }, select: { id: true } });
  if (ownedCatalog.length !== catalogIds.length) return { error: "One of the selected services is no longer available. Reload and try again." };
  if (data.phoneNumberId) {
    const owned = await db.phoneNumber.findFirst({ where: { id: data.phoneNumberId, workspaceId } });
    if (!owned) return { error: "That phone number isn't assigned to your workspace." };
    // Incoming calls on a number must go to exactly one agent.
    if (data.purpose !== "OUTBOUND") {
      const other = await db.agent.findFirst({
        where: { workspaceId, phoneNumberId: data.phoneNumberId, purpose: { in: ["INBOUND", "BOTH"] }, ...(agentId ? { id: { not: agentId } } : {}) },
        select: { name: true },
      });
      if (other) return { error: `${other.name} already answers incoming calls on ${formatPhone(owned.e164)}. A number can have only one answering agent; make this one outbound only, or pick another number.` };
    }
  }
  if (agentId) {
    const existing = await db.agent.findFirst({ where: { id: agentId, workspaceId }, select: { id: true } });
    if (!existing) return { error: "This agent no longer exists." };
  }

  const llmProvider = LLM_MODELS.find((m) => m.model === data.llmModel)!.provider;
  const fields = { ...data, llmProvider };

  try {
    await db.$transaction(async (tx) => {
      const agent = agentId
        ? await tx.agent.update({ where: { id: agentId }, data: fields })
        : await tx.agent.create({ data: { ...fields, workspaceId } });
      await tx.agentFaq.deleteMany({ where: { agentId: agent.id } });
      if (faqs.length) await tx.agentFaq.createMany({ data: faqs.map((f, i) => ({ ...f, agentId: agent.id, position: i })) });
      await tx.agentCatalogItem.deleteMany({ where: { agentId: agent.id } });
      if (catalogIds.length) await tx.agentCatalogItem.createMany({ data: catalogIds.map((catalogItemId) => ({ agentId: agent.id, catalogItemId })) });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: `You already have an agent called "${data.name}". Choose another name.` };
    throw e;
  }

  revalidatePath("/agents");
  redirect("/agents?saved=1");
}

export async function deleteAgent(agentId: string): Promise<{ error?: string }> {
  const user = await requireRole("OWNER", "ADMIN");
  const agent = await db.agent.findFirst({
    where: { id: agentId, workspaceId: user.workspaceId },
    select: { id: true, _count: { select: { campaigns: true } } },
  });
  if (!agent) return { error: "This agent no longer exists." };
  if (agent._count.campaigns > 0)
    return { error: "This agent is used by a campaign. Pause it instead, or delete those campaigns first." };
  // "No campaigns" is re-checked in the delete itself, so a campaign created meanwhile is never removed with the agent.
  const res = await db.agent.deleteMany({ where: { id: agent.id, workspaceId: user.workspaceId, campaigns: { none: {} } } });
  if (res.count === 0) return { error: "This agent is used by a campaign. Pause it instead, or delete those campaigns first." };
  revalidatePath("/agents");
  return {};
}
