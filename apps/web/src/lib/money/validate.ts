import { MONEY_KINDS, type MoneyBudget, type MoneyGoal, type MoneyRecurring, type MoneySettings, type MoneyTransaction } from "./types.ts";

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
  return { id: uuid(input.id) ? input.id : id, occurredOn: input.occurredOn, content, category, kind: k, amount, forChild: input.forChild === true, childId: uuid(input.childId) ? input.childId : undefined, note, source: input.source === "recurring" || input.source === "purchase" ? input.source : "manual", recurringId: uuid(input.recurringId) ? input.recurringId : undefined };
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
  if (!Array.isArray(input.categories) || input.categories.length > 60) return null;
  const categories: MoneySettings["categories"] = [];
  for (const item of input.categories) {
    if (!isRecord(item)) return null;
    const name = text(item.name, 40); if (!name || (item.kind !== "expense" && item.kind !== "income")) return null;
    categories.push({ name, kind: item.kind as "expense" | "income", archived: item.archived === true || undefined });
  }
  return { openingCash, openingSavings, monthlyPlan: plan, categories };
}
