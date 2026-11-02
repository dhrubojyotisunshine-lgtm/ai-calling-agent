import "server-only";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";

// Phone numbers and catalog items this workspace may attach to an agent.
export async function agentFormOptions(workspaceId: string) {
  const [numbers, items] = await Promise.all([
    db.phoneNumber.findMany({ where: { workspaceId }, orderBy: { e164: "asc" } }),
    db.catalogItem.findMany({ where: { workspaceId, isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    phoneNumbers: numbers.map((n) => ({ id: n.id, label: `${formatPhone(n.e164)} · ${n.channels} line${n.channels > 1 ? "s" : ""}` })),
    catalog: items.map((c) => ({
      id: c.id,
      label: c.name,
      hint: [c.type === "PRODUCT" ? "Product" : "Service", c.priceText].filter(Boolean).join(" · "),
    })),
  };
}
