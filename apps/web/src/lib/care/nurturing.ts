import { childAgeMonths } from "../experience/profile-mapper.ts";
import type { FamilyProfile } from "../experience/types.ts";

/**
 * Child care check modelled on the Nurturing Care Framework (WHO, UNICEF, World Bank Group, 2018): five components —
 * good health, adequate nutrition, responsive caregiving, opportunities for early learning, security & safety.
 * Thresholds: sleep hours per AASM (endorsed by AAP, 2016); screen time per WHO guidelines on physical activity,
 * sedentary behaviour and sleep for children under 5 (2019). General guidance only — not medical advice.
 */
export type CareStatus = "healthy" | "coping" | "vulnerable" | "unknown";
export type CareComponent = "Sức khỏe" | "Dinh dưỡng" | "Chăm sóc đáp ứng" | "Học sớm" | "An toàn";
export interface CareIndicator { key: string; component: CareComponent; label: string; status: CareStatus; finding: string; problem?: string; fix?: string }
export interface CareReport { score?: number; tier?: "healthy" | "coping" | "vulnerable"; indicators: CareIndicator[]; problems: CareIndicator[]; youngestMonths?: number }

const POINTS = { healthy: 90, coping: 60, vulnerable: 20 } as const;

/** Recommended total sleep (hours / 24 h incl. naps) by age — AASM 2016. */
export function sleepRange(months: number): string {
  if (months < 4) return "14–17 giờ (khuyến nghị cho trẻ sơ sinh)";
  if (months < 12) return "12–16 giờ";
  if (months < 36) return "11–14 giờ";
  if (months < 72) return "10–13 giờ";
  if (months < 156) return "9–12 giờ";
  return "8–10 giờ";
}
/** WHO 2019 (under 5); older children: family media plan, keep it from replacing sleep, play and homework. */
export function screenGuide(months: number): { limitMinutes: number; text: string } {
  if (months < 24) return { limitMinutes: 0, text: "WHO khuyến nghị trẻ dưới 2 tuổi không xem màn hình (trừ gọi video với người thân)." };
  if (months < 60) return { limitMinutes: 60, text: "WHO khuyến nghị trẻ 2–4 tuổi xem màn hình tối đa 1 giờ/ngày, càng ít càng tốt." };
  return { limitMinutes: 120, text: "Với trẻ lớn, nên có quy tắc màn hình của gia đình để không lấn giờ ngủ, vận động và học." };
}

