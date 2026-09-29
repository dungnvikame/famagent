import { confirmPeriod, saveMoneyItem } from "./client";
import { dueEntries, matchDue, type DueEntry } from "./fixed-items";
import type { MoneyBundle, MoneyTransaction } from "./types";

/**
 * A hand-typed entry that matches a waiting period of a fixed item ("internet 260k" while Internet is due) answers that
 * period instead of adding a second entry; anything else is saved as usual. One place for the Sổ row, quick add and the
 * "Ghi khoản" sheet, so a period is never answered twice.
 */
type Ctx = Pick<MoneyBundle, "recurring" | "periods" | "recurringAmounts">;

/** The waiting period a new manual entry would answer, if any (used live for the hint and again when saving). */
export function periodAnswered(ctx: Ctx, entry: Pick<MoneyTransaction, "content" | "kind" | "category" | "amount" | "recurringId" | "source">, now = new Date()): DueEntry | null {
  if (entry.recurringId || entry.source !== "manual" || entry.kind === "saving") return null;
  const waiting = dueEntries(ctx.recurring, ctx.periods ?? [], ctx.recurringAmounts, now);
  return matchDue(waiting, { content: entry.content, kind: entry.kind, category: entry.category, amount: Math.abs(entry.amount) });
}

/** Saves a NEW entry (an edited one keeps its own row). Returns the period it answered, so callers can say so. */
export async function saveNewEntry(ctx: Ctx, entry: MoneyTransaction, now = new Date()): Promise<{ answered: DueEntry | null }> {
  const answered = periodAnswered(ctx, entry, now);
  if (!answered) { await saveMoneyItem("transactions", entry); return { answered: null }; }
  await confirmPeriod({
    recurringId: answered.recurringId, period: answered.period, status: "paid", occurredOn: entry.occurredOn, amount: Math.abs(entry.amount),
    content: entry.content, category: entry.category, debtId: entry.debtId, forChild: entry.forChild, childId: entry.childId, paidFrom: entry.paidFrom, note: entry.note,
  });
  return { answered };
}
