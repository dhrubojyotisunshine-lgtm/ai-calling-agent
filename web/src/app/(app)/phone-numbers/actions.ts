"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type NumberAgentsState = { error?: string; ok?: boolean } | undefined;

// Sets which agents use this number. An agent uses one number, so choosing it here moves it off any other number.
export async function setNumberAgents(numberId: string, _prev: NumberAgentsState, form: FormData): Promise<NumberAgentsState> {
  const user = await requireRole("OWNER", "ADMIN");
  const workspaceId = user.workspaceId;
  const number = await db.phoneNumber.findFirst({ where: { id: numberId, workspaceId }, select: { id: true } });
  if (!number) return { error: "This number is no longer assigned to your workspace." };

  const ids = [...new Set(form.getAll("agents").map(String))].slice(0, 200);
  const agents = await db.agent.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, name: true, purpose: true } });
  if (agents.length !== ids.length) return { error: "One of the agents no longer exists. Reload and try again." };
  const answering = agents.filter((a) => a.purpose !== "OUTBOUND");
  if (answering.length > 1)
    return { error: `Only one agent can answer incoming calls on a number. ${answering.map((a) => a.name).join(" and ")} both answer calls; keep one, or make the other outbound only.` };

  await db.$transaction([
    db.agent.updateMany({ where: { workspaceId, phoneNumberId: numberId, id: { notIn: ids } }, data: { phoneNumberId: null } }),
    db.agent.updateMany({ where: { workspaceId, id: { in: ids } }, data: { phoneNumberId: numberId } }),
  ]);
  revalidatePath("/phone-numbers");
  revalidatePath("/agents");
  return { ok: true };
}
