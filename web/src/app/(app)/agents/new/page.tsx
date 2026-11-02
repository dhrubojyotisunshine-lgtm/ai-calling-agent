import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { saveAgent } from "../actions";
import { AgentForm, type AgentValues } from "../AgentForm";
import { agentFormOptions } from "../options";

export const metadata = { title: "New agent" };

const DEFAULTS: AgentValues = {
  name: "", status: "ACTIVE", mode: "ASSISTANT", purpose: "OUTBOUND", phoneNumberId: "",
  greeting: "", systemPrompt: "", fallbackResponse: "", noResponseTimeoutSec: 30, noResponseClosing: "",
  announcementScript: "", endAfterAnnouncement: true, knowledgeText: "", personality: "friendly",
  language: "hi-IN", voiceGender: "female", voiceId: "priya", llmModel: "claude-haiku-5-5",
  sttProvider: "deepgram", ttsProvider: "sarvam", memoryEnabled: true, recordingEnabled: true,
  maxConcurrentCalls: 1, faqs: [], catalogIds: [],
};

export default async function NewAgentPage() {
  const user = await requireRole("OWNER", "ADMIN");
  const opts = await agentFormOptions(user.workspaceId);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/agents" className="hover:underline">Agents</Link> / New agent</p>
        <h1 className="text-2xl font-extrabold">Create an agent</h1>
        <p className="text-sm text-muted">Go through the steps, then save. You can change everything later.</p>
      </header>
      <AgentForm action={saveAgent.bind(null, null)} initial={DEFAULTS} canEdit {...opts} />
    </div>
  );
}
