import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, duration, money } from "@/lib/format";
import { DIRECTIONS, OUTCOMES, callStatus } from "@/lib/calls";
import { formatPhone } from "@/lib/phone";
import { RESULTS, callWhere, pickFilters } from "./filters";

export const metadata = { title: "Call history" };

const PAGE = 25;

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const canExport = user.role !== "STAFF";
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const where = callWhere(workspaceId, filters);
  const filtered = Object.keys(filters).length > 0;

  const [stats, answered, agents, campaigns, anyCall] = await Promise.all([
    db.call.aggregate({ where, _count: { _all: true }, _sum: { durationSec: true, totalCharge: true } }),
    db.call.count({ where: { AND: [where, { durationSec: { gt: 0 } }] } }),
    db.agent.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.campaign.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true }, take: 200 }),
    db.call.findFirst({ where: { workspaceId }, select: { id: true } }),
  ]);
  const count = stats._count._all;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const calls = await db.call.findMany({
    where,
    orderBy: { startedAt: "desc" },
    skip: (page - 1) * PAGE,
    take: PAGE,
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      agent: { select: { name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(filters as Record<string, string>), ...extra }).toString();

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Call history</h1>
          <p className="text-sm text-muted">Every call your agents made or answered, newest first. Times are India time.</p>
        </div>
        {canExport && anyCall && <a href={`/calls/export?${qs({})}`} className="btn">Download CSV</a>}
      </header>

      {!anyCall ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">No calls yet</p>
          <p className="mt-1 text-sm text-muted">Calls appear here as soon as an agent makes or answers one.</p>
        </div>
      ) : (
        <>
          <form action="/calls" className="card grid gap-3 p-4 md:grid-cols-4 lg:grid-cols-8" role="search">
            <Filter label="Search" htmlFor="q" wide>
              <input id="q" name="q" defaultValue={filters.q} placeholder="Name or number" className="input" />
            </Filter>
            <Filter label="Result" htmlFor="result">
              <select id="result" name="result" defaultValue={filters.result ?? ""} className="input">
                <option value="">All</option>
                {RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Filter>
            <Filter label="Outcome" htmlFor="outcome">
              <select id="outcome" name="outcome" defaultValue={filters.outcome ?? ""} className="input">
                <option value="">All</option>
                {Object.entries(OUTCOMES).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
              </select>
            </Filter>
            <Filter label="Type" htmlFor="dir">
              <select id="dir" name="dir" defaultValue={filters.dir ?? ""} className="input">
                <option value="">All</option>
                {Object.entries(DIRECTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Filter>
            <Filter label="Agent" htmlFor="agent">
              <select id="agent" name="agent" defaultValue={filters.agent ?? ""} className="input">
                <option value="">All</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Filter>
            <Filter label="Campaign" htmlFor="campaign">
              <select id="campaign" name="campaign" defaultValue={filters.campaign ?? ""} className="input">
                <option value="">All</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Filter>
            <Filter label="From" htmlFor="from"><input id="from" name="from" type="date" defaultValue={filters.from} className="input" /></Filter>
            <Filter label="To" htmlFor="to"><input id="to" name="to" type="date" defaultValue={filters.to} className="input" /></Filter>
            <div className="flex items-end gap-2 md:col-span-4 lg:col-span-8">
              <button className="btn-primary">Apply filters</button>
              {filtered && <Link href="/calls" className="btn">Clear</Link>}
            </div>
          </form>

          <section className="grid gap-3 sm:grid-cols-4">
            <Stat label={filtered ? "Calls (filtered)" : "Calls"} value={count.toLocaleString("en-IN")} />
            <Stat label="Answered" value={`${answered.toLocaleString("en-IN")}${count ? ` (${Math.round((answered / count) * 100)}%)` : ""}`} />
            <Stat label="Talk time" value={duration(stats._sum.durationSec ?? 0)} />
            <Stat label="Charged" value={money(stats._sum.totalCharge)} />
          </section>

          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {["When", "Who", "Agent", "Type", "Result", "Outcome", "Duration", "Charge", ""].map((h, i) => <th key={i} className="label px-4 py-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">No calls match these filters.</td></tr>}
                  {calls.map((c) => {
                    const st = callStatus(c);
                    const number = c.direction === "INBOUND" ? c.fromNumber : c.toNumber;
                    const who = c.lead?.name ?? (number ? formatPhone(number) : c.direction === "BROWSER_TEST" ? "Browser test" : "Unknown number");
                    return (
                      <tr key={c.id} className="border-b border-line/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">{dateTime(c.startedAt)}</td>
                        <td className="px-4 py-3">
                          {c.lead ? <Link href={`/leads/${c.lead.id}`} className="font-bold hover:underline">{who}</Link> : <span className="font-bold">{who}</span>}
                          {c.lead?.name && number && <span className="block text-xs text-muted tabular-nums">{formatPhone(number)}</span>}
                          {c.campaign && <Link href={`/campaigns/${c.campaign.id}`} className="block text-xs text-brand hover:underline">{c.campaign.name}</Link>}
                        </td>
                        <td className="px-4 py-3">{c.agent?.name ?? <span className="text-muted">Agent removed</span>}</td>
                        <td className="px-4 py-3">{DIRECTIONS[c.direction]}</td>
                        <td className="px-4 py-3"><span className={`chip ${st.tone}`}>{st.label}</span></td>
                        <td className="px-4 py-3">{c.outcome ? <span className={`chip ${OUTCOMES[c.outcome].tone}`}>{OUTCOMES[c.outcome].label}</span> : <span className="text-muted">-</span>}</td>
                        <td className="px-4 py-3 tabular-nums">{duration(c.durationSec)}</td>
                        <td className="px-4 py-3 tabular-nums">{money(c.totalCharge)}</td>
                        <td className="px-4 py-3 text-right"><Link href={`/calls/${c.id}`} className="font-semibold text-brand hover:underline">View</Link></td>
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
                  {page > 1 && <Link className="btn" href={`/calls?${qs({ page: String(page - 1) })}`}>← Previous</Link>}
                  {page < pages && <Link className="btn" href={`/calls?${qs({ page: String(page + 1) })}`}>Next →</Link>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Filter({ label, htmlFor, wide, children }: { label: string; htmlFor: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-2 lg:col-span-1" : ""}`}>
      <label htmlFor={htmlFor} className="label block">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
