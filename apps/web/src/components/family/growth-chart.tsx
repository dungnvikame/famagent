"use client";

import { useEffect, useRef, useState } from "react";
import { daysBetween, growthPerMonth, kgText, shortDate, sizeOutlook, type WeightPoint } from "@/lib/family/child-stats";
import { BAND_TEXT, BODY_TEXT, HEIGHT_TEXT, RANGE, bandOf, bodyStatus, whoPoints, zTrend, type Sex, type WhoPoint } from "@/lib/family/who-growth";
import { SizeChart } from "./size-chart";
import { WhoChart, measureText } from "./who-chart";

/** What the WHO views need; without sex or birth date they ask for them in place of the chart. */
export interface WhoOptions { sex?: Sex; birthDate?: string; showSize: boolean; onSex: (sex: Sex) => void; onAddBirth: () => void }
export interface HeightPoint { date: string; cm: number; id?: string }
type View = "size" | "wfa" | "hfa";

const signed = (value: number, digits = 2) => `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString("vi-VN")}`;

/**
 * Growth of one child, three views: weight on diaper-size bands (pace + next-size projection), weight-for-age and
 * length/height-for-age on the WHO curves (percentile, z, trend), plus weight-for-height / BMI when both were
 * measured within a month. One form records weight, height or both for a day; each value can be removed.
 */
