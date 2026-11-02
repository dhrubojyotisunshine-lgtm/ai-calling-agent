import "server-only";
import { db } from "@/lib/db";

// Catalog items and team members a lead in this workspace can be linked to.
export async function leadFormOptions(workspaceId: string) {
  const [catalog, team] = await Promise.all([
    db.catalogItem.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { workspaceId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { catalog, team };
}
