/* eslint-disable @next/next/no-img-element -- avatars are small data URLs / Google photos */
import { COLOR_STYLES, initialOf, type AvatarColor } from "@/lib/family/members";

/** One family member's bubble: photo, else emoji, else the initial — on the member's colour. */
export function MemberAvatar({ name, color, emoji, photo, size = 56, className = "" }: { name: string; color: AvatarColor; emoji?: string; photo?: string; size?: number; className?: string }) {
  return <span className={`fam-av ${className}`} style={{ width: size, height: size, background: COLOR_STYLES[color].grad, fontSize: Math.round(size * (emoji ? 0.5 : 0.38)) }} aria-hidden="true">
    {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : emoji ?? initialOf(name)}
  </span>;
}
