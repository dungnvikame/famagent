"use client";

import { useState, type ReactNode } from "react";
import { vnd } from "@/lib/catalog/format";
import type { MonthTotals } from "@/lib/money/history";

/**
 * Small SVG charts for the Tháng tab (no chart library): thin marks, one axis, recessive grid, a hover tooltip
 * with exact amounts. Colors come from the .viz tokens in money-upgrade.css (validated income/expense pair).
 */

type Tip = { x: number; y: number; lines: ReactNode[] } | null;
const tr = (amount: number) => amount >= 1_000_000 || amount <= -1_000_000 ? `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr` : `${Math.round(amount / 1000)}k`;
const niceMax = (value: number) => { if (value <= 0) return 1_000_000; const step = 10 ** Math.floor(Math.log10(value)); return Math.ceil(value / step * 1.1) * step; };

function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const bind = (lines: ReactNode[]) => ({ onMouseMove: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, lines }), onMouseLeave: () => setTip(null) });
  const node = tip && <div className="chart-tip" style={{ left: tip.x + 14, top: tip.y + 14 }} role="tooltip">{tip.lines.map((line, index) => <div key={index}>{line}</div>)}</div>;
  return { bind, node };
}

function Grid({ max, width, top, bottom, left }: { max: number; width: number; top: number; bottom: number; left: number }) {
  const y = (value: number) => top + (bottom - top) * (1 - value / max);
  return <>{[0, 0.5, 1].map((share) => <g key={share}><line x1={left} x2={width} y1={y(max * share)} y2={y(max * share)} className="grid" /><text x={left - 6} y={y(max * share) + 4} textAnchor="end">{share ? tr(max * share) : "0"}</text></g>)}</>;
}

/** Income vs expense per month (grouped columns) with what was left on top. */
export function TrendChart({ rows }: { rows: MonthTotals[] }) {
  const { bind, node } = useTip();
  const W = 1000, H = 250, L = 44, T = 24, B = H - 24;
  const max = niceMax(Math.max(...rows.map((row) => Math.max(row.income, row.expense))));
  const y = (value: number) => T + (B - T) * (1 - value / max);
  const slot = (W - L) / rows.length; const bw = Math.min(26, slot / 3.4);
  return <div className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Thu và chi theo tháng">
    <Grid max={max} width={W} top={T} bottom={B} left={L} />
    {rows.map((row) => {
      const cx = L + slot * rows.indexOf(row) + slot / 2; const left = row.income - row.expense - row.saving;
      return <g key={row.month} {...bind([<b key="m">Tháng {Number(row.month.slice(5))}/{row.month.slice(0, 4)}</b>, `Thu ${vnd(row.income)}`, `Chi ${vnd(row.expense)}`, `Để dành ${vnd(row.saving)}`, `Còn lại ${vnd(left)}`])}>
        <rect x={cx - slot / 2} y={T} width={slot} height={B - T} fill="transparent" />
        {row.income > 0 && <rect className="m-income" x={cx - bw - 1} y={y(row.income)} width={bw} height={B - y(row.income)} rx={4} />}
        {row.expense > 0 && <rect className="m-expense" x={cx + 1} y={y(row.expense)} width={bw} height={B - y(row.expense)} rx={4} />}
        {(row.income > 0 || row.expense > 0) && <text className="val" x={cx} y={y(Math.max(row.income, row.expense)) - 6} textAnchor="middle">{left >= 0 ? "+" : ""}{tr(left)}</text>}
        <text x={cx} y={H - 6} textAnchor="middle">T{Number(row.month.slice(5))}</text>
      </g>;
    })}
  </svg>{node}</div>;
}

/** Cumulative spend by day against the plan spread evenly over the month. */
export function PaceChart({ cumulative, plan, days, month }: { cumulative: number[]; plan?: number; days: number; month: string }) {
  const { bind, node } = useTip();
  const W = 520, H = 230, L = 42, T = 14, B = H - 22;
  const max = niceMax(Math.max(plan ?? 0, ...cumulative));
  const x = (day: number) => L + (W - L - 6) * (day - 1) / Math.max(1, days - 1); const y = (value: number) => T + (B - T) * (1 - value / max);
  const last = cumulative.length;
  return <div className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chi cộng dồn so với kế hoạch">
    <Grid max={max} width={W} top={T} bottom={B} left={L} />
    {[1, Math.round(days / 2), days].map((day) => <text key={day} x={x(day)} y={H - 4} textAnchor="middle">{day}/{Number(month.slice(5))}</text>)}
    {plan && <line x1={x(1)} y1={y(plan / days)} x2={x(days)} y2={y(plan)} className="m-plan" />}
    {last > 0 && <path d={cumulative.map((value, index) => `${index ? "L" : "M"}${x(index + 1)},${y(value)}`).join("")} className="m-line-expense" />}
    {last > 0 && <circle cx={x(last)} cy={y(cumulative[last - 1])} r={4} className="m-dot-expense" />}
    {cumulative.map((value, index) => <rect key={index} x={x(index + 1) - (W - L) / days / 2} y={T} width={(W - L) / days} height={B - T} fill="transparent" {...bind([<b key="d">{index + 1}/{Number(month.slice(5))}</b>, `Đã chi ${vnd(value)}`, ...(plan ? [`Kế hoạch tới ngày này ${vnd(plan / days * (index + 1))}`] : [])])} />)}
  </svg>{node}</div>;
}

/** Closing cash per day; the lowest day is marked. */
export function CashChart({ series, month }: { series: number[]; month: string }) {
  const { bind, node } = useTip();
  const W = 520, H = 230, L = 42, T = 14, B = H - 22;
  const days = Math.max(series.length, 2);
  const lo = Math.min(0, ...series); const max = niceMax(Math.max(...series, 1));
  const x = (day: number) => L + (W - L - 6) * (day - 1) / (days - 1); const y = (value: number) => T + (B - T) * (1 - (value - lo) / (max - lo));
  const low = series.indexOf(Math.min(...series));
  const line = series.map((value, index) => `${index ? "L" : "M"}${x(index + 1)},${y(value)}`).join("");
  return <div className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Số dư tiền tiêu theo ngày">
    <Grid max={max} width={W} top={T} bottom={y(0)} left={L} />
    {[1, Math.round(days / 2), days].map((day) => <text key={day} x={x(day)} y={H - 4} textAnchor="middle">{day}/{Number(month.slice(5))}</text>)}
    {series.length > 1 && <path d={`${line}L${x(series.length)},${y(Math.max(lo, 0))}L${x(1)},${y(Math.max(lo, 0))}Z`} className="m-area" />}
    {series.length > 1 && <path d={line} className="m-line-income" />}
    {low >= 0 && series.length > 1 && <><circle cx={x(low + 1)} cy={y(series[low])} r={4} className="m-dot-income" /><text className="val" x={x(low + 1)} y={y(series[low]) + 16} textAnchor="middle">thấp nhất {tr(series[low])}</text></>}
    {series.map((value, index) => <rect key={index} x={x(index + 1) - (W - L) / days / 2} y={T} width={(W - L) / days} height={B - T} fill="transparent" {...bind([<b key="d">{index + 1}/{Number(month.slice(5))}</b>, `Số dư ${vnd(value)}`])} />)}
  </svg>{node}</div>;
}
