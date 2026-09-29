import { scheduleOf, windowIn } from "./fixed-items.ts";
import { parseVnd } from "./parse.ts";
import type { MoneyRecurring, RecurringSchedule } from "./types.ts";

/** The add/edit form of a fixed item as typed text, and its way back to a validated MoneyRecurring (pure, tested). */

export const SCHEDULE_KINDS: Array<{ kind: RecurringSchedule["kind"]; label: string }> = [
  { kind: "month", label: "Hằng tháng" }, { kind: "range", label: "Khoảng ngày" }, { kind: "eom", label: "Cuối tháng" }, { kind: "quarter", label: "Theo quý" }, { kind: "year", label: "Hằng năm" },
];
const MAX_VND = 100_000_000_000;

export interface RecurringForm {
  schedule: RecurringSchedule["kind"];
  name: string;
  kind: "expense" | "income";
  category: string;
  /** First day of the window (or the day itself). */
  day: string;
  /** Last day of the window: required for "khoảng ngày", optional for quarter/year, unused otherwise. */
  to: string;
  /** Yearly items only: the month, 1–12. */
  yearMonth: string;
  mode: "fixed" | "estimate";
  amount: string;
  /** "Tháng này đã xong rồi": undefined until the family touches it (then it follows whether the window has passed). */
  done?: boolean;
}

export const emptyForm = (category: string): RecurringForm => ({ schedule: "month", name: "", kind: "expense", category, day: "1", to: "", yearMonth: "12", mode: "fixed", amount: "" });

export function formFromItem(item: MoneyRecurring): RecurringForm {
  const schedule = scheduleOf(item);
  return {
    schedule: schedule.kind, name: item.name, kind: item.kind === "income" ? "income" : "expense", category: item.category,
    day: schedule.kind === "eom" ? "1" : String(item.dayOfMonth), to: "to" in schedule && schedule.to ? String(schedule.to) : "",
    yearMonth: schedule.kind === "year" ? String(schedule.month) : "12", mode: item.amountMode === "estimate" ? "estimate" : "fixed", amount: String(item.amount),
  };
}

const wholeNumber = (text: string) => /^\d{1,2}$/.test(text.trim()) ? Number(text) : null;

/** Has this month's window already ended today? "none" = the item does not come due this month at all. */
export function monthWindow(form: RecurringForm, month: string, today: string): "none" | "passed" | "open" {
  const day = wholeNumber(form.day) ?? 1; const to = wholeNumber(form.to);
  const schedule: RecurringSchedule = form.schedule === "range" ? { kind: "range", to: to ?? day } : form.schedule === "quarter" ? { kind: "quarter", to: to ?? undefined } : form.schedule === "year" ? { kind: "year", month: wholeNumber(form.yearMonth) ?? 12, to: to ?? undefined } : { kind: form.schedule };
  const window = windowIn({ schedule, dayOfMonth: day }, month);
  if (!window) return "none";
  return today > `${month}-${String(window.to).padStart(2, "0")}` ? "passed" : "open";
}

/** Whether a new item starts with this month marked as done (the family's choice, else "yes" once the window has passed). */
export const isDone = (form: RecurringForm, month: string, today: string) => monthWindow(form, month, today) === "none" ? false : form.done ?? monthWindow(form, month, today) === "passed";

/** The typed form → a full item, or the message telling what to fix (the same limits the API applies). */
export function readForm(form: RecurringForm, ctx: { id: string; month: string; today: string; existing?: MoneyRecurring }): { item: MoneyRecurring } | { error: string } {
  const name = form.name.trim();
  if (!name) return { error: "Nhập tên khoản (ví dụ: Tiền điện)." };
  if (name.length > 80) return { error: "Tên khoản tối đa 80 ký tự." };
  if (!form.category) return { error: "Chọn nhóm cho khoản này." };
  const amount = parseVnd(form.amount);
  if (amount === null || amount <= 0 || amount > MAX_VND) return { error: "Số tiền chưa đúng (ví dụ 600k hoặc 6tr)." };
  const eom = form.schedule === "eom";
  const day = eom ? 31 : wholeNumber(form.day);
  if (day === null || day < 1 || day > 31) return { error: form.schedule === "year" ? "Ngày trong tháng cần từ 1 đến 31." : "Ngày cần từ 1 đến 31." };
  const to = form.to.trim() ? wholeNumber(form.to) : undefined;
  const needsTo = form.schedule === "range";
  if (needsTo && to === undefined) return { error: "Nhập “đến ngày” cho khoảng ngày (ví dụ 5 đến 12)." };
  if ((needsTo || form.schedule === "quarter" || form.schedule === "year") && to !== undefined && (to === null || to < day || to > 31)) return { error: `“Đến ngày” cần từ ${day} đến 31.` };
  const yearMonth = wholeNumber(form.yearMonth);
  if (form.schedule === "year" && (yearMonth === null || yearMonth < 1 || yearMonth > 12)) return { error: "Tháng cần từ 1 đến 12." };
  const schedule: RecurringSchedule = form.schedule === "range" ? { kind: "range", to: to! } : form.schedule === "quarter" ? { kind: "quarter", ...(to ? { to } : {}) } : form.schedule === "year" ? { kind: "year", month: yearMonth!, ...(to ? { to } : {}) } : { kind: form.schedule };
  const lastPostedMonth = ctx.existing ? ctx.existing.lastPostedMonth : isDone(form, ctx.month, ctx.today) ? ctx.month : undefined;
  return { item: { id: ctx.id, name, kind: form.kind, category: form.category, amount, dayOfMonth: day, active: ctx.existing?.active ?? true, schedule, amountMode: form.mode, lastPostedMonth } };
}

/** The sentence under the form: what the family is about to create, in their words. */
export function previewText(form: RecurringForm): { name: string; rest: string } {
  const day = form.day.trim() || "…"; const to = form.to.trim();
  const range = to ? `nhắc từ ngày ${day} đến ${to}` : `nhắc từ ngày ${day}`;
  const when = { month: `hằng tháng vào ngày ${day}`, range: `hằng tháng, nhắc từ ngày ${day} đến ${to || "…"}`, eom: "vào cuối mỗi tháng", quarter: `mỗi quý (tháng 1, 4, 7, 10), ${range}`, year: `mỗi năm vào tháng ${form.yearMonth.trim() || "…"}, ${range}` }[form.schedule];
  const parsed = parseVnd(form.amount); const money = parsed && parsed > 0 ? Math.round(parsed).toLocaleString("vi-VN") + "đ" : "…";
  const how = form.mode === "estimate" ? `Số tiền ước lượng ~${money} lần đầu, sau đó tự lấy trung bình 3 kỳ gần nhất.` : `Số tiền cố định ${money}.`;
  return { name: form.name.trim() || "Khoản này", rest: `${when}. Không tự ghi: tới kỳ app hỏi “${form.kind === "income" ? "Đã nhận?" : "Đã trả?"}”. ${how}` };
}
