// First steps after onboarding (core journey spec §1): "thêm tình hình tài chính · thêm một giao dịch · thêm một món
// thường mua", ordered by what the family said matters most, each gone once done.
import type { FamilyProfile } from "../experience/types.ts";

export interface StarterStep { id: "finance" | "transaction" | "item"; title: string; detail: string; href: string; cta: string }

const STEPS: Record<StarterStep["id"], StarterStep> = {
  finance: { id: "finance", title: "Thêm tình hình tài chính", detail: "Thu nhập, chi tiêu, khoản vay ước chừng — để FamAgent biết nhịp chi bình thường của nhà mình.", href: "/onboarding?update=1&section=money", cta: "Thêm (1 phút)" },
  transaction: { id: "transaction", title: "Ghi một khoản chi", detail: "Gõ như nhắn tin: “ăn trưa 80k”, “hôm nay mua bỉm 369k”.", href: "/money", cta: "Ghi khoản chi" },
  item: { id: "item", title: "Thêm một món thường mua", detail: "Bỉm, sữa, nước giặt… FamAgent tính ngày hết và nhắc mua lại.", href: "/shopping", cta: "Thêm món" },
};

/** Remaining starter steps: money-first families see the finance step first, shopping/reminder-first families the item. */
export function starterSteps(profile: FamilyProfile | null, done: { transactions: number; items: number }): StarterStep[] {
  const focus = profile?.household?.focus ?? [];
  const order: StarterStep["id"][] = focus[0] === "shopping" || focus[0] === "replenish" ? ["item", "transaction", "finance"] : ["finance", "transaction", "item"];
  const finished = new Set<StarterStep["id"]>([
    ...(profile?.household?.monthlyIncome || profile?.household?.monthlySpend ? ["finance" as const] : []),
    ...(done.transactions > 0 ? ["transaction" as const] : []),
    ...(done.items > 0 ? ["item" as const] : []),
  ]);
  return order.filter((id) => !finished.has(id)).map((id) => STEPS[id]);
}
