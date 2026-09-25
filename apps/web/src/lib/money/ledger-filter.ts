import { parseVnd } from "./parse.ts";
import { normalize } from "./quick-add.ts";
import type { MoneyKind, MoneyTransaction } from "./types.ts";

/**
 * Sổ filter: kind, categories, date range, flags, amount range and free text. The smart box turns a sentence
 * ("ăn uống tuần này trên 200k") into these fields; the dropdowns edit the same fields. Everything runs locally.
 */
export interface LedgerFilter {
  kinds: MoneyKind[];
  categories: string[];
  /** YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
  forChild?: boolean;
  monthly?: boolean;
  min?: number;
  max?: number;
  /** Words matched against the entry's content. */
  text: string;
}

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const at = (value: string) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (value: string, days: number) => { const date = at(value); date.setDate(date.getDate() + days); return iso(date); };

export const monthRange = (month: string) => { const [y, m] = month.split("-").map(Number); return { from: `${month}-01`, to: iso(new Date(y, m, 0)) }; };

export type RangePreset = "week" | "month" | "7d" | "30d" | "lastMonth" | "year" | "today" | "yesterday" | "lastWeek";
export const PRESET_LABELS: Array<[RangePreset, string]> = [["week", "Tuần này"], ["month", "Tháng này"], ["7d", "7 ngày qua"], ["30d", "30 ngày qua"], ["lastMonth", "Tháng trước"], ["year", "Từ đầu năm"]];

