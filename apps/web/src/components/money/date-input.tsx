"use client";

import { useEffect, useRef, useState } from "react";
import { formatVnDate, maskVnDate, parseVnDate } from "@/lib/money/parse";

interface Props {
  /** ISO date (YYYY-MM-DD). */
  value: string;
  onChange: (iso: string) => void;
  "aria-label"?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * Date field that always shows dd/mm/yyyy (the browser's date input follows the device language, e.g. mm/dd/yyyy).
 * Type "25092026", "25/9/2026" or just "5/9"; the calendar button opens the native picker. Emits ISO dates.
 */
export function DateInput({ value, onChange, onKeyDown, ...props }: Props) {
  const [text, setText] = useState(formatVnDate(value));
  const picker = useRef<HTMLInputElement>(null);
  // Follow changes from outside (another row edited, the picker, a reset after saving).
  useEffect(() => { setText(formatVnDate(value)); }, [value]);
  const invalid = text.trim() !== "" && !parseVnDate(text);

  function type(next: string) {
    const masked = maskVnDate(next);
    setText(masked);
    // A full date is applied right away, so Enter in the row saves the date that is on screen.
    // Only with a 4-digit year: "25/09/20" is still being typed, not the year 2020.
    const iso = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(masked) ? parseVnDate(masked) : null;
    if (iso && iso !== value) onChange(iso);
  }

  function settle() {
    const iso = parseVnDate(text);
    if (iso) { if (iso !== value) onChange(iso); setText(formatVnDate(iso)); }
    else setText(formatVnDate(value));
  }

  return <span className="date-input">
    <input aria-label={props["aria-label"] ?? "Ngày"} inputMode="numeric" placeholder="dd/mm/yyyy" value={text} maxLength={10} aria-invalid={invalid || undefined}
      onChange={(event) => type(event.target.value)} onBlur={settle} onKeyDown={(event) => { if (event.key === "Enter") settle(); onKeyDown?.(event); }} />
    <button type="button" className="date-pick" aria-label="Chọn ngày trên lịch" onClick={() => { const el = picker.current; if (!el) return; if (typeof el.showPicker === "function") el.showPicker(); else el.click(); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
    </button>
    <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" className="date-native" value={value} onChange={(event) => { if (event.target.value) onChange(event.target.value); }} />
  </span>;
}
