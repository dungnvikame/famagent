// What a product link means for this family (spec §2C): price per unit against what we paid, how long current stock
// lasts, and the budget — "Giá khá tốt, nhưng nhà mình dự kiến vẫn còn khoảng 10 ngày sử dụng."
import { parsePurchase, type PurchaseDraft } from "../shopping/capture.ts";
import type { ItemEstimate, ShoppingItem } from "../shopping/items.ts";
import { budgetHint, type Purchase } from "../shopping/purchases.ts";
import { purchasesOf } from "../shopping/items.ts";

export interface LinkAdvice { draft: PurchaseDraft; item?: ShoppingItem; unitPrice?: number; changePct?: number; daysLeft?: number | null; lines: string[] }

const vnd = (amount: number) => `${Math.round(amount).toLocaleString("vi-VN")}đ`;

export function linkAdvice(title: string, price: number, merchant: string, today: string, items: ShoppingItem[], purchases: Purchase[], estimates: ItemEstimate[], budget: { spent: number; limit?: number } | undefined, remainingOfPlan: number | undefined, reorderWindowDays: number): LinkAdvice {
  const draft = { ...parsePurchase(`${title} ${price}đ`, items, today), amount: price, merchant, name: title.slice(0, 120) };
  const item = draft.itemId ? items.find((entry) => entry.id === draft.itemId) : undefined;
  if (item) draft.name = item.name;
  const lines: string[] = [];
  const units = (draft.packSize ?? item?.packSize ?? 0) * Math.max(1, draft.packs);
  const unitPrice = units ? price / units : undefined;
  let changePct: number | undefined;
  if (item && unitPrice) {
    const history = purchasesOf(item, purchases).map((purchase) => purchase.amount / Math.max(1, purchase.unitCount));
    const last = history.at(-1); const lowest = history.length ? Math.min(...history) : undefined;
    if (last) {
      changePct = Math.round((unitPrice / last - 1) * 100);
      lines.push(`${vnd(unitPrice)}/${item.unit} — ${changePct === 0 ? "bằng" : changePct < 0 ? `rẻ hơn ${-changePct}% so với` : `đắt hơn ${changePct}% so với`} lần trước (${vnd(last)}).`);
      if (lowest && lowest < unitPrice && lowest !== last) lines.push(`Giá thấp nhất nhà mình từng trả: ${vnd(lowest)}/${item.unit}.`);
    }
  } else if (unitPrice && draft.packSize) lines.push(`Khoảng ${vnd(unitPrice)}/${draft.unit}.`);
  const estimate = item ? estimates.find((entry) => entry.item.id === item.id) : undefined;
  if (estimate?.known && estimate.daysLeft !== null) lines.push(estimate.daysLeft > reorderWindowDays ? `Nhà mình dự kiến vẫn còn khoảng ${estimate.daysLeft} ngày sử dụng — chưa cần mua gấp.` : `Nhà mình chỉ còn khoảng ${estimate.daysLeft} ngày — nên mua trong tuần này.`);
  const hint = budgetHint(price, budget, remainingOfPlan, "Con + Mua sắm");
  if (hint) lines.push(hint);
  if (!item) lines.push("Món này chưa có trong danh sách nhà mình — ghi lần mua để FamAgent bắt đầu theo dõi.");
  return { draft, item, unitPrice, changePct, daysLeft: estimate?.daysLeft, lines };
}
