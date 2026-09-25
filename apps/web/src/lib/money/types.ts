// Family Finance MVP types (SPEC_V2 §7–12). Amounts are integer VND.

export const MONEY_KINDS = ["expense", "income", "saving"] as const;
export type MoneyKind = (typeof MONEY_KINDS)[number];
export const MONEY_KIND_LABELS: Record<MoneyKind, string> = { expense: "Chi", income: "Thu", saving: "Tiết kiệm" };

export interface MoneyTransaction {
  id: string;
  /** YYYY-MM-DD (local date). */
  occurredOn: string;
  content: string;
  category: string;
  kind: MoneyKind;
  /** > 0, except saving where < 0 means a withdrawal from savings. */
  amount: number;
  forChild: boolean;
  childId?: string;
  note?: string;
  source: "manual" | "recurring" | "purchase";
  recurringId?: string;
}

export interface MoneyBudget { id: string; category: string; /** YYYY-MM */ month: string; limitAmount: number }

export interface MoneyRecurring {
  id: string;
  name: string;
  category: string;
  kind: MoneyKind;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  /** YYYY-MM of the last month auto-posted into the ledger. */
  lastPostedMonth?: string;
}

export interface MoneyGoal { id: string; name: string; targetAmount: number; savedAmount: number; monthlyPlan?: number }

export interface MoneyCategory { name: string; kind: "expense" | "income"; archived?: boolean }

export const ACCOUNT_TYPES = ["bank", "cash", "ewallet", "saving"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = { bank: "Ngân hàng", cash: "Tiền mặt", ewallet: "Ví điện tử", saving: "Tiết kiệm" };

/** A place money sits, as the family told us on `MoneyPosition.asOf`; "saving" accounts count toward savings. */
export interface MoneyAccount { id: string; name: string; type: AccountType; amount: number; note?: string }

/** A debt the family owes. With a monthly payment + due day it is paid through a linked recurring item. */
/** `balance` is what was owed on `asOf` (defaults to the position date); later payments come off it. */
export interface MoneyDebt { id: string; name: string; balance: number; asOf?: string; monthlyPayment?: number; dueDay?: number; ratePct?: number; note?: string; recurringId?: string }

/** Where the family stands on one date; balances after that date follow the ledger. */
export interface MoneyPosition { asOf: string; accounts: MoneyAccount[]; debts: MoneyDebt[] }

/** One part of the family's own money split: a share of income and the ledger categories that count toward it. */
export interface AllocationBucket { key: string; label: string; share: number; categories: string[] }
export interface MoneyAllocation { buckets: AllocationBucket[] }

export interface MoneySettings {
  openingCash: number;
  openingSavings: number;
  monthlyPlan?: number;
  categories: MoneyCategory[];
  /** Current financial position; when set, it replaces openingCash/openingSavings as the balance anchor. */
  position?: MoneyPosition;
  /** The family's own split (money method "custom"). */
  allocation?: MoneyAllocation;
  /** What the family corrected in quick add: normalized content key → category. */
  categoryMemory?: Record<string, string>;
}

/** Everything the Money page needs for one month, in one request. */
export interface MoneyBundle {
  /** YYYY-MM */
  month: string;
  settings: MoneySettings;
  transactions: MoneyTransaction[];
  /** All-time totals up to the end of the requested month, for running balances. */
  totals: { income: number; expense: number; saving: number };
  budgets: MoneyBudget[];
  recurring: MoneyRecurring[];
  goals: MoneyGoal[];
  /** Paid toward each debt (by debt id) through its recurring item since `position.asOf`. */
  debtPaid?: Record<string, number>;
}

/** Category set from the product owner's household sheet (v2, 25/09/2026); users can add their own and archive. */
export const DEFAULT_CATEGORIES: MoneyCategory[] = [
  ...["Tiêu dùng", "Ăn uống", "Mua sắm", "Giải trí", "Học tập", "Hiếu hỉ", "Khám, thuốc", "Chi phí đầu tư", "Gia đình", "Con", "Du lịch", "Tiền điện", "Tiền nước", "Tiền trả góp", "Tiền thẻ tín dụng", "Tiền trả nợ cá nhân", "Tiền trả nợ quỹ", "Tiền cho vay", "Others"].map((name) => ({ name, kind: "expense" as const })),
  ...["Lương", "Đầu tư", "Thưởng", "Tiền dự án ngoài", "Vay cá nhân", "Vay ngân hàng", "Tiền trả nợ", "Gia đình hỗ trợ", "Others"].map((name) => ({ name, kind: "income" as const })),
];

/** Saving categories (fixed list): transfers into savings by purpose, and the withdrawal line (negative amounts). */
export const SAVING_CATEGORIES = ["Tiết kiệm cho gia đình", "Tiết kiệm cho con", "Tiết kiệm du lịch", "Tiết kiệm mua sắm", "Mua nhà", "Mua xe", "Trả nợ", "Rút tiền tiết kiệm"];
export const SAVING_DEFAULT = "Tiết kiệm cho gia đình";
export const SAVING_CHILD = "Tiết kiệm cho con";
export const SAVING_WITHDRAW = "Rút tiền tiết kiệm";
/** The catch-all category in both expense and income lists. */
export const OTHER_CATEGORY = "Others";

/**
 * Names from the first category set → their v2 names, per kind (the same old name can mean different things:
 * expense "Tiền trả nợ" is now "Tiền trả nợ cá nhân", while income "Tiền trả nợ" is the new name for money paid back).
 * Applied when reading, so entries saved under an old name show and group under the new one.
 */
const RENAMED: Record<MoneyKind, Record<string, string>> = {
  expense: { "Khác": "Others", "Tiền trả nợ": "Tiền trả nợ cá nhân" },
  income: { "Khác": "Others", "Dự án ngoài": "Tiền dự án ngoài", "Tiền trả nợ nhận về": "Tiền trả nợ" },
  saving: { "Tiết kiệm": "Tiết kiệm cho gia đình", "Rút tiết kiệm": "Rút tiền tiết kiệm" },
};
export const currentCategory = (name: string, kind: MoneyKind) => RENAMED[kind][name] ?? name;

/** A family's category list in v2 names: old names renamed, duplicates merged, new defaults added (custom ones kept). */
export function currentCategories(list: MoneyCategory[]): MoneyCategory[] {
  const out: MoneyCategory[] = [];
  for (const item of list) {
    const name = currentCategory(item.name, item.kind);
    const existing = out.find((entry) => entry.kind === item.kind && entry.name === name);
    if (existing) { if (!item.archived) existing.archived = undefined; continue; }
    out.push({ ...item, name });
  }
  for (const item of DEFAULT_CATEGORIES) if (!out.some((entry) => entry.kind === item.kind && entry.name === item.name)) out.push({ ...item });
  // The sheet's order first (per kind), then the family's own categories in the order they were added.
  const rank = (item: MoneyCategory) => { const index = DEFAULT_CATEGORIES.findIndex((entry) => entry.kind === item.kind && entry.name === item.name); return index < 0 ? DEFAULT_CATEGORIES.length : index; };
  return out.map((item, index) => ({ item, index })).sort((a, b) => (a.item.kind === b.item.kind ? 0 : a.item.kind === "expense" ? -1 : 1) || rank(a.item) - rank(b.item) || a.index - b.index).map(({ item }) => item);
}
