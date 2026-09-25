import { ACCOUNT_TYPES, MONEY_KINDS, type MoneyAccount, type MoneyAllocation, type MoneyBudget, type MoneyDebt, type MoneyGoal, type MoneyPosition, type MoneyRecurring, type MoneySettings, type MoneyTransaction } from "./types.ts";

// Hand-rolled guards (no schema lib in the project); each returns a clean object or null.
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const text = (value: unknown, max: number, min = 1) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max ? value.trim() : null;
const int = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) ? value : typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : null;
const MAX_VND = 100_000_000_000;
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const isMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const kind = (value: unknown) => (MONEY_KINDS as readonly string[]).includes(value as string) ? value as MoneyTransaction["kind"] : null;

export function validTransaction(input: unknown, id = crypto.randomUUID()): MoneyTransaction | null {
  if (!isRecord(input)) return null;
  const content = text(input.content, 120); const category = text(input.category, 40); const k = kind(input.kind); const amount = int(input.amount);
  if (!content || !category || !k || amount === null || amount === 0 || Math.abs(amount) > MAX_VND || (k !== "saving" && amount < 0) || !isDate(input.occurredOn)) return null;
  const note = input.note === undefined || input.note === "" ? undefined : text(input.note, 200) ?? undefined;
  if (input.note && !note) return null;
  return { id: uuid(input.id) ? input.id : id, occurredOn: input.occurredOn, content, category, kind: k, amount, forChild: input.forChild === true, childId: uuid(input.childId) ? input.childId : undefined, note, source: input.source === "recurring" || input.source === "purchase" ? input.source : "manual", recurringId: uuid(input.recurringId) ? input.recurringId : undefined, paidFrom: k === "expense" && input.paidFrom === "savings" ? "savings" : undefined };
}

export function validBudget(input: unknown, id = crypto.randomUUID()): MoneyBudget | null {
  if (!isRecord(input)) return null;
  const category = text(input.category, 40); const limitAmount = int(input.limitAmount);
  if (!category || !isMonth(input.month) || limitAmount === null || limitAmount <= 0 || limitAmount > MAX_VND) return null;
  return { id: uuid(input.id) ? input.id : id, category, month: input.month, limitAmount };
}

export function validRecurring(input: unknown, id = crypto.randomUUID()): MoneyRecurring | null {
  if (!isRecord(input)) return null;
  const name = text(input.name, 80); const category = text(input.category, 40); const k = kind(input.kind); const amount = int(input.amount); const day = int(input.dayOfMonth);
  if (!name || !category || !k || amount === null || amount <= 0 || amount > MAX_VND || day === null || day < 1 || day > 31) return null;
  return { id: uuid(input.id) ? input.id : id, name, category, kind: k, amount, dayOfMonth: day, active: input.active !== false, lastPostedMonth: isMonth(input.lastPostedMonth) ? input.lastPostedMonth : undefined };
}

export function validGoal(input: unknown, id = crypto.randomUUID()): MoneyGoal | null {
  if (!isRecord(input)) return null;
  const name = text(input.name, 80); const target = int(input.targetAmount); const saved = input.savedAmount === undefined ? 0 : int(input.savedAmount); const plan = input.monthlyPlan === undefined || input.monthlyPlan === null || input.monthlyPlan === "" ? undefined : int(input.monthlyPlan);
  if (!name || target === null || target <= 0 || target > MAX_VND || saved === null || saved < 0 || plan === null || (plan !== undefined && plan <= 0)) return null;
  return { id: uuid(input.id) ? input.id : id, name, targetAmount: target, savedAmount: saved, monthlyPlan: plan };
}

export function validSettings(input: unknown): MoneySettings | null {
  if (!isRecord(input)) return null;
  const openingCash = int(input.openingCash ?? 0); const openingSavings = int(input.openingSavings ?? 0);
  const plan = input.monthlyPlan === undefined || input.monthlyPlan === null || input.monthlyPlan === "" ? undefined : int(input.monthlyPlan);
  if (openingCash === null || openingSavings === null || plan === null || (plan !== undefined && plan <= 0) || Math.abs(openingCash) > MAX_VND || Math.abs(openingSavings) > MAX_VND) return null;
  if (!Array.isArray(input.categories) || input.categories.length > 80) return null;
  const categories: MoneySettings["categories"] = [];
  for (const item of input.categories) {
    if (!isRecord(item)) return null;
    const name = text(item.name, 40); if (!name || (item.kind !== "expense" && item.kind !== "income")) return null;
    categories.push({ name, kind: item.kind as "expense" | "income", archived: item.archived === true || undefined });
  }
  const position = input.position === undefined || input.position === null ? undefined : validPosition(input.position);
  const allocation = input.allocation === undefined || input.allocation === null ? undefined : validAllocation(input.allocation);
  const categoryMemory = input.categoryMemory === undefined || input.categoryMemory === null ? undefined : validMemory(input.categoryMemory);
  if (position === null || allocation === null || categoryMemory === null) return null;
  return { openingCash, openingSavings, monthlyPlan: plan, categories, position, allocation, categoryMemory };
}

