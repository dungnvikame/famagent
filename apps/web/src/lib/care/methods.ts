import { childAgeMonths } from "../experience/profile-mapper.ts";
import { CARE_METHODS, type FamilyProfile } from "../experience/types.ts";

/**
 * Well-known parenting approaches the family can choose from (the app suggests, the family decides). Each lists its
 * origin, the age range it is designed for, and concrete daily/weekly practices FamAgent can remind about.
 */
export type CareMethodId = (typeof CARE_METHODS)[number];
export interface CareMethod {
  id: CareMethodId;
  name: string;
  origin: string;
  idea: string;
  /** Age range (months) the method is designed for; max undefined = no upper bound. */
  ages: { min: number; max?: number; label: string };
  practices: string[];
  bestFor: string;
}

export const CARE_METHOD_LIST: CareMethod[] = [
  {
    id: "easy", name: "Nếp sinh hoạt E.A.S.Y", origin: "Tracy Hogg — sách “Secrets of the Baby Whisperer” (2001)",
    idea: "Mỗi chu kỳ trong ngày theo thứ tự Ăn (Eat) → Chơi (Activity) → Ngủ (Sleep) → thời gian cho mẹ (You), để bé dễ đoán và ngủ tốt hơn.",
    ages: { min: 0, max: 12, label: "0–12 tháng" },
    practices: ["Ghi giờ ăn, chơi, ngủ của bé trong 3 ngày để tìm nhịp tự nhiên.", "Giữ thứ tự ăn → chơi → ngủ, không cho ăn để ru ngủ.", "Kéo dài chu kỳ theo tuổi: khoảng 3 giờ cho bé dưới 4 tháng, 4 giờ khi lớn hơn."],
    bestFor: "Bé dưới 1 tuổi ngủ chập chờn, giờ giấc lộn xộn; bố mẹ muốn có thời gian nghỉ.",
  },
  {
    id: "rie", name: "Nuôi dạy tôn trọng (RIE)", origin: "Magda Gerber — Resources for Infant Educarers (1978)",
    idea: "Coi bé là một con người trọn vẹn: nói trước khi chạm vào bé, để bé chơi tự do trong không gian an toàn, quan sát nhiều hơn can thiệp.",
    ages: { min: 0, max: 24, label: "0–2 tuổi" },
    practices: ["Nói cho bé biết trước khi thay tã, bế, tắm — và chờ bé phản hồi.", "Mỗi ngày có thời gian chơi tự do trong khu vực an toàn, không hướng dẫn.", "Khi bé gặp khó, chờ vài giây xem bé tự giải quyết trước khi giúp."],
    bestFor: "Bố mẹ muốn con tự tin, tự chơi được, ít phụ thuộc vào việc được bế và dỗ.",
  },
  {
    id: "montessori", name: "Montessori tại nhà", origin: "Maria Montessori — Ý (1907)",
    idea: "Chuẩn bị môi trường vừa tầm con để con tự làm, tự chọn hoạt động và học qua đôi tay; người lớn là người hướng dẫn.",
    ages: { min: 6, max: 72, label: "6 tháng – 6 tuổi" },
    practices: ["Kệ đồ chơi thấp, ít đồ, xoay vòng mỗi tuần.", "Cho con tự làm việc vừa sức: tự ăn, tự mặc, tưới cây, dọn đồ.", "Quan sát con thích gì để chuẩn bị hoạt động tiếp theo."],
    bestFor: "Gia đình muốn con tự lập, tập trung và thích tự khám phá.",
  },
  {
    id: "positive-discipline", name: "Kỷ luật tích cực", origin: "Jane Nelsen — sách “Positive Discipline” (1981), theo tâm lý học Alfred Adler",
    idea: "Vừa tử tế vừa kiên định: không đánh mắng, không nuông chiều; dùng hệ quả hợp lý, cùng con tìm giải pháp.",
    ages: { min: 24, label: "Từ 2 tuổi" },
    practices: ["Họp gia đình 15 phút mỗi tuần: khen nhau, cùng giải quyết một vấn đề.", "Thay hình phạt bằng hệ quả liên quan, được báo trước và tôn trọng.", "Cho con lựa chọn giới hạn (“con đánh răng trước hay tắm trước?”)."],
    bestFor: "Con hay cáu, không nghe lời; bố mẹ muốn bớt la mắng mà vẫn có kỷ luật.",
  },
  {
    id: "emotion-coaching", name: "Huấn luyện cảm xúc", origin: "John Gottman — sách “Raising an Emotionally Intelligent Child” (1997)",
    idea: "5 bước khi con có cảm xúc mạnh: nhận ra → coi là cơ hội gần gũi → lắng nghe → gọi tên cảm xúc → đặt giới hạn và cùng tìm cách.",
    ages: { min: 24, label: "Từ 2 tuổi" },
    practices: ["Khi con khóc, giận: ngồi ngang tầm mắt, gọi tên cảm xúc (“con đang buồn vì…”).", "Chấp nhận mọi cảm xúc, nhưng giới hạn hành vi (“con giận được, nhưng không được đánh”).", "Mỗi tối hỏi con: hôm nay điều gì vui nhất, điều gì khó nhất?"],
    bestFor: "Con hay ăn vạ, nhạy cảm; bố mẹ muốn con hiểu và tự điều chỉnh cảm xúc.",
  },
  {
    id: "french", name: "Nuôi con kiểu Pháp", origin: "Pamela Druckerman — sách “Bringing Up Bébé” (2012)",
    idea: "Khung nếp rõ ràng (le cadre) nhưng tự do bên trong: bữa ăn cố định, con biết chờ đợi, bố mẹ vẫn có cuộc sống riêng.",
    ages: { min: 0, label: "Mọi lứa tuổi" },
    practices: ["“Khoảng dừng”: chờ vài phút trước khi bế khi bé thức đêm.", "4 bữa cố định trong ngày, không ăn vặt giữa bữa; cả nhà ăn cùng món.", "Dạy con chờ đợi và chào hỏi, giữ vài giới hạn không thương lượng."],
    bestFor: "Gia đình muốn con ăn ngủ nền nếp, biết chờ, bố mẹ bớt kiệt sức.",
  },
];

