/**
 * Money input the way people type it in Vietnam: "350k", "1,5m", "350.000", "2tr5", "-698000".
 * Returns integer VND or null when the text is not an amount.
 */
export function parseVnd(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "").replace(/đ|vnd|d$/g, "");
  if (!raw) return null;
  const sign = raw.startsWith("-") || raw.startsWith("−") ? -1 : 1;
  const body = raw.replace(/^[-−+]/, "");
  // "2tr5" / "2m5" = 2.5 million
  const mixed = body.match(/^(\d+)(tr|m)(\d)$/);
  if (mixed) return sign * (Number(mixed[1]) * 1_000_000 + Number(mixed[3]) * 100_000);
  const match = body.match(/^(\d+(?:[.,]\d+)?|\d{1,3}(?:[.,]\d{3})+)(k|nghìn|ngàn|tr|triệu|trieu|m)?$/);
  if (!match) return null;
  let digits = match[1];
  const unit = match[2];
  // Thousands separators ("350.000", "1,200,000") vs decimal ("1,5"): three-digit groups are separators.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(digits)) digits = digits.replace(/[.,]/g, "");
  else digits = digits.replace(",", ".");
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  const factor = unit === "k" || unit === "nghìn" || unit === "ngàn" ? 1000 : unit ? 1_000_000 : 1;
  const amount = Math.round(value * factor);
  return amount === 0 ? null : sign * amount;
}

/** Local YYYY-MM-DD for today (Vietnam is UTC+7; toISOString alone would roll the date before 07:00). */
export const todayLocal = (now = new Date()) => new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
