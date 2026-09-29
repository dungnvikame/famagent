// Money Q&A turn for /api/chat: picks the ledger slice for the asked period (this month, last month, last 7 days),
// all on the Vietnam calendar, and answers from it with templates. The loader is injected so this stays testable.
import { answerMoney, summarizeWeek, type MoneyPeriod, type MoneyQuestion } from "../money/answer.ts";
import { monthKey, summarizeMonth } from "../money/summary.ts";
import type { MoneyBundle } from "../money/types.ts";
import { nowVn, todayVn } from "../time/vn-date.ts";

export type MoneyLoader = (month: string, now: Date) => Promise<MoneyBundle | null>;

const previousMonth = (month: string) => { const [year, index] = month.split("-").map(Number); return index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, "0")}`; };

const weekShaped = (kind: MoneyQuestion) => kind === "overview" || kind === "category" || kind === "child";
/**
 * Balance and upcoming bills are "now"-shaped: they answer for the current month whatever period was asked. The plan
 * and savings are month-shaped: asked for a week, they answer for the month and say so (answerMoney adds the note).
 */
const periodFor = (kind: MoneyQuestion, asked: MoneyPeriod): MoneyPeriod =>
  kind === "balance" || kind === "upcoming" ? "month" : asked;

/** Null when the ledger could not be loaded (the caller reports it). */
export async function answerMoneyTurn(load: MoneyLoader, question: MoneyQuestion, asked: MoneyPeriod, message: string, instant: Date = new Date()): Promise<{ text: string; choices: string[] } | null> {
  const now = nowVn(instant);
  const today = todayVn(instant);
  const thisMonth = monthKey(now);
  const period = periodFor(question, asked);
  // The current month is always loaded first: it posts due recurring items before any earlier month is read.
  const current = await load(thisMonth, now);
  if (!current) return null;
  if (period === "month") return answerMoney(question, summarizeMonth(current, now), message, { period });
  if (period === "lastMonth") {
    const last = await load(previousMonth(thisMonth), now);
    return last ? answerMoney(question, summarizeMonth(last, now), message, { period }) : null;
  }
  // The 7 days may start in the previous month.
  let transactions = current.transactions;
  if (weekShaped(question) && Number(today.slice(8)) <= 6) {
    const last = await load(previousMonth(thisMonth), now);
    if (!last) return null;
    transactions = [...transactions, ...last.transactions];
  }
  return answerMoney(question, summarizeMonth(current, now), message, { period, week: summarizeWeek(transactions, today) });
}
