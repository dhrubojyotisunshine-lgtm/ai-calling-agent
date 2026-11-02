// Display helpers. All times are shown in India time (IST).
type Num = number | string | { toString(): string } | null | undefined;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function money(value: Num): string {
  return inr.format(Number(value ?? 0));
}

export function dateTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function duration(sec: number): string {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

const IST_OFFSET_MS = 330 * 60 * 1000;

// Midnight today in IST, as a UTC Date.
export function startOfTodayIST(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

// First day of this month in IST, as a UTC Date.
export function startOfMonthIST(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCDate(1);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}
