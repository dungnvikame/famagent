"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Right-hand drawer on desktop, bottom sheet on phones. Esc / backdrop close it; focus moves in and comes back. */
export function SideSheet({ open, title, status, onClose, children }: { open: boolean; title: string; status?: ReactNode; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("input,select,button:not(.fam-sheet-close)")?.focus(), 60);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("fam-sheet-open");
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKey); document.body.classList.remove("fam-sheet-open"); back?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return <>
    <div className="fam-scrim" onClick={onClose} aria-hidden="true" />
    <aside className="fam-sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
      <div className="fam-sheet-head"><h2>{title}</h2><span className="fam-sheet-status" role="status">{status}</span><button type="button" className="fam-sheet-close" onClick={onClose} aria-label="Đóng">✕</button></div>
      <div className="fam-sheet-body">{children}</div>
    </aside>
  </>;
}
