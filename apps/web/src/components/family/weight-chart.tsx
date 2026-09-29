"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SIZE_BANDS, bandFor, daysBetween, growthPerMonth, kgText, shortDate, sizeOutlook, type WeightPoint } from "@/lib/family/child-stats";
import { BAND_TEXT, WHO_MAX_DAYS, bandOf, whoPoints, zTrend, type Sex } from "@/lib/family/who-growth";
import { WhoChart } from "./who-chart";

/** What the WHO view needs; without sex or birth date it asks for them in place of the chart. */
export interface WhoOptions { sex?: Sex; birthDate?: string; showSize: boolean; onSex: (sex: Sex) => void; onAddBirth: () => void }

const H = 230, L = 34, R = 40, T = 14, B = 28;

/**
 * Growth line of one child, two views: on diaper-size bands (the sizes FamAgent buys by, with pace and a dashed
 * projection to the next size) or on the WHO weight-for-age curves (z-score, percentile, trend). Each weighing can
 * be removed; a new one is one date + one number.
 */
export function WeightChart({ series, today, color, name, who, onAdd, onDelete }: {
  series: WeightPoint[]; today: string; color: { dot: string; ink: string }; name: string; who: WhoOptions;
  onAdd: (date: string, kg: number) => Promise<void>; onDelete: (point: WeightPoint) => Promise<void>;
}) {
  const gradientId = useId().replace(/:/g, "");
  // Drawn at the real width so axis text stays 11–12 px on phones instead of shrinking with a fixed viewBox.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setW(Math.max(280, Math.round(node.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [active, setActive] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [all, setAll] = useState(false);
  const pace = growthPerMonth(series);
  const outlook = sizeOutlook(series, pace);
  const last = series.at(-1);
  const [mode, setMode] = useState<"size" | "who">(who.showSize ? "size" : "who");
  const view = who.showSize ? mode : "who";
  const ageNowDays = who.birthDate ? daysBetween(who.birthDate, today) : undefined;
  const whoPts = who.sex && who.birthDate ? whoPoints(series, who.birthDate, who.sex) : [];
  const whoLast = whoPts.at(-1);
  const trend = zTrend(whoPts);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(kg.replace(",", "."));
    if (!(value >= 1 && value <= 40)) { setError("Nhập cân nặng từ 1 đến 40 kg."); return; }
    if (!date || date > today) { setError("Ngày cân không được ở tương lai."); return; }
    setBusy(true); setError("");
    try { await onAdd(date, Math.round(value * 10) / 10); setKg(""); setDate(today); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } finally { setBusy(false); }
  }

  let chart = null;
  if (view === "size" && series.length) {
    const first = series[0].date;
    const projectionEnd = outlook?.onDate && outlook.nextSize ? outlook.onDate : undefined;
    const endDate = [last!.date, today, projectionEnd].filter((value): value is string => Boolean(value)).sort().at(-1)!;
    const startDate = series.length === 1 ? shift(first, -30) : first;
    const span = Math.max(1, daysBetween(startDate, endDate));
    const kgs = series.map((point) => point.kg);
    const target = projectionEnd ? SIZE_BANDS.find((band) => band.size === outlook!.nextSize)!.min : undefined;
    let low = Math.floor(Math.min(...kgs) - 0.5), high = Math.ceil(Math.max(...kgs, target ?? 0) + 0.5);
    if (high - low < 3) { low = Math.max(0, low - 1); high = low + 3; }
    const x = (iso: string) => L + (daysBetween(startDate, iso) / span) * (W - L - R);
    const y = (value: number) => T + (1 - (value - low) / (high - low)) * (H - T - B);
    const line = series.map((point, index) => `${index ? "L" : "M"}${x(point.date).toFixed(1)},${y(point.kg).toFixed(1)}`).join(" ");
    const area = series.length > 1 ? `${line} L${x(last!.date).toFixed(1)},${H - B} L${x(series[0].date).toFixed(1)},${H - B} Z` : "";
    const step = high - low > 8 ? 2 : 1;
    const yTicks = Array.from({ length: Math.floor((high - low) / step) + 1 }, (_, index) => low + index * step);
    // Month ticks too close to either end would overlap the end labels.
    const xTicks = [...new Set([startDate, ...monthStarts(startDate, endDate, W < 420 ? 2 : 4).filter((iso) => Math.min(daysBetween(startDate, iso), daysBetween(iso, endDate)) >= span * 0.12), endDate])];
    const shown = active !== null ? series[active] : undefined;
    chart = <svg className="fam-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Biểu đồ cân nặng của ${name}: ${series.map((point) => `${shortDate(point.date)} ${kgText(point.kg)}`).join(", ")}`}>
      <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color.dot} stopOpacity=".32" /><stop offset="1" stopColor={color.dot} stopOpacity="0" /></linearGradient></defs>
      {SIZE_BANDS.filter((band) => band.max > low && band.min < high).map((band, index) => {
        const top = y(Math.min(band.max, high)), bottom = y(Math.max(band.min, low));
        const current = last && bandFor(last.kg).size === band.size;
        return <g key={band.size}><rect x={L} y={top} width={W - L - R} height={bottom - top} fill={current ? color.dot : "#5b4bb7"} opacity={current ? 0.1 : index % 2 ? 0.03 : 0.06} />
          <text x={W - R + 6} y={(top + bottom) / 2 + 4} className={`fam-chart-band${current ? " on" : ""}`} fill={current ? color.ink : undefined}>{band.size}</text></g>;
      })}
      {yTicks.map((value) => <g key={value}><line x1={L} x2={W - R} y1={y(value)} y2={y(value)} className="fam-chart-grid" /><text x={L - 8} y={y(value) + 4} className="fam-chart-axis" textAnchor="end">{value}</text></g>)}
      {xTicks.map((iso) => <text key={iso} x={x(iso)} y={H - 8} className="fam-chart-axis" textAnchor={iso === startDate ? "start" : iso === endDate ? "end" : "middle"}>{shortDate(iso).slice(0, 5)}</text>)}
      {today >= startDate && today <= endDate && <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} className="fam-chart-today" />}
      {area && <path d={area} fill={`url(#${gradientId})`} />}
      {projectionEnd && target !== undefined && <g className="fam-chart-proj"><path d={`M${x(last!.date)},${y(last!.kg)} L${x(projectionEnd)},${y(target)}`} stroke={color.dot} /><circle cx={x(projectionEnd)} cy={y(target)} r="5" fill="#fff" stroke={color.dot} /><text x={x(projectionEnd) - 8} y={y(target) - 10} textAnchor="end" fill={color.ink}>~{outlook!.nextSize} {shortDate(projectionEnd, today).slice(0, 5)}</text></g>}
      <path d={line} fill="none" stroke={color.dot} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((point, index) => <circle key={point.date} cx={x(point.date)} cy={y(point.kg)} r={active === index ? 8 : 5.5} fill="#fff" stroke={color.dot} strokeWidth="3" tabIndex={0} className="fam-chart-pt"
        onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} onClick={() => setActive(index)}><title>{`${shortDate(point.date)}: ${kgText(point.kg)}`}</title></circle>)}
      {shown && <g className="fam-chart-tip" transform={`translate(${Math.min(W - R - 60, Math.max(L + 60, x(shown.date)))},${Math.max(T + 22, y(shown.kg) - 18)})`}><rect x="-58" y="-20" width="116" height="26" rx="13" /><text textAnchor="middle" y="-2">{`${shortDate(shown.date, today)} · ${kgText(shown.kg)}`}</text></g>}
    </svg>;
  }

  const rows = [...series].reverse();
  return <div className="fam-weight" ref={box}>
    {who.showSize && <div className="fam-seg fam-chart-mode" role="tablist" aria-label="Kiểu biểu đồ">
      <button type="button" role="tab" aria-selected={view === "size"} className={view === "size" ? "on" : ""} onClick={() => setMode("size")}>🧷 Theo size bỉm</button>
      <button type="button" role="tab" aria-selected={view === "who"} className={view === "who" ? "on" : ""} onClick={() => setMode("who")}>📈 Chuẩn WHO</button>
    </div>}
    {view === "size" && (chart ?? <p className="fam-hint">Chưa có lần cân nào. Ghi cân nặng để thấy {name} lớn lên từng tháng và biết lúc nào cần đổi size bỉm.</p>)}
    {view === "who" && (!who.birthDate ? <div className="fam-who-ask"><b>Cần ngày sinh của {name}</b><span>Đường chuẩn WHO tính theo tuổi chính xác của bé.</span><button type="button" className="app-btn" onClick={who.onAddBirth}>Thêm ngày sinh</button></div>
      : !who.sex ? <div className="fam-who-ask"><b>{name} là bé trai hay bé gái?</b><span>WHO có đường chuẩn riêng cho trai và gái. Chỉ dùng cho biểu đồ này.</span><div className="fam-who-sex"><button type="button" className="app-btn ghost" onClick={() => who.onSex("male")}>👦 Bé trai</button><button type="button" className="app-btn ghost" onClick={() => who.onSex("female")}>👧 Bé gái</button></div></div>
      : ageNowDays !== undefined && ageNowDays > WHO_MAX_DAYS ? <p className="fam-hint">WHO chỉ có chuẩn cân nặng theo tuổi đến 10 tuổi. Với trẻ lớn hơn, bác sĩ dùng chỉ số BMI theo tuổi.</p>
      : <WhoChart points={whoPts} sex={who.sex} ageNowDays={ageNowDays ?? 0} width={W} color={color} today={today} name={name} />)}
    {view === "who" && whoLast && <div className="fam-weight-stats">
      <span><small>Bách phân vị</small><b>P{whoLast.percentile}</b><em>nặng hơn ~{whoLast.percentile}% bé cùng tuổi</em></span>
      <span><small>Z-score</small><b>{whoLast.z >= 0 ? "+" : "−"}{Math.abs(Math.round(whoLast.z * 100) / 100).toLocaleString("vi-VN")}</b><em>{kgText(whoLast.kg)} · {shortDate(whoLast.date, today)}</em></span>
      <span><small>Xu hướng</small><b>{!trend ? "—" : trend.kind === "steady" ? "Ổn định" : trend.kind === "up" ? "Đi lên" : "Đi xuống"}</b><em>{!trend ? "cần 2 lần cân cách ≥ 4 tuần" : `${trend.delta >= 0 ? "+" : "−"}${Math.abs(trend.delta).toLocaleString("vi-VN")} SD so với lần trước`}</em></span>
    </div>}
    {view === "who" && whoLast && (() => { const band = BAND_TEXT[bandOf(whoLast.z)]; const warn = Boolean(band.advice) || Boolean(trend?.crossing && trend.kind === "down"); return <div className={`fam-who-read${warn ? " warn" : ""}`}><b>{band.label}</b>{band.advice && <span>{band.advice}</span>}{trend?.crossing && <span>{trend.kind === "down" ? `${name} vừa tụt qua hơn một vạch bách phân vị — nên cân lại sau 2–4 tuần, hỏi bác sĩ nếu vẫn giảm.` : `${name} vừa tăng vượt hơn một vạch bách phân vị.`}</span>}</div>; })()}
    {view === "size" && last && <div className="fam-weight-stats">
      <span><small>Gần nhất</small><b>{kgText(last.kg)}</b><em>{shortDate(last.date, today)}</em></span>
      <span><small>Nhịp tăng</small><b>{pace === null ? "—" : `${pace >= 0 ? "+" : "−"}${Math.abs(Math.round(pace * 100) / 100).toLocaleString("vi-VN")} kg`}</b><em>{pace === null ? "cần ≥ 2 lần cân cách 2 tuần" : "mỗi tháng"}</em></span>
      {outlook && <span><small>Size theo cân</small><b>{outlook.size}</b><em>{outlook.nextSize ? outlook.onDate ? `lên ${outlook.nextSize} ~${shortDate(outlook.onDate, today)}` : `còn ${kgText(outlook.kgToGo!)} lên ${outlook.nextSize}` : "size lớn nhất"}</em></span>}
    </div>}
    <form className="fam-weight-add" onSubmit={(event) => void add(event)}>
      <label><span>Ngày cân</span><input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} /></label>
      <label><span>Cân nặng (kg)</span><input inputMode="decimal" value={kg} placeholder={last ? String(last.kg).replace(".", ",") : "vd 9,5"} onChange={(event) => setKg(event.target.value)} /></label>
      <button className="app-btn" type="submit" disabled={busy || !kg}>{busy ? "Đang lưu…" : "Ghi cân nặng"}</button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {rows.length > 0 && <details className="fam-weight-log" open={all} onToggle={(event) => setAll((event.target as HTMLDetailsElement).open)}><summary>Các lần cân ({rows.length})</summary>
      <ul>{rows.map((point, index) => { const before = rows[index + 1]; const diff = before ? Math.round((point.kg - before.kg) * 10) / 10 : undefined; return <li key={point.date}><span>{shortDate(point.date)}</span><b>{kgText(point.kg)}</b><em className={diff !== undefined && diff < 0 ? "down" : undefined}>{diff === undefined ? "" : `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("vi-VN")}`}</em>{point.id ? <button type="button" className="ledger-link danger" onClick={() => void onDelete(point).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa xóa được."))}>Xóa</button> : <small>từ hồ sơ</small>}</li>; })}</ul>
    </details>}
    <p className="fam-hint">{view === "size" ? "Vùng màu là khoảng cân của từng size bỉm FamAgent dùng khi gợi ý — xem “Chuẩn WHO” để so với trẻ cùng tuổi." : "Theo Chuẩn tăng trưởng trẻ em WHO 2006 (0–5 tuổi) và Tham chiếu WHO 2007 (5–10 tuổi). Vùng xanh là −2 đến +2 SD. Chỉ là cân nặng theo tuổi, không thay khám nhi — bác sĩ còn xem chiều cao và sức khỏe chung."}</p>
  </div>;
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
