import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { saveFollowUp } from "../actions";
import { FollowUpForm } from "../FollowUpForm";
import { followUpFormOptions } from "../options";

export const metadata = { title: "New follow-up" };

type SP = { lead?: string; call?: string; back?: string; q?: string };

export default async function NewFollowUpPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const sp = await searchParams;
  const lead = sp.lead ? await db.lead.findFirst({ where: { id: sp.lead, workspaceId }, select: { id: true, name: true, phone: true, isDnd: true } }) : null;
  const header = (
    <header>
      <p className="text-sm text-muted"><Link href="/follow-ups" className="hover:underline">Follow-ups</Link> / New</p>
      <h1 className="text-2xl font-extrabold">New follow-up</h1>
    </header>
  );

  // Step 1: pick the lead.
  if (!lead) {
    const q = (sp.q ?? "").trim().slice(0, 80);
    const digits = q.replace(/\D/g, "");
    const matches = q
      ? await db.lead.findMany({
          where: {
            workspaceId,
            OR: [{ name: { contains: q } }, ...(digits.length >= 3 ? [{ phone: { contains: digits.length > 10 ? digits.slice(-10) : digits } }] : [])],
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: { id: true, name: true, phone: true, city: true },
        })
      : [];
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <div className="card space-y-4 p-6">
          <form action="/follow-ups/new" className="flex gap-2" role="search">
            <label htmlFor="q" className="sr-only">Find the lead</label>
            <input id="q" name="q" defaultValue={q} placeholder="Find the lead by name or number" className="input" autoFocus />
            <button className="btn-primary">Search</button>
          </form>
          {sp.lead && <p role="alert" className="text-sm text-bad">That lead no longer exists. Search for another.</p>}
          {q && matches.length === 0 && <p className="text-sm text-muted">No lead matches “{q}”. <Link href="/leads/new" className="font-semibold text-brand hover:underline">Add the lead</Link> first.</p>}
          {matches.length > 0 && (
            <ul className="divide-y divide-line/60 rounded-lg border border-line">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <b>{m.name ?? formatPhone(m.phone)}</b>
                    {m.name && <span className="text-muted tabular-nums"> · {formatPhone(m.phone)}</span>}
                    {m.city && <span className="text-muted"> · {m.city}</span>}
                  </span>
                  <Link href={`/follow-ups/new?lead=${m.id}`} className="btn">Choose</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // Step 2: the follow-up itself.
  const opts = await followUpFormOptions(workspaceId);
  const back = sp.back === `/leads/${lead.id}` || (sp.back?.startsWith("/calls/") && sp.call && sp.back === `/calls/${sp.call}`) ? sp.back : "/follow-ups";
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {header}
      <FollowUpForm
        action={saveFollowUp.bind(null, { leadId: lead.id, callId: sp.call })}
        lead={lead.name ?? formatPhone(lead.phone)}
        isDnd={lead.isDnd}
        canCallback={user.role !== "STAFF"}
        back={back}
        cancelHref={back}
        {...opts}
        initial={{ kind: "STAFF_TASK", title: "", dueAt: "", agentId: opts.agents.length === 1 ? opts.agents[0].id : "", assignedUserId: user.id }}
      />
    </div>
  );
}
