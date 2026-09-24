// Weekly Family Brief (core journey spec §8): a very short "Nhà mình tuần này" — money this week vs last, what was
// bought and how long it lasts, whether savings are on track, and what next week needs. Pure; Home page + Sunday push.
import { shortVnd } from "../money/summary.ts";
import type { Purchase } from "../shopping/purchases.ts";
import type { FamilySnapshot } from "./engine.ts";

export interface WeeklyBrief { money: string[]; shopping: string[]; goal: string[]; nextWeek: string[]; /** One line for the push notification. */ headline: string }

const DAY_MS = 86_400_000;
const localDay = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Savings vs the goals' monthly plan, prorated to today (null when no goal has a monthly plan). */
export function savingsOnTrack(snapshot: FamilySnapshot, now = new Date()): boolean | null {
  const planned = snapshot.goals.reduce((sum, goal) => sum + (goal.monthlyPlan ?? 0), 0);
  if (!snapshot.month || planned <= 0) return null;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return snapshot.month.saving >= planned * now.getDate() / days * 0.9;
}

export function buildWeekly(snapshot: FamilySnapshot, purchases: Purchase[], now = new Date()): WeeklyBrief {
  const today = localDay(now);
  const weekStart = localDay(new Date(now.getTime() - 6 * DAY_MS));
  const lastStart = localDay(new Date(now.getTime() - 13 * DAY_MS));
  const expense = (from: string, to: string) => snapshot.history.filter((tx) => tx.kind === "expense" && tx.occurredOn >= from && tx.occurredOn <= to).reduce((sum, tx) => sum + tx.amount, 0);
  const thisWeek = expense(weekStart, today); const lastWeek = expense(lastStart, localDay(new Date(now.getTime() - 7 * DAY_MS)));
  const money = [`Đã chi ${shortVnd(thisWeek)}`];
  if (lastWeek > 0) money.push(thisWeek >= lastWeek ? `Cao hơn tuần trước ${shortVnd(thisWeek - lastWeek)}` : `Thấp hơn tuần trước ${shortVnd(lastWeek - thisWeek)}`);

  const bought = purchases.filter((purchase) => purchase.purchasedOn >= weekStart && purchase.purchasedOn <= today);
  const shopping: string[] = [];
  for (const itemId of [...new Set(bought.map((purchase) => purchase.itemId).filter(Boolean))].slice(0, 3)) {
    const estimate = snapshot.estimates.find((entry) => entry.item.id === itemId);
    if (estimate) shopping.push(`Đã mua ${estimate.item.name}${estimate.daysLeft !== null ? ` · dự kiến đủ ${estimate.daysLeft} ngày` : ""}`);
  }
  if (!shopping.length) shopping.push(bought.length ? `Đã ghi ${bought.length} lần mua` : "Chưa ghi lần mua nào tuần này");

  const onTrack = savingsOnTrack(snapshot, now);
  const goal = onTrack === null ? [] : [onTrack ? "Tiết kiệm vẫn đúng tiến độ" : "Tiết kiệm đang chậm hơn kế hoạch tháng"];

  const nextWeek: string[] = [];
  for (const estimate of snapshot.estimates.filter((entry) => entry.known && entry.daysLeft !== null && entry.daysLeft <= 7).slice(0, 3)) nextWeek.push(`Có thể cần mua ${estimate.item.name.charAt(0).toLocaleLowerCase("vi") + estimate.item.name.slice(1)}`);
  const budgets = snapshot.month?.byCategory.filter((line) => line.limit) ?? [];
  const tightest = budgets.map((line) => ({ line, left: line.limit! - line.spent })).sort((a, b) => a.left - b.left)[0];
  if (tightest) nextWeek.push(tightest.left > 0 ? `Ngân sách ${tightest.line.category} còn ${shortVnd(tightest.left)}` : `Ngân sách ${tightest.line.category} đã vượt ${shortVnd(-tightest.left)}`);
  if (!nextWeek.length) nextWeek.push("Không có món nào sắp hết");

  const headline = [`Tuần này chi ${shortVnd(thisWeek)}`, nextWeek[0] !== "Không có món nào sắp hết" ? nextWeek[0].toLocaleLowerCase("vi") : null, onTrack === false ? "tiết kiệm đang chậm" : null].filter(Boolean).join(" · ");
  return { money, shopping, goal, nextWeek, headline };
}
