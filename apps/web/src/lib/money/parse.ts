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

/**
 * Thousand separators while typing an amount: "1500000" → "1.500.000". Only plain numbers are touched; shorthand
 * ("35k", "2tr5", "1,5tr") and a decimal in progress ("1.5", "2.25" before a unit) are left exactly as typed.
 */
export function groupAmountTyping(text: string): string {
  if (!/^[-−]?[\d.]*\d[\d.]*$/.test(text) || /^[-−]?\d+\.\d{1,2}$/.test(text)) return text;
  const sign = /^[-−]/.test(text) ? "-" : "";
  const digits = text.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "2026-09-25" → "25/09/2026" (the family's date format everywhere in Tài chính). */
export const formatVnDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/**
 * Typed date → ISO: "25/09/2026", "25-9-26", "5/9" (this year), "25092026". Null when it is not a real date.
 * `today` (YYYY-MM-DD) supplies the year when it is left out.
 */
export function parseVnDate(text: string, today = todayLocal()): string | null {
  const raw = text.trim();
  const digits = /^\d{8}$/.test(raw) ? [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4)] : raw.split(/[/.\-\s]+/);
  if (digits.length < 2 || digits.length > 3 || digits.some((part) => !/^\d+$/.test(part))) return null;
  const day = Number(digits[0]); const month = Number(digits[1]);
  let year = digits[2] ? Number(digits[2]) : Number(today.slice(0, 4));
  if (digits[2] && digits[2].length <= 2) year += 2000;
  if (!(year >= 1900 && year <= 2100) || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Slashes while typing a date: "2509" → "25/09", "25092026" → "25/09/2026"; text with separators is left as typed. */
export function maskVnDate(text: string): string {
  // Re-mask only digits and the slashes this mask put in (positions 2 and 5); "5/9" typed by hand stays as is.
  if (!/^[\d/]*$/.test(text) || [...text].some((char, index) => char === "/" && index !== 2 && index !== 5)) return text;
  const d = text.replace(/\//g, "").slice(0, 8);
  return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
