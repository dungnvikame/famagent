"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Right-hand drawer on desktop, bottom sheet on phones. Esc / backdrop close it; focus moves in once when it opens
 * and comes back when it closes. The effect depends on `open` only — `onClose` is read through a ref, because the
 * page re-renders on every keystroke (autosave) and re-running it would pull focus out of the field being typed in.
 */
export function SideSheet({ open, title, status, onClose, children }: { open: boolean; title: string; status?: ReactNode; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("input,select,button:not(.fam-sheet-close)")?.focus(), 60);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("fam-sheet-open");
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKey); document.body.classList.remove("fam-sheet-open"); back?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return <>
    <div className="fam-scrim" onClick={() => close.current()} aria-hidden="true" />
    <aside className="fam-sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
      <div className="fam-sheet-head"><h2>{title}</h2><span className="fam-sheet-status" role="status">{status}</span><button type="button" className="fam-sheet-close" onClick={() => close.current()} aria-label="Đóng">✕</button></div>
      <div className="fam-sheet-body">{children}</div>
    </aside>
  </>;
}
