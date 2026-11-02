// Follow-up labels and the "overdue / today / upcoming" buckets. Safe for client and server.
import { startOfTodayIST } from "./format";

export const KINDS = {
  AI_CALLBACK: { label: "Agent calls back", tone: "border-brand/20 bg-brand/10 text-brand" },
  STAFF_TASK: { label: "Team task", tone: "border-info/30 bg-info-soft text-info" },
} as const;
export type KindKey = keyof typeof KINDS;

export const FU_STATUSES = {
  OPEN: { label: "Open", tone: "border-warn/30 bg-warn-soft text-warn" },
  DONE: { label: "Done", tone: "border-ok/30 bg-ok-soft text-ok" },
  CANCELLED: { label: "Cancelled", tone: "border-line bg-paper text-muted" },
} as const;
export type FuStatusKey = keyof typeof FU_STATUSES;

export const TITLE_MAX = 255;

// Overdue = open and its time has passed. Today = open, still to come today (India time). Upcoming = after today.
export function buckets(now = new Date()) {
  const endOfToday = new Date(startOfTodayIST(now).getTime() + 86_400_000);
  return {
    overdue: { status: "OPEN" as const, dueAt: { lt: now } },
    today: { status: "OPEN" as const, dueAt: { gte: now, lt: endOfToday } },
    upcoming: { status: "OPEN" as const, dueAt: { gte: endOfToday } },
    done: { status: "DONE" as const },
    cancelled: { status: "CANCELLED" as const },
  };
}
export type BucketKey = keyof ReturnType<typeof buckets>;
