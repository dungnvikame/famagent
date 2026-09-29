/**
 * Numbers the Family page derives from what the family already entered (birth date, weighings): exact age, day
 * count, next birthday and day milestone, the weight line, growth pace and when the next diaper size is due.
 * Pure, date-string based (YYYY-MM-DD, calendar days in UTC) so results do not drift with the device timezone.
 */
const DAY_MS = 86_400_000;
const toUtc = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
export const addDays = (iso: string, days: number) => toIso(toUtc(iso) + days * DAY_MS);

export interface AgeParts { years: number; months: number; days: number; totalMonths: number; /** 1 on the day of birth. */ dayNumber: number }

export function ageParts(birthDate: string, today: string): AgeParts {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  // Whole months = last "month-birthday" on or before today (31st clamps to the month's last day), then count days.
  const monthMark = (total: number) => { const last = new Date(Date.UTC(by, bm - 1 + total + 1, 0)).getUTCDate(); return toIso(Date.UTC(by, bm - 1 + total, Math.min(bd, last))); };
  let totalMonths = Math.max(0, (ty - by) * 12 + tm - bm);
  while (totalMonths > 0 && monthMark(totalMonths) > today) totalMonths -= 1;
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, days: daysBetween(monthMark(totalMonths), today), totalMonths, dayNumber: daysBetween(birthDate, today) + 1 };
}

/** "9 tháng 12 ngày" · "1 tuổi 2 tháng 9 ngày" · "3 tuổi 6 tháng" (days dropped from 3 years). */
export function ageText(age: AgeParts): string {
  if (age.years === 0) return age.months === 0 ? `${age.days} ngày tuổi` : `${age.months} tháng${age.days ? ` ${age.days} ngày` : ""}`;
  if (age.years < 3) return `${age.years} tuổi${age.months ? ` ${age.months} tháng` : ""}${age.days ? ` ${age.days} ngày` : ""}`;
  return `${age.years} tuổi${age.months ? ` ${age.months} tháng` : ""}`;
}
/** Short label for chips: "14 tháng" under 2 years, else "3 tuổi". */
export const ageShort = (age: AgeParts) => age.totalMonths < 24 ? `${age.totalMonths} tháng` : `${age.years} tuổi`;

/** Birthday on 29/02 falls on 28/02 in common years. */
function birthdayIn(year: number, birthDate: string): string {
  const [, m, d] = birthDate.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return toIso(Date.UTC(year, m - 1, Math.min(d, last)));
}

export interface Birthday { date: string; daysLeft: number; turning: number; /** 0–1 of the way from the last birthday (or birth). */ progress: number; isToday: boolean }
export function nextBirthday(birthDate: string, today: string): Birthday {
  const year = Number(today.slice(0, 4));
  let date = birthdayIn(year, birthDate);
  if (date < today) date = birthdayIn(year + 1, birthDate);
  const previous = date === today ? today : birthdayIn(Number(date.slice(0, 4)) - 1, birthDate);
  const start = previous < birthDate ? birthDate : previous;
  const span = daysBetween(start, date);
  return { date, daysLeft: daysBetween(today, date), turning: Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)), progress: date === today ? 1 : span ? daysBetween(start, today) / span : 0, isToday: date === today };
}

const DAY_MILESTONES = [100, 200, 300, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
/** Next round day count ("500 ngày tuổi"); `isToday` when today is one. */
export function dayMilestone(birthDate: string, today: string): { day: number; date: string; daysLeft: number; isToday: boolean } | null {
  const now = daysBetween(birthDate, today) + 1;
  const day = DAY_MILESTONES.find((value) => value >= now);
  if (!day) return null;
  return { day, date: addDays(birthDate, day - 1), daysLeft: day - now, isToday: day === now };
}

// ---------- weight ----------
export interface WeightPoint { date: string; kg: number; id?: string }

/** Diaper sizes by weight — same cut-offs as diaperSizeFor (lib/brief/build-brief). */
export const SIZE_BANDS = [
  { size: "NB/S", min: 0, max: 5 }, { size: "M", min: 5, max: 8 }, { size: "L", min: 8, max: 12 }, { size: "XL", min: 12, max: 15 }, { size: "XXL", min: 15, max: 40 },
] as const;
export const bandFor = (kg: number) => SIZE_BANDS.find((band) => kg >= band.min && kg < band.max) ?? SIZE_BANDS[SIZE_BANDS.length - 1];

/**
 * The weighings, oldest first, one per day. The profile's current weight joins the line when it is newer than the
 * last entry and a different number (chat updates, data from before the log existed) — never as a repeat.
 */
export function weightSeries(log: WeightPoint[], current?: { kg?: number; date?: string }): WeightPoint[] {
  const byDay = new Map<string, WeightPoint>();
  for (const point of [...log].sort((a, b) => a.date.localeCompare(b.date))) byDay.set(point.date, point);
  const series = [...byDay.values()];
  const last = series.at(-1);
  if (current?.kg !== undefined && current.date && (!last || (current.date > last.date && Math.abs(current.kg - last.kg) >= 0.05))) series.push({ date: current.date, kg: current.kg });
  return series;
}

/** Growth pace in kg per 30 days: least squares over the last 180 days; null with < 2 points or < 14 days apart. */
export function growthPerMonth(series: WeightPoint[]): number | null {
  const last = series.at(-1);
  if (!last) return null;
  const recent = series.filter((point) => daysBetween(point.date, last.date) <= 180);
  if (recent.length < 2 || daysBetween(recent[0].date, last.date) < 14) return null;
  const xs = recent.map((point) => daysBetween(recent[0].date, point.date));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = recent.reduce((a, p) => a + p.kg, 0) / recent.length;
  const cov = xs.reduce((sum, x, i) => sum + (x - mx) * (recent[i].kg - my), 0), vx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  return vx ? (cov / vx) * 30 : null;
}

export interface SizeOutlook { size: string; nextSize?: string; kgToGo?: number; /** Projected date the next size fits, when the pace says within a year. */ onDate?: string }
export function sizeOutlook(series: WeightPoint[], pace: number | null): SizeOutlook | null {
  const last = series.at(-1);
  if (!last) return null;
  const band = bandFor(last.kg);
  const next = SIZE_BANDS[SIZE_BANDS.indexOf(band) + 1];
  if (!next) return { size: band.size };
  const kgToGo = Math.round((next.min - last.kg) * 10) / 10;
  const days = pace && pace > 0.05 ? Math.ceil(kgToGo / pace * 30) : undefined;
  return { size: band.size, nextSize: next.size, kgToGo, onDate: days !== undefined && days <= 365 ? addDays(last.date, days) : undefined };
}

/** "18/08" or "18/08/2025" when not this year. */
export function shortDate(iso: string, today?: string): string {
  const [y, m, d] = iso.split("-");
  return today && today.slice(0, 4) === y ? `${d}/${m}` : `${d}/${m}/${y}`;
}
export const kgText = (kg: number) => `${(Math.round(kg * 10) / 10).toLocaleString("vi-VN")} kg`;
