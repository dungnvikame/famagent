"use client";

import { useRef, useState } from "react";
import { squareAvatar } from "@/lib/image/shrink";
import { AVATAR_EMOJIS, COLOR_STYLES, type AvatarColor } from "@/lib/family/members";
import { AVATAR_COLORS } from "@/lib/experience/types";
import { MemberAvatar } from "./member-avatar";

/**
 * Personal look of one member: a photo (cropped square in the browser, never the original file), or an emoji,
 * on a colour that also tints the member's cards. Emoji/colour save with the profile; the photo saves on its own.
 */
export function AvatarEditor({ name, color, emoji, photo, onLook, onPhoto }: {
  name: string; color: AvatarColor; emoji?: string; photo?: string;
  onLook: (look: { color: AvatarColor; emoji?: string }) => void;
  onPhoto: (image: string | null) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Chọn một tệp ảnh."); return; }
    setBusy(true); setError("");
    try { await onPhoto(await squareAvatar(file)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được ảnh."); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function clear() { setBusy(true); setError(""); try { await onPhoto(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa xóa được ảnh."); } finally { setBusy(false); } }

  return <div className="fam-avedit">
    <div className="fam-avedit-top">
      <MemberAvatar name={name} color={color} emoji={emoji} photo={photo} size={96} className="big" />
      <div className="fam-avedit-actions">
        <input ref={input} type="file" accept="image/*" hidden onChange={(event) => void pick(event.target.files?.[0])} />
        <button type="button" className="app-btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Đang xử lý…" : photo ? "Đổi ảnh" : "📷 Tải ảnh lên"}</button>
        {photo && <button type="button" className="app-btn ghost" disabled={busy} onClick={() => void clear()}>Bỏ ảnh</button>}
        <small>Ảnh được cắt vuông, thu nhỏ ngay trên máy và chỉ nhà bạn xem được.</small>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="fam-field"><span className="fam-label">Hoặc chọn biểu tượng{photo ? " (hiện khi không có ảnh)" : ""}</span>
      <div className="fam-emoji-grid" role="radiogroup" aria-label="Biểu tượng">
        <button type="button" role="radio" aria-checked={!emoji} className={!emoji ? "on" : ""} onClick={() => onLook({ color, emoji: undefined })}>{name.trim()[0]?.toLocaleUpperCase("vi") ?? "?"}</button>
        {AVATAR_EMOJIS.map((item) => <button type="button" key={item} role="radio" aria-checked={emoji === item} className={emoji === item ? "on" : ""} onClick={() => onLook({ color, emoji: item })}>{item}</button>)}
      </div>
    </div>
    <div className="fam-field"><span className="fam-label">Màu riêng</span>
      <div className="fam-swatches" role="radiogroup" aria-label="Màu riêng">
        {AVATAR_COLORS.map((item) => <button type="button" key={item} role="radio" aria-checked={color === item} aria-label={COLOR_STYLES[item].label} className={color === item ? "on" : ""} style={{ background: COLOR_STYLES[item].grad }} onClick={() => onLook({ color: item, emoji })} />)}
      </div>
    </div>
  </div>;
}
