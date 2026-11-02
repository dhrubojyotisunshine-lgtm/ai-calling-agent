import Link from "next/link";
import { notFound } from "next/navigation";
import type { CampaignLeadStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, money } from "@/lib/format";
import { CAMPAIGN_STATUSES, LEAD_STATUSES, RETRY_GAPS, time12, type LeadStatusKey } from "@/lib/campaigns";
import { formatPhone } from "@/lib/phone";
import { CampaignActions } from "../CampaignActions";

export const metadata = { title: "Campaign" };

const PAGE = 50;

type SP = { saved?: string; status?: string; page?: string };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = user.role !== "STAFF";
  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { agent: { select: { id: true, name: true, status: true } } },
  });
  if (!campaign) notFound();

  const [groups, calls] = await Promise.all([
    db.campaignLead.groupBy({ by: ["status"], where: { campaignId: id }, _count: { _all: true } }),
    db.call.aggregate({ where: { campaignId: id, workspaceId: user.workspaceId }, _count: { _all: true }, _sum: { durationSec: true, totalCharge: true } }),
  ]);
  const countOf = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const total = groups.reduce((n, g) => n + g._count._all, 0);
  const done = total - countOf("PENDING") - countOf("CALLING");

  const filter = sp.status && sp.status in LEAD_STATUSES ? (sp.status as LeadStatusKey) : undefined;
  const filtered = filter ? countOf(filter) : total;
  const pages = Math.max(1, Math.ceil(filtered / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const rows = await db.campaignLead.findMany({
    where: { campaignId: id, ...(filter ? { status: filter as CampaignLeadStatus } : {}) },
    orderBy: [{ status: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE,
    take: PAGE,
    include: { lead: { select: { id: true, name: true, phone: true, city: true, isDnd: true } } },
  });
  const href = (extra: Record<string, string>) => `/campaigns/${id}?${new URLSearchParams({ ...(filter ? { status: filter } : {}), ...extra })}`;

  const st = CAMPAIGN_STATUSES[campaign.status];
  const hours = `${time12(campaign.callWindowFrom)} – ${time12(campaign.callWindowTo)}`;
  const gap = RETRY_GAPS.find((g) => g.value === campaign.retryGapMinutes)?.label ?? `${campaign.retryGapMinutes} minutes`;
  const startsLater = campaign.startAt && campaign.startAt.getTime() > Date.now();
  const explain = {
    DRAFT: "Draft: nobody is called until you press Start.",
    SCHEDULED: startsLater
      ? `Starts ${dateTime(campaign.startAt)}. Calls happen between ${hours} (India time).`
      : `Ready to call. Calls happen between ${hours} (India time).`,
    RUNNING: `Calling now, between ${hours} (India time).`,
    PAUSED: "Paused: no new calls are made. Press Resume to continue.",
    COMPLETED: `Finished ${dateTime(campaign.completedAt)}.`,
    CANCELLED: `Cancelled ${dateTime(campaign.completedAt)}. People not yet called were skipped.`,
  }[campaign.status];
  const saved = { draft: "Campaign saved as a draft. Press Start when you're ready.", scheduled: "Campaign saved and started.", "1": "Changes saved." }[sp.saved ?? ""];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted"><Link href="/campaigns" className="hover:underline">Campaigns</Link> / {campaign.name}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            {campaign.name} <span className={`chip ${st.tone}`}>{st.label}</span>
          </h1>
          <p className="text-sm text-muted">
            Agent: <Link href={`/agents/${campaign.agent.id}`} className="font-semibold text-ink hover:underline">{campaign.agent.name}</Link>
            {campaign.agent.status === "PAUSED" && <span className="text-warn"> (paused)</span>}
          </p>
        </div>
        {canManage && <CampaignActions id={campaign.id} name={campaign.name} status={campaign.status} />}
      </header>

      {saved && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">{saved}</p>}
      <p className="rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-line">
        {explain} <Link href={href({})} className="ml-1 font-semibold text-brand hover:underline">Refresh</Link>
      </p>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold"><span className="tabular-nums">{done.toLocaleString("en-IN")}</span> of <span className="tabular-nums">{total.toLocaleString("en-IN")}</span> leads done</p>
          <p className="text-sm text-muted tabular-nums">
            <Link href={`/calls?campaign=${id}`} className="text-brand hover:underline">{calls._count._all} calls</Link> · {Math.round((calls._sum.durationSec ?? 0) / 60)} min talk time · {money(calls._sum.totalCharge)} spent
          </p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Campaign progress">
          <div className="h-full rounded-full bg-brand" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
          {(Object.keys(LEAD_STATUSES) as LeadStatusKey[]).map((k) => (
            <div key={k} className="rounded-lg bg-paper px-3 py-2">
              <dt className="text-xs text-muted">{LEAD_STATUSES[k].label}</dt>
              <dd className="text-lg font-bold tabular-nums">{countOf(k).toLocaleString("en-IN")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card grid gap-4 p-5 text-sm md:grid-cols-4">
        <Info label="Start">{campaign.startAt ? dateTime(campaign.startAt) : "When you press Start"}</Info>
        <Info label="Calling hours (IST)">{hours}</Info>
        <Info label="Calls at once">{campaign.maxConcurrent}</Info>
        <Info label="Retries">{campaign.retryCount === 0 ? "No retries" : `${campaign.retryCount} more, ${gap} apart`}</Info>
        <Info label="DND numbers">{campaign.skipDnd ? "Not called" : "Called"}</Info>
        <Info label="Created">{dateTime(campaign.createdAt)}</Info>
      </section>

      <section className="card">
        <nav className="flex flex-wrap gap-1 border-b border-line p-3" aria-label="Lead status filter">
          <Link href={`/campaigns/${id}`} aria-current={!filter ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${!filter ? "bg-paper" : "text-muted"}`}>
            All <span className="tabular-nums">{total}</span>
          </Link>
          {(Object.keys(LEAD_STATUSES) as LeadStatusKey[]).map((k) => (
            <Link key={k} href={`/campaigns/${id}?status=${k}`} aria-current={filter === k ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${filter === k ? "bg-paper" : "text-muted"}`}>
              {LEAD_STATUSES[k].label} <span className="tabular-nums">{countOf(k)}</span>
            </Link>
          ))}
        </nav>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Lead", "City", "Status", "Tries", "Next try", "Note"].map((h) => <th key={h} className="label px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Nobody here.</td></tr>}
              {rows.map((r) => {
                const s = LEAD_STATUSES[r.status];
                return (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${r.lead.id}`} className="font-bold hover:underline">{r.lead.name ?? formatPhone(r.lead.phone)}</Link>
                      {r.lead.name && <span className="block text-xs text-muted tabular-nums">{formatPhone(r.lead.phone)}</span>}
                    </td>
                    <td className="px-4 py-3">{r.lead.city ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${s.tone}`}>{s.label}</span>
                      {r.lead.isDnd && <span className="chip ml-1 border-bad/20 bg-bad-soft text-bad">DND</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.attempts}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{r.status === "PENDING" ? dateTime(r.nextAttemptAt) : "-"}</td>
                    <td className="px-4 py-3 text-muted">{r.lastError ?? "-"}</td>
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
              {page > 1 && <Link className="btn" href={href({ page: String(page - 1) })}>← Previous</Link>}
              {page < pages && <Link className="btn" href={href({ page: String(page + 1) })}>Next →</Link>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 font-semibold">{children}</p>
    </div>
  );
}
