"use client";

import { useId, useState } from "react";
import { SIZE_BANDS, bandFor, daysBetween, kgText, shortDate, type SizeOutlook, type WeightPoint } from "@/lib/family/child-stats";

const H = 230, L = 34, R = 40, T = 14, B = 28;

/** Weight line on diaper-size bands (the sizes FamAgent buys by) with a dashed projection to the next size. */
export function SizeChart({ series, today, color, name, width: W, outlook }: { series: WeightPoint[]; today: string; color: { dot: string; ink: string }; name: string; width: number; outlook: SizeOutlook | null }) {
  const gradientId = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const last = series.at(-1)!;
  const first = series[0].date;
  const projectionEnd = outlook?.onDate && outlook.nextSize ? outlook.onDate : undefined;
  const endDate = [last.date, today, projectionEnd].filter((value): value is string => Boolean(value)).sort().at(-1)!;
  const startDate = series.length === 1 ? shift(first, -30) : first;
  const span = Math.max(1, daysBetween(startDate, endDate));
  const kgs = series.map((point) => point.kg);
  const target = projectionEnd ? SIZE_BANDS.find((band) => band.size === outlook!.nextSize)!.min : undefined;
  let low = Math.floor(Math.min(...kgs) - 0.5), high = Math.ceil(Math.max(...kgs, target ?? 0) + 0.5);
  if (high - low < 3) { low = Math.max(0, low - 1); high = low + 3; }
  const x = (iso: string) => L + (daysBetween(startDate, iso) / span) * (W - L - R);
  const y = (value: number) => T + (1 - (value - low) / (high - low)) * (H - T - B);
  const line = series.map((point, index) => `${index ? "L" : "M"}${x(point.date).toFixed(1)},${y(point.kg).toFixed(1)}`).join(" ");
  const area = series.length > 1 ? `${line} L${x(last.date).toFixed(1)},${H - B} L${x(series[0].date).toFixed(1)},${H - B} Z` : "";
  const step = high - low > 8 ? 2 : 1;
  const yTicks = Array.from({ length: Math.floor((high - low) / step) + 1 }, (_, index) => low + index * step);
  // Month ticks too close to either end would overlap the end labels.
  const xTicks = [...new Set([startDate, ...monthStarts(startDate, endDate, W < 420 ? 2 : 4).filter((iso) => Math.min(daysBetween(startDate, iso), daysBetween(iso, endDate)) >= span * 0.12), endDate])];
  const shown = active !== null ? series[active] : undefined;
  return <svg className="fam-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Biểu đồ cân nặng của ${name}: ${series.map((point) => `${shortDate(point.date)} ${kgText(point.kg)}`).join(", ")}`}>
    <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color.dot} stopOpacity=".32" /><stop offset="1" stopColor={color.dot} stopOpacity="0" /></linearGradient></defs>
    {SIZE_BANDS.filter((band) => band.max > low && band.min < high).map((band, index) => {
      const top = y(Math.min(band.max, high)), bottom = y(Math.max(band.min, low));
      const current = bandFor(last.kg).size === band.size;
      return <g key={band.size}><rect x={L} y={top} width={W - L - R} height={bottom - top} fill={current ? color.dot : "#5b4bb7"} opacity={current ? 0.1 : index % 2 ? 0.03 : 0.06} />
        <text x={W - R + 6} y={(top + bottom) / 2 + 4} className={`fam-chart-band${current ? " on" : ""}`} fill={current ? color.ink : undefined}>{band.size}</text></g>;
    })}
    {yTicks.map((value) => <g key={value}><line x1={L} x2={W - R} y1={y(value)} y2={y(value)} className="fam-chart-grid" /><text x={L - 8} y={y(value) + 4} className="fam-chart-axis" textAnchor="end">{value}</text></g>)}
    {xTicks.map((iso) => <text key={iso} x={x(iso)} y={H - 8} className="fam-chart-axis" textAnchor={iso === startDate ? "start" : iso === endDate ? "end" : "middle"}>{shortDate(iso).slice(0, 5)}</text>)}
    {today >= startDate && today <= endDate && <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} className="fam-chart-today" />}
    {area && <path d={area} fill={`url(#${gradientId})`} />}
    {projectionEnd && target !== undefined && <g className="fam-chart-proj"><path d={`M${x(last.date)},${y(last.kg)} L${x(projectionEnd)},${y(target)}`} stroke={color.dot} /><circle cx={x(projectionEnd)} cy={y(target)} r="5" fill="#fff" stroke={color.dot} /><text x={x(projectionEnd) - 8} y={y(target) - 10} textAnchor="end" fill={color.ink}>~{outlook!.nextSize} {shortDate(projectionEnd, today).slice(0, 5)}</text></g>}
    <path d={line} fill="none" stroke={color.dot} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    {series.map((point, index) => <circle key={point.date} cx={x(point.date)} cy={y(point.kg)} r={active === index ? 8 : 5.5} fill="#fff" stroke={color.dot} strokeWidth="3" tabIndex={0} className="fam-chart-pt"
      onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} onClick={() => setActive(index)}><title>{`${shortDate(point.date)}: ${kgText(point.kg)}`}</title></circle>)}
    {shown && <g className="fam-chart-tip" transform={`translate(${Math.min(W - R - 60, Math.max(L + 60, x(shown.date)))},${Math.max(T + 22, y(shown.kg) - 18)})`}><rect x="-58" y="-20" width="116" height="26" rx="13" /><text textAnchor="middle" y="-2">{`${shortDate(shown.date, today)} · ${kgText(shown.kg)}`}</text></g>}
  </svg>;
}

function shift(iso: string, days: number) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); }
/** Up to `max` evenly spaced first-of-month dates strictly inside (start, end). */
function monthStarts(start: string, end: string, max: number): string[] {
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  for (;;) { m += 1; if (m > 12) { m = 1; y += 1; } const iso = `${y}-${String(m).padStart(2, "0")}-01`; if (iso >= end) break; out.push(iso); }
  if (out.length <= max) return out;
  const every = Math.ceil(out.length / max);
  return out.filter((_, index) => index % every === 0);
}
