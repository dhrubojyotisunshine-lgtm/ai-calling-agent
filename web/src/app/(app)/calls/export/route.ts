import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { DIRECTIONS, OUTCOMES, callStatus } from "@/lib/calls";
import { dateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { callWhere, pickFilters } from "../filters";

const MAX_ROWS = 10000;

// A cell starting with = @ (or + - not followed by a digit) could run as a formula in Excel, so prefix it with '.
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=@\t\r]/.test(s) || /^[+-][^\d\s]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await requireRole("OWNER", "ADMIN");
  const sp = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  const calls = await db.call.findMany({
    where: callWhere(user.workspaceId, pickFilters(sp)),
    orderBy: { startedAt: "desc" },
    take: MAX_ROWS,
    include: { lead: { select: { name: true } }, agent: { select: { name: true } }, campaign: { select: { name: true } } },
  });

  const header = ["Date (IST)", "Name", "Number", "Type", "Agent", "Campaign", "Result", "Outcome", "Duration (sec)", "Rate per min (₹)", "Charge (₹)", "Summary"];
  const lines = calls.map((c) => {
    const number = c.direction === "INBOUND" ? c.fromNumber : c.toNumber;
    return [
      dateTime(c.startedAt), c.lead?.name ?? "", number ? formatPhone(number) : "", DIRECTIONS[c.direction], c.agent?.name ?? "",
      c.campaign?.name ?? "", callStatus(c).label, c.outcome ? OUTCOMES[c.outcome].label : "", c.durationSec,
      c.ratePerMin?.toString() ?? "", c.totalCharge.toString(), c.summary ?? "",
    ].map(cell).join(",");
  });
  // BOM so Excel opens ₹ and Hindi text correctly.
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
