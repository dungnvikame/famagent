import { REPAYMENT_CATEGORIES } from "./debt-link.ts";
import { parseVnd } from "./parse.ts";
import type { MoneyKind, MoneyTransaction } from "./types.ts";

/** What the family typed for one ledger entry (the add row and the quick-entry sheet share this). */
export interface EntryInput {
  content: string;
  amountText: string;
  kind: MoneyKind;
  category: string;
  /** YYYY-MM-DD */
  occurredOn: string;
  fromSavings?: boolean;
  forChild?: boolean;
  childId?: string;
  note?: string;
  /** Keeps the id (and source/recurring/debt links) of an entry being edited. */
  existing?: Pick<MoneyTransaction, "id" | "source" | "recurringId" | "debtId">;
  /** Overrides the debt link: the debt this repayment pays down (null = the family chose "no debt"). */
  debtId?: string | null;
}

/** Typed text → a ledger entry, or the message to show. Saving may be negative (a withdrawal); other kinds may not. */
export function buildEntry(input: EntryInput, newId: () => string = () => crypto.randomUUID()): { entry: MoneyTransaction } | { error: string } {
  const content = input.content.trim();
  if (!content) return { error: "Nhập nội dung khoản (ví dụ: Ăn sáng)." };
  const amount = parseVnd(input.amountText);
  if (amount === null || (input.kind !== "saving" && amount < 0)) {
    return { error: input.kind === "saving" ? "Số tiền không hợp lệ. Rút tiết kiệm thì nhập số âm, ví dụ -698k." : "Số tiền không hợp lệ. Ví dụ: 350k, 1,5tr hoặc 350000." };
  }
  const category = input.category || "Khác";
  // The debt link survives an edit, but only while the entry still reads as a repayment; `null` means it was removed.
  const kept = input.debtId === undefined ? input.existing?.debtId : input.debtId ?? undefined;
  const debtId = input.kind === "expense" && REPAYMENT_CATEGORIES.includes(category) ? kept : undefined;
  return {
    entry: {
      id: input.existing?.id ?? newId(),
      occurredOn: input.occurredOn,
      content,
      category,
      kind: input.kind,
      amount,
      paidFrom: input.kind === "expense" && input.fromSavings ? "savings" : undefined,
      forChild: Boolean(input.forChild),
      childId: input.forChild ? input.childId : undefined,
      note: input.note?.trim() || undefined,
      source: input.existing?.source ?? "manual",
      recurringId: input.existing?.recurringId,
      debtId,
    },
  };
}
