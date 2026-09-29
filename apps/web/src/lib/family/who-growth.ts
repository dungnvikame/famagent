import { WHO_WFA } from "./who-wfa-data.ts";
import { WHO_BFA, WHO_HFA, WHO_WFH, WHO_WFL } from "./who-extra-data.ts";

/**
 * Growth against WHO: Child Growth Standards 2006 (0–5 years) and Growth Reference 2007 (5–19 years).
 * LMS method as in WHO anthro: z = ((x/M)^L − 1)/(L·S), with WHO's restricted extension beyond ±3 SD for weight-based
 * indicators (not for height). Reference only — the UI reads the numbers in plain words and never diagnoses.
 */
export type Sex = "male" | "female";
export interface Lms { l: number; m: number; s: number }
/** wfa weight-for-age · hfa length/height-for-age · bfa BMI-for-age (5–19 y) · wfl/wfh weight-for-length/height (x = cm). */
export type Indicator = "wfa" | "hfa" | "bfa" | "wfl" | "wfh";

export const DAYS_PER_MONTH = 30.4375;
const months = (value: number) => Math.round(value * DAYS_PER_MONTH);
/** Weight-for-age exists only up to 10 years (WHO 2007 stops there). */
export const WHO_MAX_DAYS = months(120);
const TABLES: Record<Indicator, typeof WHO_WFA> = { wfa: WHO_WFA, hfa: WHO_HFA, bfa: WHO_BFA, wfl: WHO_WFL, wfh: WHO_WFH };
/** Valid x range per indicator (days for age-based ones, cm for wfl/wfh). */
export const RANGE: Record<Indicator, [number, number]> = { wfa: [0, WHO_MAX_DAYS], hfa: [0, months(228)], bfa: [months(61), months(228)], wfl: [45, 110], wfh: [65, 120] };

/** L, M, S at x (linear between table rows); undefined outside the indicator's range. */
export function lmsAt(sex: Sex, x: number, indicator: Indicator = "wfa"): Lms | undefined {
  const [min, max] = RANGE[indicator];
  if (x < min || x > max) return undefined;
  const table = TABLES[indicator][sex];
  let hi = table.findIndex((row) => row[0] >= x);
  if (hi < 0) hi = table.length - 1;
  const b = table[hi], a = table[Math.max(0, hi - 1)];
  const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  const mix = (i: 1 | 2 | 3) => a[i] + (b[i] - a[i]) * t;
  return { l: mix(1), m: mix(2), s: mix(3) };
}

/** Measurement at a z-score. */
export function kgAtZ({ l, m, s }: Lms, z: number): number {
  return Math.abs(l) < 1e-9 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}

/** WHO z-score; `restricted` = linear extension past ±3 SD (weight-based indicators, as in WHO anthro). */
export function zScore(value: number, lms: Lms, restricted = true): number {
  const { l, m, s } = lms;
  const z = Math.abs(l) < 1e-9 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s);
  if (!restricted) return z;
  if (z > 3) { const sd3 = kgAtZ(lms, 3); return 3 + (value - sd3) / (sd3 - kgAtZ(lms, 2)); }
  if (z < -3) { const sd3 = kgAtZ(lms, -3); return -3 + (value - sd3) / (kgAtZ(lms, -2) - sd3); }
  return z;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
/** Percentile 0.1–99.9, one decimal under 1 / over 99, else whole. */
export function percentile(z: number): number {
  const p = normalCdf(z) * 100;
  return p < 1 || p > 99 ? Math.min(99.9, Math.max(0.1, Math.round(p * 10) / 10)) : Math.round(p);
}

export type WhoBand = "very_low" | "low" | "normal" | "high" | "very_high";
export function bandOf(z: number): WhoBand { return z < -3 ? "very_low" : z < -2 ? "low" : z <= 2 ? "normal" : z <= 3 ? "high" : "very_high"; }
/** Plain-language reading of weight-for-age (WHO cut-offs −2 / +2 SD); `advice` only when worth asking a doctor. */
export const BAND_TEXT: Record<WhoBand, { label: string; advice?: string }> = {
  very_low: { label: "Thấp hơn nhiều so với chuẩn (dưới −3 SD)", advice: "Nên cho bé đi khám nhi sớm để bác sĩ đánh giá." },
  low: { label: "Thấp hơn chuẩn (−3 đến −2 SD)", advice: "Nên hỏi bác sĩ nhi, nhất là khi cân nặng chững hoặc giảm." },
  normal: { label: "Trong khoảng chuẩn của WHO (−2 đến +2 SD)" },
  high: { label: "Cao hơn chuẩn (+2 đến +3 SD)", advice: "Cân nặng theo tuổi chưa đủ để kết luận thừa cân — xem thêm cân nặng so với chiều cao." },
  very_high: { label: "Cao hơn nhiều so với chuẩn (trên +3 SD)", advice: "Hỏi bác sĩ nhi, kèm cân nặng so với chiều cao." },
};
/** Height-for-age: short stature (stunting) is the concern; tall is rarely one. */
export const HEIGHT_TEXT: Record<WhoBand, { label: string; advice?: string }> = {
  very_low: { label: "Thấp hơn nhiều so với chuẩn (dưới −3 SD)", advice: "Nên cho bé đi khám nhi để bác sĩ đánh giá tăng trưởng và dinh dưỡng." },
  low: { label: "Thấp hơn chuẩn (−3 đến −2 SD, thấp còi)", advice: "Nên hỏi bác sĩ nhi; đo lại cẩn thận để chắc số đúng." },
  normal: { label: "Trong khoảng chuẩn của WHO (−2 đến +2 SD)" },
  high: { label: "Cao hơn chuẩn (+2 đến +3 SD)" },
  very_high: { label: "Rất cao so với tuổi (trên +3 SD)", advice: "Thường không đáng lo; hỏi bác sĩ nếu con cao vọt bất thường." },
};

