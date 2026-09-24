"use client";

import { useEffect, useState } from "react";
import type { FamilyNote } from "@/lib/ai/notes";
import { confirmNote, deleteNote, loadNotes } from "@/lib/notes/client";

const KIND_LABELS: Record<FamilyNote["kind"], string> = { health: "Sức khỏe", habit: "Thói quen", preference: "Ưu tiên", other: "Khác" };
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

/** "Điều FamAgent đã ghi nhớ": notes pulled from conversations; each can be confirmed or removed (SPEC_V2 §31–32). */
export function FamilyNotes() {
  const [notes, setNotes] = useState<FamilyNote[] | null>(null);
  const [error, setError] = useState("");
  const reload = () => loadNotes().then(setNotes).catch((cause: unknown) => { setError(cause instanceof Error ? cause.message : "Không thể tải ghi chú."); setNotes([]); });
  useEffect(() => { void reload(); }, []);
  const run = (task: () => Promise<void>) => task().then(reload).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa lưu được."));

  if (notes === null) return <p className="app-sub" aria-busy="true">Đang tải…</p>;
  if (!notes.length) return <p className="memory-empty">Chưa có ghi chú nào. Khi bạn kể “bé bị hăm với hãng X” hay “nhà thường mua trên Shopee”, FamAgent sẽ ghi lại ở đây và dùng cho lần sau.</p>;
  return <div className="notes-list">
    {notes.map((note) => <div className="note-row" key={note.id}>
      <span className="note-dot" aria-hidden="true" />
      <div className="note-body"><span>{note.text} <span className={`app-pill${note.status === "confirmed" ? " ok" : ""}`}>{note.status === "confirmed" ? "Bạn xác nhận" : "Ghi nhận"}</span></span><small>{KIND_LABELS[note.kind]} · từ hội thoại {dayLabel(note.createdAt)}{note.kind === "health" && note.brand ? ` · FamAgent sẽ tránh ${note.brand}` : ""}</small></div>
      <span className="row-actions">{note.status !== "confirmed" && <button type="button" className="ledger-link" onClick={() => void run(() => confirmNote(note.id))}>Đúng</button>}<button type="button" className="ledger-link danger" onClick={() => void run(() => deleteNote(note.id))}>Xóa</button></span>
    </div>)}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
