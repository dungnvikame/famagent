"use client";

import { useState } from "react";
import { shortDate } from "@/lib/family/child-stats";
import { DAYS_PER_MONTH, RANGE, whoCurves, type Sex, type WhoPoint } from "@/lib/family/who-growth";

/** "10,9 kg" / "80,5 cm". */
export const measureText = (value: number, unit: "kg" | "cm") => `${(Math.round(value * 10) / 10).toLocaleString("vi-VN")} ${unit}`;

const H = 250, L = 34, R = 34, T = 12, B = 28;
const LINE_LABEL: Record<number, string> = { [-3]: "−3", [-2]: "−2", 0: "TB", 2: "+2", 3: "+3" };

/** "5 th" under 2 years, "2t" / "2t6" after (compact axis labels). */
function ageLabel(days: number): string {
  const months = Math.round(days / DAYS_PER_MONTH);
  if (months < 24) return `${months}th`;
  const years = Math.floor(months / 12), rest = months % 12;
  return rest ? `${years}t${rest}` : `${years} tuổi`;
}
export function ageLong(days: number): string {
  const months = Math.floor(days / DAYS_PER_MONTH);
  if (months < 1) return `${days} ngày tuổi`;
  if (months < 24) return `${months} tháng`;
  const years = Math.floor(months / 12), rest = months % 12;
  return rest ? `${years} tuổi ${rest} tháng` : `${years} tuổi`;
}

/**
 * WHO weight-for-age or length/height-for-age chart: the ±2 SD band (normal range) shaded, the median and ±2/±3 SD lines, and the child's
 * weighings on top, plotted by age. The span follows the child (not from birth for older kids) so the line is readable.
 */
