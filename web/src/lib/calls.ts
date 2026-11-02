// Call labels shared by Call history, lead pages and campaigns. Safe for client and server.

export const CALL_STATUSES = {
  QUEUED: { label: "Queued", tone: "border-line bg-paper text-muted" },
  RINGING: { label: "Ringing", tone: "border-info/30 bg-info-soft text-info" },
  IN_PROGRESS: { label: "On call", tone: "border-info/30 bg-info-soft text-info" },
  COMPLETED: { label: "Answered", tone: "border-ok/30 bg-ok-soft text-ok" },
  NO_ANSWER: { label: "No answer", tone: "border-warn/30 bg-warn-soft text-warn" },
  BUSY: { label: "Busy", tone: "border-warn/30 bg-warn-soft text-warn" },
  FAILED: { label: "Failed", tone: "border-bad/20 bg-bad-soft text-bad" },
} as const;
export type CallStatusKey = keyof typeof CALL_STATUSES;

export const OUTCOMES = {
  INTERESTED: { label: "Interested", tone: "border-ok/30 bg-ok-soft text-ok" },
  NOT_INTERESTED: { label: "Not interested", tone: "border-bad/20 bg-bad-soft text-bad" },
  CALLBACK: { label: "Call back later", tone: "border-warn/30 bg-warn-soft text-warn" },
  MESSAGE_PLAYED: { label: "Message played", tone: "border-info/30 bg-info-soft text-info" },
  NO_DECISION: { label: "No decision", tone: "border-line bg-paper text-muted" },
} as const;
export type OutcomeKey = keyof typeof OUTCOMES;

export const DIRECTIONS = {
  OUTBOUND: "Outgoing",
  INBOUND: "Incoming",
  BROWSER_TEST: "Test call",
} as const;
export type DirectionKey = keyof typeof DIRECTIONS;

// A call marked "completed" that nobody answered (0 seconds, never picked up) is shown as "No answer",
// so 0-second calls never look like real conversations.
export function callStatus(c: { status: CallStatusKey; durationSec: number; answeredAt: Date | null }) {
  if (c.status === "COMPLETED" && c.durationSec === 0 && !c.answeredAt) return CALL_STATUSES.NO_ANSWER;
  return CALL_STATUSES[c.status];
}

// Only play recordings from http(s) links.
export function safeRecordingUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
