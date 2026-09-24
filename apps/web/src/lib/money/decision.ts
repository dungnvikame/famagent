// Big purchase decisions (core journey spec §6): "Tôi muốn mua robot hút bụi 8 triệu" → what it does to this month's
// plan and the savings goal, and three options. FamAgent judges the *financial* fit only; it has no data to say a
// model fits the family's needs (24/09 review), and says so.
import { CATEGORY_WORDS, findAmount, fold } from "../shopping/capture.ts";
import { shortVnd, type MonthSummary } from "./summary.ts";
import type { MoneyGoal } from "./types.ts";

export interface BigPurchase { what: string; amount: number }
export interface Decision extends BigPurchase {
  text: string;
  /** Price that still keeps this month's savings goal (null when there is no goal/income to judge by). */
  keepsGoalUnder: number | null;
  shortfall: number | null;
}

/** Purchases at least this large are a decision, not a routine buy. */
export const BIG_PURCHASE_VND = 1_000_000;
const INTENT = /\b(muon mua|dinh mua|tinh mua|co nen mua|nen mua khong|sap mua|can mua|muon sam|dinh sam)\b/;
const CONSUMABLE = new Set(["diapers", "wipes", "milk", "solids", "hygiene", "household"]);

export function detectBigPurchase(text: string): BigPurchase | null {
  const folded = fold(text);
  if (!INTENT.test(folded)) return null;
  if (CATEGORY_WORDS.some(([pattern, category]) => CONSUMABLE.has(category) && pattern.test(folded))) return null;
  const amount = findAmount(text);
  if (!amount || amount.value < BIG_PURCHASE_VND) return null;
  const intent = INTENT.exec(folded)!;
  const what = text.slice(intent.index + intent[0].length, amount.span.start).replace(/\b(khoảng|tầm|giá|hết|mất|tới|đến)\s*$/i, "").replace(/[,.;:]+/g, " ").trim() || "món này";
  return { what: what.slice(0, 80), amount: amount.value };
}

/** Financial fit this month: remaining plan, projected savings vs the goals' monthly plan, and the price that keeps it. */
export function decide(purchase: BigPurchase, summary: MonthSummary | null, goals: MoneyGoal[], monthlyIncome?: number): Decision {
  const { what, amount } = purchase;
  const lines = [`FamAgent chưa có dữ liệu sản phẩm ${what} nên chưa đánh giá được model nào hợp nhu cầu nhà mình — dưới đây là phần tài chính.`];
  const target = goals.reduce((sum, goal) => sum + (goal.monthlyPlan ?? 0), 0);
  const income = summary?.income || monthlyIncome || 0;
  const expected = summary ? summary.expectedExpense ?? summary.expense : 0;
  let keepsGoalUnder: number | null = null; let shortfall: number | null = null;
  if (summary?.plan) {
    const left = summary.plan - summary.expense;
    lines.push(left >= amount ? `Kế hoạch chi tháng này còn ${shortVnd(left)}; sau khoản ${shortVnd(amount)} còn ${shortVnd(left - amount)}.` : `Kế hoạch chi tháng này chỉ còn ${shortVnd(Math.max(0, left))} — khoản ${shortVnd(amount)} sẽ vượt kế hoạch ${shortVnd(amount - Math.max(0, left))}.`);
  }
  if (target > 0 && income > 0) {
    const projected = income - expected - amount;
    shortfall = Math.max(0, target - projected);
    keepsGoalUnder = Math.max(0, income - expected - target);
    lines.push(shortfall > 0 ? `Nếu mua tháng này, khoản tiết kiệm dự kiến sẽ thấp hơn mục tiêu (${shortVnd(target)}/tháng) khoảng ${shortVnd(shortfall)}.` : `Mua tháng này vẫn giữ được mục tiêu tiết kiệm ${shortVnd(target)}/tháng.`);
  } else if (!summary?.plan) lines.push("Nhà mình chưa có kế hoạch chi hay mục tiêu tiết kiệm nên FamAgent chưa so được — đặt ở Tiền để lần sau có câu trả lời cụ thể.");
  return { what, amount, text: lines.join(" "), keepsGoalUnder, shortfall };
}
