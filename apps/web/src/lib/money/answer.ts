import { vnd } from "../catalog/format.ts";
import { isLoanEntry } from "./loans.ts";
import type { MonthSummary } from "./summary.ts";
import type { MoneyTransaction } from "./types.ts";

/**
 * Family Coordinator, money side (SPEC_V2 §18): detect a finance question and answer it from the month
 * summary with templates — rules before models (§43). Shopping phrasing ("bỉm dưới 350k", "nới ngân sách")
 * is deliberately left to the shopping pipeline.
 */
export type MoneyQuestion = "overview" | "remaining" | "category" | "upcoming" | "savings" | "child" | "balance";
/** Which slice of the ledger a question is about; "week" = the 7 days ending today, "lastMonth" = the previous calendar month. */
export type MoneyPeriod = "month" | "week" | "lastMonth";

const lowerVi = (text: string) => text.toLocaleLowerCase("vi");
const fold = (text: string) => lowerVi(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const L = "(?<![\\p{L}])";
const R = "(?![\\p{L}])";
// Shopping words. Typed with diacritics they match exactly, so finance words such as "nói", "sửa" or "nới" are not
// read as "tìm"/"sữa"; typed without diacritics only the folded spelling exists.
const SHOPPING = {
  accented: new RegExp(`${L}(?:bỉm|tã|sữa|khăn|nước giặt|mua|tìm|so sánh|size|kg|miếng|(?:nới|tăng) (?:ngân sách|giá|mức giá)|gợi ý|đề xuất)${R}|(?:dưới|trên)\\s*\\d`, "u"),
  folded: new RegExp(`${L}(?:bim|ta|sua|khan|nuoc giat|mua|tim|so sanh|size|kg|mieng|(?:noi|tang) (?:ngan sach|gia|muc gia)|goi y|de xuat)${R}|(?:duoi|tren)\\s*\\d`, "u"),
};
/** "mua sắm" is a spending category, not a purchase request. */
function isShopping(message: string): boolean {
  const lower = lowerVi(message);
  const accented = fold(lower) !== lower;
  return SHOPPING[accented ? "accented" : "folded"].test(lower.replace(accented ? /mua sắm/g : /mua sam/g, " "));
}

// "cập nhật kế hoạch chi 20 triệu" edits the plan; it is not a question about what is left.
const PLAN_EDIT = /^(?:(?:giup|nho|hay|lam on|vui long)\s+(?:minh|toi|em)?\s*)*(?:cap nhat|dat|sua|doi|thay|chinh|dieu chinh|tang|giam|nang|ha)\s+(?:lai\s+)?(?:muc\s+)?ke hoach/;
export const isMoneyPlanEdit = (message: string) => PLAN_EDIT.test(fold(message).trim()) && /\d/.test(message);
/** Chat cannot edit the plan; this points to where it is set (Tài chính → Mục tiêu → "Kế hoạch chi mỗi tháng"). */
export const MONEY_PLAN_EDIT_REPLY = { text: "Mình chưa sửa kế hoạch chi tháng qua tin nhắn được. Bạn vào Tài chính → tab Mục tiêu, mục “Kế hoạch chi mỗi tháng”, nhập số mới rồi bấm Lưu nhé.", choices: ["Còn bao nhiêu trong kế hoạch?", "Tháng này tiêu thế nào?"] };

export function detectMoneyPeriod(message: string): MoneyPeriod {
  const plain = fold(message);
  if (/thang (truoc|ngoai|vua roi|qua)/.test(plain)) return "lastMonth";
  if (/(tuan (nay|qua)|7 ngay (qua|gan day|vua qua))/.test(plain)) return "week";
  return "month";
}

export function detectMoneyQuestion(message: string): MoneyQuestion | null {
  if (isShopping(message) || isMoneyPlanEdit(message)) return null;
  const plain = fold(message);
  if (/(so du|con bao nhieu tien|tien mat|tai khoan con)/.test(plain)) return "balance";
  if (/(sap toi|den han|hoa don|dinh ky|phai tra)/.test(plain)) return "upcoming";
  if (/(tiet kiem|de danh|muc tieu)/.test(plain)) return "savings";
  if (/(cho con|cho be|tien con|em be)/.test(plain) && /(tieu|chi|ton|het)/.test(plain)) return "child";
  if (/(con bao nhieu|con lai|du bao nhieu|vuot|qua tay|ke hoach)/.test(plain) && /(ngan sach|ke hoach|tieu|chi|tien)/.test(plain)) return "remaining";
  if (/(an uong|tieu dung|gia dinh|kham|thuoc|giai tri|hoc tap|dien|nuoc|tra gop|nhom|di dau|vao dau|nhieu nhat)/.test(plain) && /(tieu|chi|tien|ton|het)/.test(plain)) return "category";
  if (/(tieu|chi tieu|da chi|thu nhap|thu chi|tinh hinh tai chinh|tien nong|tong ket)/.test(plain) && /(thang|tuan|nay|bao nhieu|the nao|sao|ra sao|tong)/.test(plain)) return "overview";
  return null;
}

/** The 7 days ending today (inclusive), from the raw ledger; loan entries are not income or spending, as in the month summary. */
export interface WeekSummary { from: string; to: string; income: number; expense: number; saving: number; childSpend: number; byCategory: Array<{ category: string; spent: number }>; count: number }

const addDays = (date: string, days: number) => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + days)).toISOString().slice(0, 10);
const dayMonth = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;

