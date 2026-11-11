"use client";

import { AVATAR_EMOJIS, COLOR_STYLES, type AvatarColor } from "@/lib/family/members";
import { AVATAR_COLORS } from "@/lib/experience/types";
import { MemberAvatar } from "./member-avatar";

/** Personal look of one member: an emoji (or the initial) on a colour that also tints the member's cards. Saves with the profile. */
export function AvatarEditor({ name, color, emoji, photo, onLook }: {
  name: string; color: AvatarColor; emoji?: string;
  /** Google account photo of the signed-in adult; shown instead of the emoji when present. */
  photo?: string;
  onLook: (look: { color: AvatarColor; emoji?: string }) => void;
}) {
  return <div className="fam-avedit">
    <div className="fam-avedit-top"><MemberAvatar name={name} color={color} emoji={emoji} photo={photo} size={96} className="big" /></div>
    <div className="fam-field"><span className="fam-label">Biểu tượng{photo ? " (hiện khi không có ảnh tài khoản)" : ""}</span>
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
