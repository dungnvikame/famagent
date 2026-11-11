// Vietnamese wording for the onboarding review step.
import { childAgeMonths } from "../../experience/profile-mapper.ts";
import { vnd } from "../../money/format-vnd.ts";
import type { ChildProfile, FamilyProfile } from "../../experience/types.ts";
import { formatWeight } from "../../onboarding/questions.ts";

const childLabel = (child?: ChildProfile, index = 0) => child?.name ? `bé ${child.name}` : index > 0 ? `bé thứ ${index + 1}` : "bé";

/** Short readable summary for the review step. */
export function profileSummary(profile: FamilyProfile): string[] {
  const lines: string[] = [];
  const h = profile.household;
  const FOCUS: Record<string, string> = { money: "quản lý thu chi", shopping: "mua sắm hợp lý", replenish: "nhắc những thứ dễ quên", care: "theo dõi sức khỏe các con", schedule: "lịch và việc nhà" };
  const SETUP: Record<string, string> = { couple: "Vợ chồng và các con", multigen: "Sống cùng ông bà", single_parent: "Bố/mẹ tự nuôi con", expecting: "Đang chờ em bé chào đời", no_kids: "Chưa có con" };
  if (h?.focus?.length) lines.push(`Nhờ FamAgent: ${h.focus.map((item) => FOCUS[item]).join(", ")}`);
  if (h?.setup) lines.push(SETUP[h.setup]);
  else if (profile.adultsCount) lines.push(`${profile.adultsCount} người lớn`);
  profile.children.forEach((child, index) => {
    const age = childAgeMonths(child);
    const details = [child.weightKg ? formatWeight(child.weightKg) : null, age !== undefined ? (age >= 24 ? `${Math.floor(age / 12)} tuổi` : `${age} tháng`) : null].filter(Boolean);
    lines.push(`${childLabel(child, index).replace(/^b/, "B")}: ${details.length ? details.join(", ") : "chưa có thông tin"}`);
  });
  const HOUSING: Record<string, string> = { own: "Ở nhà của mình", rent: "Đang thuê nhà", with_parents: "Ở cùng bố mẹ" };
  const GOALS: Record<string, string> = { emergency: "quỹ dự phòng", education: "học hành của các con", home: "nhà", car: "xe", travel: "du lịch", retirement: "về hưu, chăm bố mẹ" };
  if (h?.housing) lines.push(HOUSING[h.housing]);
  if (h?.monthlyIncome) lines.push(`Thu nhập khoảng ${vnd(h.monthlyIncome)}/tháng`);
  if (h?.savingGoals?.length) lines.push(`Đang để dành: ${h.savingGoals.map((item) => GOALS[item]).join(", ")}`);
  if (h?.monthlySpend) lines.push(`Chi tiêu tháng khoảng ${vnd(h.monthlySpend)} — dùng làm kế hoạch trong mục Tài chính`);
  return lines;
}

