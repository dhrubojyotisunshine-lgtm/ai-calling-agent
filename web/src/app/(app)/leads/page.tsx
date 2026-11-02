import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, money } from "@/lib/format";
import { STAGES, stageInfo } from "@/lib/leads";
import { formatPhone } from "@/lib/phone";
import { StageSelect } from "./StageSelect";

export const metadata = { title: "Leads" };

const BOARD_PER_STAGE = 25;
const LIST_PAGE = 50;

type SP = { view?: string; q?: string; stage?: string; page?: string; deleted?: string; imported?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const canManage = user.role !== "STAFF";
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";
  const q = (sp.q ?? "").trim().slice(0, 80);

  const where: Prisma.LeadWhereInput = { workspaceId };
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q } },
      { city: { contains: q } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits.length > 10 ? digits.slice(-10) : digits } }] : []),
    ];
  }

  const counts = await db.lead.groupBy({ by: ["stage"], where, _count: { _all: true } });
  const countOf = (s: string) => counts.find((c) => c.stage === s)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);
  const hrefWith = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ view, ...(q ? { q } : {}), ...extra });
    return `/leads?${p}`;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Leads</h1>
          <p className="text-sm text-muted">Everyone your agents have called or will call, by stage.</p>
        </div>
        <div className="flex gap-2">
          {canManage && <Link href="/leads/import" className="btn">Import file</Link>}
          <Link href="/leads/new" className="btn-primary">+ Add lead</Link>
        </div>
      </header>

      {sp.deleted && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Lead deleted.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/leads" className="flex gap-2" role="search">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="q" className="sr-only">Search leads</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search name, number or city" className="input w-72" />
          <button className="btn">Search</button>
          {q && <Link href={`/leads?view=${view}`} className="btn">Clear</Link>}
        </form>
        <nav className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line" aria-label="View">
          {(["board", "list"] as const).map((v) => (
            <Link key={v} href={`/leads?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={view === v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>
              {v === "board" ? "Board" : "List"}
            </Link>
          ))}
        </nav>
      </div>

      {total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">{q ? `No leads match “${q}”` : "No leads yet"}</p>
          {!q && <p className="mt-1 text-sm text-muted">Add leads one by one, or import a CSV or Excel file with a phone column.</p>}
        </div>
      ) : view === "board" ? (
        <Board where={where} countOf={countOf} />
      ) : (
        <List where={where} stage={sp.stage} page={Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1)} countOf={countOf} total={total} hrefWith={hrefWith} />
      )}
    </div>
  );
}

async function Board({ where, countOf }: { where: Prisma.LeadWhereInput; countOf: (s: string) => number }) {
  const columns = await Promise.all(
    STAGES.map((s) =>
      db.lead.findMany({
        where: { ...where, stage: s.value },
        orderBy: { updatedAt: "desc" },
        take: BOARD_PER_STAGE,
        include: { interestedItem: { select: { name: true } }, followUps: { where: { status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 1 } },
      }),
    ),
  );
  return (
    <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(165px, 1fr))` }}>
      {STAGES.map((s, i) => (
        <section key={s.value} className="flex min-w-0 flex-col gap-2 rounded-xl bg-[#efedf6] p-2" aria-label={s.label}>
          <h2 className="flex items-center justify-between px-1 pt-1 text-xs font-bold">
            <span className={`chip ${s.tone}`}>{s.label}</span>
            <span className="tabular-nums text-muted">{countOf(s.value)}</span>
          </h2>
          {columns[i].map((l) => (
            <article key={l.id} className="space-y-1.5 rounded-lg border border-line bg-white p-2.5 text-sm">
              <Link href={`/leads/${l.id}`} className="block font-bold hover:underline">{l.name ?? formatPhone(l.phone)}</Link>
              {l.name && <p className="text-xs text-muted tabular-nums">{formatPhone(l.phone)}</p>}
              {l.interestedItem && <span className="chip border-warn/30 bg-warn-soft text-warn">{l.interestedItem.name}{l.dealValue ? ` · ${money(l.dealValue)}` : ""}</span>}
              {l.followUps[0] && <p className="text-xs text-muted">Next: {l.followUps[0].title} · {dateTime(l.followUps[0].dueAt)}</p>}
              {l.isDnd && <span className="chip border-bad/20 bg-bad-soft text-bad">DND</span>}
              <StageSelect leadId={l.id} stage={l.stage} label={`Stage for ${l.name ?? l.phone}`} />
            </article>
          ))}
          {countOf(s.value) > columns[i].length && (
            <Link href={`/leads?view=list&stage=${s.value}`} className="px-1 text-xs font-semibold text-brand hover:underline">
              See all {countOf(s.value)} →
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}

async function List({ where, stage, page, countOf, total, hrefWith }: {
  where: Prisma.LeadWhereInput; stage?: string; page: number; countOf: (s: string) => number; total: number;
  hrefWith: (extra: Record<string, string>) => string;
}) {
  const st = STAGES.find((s) => s.value === stage);
  const listWhere = st ? { ...where, stage: st.value } : where;
  const count = st ? countOf(st.value) : total;
  const pages = Math.max(1, Math.ceil(count / LIST_PAGE));
  const leads = await db.lead.findMany({
    where: listWhere,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * LIST_PAGE,
    take: LIST_PAGE,
    include: { interestedItem: { select: { name: true } }, assignedUser: { select: { name: true } }, _count: { select: { calls: true } } },
  });

  return (
    <div className="card">
      <nav className="flex flex-wrap gap-1 border-b border-line p-3" aria-label="Stage filter">
        <Link href={hrefWith({})} aria-current={!st ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${!st ? "bg-paper" : "text-muted"}`}>
          All <span className="tabular-nums">{total}</span>
        </Link>
        {STAGES.map((s) => (
          <Link key={s.value} href={hrefWith({ stage: s.value })} aria-current={st?.value === s.value ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${st?.value === s.value ? "bg-paper" : "text-muted"}`}>
            {s.label} <span className="tabular-nums">{countOf(s.value)}</span>
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {["Lead", "City", "Stage", "Interested in", "Owner", "Calls", "Updated"].map((h) => <th key={h} className="label px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const s = stageInfo(l.stage);
              return (
                <tr key={l.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-bold hover:underline">{l.name ?? formatPhone(l.phone)}</Link>
                    {l.name && <span className="block text-xs text-muted tabular-nums">{formatPhone(l.phone)}</span>}
                  </td>
                  <td className="px-4 py-3">{l.city ?? "-"}</td>
                  <td className="px-4 py-3"><span className={`chip ${s.tone}`}>{s.label}</span>{l.isDnd && <span className="chip ml-1 border-bad/20 bg-bad-soft text-bad">DND</span>}</td>
                  <td className="px-4 py-3">{l.interestedItem?.name ?? "-"}</td>
                  <td className="px-4 py-3">{l.assignedUser?.name ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{l._count.calls}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{dateTime(l.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn" href={hrefWith({ ...(st ? { stage: st.value } : {}), page: String(page - 1) })}>← Previous</Link>}
            {page < pages && <Link className="btn" href={hrefWith({ ...(st ? { stage: st.value } : {}), page: String(page + 1) })}>Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
