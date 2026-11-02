import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteService } from "./actions";

export const metadata = { title: "Services & Products" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const canEdit = user.role !== "STAFF";
  const { saved } = await searchParams;

  const items = await db.catalogItem.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { agents: { include: { agent: { select: { name: true } } } } },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Services &amp; Products</h1>
          <p className="text-sm text-muted">What your agents may talk about and offer to callers.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link href="/services/new?type=PRODUCT" className="btn">+ Add product</Link>
            <Link href="/services/new" className="btn-primary">+ Add service</Link>
          </div>
        )}
      </header>

      {saved && <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Saved. Agents use the new details from their next call.</p>}

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold">Nothing added yet</p>
          <p className="mt-1 text-sm text-muted">Add the services and products you sell. Agents only offer what you list here.</p>
          {canEdit && <Link href="/services/new" className="btn-primary mt-4">Add your first service</Link>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Name", "Type", "Price shown to caller", "When to offer", "Next step", "Agents", ""].map((h) => (
                  <th key={h} className="label px-4 py-3 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={`border-b border-line/60 last:border-0 ${it.isActive ? "" : "text-muted"}`}>
                  <td className="px-4 py-3">
                    <Link href={`/services/${it.id}`} className="font-bold hover:underline">{it.name}</Link>
                    {!it.isActive && <span className="chip ml-2 border-line bg-paper text-muted">Inactive</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${it.type === "PRODUCT" ? "border-warn/30 bg-warn-soft text-warn" : "border-brand/20 bg-brand-soft text-brand"}`}>
                      {it.type === "PRODUCT" ? "Product" : "Service"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {it.priceText ?? "-"}
                    {!it.mayQuotePrice && <span className="block text-xs text-muted">Agent won&apos;t say it</span>}
                  </td>
                  <td className="px-4 py-3">{it.whenToOffer ?? "-"}</td>
                  <td className="px-4 py-3">{it.nextAction ?? "-"}</td>
                  <td className="px-4 py-3" title={it.agents.map((a) => a.agent.name).join(", ")}>
                    {it.agents.length || <span className="text-xs text-warn">None yet</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/services/${it.id}`} className="btn">{canEdit ? "Edit" : "View"}</Link>
                      {canEdit && <ConfirmDeleteButton name={it.name} onDelete={deleteService.bind(null, it.id)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
