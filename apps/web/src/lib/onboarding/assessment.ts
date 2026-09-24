import { childAgeMonths } from "../experience/profile-mapper.ts";
import type { FamilyProfile } from "../experience/types.ts";

/**
 * First assessment after onboarding: a plain-language read of the family's money situation, a suggested way to
 * manage it, a care plan for the children and three first steps. Rules + arithmetic only (spec v2 §43: rules first);
 * the AI layer may rewrite the opening note but only with the numbers listed in `facts`.
 */
export interface AssessmentStep { label: string; detail: string; href: string }
export interface Assessment {
  /** One-line verdict shown at the top. */
  headline: string;
  /** 2–3 sentence opening note (replaced by the AI version when available). */
  note: string;
  finance: { points: string[] };
  care: { points: string[] };
  steps: AssessmentStep[];
  /** Every number the assessment uses, as text — the only numbers an AI rewrite may mention. */
  facts: string[];
  /** Suggested plan values the app can apply (Money plan, emergency goal). */
  plan: { monthlyPlan?: number; emergencyTarget?: number };
}

const M = 1_000_000;
/** "12,5 triệu" / "800 nghìn" — whole or one decimal, Vietnamese separators. */
export function money(amount: number): string {
  if (Math.abs(amount) < 500) return "0đ";
  if (Math.abs(amount) >= M) return `${(Math.round(amount / 100_000) / 10).toLocaleString("vi-VN")} triệu`;
  return `${Math.round(amount / 1000).toLocaleString("vi-VN")} nghìn`;
}
const round = (amount: number, step = 500_000) => Math.round(amount / step) * step;