export function summarizeWeek(transactions: MoneyTransaction[], today: string): WeekSummary {
  const from = addDays(today, -6);
  const inWeek = transactions.filter((item) => item.occurredOn >= from && item.occurredOn <= today && !isLoanEntry(item));
  const week: WeekSummary = { from, to: today, income: 0, expense: 0, saving: 0, childSpend: 0, byCategory: [], count: inWeek.length };
  const byCategory = new Map<string, number>();
  for (const item of inWeek) {
    week[item.kind] += item.amount;
    if (item.kind !== "expense") continue;
    if (item.forChild) week.childSpend += item.amount;
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount);
  }
  week.byCategory = [...byCategory].map(([category, spent]) => ({ category, spent })).sort((a, b) => b.spent - a.spent);
  return week;
}

function answerWeek(kind: MoneyQuestion, week: WeekSummary, message: string): { text: string; choices: string[] } {
  const label = `7 ngày qua (${dayMonth(week.from)}–${dayMonth(week.to)})`;
  if (week.count === 0) return { text: `Sổ thu chi ${label} chưa có khoản nào nên mình chưa trả lời được. Ghi vài khoản ở mục Tài chính rồi hỏi lại nhé.`, choices: ["Mở Tài chính", "Tháng này tiêu thế nào?"] };
  const top = week.byCategory.slice(0, 3).map((line) => `${line.category} ${vnd(line.spent)}`).join(", ");
  const more = ["Tháng này tiêu thế nào?", "Tháng trước tiêu thế nào?"];
  if (kind === "category") {
    const asked = week.byCategory.find((line) => fold(message).includes(fold(line.category)));
    if (asked) return { text: `${asked.category} trong ${label}: đã chi ${vnd(asked.spent)}.`, choices: more };
    return { text: top ? `${label} tiền đi nhiều nhất vào: ${top}.${week.childSpend ? ` Chi cho con ${vnd(week.childSpend)}.` : ""}` : `${label} chưa có khoản chi nào.`, choices: more };
  }
  if (kind === "child") return { text: week.childSpend ? `Chi cho con trong ${label}: ${vnd(week.childSpend)}${week.expense ? ` — ${Math.round(week.childSpend / week.expense * 100)}% tổng chi` : ""}.` : `${label} chưa có khoản nào đánh dấu “cho con”.`, choices: more };
  return { text: `${label}: thu ${vnd(week.income)}, đã chi ${vnd(week.expense)}${week.saving ? `, chuyển tiết kiệm ${vnd(week.saving)}` : ""}.${top ? ` Chi nhiều nhất: ${top}.` : ""}`, choices: more };
}

/**
 * Templated answer. `period` "week" needs `week` (from summarizeWeek); "lastMonth" expects `summary` to be last month's.
 * Balance, upcoming bills, savings and the plan are not week-shaped, so they answer for the month and say so.
 */
export function answerMoney(kind: MoneyQuestion, summary: MonthSummary, message = "", options: { period?: MoneyPeriod; week?: WeekSummary } = {}): { text: string; choices: string[] } {
  const { period = "month", week } = options;
  if (period === "week" && week && (kind === "overview" || kind === "category" || kind === "child")) return answerWeek(kind, week, message);
  const m = `tháng ${Number(summary.month.slice(5))}${period === "lastMonth" ? " (tháng trước)" : ""}`;
  const answered = answerMonth(kind, summary, message, m);
  return period === "week" && (kind === "remaining" || kind === "savings") ? { ...answered, text: `Mục này tính theo tháng nên mình trả lời theo ${m}. ${answered.text}` } : answered;
}

