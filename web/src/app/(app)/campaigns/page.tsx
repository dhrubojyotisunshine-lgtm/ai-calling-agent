import Link from "next/link";
import type { CampaignStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, money } from "@/lib/format";
import { CAMPAIGN_STATUSES } from "@/lib/campaigns";

export const metadata = { title: "Campaigns" };

const PAGE = 25;
const TABS: { key: string; label: string; statuses?: CampaignStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", statuses: ["SCHEDULED", "RUNNING", "PAUSED"] },
  { key: "draft", label: "Drafts", statuses: ["DRAFT"] },
  { key: "finished", label: "Finished", statuses: ["COMPLETED", "CANCELLED"] },
];

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; deleted?: string }> }) {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const canManage = user.role !== "STAFF";
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];

  const statusCounts = await db.campaign.groupBy({ by: ["status"], where: { workspaceId }, _count: { _all: true } });
  const countFor = (t: (typeof TABS)[number]) =>
    statusCounts.filter((s) => !t.statuses || t.statuses.includes(s.status)).reduce((n, s) => n + s._count._all, 0);
  const count = countFor(tab);
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));

  const campaigns = await db.campaign.findMany({
    where: { workspaceId, ...(tab.statuses ? { status: { in: tab.statuses } } : {}) },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE,
    take: PAGE,
    include: { agent: { select: { name: true } }, _count: { select: { leads: true } } },
  });
  const ids = campaigns.map((c) => c.id);
  const [doneRows, spendRows] = await Promise.all([
    db.campaignLead.groupBy({ by: ["campaignId"], where: { campaignId: { in: ids }, status: { notIn: ["PENDING", "CALLING"] } }, _count: { _all: true } }),
    db.call.groupBy({ by: ["campaignId"], where: { workspaceId, campaignId: { in: ids } }, _count: { _all: true }, _sum: { totalCharge: true } }),
  ]);
  const doneOf = new Map(doneRows.map((r) => [r.campaignId, r._count._all]));
  const spendOf = new Map(spendRows.map((r) => [r.campaignId, r]));
  const total = countFor(TABS[0]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Campaigns</h1>
          <p className="text-sm text-muted">Let an agent call a list of leads, within your calling hours.</p>
        </div>
        {canManage && <Link href="/campaigns/new" className="btn-primary">+ New campaign</Link>}
      </header>

      {sp.deleted && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Campaign deleted.</p>}

      {total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">No campaigns yet</p>
          <p className="mt-1 text-sm text-muted">
            {canManage ? "Create a campaign to have an agent call your leads." : "Your admin hasn't created any campaigns yet."}
          </p>
        </div>
      ) : (
        <div className="card">
          <nav className="flex flex-wrap gap-1 border-b border-line p-3" aria-label="Campaign filter">
            {TABS.map((t) => (
              <Link key={t.key} href={`/campaigns?tab=${t.key}`} aria-current={tab.key === t.key ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab.key === t.key ? "bg-paper" : "text-muted"}`}>
                {t.label} <span className="tabular-nums">{countFor(t)}</span>
              </Link>
            ))}
          </nav>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Campaign", "Agent", "Status", "Progress", "Start", "Calls", "Spent"].map((h) => <th key={h} className="label px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No campaigns here.</td></tr>}
                {campaigns.map((c) => {
                  const st = CAMPAIGN_STATUSES[c.status];
                  const done = doneOf.get(c.id) ?? 0;
                  const spend = spendOf.get(c.id);
                  return (
                    <tr key={c.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3"><Link href={`/campaigns/${c.id}`} className="font-bold hover:underline">{c.name}</Link></td>
                      <td className="px-4 py-3">{c.agent.name}</td>
                      <td className="px-4 py-3"><span className={`chip ${st.tone}`}>{st.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-paper">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${c._count.leads ? (done / c._count.leads) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-muted tabular-nums">{done} of {c._count.leads}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted">{c.startAt ? dateTime(c.startAt) : "-"}</td>
                      <td className="px-4 py-3 tabular-nums">{spend?._count._all ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums">{money(spend?._sum.totalCharge)}</td>
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
                {page > 1 && <Link className="btn" href={`/campaigns?tab=${tab.key}&page=${page - 1}`}>← Previous</Link>}
                {page < pages && <Link className="btn" href={`/campaigns?tab=${tab.key}&page=${page + 1}`}>Next →</Link>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
