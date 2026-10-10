// Who can a trip or a packing item belong to: the adults (household.members) and the children, with a stable id
// (member_avatars convention: child uuid or adult id) and a display label. Pure; relative .ts imports for tests.
import type { ChildProfile, FamilyProfile } from "../experience/types.ts";
import { ageParts } from "../family/child-stats.ts";
import { adultMembers, ROLE_LABELS } from "../family/members.ts";

export interface TripMember { id: string; label: string; kind: "adult" | "child"; ageMonths?: number }

/** Months old today: birthDate when known, else ageMonths grown by the time since ageAsOf (same rule as the profile). */
export function childAgeMonths(child: Pick<ChildProfile, "birthDate" | "ageMonths" | "ageAsOf">, today: string): number | undefined {
  if (child.birthDate) return ageParts(child.birthDate, today).totalMonths;
  if (child.ageMonths === undefined) return undefined;
  if (!child.ageAsOf) return child.ageMonths;
  const [ay, am] = child.ageAsOf.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  return child.ageMonths + Math.max(0, (ty - ay) * 12 + (tm - am));
}

export function tripMembers(profile: FamilyProfile | null, today: string): TripMember[] {
  if (!profile) return [];
  const adults: TripMember[] = adultMembers(profile).map((member, index) => ({
    id: member.id, kind: "adult",
    label: member.name || (member.role ? ROLE_LABELS[member.role] : index === 0 ? "Bố/Mẹ" : `Người lớn ${index + 1}`),
  }));
  const children: TripMember[] = (profile.children ?? []).map((child, index) => {
    const months = childAgeMonths(child, today);
    const name = child.name || `Bé ${index + 1}`;
    const age = months === undefined ? "" : months < 24 ? ` (${months} tháng)` : ` (${Math.floor(months / 12)} tuổi)`;
    return { id: child.id, kind: "child", ageMonths: months, label: `${name}${age}` };
  });
  return [...adults, ...children];
}

export const memberLabel = (members: TripMember[], id: string | undefined): string => id ? members.find((member) => member.id === id)?.label ?? "Thành viên" : "Cả nhà";
