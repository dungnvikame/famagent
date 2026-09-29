"use client";

import Link from "next/link";
import { useState } from "react";
import type { FamilyNote } from "@/lib/ai/notes";
import { confirmNote, deleteNote } from "@/lib/notes/client";

const KINDS: Record<FamilyNote["kind"], { icon: string; label: string; use: string }> = {
  health: { icon: "🩺", label: "Sức khỏe", use: "tránh sản phẩm, lưu ý khi gợi ý" },
  habit: { icon: "⏰", label: "Thói quen", use: "ước lượng ngày hết, nhắc việc" },
  preference: { icon: "⭐", label: "Ưu tiên", use: "xếp hạng gợi ý mua sắm" },
  other: { icon: "📝", label: "Khác", use: "Trợ lý hiểu bối cảnh nhà mình" },
};
const day = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

/**
 * "Điều FamAgent nhớ về nhà mình" (ChatGPT-memory style): every note shows where it came from and what it is used
 * for. New ones ("Ghi nhận") wait on top for Đúng / Xóa; deleting forgets for good.
 */
export function FamilyMemory({ notes, childNames, onChanged }: { notes: FamilyNote[] | null; childNames: Map<string, string>; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState<FamilyNote["kind"] | "all">("all");
  const [leaving, setLeaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const run = async (task: () => Promise<void>) => { setError(""); try { await task(); await onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } finally { setLeaving(null); } };
  const forget = (note: FamilyNote) => { setLeaving(note.id); void run(() => deleteNote(note.id)); };

  const pending = (notes ?? []).filter((note) => note.status !== "confirmed");
  const confirmed = (notes ?? []).filter((note) => note.status === "confirmed" && (filter === "all" || note.kind === filter));
  const row = (note: FamilyNote) => <div className={`fam-note${leaving === note.id ? " gone" : ""}`} key={note.id}>
    <span className="fam-note-ico" aria-hidden="true">{KINDS[note.kind].icon}</span>
    <div className="fam-note-body"><b>{note.text}</b><small>{KINDS[note.kind].label}{note.childId && childNames.get(note.childId) ? ` · ${childNames.get(note.childId)}` : ""} · từ hội thoại {day(note.createdAt)} · dùng cho: {note.brand && note.kind === "health" ? `tránh ${note.brand}` : KINDS[note.kind].use}</small></div>
    <span className="fam-note-act">{note.status !== "confirmed" && <button type="button" className="yes" onClick={() => void run(() => confirmNote(note.id))}>Đúng</button>}<button type="button" className="del" onClick={() => forget(note)} aria-label={`Xóa: ${note.text}`}>Xóa</button></span>
  </div>;

  return <section className="app-card fam-memory" id="memory" aria-labelledby="fam-memory-h">
    <div className="fam-memory-top"><span className="fam-brain" aria-hidden="true">🧠</span><div><h2 id="fam-memory-h">Điều FamAgent nhớ về nhà mình</h2><p>Rút ra từ các cuộc trò chuyện. Điều bạn bấm “Đúng” được dùng chắc chắn; xóa là quên hẳn.</p></div></div>
    {notes === null ? <p className="fam-hint" aria-busy="true">Đang tải…</p> : <>
      {pending.length > 0 && <div className="fam-pending"><h3>✋ {pending.length} điều mới — đúng không?</h3>{pending.map(row)}</div>}
      {notes.length > 0 && <div className="fam-filter" role="group" aria-label="Lọc">{([["all", "Tất cả"], ...Object.entries(KINDS).map(([key, kind]) => [key, `${kind.icon} ${kind.label}`])] as Array<[FamilyNote["kind"] | "all", string]>).map(([key, label]) => <button type="button" key={key} className={`fam-chip${filter === key ? " on" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>}
      {confirmed.length ? <div>{confirmed.map(row)}</div> : <p className="fam-hint">{notes.length ? "Chưa có điều nào ở nhóm này." : "Chưa có ghi chú nào. Khi bạn kể “bé bị hăm với hãng X” hay “nhà thường mua trên Shopee”, FamAgent sẽ ghi lại ở đây và dùng cho lần sau."}</p>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="fam-teach"><span>💬 Muốn FamAgent nhớ thêm? Cứ kể với Trợ lý, ví dụ “bé thích ăn chuối”.</span><Link className="app-btn ghost" href="/agent">Mở Trợ lý</Link></div>
  </section>;
}