export function GrowthChart({ weights, heights, today, color, name, who, onAdd, onDelete }: {
  weights: WeightPoint[]; heights: HeightPoint[]; today: string; color: { dot: string; ink: string }; name: string; who: WhoOptions;
  onAdd: (date: string, values: { kg?: number; cm?: number }) => Promise<void>; onDelete: (id: string, field: "kg" | "cm") => Promise<void>;
}) {
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
  const [mode, setMode] = useState<View>(who.showSize ? "size" : "wfa");
  const view: View = !who.showSize && mode === "size" ? "wfa" : mode;
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [cm, setCm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pace = growthPerMonth(weights);
  const outlook = sizeOutlook(weights, pace);
  const lastWeight = weights.at(-1), lastHeight = heights.at(-1);
  const ageNowDays = who.birthDate ? daysBetween(who.birthDate, today) : undefined;
  const ready = Boolean(who.sex && who.birthDate);
  const wfa = ready ? whoPoints(weights.map((point) => ({ date: point.date, value: point.kg })), who.birthDate!, who.sex!, "wfa") : [];
  const hfa = ready ? whoPoints(heights.map((point) => ({ date: point.date, value: point.cm })), who.birthDate!, who.sex!, "hfa") : [];
  const body = ready && lastWeight && lastHeight ? bodyStatus(who.sex!, who.birthDate!, { date: lastWeight.date, value: lastWeight.kg }, { date: lastHeight.date, value: lastHeight.cm }) : null;
  const points = view === "hfa" ? hfa : wfa;
  const lastPoint = points.at(-1);
  const trend = zTrend(points);
  const heightGain = (() => { if (heights.length < 2) return null; const lastH = heights.at(-1)!, prev = [...heights].reverse().find((point) => daysBetween(point.date, lastH.date) >= 28); return prev ? { cm: lastH.cm - prev.cm, days: daysBetween(prev.date, lastH.date) } : null; })();

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const kgValue = kg.trim() ? Number(kg.replace(",", ".")) : undefined;
    const cmValue = cm.trim() ? Number(cm.replace(",", ".")) : undefined;
    if (kgValue === undefined && cmValue === undefined) { setError("Nhập cân nặng, chiều cao hoặc cả hai."); return; }
    if (kgValue !== undefined && !(kgValue >= 1 && kgValue <= 40)) { setError("Cân nặng từ 1 đến 40 kg."); return; }
    if (cmValue !== undefined && !(cmValue >= 35 && cmValue <= 200)) { setError("Chiều cao từ 35 đến 200 cm."); return; }
    if (!date || date > today) { setError("Ngày đo không được ở tương lai."); return; }
    setBusy(true); setError("");
    try {
      await onAdd(date, { ...(kgValue !== undefined && { kg: Math.round(kgValue * 10) / 10 }), ...(cmValue !== undefined && { cm: Math.round(cmValue * 10) / 10 }) });
      setKg(""); setCm(""); setDate(today);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } finally { setBusy(false); }
  }
  const remove = (id: string, field: "kg" | "cm") => void onDelete(id, field).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa xóa được."));

  // One row per day in the log, weight and height side by side.
  const days = new Map<string, { kg?: WeightPoint; cm?: HeightPoint }>();
  for (const point of weights) days.set(point.date, { ...days.get(point.date), kg: point });
  for (const point of heights) days.set(point.date, { ...days.get(point.date), cm: point });
  const log = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const whoBody = !who.birthDate ? <div className="fam-who-ask"><b>Cần ngày sinh của {name}</b><span>Đường chuẩn WHO tính theo tuổi chính xác của bé.</span><button type="button" className="app-btn" onClick={who.onAddBirth}>Thêm ngày sinh</button></div>
    : !who.sex ? <div className="fam-who-ask"><b>{name} là bé trai hay bé gái?</b><span>WHO có đường chuẩn riêng cho trai và gái. Chỉ dùng cho biểu đồ này.</span><div className="fam-who-sex"><button type="button" className="app-btn ghost" onClick={() => who.onSex("male")}>👦 Bé trai</button><button type="button" className="app-btn ghost" onClick={() => who.onSex("female")}>👧 Bé gái</button></div></div>
    : ageNowDays !== undefined && ageNowDays > RANGE[view === "hfa" ? "hfa" : "wfa"][1] ? <p className="fam-hint">{view === "hfa" ? "WHO có chuẩn chiều cao theo tuổi đến 19 tuổi." : "WHO chỉ có chuẩn cân nặng theo tuổi đến 10 tuổi — xem “Chiều cao” và BMI bên dưới."}</p>
    : view === "hfa" && !hfa.length ? <p className="fam-hint">Chưa có lần đo chiều cao nào. Ghi chiều cao của {name} ở ô bên dưới — dưới 2 tuổi đo nằm, từ 2 tuổi đo đứng.</p>
    : <WhoChart points={points} sex={who.sex} indicator={view === "hfa" ? "hfa" : "wfa"} ageNowDays={ageNowDays ?? 0} width={W} color={color} today={today} name={name} />;
  const reading = view === "hfa" ? HEIGHT_TEXT : BAND_TEXT;

  return <div className="fam-weight" ref={box}>
    <div className="fam-seg fam-chart-mode" role="tablist" aria-label="Kiểu biểu đồ">
      {who.showSize && <button type="button" role="tab" aria-selected={view === "size"} className={view === "size" ? "on" : ""} onClick={() => setMode("size")}>🧷 Size bỉm</button>}
      <button type="button" role="tab" aria-selected={view === "wfa"} className={view === "wfa" ? "on" : ""} onClick={() => setMode("wfa")}>⚖️ Cân nặng WHO</button>
      <button type="button" role="tab" aria-selected={view === "hfa"} className={view === "hfa" ? "on" : ""} onClick={() => setMode("hfa")}>📏 Chiều cao WHO</button>
    </div>

    {view === "size" ? (weights.length ? <SizeChart series={weights} today={today} color={color} name={name} width={W} outlook={outlook} /> : <p className="fam-hint">Chưa có lần cân nào. Ghi cân nặng để thấy {name} lớn lên từng tháng và biết lúc nào cần đổi size bỉm.</p>) : whoBody}

    {view === "size" && lastWeight && <div className="fam-weight-stats">
      <span><small>Gần nhất</small><b>{kgText(lastWeight.kg)}</b><em>{shortDate(lastWeight.date, today)}</em></span>
      <span><small>Nhịp tăng</small><b>{pace === null ? "—" : `${signed(pace)} kg`}</b><em>{pace === null ? "cần ≥ 2 lần cân cách 2 tuần" : "mỗi tháng"}</em></span>
      {outlook && <span><small>Size theo cân</small><b>{outlook.size}</b><em>{outlook.nextSize ? outlook.onDate ? `lên ${outlook.nextSize} ~${shortDate(outlook.onDate, today)}` : `còn ${kgText(outlook.kgToGo!)} lên ${outlook.nextSize}` : "size lớn nhất"}</em></span>}
    </div>}

    {view !== "size" && lastPoint && <div className="fam-weight-stats">
      <span><small>Bách phân vị</small><b>P{lastPoint.percentile}</b><em>{view === "hfa" ? "cao" : "nặng"} hơn ~{lastPoint.percentile}% bé cùng tuổi</em></span>
      <span><small>{view === "hfa" ? "Chiều cao" : "Z-score"}</small><b>{view === "hfa" ? measureText(lastPoint.value, "cm") : signed(lastPoint.z)}</b><em>{view === "hfa" ? `z ${signed(lastPoint.z)} · ${shortDate(lastPoint.date, today)}` : `${kgText(lastPoint.value)} · ${shortDate(lastPoint.date, today)}`}</em></span>
      <span><small>{view === "hfa" && heightGain ? "Cao thêm" : "Xu hướng"}</small><b>{view === "hfa" && heightGain ? `${signed(heightGain.cm, 1)} cm` : !trend ? "—" : trend.kind === "steady" ? "Ổn định" : trend.kind === "up" ? "Đi lên" : "Đi xuống"}</b><em>{view === "hfa" && heightGain ? `trong ${heightGain.days} ngày` : !trend ? "cần 2 lần đo cách ≥ 4 tuần" : `${signed(trend.delta)} SD so với lần trước`}</em></span>
    </div>}
    {view !== "size" && lastPoint && <Reading point={lastPoint} trend={trend} name={name} text={reading} what={view === "hfa" ? "chiều cao" : "cân nặng"} />}

    {view !== "size" && ready && <div className={`fam-body${body && BODY_TEXT[body.band].advice && body.band !== "risk_over" ? " warn" : ""}`}>
      <span className="fam-body-ico" aria-hidden="true">⚖️📏</span>
      {body ? <div><small>{body.indicator === "bfa" ? `BMI theo tuổi · BMI ${body.bmi?.toLocaleString("vi-VN")}` : body.indicator === "wfl" ? "Cân nặng theo chiều dài" : "Cân nặng theo chiều cao"} · P{body.percentile}</small><b>{BODY_TEXT[body.band].label}</b>{BODY_TEXT[body.band].advice && <span>{BODY_TEXT[body.band].advice}</span>}</div>
        : <div><small>Cân nặng so với chiều cao</small><b>{lastHeight ? "Cần cân và đo trong cùng một tháng" : `Ghi chiều cao để biết ${name} có cân đối không`}</b><span>Đây là chỉ số WHO dùng để biết bé gầy hay thừa cân — cân nặng theo tuổi thôi chưa đủ.</span></div>}
    </div>}

    <form className="fam-weight-add" onSubmit={(event) => void add(event)}>
      <label><span>Ngày đo</span><input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} /></label>
      <label><span>Cân nặng (kg)</span><input inputMode="decimal" value={kg} placeholder={lastWeight ? String(lastWeight.kg).replace(".", ",") : "vd 9,5"} onChange={(event) => setKg(event.target.value)} /></label>
      <label><span>Chiều cao (cm)</span><input inputMode="decimal" value={cm} placeholder={lastHeight ? String(lastHeight.cm).replace(".", ",") : "vd 76,5"} onChange={(event) => setCm(event.target.value)} /></label>
      <button className="app-btn" type="submit" disabled={busy || (!kg && !cm)}>{busy ? "Đang lưu…" : "Ghi lại"}</button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {log.length > 0 && <details className="fam-weight-log"><summary>Các lần cân đo ({log.length})</summary>
      <ul>{log.map(([day, entry]) => <li key={day}><span>{shortDate(day)}</span>
        <b>{entry.kg ? kgText(entry.kg.kg) : "—"}{entry.kg && (entry.kg.id ? <button type="button" className="fam-x" aria-label={`Xóa cân nặng ${shortDate(day)}`} onClick={() => remove(entry.kg!.id!, "kg")}>×</button> : <small> hồ sơ</small>)}</b>
        <b>{entry.cm ? measureText(entry.cm.cm, "cm") : "—"}{entry.cm?.id && <button type="button" className="fam-x" aria-label={`Xóa chiều cao ${shortDate(day)}`} onClick={() => remove(entry.cm!.id!, "cm")}>×</button>}</b>
      </li>)}</ul>
    </details>}
    <p className="fam-hint">{view === "size" ? "Vùng màu là khoảng cân của từng size bỉm FamAgent dùng khi gợi ý — xem tab WHO để so với trẻ cùng tuổi." : "Theo Chuẩn tăng trưởng trẻ em WHO 2006 (0–5 tuổi) và Tham chiếu WHO 2007 (5–19 tuổi). Vùng xanh là −2 đến +2 SD. Chỉ để tham khảo, không thay khám nhi."}</p>
  </div>;
}

function Reading({ point, trend, name, text, what }: { point: WhoPoint; trend: ReturnType<typeof zTrend>; name: string; text: typeof BAND_TEXT; what: string }) {
  const band = text[bandOf(point.z)];
  const falling = Boolean(trend?.crossing && trend.kind === "down");
  return <div className={`fam-who-read${band.advice && bandOf(point.z) !== "very_high" || falling ? " warn" : ""}`}><b>{band.label}</b>{band.advice && <span>{band.advice}</span>}
    {trend?.crossing && <span>{falling ? `${what === "chiều cao" ? "Chiều cao" : "Cân nặng"} của ${name} vừa tụt qua hơn một vạch bách phân vị — nên đo lại sau 2–4 tuần, hỏi bác sĩ nếu vẫn giảm.` : `${name} vừa tăng vượt hơn một vạch bách phân vị.`}</span>}</div>;
}
