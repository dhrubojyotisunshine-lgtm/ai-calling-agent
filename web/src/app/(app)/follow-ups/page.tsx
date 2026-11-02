import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { KINDS, buckets, type BucketKey } from "@/lib/followups";
import { formatPhone } from "@/lib/phone";
import { FollowUpActions } from "./FollowUpActions";

export const metadata = { title: "Follow-ups" };

const PAGE = 50;
const TABS: { key: BucketKey; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

type SP = { tab?: string; kind?: string; who?: string; page?: string; saved?: string };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const isManager = user.role !== "STAFF";
  const sp = await searchParams;
  const b = buckets();

  const filter: Prisma.FollowUpWhereInput = { workspaceId };
  if (sp.kind === "AI_CALLBACK" || sp.kind === "STAFF_TASK") filter.kind = sp.kind;
  if (sp.who === "me") filter.assignedUserId = user.id;
  else if (sp.who === "none") filter.assignedUserId = null;

  const counts = await Promise.all(TABS.map((t) => db.followUp.count({ where: { AND: [filter, b[t.key]] } })));
  const countOf = Object.fromEntries(TABS.map((t, i) => [t.key, counts[i]])) as Record<BucketKey, number>;
  // Open on the most useful tab: overdue if any, else today, else upcoming.
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? (countOf.overdue ? "overdue" : countOf.today ? "today" : "upcoming");
  const total = countOf[tab];
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const items = await db.followUp.findMany({
    where: { AND: [filter, b[tab]] },
    orderBy: tab === "done" || tab === "cancelled" ? { dueAt: "desc" } : { dueAt: "asc" },
    skip: (page - 1) * PAGE,
    take: PAGE,
    include: {
      lead: { select: { id: true, name: true, phone: true, isDnd: true } },
      agent: { select: { name: true } },
      assignedUser: { select: { name: true } },
      call: { select: { id: true, startedAt: true } },
    },
  });
  const anyAtAll = (await db.followUp.count({ where: { workspaceId } })) > 0;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(sp.kind ? { kind: sp.kind } : {}), ...(sp.who ? { who: sp.who } : {}), ...extra });
    return `/follow-ups?${p}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Follow-ups</h1>
          <p className="text-sm text-muted">Callbacks your agent will make, and tasks for your team. Times are India time.</p>
        </div>
        <Link href="/follow-ups/new" className="btn-primary">+ New follow-up</Link>
      </header>

      {sp.saved && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Follow-up saved.</p>}

      {!anyAtAll ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">No follow-ups yet</p>
          <p className="mt-1 text-sm text-muted">Add one from a lead or a call, or press New follow-up. Agents also create them when a caller asks to be called back.</p>
        </div>
      ) : (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
            <nav className="flex flex-wrap gap-1" aria-label="Follow-up filter">
              {TABS.map((t) => (
                <Link key={t.key} href={qs({ tab: t.key })} aria-current={tab === t.key ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-paper" : "text-muted"}`}>
                  {t.label} <span className={`tabular-nums ${t.key === "overdue" && countOf.overdue ? "text-bad" : ""}`}>{countOf[t.key]}</span>
                </Link>
              ))}
            </nav>
            <form action="/follow-ups" className="flex flex-wrap gap-2">
              <input type="hidden" name="tab" value={tab} />
              <label htmlFor="kind" className="sr-only">Type</label>
              <select id="kind" name="kind" defaultValue={sp.kind ?? ""} className="input w-auto">
                <option value="">All types</option>
                <option value="AI_CALLBACK">Agent calls back</option>
                <option value="STAFF_TASK">Team tasks</option>
              </select>
              <label htmlFor="who" className="sr-only">Assigned to</label>
              <select id="who" name="who" defaultValue={sp.who ?? ""} className="input w-auto">
                <option value="">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="none">Nobody assigned</option>
              </select>
              <button className="btn">Filter</button>
            </form>
          </div>

          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Nothing here.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {items.map((f) => {
                const k = KINDS[f.kind];
                const late = f.status === "OPEN" && f.dueAt < new Date();
                const canAct = isManager || f.kind === "STAFF_TASK";
                return (
                  <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold">{f.title}</p>
                      <p className="text-sm">
                        <Link href={`/leads/${f.lead.id}`} className="font-semibold hover:underline">{f.lead.name ?? formatPhone(f.lead.phone)}</Link>
                        {f.lead.name && <span className="text-muted tabular-nums"> · {formatPhone(f.lead.phone)}</span>}
                        {f.lead.isDnd && <span className="chip ml-2 border-bad/20 bg-bad-soft text-bad">DND</span>}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className={`chip ${k.tone}`}>{k.label}</span>
                        <span className={late ? "font-semibold text-bad" : ""}>{late ? "Was due " : "Due "}{dateTime(f.dueAt)}</span>
                        {f.kind === "AI_CALLBACK" && <span>· {f.agent?.name ?? <span className="text-bad">no agent (pick one)</span>}</span>}
                        {f.assignedUser && <span>· {f.assignedUser.name}</span>}
                        {f.call && <span>· from <Link href={`/calls/${f.call.id}`} className="text-brand hover:underline">call on {dateTime(f.call.startedAt)}</Link></span>}
                        {f.status === "DONE" && f.doneAt && <span>· done {dateTime(f.doneAt)}</span>}
                      </p>
                    </div>
                    {canAct && <FollowUpActions id={f.id} status={f.status} back="/follow-ups" />}
                  </li>
                );
              })}
            </ul>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-muted">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link className="btn" href={qs({ page: String(page - 1) })}>← Previous</Link>}
                {page < pages && <Link className="btn" href={qs({ page: String(page + 1) })}>Next →</Link>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
