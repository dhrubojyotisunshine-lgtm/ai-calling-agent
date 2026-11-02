import "server-only";
import { db } from "@/lib/db";

// Agents that can call out, and active team members, for the follow-up form.
export async function followUpFormOptions(workspaceId: string) {
  const [agents, team] = await Promise.all([
    db.agent.findMany({ where: { workspaceId, purpose: { in: ["OUTBOUND", "BOTH"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { workspaceId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { agents, team };
}
