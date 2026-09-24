// Family State for the reminder jobs (cron, DATABASE_URL): the same snapshot the Home page builds, read with pg so one
// job can serve every family. Read-only (unlike loadBundle, it never posts recurring items).
import type pg from "pg";
import { profileFromRow } from "../experience/profile-mapper.ts";
import { budgetFromRow, goalFromRow, recurringFromRow, settingsFromRow, transactionFromRow } from "../money/store-server.ts";
import { monthKey, summarizeMonth } from "../money/summary.ts";
import type { MoneyBundle } from "../money/types.ts";
import { checkFromRow, itemFromRow, planFromRow } from "../shopping/item-store-server.ts";
import { estimateItems, itemRateResolver } from "../shopping/items.ts";
import { purchaseFromRow } from "../shopping/purchase-store-server.ts";
import type { Purchase } from "../shopping/purchases.ts";
import type { FamilySnapshot, FeedbackVerdict, InsightFeedback } from "./engine.ts";

export interface ServerState { snapshot: FamilySnapshot; purchases: Purchase[]; feedback: InsightFeedback[]; /** Reminders sent per insight key in the last 14 days. */ recent: Map<string, number>; sentToday: Set<string> }

export async function loadSnapshotPg(client: pg.Client, userId: string, today: string, now: Date): Promise<ServerState> {
  const month = monthKey(now);
  const q = (sql: string, params: unknown[] = [userId]) => client.query(sql, params).then((result) => result.rows as Record<string, unknown>[]);
  const [family, items, purchases, checks, plan, txMonth, history, totals, settings, budgets, recurring, goals, feedback, log] = await Promise.all([
    q(`select f.*, coalesce((select json_agg(c.*) from public.children c where c.family_profile_id = f.id), '[]'::json) as children from public.family_profiles f where f.user_id = $1`),
    q("select * from public.shopping_items where user_id = $1"),
    q("select * from public.purchases where user_id = $1 and purchased_on > current_date - 400"),
    q("select * from public.stock_checks where user_id = $1 and checked_on > current_date - 400"),
    q("select * from public.shopping_plan_entries where user_id = $1 and month >= $2", [userId, month]),
    q("select * from public.money_transactions where user_id = $1 and occurred_on >= $2::date and occurred_on < ($2::date + interval '1 month')", [userId, `${month}-01`]),
    q("select * from public.money_transactions where user_id = $1 and occurred_on > current_date - 40", [userId]),
    q("select kind, sum(amount)::bigint as amount from public.money_transactions where user_id = $1 group by kind"),
    q("select * from public.money_settings where user_id = $1"),
    q("select * from public.money_budgets where user_id = $1 and month = $2::date", [userId, `${month}-01`]),
    q("select * from public.money_recurring where user_id = $1", [userId]),
    q("select * from public.money_goals where user_id = $1", [userId]),
    q("select key, verdict, to_char(until, 'YYYY-MM-DD') as until from public.insight_feedback where user_id = $1"),
    q("select key, to_char(day, 'YYYY-MM-DD') as day from public.notification_log where user_id = $1 and day > $2::date - 14", [userId, today]),
  ]);
  const profile = family[0] ? profileFromRow(family[0]) : null;
  const sums = { income: 0, expense: 0, saving: 0 };
  for (const row of totals) sums[row.kind as keyof typeof sums] = Number(row.amount);
  const bundle: MoneyBundle = { month, settings: settingsFromRow(settings[0] ?? null), transactions: txMonth.map(transactionFromRow), totals: sums, budgets: budgets.map(budgetFromRow), recurring: recurring.map(recurringFromRow), goals: goals.map(goalFromRow) };
  const shoppingItems = items.map(itemFromRow); const shoppingPurchases = purchases.map(purchaseFromRow);
  const snapshot: FamilySnapshot = {
    profile, conversations: [],
    month: bundle.transactions.length || bundle.recurring.length ? summarizeMonth(bundle, now) : null,
    history: history.map(transactionFromRow), goals: bundle.goals,
    estimates: estimateItems(shoppingItems, shoppingPurchases, itemRateResolver(profile, now), now, checks.map(checkFromRow)),
    plan: plan.map(planFromRow),
    counts: { transactions: history.length, items: shoppingItems.length },
  };
  const recent = new Map<string, number>();
  for (const row of log) recent.set(row.key as string, (recent.get(row.key as string) ?? 0) + 1);
  return { snapshot, purchases: shoppingPurchases, feedback: feedback.map((row) => ({ key: row.key as string, verdict: row.verdict as FeedbackVerdict, until: (row.until as string | null) ?? undefined })), recent, sentToday: new Set(log.filter((row) => row.day === today).map((row) => row.key as string)) };
}
