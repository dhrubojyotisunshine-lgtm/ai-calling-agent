import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, startOfMonthIST, startOfTodayIST } from "@/lib/format";
import { buckets } from "@/lib/followups";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const ws = user.workspace;
  const workspaceId = ws.id;
  const today = startOfTodayIST();
  // Same "today" and "overdue" as the Follow-ups page.
  const fu = buckets();
  const monthStart = startOfMonthIST();

  // One definition of "calls" and "spent" used everywhere (live app showed two different figures).
  const [totalCalls, spentAgg, monthAgg, todayCalls, todayAnswered, todayInterested, followToday, followOverdue, agentCount, running] =
    await Promise.all([
      db.call.count({ where: { workspaceId } }),
      db.walletTransaction.aggregate({ where: { workspaceId, type: "CALL_CHARGE" }, _sum: { amount: true } }),
      db.call.aggregate({ where: { workspaceId, startedAt: { gte: monthStart } }, _sum: { durationSec: true } }),
      db.call.count({ where: { workspaceId, startedAt: { gte: today } } }),
      db.call.count({ where: { workspaceId, startedAt: { gte: today }, durationSec: { gt: 0 } } }),
      db.call.count({ where: { workspaceId, startedAt: { gte: today }, outcome: "INTERESTED" } }),
      db.followUp.count({ where: { workspaceId, ...fu.today } }),
      db.followUp.count({ where: { workspaceId, ...fu.overdue } }),
      db.agent.count({ where: { workspaceId } }),
      db.campaign.findFirst({
        where: { workspaceId, status: "RUNNING" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, _count: { select: { leads: true } } },
      }),
    ]);

  const runningDone = running
    ? await db.campaignLead.count({ where: { campaignId: running.id, status: { notIn: ["PENDING", "CALLING"] } } })
    : 0;

  const balance = Number(ws.walletBalance);
  const spent = Math.abs(Number(spentAgg._sum.amount ?? 0));
  const minutes = (monthAgg._sum.durationSec ?? 0) / 60;
  const avgPerCall = totalCalls ? spent / totalCalls : 0;
  const lowBalance = Number(ws.lowBalanceAt) > 0 && balance < Number(ws.lowBalanceAt);
  const isNew = totalCalls === 0 && agentCount === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0d9a5c] to-[#138a68] px-6 py-5 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Voice workspace</p>
          <h1 className="text-2xl font-extrabold">Hello {user.name.split(" ")[0]}, ready to make a call?</h1>
          <p className="text-sm text-white/85">Open the call workspace to choose an agent and test it in your browser.</p>
        </div>
        <span className="btn cursor-not-allowed opacity-80" title="Available after the Agents step">Start a call now →</span>
      </section>

      {denied && (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          Only an owner or admin can open that page. Ask them if you need a change.
        </p>
      )}

      {lowBalance && (
        <p role="status" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-[#7a4300]">
          Your wallet balance is {money(balance)}, below your alert level of {money(ws.lowBalanceAt)}. Calls stop when it reaches ₹0.{" "}
          <Link href="/billing" className="font-bold underline">Add funds</Link>
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-brand p-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#cfc4f6]">Wallet balance</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{money(balance)}</p>
          <p className="text-xs text-[#cfc4f6]">Auto-deducts after each call</p>
        </div>
        <Stat label="Total calls" value={totalCalls.toLocaleString("en-IN")} note={`Avg ${money(avgPerCall)} per call`} />
        <Stat label="Minutes this month" value={minutes.toFixed(1)} note="talk time" />
        <Stat label="Spent on calls" value={money(spent)} note="all time, from the wallet" />
      </section>

      {isNew ? (
        <section className="card p-6">
          <h2 className="text-lg font-extrabold">Get started</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Add funds", "Recharge your wallet so agents can place calls."],
              ["Create an agent", "Write what it says and pick its voice and language."],
              ["Add services & products", "Tell the agent what it may offer callers."],
              ["Upload leads", "Start a campaign from a CSV or Excel file."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-line p-4">
                <p className="text-xs font-bold text-brand">Step {i + 1}</p>
                <p className="font-bold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="label">Today</p>
            <p className="mt-2 text-sm"><b className="text-xl tabular-nums">{todayCalls}</b> calls · <b className="tabular-nums">{todayAnswered}</b> answered · <b className="tabular-nums text-ok">{todayInterested}</b> interested</p>
          </div>
          <div className="card p-5">
            <p className="label">Running campaign</p>
            {running ? (
              <>
                <Link href={`/campaigns/${running.id}`} className="mt-2 block font-bold hover:underline">{running.name}</Link>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${running._count.leads ? (runningDone / running._count.leads) * 100 : 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted tabular-nums">{runningDone} of {running._count.leads} leads called</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No campaign is running.</p>
            )}
          </div>
          <div className="card p-5">
            <p className="label">Follow-ups due</p>
            <p className="mt-2 text-sm"><b className="text-xl tabular-nums">{followToday}</b> today · <b className={`tabular-nums ${followOverdue ? "text-bad" : ""}`}>{followOverdue}</b> overdue</p>
            <Link href={followOverdue ? "/follow-ups?tab=overdue" : "/follow-ups?tab=today"} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Open follow-ups →</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}
