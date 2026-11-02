import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, duration, money } from "@/lib/format";
import { AddFundsForm, LowBalanceForm } from "./BillingForms";

export const metadata = { title: "Billing" };

const PAGE_SIZE = 20;
const TABS = [
  { key: "all", label: "All", where: {} },
  { key: "topups", label: "Top-ups", where: { type: { in: ["TOPUP", "ADJUSTMENT"] } } },
  { key: "calls", label: "Call charges", where: { type: "CALL_CHARGE" } },
  { key: "plan", label: "Plan", where: { type: "PLAN" } },
] as const;

const TYPE_CHIP = {
  TOPUP: ["Top-up", "border-ok/30 bg-ok-soft text-ok"],
  ADJUSTMENT: ["Adjustment", "border-info/20 bg-info-soft text-info"],
  CALL_CHARGE: ["Call", "border-bad/20 bg-bad-soft text-bad"],
  PLAN: ["Plan", "border-brand/20 bg-brand-soft text-brand"],
} as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const canManage = user.role !== "STAFF";
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.WalletTransactionWhereInput = { workspaceId, ...(tab.where as Prisma.WalletTransactionWhereInput) };

  const [ws, recharged, spent, counts, total, txs] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    db.walletTransaction.aggregate({ where: { workspaceId, type: { in: ["TOPUP", "ADJUSTMENT"] } }, _sum: { amount: true } }),
    db.walletTransaction.aggregate({ where: { workspaceId, type: "CALL_CHARGE" }, _sum: { amount: true } }),
    db.walletTransaction.groupBy({ by: ["type"], where: { workspaceId }, _count: { _all: true } }),
    db.walletTransaction.count({ where }),
    db.walletTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);

  // Show who each charged call was with, instead of a raw call id.
  const callIds = txs.map((t) => t.callId).filter((x): x is string => !!x);
  const calls = callIds.length
    ? await db.call.findMany({
        where: { workspaceId, id: { in: callIds } },
        select: { id: true, durationSec: true, toNumber: true, fromNumber: true, lead: { select: { name: true, phone: true } }, agent: { select: { name: true } } },
      })
    : [];
  const callById = new Map(calls.map((c) => [c.id, c]));

  const countOf = (types: string[]) => counts.filter((c) => types.includes(c.type)).reduce((s, c) => s + c._count._all, 0);
  const tabCount = { all: countOf(["TOPUP", "ADJUSTMENT", "CALL_CHARGE", "PLAN"]), topups: countOf(["TOPUP", "ADJUSTMENT"]), calls: countOf(["CALL_CHARGE"]), plan: countOf(["PLAN"]) };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const balance = Number(ws.walletBalance);
  const lowAt = Number(ws.lowBalanceAt);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">Billing</h1>
        <p className="text-sm text-muted">Your prepaid wallet. Each call is charged from it when the call ends.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4 rounded-2xl bg-brand p-6 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#cfc4f6]">Wallet balance</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{money(balance)}</p>
            {lowAt > 0 && balance < lowAt && <p className="mt-1 text-sm text-[#ffd59a]">Below your alert level of {money(lowAt)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/15 pt-4 text-sm">
            <div><p className="text-[#cfc4f6]">Total added</p><p className="text-lg font-bold tabular-nums">{money(recharged._sum.amount ?? 0)}</p></div>
            <div><p className="text-[#cfc4f6]">Spent on calls</p><p className="text-lg font-bold tabular-nums">{money(Math.abs(Number(spent._sum.amount ?? 0)))}</p></div>
          </div>
        </div>

        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Add funds</h2>
            <span className="chip border-warn/30 bg-warn-soft text-warn">Test mode: no real payment</span>
          </div>
          {canManage ? <AddFundsForm /> : <p className="text-sm text-muted">Ask an owner or admin to add funds.</p>}
        </div>
      </section>

      {canManage && (
        <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="max-w-md">
            <h2 className="font-extrabold">Low-balance warning</h2>
            <p className="text-sm text-muted">Shown on the dashboard when your balance drops below this amount. Calls stop when the balance reaches ₹0.</p>
          </div>
          <LowBalanceForm current={lowAt} />
        </section>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-extrabold">Transactions</h2>
          <nav className="flex flex-wrap gap-1 rounded-lg bg-paper p-1" aria-label="Transaction type">
            {TABS.map((t) => (
              <Link key={t.key} href={`/billing?tab=${t.key}`} aria-current={t.key === tab.key ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${t.key === tab.key ? "bg-white shadow-sm" : "text-muted hover:text-ink"}`}>
                {t.label} <span className="tabular-nums text-muted">{tabCount[t.key]}</span>
              </Link>
            ))}
          </nav>
        </div>
        {txs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No transactions here yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label px-5 py-3">Type</th>
                  <th className="label px-5 py-3">Date (IST)</th>
                  <th className="label px-5 py-3">Details</th>
                  <th className="label px-5 py-3 text-right">Amount</th>
                  <th className="label px-5 py-3 text-right">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => {
                  const [label, cls] = TYPE_CHIP[t.type];
                  const call = t.callId ? callById.get(t.callId) : undefined;
                  const who = call ? call.lead?.name ?? call.lead?.phone ?? call.toNumber ?? call.fromNumber ?? "Browser test" : null;
                  const amt = Number(t.amount);
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-3"><span className={`chip ${cls}`}>{label}</span></td>
                      <td className="px-5 py-3 tabular-nums">{dateTime(t.createdAt)}</td>
                      <td className="px-5 py-3">
                        {call ? <><Link href={`/calls/${call.id}`} className="font-semibold hover:underline">{who}</Link> · {duration(call.durationSec)}{call.agent && <span className="text-muted"> · {call.agent.name}</span>}</> : t.note ?? "-"}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${amt >= 0 ? "text-ok" : ""}`}>{amt >= 0 ? "+" : "−"}{money(Math.abs(amt))}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">{money(t.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-muted">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="btn" href={`/billing?tab=${tab.key}&page=${page - 1}`}>← Newer</Link>}
              {page < pages && <Link className="btn" href={`/billing?tab=${tab.key}&page=${page + 1}`}>Older →</Link>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
