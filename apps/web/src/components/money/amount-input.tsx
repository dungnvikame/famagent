"use client";

import type { ChangeEvent, InputHTMLAttributes } from "react";
import { groupAmountTyping } from "@/lib/money/parse";

/**
 * Drop-in `<input>` for money: adds thousand separators as the family types ("1500000" → "1.500.000") and keeps the
 * caret after the same digit. The formatted text is written into the event before `onChange` runs, so callers keep
 * reading `event.target.value` as before (and parseVnd reads "1.500.000" as 1 500 000).
 */
export function AmountInput({ onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const typed = input.value;
    const formatted = groupAmountTyping(typed);
    if (formatted !== typed) {
      // Digits before the caret stay the same; put the caret back after that many digits.
      const digitsBefore = typed.slice(0, input.selectionStart ?? typed.length).replace(/\D/g, "").length;
      input.value = formatted;
      let caret = 0; let seen = 0;
      while (caret < formatted.length && seen < digitsBefore) { if (/\d/.test(formatted[caret])) seen += 1; caret += 1; }
      input.setSelectionRange(caret, caret);
    }
    onChange?.(event);
  }
  return <input inputMode="decimal" autoComplete="off" {...props} onChange={change} />;
}
