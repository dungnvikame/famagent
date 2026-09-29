import { WHO_WFA } from "./who-wfa-data.ts";

/**
 * Weight-for-age against WHO: Child Growth Standards 2006 (0–5 years) and Growth Reference 2007 (5–10 years).
 * LMS method as in WHO anthro: z = ((kg/M)^L − 1)/(L·S), with WHO's restricted extension beyond ±3 SD.
 * Reference only — weight-for-age cannot tell over/underweight for height; the UI says so and never diagnoses.
 */
export type Sex = "male" | "female";
export interface Lms { l: number; m: number; s: number }

/** Last age with data: 120 months (WHO publishes weight-for-age up to 10 years only). */
export const WHO_MAX_DAYS = Math.round(120 * 30.4375);
export const DAYS_PER_MONTH = 30.4375;

/** L, M, S at an age in days (linear between table rows); undefined outside 0–10 years. */
export function lmsAt(sex: Sex, ageDays: number): Lms | undefined {
  const table = WHO_WFA[sex];
  if (ageDays < 0 || ageDays > WHO_MAX_DAYS) return undefined;
  let hi = table.findIndex((row) => row[0] >= ageDays);
  if (hi < 0) hi = table.length - 1;
  const b = table[hi], a = table[Math.max(0, hi - 1)];
  const t = b[0] === a[0] ? 0 : (ageDays - a[0]) / (b[0] - a[0]);
  const mix = (i: 1 | 2 | 3) => a[i] + (b[i] - a[i]) * t;
  return { l: mix(1), m: mix(2), s: mix(3) };
}

/** Weight (kg) at a z-score. */
export function kgAtZ({ l, m, s }: Lms, z: number): number {
  return Math.abs(l) < 1e-9 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}

/** WHO z-score of a weight, with the restricted linear extension past ±3 SD (as in WHO anthro). */
export function zScore(kg: number, lms: Lms): number {
  const { l, m, s } = lms;
  const z = Math.abs(l) < 1e-9 ? Math.log(kg / m) / s : (Math.pow(kg / m, l) - 1) / (l * s);
  if (z > 3) { const sd3 = kgAtZ(lms, 3); return 3 + (kg - sd3) / (sd3 - kgAtZ(lms, 2)); }
  if (z < -3) { const sd3 = kgAtZ(lms, -3); return -3 + (kg - sd3) / (kgAtZ(lms, -2) - sd3); }
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
/** Plain-language reading (WHO cut-offs −2 / +2 SD); `advice` only when worth asking a doctor. */
export const BAND_TEXT: Record<WhoBand, { label: string; advice?: string }> = {
  very_low: { label: "Thấp hơn nhiều so với chuẩn (dưới −3 SD)", advice: "Nên cho bé đi khám nhi sớm để bác sĩ đánh giá." },
  low: { label: "Thấp hơn chuẩn (−3 đến −2 SD)", advice: "Nên hỏi bác sĩ nhi, nhất là khi cân nặng chững hoặc giảm." },
  normal: { label: "Trong khoảng chuẩn của WHO (−2 đến +2 SD)" },
  high: { label: "Cao hơn chuẩn (+2 đến +3 SD)", advice: "Cân nặng theo tuổi không đủ để kết luận thừa cân — hỏi bác sĩ về cân nặng theo chiều cao." },
  very_high: { label: "Cao hơn nhiều so với chuẩn (trên +3 SD)", advice: "Hỏi bác sĩ nhi để đánh giá cân nặng theo chiều cao." },
};

export interface WhoPoint { date: string; ageDays: number; kg: number; z: number; percentile: number }

/** Places each weighing on the WHO curve; points outside 0–10 years are left out. */
export function whoPoints(series: Array<{ date: string; kg: number }>, birthDate: string, sex: Sex): WhoPoint[] {
  const birth = Date.parse(`${birthDate}T00:00:00Z`);
  return series.flatMap((point) => {
    const ageDays = Math.round((Date.parse(`${point.date}T00:00:00Z`) - birth) / 86_400_000);
    const lms = lmsAt(sex, ageDays);
    if (!lms) return [];
    const z = zScore(point.kg, lms);
    return [{ date: point.date, ageDays, kg: point.kg, z, percentile: percentile(z) }];
  });
}

/**
 * How the child moves across the curves: the change in z between the last two weighings at least 28 days apart.
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

/** z-lines WHO charts draw, for a curve from `fromDays` to `toDays` (step ≈ 2 weeks). */
export const WHO_LINES = [-3, -2, 0, 2, 3] as const;
export function whoCurves(sex: Sex, fromDays: number, toDays: number): Array<{ z: number; points: Array<[number, number]> }> {
  const start = Math.max(0, fromDays), end = Math.min(WHO_MAX_DAYS, toDays);
  const step = Math.max(7, Math.round((end - start) / 60));
  const ages: number[] = [];
  for (let age = start; age < end; age += step) ages.push(age);
  ages.push(end);
  return WHO_LINES.map((z) => ({ z, points: ages.map((age) => [age, kgAtZ(lmsAt(sex, age)!, z)] as [number, number]) }));
}