export function buildAssessment(profile: FamilyProfile, now = new Date()): Assessment {
  const h = profile.household ?? {};
  const facts: string[] = [];
  const fact = (text: string) => { facts.push(text); return text; };
  const income = h.monthlyIncome;
  const spend = h.monthlySpend;
  const debt = h.monthlyDebt ?? 0;
  const pains = new Set(h.moneyPains ?? []);
  const worries = new Set(h.careWorries ?? []);
  const finance: string[] = [];
  const plan: Assessment["plan"] = {};

  // --- money situation -------------------------------------------------------------------------------------------
  const leftover = income !== undefined && spend !== undefined ? income - spend - debt : undefined;
  const saveRate = leftover !== undefined && income ? leftover / income : undefined;
  const debtRate = income ? debt / income : undefined;
  if (income !== undefined && spend !== undefined) {
    finance.push(fact(`Thu nhập khoảng ${money(income)}, chi tiêu khoảng ${money(spend)}${debt ? `, trả nợ khoảng ${money(debt)}` : ""} mỗi tháng → còn dư khoảng ${money(Math.max(0, leftover!))}${saveRate !== undefined && saveRate > 0 ? ` (${Math.round(saveRate * 100)}% thu nhập)` : ""}.`));
    if (leftover! <= 0) finance.push("Chi tiêu và trả nợ đang bằng hoặc vượt thu nhập — việc đầu tiên là tìm 2–3 khoản có thể cắt, trước khi nghĩ tới để dành.");
    else if (saveRate! < 0.1) finance.push("Phần dư còn mỏng (dưới 10% thu nhập): chỉ cần một khoản phát sinh là hụt. Nên để dành trước một con số nhỏ ngay khi nhận lương.");
    else if (saveRate! >= 0.2) finance.push("Phần dư khá tốt (từ 20% thu nhập trở lên) — điều quan trọng là để nó thành tiền tiết kiệm thật, không trôi vào chi tiêu lặt vặt.");
  } else if (spend !== undefined) {
    finance.push(fact(`Chi tiêu khoảng ${money(spend)} mỗi tháng.`));
  }
  if (debtRate !== undefined && debtRate > 0.3) finance.push(fact(`Trả nợ đang chiếm khoảng ${Math.round(debtRate * 100)}% thu nhập — cao hơn mức an toàn thường dùng là 30%. Nên ưu tiên trả bớt khoản lãi cao và không vay thêm.`));
  if (spend) {
    const months = h.emergency === "gt6" ? 6 : 6;
    const target = round(spend * months, M);
    plan.emergencyTarget = target;
    if (h.emergency === "none" || h.emergency === "lt3") finance.push(fact(`Quỹ dự phòng nên bằng khoảng 6 tháng chi tiêu, tức khoảng ${money(target)}. Nhà mình ${h.emergency === "none" ? "chưa có" : "đang có dưới 3 tháng"} — đây nên là mục tiêu để dành đầu tiên.`));
    else if (h.emergency === "3to6") finance.push(fact(`Quỹ dự phòng đã có 3–6 tháng chi tiêu; nâng dần lên 6 tháng (khoảng ${money(target)}) rồi chuyển sang các mục tiêu dài hơn.`));
    else if (h.emergency === "gt6") finance.push("Quỹ dự phòng đã trên 6 tháng chi tiêu — có thể dồn phần dư cho học hành của các con hoặc mục tiêu lớn.");
  }

  if (pains.has("couple_disagree")) finance.push("Vợ chồng nên cùng xem một bảng chung mỗi cuối tuần 10 phút — thống nhất trước 3 nhóm chi lớn nhất, thay vì tranh luận từng khoản.");
  if (h.housing === "rent") finance.push("Tiền thuê nhà nên đặt thành khoản cố định hằng tháng để tự ghi vào sổ, không bị quên trong kế hoạch.");

  // Monthly plan: the family's own spend figure, trimmed when spending leaves nothing to save.
  if (spend !== undefined) plan.monthlyPlan = income !== undefined && leftover !== undefined && leftover < income * 0.1 ? round(Math.max(income * 0.9 - debt, spend * 0.85)) : spend;
  if (plan.monthlyPlan && plan.monthlyPlan !== spend) finance.push(fact(`Kế hoạch chi đề xuất: khoảng ${money(plan.monthlyPlan)}/tháng (thấp hơn mức hiện tại) để có phần để dành.`));

  // --- care plan -------------------------------------------------------------------------------------------------
  const care: string[] = [];
  const children = profile.children;
  if (h.setup === "expecting") {
    care.push("Lập quỹ riêng cho chi phí sinh và 6 tháng đầu (khám thai, sinh, sữa, đồ dùng, người chăm) — tách khỏi tiền tiêu hằng tháng.");
    care.push("Theo dõi lịch khám thai theo hướng dẫn của bác sĩ; FamAgent sẽ nhắc trước mỗi lần hẹn khi bạn ghi lại.");
    if (worries.has("caregiver")) care.push("Tính trước phương án người chăm khi đi làm lại (ông bà, người giúp việc, nhà trẻ) và chi phí từng phương án.");
  }
  children.forEach((child, index) => {
    const months = childAgeMonths(child, now);
    const name = child.name ? `Bé ${child.name}` : children.length > 1 ? `Con thứ ${index + 1}` : "Bé";
    if (months === undefined) return;
    if (months < 12) care.push(`${name} dưới 1 tuổi: cân đo mỗi tháng và giữ đúng lịch tiêm chủng theo sổ tiêm; FamAgent sẽ nhắc cập nhật cân nặng hằng tháng.`);
    else if (months < 36) care.push(`${name} 1–3 tuổi: theo dõi cân nặng mỗi 2–3 tháng, kiểm tra các mũi tiêm nhắc theo tư vấn của bác sĩ, tập nếp ăn ngủ đều.`);
    else if (months < 72) care.push(`${name} 3–6 tuổi: giai đoạn đi mẫu giáo — nên có một khoản học phí cố định mỗi tháng trong kế hoạch.`);
    else care.push(`${name} từ 6 tuổi: chi học hành và hoạt động ngoại khóa tăng dần — mở một mục tiêu để dành riêng cho việc học.`);
    if (child.sensitivities?.length) care.push(`${name} có lưu ý sức khỏe (${child.sensitivities.map((item) => ({ sensitive_skin: "da nhạy cảm", rash_prone: "hay hăm, mẩn ngứa", fragrance_free: "dị ứng mùi hương" })[item]).join(", ")}) — FamAgent sẽ nhớ và tránh những thứ không hợp khi bạn hỏi.`);
  });
  if (worries.has("nutrition")) care.push("Ăn uống: ghi lại món con hợp và không hợp trong lúc trò chuyện, FamAgent sẽ nhớ để gợi ý thực đơn sau.");
  if (worries.has("sleep")) care.push("Giấc ngủ: giữ giờ ngủ cố định; nếu con ngủ kém kéo dài, ghi lại để trao đổi với bác sĩ.");
  if (worries.has("health") && h.setup !== "expecting") care.push("Sức khỏe: chụp lại sổ tiêm và ghi các lần ốm, dị ứng — lần khám sau có đủ thông tin cho bác sĩ.");
  if (worries.has("development")) care.push("Học hành: để dành cho việc học càng sớm càng nhẹ — mỗi tháng một khoản nhỏ cố định.");
  if (worries.has("cost") && spend) care.push(fact(`Chi phí nuôi con: tách nhóm “Con” trong sổ và đặt ngân sách riêng, ví dụ khoảng ${money(round(spend * 0.15))}/tháng (15% chi tiêu), để thấy rõ khoản này tăng thế nào.`));
  if (h.notes?.["care-worry"]) care.push(`Bạn có nhắc: “${h.notes["care-worry"]}” — mình đã ghi lại và sẽ lưu ý khi bạn hỏi.`);

  // --- first steps -----------------------------------------------------------------------------------------------
  const steps: AssessmentStep[] = [];
  if (plan.monthlyPlan) steps.push({ label: `Đặt kế hoạch chi ${money(plan.monthlyPlan)}/tháng`, detail: "Mình đã điền sẵn trong mục Tiền; FamAgent báo sớm khi nhịp chi vượt.", href: "/money" });
  steps.push({ label: "Ghi 3 khoản chi đầu tiên", detail: "Gõ như Excel: “Ăn sáng 30k”, “Tiền điện 974k”. Khoản cố định (tiền nhà, lương) đặt một lần.", href: "/money" });
  if (plan.emergencyTarget && h.emergency !== "gt6") steps.push({ label: `Mở mục tiêu Quỹ dự phòng ${money(plan.emergencyTarget)}`, detail: "FamAgent tính giúp mất bao lâu để đạt theo phương pháp bạn chọn.", href: "/money#plan" });
  else if (children.length) steps.push({ label: "Kiểm tra hồ sơ các con", detail: "Tên, tuổi, cân nặng, lưu ý sức khỏe — FamAgent dùng cho mọi gợi ý.", href: "/family" });

  const headline = leftover !== undefined && leftover <= 0 ? "Nhà mình đang chi nhiều hơn khả năng — cần cân lại trước tiên"
    : pains.has("debt") || (debtRate !== undefined && debtRate > 0.3) ? "Trả nợ đang là gánh nặng lớn nhất — hãy làm nó nhẹ đi trước"
    : h.emergency === "none" || h.emergency === "lt3" ? "Nền tài chính ổn, nhưng cần một quỹ dự phòng vững hơn"
    : saveRate !== undefined && saveRate >= 0.2 ? "Tài chính khá khỏe — giờ là lúc để tiền làm việc cho các mục tiêu"
    : "Bắt đầu từ việc thấy rõ tiền đi đâu";
  const note = [
    leftover !== undefined ? fact(leftover > 0 ? `Mỗi tháng nhà mình còn dư khoảng ${money(leftover)} sau chi tiêu và trả nợ.` : "Hiện chi tiêu và trả nợ đang bằng hoặc vượt thu nhập.")
      : spend !== undefined ? `Nhà mình tiêu khoảng ${money(spend)} mỗi tháng; mình sẽ giúp thấy rõ khoản này đi đâu.`
      : "Bạn chưa chia sẻ số liệu thu chi, nên mình bắt đầu từ việc ghi chép để thấy rõ bức tranh.",
    "Bên dưới là các phương pháp quản lý tiền được nhiều gia đình trên thế giới dùng — bạn chọn cách hợp với nhà mình.",
    care.length ? "Về các con, mình đã lập vài việc cần theo dõi theo độ tuổi bên dưới." : "",
  ].filter(Boolean).join(" ");
  // Every generated line is a fact the AI may restate; child names are replaced so they never reach the provider.
  const names = children.map((child) => child.name).filter((name): name is string => Boolean(name));
  const anonymous = (line: string) => names.reduce((text, name) => text.split(name).join("con"), line);
  const allFacts = [...new Set([...facts, ...finance, ...care, ...steps.map((step) => `${step.label}. ${step.detail}`)].map(anonymous))];
  return { headline, note, finance: { points: finance }, care: { points: care }, steps: steps.slice(0, 3), facts: allFacts, plan };
}
