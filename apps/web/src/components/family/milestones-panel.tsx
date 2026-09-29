"use client";

import { useState } from "react";
import { shortDate } from "@/lib/family/child-stats";
import { AREA_LABELS, WHO_MOTOR, type Checkpoint, type MilestoneArea } from "@/lib/family/milestones-data";
import { checkpointsFor, concerns, memories, motorState, progressOf, type MilestoneRecord, type MilestoneStatus } from "@/lib/family/milestones";

type Mark = (milestoneId: string, status: MilestoneStatus | null, on?: string) => Promise<void>;
const AREAS = Object.keys(AREA_LABELS) as MilestoneArea[];
const SCALE_MONTHS = 20;

/**
 * "Cột mốc phát triển": the CDC checklist for the child's age (what most children do by then) to mark "Làm được"
 * (with the day, it goes to the memories) or "Chưa"; the next checkpoint; earlier ones; WHO motor windows; and a
 * gentle "hỏi bác sĩ" only for items the family itself marked "Chưa" on a past checkpoint.
 */
export function MilestonesPanel({ name, ageMonths, ageMonthsExact, birthDate, today, records, onMark }: {
  name: string; ageMonths: number; ageMonthsExact: number; birthDate?: string; today: string; records: MilestoneRecord[]; onMark: Mark;
}) {
  const byId = new Map(records.map((record) => [record.milestoneId, record]));
  const { current, next, past } = checkpointsFor(ageMonths);
  const [area, setArea] = useState<MilestoneArea | "all">("all");
  const [cheer, setCheer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [allMemories, setAllMemories] = useState(false);
  const worries = concerns(ageMonths, byId);
  const list = memories(records, birthDate);

  async function mark(id: string, status: MilestoneStatus | null, on?: string) {
    setError("");
    try {
      await onMark(id, status, status === "done" ? on ?? today : undefined);
      if (status === "done" && !on) { setCheer(id); window.setTimeout(() => setCheer((value) => value === id ? null : value), 2600); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }

  const rows = (checkpoint: Checkpoint, filter: MilestoneArea | "all" = "all") => <ul className="fam-ms-list">
    {checkpoint.items.filter((item) => filter === "all" || item.area === filter).map((item) => {
      const record = byId.get(item.id);
      const window = WHO_MOTOR.find((motor) => motor.id === item.id);
      return <li key={item.id} className={`fam-ms-item ${record?.status ?? ""}${cheer === item.id ? " cheer" : ""}`}>
        <span className="fam-ms-area" aria-hidden="true" title={AREA_LABELS[item.area].label}>{AREA_LABELS[item.area].icon}</span>
        <div className="fam-ms-text"><span>{item.text}</span>
          {window && <small>WHO: đa số trẻ làm được trong khoảng {window.from.toLocaleString("vi-VN")}–{window.to.toLocaleString("vi-VN")} tháng</small>}
          {record?.status === "done" && <label className="fam-ms-date">Từ ngày <input type="date" value={record.on ?? ""} max={today} min={birthDate} onChange={(event) => event.target.value && void mark(item.id, "done", event.target.value)} /></label>}
          {cheer === item.id && <em className="fam-ms-cheer" role="status">🎉 Tuyệt vời! Đã lưu vào kỷ niệm của {name}</em>}
        </div>
        <span className="fam-ms-act" role="group" aria-label={item.text}>
          <button type="button" className={record?.status === "done" ? "on yes" : "yes"} aria-pressed={record?.status === "done"} onClick={() => void mark(item.id, record?.status === "done" ? null : "done")}>✓ Làm được</button>
          <button type="button" className={record?.status === "not_yet" ? "on no" : "no"} aria-pressed={record?.status === "not_yet"} onClick={() => void mark(item.id, record?.status === "not_yet" ? null : "not_yet")}>Chưa</button>
        </span>
      </li>;
    })}
  </ul>;
  const bar = (checkpoint: Checkpoint) => { const progress = progressOf(checkpoint, byId); return <span className="fam-ms-bar" aria-label={`${progress.done}/${progress.total} việc đã làm được`}><i style={{ width: `${Math.round(progress.done / progress.total * 100)}%` }} /><b>{progress.done}/{progress.total}</b></span>; };

  return <div className="fam-ms">
    {current ? <div className="fam-ms-current">
      <div className="fam-ms-head"><div><b>Mốc {current.label}</b><small>Những việc đa số trẻ (≥ 75%) làm được ở tuổi này — đánh dấu khi thấy {name} làm.</small></div>{bar(current)}</div>
      <div className="fam-filter" role="group" aria-label="Lĩnh vực">
        <button type="button" className={`fam-chip${area === "all" ? " on" : ""}`} aria-pressed={area === "all"} onClick={() => setArea("all")}>Tất cả</button>
        {AREAS.filter((key) => current.items.some((item) => item.area === key)).map((key) => <button type="button" key={key} className={`fam-chip${area === key ? " on" : ""}`} aria-pressed={area === key} onClick={() => setArea(key)}>{AREA_LABELS[key].icon} {AREA_LABELS[key].label}</button>)}
      </div>
      {rows(current, area)}
    </div> : <p className="fam-hint">Checklist đầu tiên là mốc 2 tháng — trong lúc chờ, hãy trò chuyện, cười và cho {name} nằm sấp chơi mỗi ngày.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}

    {worries.length > 0 && <div className="fam-ms-worry" role="note"><b>Điều nên kể với bác sĩ nhi</b>
      <span>Bạn đánh dấu “Chưa” với: {worries.map((entry) => `${entry.items.map((item) => item.text.toLocaleLowerCase("vi")).join(", ")} (mốc ${entry.checkpoint.label})`).join("; ")}.</span>
      <span>CDC khuyên: nếu bé chưa làm được việc của mốc tuổi, hãy trao đổi với bác sĩ ở lần khám tới — phát hiện sớm giúp bé nhiều nhất. Mỗi bé có nhịp riêng, một vài việc chậm hơn là chuyện thường gặp.</span></div>}

    {next && <details className="fam-ms-more"><summary>Sắp tới: mốc {next.label} <small>({next.items.length} việc)</small></summary>{rows(next)}</details>}
    {past.length > 0 && <details className="fam-ms-more"><summary>Các mốc trước <small>({past.length})</small></summary>
      {[...past].reverse().map((checkpoint) => <details key={checkpoint.months} className="fam-ms-past"><summary><span>Mốc {checkpoint.label}</span>{bar(checkpoint)}</summary>{rows(checkpoint)}</details>)}
    </details>}

    {ageMonthsExact <= 24 && <div className="fam-ms-motor"><div className="fam-ms-head"><div><b>6 mốc vận động lớn (WHO)</b><small>Vạch màu là khoảng tuổi 98% trẻ khỏe mạnh đạt được; vạch dọc là tuổi của {name}.</small></div></div>
      <ul>{WHO_MOTOR.map((motor) => {
        const record = byId.get(motor.id);
        const state = motorState(motor, ageMonthsExact, record);
        const pct = (months: number) => `${Math.min(100, months / SCALE_MONTHS * 100)}%`;
        return <li key={motor.id} className={`fam-ms-mrow ${state}`}>
          <button type="button" className={`fam-ms-tick${record?.status === "done" ? " on" : ""}`} aria-pressed={record?.status === "done"} aria-label={`${motor.text}: ${record?.status === "done" ? "đã làm được" : "đánh dấu làm được"}`} onClick={() => void mark(motor.id, record?.status === "done" ? null : "done")}>{record?.status === "done" ? "✓" : ""}</button>
          <span className="fam-ms-mlabel">{motor.text}{record?.status === "done" && record.on && <small> · {shortDate(record.on, today)}</small>}</span>
          <span className="fam-ms-track" aria-hidden="true"><i className="win" style={{ left: pct(motor.from), width: `calc(${pct(motor.to)} - ${pct(motor.from)})` }} /><i className="now" style={{ left: pct(ageMonthsExact) }} /></span>
        </li>;
      })}</ul>
      <div className="fam-ms-mrow" aria-hidden="true"><span /><span /><span className="fam-ms-scale"><span>0</span><span>5</span><span>10</span><span>15</span><span>20 th</span></span></div>
    </div>}

    {list.length > 0 && <div className="fam-ms-memories"><div className="fam-ms-head"><div><b>📔 Kỷ niệm của {name}</b><small>Những lần đầu tiên bạn đã ghi lại.</small></div></div>
      <ol>{(allMemories ? list : list.slice(0, 5)).map((memory) => <li key={memory.milestone.id}><span className="dot" aria-hidden="true">{AREA_LABELS[memory.milestone.area].icon}</span><div><b>{memory.milestone.text}</b><small>{shortDate(memory.on)}{memory.ageText ? ` · lúc ${memory.ageText}` : ""}</small></div></li>)}</ol>
      {list.length > 5 && <button type="button" className="link-btn" onClick={() => setAllMemories((value) => !value)}>{allMemories ? "Thu gọn" : `Xem cả ${list.length} kỷ niệm`}</button>}
    </div>}
    <p className="fam-hint">Theo checklist “Learn the Signs. Act Early.” của CDC (2022) và Nghiên cứu vận động WHO (2006). Trẻ sinh non tính theo tuổi hiệu chỉnh. Đây là công cụ theo dõi, không phải chẩn đoán.</p>
  </div>;
}