function answerMonth(kind: MoneyQuestion, summary: MonthSummary, message: string, m: string): { text: string; choices: string[] } {
  const cap = `${m.charAt(0).toUpperCase()}${m.slice(1)}`;
  if (summary.transactionCount === 0 && kind !== "upcoming" && kind !== "balance") return { text: `Sổ thu chi ${m} chưa có khoản nào nên mình chưa trả lời được. Ghi vài khoản ở mục Tài chính (như Excel: ngày · nội dung · nhóm · số tiền) rồi hỏi lại nhé.`, choices: ["Mở Tài chính", "Khoản nào sắp đến hạn?"] };
  const top = summary.byCategory.slice(0, 3).map((line) => `${line.category} ${vnd(line.spent)}${line.limit ? ` (${Math.round((line.ratio ?? 0) * 100)}% ngân sách)` : ""}`).join(", ");
  const pace = summary.plan && summary.expectedExpense ? summary.paceRatio! > 1.05 ? ` Với nhịp này, cuối tháng sẽ chi khoảng ${vnd(summary.expectedExpense)} — cao hơn kế hoạch ${vnd(summary.plan)} khoảng ${Math.round((summary.paceRatio! - 1) * 100)}%.` : ` Nhịp chi đang trong kế hoạch ${vnd(summary.plan)} (dự kiến ${vnd(summary.expectedExpense)}).` : "";
  switch (kind) {
    case "overview":
      return { text: `${cap}: thu ${vnd(summary.income)}, đã chi ${vnd(summary.expense)}${summary.saving ? `, chuyển tiết kiệm ${vnd(summary.saving)}` : ""}.${top ? ` Chi nhiều nhất: ${top}.` : ""}${pace}`, choices: ["Tiền đi đâu nhiều nhất?", "Còn bao nhiêu trong kế hoạch?", "Khoản nào sắp đến hạn?"] };
    case "remaining":
      if (!summary.plan) return { text: `Bạn chưa đặt kế hoạch chi tháng nên mình chưa so được. ${cap} đã chi ${vnd(summary.expense)}; đặt kế hoạch ở Tài chính → Mục tiêu (mục “Kế hoạch chi mỗi tháng”) để mình theo dõi nhịp chi.`, choices: ["Mở Tài chính", "Tháng này tiêu thế nào?"] };
      return { text: `Kế hoạch chi ${m} ${vnd(summary.plan)}, đã chi ${vnd(summary.expense)} → còn ${vnd(summary.remainingOfPlan!)}.${pace}${summary.byCategory.some((line) => line.limit && line.spent > line.limit) ? ` Nhóm vượt ngân sách: ${summary.byCategory.filter((line) => line.limit && line.spent > line.limit).map((line) => `${line.category} (+${vnd(line.spent - line.limit!)})`).join(", ")}.` : ""}`, choices: ["Tiền đi đâu nhiều nhất?", "Khoản nào sắp đến hạn?"] };
    case "category": {
      const asked = summary.byCategory.find((line) => fold(message).includes(fold(line.category)));
      if (asked) return { text: `${asked.category} ${m}: đã chi ${vnd(asked.spent)}${asked.limit ? ` trên ngân sách ${vnd(asked.limit)} (${Math.round((asked.ratio ?? 0) * 100)}%)` : ", chưa đặt ngân sách"}${asked.forChild ? `, trong đó cho con ${vnd(asked.forChild)}` : ""}.`, choices: [`Đặt ngân sách ${asked.category}`, "Tháng này tiêu thế nào?"] };
      return { text: top ? `Tiền ${m} đi nhiều nhất vào: ${top}.${summary.childSpend ? ` Chi cho con tổng ${vnd(summary.childSpend)}.` : ""}` : `${cap} chưa có khoản chi nào.`, choices: ["Còn bao nhiêu trong kế hoạch?", "Chi cho con bao nhiêu?"] };
    }
    case "upcoming":
      return { text: summary.upcoming.length ? `Sắp đến hạn: ${summary.upcoming.map((item) => `${item.name} ${vnd(item.amount)} (${item.daysLeft === 0 ? "hôm nay" : `còn ${item.daysLeft} ngày`})`).join(", ")}. Các khoản này sẽ tự ghi vào sổ khi tới ngày.` : "Không có khoản định kỳ nào đến hạn trong 7 ngày tới. Muốn mình nhắc hóa đơn, bạn ghi khoản đó ở tab Sổ và tick “Hằng tháng”.", choices: ["Tháng này tiêu thế nào?", "Số dư còn bao nhiêu?"] };
    case "savings":
      return { text: `Tiết kiệm hiện ${vnd(summary.balances.savings)}${summary.saving ? `; ${m} đã chuyển thêm ${vnd(summary.saving)}${summary.income ? ` (${Math.round(summary.saving / summary.income * 100)}% thu nhập)` : ""}` : `; ${m} chưa chuyển khoản nào`}.`, choices: ["Tháng này tiêu thế nào?", "Còn bao nhiêu trong kế hoạch?"] };
    case "child":
      return { text: summary.childSpend ? `Chi cho con ${m}: ${vnd(summary.childSpend)}${summary.expense ? ` — ${Math.round(summary.childSpend / summary.expense * 100)}% tổng chi` : ""}. ${summary.byCategory.filter((line) => line.forChild).map((line) => `${line.category} ${vnd(line.forChild)}`).join(", ")}.` : `${cap} chưa có khoản nào đánh dấu “cho con”. Tick ô Cho con khi ghi để mình theo dõi riêng.`, choices: ["Tiền đi đâu nhiều nhất?", "Tìm bỉm cho bé"] };
    case "balance":
      return { text: `Số dư ước tính: tiền mặt/tài khoản ${vnd(summary.balances.cash)}, tiết kiệm ${vnd(summary.balances.savings)} (từ số dư đầu kỳ và các khoản đã ghi).`, choices: ["Tháng này tiêu thế nào?", "Khoản nào sắp đến hạn?"] };
  }
}
