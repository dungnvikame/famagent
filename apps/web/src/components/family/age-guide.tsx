"use client";

import { useState } from "react";
import { dayIndex } from "@/lib/brief/daily-tasks";
import { GUIDE_STAGES, TOPIC_LABELS, stageFor, type GuideTip, type GuideTopic } from "@/lib/family/age-guide-data";
import type { MilestoneRecord } from "@/lib/family/milestones";

/**
 * "Cẩm nang theo tuổi": what to do for the child at this age, by topic (feeding, sleep, play, feelings, safety,
 * health), a tip of the day among those not tried yet, "Đã thử" ticks shared by the family, what to prepare for the
 * next stage, and browsing other stages. Content: CDC tips + WHO/UNICEF feeding + AAP safe sleep / oral health.
 */
export function AgeGuide({ name, ageMonths, records, onTried }: { name: string; ageMonths: number; records: MilestoneRecord[]; onTried: (tipId: string, tried: boolean) => Promise<void> }) {
  const own = stageFor(ageMonths);
  const [key, setKey] = useState(own?.key ?? GUIDE_STAGES[0].key);
  const [topic, setTopic] = useState<GuideTopic | "all">("all");
  const [error, setError] = useState("");
  const index = Math.max(0, GUIDE_STAGES.findIndex((item) => item.key === key));
  const stage = GUIDE_STAGES[index];
  const next = GUIDE_STAGES[index + 1];
  const tried = new Set(records.filter((record) => record.status === "done").map((record) => record.milestoneId));
  const done = stage.tips.filter((tip) => tried.has(tip.id)).length;
  const fresh = stage.tips.filter((tip) => !tried.has(tip.id));
  const today = own && own.key === stage.key && fresh.length ? fresh[dayIndex(new Date()) % fresh.length] : undefined;
  const topics = (Object.keys(TOPIC_LABELS) as GuideTopic[]).filter((item) => stage.tips.some((tip) => tip.topic === item));
  const shown = stage.tips.filter((tip) => topic === "all" || tip.topic === topic);

  async function toggle(tip: GuideTip) {
    setError("");
    try { await onTried(tip.id, !tried.has(tip.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }
  const go = (delta: number) => { const target = GUIDE_STAGES[index + delta]; if (target) { setKey(target.key); setTopic("all"); } };

  return <div className="fam-guide">
    <div className="fam-guide-nav">
      <button type="button" className="fam-guide-arrow" onClick={() => go(-1)} disabled={index === 0} aria-label="Giai đoạn trước">‹</button>
      <div><b>{stage.label}</b><small>{own?.key === stage.key ? `Giai đoạn của ${name} bây giờ` : own && stage.from > own.from ? "Giai đoạn sắp tới" : "Giai đoạn đã qua"} · đã thử {done}/{stage.tips.length}</small></div>
      <button type="button" className="fam-guide-arrow" onClick={() => go(1)} disabled={!next} aria-label="Giai đoạn sau">›</button>
      {own && own.key !== stage.key && <button type="button" className="link-btn" onClick={() => { setKey(own.key); setTopic("all"); }}>Về tuổi hiện tại</button>}
    </div>
    <span className="fam-ms-bar fam-guide-bar" aria-hidden="true"><i style={{ width: `${Math.round(done / stage.tips.length * 100)}%` }} /></span>

    {today && <div className="fam-guide-today"><span className="fam-guide-badge">Mẹo hôm nay</span><p>{TOPIC_LABELS[today.topic].icon} {today.text}</p>
      <button type="button" className="app-btn" onClick={() => void toggle(today)}>✓ Đã thử</button></div>}
    {own?.key === stage.key && !fresh.length && <p className="fam-guide-all">🎉 Bạn đã thử hết gợi ý của giai đoạn này — xem trước giai đoạn tới nhé.</p>}

    <div className="fam-filter" role="group" aria-label="Chủ đề">
      <button type="button" className={`fam-chip${topic === "all" ? " on" : ""}`} aria-pressed={topic === "all"} onClick={() => setTopic("all")}>Tất cả</button>
      {topics.map((item) => <button type="button" key={item} className={`fam-chip${topic === item ? " on" : ""}`} aria-pressed={topic === item} onClick={() => setTopic(item)}>{TOPIC_LABELS[item].icon} {TOPIC_LABELS[item].label}</button>)}
    </div>
    <ul className="fam-guide-list">{shown.map((tip) => <li key={tip.id} className={tried.has(tip.id) ? "done" : ""}>
      <span className="fam-guide-ico" aria-hidden="true" title={TOPIC_LABELS[tip.topic].label}>{TOPIC_LABELS[tip.topic].icon}</span>
      <div><span>{tip.text}</span><small>{TOPIC_LABELS[tip.topic].label} · {tip.source}</small></div>
      <button type="button" className={`fam-guide-tick${tried.has(tip.id) ? " on" : ""}`} aria-pressed={tried.has(tip.id)} onClick={() => void toggle(tip)}>{tried.has(tip.id) ? "✓ Đã thử" : "Thử"}</button>
    </li>)}</ul>
    {error && <p className="form-error" role="alert">{error}</p>}

    {stage.prepare.length > 0 && <div className="fam-guide-prep"><b>🧭 Chuẩn bị cho {next ? `giai đoạn ${next.label}` : "chặng tiếp theo"}</b><ul>{stage.prepare.map((line) => <li key={line}>{line}</li>)}</ul></div>}
    <p className="fam-hint">Tổng hợp từ CDC (“Learn the Signs. Act Early.”), WHO/UNICEF về nuôi dưỡng trẻ nhỏ và AAP về giấc ngủ an toàn, răng miệng. Thông tin chung — hỏi bác sĩ nhi cho trường hợp riêng của {name}.</p>
  </div>;
}
