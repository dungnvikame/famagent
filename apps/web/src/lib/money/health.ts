import type { FamilyProfile } from "../experience/types.ts";

/**
 * Family financial health check modelled on the FinHealth Framework (Financial Health Network, "Financial Health
 * Pulse"): 8 indicators across Spend · Save · Borrow · Plan, each rated Healthy / Coping / Vulnerable. Indicator 6
 * of the original (prime credit score) is replaced by income stability, which Vietnamese families can answer.
 * Every non-healthy indicator yields a concrete problem and a fix; scoring is rules only.
 */
export type HealthStatus = "healthy" | "coping" | "vulnerable" | "unknown";
export type HealthPillar = "Chi tiêu" | "Tiết kiệm" | "Vay nợ" | "Kế hoạch";
export interface HealthIndicator {
  key: string;
  pillar: HealthPillar;
  label: string;
  status: HealthStatus;
  /** What we measured, in words and numbers. */
  finding: string;
  /** Problem + what to do, only when not healthy. */
  problem?: string;
  fix?: string;
}
export interface HealthReport {
  /** 0–100 over known indicators; undefined when fewer than 3 are known. */
  score?: number;
  tier?: "healthy" | "coping" | "vulnerable";
  indicators: HealthIndicator[];
  /** Non-healthy indicators, most urgent first. */
  problems: HealthIndicator[];
  /** Emergency fund months recommended for this family. */
  emergencyMonths: number;
}

export const HEALTH_LABELS: Record<Exclude<HealthStatus, "unknown">, string> = { healthy: "Vững vàng", coping: "Tạm ổn", vulnerable: "Dễ tổn thương" };
const POINTS: Record<Exclude<HealthStatus, "unknown">, number> = { healthy: 90, coping: 60, vulnerable: 20 };
const tr = (amount: number) => `${(Math.round(amount / 100_000) / 10).toLocaleString("vi-VN")} triệu`;

