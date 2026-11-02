import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { languageLabel, modelLabel } from "@/lib/agent-options";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteAgent } from "./actions";

export const metadata = { title: "Agents" };

const PURPOSE = { OUTBOUND: "Outbound", INBOUND: "Inbound", BOTH: "Inbound + outbound" } as const;

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const canEdit = user.role !== "STAFF";
  const { saved } = await searchParams;

  const agents = await db.agent.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "asc" },
    include: {
      phoneNumber: { select: { e164: true } },
      catalogItems: { include: { catalogItem: { select: { name: true } } } },
      _count: { select: { calls: true } },
    },
  });
  const billed = await db.call.groupBy({
    by: ["agentId"],
    where: { workspaceId: user.workspaceId, agentId: { in: agents.map((a) => a.id) } },
    _sum: { totalCharge: true },
  });
  const billedBy = new Map(billed.map((b) => [b.agentId, Number(b._sum.totalCharge ?? 0)]));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Agents</h1>
          <p className="text-sm text-muted">Create voice agents, then use them for campaigns and incoming calls.</p>
        </div>
        {canEdit && <Link href="/agents/new" className="btn-primary">+ New agent</Link>}
      </header>

      {saved && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Agent saved. Changes apply from the next call.</p>}

      {agents.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">No agents yet</p>
          <p className="mt-1 text-sm text-muted">An agent is the AI voice that talks to your callers. Create one to get started.</p>
          {canEdit && <Link href="/agents/new" className="btn-primary mt-4">Create your first agent</Link>}
        </div>
      ) : (
        <ul className="space-y-3">
          {agents.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/agents/${a.id}`} className="text-lg font-bold hover:underline">{a.name}</Link>
                  <span className={`chip ${a.status === "ACTIVE" ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-paper text-muted"}`}>
                    ● {a.status === "ACTIVE" ? "Active" : "Paused"}
                  </span>
                  <span className="chip border-brand/20 bg-brand-soft text-brand">{a.mode === "ASSISTANT" ? "Assistant" : "Announcement"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="chip border-line bg-paper text-ink">Brain: {modelLabel(a.llmModel)}</span>
                  <span className="chip border-line bg-paper text-ink">Speaks: {languageLabel(a.language)} · {a.voiceId ?? a.voiceGender}</span>
                  <span className="chip border-info/20 bg-info-soft text-info">{PURPOSE[a.purpose]} · {a.phoneNumber ? formatPhone(a.phoneNumber.e164) : "no number"}</span>
                  <span className="chip border-line bg-paper text-muted">{a.memoryEnabled ? "Memory on" : "No memory"}</span>
                  <span className="chip border-line bg-paper text-muted">{a.recordingEnabled ? "Recording on" : "No recording"}</span>
                  <span className="chip border-line bg-paper text-muted">Up to {a.maxConcurrentCalls} at once</span>
                </div>
                {a.catalogItems.length > 0 && (
                  <p className="text-xs text-warn">Offers: {a.catalogItems.map((c) => c.catalogItem.name).join(", ")}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-muted">
                  Calls <b className="text-sm text-ink tabular-nums">{a._count.calls}</b> · Billed{" "}
                  <b className="text-sm text-ok tabular-nums">{money(billedBy.get(a.id) ?? 0)}</b>
                </p>
                <div className="flex gap-2">
                  <Link href={`/agents/${a.id}`} className="btn">{canEdit ? "Edit" : "View"}</Link>
                  <span className="btn-go cursor-not-allowed opacity-60" title="Available when the Live call screen is built">Call</span>
                  {canEdit && <ConfirmDeleteButton name={a.name} onDelete={deleteAgent.bind(null, a.id)} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