/** Date range for a preset, relative to `today` (weeks run Monday–Sunday). */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const weekday = (at(today).getDay() + 6) % 7; // Monday = 0
  switch (preset) {
    case "today": return { from: today, to: today };
    case "yesterday": { const day = addDays(today, -1); return { from: day, to: day }; }
    case "week": return { from: addDays(today, -weekday), to: addDays(today, 6 - weekday) };
    case "lastWeek": return { from: addDays(today, -weekday - 7), to: addDays(today, -weekday - 1) };
    case "7d": return { from: addDays(today, -6), to: today };
    case "30d": return { from: addDays(today, -29), to: today };
    case "month": return monthRange(today.slice(0, 7));
    case "lastMonth": { const date = at(today); date.setDate(1); date.setMonth(date.getMonth() - 1); return monthRange(iso(date).slice(0, 7)); }
    case "year": return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** The preset a range matches (for labels), if any. */
export const presetOf = (from: string, to: string, today: string) => PRESET_LABELS.find(([key]) => { const range = presetRange(key, today); return range.from === from && range.to === to; })?.[0];

const dmy = (text: string, today: string) => {
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (!match) return null;
  let year = match[3] ? Number(match[3]) : Number(today.slice(0, 4));
  if (match[3] && match[3].length <= 2) year += 2000;
  const day = Number(match[1]); const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return iso(new Date(year, month - 1, day));
};

export interface ParsedQuery { patch: Partial<LedgerFilter>; text: string }

/**
 * A typed sentence → filter fields. Understands kinds (thu / chi / tiết kiệm), the family's category names, time
 * words (hôm nay, tuần này, tháng trước, 7 ngày, từ 1/9 đến 15/9…), amounts (trên 200k, dưới 1tr, khoản lớn),
 * "cho con", "hằng tháng". Words left over search the entry's content.
 */
export function parseFilterQuery(query: string, categories: string[], today: string): ParsedQuery {
  // Like normalize(), but keeps what dates and amounts need: "1/9", "1,5tr", "> 200k".
  let rest = ` ${query.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/,(?!\d)/g, " ").replace(/[^a-z0-9%/<>=.,]+/g, " ")} `.replace(/\s+/g, " ");
  const patch: Partial<LedgerFilter> = {};
  const take = (pattern: RegExp, handle: (match: RegExpMatchArray) => void) => { const match = rest.match(pattern); if (match) { handle(match); rest = rest.replace(match[0], " "); } };

  // Dates first ("từ 1/9 đến 15/9", "ngày 5/9") so their numbers are not read as amounts.
  take(/ (?:tu|tu ngay) (\d{1,2}\/\d{1,2}(?:\/\d{2,4})?) (?:den|toi|-) (\d{1,2}\/\d{1,2}(?:\/\d{2,4})?) /, (m) => { const from = dmy(m[1], today); const to = dmy(m[2], today); if (from && to) Object.assign(patch, from <= to ? { from, to } : { from: to, to: from }); });
  take(/ ngay (\d{1,2}\/\d{1,2}(?:\/\d{2,4})?) /, (m) => { const day = dmy(m[1], today); if (day) Object.assign(patch, { from: day, to: day }); });
  const presets: Array<[RegExp, RangePreset]> = [[/ hom nay /, "today"], [/ hom qua /, "yesterday"], [/ tuan nay /, "week"], [/ tuan truoc /, "lastWeek"], [/ thang nay /, "month"], [/ thang truoc /, "lastMonth"], [/ nam nay | tu dau nam /, "year"], [/ 7 ngay( qua)? /, "7d"], [/ 30 ngay( qua)? /, "30d"]];
  for (const [pattern, preset] of presets) take(pattern, () => Object.assign(patch, presetRange(preset, today)));

  // Amounts.
  const amount = "(\\d[\\d.,]*\\s?(?:k|nghin|ngan|tr|trieu|m|d|vnd)?\\d?)";
  take(new RegExp(` (?:tren|hon|lon hon|tu|>=?|>) ${amount} `), (m) => { const value = parseVnd(m[1].replace(/\s/g, "")); if (value) patch.min = Math.abs(value); });
  take(new RegExp(` (?:duoi|nho hon|<=?|<) ${amount} `), (m) => { const value = parseVnd(m[1].replace(/\s/g, "")); if (value) patch.max = Math.abs(value); });
  take(/ khoan lon /, () => { patch.min = 1_000_000; });

  // Flags.
  take(/ cho (?:con|be) /, () => { patch.forChild = true; });
  take(/ (?:hang thang|dinh ky|co dinh) /, () => { patch.monthly = true; });

  // Categories: the family's names, longest first ("tiền trả nợ quỹ" before "tiền trả nợ").
  const found: string[] = [];
  for (const name of [...categories].sort((a, b) => b.length - a.length)) {
    const key = ` ${normalize(name)} `;
    if (key.trim() && rest.includes(key)) { found.push(name); rest = rest.replace(key, " "); }
  }
  if (found.length) patch.categories = found;

  // Kinds (after categories, so "tiết kiệm" as a category is not also read as the kind).
  const kinds: MoneyKind[] = [];
  take(/ (?:khoan thu|thu nhap|thu) /, () => kinds.push("income"));
  take(/ (?:khoan chi|chi tieu|chi) /, () => kinds.push("expense"));
  take(/ (?:tiet kiem|gui tiet kiem) /, () => kinds.push("saving"));
  if (kinds.length) patch.kinds = kinds;

  return { patch, text: rest.replace(/\s+/g, " ").trim() };
}

/** Entries that pass the filter (date range, kinds, categories, flags, amounts, words in the content). */
export function applyFilter(entries: MoneyTransaction[], filter: LedgerFilter, monthlyIds: Set<string> = new Set()): MoneyTransaction[] {
  const words = normalize(filter.text).split(" ").filter(Boolean);
  return entries.filter((entry) => entry.occurredOn >= filter.from && entry.occurredOn <= filter.to
    && (!filter.kinds.length || filter.kinds.includes(entry.kind))
    && (!filter.categories.length || filter.categories.includes(entry.category))
    && (!filter.forChild || entry.forChild)
    && (!filter.monthly || (entry.recurringId !== undefined && monthlyIds.has(entry.recurringId)) || entry.source === "recurring")
    && (filter.min === undefined || Math.abs(entry.amount) >= filter.min)
    && (filter.max === undefined || Math.abs(entry.amount) <= filter.max)
    && (!words.length || words.every((word) => normalize(`${entry.content} ${entry.note ?? ""}`).includes(word))));
}

/** Whether anything beyond the month range is set (for "Xóa lọc"). */
export const isFiltering = (filter: LedgerFilter, month: string) => {
  const range = monthRange(month);
  return filter.kinds.length > 0 || filter.categories.length > 0 || filter.from !== range.from || filter.to !== range.to || Boolean(filter.forChild || filter.monthly) || filter.min !== undefined || filter.max !== undefined || filter.text.trim() !== "";
};
