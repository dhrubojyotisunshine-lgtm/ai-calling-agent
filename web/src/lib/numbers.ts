// Business phone numbers (what agents call from / answer on). Unlike lead numbers these can be landlines or
// toll-free (e.g. +91 80 4567 8901, 1800 …), so they are not limited to Indian mobiles.

// Returns E.164 (+<country><number>) or null. Indian numbers may be typed with 0 or without +91.
export function normalizeDid(raw: string): string | null {
  const s = raw.trim().replace(/[\s\-().]/g, "");
  let digits: string;
  if (/^\+\d+$/.test(s)) digits = s.slice(1);
  else if (/^00\d+$/.test(s)) digits = s.slice(2);
  else if (/^0\d{10}$/.test(s)) digits = "91" + s.slice(1); // 080 4567 8901
  else if (/^1800\d{6,7}$/.test(s)) digits = "91" + s; // toll-free
  else if (/^\d{10}$/.test(s)) digits = "91" + s;
  else return null;
  if (digits.startsWith("91") && !/^91\d{10,11}$/.test(digits)) return null;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return "+" + digits;
}

export const CHANNELS_MAX = 30;

// Days until the rent is due (negative = overdue), or null if no date.
export function daysUntil(d: Date | null, now = new Date()): number | null {
  return d ? Math.ceil((d.getTime() - now.getTime()) / 86_400_000) : null;
}
