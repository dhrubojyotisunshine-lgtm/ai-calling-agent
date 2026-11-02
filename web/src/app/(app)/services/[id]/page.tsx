import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveService } from "../actions";
import { ServiceForm } from "../ServiceForm";

export const metadata = { title: "Edit service or product" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const item = await db.catalogItem.findFirst({ where: { id, workspaceId: user.workspaceId }, include: { agents: true } });
  if (!item) notFound();
  const agents = await db.agent.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const canEdit = user.role !== "STAFF";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/services" className="hover:underline">Services &amp; Products</Link> / {item.name}</p>
        <h1 className="text-2xl font-extrabold">{item.name}</h1>
        {!canEdit && <p className="text-sm text-muted">You can view this item. Ask an owner or admin to change it.</p>}
      </header>
      <ServiceForm
        action={saveService.bind(null, item.id)}
        agents={agents}
        canEdit={canEdit}
        initial={{
          type: item.type, name: item.name, description: item.description ?? "", priceText: item.priceText ?? "",
          mayQuotePrice: item.mayQuotePrice, whenToOffer: item.whenToOffer ?? "", nextAction: item.nextAction ?? "",
          trialDays: item.trialDays?.toString() ?? "", signupUrl: item.signupUrl ?? "", isActive: item.isActive,
          agentIds: item.agents.map((a) => a.agentId),
        }}
      />
    </div>
  );
}
