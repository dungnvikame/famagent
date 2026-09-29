"use client";

import { useEffect, useRef, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { trackEvent } from "@/lib/experience/storage";
import { confirmPeriod, undoPeriod } from "@/lib/money/client";
import type { DueEntry } from "@/lib/money/fixed-items";
import { debtLeftIn } from "@/lib/money/position";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyBundle } from "@/lib/money/types";
import { DueStrip } from "./money-hero";
import { PayDialog } from "./pay-dialog";

interface Props { bundle: MoneyBundle; summary: MonthSummary; /** Reload the page's numbers after a period was answered or undone. */ onChanged: () => Promise<void> }

/** The due strip with its "Đã trả?" dialog and the undo toast: answering a period of a fixed item never writes anything by itself. */
export function DueFlow({ bundle, summary, onChanged }: Props) {
  const [paying, setPaying] = useState<DueEntry | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: () => Promise<void> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const say = (text: string, entry: DueEntry) => {
    setToast({ text, undo: async () => { await undoPeriod(entry.recurringId, entry.period); await onChanged(); } });
    clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 7000);
  };
  const item = paying ? bundle.recurring.find((rec) => rec.id === paying.recurringId) : undefined;
  const debt = item ? bundle.settings.position?.debts.find((d) => d.recurringId === item.id) : undefined;

  async function confirm(entry: DueEntry, input: { occurredOn: string; amount: number }) {
    await confirmPeriod({ recurringId: entry.recurringId, period: entry.period, status: "paid", ...input });
    trackEvent("money_period_paid");
    setPaying(null); await onChanged();
    say(`Đã ghi ${entry.name} ${vnd(input.amount)} vào sổ${debt ? " · dư nợ đã giảm" : ""}`, entry);
  }
  async function skip(entry: DueEntry) {
    await confirmPeriod({ recurringId: entry.recurringId, period: entry.period, status: "skipped" });
    trackEvent("money_period_skipped");
    setPaying(null); await onChanged();
    say(`Đã bỏ qua kỳ này của “${entry.name}” — kỳ sau vẫn nhắc bình thường`, entry);
  }

  return <>
    <DueStrip items={summary.due} onPay={setPaying} />
    {paying && <PayDialog entry={paying} history={bundle.recurringAmounts?.[paying.recurringId]} debt={debt ? { name: debt.name, left: debtLeftIn(bundle, debt) } : null}
      onConfirm={(input) => confirm(paying, input)} onSkip={() => skip(paying)} onClose={() => setPaying(null)} />}
    {toast && <div className="qe-toast" role="status">{toast.text}<button type="button" onClick={() => { void toast.undo().catch(() => {}); setToast(null); }}>Hoàn tác</button></div>}
  </>;
}
