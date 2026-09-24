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

/** Category set from the product owner's household sheet (plan §6.2); users can rename/archive/add. */
export const DEFAULT_CATEGORIES: MoneyCategory[] = [
  ...["Ăn uống", "Tiêu dùng", "Mua sắm", "Con", "Gia đình", "Khám, thuốc", "Giải trí", "Học tập", "Hiếu hỉ", "Du lịch", "Tiền điện", "Tiền nước", "Tiền trả góp", "Tiền thẻ tín dụng", "Tiền trả nợ", "Tiền cho vay", "Chi phí đầu tư", "Khác"].map((name) => ({ name, kind: "expense" as const })),
  ...["Lương", "Thưởng", "Đầu tư", "Dự án ngoài", "Gia đình hỗ trợ", "Tiền trả nợ nhận về", "Vay cá nhân", "Vay ngân hàng", "Khác"].map((name) => ({ name, kind: "income" as const })),
];

export const SAVING_CATEGORIES = ["Tiết kiệm", "Tiết kiệm cho con", "Rút tiết kiệm"];
