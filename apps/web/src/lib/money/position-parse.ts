import { parseVnd } from "./parse.ts";
import { normalize } from "./quick-add.ts";
import type { AccountType, MoneyKind } from "./types.ts";

/**
 * "Kể cho Trợ lý" on the Tình hình setup: one paragraph → accounts, debts and fixed monthly items to review.
 * Rules only; every clause becomes a row the family can fix, nothing is saved from here directly.
 */

export interface ParsedAccount { name: string; type: AccountType; amount: number }
export interface ParsedDebt { name: string; balance: number; monthlyPayment?: number; dueDay?: number; ratePct?: number }
export interface ParsedFixed { name: string; kind: Exclude<MoneyKind, "saving">; amount: number; dayOfMonth?: number }
export interface ParsedPosition { accounts: ParsedAccount[]; debts: ParsedDebt[]; fixed: ParsedFixed[]; skipped: string[] }

const BANKS: Array<[RegExp, string]> = [
  [/\b(vcb|vietcombank)\b/, "Vietcombank"], [/\b(tcb|techcombank|techcom)\b/, "Techcombank"], [/\b(bidv)\b/, "BIDV"], [/\b(agribank|agri)\b/, "Agribank"],
  [/\b(vietinbank|vtb|ctg)\b/, "VietinBank"], [/\b(mb|mbbank|mb bank)\b/, "MB Bank"], [/\b(acb)\b/, "ACB"], [/\b(vpbank|vpb)\b/, "VPBank"], [/\b(tpbank|tpb)\b/, "TPBank"],
  [/\b(vib)\b/, "VIB"], [/\b(sacombank|stb)\b/, "Sacombank"], [/\b(hdbank)\b/, "HDBank"], [/\b(shb)\b/, "SHB"], [/\b(ocb)\b/, "OCB"], [/\b(timo|cake|tnex)\b/, ""],
];
const WALLETS: Array<[RegExp, string]> = [[/\b(momo)\b/, "MoMo"], [/\b(zalopay|zalo pay)\b/, "ZaloPay"], [/\b(shopeepay|shopee pay)\b/, "ShopeePay"], [/\b(vnpay)\b/, "VNPay"]];
const DEBT_WORDS = /\b(vay|no|tra gop|the tin dung|du no|mua tra gop)\b/;
const INCOME_WORDS = /\b(luong|thu nhap|thuong|cho thue|tien thue nha nhan|luong huu)\b/;
const FIXED_EXPENSE_WORDS = /\b(tien nha|thue nha|hoc phi|dien|nuoc|internet|wifi|bao hiem|phi quan ly|gui xe|dien thoai|sua|bim|tien an|di cho|tro cap|bieu)\b/;

/** Money amounts in a clause, in order: "28tr rưỡi" = 28.5tr, "8,2tr", "380 triệu", "6 củ". */
function amounts(clause: string): number[] {
  const text = clause.toLowerCase().replace(/(\d+)\s*(tr|triệu|m|củ)\s*rưỡi/g, (_, n: string) => `${n}tr5`).replace(/(\d+)\s*củ/g, "$1tr").replace(/(\d+)\s*tỷ\s*(\d)?/g, (_, n: string, d?: string) => `${Number(n) * 1000 + (d ? Number(d) * 100 : 0)}tr`);
  const out: number[] = [];
  for (const match of text.matchAll(/(?:^|[\s(])(\d[\d.,]*\s?(?:k|nghìn|ngàn|tr|triệu|trieu|m|đ|vnd)?\d?)(?=$|[\s),;.])/g)) {
    const value = parseVnd(match[1].replace(/\s+/g, ""));
    if (value !== null && value >= 10_000) out.push(Math.abs(value));
  }
  return out;
}

const dayOf = (norm: string) => { const match = norm.match(/\bngay (\d{1,2})\b/); const day = match ? Number(match[1]) : undefined; return day && day >= 1 && day <= 31 ? day : undefined; };
const rateOf = (clause: string) => { const match = clause.match(/(?:lãi|lai)\s*(?:suất\s*)?(\d+(?:[.,]\d+)?)\s*%/i); return match ? Number(match[1].replace(",", ".")) : undefined; };

