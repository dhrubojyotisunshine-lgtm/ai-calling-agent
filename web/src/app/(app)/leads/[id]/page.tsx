import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, duration, money } from "@/lib/format";
import { DIRECTIONS, OUTCOMES, callStatus } from "@/lib/calls";
import { FU_STATUSES, KINDS } from "@/lib/followups";
import { stageInfo } from "@/lib/leads";
import { FollowUpActions } from "../../follow-ups/FollowUpActions";
import { formatPhone } from "@/lib/phone";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteLeadAndReturn, saveLead } from "../actions";
import { LeadForm } from "../LeadForm";
import { leadFormOptions } from "../options";

export const metadata = { title: "Lead" };


export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; edit?: string; followup?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const lead = await db.lead.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      interestedItem: { select: { name: true } },
      assignedUser: { select: { name: true } },
      calls: { orderBy: { startedAt: "desc" }, take: 20, include: { agent: { select: { name: true } } } },
      followUps: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 20, include: { agent: { select: { name: true } }, assignedUser: { select: { name: true } } } },
    },
  });
  if (!lead) notFound();
  const stage = stageInfo(lead.stage);
  const extra = lead.fields && typeof lead.fields === "object" && !Array.isArray(lead.fields) ? Object.entries(lead.fields as Record<string, unknown>) : [];

  if (sp.edit) {
    const opts = await leadFormOptions(user.workspaceId);
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <p className="text-sm text-muted"><Link href="/leads" className="hover:underline">Leads</Link> / <Link href={`/leads/${lead.id}`} className="hover:underline">{lead.name ?? formatPhone(lead.phone)}</Link> / Edit</p>
          <h1 className="text-2xl font-extrabold">Edit lead</h1>
        </header>
        <LeadForm
          action={saveLead.bind(null, lead.id)}
          cancelHref={`/leads/${lead.id}`}
          {...opts}
          initial={{
            name: lead.name ?? "", phone: formatPhone(lead.phone), city: lead.city ?? "", stage: lead.stage,
            interestedItemId: lead.interestedItemId ?? "", dealValue: lead.dealValue?.toString() ?? "",
            assignedUserId: lead.assignedUserId ?? "", isDnd: lead.isDnd, notes: lead.notes ?? "",
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted"><Link href="/leads" className="hover:underline">Leads</Link> / {lead.name ?? formatPhone(lead.phone)}</p>
          <h1 className="text-2xl font-extrabold">{lead.name ?? formatPhone(lead.phone)}</h1>
          <p className="text-sm text-muted tabular-nums">{formatPhone(lead.phone)}{lead.city ? ` · ${lead.city}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/leads/${lead.id}?edit=1`} className="btn">Edit</Link>
          {user.role !== "STAFF" && <ConfirmDeleteButton name={lead.name ?? formatPhone(lead.phone)} onDelete={deleteLeadAndReturn.bind(null, lead.id)} />}
        </div>
      </header>

      {sp.saved && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Lead saved.</p>}
      {sp.followup && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Follow-up saved.</p>}

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Stage"><span className={`chip ${stage.tone}`}>{stage.label}</span>{lead.isDnd && <span className="chip ml-1 border-bad/20 bg-bad-soft text-bad">Do not call</span>}</Info>
        <Info label="Interested in">{lead.interestedItem?.name ?? "Not known yet"}</Info>
        <Info label="Deal value">{lead.dealValue ? money(lead.dealValue) : "-"}</Info>
        <Info label="Owner">{lead.assignedUser?.name ?? "Nobody yet"}</Info>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="font-extrabold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{lead.notes ?? <span className="text-muted">No notes yet.</span>}</p>
          {lead.memory && (
            <>
              <h3 className="label mt-4">What the agent remembers</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{lead.memory}</p>
            </>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-extrabold">Details from the import file</h2>
          {extra.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None.</p>
          ) : (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {extra.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-xs text-muted">{`{${k}}`}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Calls</h2>
        {lead.calls.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No calls with this lead yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {lead.calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <Link href={`/calls/${c.id}`} className="hover:underline">{dateTime(c.startedAt)} · {c.agent?.name ?? "Agent removed"} · {DIRECTIONS[c.direction]}</Link>
                <span className="text-muted">{c.outcome ? OUTCOMES[c.outcome].label : callStatus(c).label} · {duration(c.durationSec)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-extrabold">Follow-ups</h2>
          <Link href={`/follow-ups/new?lead=${lead.id}&back=${encodeURIComponent(`/leads/${lead.id}`)}`} className="btn">+ Add follow-up</Link>
        </div>
        {lead.followUps.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No follow-ups yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {lead.followUps.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-xs text-muted">
                    {KINDS[f.kind].label}{f.kind === "AI_CALLBACK" && f.agent ? ` (${f.agent.name})` : ""}{f.assignedUser ? ` · ${f.assignedUser.name}` : ""} · {dateTime(f.dueAt)} ·{" "}
                    <span className={`chip ${FU_STATUSES[f.status].tone}`}>{FU_STATUSES[f.status].label}</span>
                  </p>
                </div>
                {(user.role !== "STAFF" || f.kind === "STAFF_TASK") && <FollowUpActions id={f.id} status={f.status} back={`/leads/${lead.id}`} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <div className="mt-1.5 text-sm font-semibold">{children}</div>
    </div>
  );
}
