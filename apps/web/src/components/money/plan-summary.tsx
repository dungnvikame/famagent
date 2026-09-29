"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { vndCompact } from "@/lib/money/format-vnd";
import { groupAmountTyping, parseVnd } from "@/lib/money/parse";
import { planFigures, stepSaving } from "@/lib/money/plan-model";
import type { MoneyBundle, MoneySettings } from "@/lib/money/types";
import { AmountInput } from "./amount-input";

interface Props {
  bundle: MoneyBundle; month: string;
  onSettings: (settings: MoneySettings) => Promise<void>;
  onSeeItems: () => void;
}

/** No fixed income yet: ask for one, and keep the old way (type the monthly plan) so nothing is lost. */
function NoIncome({ settings, onSettings, monthNo, onSeeItems }: { settings: MoneySettings; onSettings: Props["onSettings"]; monthNo: number; onSeeItems: () => void }) {
  const [plan, setPlan] = useState(settings.monthlyPlan ? groupAmountTyping(String(settings.monthlyPlan)) : "");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    const monthlyPlan = plan.trim() ? parseVnd(plan) : undefined;
    if (monthlyPlan === null || (monthlyPlan !== undefined && monthlyPlan <= 0)) { setError("Số tiền không hợp lệ (ví dụ 25tr)."); return; }
    setBusy(true); setError("");
    try { await onSettings({ ...settings, monthlyPlan }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } finally { setBusy(false); }
  }
  return <section className="app-card pl-card" aria-labelledby="pl-plan-h">
    <h3 id="pl-plan-h">Kế hoạch tháng {monthNo}</h3>
    <p className="pl-empty"><b>Thêm khoản thu cố định (Lương…) để app tự tính kế hoạch.</b> Có thu cố định và số tiền tiết kiệm mỗi tháng, app tự tính phần được chi linh hoạt cho bạn.</p>
    <button type="button" className="pl-link" onClick={onSeeItems}>Thêm khoản thu ở “Khoản cố định” ↓</button>
    <form className="pl-fallback" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label htmlFor="pl-plan-typed">Hoặc tự nhập kế hoạch chi mỗi tháng</label>
      <div className="pl-fallback-row">
        <AmountInput id="pl-plan-typed" placeholder="25tr" value={plan} onChange={(event) => setPlan(event.target.value)} />
        <button type="submit" className="app-btn pl-btn" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
      </div>
      <small>App so nhịp chi với con số này. Số dư và khoản nợ nằm ở tab Tình hình và Nợ.</small>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

/**
 * "Kế hoạch tháng N": planned income − monthly fixed items − saving = what is left for day-to-day spending.
 * The family only moves the saving stepper; everything else comes from its fixed items.
 */
export function PlanSummary({ bundle, month, onSettings, onSeeItems }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const monthNo = Number(month.slice(5));
  const fig = planFigures(bundle, month);
  if (fig.income <= 0) return <NoIncome settings={bundle.settings} onSettings={onSettings} monthNo={monthNo} onSeeItems={onSeeItems} />;

  async function step(direction: 1 | -1) {
    setBusy(true); setError("");
    try { await onSettings({ ...bundle.settings, monthlySaving: stepSaving(fig.saving, direction, fig.income) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }
  const short = fig.flexRaw < 0;
  const notes = [`${fig.savingPct}% thu`, ...(fig.savingStored ? [] : ["gợi ý 20%: bấm − hoặc ＋ để lưu"]), ...(fig.setAside > 0 ? [`Khoản quý/năm chia đều ≈ ${vndCompact(fig.setAside)}/tháng: nên nằm trong tiết kiệm`] : [])];
  const share = (value: number) => ({ width: `${value}%` });

  return <section className="app-card pl-card" aria-labelledby="pl-plan-h">
    <h3 id="pl-plan-h">Kế hoạch tháng {monthNo} <small>tự tính, bạn chỉ chỉnh <b>tiết kiệm</b></small></h3>
    <p className="pl-hint">Thu lấy từ khoản cố định{fig.incomeFrom ? ` “${fig.incomeFrom}”` : ""}; chi cố định lấy từ danh sách bên dưới. Phần còn lại là số bạn được chi linh hoạt.</p>
    <div className="pl-wf">
      <div className="pl-line"><span className="pl-sign" aria-hidden="true">＋</span><div className="pl-l"><b>Thu dự kiến</b><small>{fig.incomeFrom ? `↻ ${fig.incomeFrom} · ` : ""}thêm khoản thu khác ở “Khoản cố định”</small></div><span className="pl-v">{vnd(fig.income)}</span></div>
      <div className="pl-line"><span className="pl-sign" aria-hidden="true">−</span><div className="pl-l"><b>Khoản cố định hằng tháng</b><small>Nhà, điện, nước, trả góp… · <button type="button" className="pl-inline-link" onClick={onSeeItems}>xem danh sách</button></small></div><span className="pl-v">{vnd(fig.fixed)}</span></div>
      <div className="pl-line"><span className="pl-sign" aria-hidden="true">−</span><div className="pl-l"><b id="pl-save-h">Tiết kiệm mỗi tháng</b><small>{notes.join(" · ")}</small></div>
        <div className="pl-stepper" role="group" aria-labelledby="pl-save-h">
          <button type="button" aria-label="Giảm 500 nghìn" disabled={busy || fig.saving <= 0} onClick={() => void step(-1)}>−</button>
          <b aria-live="polite">{vnd(fig.saving)}</b>
          <button type="button" aria-label="Tăng 500 nghìn" disabled={busy || fig.saving >= fig.income} onClick={() => void step(1)}>＋</button>
        </div></div>
      <div className={`pl-line total${short ? " neg" : ""}`}><span className="pl-sign" aria-hidden="true">＝</span><div className="pl-l"><b>Còn cho chi linh hoạt</b>
        <small>{short ? `Thu chưa đủ cho khoản cố định và tiết kiệm, đang thiếu ${vnd(-fig.flexRaw)}. Giảm tiết kiệm hoặc xem lại khoản cố định.` : `≈ ${vndCompact(fig.perDay)} mỗi ngày · ăn uống, con, mua sắm, giải trí…`}</small></div><span className="pl-v">{vnd(fig.flexRaw)}</span></div>
    </div>
    <div className="pl-bar" role="img" aria-label={`Cố định ${vndCompact(fig.fixed)}, linh hoạt ${vndCompact(fig.flex)}, tiết kiệm ${vndCompact(fig.saving)}`}>
      <i className="k-fixed" style={share(fig.bar.fixed)} /><i className="k-flex" style={share(fig.bar.flex)} /><i className="k-save" style={share(fig.bar.saving)} />
    </div>
    <div className="pl-key"><span><i className="k-fixed" />Cố định</span><span><i className="k-flex" />Linh hoạt</span><span><i className="k-save" />Tiết kiệm</span></div>
    {!short && <p className="pl-hint pl-sum">{fig.savingStored
      ? <>Kế hoạch chi tháng = cố định + linh hoạt = <b>{vnd(fig.plan)}</b> — đây là số ở ô “Còn tiêu được”.</>
      : <>Đây mới là gợi ý: ô “Còn tiêu được” chỉ theo kế hoạch này khi bạn lưu mức tiết kiệm (bấm − hoặc ＋).</>}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
