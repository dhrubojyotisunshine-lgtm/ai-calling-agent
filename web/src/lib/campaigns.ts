// Campaign labels, limits and the cost estimate. Safe to import from client and server code.

export const CAMPAIGN_STATUSES = {
  DRAFT: { label: "Draft", tone: "border-line bg-paper text-muted" },
  SCHEDULED: { label: "Scheduled", tone: "border-info/30 bg-info-soft text-info" },
  RUNNING: { label: "Running", tone: "border-ok/30 bg-ok-soft text-ok" },
  PAUSED: { label: "Paused", tone: "border-warn/30 bg-warn-soft text-warn" },
  COMPLETED: { label: "Completed", tone: "border-brand/20 bg-brand/10 text-brand" },
  CANCELLED: { label: "Cancelled", tone: "border-bad/20 bg-bad-soft text-bad" },
} as const;
export type CampaignStatusKey = keyof typeof CAMPAIGN_STATUSES;

export const LEAD_STATUSES = {
  PENDING: { label: "Waiting", tone: "border-line bg-paper text-muted" },
  CALLING: { label: "Calling now", tone: "border-info/30 bg-info-soft text-info" },
  ANSWERED: { label: "Answered", tone: "border-ok/30 bg-ok-soft text-ok" },
  NO_ANSWER: { label: "No answer", tone: "border-warn/30 bg-warn-soft text-warn" },
  FAILED: { label: "Failed", tone: "border-bad/20 bg-bad-soft text-bad" },
  SKIPPED: { label: "Skipped", tone: "border-line bg-paper text-muted" },
} as const;
export type LeadStatusKey = keyof typeof LEAD_STATUSES;

// Which actions are allowed from which status.
export const CAN_EDIT: CampaignStatusKey[] = ["DRAFT", "SCHEDULED", "PAUSED"];
export const CAN_START: CampaignStatusKey[] = ["DRAFT", "PAUSED"];
export const CAN_PAUSE: CampaignStatusKey[] = ["SCHEDULED", "RUNNING"];
export const CAN_CANCEL: CampaignStatusKey[] = ["DRAFT", "SCHEDULED", "RUNNING", "PAUSED"];
export const CAN_DELETE: CampaignStatusKey[] = ["DRAFT", "COMPLETED", "CANCELLED"];

export const CAMPAIGN_MAX_LEADS = 10000;
export const MAX_RETRIES = 5;
export const RETRY_GAPS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 1440, label: "Next day" },
];

// Rough estimate only, until billing plans fix the real per-minute rates.
export const EST_RATE_PER_MIN = { ASSISTANT: 5, ANNOUNCEMENT: 2 } as const;
export const EST_MIN_PER_CALL = 1.5;
export function estimateCost(leads: number, mode: keyof typeof EST_RATE_PER_MIN): number {
  return Math.round(leads * EST_MIN_PER_CALL * EST_RATE_PER_MIN[mode]);
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// "2026-11-02T15:30" typed in IST -> Date (UTC). Returns null if not a valid value.
export function parseIstLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Date -> "2026-11-02T15:30" in IST, for <input type="datetime-local">.
export function toIstLocal(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d.getTime() + 330 * 60 * 1000).toISOString().slice(0, 16);
}

export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
