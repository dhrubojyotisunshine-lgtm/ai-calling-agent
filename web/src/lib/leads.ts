// Lead pipeline stages, in board order. Safe for client and server.

export const STAGES = [
  { value: "NEW", label: "New", tone: "border-line bg-paper text-ink" },
  { value: "CONTACTED", label: "Contacted", tone: "border-info/20 bg-info-soft text-info" },
  { value: "INTERESTED", label: "Interested", tone: "border-warn/30 bg-warn-soft text-warn" },
  { value: "DEMO_PROPOSAL", label: "Demo / proposal", tone: "border-brand/20 bg-brand-soft text-brand" },
  { value: "WON", label: "Won", tone: "border-ok/30 bg-ok-soft text-ok" },
  { value: "LOST", label: "Lost", tone: "border-bad/20 bg-bad-soft text-bad" },
] as const;

export type Stage = (typeof STAGES)[number]["value"];

export const STAGE_VALUES = STAGES.map((s) => s.value) as [Stage, ...Stage[]];

export function stageInfo(value: string) {
  return STAGES.find((s) => s.value === value) ?? STAGES[0];
}

export const IMPORT_MAX_ROWS = 10000;