export function careHealth(profile: FamilyProfile, now = new Date()): CareReport {
  const h = profile.household ?? {};
  const ages = profile.children.map((child) => childAgeMonths(child, now)).filter((value): value is number => value !== undefined);
  const youngest = ages.length ? Math.min(...ages) : undefined;
  const items: CareIndicator[] = [];
  const add = (item: CareIndicator) => items.push(item);
  const unknown = (key: string, component: CareComponent, label: string) => add({ key, component, label, status: "unknown", finding: "Chưa trả lời." });

  // Good health
  if (h.vaccines) add({ key: "vaccines", component: "Sức khỏe", label: "Tiêm chủng", status: h.vaccines === "on_track" ? "healthy" : h.vaccines === "late" ? "coping" : "vulnerable",
    finding: { on_track: "Đủ mũi theo lịch.", late: "Có mũi đang trễ.", unsure: "Chưa nắm rõ lịch tiêm." }[h.vaccines],
    ...(h.vaccines !== "on_track" && { problem: h.vaccines === "late" ? "Có mũi tiêm đang trễ lịch." : "Chưa nắm rõ con đã tiêm những mũi nào.", fix: "Chụp lại sổ tiêm, hỏi trạm y tế hoặc bác sĩ nhi để tiêm bù theo đúng lịch; ghi ngày hẹn vào FamAgent để được nhắc trước." }) });
  else unknown("vaccines", "Sức khỏe", "Tiêm chủng");
  if (h.checkup) add({ key: "checkup", component: "Sức khỏe", label: "Theo dõi tăng trưởng", status: h.checkup === "recent" ? "healthy" : h.checkup === "year" ? "coping" : "vulnerable",
    finding: { recent: "Đo cân nặng, chiều cao trong 3 tháng gần đây.", year: "Lần đo gần nhất 3–12 tháng trước.", long: "Đã lâu hoặc không nhớ lần đo gần nhất." }[h.checkup],
    ...(h.checkup !== "recent" && { problem: "Chưa theo dõi cân nặng, chiều cao đều đặn nên khó phát hiện sớm con chậm tăng trưởng.", fix: `Cân đo ${youngest !== undefined && youngest < 12 ? "mỗi tháng" : youngest !== undefined && youngest < 36 ? "mỗi 2–3 tháng" : "mỗi 6 tháng"} và ghi vào hồ sơ con; khám sức khỏe định kỳ theo tư vấn của bác sĩ.` }) });
  else unknown("checkup", "Sức khỏe", "Theo dõi tăng trưởng");
  if (h.sleepQuality) add({ key: "sleep", component: "Sức khỏe", label: "Giấc ngủ", status: h.sleepQuality === "good" ? "healthy" : h.sleepQuality === "irregular" ? "coping" : "vulnerable",
    finding: { good: "Ngủ đủ và đều giờ.", irregular: "Ngủ đủ nhưng giờ giấc thất thường.", short: "Thường thiếu ngủ." }[h.sleepQuality],
    ...(h.sleepQuality !== "good" && { problem: h.sleepQuality === "short" ? "Con thường thiếu ngủ — ảnh hưởng tăng trưởng, tâm trạng và khả năng tập trung." : "Giờ ngủ thất thường khiến con khó vào giấc và hay quấy.", fix: `${youngest !== undefined ? `Mục tiêu cho con ${youngest < 12 ? `${youngest} tháng` : `${Math.floor(youngest / 12)} tuổi`}: ${sleepRange(youngest)} mỗi ngày (theo AASM). ` : ""}Giữ giờ đi ngủ cố định, tắt màn hình 1 giờ trước khi ngủ, nghi thức ngủ ngắn và giống nhau mỗi tối.` }) });
  else unknown("sleep", "Sức khỏe", "Giấc ngủ");

  // Adequate nutrition
  if (h.nutrition) add({ key: "nutrition", component: "Dinh dưỡng", label: "Bữa ăn đủ chất", status: h.nutrition === "varied" ? "healthy" : h.nutrition === "picky" ? "coping" : "vulnerable",
    finding: { varied: "Ăn đa dạng, đủ nhóm chất.", picky: "Còn kén ăn, ít rau hoặc đạm.", snacks: "Hay ăn vặt, đồ ngọt hoặc uống sữa thay bữa." }[h.nutrition],
    ...(h.nutrition !== "varied" && { problem: h.nutrition === "picky" ? "Con kén ăn, bữa ăn thiếu nhóm chất." : "Đồ ngọt, ăn vặt hoặc sữa đang thay bữa chính.", fix: h.nutrition === "picky" ? "Mỗi bữa có đủ 4 nhóm (bột đường, đạm, rau củ, chất béo); giới thiệu món mới 8–15 lần, không ép; cả nhà ăn cùng món." : "Giữ 3 bữa chính + 1–2 bữa phụ cố định giờ, hạn chế đồ ngọt và nước ngọt, không dùng sữa thay bữa khi con đã ăn dặm được." }) });
  else unknown("nutrition", "Dinh dưỡng", "Bữa ăn đủ chất");

  // Responsive caregiving
  if (h.playTime) add({ key: "play", component: "Chăm sóc đáp ứng", label: "Thời gian riêng với con", status: h.playTime === "gt60" ? "healthy" : h.playTime === "30to60" ? "coping" : "vulnerable",
    finding: { gt60: "Trên 1 giờ mỗi ngày chơi, trò chuyện riêng với con.", "30to60": "Khoảng 30–60 phút mỗi ngày.", lt30: "Dưới 30 phút mỗi ngày." }[h.playTime],
    ...(h.playTime !== "gt60" && { problem: "Thời gian chơi, trò chuyện riêng với con (không điện thoại) còn ít.", fix: "Đặt “15 phút của con” mỗi ngày với từng bố hoặc mẹ: cất điện thoại, để con dẫn trò chơi, lắng nghe và đáp lại. Cuối tuần thêm một hoạt động ngoài trời cả nhà." }) });
  else unknown("play", "Chăm sóc đáp ứng", "Thời gian riêng với con");

  // Opportunities for early learning
  if (h.screenTime) {
    const minutes = { none: 0, lt1h: 45, "1to2h": 90, gt2h: 150 }[h.screenTime];
    const guide = youngest !== undefined ? screenGuide(youngest) : undefined;
    const status: CareStatus = !guide ? (minutes <= 60 ? "healthy" : minutes <= 120 ? "coping" : "vulnerable") : minutes <= guide.limitMinutes ? "healthy" : minutes <= guide.limitMinutes + 60 ? "coping" : "vulnerable";
    add({ key: "screen", component: "Học sớm", label: "Thời gian màn hình", status, finding: { none: "Không xem màn hình.", lt1h: "Dưới 1 giờ mỗi ngày.", "1to2h": "1–2 giờ mỗi ngày.", gt2h: "Trên 2 giờ mỗi ngày." }[h.screenTime],
      ...(status !== "healthy" && { problem: "Thời gian màn hình vượt khuyến nghị theo tuổi của con.", fix: `${guide?.text ?? ""} Thay dần bằng đọc sách, chơi vận động; không xem khi ăn và trước giờ ngủ; bố mẹ làm gương.`.trim() }) });
  } else unknown("screen", "Học sớm", "Thời gian màn hình");
  if (h.reading) add({ key: "reading", component: "Học sớm", label: "Đọc sách, kể chuyện", status: h.reading === "daily" ? "healthy" : h.reading === "sometimes" ? "coping" : "vulnerable",
    finding: { daily: "Đọc sách hoặc kể chuyện hằng ngày.", sometimes: "Thỉnh thoảng.", rarely: "Hiếm khi." }[h.reading],
    ...(h.reading !== "daily" && { problem: "Con ít được đọc sách, kể chuyện — kênh phát triển ngôn ngữ quan trọng nhất những năm đầu.", fix: "10–15 phút đọc sách mỗi tối trước khi ngủ, để con chọn sách; hỏi con về hình ảnh, nhân vật thay vì chỉ đọc chữ." }) });
  else unknown("reading", "Học sớm", "Đọc sách, kể chuyện");

  // Security & safety
  if (h.safety?.length) {
    const done = h.safety.filter((item) => item !== "none");
    const status: CareStatus = done.length >= 3 ? "healthy" : done.length >= 1 ? "coping" : "vulnerable";
    const missing = (["stairs", "outlets", "chemicals", "vehicle"] as const).filter((item) => !done.includes(item)).map((item) => ({ stairs: "chặn cầu thang, ban công, cửa sổ", outlets: "che ổ điện, cố định tủ kệ", chemicals: "cất thuốc, hóa chất lên cao có khóa", vehicle: "mũ bảo hiểm trẻ em hoặc ghế ô tô đúng cỡ" })[item]);
    add({ key: "safety", component: "An toàn", label: "Nhà an toàn cho con", status, finding: done.length ? `Đã làm ${done.length}/4 việc an toàn chính.` : "Chưa làm việc an toàn nào.",
      ...(status !== "healthy" && { problem: "Nhà còn điểm nguy hiểm với trẻ (té ngã, điện giật, ngộ độc, tai nạn giao thông là tai nạn thường gặp nhất).", fix: `Làm trong tuần này: ${missing.join("; ")}.` }) });
  } else unknown("safety", "An toàn", "Nhà an toàn cho con");

  const known = items.filter((item) => item.status !== "unknown");
  const score = known.length >= 3 ? Math.round(known.reduce((sum, item) => sum + POINTS[item.status as keyof typeof POINTS], 0) / known.length) : undefined;
  const tier = score === undefined ? undefined : score >= 80 ? "healthy" : score >= 40 ? "coping" : "vulnerable";
  const order = ["safety", "vaccines", "nutrition", "sleep", "checkup", "screen", "play", "reading"];
  const problems = items.filter((item) => item.status === "vulnerable" || item.status === "coping")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "vulnerable" ? -1 : 1) || order.indexOf(a.key) - order.indexOf(b.key));
  return { score, tier, indicators: items, problems, youngestMonths: youngest };
}
