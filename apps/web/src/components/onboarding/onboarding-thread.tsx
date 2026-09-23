"use client";

import { useEffect, useRef } from "react";
import { IconArrowUp, IconPencil, IconRuler, IconShield, IconWallet } from "@/components/onboarding/icons";

export type Line = { role: "agent" | "user"; text: string; slot?: string };

/** Conversation, confirmation chips, quick replies and composer (mockup notes 1, 2, 4, 7; Soft Aurora UI). */
export function OnboardingThread({ lines, busy, confirming, chips, message, consent, updating = false, children, onMessage, onSend, onConsent }: {
  lines: Line[];
  busy: boolean;
  /** Last agent line asks to confirm tentative values: render it as a confirmation card. */
  confirming: boolean;
  chips: string[];
  message: string;
  consent: boolean;
  /** Editing an existing profile ("Cập nhật hồ sơ") rather than first-time onboarding. */
  updating?: boolean;
  /** Extra content under the thread (the review card). */
  children?: React.ReactNode;
  onMessage: (value: string) => void;
  onSend: (value?: string) => void;
  onConsent: (value: boolean) => void;
}) {
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The welcome block explains the why/how-long once, then gets out of the way after the first answer.
  const started = lines.some((line) => line.role === "user");
  useEffect(() => { if (!started) return; threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, [lines.length, busy, children, started]);
  // Keep keyboard users in the composer after each agent reply — but not on mount (mobile keyboard would cover the intro).
  const wasBusy = useRef(false);
  useEffect(() => { if (wasBusy.current && !busy) inputRef.current?.focus({ preventScroll: true }); wasBusy.current = busy; }, [busy]);

  const last = lines.length - 1;
  return <>
    <div className="ob-thread" ref={threadRef} aria-live="polite" aria-busy={busy}>
      {!started && <section className="ob-hero" aria-label="Giới thiệu">
        <span className="ob-orb ob-orb-lg" aria-hidden="true" />
        <h1>{updating ? "Cập nhật hồ sơ gia đình" : "Làm quen với gia đình bạn"}</h1>
        <p>{updating ? "Nói điều đã thay đổi — mình chỉ sửa đúng phần đó." : "Khoảng 1–2 phút. Câu nào chưa muốn trả lời, cứ bỏ qua."}</p>
        <ul className="ob-benefits">
          <li><IconRuler /> Gợi ý đúng size theo cân nặng</li>
          <li><IconWallet /> Lọc theo ngân sách của nhà mình</li>
          <li><IconPencil /> Sửa hoặc xóa bất cứ lúc nào</li>
        </ul>
      </section>}
      {lines.map((line, index) => {
        const firstOfRun = line.role === "agent" && lines[index - 1]?.role !== "agent";
        if (confirming && index === last && line.role === "agent") {
          return <div className="ob-row agent" key={index}>
            <span className="ob-orb" aria-hidden="true" />
            <div className="ob-confirm" role="group" aria-label="Xác nhận thông tin"><p>{line.text}</p><div className="ob-confirm-actions"><button type="button" className="ob-chip primary" disabled={busy} onClick={() => onSend("Đúng")}>Đúng</button><button type="button" className="ob-chip" disabled={busy} onClick={() => onSend("Sửa lại")}>Sửa lại</button></div></div>
          </div>;
        }
        return <div className={`ob-row ${line.role}`} key={index}>
          {line.role === "agent" && <span className={`ob-orb${firstOfRun ? "" : " ghost"}`} aria-hidden="true" />}
          <div className={`ob-msg ${line.role}`}>{line.text}</div>
        </div>;
      })}
      {busy && <div className="ob-row agent"><span className="ob-orb" aria-hidden="true" /><div className="ob-typing" aria-label="Family AI đang soạn trả lời"><b/><b/><b/></div></div>}
      {children}
    </div>
    {!confirming && chips.length > 0 && <div className="ob-chips" role="group" aria-label="Trả lời nhanh">{chips.map((chip) => <button type="button" className="ob-chip" key={chip} disabled={busy} onClick={() => onSend(chip)}>{chip}</button>)}</div>}
    <form className="ob-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <label htmlFor="ob-message" className="ob-sr">Trả lời Family AI</label>
      <textarea id="ob-message" ref={inputRef} rows={1} value={message} disabled={busy} placeholder="Nhập câu trả lời…"
        onChange={(event) => onMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }}/>
      <button type="submit" className="ob-send" disabled={busy || !message.trim()} aria-label="Gửi cho Family AI"><IconArrowUp /></button>
    </form>
    <label className="ob-consent">
      <input type="checkbox" role="switch" checked={consent} onChange={(event) => onConsent(event.target.checked)}/>
      <span className="ob-consent-text"><IconShield size={16} /> <span><b>Dùng AI để hiểu câu trả lời tốt hơn.</b> Tên bé được thay bằng mã khi nhận ra được; nên tránh gửi thông tin nhận dạng khác. Tắt vẫn dùng được theo quy tắc.</span></span>
    </label>
  </>;
}
