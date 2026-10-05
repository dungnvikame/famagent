import { normalize } from "./quick-add.ts";
import type { MoneyDebt, MoneyTransaction } from "./types.ts";

/**
 * Loan flows are ordinary Thu/Chi (like the family's Excel sheet): borrowing and being paid back are income,
 * repaying and lending are expense, so they count in month totals, budgets, charts and frameworks. This module
 * only recognises them so the Nợ tab can read them back per person and the month can show "trong đó trả nợ X".
 */
export const BORROW_IN = ["Vay cá nhân", "Vay ngân hàng"]; // income kind: money we borrowed
export const REPAY_OUT = ["Tiền trả nợ", "Tiền trả nợ quỹ"]; // expense kind: paying our debts back
export const LEND_OUT = ["Tiền cho vay"]; // expense kind: money we lent
export const REPAID_IN = ["Tiền trả nợ nhận về"]; // income kind: money paid back to us

type Entry = Pick<MoneyTransaction, "kind" | "category">;
export const loanRole = (tx: Entry): "borrow" | "repay" | "lend" | "collect" | null =>
  tx.kind === "income" ? BORROW_IN.includes(tx.category) ? "borrow" : REPAID_IN.includes(tx.category) ? "collect" : null
  : tx.kind === "expense" ? REPAY_OUT.includes(tx.category) ? "repay" : LEND_OUT.includes(tx.category) ? "lend" : null : null;
export const isLoanEntry = (tx: Entry) => loanRole(tx) !== null;

export interface LoanTotals { borrowed: number; repaid: number; lent: number; collected: number }
/** Ids that tie an entry to a Tình hình debt: the debt's own id (`debtId`) and its linked recurring item. */
export const debtLinkIds = (debts: MoneyDebt[]) => new Set(debts.flatMap((debt) => [debt.id, debt.recurringId]).filter((id): id is string => Boolean(id)));
type Linkable = Pick<MoneyTransaction, "recurringId" | "debtId">;
const isLinked = (tx: Linkable, links: Set<string>) => Boolean((tx.recurringId && links.has(tx.recurringId)) || (tx.debtId && links.has(tx.debtId)));

/** Amounts per role over the given entries; payments of Tình hình debts (tagged or posted by their recurring item) are left out. */
export function loanTotals(entries: Array<Entry & Pick<MoneyTransaction, "amount"> & Linkable>, debtLinks: Set<string> = new Set()): LoanTotals {
  const out = { borrowed: 0, repaid: 0, lent: 0, collected: 0 };
  for (const tx of entries) { if (isLinked(tx, debtLinks)) continue; const role = loanRole(tx); if (role === "borrow") out.borrowed += tx.amount; else if (role === "repay") out.repaid += tx.amount; else if (role === "lend") out.lent += tx.amount; else if (role === "collect") out.collected += tx.amount; }
  return out;
}

/** `loanTotals` over only the lines that name a person: the Nợ tab's books. Unnamed loan lines are plain Thu/Chi
 * (the family asked for no auto-collected "Khác" person, 05/10) — month flows (`loanFlows`) still count them. */
export const personLoanTotals = (entries: Array<Entry & Pick<MoneyTransaction, "amount" | "content"> & Linkable>, debtLinks: Set<string> = new Set()) =>
  loanTotals(entries.filter((tx) => !loanRole(tx) || personOf(tx.content)), debtLinks);

/**
 * Everything a month moved through loans, for "trong đó trả nợ X · vay mới Y" (nothing is left out: these are part
 * of Thu/Chi). `repaid` also holds payments of Tình hình debts posted under other categories (e.g. Tiền trả góp).
 */
export function loanFlows(entries: Array<Entry & Pick<MoneyTransaction, "amount"> & Linkable>, debtLinks: Set<string> = new Set()): LoanTotals {
  const out = loanTotals(entries);
  for (const tx of entries) if (tx.kind === "expense" && !loanRole(tx) && isLinked(tx, debtLinks)) out.repaid += tx.amount;
  return out;
}