export interface WhoPoint { date: string; ageDays: number; value: number; z: number; percentile: number }
const ageDaysOn = (birthDate: string, date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${birthDate}T00:00:00Z`)) / 86_400_000);

/** Places each measurement on an age-based WHO curve (wfa / hfa / bfa); points outside its range are left out. */
export function whoPoints(series: Array<{ date: string; value: number }>, birthDate: string, sex: Sex, indicator: "wfa" | "hfa" | "bfa" = "wfa"): WhoPoint[] {
  return series.flatMap((point) => {
    const ageDays = ageDaysOn(birthDate, point.date);
    const lms = lmsAt(sex, ageDays, indicator);
    if (!lms) return [];
    const z = zScore(point.value, lms, indicator !== "hfa");
    return [{ date: point.date, ageDays, value: point.value, z, percentile: percentile(z) }];
  });
}

/**
 * How the child moves across the curves: the change in z between the last two measurements at least 28 days apart.
 * "crossing" = more than 0.67 SD (≈ one major percentile band), the usual cue to look closer.
 */
export function zTrend(points: WhoPoint[]): { delta: number; kind: "steady" | "up" | "down"; crossing: boolean } | null {
  const last = points.at(-1);
  if (!last) return null;
  const earlier = [...points].reverse().find((point) => last.ageDays - point.ageDays >= 28);
  if (!earlier) return null;
  const delta = Math.round((last.z - earlier.z) * 100) / 100;
  return { delta, kind: Math.abs(delta) < 0.25 ? "steady" : delta > 0 ? "up" : "down", crossing: Math.abs(delta) > 0.67 };
}

/** z-lines WHO charts draw, for an age-based indicator from `fromDays` to `toDays` (step ≈ 1/60 of the span). */
export const WHO_LINES = [-3, -2, 0, 2, 3] as const;
export function whoCurves(sex: Sex, fromDays: number, toDays: number, indicator: "wfa" | "hfa" = "wfa"): Array<{ z: number; points: Array<[number, number]> }> {
  const [min, max] = RANGE[indicator];
  const start = Math.max(min, fromDays), end = Math.min(max, toDays);
  const step = Math.max(7, Math.round((end - start) / 60));
  const ages: number[] = [];
  for (let age = start; age < end; age += step) ages.push(age);
  ages.push(end);
  return WHO_LINES.map((z) => ({ z, points: ages.map((age) => [age, kgAtZ(lmsAt(sex, age, indicator)!, z)] as [number, number]) }));
}

// ---------- weight for height (under 5) / BMI-for-age (5–19) ----------
export type BodyBand = "severe_thin" | "thin" | "normal" | "risk_over" | "over" | "obese";
export interface BodyStatus { indicator: "wfl" | "wfh" | "bfa"; z: number; percentile: number; band: BodyBand; bmi?: number; date: string }
export const BODY_TEXT: Record<BodyBand, { label: string; advice?: string }> = {
  severe_thin: { label: "Gầy hơn nhiều so với chiều cao (dưới −3 SD)", advice: "Nên cho bé đi khám nhi sớm." },
  thin: { label: "Gầy so với chiều cao (−3 đến −2 SD)", advice: "Nên hỏi bác sĩ nhi về dinh dưỡng của bé." },
  normal: { label: "Cân đối với chiều cao" },
  risk_over: { label: "Hơi nặng so với chiều cao (+1 đến +2 SD)", advice: "Chưa đáng lo — theo dõi thêm, chú ý đồ ngọt và vận động." },
  over: { label: "Thừa cân so với chiều cao", advice: "Nên hỏi bác sĩ nhi về chế độ ăn và vận động." },
  obese: { label: "Béo phì so với chiều cao", advice: "Nên cho bé đi khám nhi để được tư vấn." },
};

/**
 * Weight against height from a weighing and a height measured within 31 days of each other. Under 5 years:
 * weight-for-length (< 2 years) or weight-for-height, cut-offs −3/−2/+1/+2/+3; 5–19 years: BMI-for-age, −3/−2/+1/+2.
 */
export function bodyStatus(sex: Sex, birthDate: string, weight: { date: string; value: number }, height: { date: string; value: number }): BodyStatus | null {
  if (Math.abs(ageDaysOn(height.date, weight.date)) > 31) return null;
  const ageDays = ageDaysOn(birthDate, weight.date);
  if (ageDays < 0) return null;
  if (ageDays < 1826) {
    const preferred: "wfl" | "wfh" = ageDays < 731 ? "wfl" : "wfh";
    const indicator = lmsAt(sex, height.value, preferred) ? preferred : lmsAt(sex, height.value, preferred === "wfl" ? "wfh" : "wfl") ? (preferred === "wfl" ? "wfh" : "wfl") : undefined;
    if (!indicator) return null;
    const z = zScore(weight.value, lmsAt(sex, height.value, indicator)!);
    const band: BodyBand = z < -3 ? "severe_thin" : z < -2 ? "thin" : z <= 1 ? "normal" : z <= 2 ? "risk_over" : z <= 3 ? "over" : "obese";
    return { indicator, z, percentile: percentile(z), band, date: weight.date };
  }
  const lms = lmsAt(sex, ageDays, "bfa");
  if (!lms) return null;
  const bmi = weight.value / (height.value / 100) ** 2;
  const z = zScore(bmi, lms);
  const band: BodyBand = z < -3 ? "severe_thin" : z < -2 ? "thin" : z <= 1 ? "normal" : z <= 2 ? "over" : "obese";
  return { indicator: "bfa", z, percentile: percentile(z), band, bmi: Math.round(bmi * 10) / 10, date: weight.date };
}
