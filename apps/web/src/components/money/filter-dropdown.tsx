"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  label: ReactNode;
  active?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** "center" for wide panels (the date range) so they stay on screen. */
  align?: "start" | "center";
  className?: string;
}

/** A filter button with a popover panel: closes on outside click and on Escape. */
export function FilterDropdown({ label, active, open, onOpenChange, children, align = "start", className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) onOpenChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open, onOpenChange]);
  return <div ref={box} className={`dd${open ? " open" : ""}${className ? ` ${className}` : ""}`}>
    <button type="button" className={`dd-btn${active ? " on" : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => onOpenChange(!open)}>{label}</button>
    {open && <div className={`dd-pop${align === "center" ? " center" : ""}`} role="dialog">{children}</div>}
  </div>;
}
