import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveService } from "../actions";
import { ServiceForm } from "../ServiceForm";

export const metadata = { title: "Add service or product" };

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireRole("OWNER", "ADMIN");
  const type = (await searchParams).type === "PRODUCT" ? "PRODUCT" : "SERVICE";
  const agents = await db.agent.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/services" className="hover:underline">Services &amp; Products</Link> / New</p>
        <h1 className="text-2xl font-extrabold">Add a {type === "PRODUCT" ? "product" : "service"}</h1>
      </header>
      <ServiceForm
        action={saveService.bind(null, null)}
        agents={agents}
        canEdit
        initial={{ type, name: "", description: "", priceText: "", mayQuotePrice: true, whenToOffer: "", nextAction: "", trialDays: "", signupUrl: "", isActive: true, agentIds: [] }}
      />
    </div>
  );
}
