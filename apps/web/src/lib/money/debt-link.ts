import { personOf, REPAY_OUT } from "./loans.ts";
import { normalize } from "./quick-add.ts";
import type { MoneyDebt, MoneyTransaction } from "./types.ts";

/** Expense categories that mean "paying a debt back": the loan repayments plus instalments. */
export const REPAYMENT_CATEGORIES = [...REPAY_OUT, "Tiền trả góp"];

/**
 * The Tình hình debt a new repayment belongs to, from its wording, or undefined when it is not a repayment, is
 * already tagged, is posted by a debt's own recurring item, or matches none / more than one debt. A debt matches
 * when its normalized name appears in the content ("Trả Vay mua xe tháng 9") or both name the same person
 * ("Vay em gái" ↔ "Trả nợ em gái"). Never guesses between two debts.
 */
export function autoDebtId(entry: Pick<MoneyTransaction, "kind" | "category" | "content" | "debtId" | "recurringId">, debts: Array<Pick<MoneyDebt, "id" | "name" | "recurringId">>): string | undefined {
  if (entry.kind !== "expense" || entry.debtId || !REPAYMENT_CATEGORIES.includes(entry.category)) return undefined;
  if (entry.recurringId && debts.some((debt) => debt.recurringId === entry.recurringId)) return undefined;
  const text = ` ${normalize(entry.content)} `;
  const payee = personOf(entry.content);
  const matches = debts.filter((debt) => {
    const name = normalize(debt.name);
    if (name && text.includes(` ${name} `)) return true;
    const owner = personOf(debt.name);
    return Boolean(payee && owner && normalize(payee) === normalize(owner));
  });
  return matches.length === 1 ? matches[0].id : undefined;
}
