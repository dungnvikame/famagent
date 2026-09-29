import type { AdultMember, ChildProfile, FamilyProfile, MemberLook } from "../experience/types.ts";
import { AVATAR_COLORS, COVER_THEMES, MEMBER_ROLES } from "../experience/types.ts";

/**
 * Family page members: the adults (household.members, or placeholders from adultsCount) and the children, each with a
 * look (emoji + colour) that a photo in member_avatars can override. Pure; the page and tests share it.
 */
export type AvatarColor = (typeof AVATAR_COLORS)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type CoverTheme = (typeof COVER_THEMES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = { dad: "Bố", mom: "Mẹ", grandpa: "Ông", grandma: "Bà", caregiver: "Người chăm bé", other: "Người lớn" };
/** Gradient + readable ink per colour (ink ≥ 4.5:1 on the light tint). */
export const COLOR_STYLES: Record<AvatarColor, { grad: string; tint: string; ink: string; dot: string; label: string }> = {
  sunset: { grad: "linear-gradient(135deg,#ffb45c,#ff7a59)", tint: "linear-gradient(160deg,#fff1dc,#ffe6d6)", ink: "#a3461a", dot: "#ff8f5a", label: "Hoàng hôn" },
  peach: { grad: "linear-gradient(135deg,#ffc2a8,#f48c7f)", tint: "linear-gradient(160deg,#fff0ea,#ffe4dc)", ink: "#a13d33", dot: "#f49b8a", label: "Đào" },
  lilac: { grad: "linear-gradient(135deg,#a58cff,#6a4fd8)", tint: "linear-gradient(160deg,#f0ebff,#e7e0ff)", ink: "#4a35a8", dot: "#8c72f2", label: "Tím" },
  ocean: { grad: "linear-gradient(135deg,#5ab8ff,#2f6fd6)", tint: "linear-gradient(160deg,#e6f3ff,#dcecff)", ink: "#1f4f9e", dot: "#4a94ee", label: "Biển" },
  mint: { grad: "linear-gradient(135deg,#4cc79a,#1f9a74)", tint: "linear-gradient(160deg,#dcf7ec,#e9fbf3)", ink: "#1a6b50", dot: "#34b487", label: "Bạc hà" },
  rose: { grad: "linear-gradient(135deg,#ff8fb8,#e0457f)", tint: "linear-gradient(160deg,#ffe8f1,#ffdbe9)", ink: "#a02a5b", dot: "#f06a9c", label: "Hồng" },
  sky: { grad: "linear-gradient(135deg,#7fd8e8,#3aa6c4)", tint: "linear-gradient(160deg,#e3f8fb,#d6f2f7)", ink: "#1d6275", dot: "#52bcd6", label: "Trời" },
  ink: { grad: "linear-gradient(135deg,#6a5ae0,#3f3290)", tint: "linear-gradient(160deg,#ece8ff,#e2dcff)", ink: "#3f3290", dot: "#5b4bb7", label: "Mực" },
};
export const COVER_STYLES: Record<CoverTheme, { label: string; background: string }> = {
  aurora: { label: "Cực quang", background: "radial-gradient(70% 90% at 0% 0%,#ffe1cf 0%,transparent 60%),radial-gradient(60% 80% at 100% 0%,#e3dcff 0%,transparent 62%),radial-gradient(60% 70% at 70% 110%,#d4f5e8 0%,transparent 60%),#fffdfb" },
  sunrise: { label: "Bình minh", background: "radial-gradient(80% 90% at 10% 0%,#ffd6a8 0%,transparent 60%),radial-gradient(60% 80% at 100% 20%,#ffc7d6 0%,transparent 62%),#fff8f2" },
  garden: { label: "Khu vườn", background: "radial-gradient(80% 90% at 0% 10%,#cdf3dc 0%,transparent 60%),radial-gradient(60% 80% at 100% 0%,#f4f1b8 0%,transparent 62%),#f8fdf7" },
  ocean: { label: "Đại dương", background: "radial-gradient(80% 90% at 0% 0%,#cfe8ff 0%,transparent 60%),radial-gradient(60% 80% at 100% 10%,#d5f5f2 0%,transparent 62%),#f6fbff" },
  night: { label: "Đêm sao", background: "radial-gradient(80% 90% at 0% 0%,#d9d2ff 0%,transparent 60%),radial-gradient(60% 80% at 100% 10%,#c9d8ff 0%,transparent 62%),#f7f6ff" },
};
/** Emoji choices for avatars (no text, so nothing personal leaks through them). */
export const AVATAR_EMOJIS = ["👶", "🧒", "👧", "👦", "👩", "👨", "👵", "👴", "🐻", "🐰", "🦊", "🐼", "🐯", "🐥", "🦄", "🐳", "🌻", "⭐", "🌈", "🍀"] as const;

const CHILD_ORDER: AvatarColor[] = ["sunset", "mint", "ocean", "rose", "sky"];
const ADULT_ORDER: AvatarColor[] = ["ink", "lilac", "peach", "ocean", "mint", "rose", "sky", "sunset", "ink", "lilac"];

/** Adults as stored, or "me" plus placeholders so the avatar row matches adultsCount before anyone edits it. */
export function adultMembers(profile: FamilyProfile): AdultMember[] {
  const stored = profile.household?.members;
  if (stored?.length) return stored;
  const count = Math.max(1, Math.min(10, profile.adultsCount ?? 1));
  return Array.from({ length: count }, (_, index) => ({ id: index === 0 ? "me" : `adult-${index + 1}` }));
}

/** Writes the adults back; adultsCount always follows the list. */
export function withMembers(profile: FamilyProfile, members: AdultMember[]): FamilyProfile {
  return { ...profile, adultsCount: members.length, household: { ...profile.household, members } };
}

export function adultLook(member: AdultMember, index: number): { color: AvatarColor; emoji?: string } {
  return { color: member.color ?? ADULT_ORDER[index % ADULT_ORDER.length], emoji: member.emoji };
}
export function childLook(profile: FamilyProfile, child: ChildProfile, index: number): { color: AvatarColor; emoji?: string } {
  const look: MemberLook = profile.household?.looks?.[child.id] ?? {};
  return { color: look.color ?? CHILD_ORDER[index % CHILD_ORDER.length], emoji: look.emoji };
}
export function withChildLook(profile: FamilyProfile, childId: string, look: MemberLook): FamilyProfile {
  const looks = { ...profile.household?.looks, [childId]: look };
  return { ...profile, household: { ...profile.household, looks } };
}

/** "Bạn", the role, or a numbered fallback. `accountName` fills "me" when the family never named it. */
export function adultName(member: AdultMember, index: number, accountName?: string): string {
  if (member.name) return member.name;
  if (member.id === "me" && accountName) return accountName;
  return member.role ? ROLE_LABELS[member.role] : index === 0 ? "Bạn" : `Người lớn ${index + 1}`;
}
export const childName = (child: ChildProfile, index: number) => child.name || `Bé ${index + 1}`;
/** First letter for the avatar bubble. */
export const initialOf = (name: string) => (name.trim()[0] ?? "?").toLocaleUpperCase("vi");

export const newMemberId = () => `m-${Math.random().toString(36).slice(2, 10)}`;

export const SENSITIVITY_LABELS = { sensitive_skin: "Da nhạy cảm", rash_prone: "Dễ hăm", fragrance_free: "Cần không hương liệu" } as const;
