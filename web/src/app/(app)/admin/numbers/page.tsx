import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { addPoolNumber, assignNumber, deletePoolNumber, unassignNumber } from "./actions";
import { AddNumberForm, AssignForm, ConfirmAction } from "./AdminForms";

export const metadata = { title: "Number pool (admin)" };

const dateOnly = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

// Voxura staff only: the shared pool of numbers and which company has each one.
export default async function AdminNumbersPage() {
  await requirePlatformAdmin();
  const [numbers, workspaces] = await Promise.all([
    db.phoneNumber.findMany({
      orderBy: [{ workspaceId: "asc" }, { e164: "asc" }],
      include: { workspace: { select: { name: true } }, _count: { select: { agents: true } } },
    }),
    db.workspace.findMany({
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, users: { where: { role: "OWNER" }, take: 1, select: { email: true } } },
    }),
  ]);
  const options = workspaces.map((w) => ({ id: w.id, label: `${w.name}${w.users[0] ? ` (${w.users[0].email})` : ""}` }));
  const pool = numbers.filter((n) => !n.workspaceId);
  const assigned = numbers.filter((n) => n.workspaceId);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="chip border-bad/20 bg-bad-soft text-bad">Voxura admin</p>
        <h1 className="mt-2 text-2xl font-extrabold">Number pool</h1>
        <p className="text-sm text-muted">Numbers bought from the SIP provider. Assign one to a company and it appears on their Phone numbers page.</p>
      </header>

      <AddNumberForm action={addPoolNumber} />

      <section className="card">
        <h2 className="border-b border-line px-5 py-4 font-bold">In the pool ({pool.length})</h2>
        {pool.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No free numbers.</p> : (
          <ul className="divide-y divide-line/60">
            {pool.map((n) => (
              <li key={n.id} className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-lg font-bold tabular-nums">{formatPhone(n.e164)}</p>
                  <p className="text-xs text-muted">{n.channels} line{n.channels > 1 ? "s" : ""} · {money(n.monthlyRent)}/month{n.sipTrunkId ? ` · trunk ${n.sipTrunkId}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <AssignForm action={assignNumber.bind(null, n.id)} workspaces={options} />
                  <ConfirmAction label="Delete" confirm={`Delete ${formatPhone(n.e164)}?`} run={deletePoolNumber.bind(null, n.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="border-b border-line px-5 py-4 font-bold">With companies ({assigned.length})</h2>
        {assigned.length === 0 ? <p className="px-5 py-6 text-sm text-muted">None yet.</p> : (
          <ul className="divide-y divide-line/60">
            {assigned.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-lg font-bold tabular-nums">{formatPhone(n.e164)}</p>
                  <p className="text-xs text-muted">
                    {n.workspace?.name} · {n.channels} line{n.channels > 1 ? "s" : ""} · {money(n.monthlyRent)}/month
                    {n.renewsOn ? ` · renews ${dateOnly(n.renewsOn)}` : ""} · {n._count.agents} agent{n._count.agents === 1 ? "" : "s"}
                  </p>
                </div>
                <ConfirmAction label="Take back" confirm={`Take back from ${n.workspace?.name}? Their agents stop using it.`} run={unassignNumber.bind(null, n.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