export const careMethodById = (id?: string) => CARE_METHOD_LIST.find((item) => item.id === id);

/** Children ages (months) that fall in the method's designed range. */
export function fitsAges(method: CareMethod, ages: number[]): boolean {
  return ages.length === 0 ? method.ages.min === 0 : ages.some((months) => months >= method.ages.min && (method.ages.max === undefined || months < method.ages.max));
}

/** Methods that fit the family's children and worries, with the reason — shown as tags; the family still chooses. */
export function suggestCareMethods(profile: FamilyProfile, now = new Date()): Array<{ id: CareMethodId; reason: string }> {
  const h = profile.household ?? {};
  const ages = profile.children.map((child) => childAgeMonths(child, now)).filter((value): value is number => value !== undefined);
  const youngest = ages.length ? Math.min(...ages) : h.setup === "expecting" ? 0 : undefined;
  const worries = new Set(h.careWorries ?? []);
  const out: Array<{ id: CareMethodId; reason: string }> = [];
  // Expecting families are planning for a newborn; with no age info every method is allowed.
  const fitAges = ages.length ? ages : h.setup === "expecting" ? [0] : [];
  const add = (id: CareMethodId, reason: string) => { if (!out.some((item) => item.id === id) && (!fitAges.length || fitsAges(careMethodById(id)!, fitAges))) out.push({ id, reason }); };
  if ((worries.has("sleep") || h.sleepQuality === "irregular" || h.sleepQuality === "short") && youngest !== undefined && youngest < 12) add("easy", "Con dưới 1 tuổi, giấc ngủ chưa nền nếp");
  if (worries.has("nutrition") || h.nutrition === "picky" || h.nutrition === "snacks") add("french", "Bữa ăn nền nếp, bớt kén ăn và ăn vặt");
  if (h.playTime === "lt30" || h.screenTime === "gt2h" || h.screenTime === "1to2h") add("montessori", "Thêm hoạt động tự làm, thay màn hình");
  if (worries.has("development")) add("montessori", "Bạn quan tâm đến phát triển của con");
  if (youngest !== undefined && youngest >= 24) add("emotion-coaching", "Con đang ở tuổi cảm xúc mạnh");
  if (youngest !== undefined && youngest >= 24) add("positive-discipline", "Kỷ luật không la mắng");
  if (h.setup === "expecting" || (youngest !== undefined && youngest < 12)) add("easy", "Tạo nếp ăn ngủ từ những tháng đầu");
  if (youngest !== undefined && youngest < 24) add("rie", "Giúp bé tự chơi, tự tin");
  return out.slice(0, 2);
}
