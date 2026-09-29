"use client";

import { useState } from "react";

/** A short list as removable chips; Enter or comma adds (max 10 × 40 chars, same limits as the profile). */
export function ChipInput({ label, value, tone, placeholder, onChange }: { label: string; value?: string[]; tone?: "yes" | "no"; placeholder: string; onChange: (value: string[] | undefined) => void }) {
  const [draft, setDraft] = useState("");
  const items = value ?? [];
  const push = (text: string) => {
    const added = text.split(",").map((item) => item.trim().slice(0, 40)).filter(Boolean);
    if (!added.length) return;
    const next = [...new Set([...items, ...added])].slice(0, 10);
    onChange(next.length ? next : undefined);
    setDraft("");
  };
  const remove = (item: string) => { const next = items.filter((entry) => entry !== item); onChange(next.length ? next : undefined); };
  return <div className="fam-field"><span className="fam-label">{label}</span>
    <div className="fam-chipin">
      {items.map((item) => <span key={item} className={`fam-tag${tone ? ` ${tone}` : ""}`}>{item}<button type="button" onClick={() => remove(item)} aria-label={`Bỏ ${item}`}>×</button></span>)}
      {items.length < 10 && <input value={draft} placeholder={placeholder} aria-label={label} onChange={(event) => { if (event.target.value.endsWith(",")) push(event.target.value); else setDraft(event.target.value); }}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); push(draft); } else if (event.key === "Backspace" && !draft && items.length) remove(items[items.length - 1]); }}
        onBlur={() => push(draft)} />}
    </div>
  </div>;
}
