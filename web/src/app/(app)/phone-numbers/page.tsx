import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, money } from "@/lib/format";
import { daysUntil } from "@/lib/numbers";
import { formatPhone } from "@/lib/phone";
import { setNumberAgents } from "./actions";
import { NumberAgents } from "./NumberAgents";

export const metadata = { title: "Phone numbers" };

const dateOnly = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export default async function PhoneNumbersPage() {
  const user = await requireUser();
  const workspaceId = user.workspaceId;
  const canManage = user.role !== "STAFF";
  const [numbers, agents] = await Promise.all([
    db.phoneNumber.findMany({
      where: { workspaceId },
      orderBy: { e164: "asc" },
      include: { agents: { where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true, purpose: true, status: true } } },
    }),
    db.agent.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true, purpose: true, phoneNumberId: true } }),
  ]);
  const byId = new Map(numbers.map((n) => [n.id, formatPhone(n.e164)]));
  const rent = numbers.reduce((s, n) => s + Number(n.monthlyRent), 0);
  const lines = numbers.reduce((s, n) => s + n.channels, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">Phone numbers</h1>
        <p className="text-sm text-muted">Numbers your agents call from and answer on. Each line carries one call at a time.</p>
      </header>

      {numbers.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">No phone numbers yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Voxura provides the numbers. Ask our team for one; once it is added to your account it appears here and you can choose which agents use it.
          </p>
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Numbers" value={String(numbers.length)} />
            <Stat label="Lines (calls at once)" value={String(lines)} />
            <Stat label="Monthly rent" value={money(rent)} />
          </section>
          <ul className="space-y-3">
            {numbers.map((n) => {
              const answering = n.agents.find((a) => a.purpose !== "OUTBOUND");
              const calling = n.agents.filter((a) => a.purpose !== "INBOUND");
              const days = daysUntil(n.renewsOn);
              const label = formatPhone(n.e164);
              return (
                <li key={n.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 space-y-2">
                    <p className="text-xl font-extrabold tabular-nums">{label}</p>
                    <p className="flex flex-wrap gap-1.5 text-xs">
                      <span className="chip border-line bg-paper text-ink">{n.channels} line{n.channels > 1 ? "s" : ""}</span>
                      <span className="chip border-line bg-paper text-ink">{money(n.monthlyRent)}/month</span>
                      {n.renewsOn && (
                        <span className={`chip ${days !== null && days < 0 ? "border-bad/20 bg-bad-soft text-bad" : days !== null && days <= 7 ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-paper text-muted"}`}>
                          {days !== null && days < 0 ? `Rent overdue since ${dateOnly(n.renewsOn)}` : `Renews ${dateOnly(n.renewsOn)}${days !== null && days <= 7 ? ` (in ${days} day${days === 1 ? "" : "s"})` : ""}`}
                        </span>
                      )}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted">Answers incoming calls: </span>
                      {answering ? <Link href={`/agents/${answering.id}`} className="font-semibold hover:underline">{answering.name}</Link> : <span className="font-semibold text-warn">Nobody (callers hear no agent)</span>}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted">Calls out from it: </span>
                      {calling.length ? calling.map((a, i) => (
                        <span key={a.id}>{i > 0 && ", "}<Link href={`/agents/${a.id}`} className="font-semibold hover:underline">{a.name}</Link></span>
                      )) : <span className="text-muted">no agent</span>}
                    </p>
                    <p className="text-xs text-muted">Added {dateTime(n.createdAt)}</p>
                  </div>
                  {canManage && (
                    <NumberAgents
                      action={setNumberAgents.bind(null, n.id)}
                      numberLabel={label}
                      selected={n.agents.map((a) => a.id)}
                      agents={agents.map((a) => ({ id: a.id, name: a.name, purpose: a.purpose, otherNumber: a.phoneNumberId && a.phoneNumberId !== n.id ? byId.get(a.phoneNumberId) ?? null : null }))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">Need more numbers or lines? Ask the Voxura team. Rent is shown for reference; automatic monthly rent billing comes with the payment gateway.</p>
        </>
      )}
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
