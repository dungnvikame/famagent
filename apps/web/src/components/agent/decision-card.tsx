"use client";

import { useState } from "react";
import { MoneyDraftCard } from "@/components/inbox/money-draft-card";
import { moneySummary } from "@/lib/inbox/classify";
import type { Decision } from "@/lib/money/decision";
import { todayLocal } from "@/lib/money/parse";
import { monthKey, shortVnd } from "@/lib/money/summary";
import { savePlanEntry } from "@/lib/shopping/item-client";
import { shiftMonth } from "@/lib/shopping/plan";

/** Spec §6 options for a big purchase: Mua ngay (ledger expense) · Xem loại dưới X · Để tháng sau (next month's plan). */
export function DecisionCard({ decision, onDone }: { decision: Decision; onDone: (text: string) => void }) {
  const [mode, setMode] = useState<"choose" | "buy" | "cheaper">("choose");
  const [error, setError] = useState("");
  const under = decision.keepsGoalUnder && decision.keepsGoalUnder >= decision.amount * 0.2 && decision.keepsGoalUnder < decision.amount ? decision.keepsGoalUnder : null;

  async function later() {
    try {
      const month = shiftMonth(monthKey(new Date()), 1);
      await savePlanEntry({ id: crypto.randomUUID(), month, name: decision.what.charAt(0).toUpperCase() + decision.what.slice(1), packs: 1, estAmount: decision.amount, reason: "manual", status: "planned" });
      onDone(`✓ Đã thêm ${decision.what} ${shortVnd(decision.amount)} vào kế hoạch tháng ${Number(month.slice(5))}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }

  if (mode === "buy") {
    const draft = { kind: "expense" as const, content: decision.what.charAt(0).toUpperCase() + decision.what.slice(1), amount: decision.amount, category: "Mua sắm", occurredOn: todayLocal(), forChild: false };
    return <MoneyDraftCard draft={draft} summary={moneySummary(draft, todayLocal())} onCancel={() => setMode("choose")} onSaved={onDone} />;
  }
  return <div className="app-card draft-card decision-card">
    {mode === "cheaper" ? <p>{under ? `Chọn loại dưới ${shortVnd(under)} thì nhà mình vẫn giữ được mục tiêu tiết kiệm tháng này.` : "Chọn loại rẻ hơn giúp giữ kế hoạch chi tháng này."} FamAgent chưa có danh mục {decision.what} để gợi ý model cụ thể — khi bạn tìm được, dán link vào Ghi nhanh để FamAgent so với ngân sách.</p> : null}
    <span className="purchase-actions">
      <button type="button" className="app-btn ghost" onClick={() => setMode("buy")}>Mua ngay</button>
      <button type="button" className="app-btn ghost" onClick={() => setMode("cheaper")}>{under ? `Xem loại dưới ${shortVnd(under)}` : "Xem loại rẻ hơn"}</button>
      <button type="button" className="app-btn" onClick={() => void later()}>Để tháng sau</button>
    </span>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
