"use client";

import { useState } from "react";
import { kgText, shortDate } from "@/lib/family/child-stats";
import { DAYS_PER_MONTH, WHO_MAX_DAYS, whoCurves, type Sex, type WhoPoint } from "@/lib/family/who-growth";

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
 * WHO weight-for-age chart: the ±2 SD band (normal range) shaded, the median and ±2/±3 SD lines, and the child's
 * weighings on top, plotted by age. The span follows the child (not from birth for older kids) so the line is readable.
 */
export function WhoChart({ points, sex, ageNowDays, width, color, today, name }: { points: WhoPoint[]; sex: Sex; ageNowDays: number; width: number; color: { dot: string; ink: string }; today: string; name: string }) {
  const [active, setActive] = useState<number | null>(null);
  const W = width;
  const firstAge = points[0]?.ageDays ?? ageNowDays;
  const monthStart = (days: number) => Math.floor(days / DAYS_PER_MONTH) * DAYS_PER_MONTH;
  const from = Math.max(0, monthStart(Math.min(firstAge, ageNowDays) - (ageNowDays < 730 ? 0 : 180)));
  const to = Math.min(WHO_MAX_DAYS, Math.max(from + 180, ageNowDays + (ageNowDays < 365 ? 60 : 120)));
  const curves = whoCurves(sex, ageNowDays < 730 ? 0 : from, to);
  const start = ageNowDays < 730 ? 0 : from;
  const allKg = [...curves.flatMap((line) => line.points.map((point) => point[1])), ...points.map((point) => point.kg)];
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
  const yStep = high - low > 16 ? 4 : high - low > 8 ? 2 : 1;
  const yTicks: number[] = [];
  for (let kg = Math.ceil(low / yStep) * yStep; kg <= high; kg += yStep) yTicks.push(kg);
  const shown = active !== null ? points[active] : undefined;
  const kid = points.length ? path(points.map((point) => [point.ageDays, point.kg])) : "";

  return <svg className="fam-chart fam-who" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cân nặng theo tuổi của ${name} so với chuẩn WHO (${sex === "male" ? "bé trai" : "bé gái"}): ${points.map((point) => `${ageLong(point.ageDays)} ${kgText(point.kg)}, bách phân vị ${point.percentile}`).join("; ")}`}>
    <path d={band} className="fam-who-band" />
    {yTicks.map((kg) => <g key={kg}><line x1={L} x2={W - R} y1={y(kg)} y2={y(kg)} className="fam-chart-grid" /><text x={L - 6} y={y(kg) + 4} className="fam-chart-axis" textAnchor="end">{kg}</text></g>)}
    {ticks.map((days) => <text key={days} x={x(days)} y={H - 8} className="fam-chart-axis" textAnchor="middle">{ageLabel(days)}</text>)}
    {curves.map((item) => <g key={item.z}><path d={path(item.points)} className={`fam-who-line z${item.z < 0 ? "m" : ""}${Math.abs(item.z)}`} /><text x={W - R + 4} y={y(item.points.at(-1)![1]) + 4} className="fam-who-label">{LINE_LABEL[item.z]}</text></g>)}
    {ageNowDays >= start && ageNowDays <= to && <line x1={x(ageNowDays)} x2={x(ageNowDays)} y1={T} y2={H - B} className="fam-chart-today" />}
    {kid && <path d={kid} fill="none" stroke={color.dot} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
    {points.map((point, index) => <circle key={point.date} cx={x(point.ageDays)} cy={y(point.kg)} r={active === index ? 8 : 5.5} fill="#fff" stroke={color.dot} strokeWidth="3" tabIndex={0} className="fam-chart-pt"
      onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} onClick={() => setActive(index)}><title>{`${shortDate(point.date)} · ${ageLong(point.ageDays)} · ${kgText(point.kg)} · bách phân vị ${point.percentile}`}</title></circle>)}
    {shown && <g className="fam-chart-tip" transform={`translate(${Math.min(W - R - 80, Math.max(L + 80, x(shown.ageDays)))},${Math.max(T + 22, y(shown.kg) - 18)})`}><rect x="-78" y="-20" width="156" height="26" rx="13" /><text textAnchor="middle" y="-2">{`${ageLong(shown.ageDays)} · ${kgText(shown.kg)} · P${shown.percentile}`}</text></g>}
    <text x={L + 4} y={T + 12} className="fam-who-src" fill={color.ink}>{sex === "male" ? "Bé trai" : "Bé gái"} · WHO {to > 1826 ? "2006/2007" : "2006"} · hôm nay {shortDate(today, today)}</text>
  </svg>;
}