export function financialHealth(profile: FamilyProfile): HealthReport {
  const h = profile.household ?? {};
  const income = h.monthlyIncome;
  const spend = h.monthlySpend;
  const debt = h.monthlyDebt ?? 0;
  const kids = profile.children.length > 0 || h.setup === "expecting";
  // Irregular income needs a thicker buffer (common planner guidance: 6 months stable, 9–12 months irregular).
  const emergencyMonths = h.incomeStability === "irregular" ? 9 : h.incomeStability === "stable_both" ? 6 : 6;
  const items: HealthIndicator[] = [];
  const add = (item: HealthIndicator) => items.push(item);

  // 1 Spend less than income
  if (income !== undefined && spend !== undefined) {
    const rate = (income - spend - debt) / income;
    const status: HealthStatus = rate >= 0.1 ? "healthy" : rate > 0 ? "coping" : "vulnerable";
    add({ key: "spend", pillar: "Chi tiêu", label: "Chi ít hơn thu", status, finding: `Còn dư ${Math.round(rate * 100)}% thu nhập mỗi tháng (thu ${tr(income)}, chi ${tr(spend)}${debt ? `, trả nợ ${tr(debt)}` : ""}).`,
      ...(status !== "healthy" && { problem: status === "vulnerable" ? "Chi tiêu và trả nợ đang bằng hoặc vượt thu nhập." : "Phần dư dưới 10% thu nhập — một khoản phát sinh là hụt.", fix: `Tìm 2–3 nhóm chi lớn nhất và cắt khoảng ${tr(Math.max(income * 0.1 - (income - spend - debt), 500_000))}/tháng để dư ít nhất 10% (${tr(income * 0.1)}).` }) });
  } else add({ key: "spend", pillar: "Chi tiêu", label: "Chi ít hơn thu", status: "unknown", finding: "Chưa có số thu nhập và chi tiêu." });

  // 2 Pay bills on time
  if (h.billTimeliness) {
    const status: HealthStatus = h.billTimeliness === "always" ? "healthy" : h.billTimeliness === "sometimes" ? "coping" : "vulnerable";
    add({ key: "bills", pillar: "Chi tiêu", label: "Trả hóa đơn đúng hạn", status, finding: { always: "Luôn trả đúng hạn.", sometimes: "Thỉnh thoảng trả trễ.", often_late: "Hay trả trễ, phải xoay xở." }[h.billTimeliness],
      ...(status !== "healthy" && { problem: "Trả trễ làm phát sinh phí phạt, lãi quá hạn và có thể ghi nhận nợ xấu trên CIC.", fix: "Gom các khoản cố định (điện, nước, internet, trả góp) thành khoản định kỳ trong mục Tiền để được nhắc trước hạn; đặt ngày trả ngay sau ngày nhận lương." }) });
  } else add({ key: "bills", pillar: "Chi tiêu", label: "Trả hóa đơn đúng hạn", status: "unknown", finding: "Chưa trả lời." });

  // 3 Sufficient liquid savings
  if (h.emergency) {
    const months = { none: 0, lt3: 2, "3to6": 4.5, gt6: 7 }[h.emergency];
    const status: HealthStatus = months >= Math.min(emergencyMonths, 6) ? "healthy" : months >= 3 ? "coping" : h.emergency === "lt3" ? "coping" : "vulnerable";
    const target = spend ? spend * emergencyMonths : undefined;
    add({ key: "liquid", pillar: "Tiết kiệm", label: "Quỹ dự phòng", status, finding: { none: "Chưa có khoản để dành dùng được ngay.", lt3: "Đủ sống dưới 3 tháng.", "3to6": "Đủ sống 3–6 tháng.", gt6: "Đủ sống trên 6 tháng." }[h.emergency],
      ...(status !== "healthy" && { problem: `Nếu tạm mất thu nhập hoặc ốm đau, nhà mình chưa có đủ ${emergencyMonths} tháng chi tiêu dự phòng${h.incomeStability === "irregular" ? " (thu nhập không đều nên cần dày hơn)" : ""}.`, fix: target ? `Mở mục tiêu Quỹ dự phòng ${tr(target)} (${emergencyMonths} tháng chi tiêu), để ở tài khoản rút được ngay, góp đều mỗi tháng trước khi tiêu.` : `Mở mục tiêu Quỹ dự phòng bằng ${emergencyMonths} tháng chi tiêu, góp đều mỗi tháng trước khi tiêu.` }) });
  } else add({ key: "liquid", pillar: "Tiết kiệm", label: "Quỹ dự phòng", status: "unknown", finding: "Chưa trả lời." });

  // 4 Sufficient long-term savings
  if (h.longTermSavings?.length) {
    const kinds = h.longTermSavings.filter((item) => item !== "none");
    const status: HealthStatus = kinds.length >= 2 ? "healthy" : kinds.length === 1 ? "coping" : "vulnerable";
    add({ key: "long-term", pillar: "Tiết kiệm", label: "Tích lũy dài hạn", status, finding: kinds.length ? `Đang tích lũy ở ${kinds.length} kênh.` : "Chưa có tích lũy dài hạn.",
      ...(status !== "healthy" && { problem: kinds.length ? "Tích lũy dài hạn chỉ ở một kênh — rủi ro dồn một chỗ." : "Chưa có khoản tích lũy cho mục tiêu dài hạn (học của con, nhà, về hưu).", fix: kinds.length ? "Sau khi đủ quỹ dự phòng, chia thêm một kênh khác (ví dụ gửi tiết kiệm kỳ hạn dài hoặc chứng chỉ quỹ) cho mục tiêu dài hạn." : `Sau quỹ dự phòng, trích đều ${income ? tr(income * 0.1) : "10% thu nhập"}/tháng cho một mục tiêu dài hạn — ví dụ quỹ học cho con.` }) });
  } else add({ key: "long-term", pillar: "Tiết kiệm", label: "Tích lũy dài hạn", status: "unknown", finding: "Chưa trả lời." });

  // 5 Manageable debt (debt-to-income; 36% is the common upper bound)
  if (income !== undefined && h.monthlyDebt !== undefined) {
    const dti = debt / income;
    const highInterest = (h.debtTypes ?? []).filter((item) => item === "credit_card" || item === "consumer_loan");
    const status: HealthStatus = dti > 0.36 ? "vulnerable" : dti > 0.2 || highInterest.length ? "coping" : "healthy";
    add({ key: "debt", pillar: "Vay nợ", label: "Nợ trong tầm kiểm soát", status, finding: debt ? `Trả nợ chiếm ${Math.round(dti * 100)}% thu nhập${highInterest.length ? ", có khoản lãi cao (thẻ tín dụng / vay tiêu dùng)" : ""}.` : "Không có khoản trả nợ hằng tháng.",
      ...(status !== "healthy" && { problem: dti > 0.36 ? `Trả nợ ${Math.round(dti * 100)}% thu nhập — vượt ngưỡng 36% thường dùng để đánh giá nợ an toàn.` : highInterest.length ? "Đang có khoản vay lãi cao (thẻ tín dụng, vay tiêu dùng) — lãi thường gấp nhiều lần tiền gửi." : `Trả nợ ${Math.round(dti * 100)}% thu nhập — nên giữ dưới 20%.`, fix: highInterest.length ? "Trả dứt khoản lãi cao nhất trước (phương pháp “tuyết lở”), hoặc khoản nhỏ nhất trước để lấy đà (“quả cầu tuyết”); không vay thêm cho đến khi xong." : "Không vay thêm; dồn phần dư trả bớt gốc khoản có lãi cao nhất; cân nhắc tái cơ cấu kỳ hạn nếu áp lực quá lớn." }) });
  } else add({ key: "debt", pillar: "Vay nợ", label: "Nợ trong tầm kiểm soát", status: "unknown", finding: "Chưa có số thu nhập hoặc trả nợ." });

  // 6 Income stability (replaces the credit-score indicator)
  if (h.incomeStability) {
    const status: HealthStatus = h.incomeStability === "stable_both" ? "healthy" : h.incomeStability === "stable_one" ? "coping" : "vulnerable";
    add({ key: "stability", pillar: "Vay nợ", label: "Thu nhập ổn định", status, finding: { stable_both: "Cả hai vợ chồng có lương cố định.", stable_one: "Một nguồn lương cố định.", irregular: "Thu nhập không đều." }[h.incomeStability],
      ...(status !== "healthy" && { problem: h.incomeStability === "irregular" ? "Thu nhập lên xuống khiến khó lập ngân sách tháng." : "Cả nhà phụ thuộc chủ yếu vào một nguồn lương.", fix: h.incomeStability === "irregular" ? "Lập ngân sách theo tháng thu thấp nhất; tháng thu cao chuyển phần dư vào quỹ đệm để “tự trả lương” đều cho mình." : "Ưu tiên quỹ dự phòng và bảo hiểm cho người kiếm tiền chính; tìm thêm một nguồn thu nhỏ nếu có thể." }) });
  } else add({ key: "stability", pillar: "Vay nợ", label: "Thu nhập ổn định", status: "unknown", finding: "Chưa trả lời." });

  // 7 Appropriate insurance
  if (h.insurance?.length) {
    const has = new Set(h.insurance);
    const status: HealthStatus = has.has("none") ? "vulnerable" : kids && !has.has("life_main_earner") ? "coping" : has.has("private_health") || has.has("life_main_earner") ? "healthy" : "coping";
    add({ key: "insurance", pillar: "Kế hoạch", label: "Bảo hiểm phù hợp", status, finding: has.has("none") ? "Chưa có bảo hiểm nào." : `Đã có: ${[has.has("public_health") && "BHYT", has.has("private_health") && "sức khỏe tư nhân", has.has("life_main_earner") && "nhân thọ cho người kiếm tiền chính"].filter(Boolean).join(", ")}.`,
      ...(status !== "healthy" && { problem: has.has("none") ? "Một lần nằm viện có thể xóa sạch tiền để dành." : kids ? "Nhà có con nhỏ nhưng người kiếm tiền chính chưa có bảo hiểm nhân thọ bảo vệ thu nhập." : "Chỉ có BHYT — chi phí điều trị lớn vẫn phải tự trả nhiều.", fix: has.has("none") ? "Việc đầu tiên: BHYT cho cả nhà (chi phí thấp). Sau đó cân nhắc bảo hiểm sức khỏe và bảo hiểm thu nhập cho người kiếm tiền chính." : "Cân nhắc bảo hiểm nhân thọ loại bảo vệ (không cần tích lũy) cho người kiếm tiền chính, số tiền bảo vệ khoảng 5–10 năm thu nhập; so sánh nhiều nơi trước khi mua." }) });
  } else add({ key: "insurance", pillar: "Kế hoạch", label: "Bảo hiểm phù hợp", status: "unknown", finding: "Chưa trả lời." });

  // 8 Plan ahead
  if (h.planning) {
    const status: HealthStatus = h.planning === "specific" ? "healthy" : h.planning === "rough" ? "coping" : "vulnerable";
    add({ key: "plan", pillar: "Kế hoạch", label: "Có kế hoạch tài chính", status, finding: { specific: "Có kế hoạch với con số và thời hạn.", rough: "Có ý tưởng, chưa cụ thể.", none: "Chưa có kế hoạch." }[h.planning],
      ...(status !== "healthy" && { problem: "Mục tiêu chưa có con số và thời hạn thì rất khó đạt.", fix: `Biến ${h.savingGoals?.length ? "các mục tiêu bạn đã chọn" : "1–2 mục tiêu quan trọng nhất"} thành mục tiêu có số tiền và hạn cụ thể trong mục Tiền — FamAgent tính giúp mỗi tháng cần góp bao nhiêu.` }) });
  } else add({ key: "plan", pillar: "Kế hoạch", label: "Có kế hoạch tài chính", status: "unknown", finding: "Chưa trả lời." });

  const known = items.filter((item) => item.status !== "unknown");
  const score = known.length >= 3 ? Math.round(known.reduce((sum, item) => sum + POINTS[item.status as keyof typeof POINTS], 0) / known.length) : undefined;
  const tier = score === undefined ? undefined : score >= 80 ? "healthy" : score >= 40 ? "coping" : "vulnerable";
  // Urgency: vulnerable before coping; within a tier, cash-flow and safety first (spend, liquid, debt, bills, insurance, …).
  const order = ["spend", "liquid", "debt", "bills", "insurance", "stability", "plan", "long-term"];
  const problems = items.filter((item) => item.status === "vulnerable" || item.status === "coping")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "vulnerable" ? -1 : 1) || order.indexOf(a.key) - order.indexOf(b.key));
  return { score, tier, indicators: items, problems, emergencyMonths };
}