export function WhoChart({ points, sex, indicator, ageNowDays, width, color, today, name }: { points: WhoPoint[]; sex: Sex; indicator: "wfa" | "hfa"; ageNowDays: number; width: number; color: { dot: string; ink: string }; today: string; name: string }) {
  const unit = indicator === "wfa" ? "kg" : "cm";
  const maxDays = RANGE[indicator][1];
  const [active, setActive] = useState<number | null>(null);
  const W = width;
  const firstAge = points[0]?.ageDays ?? ageNowDays;
  const monthStart = (days: number) => Math.floor(days / DAYS_PER_MONTH) * DAYS_PER_MONTH;
  const from = Math.max(0, monthStart(Math.min(firstAge, ageNowDays) - (ageNowDays < 730 ? 0 : 180)));
  const to = Math.min(maxDays, Math.max(from + 180, ageNowDays + (ageNowDays < 365 ? 60 : 120)));
  const curves = whoCurves(sex, ageNowDays < 730 ? 0 : from, to, indicator);
  const start = ageNowDays < 730 ? 0 : from;
  const allKg = [...curves.flatMap((line) => line.points.map((point) => point[1])), ...points.map((point) => point.value)];
  const low = Math.floor(Math.min(...allKg)), high = Math.ceil(Math.max(...allKg));
  const x = (days: number) => L + ((days - start) / Math.max(1, to - start)) * (W - L - R);
  const y = (kg: number) => T + (1 - (kg - low) / Math.max(1, high - low)) * (H - T - B);
  const path = (pts: Array<[number, number]>) => pts.map(([age, kg], index) => `${index ? "L" : "M"}${x(age).toFixed(1)},${y(kg).toFixed(1)}`).join(" ");
  const line = (z: number) => curves.find((item) => item.z === z)!.points;
  const band = `${path(line(2))} ${[...line(-2)].reverse().map(([age, kg]) => `L${x(age).toFixed(1)},${y(kg).toFixed(1)}`).join(" ")} Z`;
  const spanMonths = (to - start) / DAYS_PER_MONTH;
  const stepMonths = [1, 2, 3, 6, 12, 24].find((step) => spanMonths / step <= (W < 420 ? 4 : 7)) ?? 24;
  const ticks: number[] = [];
  for (let month = Math.ceil(start / DAYS_PER_MONTH / stepMonths) * stepMonths; month * DAYS_PER_MONTH <= to; month += stepMonths) ticks.push(month * DAYS_PER_MONTH);
  const yStep = [1, 2, 4, 5, 10, 20].find((step) => (high - low) / step <= 8) ?? 20;
  const yTicks: number[] = [];
  for (let kg = Math.ceil(low / yStep) * yStep; kg <= high; kg += yStep) yTicks.push(kg);
  const shown = active !== null ? points[active] : undefined;
  // End labels: ±3 are dropped when they would sit on top of ±2 (height curves run close together).
  const endY = new Map(curves.map((item) => [item.z, y(item.points.at(-1)![1])]));
  const labelled = new Set(curves.filter((item) => Math.abs(item.z) !== 3 || Math.abs(endY.get(item.z)! - endY.get(Math.sign(item.z) * 2)!) >= 11).map((item) => item.z));
  const kid = points.length ? path(points.map((point) => [point.ageDays, point.value])) : "";

  return <svg className="fam-chart fam-who" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${indicator === "wfa" ? "Cân nặng" : "Chiều cao"} theo tuổi của ${name} so với chuẩn WHO (${sex === "male" ? "bé trai" : "bé gái"}): ${points.map((point) => `${ageLong(point.ageDays)} ${measureText(point.value, unit)}, bách phân vị ${point.percentile}`).join("; ")}`}>
    <path d={band} className="fam-who-band" />
    {yTicks.map((kg) => <g key={kg}><line x1={L} x2={W - R} y1={y(kg)} y2={y(kg)} className="fam-chart-grid" /><text x={L - 6} y={y(kg) + 4} className="fam-chart-axis" textAnchor="end">{kg}</text></g>)}
    {ticks.map((days) => <text key={days} x={x(days)} y={H - 8} className="fam-chart-axis" textAnchor="middle">{ageLabel(days)}</text>)}
    {curves.map((item) => <g key={item.z}><path d={path(item.points)} className={`fam-who-line z${item.z < 0 ? "m" : ""}${Math.abs(item.z)}`} />{labelled.has(item.z) && <text x={W - R + 4} y={endY.get(item.z)! + 4} className="fam-who-label">{LINE_LABEL[item.z]}</text>}</g>)}
    {ageNowDays >= start && ageNowDays <= to && <line x1={x(ageNowDays)} x2={x(ageNowDays)} y1={T} y2={H - B} className="fam-chart-today" />}
    {kid && <path d={kid} fill="none" stroke={color.dot} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
    {points.map((point, index) => <circle key={point.date} cx={x(point.ageDays)} cy={y(point.value)} r={active === index ? 8 : 5.5} fill="#fff" stroke={color.dot} strokeWidth="3" tabIndex={0} className="fam-chart-pt"
      onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} onClick={() => setActive(index)}><title>{`${shortDate(point.date)} · ${ageLong(point.ageDays)} · ${measureText(point.value, unit)} · bách phân vị ${point.percentile}`}</title></circle>)}
    {shown && <g className="fam-chart-tip" transform={`translate(${Math.min(W - R - 80, Math.max(L + 80, x(shown.ageDays)))},${Math.max(T + 22, y(shown.value) - 18)})`}><rect x="-78" y="-20" width="156" height="26" rx="13" /><text textAnchor="middle" y="-2">{`${ageLong(shown.ageDays)} · ${measureText(shown.value, unit)} · P${shown.percentile}`}</text></g>}
    <text x={L + 4} y={T + 12} className="fam-who-src" fill={color.ink}>{sex === "male" ? "Bé trai" : "Bé gái"} · {indicator === "hfa" ? (ageNowDays < 731 ? "chiều dài nằm" : "chiều cao đứng") : "cân nặng"} · WHO {to > 1826 ? "2006/2007" : "2006"} · hôm nay {shortDate(today, today)}</text>
  </svg>;
}
