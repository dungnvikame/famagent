"use client";

import type { ReactNode } from "react";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyBudget, MoneyBundle, MoneyRecurring, MoneySettings } from "@/lib/money/types";
import { BudgetPlan } from "./budget-plan";
import { FixedItemsPanel } from "./fixed-items-panel";
import { PlanSummary } from "./plan-summary";

export interface PlanViewProps {
  bundle: MoneyBundle; summary: MonthSummary; month: string;
  /** Saves settings and reloads. */
  onSettings: (settings: MoneySettings) => Promise<void>;
  /** Creates or updates a fixed item. */
  onRecurring: (item: MoneyRecurring) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onBudget: (item: MoneyBudget) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  /** Opens the Sổ filtered to savings entries (the plan's "Xem các lần đã gửi"). */
  onOpenSavings: () => void;
  /** Rendered inside the collapsed "Cách chia tiền" fold. */
  frameworkSlot?: ReactNode;
  /** Rendered last (savings goals). */
  goalsSlot?: ReactNode;
}

const seeItems = () => {
  const target = document.getElementById("plan-fixed-items");
  target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
};

/** The "Kế hoạch" tab: the month plan (derived), the fixed items behind it, category budgets, money split, goals. */
export function PlanView({ bundle, summary, month, onSettings, onRecurring, onDeleteRecurring, onBudget, onDeleteBudget, onOpenSavings, frameworkSlot, goalsSlot }: PlanViewProps) {
  return <div className="plan-view">
    <PlanSummary bundle={bundle} month={month} onSettings={onSettings} onSeeItems={seeItems} onRecurring={onRecurring} onOpenSavings={onOpenSavings} />
    <FixedItemsPanel bundle={bundle} summary={summary} month={month} onRecurring={onRecurring} onDeleteRecurring={onDeleteRecurring} />
    <BudgetPlan bundle={bundle} summary={summary} month={month} onBudget={onBudget} onDeleteBudget={onDeleteBudget} />
    {frameworkSlot && <details className="fold pl-fold"><summary>Cách chia tiền</summary><div className="pl-fold-body">{frameworkSlot}</div></details>}
    {goalsSlot}
  </div>;
}