/**
 * What we owe and what others owe us. Ledger loans net out (borrowed − repaid, lent − collected); big loans with a
 * schedule come from Tình hình (their remaining balance). Repayments of those big loans (tagged with the debt or
 * posted by its recurring item) come off that balance, so they do not reduce the ledger figure twice.
 */
export function debtOverview(totals: LoanTotals, debts: MoneyDebt[], debtLeft: (debt: MoneyDebt) => number) {
  const ledgerOwed = Math.max(0, totals.borrowed - totals.repaid);
  const bigOwed = debts.reduce((sum, debt) => sum + debtLeft(debt), 0);
  return { owed: ledgerOwed + bigOwed, ledgerOwed, bigOwed, lent: Math.max(0, totals.lent - totals.collected) };
}

// Kinship and courtesy words that belong to a name ("chị Hà", "bác Thủy", "mẹ").
const TITLES = "anh|chị|chi|em|bác|bac|cô|co|chú|chu|dì|di|cậu|cau|mợ|mo|ông|ong|bà|ba|mẹ|me|bố|bo|ba|má|ma";
const WORD = "[\\p{L}][\\p{L}\\d]*";

/**
 * The person a loan line is about, from its wording: "Tom vay bet", "A Báu trả", "cho chị Hà mượn", "vay mẹ",
 * "trả nợ anh Nam", "Tom trả tiền bet". Returns a display name (as typed) or undefined.
 */
export function personOf(content: string): string | undefined {
  const text = content.trim().replace(/\s+/g, " ");
  const patterns = [
    new RegExp(`^cho (?:(?:${TITLES}) )?(${WORD}(?: ${WORD})?) (?:vay|mượn|muon)(?!\\p{L})`, "iu"),
    new RegExp(`^(?:đi |di )?(?:vay|mượn|muon|trả nợ|tra no|trả tiền|tra tien|trả|tra) (?:của |cua |cho )?((?:(?:${TITLES}) )?${WORD})`, "iu"),
    new RegExp(`^((?:(?:${TITLES}) )?${WORD}(?: ${WORD})?) (?:vay|mượn|muon|trả|tra)(?!\\p{L})`, "iu"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const name = match[1].trim();
    if (/^(tiền|tien|nợ|no|lãi|lai|góp|gop|thẻ|the|ngân|ngan|bank)$/iu.test(name.split(" ").pop() ?? "")) continue;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return undefined;
}

export interface PersonLedger { key: string; name: string; given: number; received: number; left: number; last: string; entries: MoneyTransaction[] }

/**
 * Loans grouped by person, both directions: `lent` = people who owe us (lent − paid back), `owe` = people we owe
 * (borrowed − repaid). Lines without a recognisable name are not anyone's loan, so they are left out (the family
 * asked for no auto-collected "Khác" person, 05/10); they still count in month totals like any Thu/Chi.
 */
export function loansByPerson(entries: MoneyTransaction[], debtLinks: Set<string> = new Set()): { lent: PersonLedger[]; owe: PersonLedger[] } {
  const lent = new Map<string, PersonLedger>(); const owe = new Map<string, PersonLedger>();
  for (const tx of [...entries].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))) {
    const role = loanRole(tx);
    if (!role || isLinked(tx, debtLinks)) continue;
    const name = personOf(tx.content);
    if (!name) continue;
    const key = normalize(name);
    const book = role === "lend" || role === "collect" ? lent : owe;
    const row = book.get(key) ?? { key, name, given: 0, received: 0, left: 0, last: tx.occurredOn, entries: [] };
    // given = money that went to them (lent / repaid to them); received = money that came from them.
    if (role === "lend" || role === "repay") row.given += tx.amount; else row.received += tx.amount;
    row.last = tx.occurredOn; row.entries.push(tx);
    book.set(key, row);
  }
  const finish = (book: Map<string, PersonLedger>, owedToUs: boolean) => [...book.values()].map((row) => ({ ...row, left: owedToUs ? row.given - row.received : row.received - row.given, entries: row.entries.reverse() })).sort((a, b) => b.left - a.left);
  return { lent: finish(lent, true), owe: finish(owe, false) };
}
