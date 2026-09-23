"use client";

import { useEffect, useRef } from "react";

export type Line = { role: "agent" | "user"; text: string; slot?: string };

/** Conversation, confirmation chips, quick replies and composer (mockup notes 1, 2, 4, 7). */
export function OnboardingThread({ lines, busy, confirming, chips, message, consent, children, onMessage, onSend, onConsent }: {
  lines: Line[];
  busy: boolean;
  /** Last agent line asks to confirm tentative values: render it as a confirmation card. */
  confirming: boolean;
  chips: string[];
  message: string;
  consent: boolean;
  /** Extra content under the thread (the review card). */
  children?: React.ReactNode;
  onMessage: (value: string) => void;
  onSend: (value?: string) => void;
  onConsent: (value: boolean) => void;
}) {
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, [lines.length, busy, children]);
  // Keep keyboard users in the composer after each agent reply — but not on mount (mobile keyboard would cover the intro).
  const wasBusy = useRef(false);
  useEffect(() => { if (wasBusy.current && !busy) inputRef.current?.focus({ preventScroll: true }); wasBusy.current = busy; }, [busy]);

  const last = lines.length - 1;
  return <>
    <div className="ob-thread" ref={threadRef} aria-live="polite" aria-busy={busy}>
      {lines.map((line, index) => confirming && index === last && line.role === "agent"
        ? <div className="ob-confirm" role="group" aria-label="Xác nhận thông tin" key={index}><p>{line.text}</p><div className="ob-confirm-actions"><button type="button" className="ob-chip primary" disabled={busy} onClick={() => onSend("Đúng")}>Đúng</button><button type="button" className="ob-chip" disabled={busy} onClick={() => onSend("Sửa lại")}>Sửa lại</button></div></div>
        : <div className={`ob-msg ${line.role}`} key={index}>{line.text}</div>)}
      {busy && <div className="ob-typing" aria-label="Family AI đang soạn trả lời"><b/><b/><b/></div>}
      {children}
    </div>
    {!confirming && chips.length > 0 && <div className="ob-chips" role="group" aria-label="Trả lời nhanh">{chips.map((chip) => <button type="button" className="ob-chip" key={chip} disabled={busy} onClick={() => onSend(chip)}>{chip}</button>)}</div>}
    <form className="ob-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <label htmlFor="ob-message" className="ob-sr">Trả lời Family AI</label>
      <textarea id="ob-message" ref={inputRef} rows={1} value={message} disabled={busy} placeholder="Trả lời Family AI… ví dụ “Bé Gold 10kg, size L”"
        onChange={(event) => onMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }}/>
      <button type="submit" disabled={busy || !message.trim()} aria-label="Gửi cho Family AI">Gửi ↗</button>
    </form>
    <label className="ob-consent"><input type="checkbox" checked={consent} onChange={(event) => onConsent(event.target.checked)}/> <span>Cho phép gửi câu trả lời tới nhà cung cấp AI để hiểu tốt hơn (tên bé được thay bằng mã khi nhận ra được; nên tránh gửi thông tin nhận dạng khác). Không bật vẫn dùng được theo quy tắc.</span></label>
  </>;
}