/** A readable name from the clause without its numbers ("Đang vay mua xe TPBank còn 380tr" → "Vay mua xe TPBank"). */
function nameOf(clause: string, fallback: string): string {
  const cleaned = clause
    // Unicode-aware word edges: \b does not treat "đ" or accented letters as word characters.
    .replace(/(?<!\p{L})(đang|hiện tại|hiện|còn|có|khoảng|tầm|chừng|mỗi tháng|hàng tháng|hằng tháng|trả|ngày \d{1,2}|lãi(?: suất)?\s*\d+(?:[.,]\d+)?\s*%(?:\/năm)?|nhà mình|mình|là|thì|được)(?!\p{L})/giu, " ")
    .replace(/\/năm/gi, " ")
    .replace(/\d[\d.,]*\s*(k|nghìn|ngàn|tr|triệu|m|củ|tỷ|đ|vnd)?\s*(rưỡi)?/gi, " ")
    .replace(/[:;,.]/g, " ").replace(/\s+/g, " ").trim();
  const name = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : fallback;
  return name.length > 60 ? name.slice(0, 60).trim() : name;
}

export function parsePosition(text: string): ParsedPosition {
  const result: ParsedPosition = { accounts: [], debts: [], fixed: [], skipped: [] };
  // Clauses: sentences and comma lists; "trả 8,2tr ngày 15" stays with its debt because a decimal comma is not a split.
  const clauses = text.split(/[\n;]|\.(?!\d)|,(?!\d)/).map((clause) => clause.trim()).filter(Boolean).slice(0, 60);
  for (let index = 0; index < clauses.length; index++) {
    const clause = clauses[index];
    const norm = normalize(clause);
    const values = amounts(clause);
    // "trả 8,2tr ngày 15" right after a debt belongs to that debt.
    const lastDebt = result.debts[result.debts.length - 1];
    if (lastDebt && !lastDebt.monthlyPayment && /^(tra|moi thang tra|hang thang tra|thang tra)\b/.test(norm) && values.length) {
      lastDebt.monthlyPayment = values[0]; lastDebt.dueDay = dayOf(norm) ?? lastDebt.dueDay; lastDebt.ratePct = rateOf(clause) ?? lastDebt.ratePct;
      continue;
    }
    if (!values.length) { result.skipped.push(clause); continue; }
    if (DEBT_WORDS.test(norm) && !/\b(cho vay)\b/.test(norm)) {
      const paying = norm.match(/\btra\b/) ? values[1] : undefined;
      result.debts.push({ name: nameOf(clause, "Khoản nợ"), balance: values[0], monthlyPayment: paying, dueDay: paying ? dayOf(norm) : undefined, ratePct: rateOf(clause) });
      continue;
    }
    if (/\b(tiet kiem|so tiet kiem|gui tiet kiem|so tk|gui ky han|ky han)\b/.test(norm)) { result.accounts.push({ name: nameOf(clause, "Tiết kiệm"), type: "saving", amount: values[0] }); continue; }
    if (/\b(tien mat|o nha|trong vi)\b/.test(norm)) { result.accounts.push({ name: "Tiền mặt", type: "cash", amount: values[0] }); continue; }
    const wallet = WALLETS.find(([test]) => test.test(norm));
    if (wallet) { result.accounts.push({ name: wallet[1], type: "ewallet", amount: values[0] }); continue; }
    if (INCOME_WORDS.test(norm)) { result.fixed.push({ name: nameOf(clause, "Lương"), kind: "income", amount: values[0], dayOfMonth: dayOf(norm) }); continue; }
    const bank = BANKS.find(([test]) => test.test(norm));
    if (bank || /\b(tai khoan|ngan hang|tk|the atm)\b/.test(norm)) { result.accounts.push({ name: bank?.[1] || nameOf(clause, "Tài khoản ngân hàng"), type: "bank", amount: values[0] }); continue; }
    if (FIXED_EXPENSE_WORDS.test(norm) || /\b(moi thang|hang thang|hang thang|thang)\b/.test(norm)) { result.fixed.push({ name: nameOf(clause, "Chi cố định"), kind: "expense", amount: values[0], dayOfMonth: dayOf(norm) }); continue; }
    result.skipped.push(clause);
  }
  return result;
}