const optionalInt = (value: unknown) => value === undefined || value === null || value === "" ? undefined : int(value);
const optionalText = (value: unknown, max: number) => value === undefined || value === null || value === "" ? undefined : text(value, max);

function validAccount(input: unknown): MoneyAccount | null {
  if (!isRecord(input)) return null;
  const name = text(input.name, 60); const amount = int(input.amount); const note = optionalText(input.note, 120);
  if (!name || !uuid(input.id) || !(ACCOUNT_TYPES as readonly string[]).includes(input.type as string) || amount === null || Math.abs(amount) > MAX_VND || note === null) return null;
  return { id: input.id, name, type: input.type as MoneyAccount["type"], amount, note };
}

function validDebt(input: unknown): MoneyDebt | null {
  if (!isRecord(input)) return null;
  const name = text(input.name, 60); const balance = int(input.balance); const monthly = optionalInt(input.monthlyPayment); const day = optionalInt(input.dueDay); const note = optionalText(input.note, 120);
  const rate = input.ratePct === undefined || input.ratePct === null || input.ratePct === "" ? undefined : typeof input.ratePct === "number" && Number.isFinite(input.ratePct) ? input.ratePct : null;
  if (!name || !uuid(input.id) || balance === null || balance < 0 || balance > MAX_VND || monthly === null || (monthly !== undefined && (monthly <= 0 || monthly > MAX_VND)) || note === null) return null;
  if (day === null || (day !== undefined && (day < 1 || day > 31)) || rate === null || (rate !== undefined && (rate < 0 || rate > 100))) return null;
  return { id: input.id, name, balance, asOf: isDate(input.asOf) ? input.asOf : undefined, monthlyPayment: monthly, dueDay: day, ratePct: rate, note, recurringId: uuid(input.recurringId) ? input.recurringId : undefined };
}

export function validPosition(input: unknown): MoneyPosition | null {
  if (!isRecord(input) || !isDate(input.asOf) || !Array.isArray(input.accounts) || !Array.isArray(input.debts) || input.accounts.length > 30 || input.debts.length > 30) return null;
  const accounts = input.accounts.map(validAccount); const debts = input.debts.map(validDebt);
  if (accounts.some((item) => !item) || debts.some((item) => !item)) return null;
  return { asOf: input.asOf, accounts: accounts as MoneyAccount[], debts: debts as MoneyDebt[] };
}

export function validAllocation(input: unknown): MoneyAllocation | null {
  if (!isRecord(input) || !Array.isArray(input.buckets) || !input.buckets.length || input.buckets.length > 12) return null;
  const base = input.base === undefined || input.base === null ? undefined : typeof input.base === "number" && Number.isInteger(input.base) && input.base > 0 && input.base <= MAX_VND ? input.base : null;
  if (base === null) return null;
  const buckets: MoneyAllocation["buckets"] = [];
  for (const item of input.buckets) {
    if (!isRecord(item)) return null;
    const label = text(item.label, 40); const key = text(item.key, 40);
    if (!label || !key || typeof item.share !== "number" || !(item.share >= 0 && item.share <= 1) || !Array.isArray(item.categories) || item.categories.length > 60) return null;
    const categories = item.categories.map((name) => text(name, 40));
    if (categories.some((name) => !name)) return null;
    const amount = item.amount === undefined || item.amount === null ? undefined : typeof item.amount === "number" && Number.isInteger(item.amount) && item.amount > 0 && item.amount <= MAX_VND ? item.amount : null;
    if (amount === null) return null;
    buckets.push({ key, label, amount, share: Math.round(item.share * 1_000_000) / 1_000_000, categories: [...new Set(categories as string[])] });
  }
  return base ? { buckets, base } : { buckets };
}

function validMemory(input: unknown): Record<string, string> | null {
  if (!isRecord(input)) return null;
  const entries = Object.entries(input);
  if (entries.length > 300) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of entries) { const category = text(value, 40); if (!category || key.length > 60) return null; out[key] = category; }
  return out;
}
