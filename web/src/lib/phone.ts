// Phone number clean-up. Indian mobiles become +91XXXXXXXXXX; other numbers must already start with +country code.
// Safe to use in both browser and server code.

export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Excel sometimes turns long numbers into 9.19876543210E+11
  if (/^\d+(\.\d+)?e\+\d+$/i.test(s)) s = Number(s).toFixed(0);
  s = s.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);

  if (s.startsWith("+")) {
    const digits = s.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    if (digits.startsWith("91")) return /^91[6-9]\d{9}$/.test(digits) ? `+${digits}` : null;
    return `+${digits}`;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
  if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
  return /^[6-9]\d{9}$/.test(s) ? `+91${s}` : null;
}

// +919876543210 → +91 98765 43210, +9118001234567 → +91 1800 123 4567 (other countries are shown as stored)
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "-";
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  const tf = /^\+91(1800)(\d{3})(\d{3,4})$/.exec(e164);
  return tf ? `+91 ${tf[1]} ${tf[2]} ${tf[3]}` : e164;
}
