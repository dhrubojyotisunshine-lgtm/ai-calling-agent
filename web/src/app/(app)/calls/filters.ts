import "server-only";
import type { CallDirection, CallOutcome, Prisma } from "@prisma/client";
import { DIRECTIONS, OUTCOMES } from "@/lib/calls";

export type CallFilters = {
  q?: string; result?: string; dir?: string; outcome?: string; agent?: string; campaign?: string; from?: string; to?: string;
};

export const RESULTS = [
  { value: "answered", label: "Answered" },
  { value: "no_answer", label: "No answer / busy" },
  { value: "failed", label: "Failed" },
  { value: "live", label: "In progress" },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// "2026-11-02" (India date) -> midnight IST as a UTC Date.
const istMidnight = (d: string) => new Date(`${d}T00:00:00+05:30`);

// Turns the URL filters into a query that is always limited to this workspace.
export function callWhere(workspaceId: string, f: CallFilters): Prisma.CallWhereInput {
  const and: Prisma.CallWhereInput[] = [{ workspaceId }];
  const q = (f.q ?? "").trim().slice(0, 80);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const tail = digits.length > 10 ? digits.slice(-10) : digits;
    and.push({
      OR: [
        { lead: { name: { contains: q } } },
        ...(digits.length >= 3 ? [{ toNumber: { contains: tail } }, { fromNumber: { contains: tail } }] : []),
      ],
    });
  }
  if (f.result === "answered") and.push({ durationSec: { gt: 0 } });
  else if (f.result === "no_answer") and.push({ durationSec: 0, status: { in: ["NO_ANSWER", "BUSY", "COMPLETED"] } });
  else if (f.result === "failed") and.push({ status: "FAILED" });
  else if (f.result === "live") and.push({ status: { in: ["QUEUED", "RINGING", "IN_PROGRESS"] } });
  if (f.dir && f.dir in DIRECTIONS) and.push({ direction: f.dir as CallDirection });
  if (f.outcome && f.outcome in OUTCOMES) and.push({ outcome: f.outcome as CallOutcome });
  if (f.agent) and.push({ agentId: f.agent });
  if (f.campaign) and.push({ campaignId: f.campaign });
  if (f.from && DAY.test(f.from)) and.push({ startedAt: { gte: istMidnight(f.from) } });
  if (f.to && DAY.test(f.to)) and.push({ startedAt: { lt: new Date(istMidnight(f.to).getTime() + 86_400_000) } });
  return { AND: and };
}

export function pickFilters(sp: Record<string, string | undefined>): CallFilters {
  const { q, result, dir, outcome, agent, campaign, from, to } = sp;
  return Object.fromEntries(Object.entries({ q, result, dir, outcome, agent, campaign, from, to }).filter(([, v]) => v)) as CallFilters;
}
