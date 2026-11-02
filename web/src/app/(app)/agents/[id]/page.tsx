import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveAgent } from "../actions";
import { AgentForm } from "../AgentForm";
import { agentFormOptions } from "../options";

export const metadata = { title: "Edit agent" };

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const agent = await db.agent.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { faqs: { orderBy: { position: "asc" } }, catalogItems: true },
  });
  if (!agent) notFound();
  const canEdit = user.role !== "STAFF";
  const opts = await agentFormOptions(user.workspaceId);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/agents" className="hover:underline">Agents</Link> / {agent.name}</p>
        <h1 className="text-2xl font-extrabold">{agent.name}</h1>
        <p className="text-sm text-muted">{canEdit ? "Changes apply from the next call." : "You can view this agent. Ask an owner or admin to change it."}</p>
      </header>
      <AgentForm
        action={saveAgent.bind(null, agent.id)}
        canEdit={canEdit}
        {...opts}
        initial={{
          name: agent.name, status: agent.status, mode: agent.mode, purpose: agent.purpose,
          phoneNumberId: agent.phoneNumberId ?? "", greeting: agent.greeting ?? "", systemPrompt: agent.systemPrompt ?? "",
          fallbackResponse: agent.fallbackResponse ?? "", noResponseTimeoutSec: agent.noResponseTimeoutSec,
          noResponseClosing: agent.noResponseClosing ?? "", announcementScript: agent.announcementScript ?? "",
          endAfterAnnouncement: agent.endAfterAnnouncement, knowledgeText: agent.knowledgeText ?? "",
          personality: agent.personality, language: agent.language,
          voiceGender: agent.voiceGender === "male" ? "male" : "female", voiceId: agent.voiceId ?? "priya",
          llmModel: agent.llmModel, sttProvider: agent.sttProvider, ttsProvider: agent.ttsProvider,
          memoryEnabled: agent.memoryEnabled, recordingEnabled: agent.recordingEnabled,
          maxConcurrentCalls: agent.maxConcurrentCalls,
          faqs: agent.faqs.map((f) => ({ question: f.question, answer: f.answer })),
          catalogIds: agent.catalogItems.map((c) => c.catalogItemId),
        }}
      />
    </div>
  );
}
