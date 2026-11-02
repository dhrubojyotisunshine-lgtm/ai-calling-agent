import "server-only";
import { db } from "@/lib/db";
import type { AgentOption } from "./CampaignForm";

// Agents that can make outgoing calls, team members, and the wallet balance for the campaign form.
export async function campaignFormOptions(workspaceId: string) {
  const [agents, team, ws] = await Promise.all([
    db.agent.findMany({
      where: { workspaceId, purpose: { in: ["OUTBOUND", "BOTH"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, mode: true, status: true, maxConcurrentCalls: true },
    }),
    db.user.findMany({ where: { workspaceId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { walletBalance: true, callWindowFrom: true, callWindowTo: true } }),
  ]);
  return {
    agents: agents as AgentOption[],
    team,
    balance: Number(ws.walletBalance),
    window: { from: ws.callWindowFrom, to: ws.callWindowTo },
  };
}
