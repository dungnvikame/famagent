"use client";

// Tab Tổng quan: readiness, the one next action, documents (the packing checklist's "documents" rows),
// booking links, trip members and the per-trip reminder switch.
import { useState } from "react";
import { vndCompact } from "@/lib/money/format-vnd";
import type { TripMember } from "@/lib/travel/trip-members";
import { nextAction, type TripReadiness } from "@/lib/travel/trip-state";
import type { PackingItem, Trip, TripLink } from "@/lib/travel/types";
import type { TripTab } from "./trip-workspace";

export function TripOverview({ trip, readiness, countdown, packing, members, onTrip, onPacking, onTab }: {
  trip: Trip; readiness: TripReadiness; countdown: number; packing: PackingItem[]; members: TripMember[];
  onTrip: (trip: Trip) => void; onPacking: (item: PackingItem) => void; onTab: (tab: TripTab) => void;
}) {
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const action = nextAction(readiness, countdown);
  const documents = packing.filter((item) => item.category === "documents");
  const links = trip.links ?? [];
  const selected = new Set(trip.memberIds ?? []);

  function addLink() {
    const url = linkUrl.trim();
    if (!linkLabel.trim() || !/^https?:\/\//i.test(url)) return;
    onTrip({ ...trip, links: [...links, { label: linkLabel.trim().slice(0, 60), url: url.slice(0, 500) }].slice(0, 10) });
    setLinkLabel(""); setLinkUrl(""); setAddingLink(false);
  }
  const removeLink = (link: TripLink) => onTrip({ ...trip, links: links.filter((entry) => entry !== link) });
  function toggleMember(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    // Everyone picked = back to the "whole family" default (empty list).
    onTrip({ ...trip, memberIds: next.size === 0 || next.size === members.length ? [] : [...next] });
  }

  return <section className="tv-card tv-panel">
    <div className="tv-ov-grid">
      <div className="tv-box">
        <h4>Mức độ sẵn sàng</h4>
        <div className="tv-prog"><small>Lịch trình</small><div className="tv-bar"><i style={{ width: `${readiness.daysTotal ? Math.round((readiness.daysPlanned / readiness.daysTotal) * 100) : 0}%` }} /></div><b>{readiness.daysPlanned}/{readiness.daysTotal} ngày</b></div>
        <div className="tv-prog"><small>Đồ đạc</small><div className="tv-bar"><i style={{ width: `${readiness.packTotal ? Math.round((readiness.packed / readiness.packTotal) * 100) : 0}%` }} /></div><b>{readiness.packed}/{readiness.packTotal}</b></div>
        {trip.budgetAmount > 0 && <div className="tv-prog"><small>Ngân sách</small><div className="tv-bar"><i style={{ width: `${readiness.budgetPct}%` }} /></div><b>{readiness.budgetPct}%</b></div>}
        <button type="button" className="tv-pill tv-pill-warn tv-action" onClick={() => onTab(action.tab)}>Việc tiếp theo: {action.label}</button>
      </div>

      <div className="tv-box">
        <h4>Giấy tờ cần nhớ <small className="tv-muted">· từ checklist Đồ đạc</small></h4>
        {documents.length === 0 && <p className="tv-muted tv-small">Chưa có mục giấy tờ — bấm &quot;Gợi ý theo nhà mình&quot; trong tab Đồ đạc.</p>}
        <ul className="tv-doc-list">
          {documents.map((item) => <li key={item.id}>
            <button type="button" className={`tv-tick ${item.status === "packed" ? "on" : ""}`} aria-pressed={item.status === "packed"} aria-label={`${item.name}: ${item.status === "packed" ? "đã chuẩn bị" : "chưa chuẩn bị"}`} onClick={() => onPacking({ ...item, status: item.status === "packed" ? "todo" : "packed" })}>{item.status === "packed" ? "✓" : ""}</button>
            <span>{item.name}</span>
          </li>)}
        </ul>
      </div>

      <div className="tv-box">
        <h4>Link đặt chỗ</h4>
        <div className="tv-links">
          {links.map((link) => <span key={link.url} className="tv-link-chip">
            <a href={link.url} target="_blank" rel="noopener noreferrer">🔗 {link.label}</a>
            <button type="button" onClick={() => removeLink(link)} aria-label={`Xoá link ${link.label}`}>✕</button>
          </span>)}
          {!addingLink && links.length < 10 && <button type="button" className="tv-link-add" onClick={() => setAddingLink(true)}>＋ Thêm link</button>}
        </div>
        {addingLink && <div className="tv-link-form">
          <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Vé máy bay · mã GX8K2L" maxLength={60} />
          <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" inputMode="url" />
          <button type="button" className="tv-btn tv-btn-primary tv-btn-sm" onClick={addLink}>Lưu</button>
          <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={() => setAddingLink(false)}>Thôi</button>
        </div>}
        <p className="tv-hint">Chỉ lưu link + ghi chú để mở nhanh — không tích hợp đặt chỗ.</p>
      </div>

      <div className="tv-box">
        <h4>Ai đi chuyến này</h4>
        {members.length === 0 && <p className="tv-muted tv-small">Cả nhà. Thêm thành viên trong trang Gia đình để chọn riêng.</p>}
        <div className="tv-chips">
          {members.map((member) => { const on = selected.size === 0 || selected.has(member.id); return <button key={member.id} type="button" className={on ? "on" : undefined} aria-pressed={on} onClick={() => toggleMember(member.id)}>{member.label}</button>; })}
        </div>
        <h4 className="tv-gap">Nhắc chuẩn bị</h4>
        <button type="button" className={`tv-switch ${trip.pushEnabled ? "on" : ""}`} aria-pressed={trip.pushEnabled} onClick={() => onTrip({ ...trip, pushEnabled: !trip.pushEnabled })}><i aria-hidden="true" />Bật nhắc cho chuyến này</button>
        <p className="tv-hint">T-7: bắt đầu chuẩn bị đồ · T-2: món chưa xếp + giấy tờ · hôm về: ghi nốt chi phí{trip.budgetAmount ? ` (ngân sách ${vndCompact(trip.budgetAmount)})` : ""}. Gửi qua thông báo đẩy của app.</p>
      </div>
    </div>
  </section>;
}
