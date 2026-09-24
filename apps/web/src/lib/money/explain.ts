// "Tháng này nhà tôi tiêu thế nào?" (core journey spec §4): spend vs the family's *normal* pace (same day of the month
// in up to 3 earlier months; the plan when there is no history), the categories that rose most, and — for the kids'
// category — whether it rose because the family used more or because prices went up (from logged purchases).
import type { Purchase } from "../shopping/purchases.ts";
import type { ShoppingItem } from "../shopping/items.ts";
import { shortVnd, type MonthSummary } from "./summary.ts";
import type { MoneyTransaction } from "./types.ts";

export interface CategoryRise { category: string; now: number; normal: number; diff: number }
export interface MonthExplain {
  spent: number;
  /** Average spend up to the same day in earlier months; null without history. */
  normalAtDay: number | null;
  /** spent / normal (or / plan pace when no history). */
  paceRatio: number | null;
  basis: "history" | "plan" | "none";
  rises: CategoryRise[];
  /** "Con tăng chủ yếu vì lượng … không phải vì giá" — only when the kids' category rose and purchases explain it. */
  childCause: string | null;
}

const CHILD = "Con";
const dayOf = (iso: string) => Number(iso.slice(8));
const monthOf = (iso: string) => iso.slice(0, 7);

/** A half-logged month (one expense) is not "normal": it would make any month look +200%. */
export const MIN_LOGGED_EXPENSES = 5;

/** Earlier months (YYYY-MM) that were really logged, most recent first, at most 3. */
function earlierMonths(history: MoneyTransaction[], month: string): string[] {
  const counts = new Map<string, number>();
  for (const tx of history) if (tx.kind === "expense" && monthOf(tx.occurredOn) < month) counts.set(monthOf(tx.occurredOn), (counts.get(monthOf(tx.occurredOn)) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count >= MIN_LOGGED_EXPENSES).map(([key]) => key).sort().reverse().slice(0, 3);
}

export function explainMonth(summary: MonthSummary, current: MoneyTransaction[], history: MoneyTransaction[], purchases: Purchase[], items: ShoppingItem[], now = new Date()): MonthExplain {
  const day = now.getDate();
  const months = earlierMonths(history, summary.month);
  const upToDay = (list: MoneyTransaction[], month: string) => list.filter((tx) => tx.kind === "expense" && monthOf(tx.occurredOn) === month && dayOf(tx.occurredOn) <= day);
  const spent = summary.expense;
  let normalAtDay: number | null = null; let basis: MonthExplain["basis"] = "none"; let paceRatio: number | null = null;
  const rises: CategoryRise[] = [];
  if (months.length) {
    const perMonth = months.map((month) => upToDay(history, month));
    normalAtDay = Math.round(perMonth.reduce((sum, list) => sum + list.reduce((acc, tx) => acc + tx.amount, 0), 0) / months.length);
    basis = "history"; paceRatio = normalAtDay ? spent / normalAtDay : null;
    const categories = new Set(current.filter((tx) => tx.kind === "expense").map((tx) => tx.category));
    for (const category of categories) {
      const nowAmount = current.filter((tx) => tx.kind === "expense" && tx.category === category && dayOf(tx.occurredOn) <= day).reduce((sum, tx) => sum + tx.amount, 0);
      const normal = Math.round(perMonth.reduce((sum, list) => sum + list.filter((tx) => tx.category === category).reduce((acc, tx) => acc + tx.amount, 0), 0) / months.length);
      if (nowAmount - normal >= 100_000) rises.push({ category, now: nowAmount, normal, diff: nowAmount - normal });
    }
    rises.sort((a, b) => b.diff - a.diff);
  } else if (summary.plan && summary.paceRatio !== undefined) { basis = "plan"; paceRatio = summary.paceRatio; }

  let childCause: string | null = null;
  const childRise = rises.find((rise) => rise.category === CHILD);
  if (childRise && months.length) {
    const childItems = new Set(items.filter((item) => item.category === "diapers" || item.category === "wipes" || item.category === "milk").map((item) => item.id));
    const mainItem = items.find((item) => item.category === "diapers");
    const units = (month: string, filterDay: boolean) => purchases.filter((purchase) => purchase.itemId && childItems.has(purchase.itemId) && monthOf(purchase.purchasedOn) === month && (!filterDay || dayOf(purchase.purchasedOn) <= day));
    const nowList = units(summary.month, true);
    const beforeLists = months.map((month) => units(month, true));
    const nowUnits = nowList.reduce((sum, purchase) => sum + purchase.unitCount, 0);
    const beforeUnits = beforeLists.reduce((sum, list) => sum + list.reduce((acc, purchase) => acc + purchase.unitCount, 0), 0) / months.length;
    const price = (list: Purchase[]) => { const u = list.reduce((sum, purchase) => sum + purchase.unitCount, 0); return u ? list.reduce((sum, purchase) => sum + purchase.amount, 0) / u : null; };
    const nowPrice = price(nowList); const beforePrice = price(beforeLists.flat());
    if (nowUnits && beforeUnits && nowPrice && beforePrice) {
      const volume = (nowUnits - beforeUnits) * beforePrice; const priceEffect = (nowPrice - beforePrice) * nowUnits;
      const pricePct = Math.round((nowPrice / beforePrice - 1) * 100);
      const thing = mainItem ? "bỉm" : "đồ dùng cho con";
      childCause = Math.abs(volume) >= Math.abs(priceEffect)
        ? `Con tăng chủ yếu vì lượng ${thing} dùng nhiều hơn (+${Math.round(nowUnits - beforeUnits)} ${mainItem?.unit ?? "đơn vị"}), không phải vì giá (giá mỗi ${mainItem?.unit ?? "đơn vị"} ${pricePct === 0 ? "gần như không đổi" : `${pricePct > 0 ? "+" : ""}${pricePct}%`}).`
        : `Con tăng chủ yếu vì giá ${thing} tăng khoảng ${pricePct}%, lượng dùng gần như không đổi.`;
    }
  }
  return { spent, normalAtDay, paceRatio, basis, rises, childCause };
}

/** "Lập kế hoạch phần còn lại tháng": what is left per day, and which budgets still have room. */
export function planRestOfMonth(summary: MonthSummary, now = new Date()): string {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  if (!summary.plan) return `Nhà mình chưa đặt kế hoạch chi tháng. Đặt một con số ở Tiền → Định kỳ & mục tiêu (ví dụ bằng mức chi tháng trước) để FamAgent chia phần còn lại theo ngày.`;
  const left = summary.plan - summary.expense;
  const budgets = summary.byCategory.filter((line) => line.limit).map((line) => `${line.category} còn ${shortVnd(Math.max(0, line.limit! - line.spent))}`);
  if (left <= 0) return `Kế hoạch ${shortVnd(summary.plan)} đã dùng hết (vượt ${shortVnd(-left)}). ${days} ngày còn lại nên giữ ở các khoản thiết yếu; ${budgets.length ? `ngân sách nhóm: ${budgets.join(", ")}.` : "đặt ngân sách nhóm để thấy chỗ còn dư."}`;
  return `Còn ${shortVnd(left)} cho ${days} ngày — khoảng ${shortVnd(Math.floor(left / days))}/ngày.${budgets.length ? ` Ngân sách nhóm: ${budgets.join(", ")}.` : ""} Nếu có khoản lớn sắp tới, trừ ra trước rồi chia phần còn lại.`;
}
