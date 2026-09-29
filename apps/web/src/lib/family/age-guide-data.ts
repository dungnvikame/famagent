/**
 * "Cẩm nang theo tuổi": practical care tips per age stage, translated and condensed from
 * - CDC "Learn the Signs. Act Early." — "Tips and activities" on each milestone page (cdc.gov/act-early/milestones,
 *   last reviewed 15/05/2026; US government work, public domain);
 * - WHO/UNICEF infant and young child feeding (exclusive breastfeeding to 6 months, complementary foods from 6 months,
 *   breastfeeding to 2 years or beyond; no added sugar, little salt);
 * - AAP safe sleep (2022) and oral health; CDC/AAP no honey before 12 months; WHO drowning prevention.
 * General guidance only; the page says so and points to the doctor.
 */
export type GuideTopic = "feed" | "sleep" | "play" | "feel" | "safe" | "care" | "parent";
export const TOPIC_LABELS: Record<GuideTopic, { label: string; icon: string }> = {
  feed: { label: "Ăn uống", icon: "🍼" },
  sleep: { label: "Giấc ngủ", icon: "😴" },
  play: { label: "Chơi & học", icon: "🧸" },
  feel: { label: "Cảm xúc & nề nếp", icon: "💛" },
  safe: { label: "An toàn", icon: "🛡️" },
  care: { label: "Sức khỏe & vệ sinh", icon: "🦷" },
  parent: { label: "Cho bố mẹ", icon: "🤍" },
};
export type GuideSource = "CDC" | "WHO" | "WHO/UNICEF" | "AAP";
export interface GuideTip { id: string; topic: GuideTopic; text: string; source: GuideSource }
export interface GuideStage { key: number; label: string; from: number; to: number; tips: GuideTip[]; prepare: string[] }

type Row = [GuideTopic, string, GuideSource?];
function stage(key: number, label: string, from: number, to: number, rows: Row[], prepare: string[]): GuideStage {
  return { key, label, from, to, prepare, tips: rows.map(([topic, text, source = "CDC"], index) => ({ id: `tip-${key}-${index + 1}`, topic, text, source })) };
}

const SAFE_SLEEP = "Đặt bé nằm ngửa ở mọi giấc ngủ, trên mặt phẳng cứng; không gối, chăn, thú bông trong nôi. Ngủ chung phòng nhưng không chung giường, ít nhất 6 tháng đầu.";

/** Stages by age in months [from, to). */
export const GUIDE_STAGES: GuideStage[] = [
  stage(2, "0–3 tháng", 0, 3, [
    ["feed", "Chỉ cho bé bú mẹ hoặc sữa công thức — chưa cần nước hay thức ăn khác trong 6 tháng đầu.", "WHO/UNICEF"],
    ["feed", "Học dấu hiệu đói (đưa tay lên miệng, quay đầu tìm vú) và dấu hiệu no (ngậm miệng, quay mặt đi)."],
    ["sleep", SAFE_SLEEP, "AAP"],
    ["sleep", "Tạo nếp ăn — ngủ đều đặn để bé dần biết điều gì sắp đến."],
    ["play", "Cho bé nằm sấp chơi khi bé thức, đặt đồ chơi ngang tầm mắt trước mặt bé."],
    ["play", "Nói chuyện, đọc và hát cho bé nghe; bắt chước tiếng bé và “trò chuyện” qua lại."],
    ["play", "Cùng bé xem tranh màu tươi hoặc hình khuôn mặt và kể về chúng."],
    ["feel", "Ôm ấp, bế bé nhiều — bé thấy an toàn và được yêu thương."],
    ["feel", "Khi bé quấy, giữ bình tĩnh: nói nhỏ, bế, đung đưa hoặc hát ru."],
    ["safe", "Không bao giờ lắc bé — và không để ai lắc bé."],
    ["safe", "Không cho bé xem màn hình (trừ gọi video với người thân)."],
    ["parent", "Chăm sóc bản thân: ngủ bù khi bé ngủ, nhờ người thân giúp. Nuôi con là việc vất vả!"],
  ], ["Khoảng 4 tháng bé cười khúc khích, hóng chuyện và cầm đồ chơi — chuẩn bị vài món dễ cầm (xúc xắc, sách vải)."]),
  stage(4, "3–5 tháng", 3, 5, [
    ["feed", "Vẫn chỉ bú mẹ hoặc sữa công thức; bé chưa sẵn sàng với thức ăn khác và nước.", "WHO/UNICEF"],
    ["sleep", SAFE_SLEEP, "AAP"],
    ["sleep", "Giữ giờ ngủ và giờ ăn ổn định mỗi ngày."],
    ["play", "Cho bé chơi trên thảm mỗi ngày để với, đạp và khám phá đồ chơi an toàn."],
    ["play", "Hạn chế để bé lâu trong xích đu, xe đẩy, ghế rung — bé cần thời gian vận động."],
    ["play", "Chơi ú òa, gọi tên bé thường xuyên; di chuyển đồ chơi màu sáng chậm qua lại cho bé nhìn theo."],
    ["play", "Cho bé ngậm, sờ đồ vật an toàn (không sắc, không nóng, không đủ nhỏ để hóc) — bé học bằng miệng."],
    ["feel", "Để ý bé thích gì, không thích gì để làm bé dễ chịu."],
    ["safe", "Không cho bé xem màn hình (trừ gọi video với người thân)."],
    ["care", "Lau nướu cho bé bằng khăn mềm sạch sau khi bú.", "AAP"],
  ], ["Bé sắp 6 tháng: hỏi bác sĩ về ăn dặm. Dấu hiệu sẵn sàng: ngồi được (có đỡ), giữ vững đầu cổ, há miệng khi đưa thìa, nuốt được thay vì đẩy ra.", "Chuẩn bị ghế ăn, thìa mềm, yếm; tìm hiểu các món dễ hóc để tránh."]),
  stage(6, "5–8 tháng", 5, 8, [
    ["feed", "Bắt đầu ăn dặm khi tròn 6 tháng, vẫn tiếp tục cho bú — sữa mẹ/sữa công thức vẫn là nguồn chính.", "WHO/UNICEF"],
    ["feed", "Đồ ăn dặm không thêm đường, hạn chế muối; không cho bé ăn mật ong trước 12 tháng.", "WHO"],
    ["feed", "Học dấu hiệu đói (chỉ vào đồ ăn, há miệng đón thìa) và no (đẩy ra, ngậm miệng, quay đi)."],
    ["sleep", SAFE_SLEEP, "AAP"],
    ["play", "Đặt đồ chơi hơi xa tầm tay để khuyến khích bé lật, trườn tới lấy."],
    ["play", "Đỡ bé ngồi, cho bé nhìn quanh và chơi đồ chơi để tập giữ thăng bằng."],
    ["play", "Chỉ và gọi tên những thứ xung quanh khi đi dạo: ô tô, cây, con vật."],
    ["play", "Khi bé làm rơi đồ, nhặt lại đưa bé — trò chơi dạy bé về nguyên nhân – kết quả."],
    ["feel", "Giúp bé tự dịu: nói nhỏ, bế, đung đưa, cho mút tay hoặc núm vú giả, ôm thú bông yêu thích."],
    ["care", "Khi mọc chiếc răng đầu tiên: chải răng 2 lần/ngày với lượng kem có fluor bằng hạt gạo.", "AAP"],
    ["safe", "Không cho bé xem màn hình (trừ gọi video với người thân)."],
  ], ["Bé sắp bò và vịn đứng: rà soát nhà — cất đồ sắc, dễ vỡ, thuốc và hóa chất; che ổ điện; chặn cầu thang."]),
  stage(9, "8–11 tháng", 8, 11, [
    ["feed", "Cho bé làm quen nhiều vị và độ thô khác nhau (nghiền, băm nhỏ); bé có thể cần thử nhiều lần mới chịu."],
    ["feed", "Cho bé tự bốc ăn và tập uống cốc với chút nước; ngồi ăn cùng bé. Đổ vãi là chuyện bình thường!"],
    ["feed", "Tìm hiểu đồ dễ hóc: nho, cà chua bi cắt nhỏ; tránh hạt nguyên, kẹo cứng."],
    ["sleep", "Bé 4–12 tháng cần ngủ 12–16 giờ/ngày kể cả giấc trưa; giữ giờ ngủ ổn định."],
    ["play", "Lặp lại âm bé bập bẹ rồi nói thành từ: bé “bababa” → mẹ “ba ba… bóng”."],
    ["play", "Dạy bé vẫy tay “bye bye”, lắc đầu “không”; chơi ú òa, trò giấu đồ dưới khăn."],
    ["play", "Chơi “đến lượt con, đến lượt mẹ” bằng cách chuyền đồ chơi qua lại."],
    ["feel", "Chào tạm biệt ngắn gọn, vui vẻ thay vì lén đi — bé biết điều gì sẽ xảy ra và học tự dịu."],
    ["feel", "Nói điều muốn bé làm thay vì cấm: “ngồi xuống nào” thay cho “đừng đứng”."],
    ["safe", "Cất khóa thuốc, hóa chất, chất tẩy rửa; lưu số cấp cứu 115 trong điện thoại."],
    ["safe", "Không bao giờ để bé một mình gần nước — kể cả chậu, xô nước trong nhà tắm.", "WHO"],
    ["parent", "Chăm sóc bản thân — bố mẹ khỏe thì mới dễ tận hưởng từng ngày con lớn."],
  ], ["Sắp 1 tuổi: có thể chuyển dần sang sữa tươi làm đồ uống chính (hỏi bác sĩ), vẫn cho bú mẹ nếu được.", "Hẹn khám răng lần đầu quanh sinh nhật 1 tuổi."]),
  stage(12, "11–14 tháng", 11, 14, [
    ["feed", "Cho bé uống nước, sữa mẹ hoặc sữa tươi không đường; không cần nước ép — nếu có, tối đa ~120 ml nước ép 100% mỗi ngày."],
    ["feed", "Tiếp tục cho bé làm quen nhiều vị, nhiều độ thô; tìm hiểu đồ dễ hóc."],
    ["sleep", "Bé cần ngủ 11–14 giờ/ngày kể cả giấc trưa; giờ ngủ đều giúp bé dễ vào giấc."],
    ["play", "Nói theo điều bé cố nói: bé “ô” → “đúng rồi, ô tô màu xanh to”."],
    ["play", "Đáp lời khi bé chỉ tay; chỉ cho bé xem xe buýt, con vật thú vị."],
    ["play", "Cho bé đẩy thùng giấy, ghế nhỏ, xe đẩy đồ chơi để tập đi; không nên dùng xe tròn tập đi."],
    ["play", "Chơi xếp khối, nồi niêu, trống nhỏ — đồ khuyến khích bé dùng tay."],
    ["feel", "Khen, ôm hôn khi bé làm điều đúng; đánh lạc hướng nhanh khi bé nghịch thứ không nên."],
    ["feel", "Cho bé thời gian làm quen người trông mới."],
    ["safe", "Không cho bé xem màn hình (trừ gọi video với người thân)."],
    ["care", "Chải răng 2 lần/ngày với kem có fluor lượng bằng hạt gạo.", "AAP"],
  ], ["Khoảng 15 tháng bé tập nói từ đầu tiên và tự bước: dành nhiều thời gian gọi tên đồ vật, để bé đi chân đất trong nhà an toàn."]),
  stage(15, "14–17 tháng", 14, 17, [
    ["feed", "Cho bé dùng cốc không nắp và tập xúc thìa; uống nước, sữa mẹ hoặc sữa tươi."],
    ["sleep", "Giờ đi ngủ êm ả, yên tĩnh và đều đặn mỗi tối."],
    ["play", "Gọi tên đồ vật bé chỉ, chờ vài giây xem bé có phát âm không rồi mới đưa."],
    ["play", "Hát kèm động tác (“Bánh xe buýt”), nhảy múa, thổi bong bóng cho bé đập."],
    ["play", "Làm “cuốn sách” ảnh người thân, thú cưng để cùng bé xem."],
    ["feel", "Cơn ăn vạ là bình thường ở tuổi này, nhất là khi bé mệt hay đói; gọi tên cảm xúc của bé."],
    ["feel", "Cho bé phụ việc nhỏ: lấy giày, bỏ tất vào giỏ; hát “bài dọn dẹp” khi cùng dọn đồ."],
    ["safe", "Rà soát nhà an toàn khi bé đi khắp nơi; không cho xem màn hình (trừ gọi video)."],
  ], ["Bé sắp 18 tháng: chuẩn bị đồ chơi đóng vai (búp bê, bộ nấu ăn) và sách tranh đơn giản."]),
  stage(18, "17–21 tháng", 17, 21, [
    ["feed", "Ngồi cùng bàn khi bé ăn bữa chính và bữa phụ để tạo nếp ăn của gia đình."],
    ["play", "Khuyến khích chơi giả vờ: đưa bé thìa để “cho gấu ăn”, thay phiên nhau đóng vai."],
    ["play", "Dạy tên bộ phận cơ thể: “Mũi con đây, mũi mẹ đây”; nói thêm vào từ bé nói."],
    ["play", "Lăn bóng qua lại, đẩy ô tô, bỏ đồ vào ra hộp cùng bé."],
    ["feel", "Chú ý khen hành vi tốt, bớt chú ý hành vi không mong muốn; cho bé chọn giữa hai thứ."],
    ["feel", "Cơn ăn vạ sẽ ngắn dần; có thể đánh lạc hướng hoặc để bé bình tĩnh rồi tiếp tục."],
    ["feel", "Nói chuyện ngang tầm mắt bé để bé “nhìn” được lời nói qua nét mặt."],
    ["care", "Đa số trẻ chỉ sẵn sàng bỏ bỉm từ 2–3 tuổi; hỏi bác sĩ trước khi tập đi vệ sinh."],
    ["safe", "Chưa cho xem màn hình (trừ gọi video); bố mẹ cũng hạn chế điện thoại khi ở cạnh bé."],
  ], ["Sau 2 tuổi có thể cho xem tối đa 1 giờ/ngày chương trình cho trẻ, có người lớn xem cùng."]),
  stage(24, "21–27 tháng", 21, 27, [
    ["feed", "Để bé tự quyết ăn nhiều hay ít: việc của bố mẹ là mời món lành mạnh, việc của bé là quyết định ăn bao nhiêu."],
    ["feed", "Cho bé phụ dọn bữa: mang cốc nhựa, khăn ăn ra bàn — và cảm ơn bé."],
    ["sleep", "Nếp trước giờ ngủ: mặc đồ ngủ, đánh răng, đọc 1–2 cuốn sách. Bé cần 11–14 giờ ngủ/ngày."],
    ["play", "Cho bé đá, lăn, ném bóng; chơi ngoài trời, công viên, xe buýt để bé tò mò khám phá."],
    ["play", "Ghép hình đơn giản, xếp tháp rồi xô đổ, vẽ bằng sáp màu hoặc màu ngón tay."],
    ["play", "Hát “Đầu, vai, đầu gối, chân” để học tên bộ phận cơ thể."],
    ["feel", "Khi chơi với bạn, bé chưa biết chia sẻ — giúp bé thay phiên và dùng lời nói."],
    ["safe", "Màn hình tối đa 1 giờ/ngày chương trình cho trẻ, có người lớn xem cùng."],
    ["care", "Hỏi bác sĩ khi nào bé sẵn sàng tập đi vệ sinh; tập quá sớm dễ làm bé căng thẳng."],
    ["care", "Chải răng 2 lần/ngày với lượng kem có fluor bằng hạt gạo (dưới 3 tuổi).", "AAP"],
  ], ["Khoảng 30 tháng bé nói khoảng 50 từ: đọc sách mỗi ngày, hỏi “Ai? Cái gì? Ở đâu?”."]),
  stage(30, "27–33 tháng", 27, 33, [
    ["feed", "Ăn bữa gia đình cùng nhau khi có thể, cả nhà ăn cùng món; cho bé chọn giữa vài món lành mạnh."],
    ["sleep", "Giữ nếp ngủ êm, yên tĩnh và đều đặn."],
    ["play", "Khuyến khích “chơi tự do” theo sở thích của bé; chơi thùng giấy làm ô tô, nhà."],
    ["play", "Dùng từ mô tả: to/nhỏ, nhanh/chậm, trong/ngoài; chơi “Chuẩn bị… đi!”, “làm theo người dẫn đầu”."],
    ["play", "Cho bé chơi với trẻ khác ở công viên, thư viện; dạy chia sẻ, chờ lượt."],
    ["feel", "Chú ý khen hành vi tốt nhiều hơn là để ý hành vi không mong muốn."],
    ["safe", "Màn hình tối đa 1 giờ/ngày, có người lớn cùng xem."],
    ["care", "Hỏi bác sĩ, cô giáo xem bé đã sẵn sàng tập đi vệ sinh chưa."],
  ], ["Bé sắp 3 tuổi: chuẩn bị cho lớp mầm non — đọc truyện, đóng vai về trường mới để bé quen dần."]),
  stage(36, "33–42 tháng", 33, 42, [
    ["feed", "Cho bé phụ nấu: rửa rau quả, khuấy; cho chọn món ăn vặt lành mạnh (“cà rốt hay táo?”)."],
    ["sleep", "Trẻ 3–5 tuổi cần 10–13 giờ ngủ/ngày; không để màn hình trong phòng ngủ."],
    ["play", "Chơi đếm: đếm ngón tay, bậc thang; trò đối lập to/nhỏ, nhanh/chậm; trò tìm đồ giống nhau."],
    ["play", "Đọc sách và hỏi “Chuyện gì đang xảy ra?”, “Con nghĩ tiếp theo sẽ thế nào?”."],
    ["play", "Cho bé nặn đất sét, tô màu, vẽ hình — giúp tay khéo để viết, cài cúc sau này."],
    ["feel", "Dạy bé gọi tên cảm xúc và cách dịu lại: hít sâu, ôm thú bông, ra góc yên tĩnh."],
    ["feel", "Đặt vài quy tắc đơn giản, rõ ràng (“tay nhẹ nhàng khi chơi”) và khen khi bé làm theo."],
    ["safe", "Màn hình tối đa 1 giờ/ngày, có người lớn cùng xem; không có màn hình trong phòng ngủ."],
    ["care", "Từ 3 tuổi: chải răng 2 lần/ngày với lượng kem có fluor bằng hạt đậu.", "AAP"],
  ], ["Bé bắt đầu hỏi “tại sao” nhiều: dành thời gian trả lời, cùng bé tìm câu trả lời trong sách."]),
  stage(48, "3,5–4,5 tuổi", 42, 54, [
    ["feed", "Ăn cùng bé, để bé thấy bố mẹ thích rau, quả, ngũ cốc nguyên hạt và uống sữa hoặc nước."],
    ["sleep", "Tránh màn hình 1–2 giờ trước giờ ngủ; bé cần 10–13 giờ ngủ/ngày."],
    ["play", "Học màu, hình, kích thước qua đồ vật hằng ngày; đếm đồ vật đơn giản."],
    ["play", "Chơi ngoài trời với bạn: đuổi bắt, trốn tìm; trò “đèn xanh đèn đỏ”, “nhảy rồi đứng hình” để tập chờ."],
    ["play", "Dùng từ “đầu tiên”, “tiếp theo”, “cuối cùng” khi kể chuyện, làm việc nhà."],
    ["feel", "Giải thích ngắn gọn vì sao không được làm gì và cho bé lựa chọn khác thay thế."],
    ["feel", "An ủi khi bé sợ và nói chuyện về nỗi sợ; giúp bé nhận ra khi làm bạn buồn và xin lỗi."],
    ["feel", "Cho bé làm việc nhà nhỏ: lấy thư, cho thú cưng ăn, lau bàn — để bé tự lập."],
    ["safe", "Màn hình tối đa 1 giờ/ngày, có người lớn cùng xem."],
  ], ["Chuẩn bị vào lớp lá: tập cho bé tự mặc đồ, tự đi vệ sinh, nói được tên mình và tên bố mẹ."]),
  stage(60, "4,5–6 tuổi", 54, 72, [
    ["feed", "Ăn bữa gia đình, cả nhà cùng món, không xem màn hình khi ăn; cho bé phụ chuẩn bị món lành mạnh."],
    ["sleep", "Nếp ngủ êm ả, tránh màn hình 1–2 giờ trước giờ ngủ; bé cần 10–13 giờ ngủ/ngày."],
    ["play", "Chơi trò có luật: cờ đơn giản, bài, “Simon nói”; trò ghi nhớ, tìm đồ."],
    ["play", "Để bé tự làm (dọn giường, cài cúc, rót nước) dù chưa hoàn hảo — và khen bé."],
    ["play", "Chơi đố vần, hát về các ngày trong tuần; dùng từ hôm qua, hôm nay, ngày mai."],
    ["feel", "Khi bé cãi lại để thử tự lập, ít chú ý lời tiêu cực và khen khi bé nói năng từ tốn."],
    ["safe", "Dạy bé về “đụng chạm an toàn” và quyền nói “không”; chỉ cho bé biết người lớn nào có thể nhờ giúp."],
    ["safe", "Dạy bé tìm “người giúp đỡ” khi bị lạc và nhớ tên đầy đủ của mình, của bố mẹ."],
    ["safe", "Đặt giới hạn màn hình tối đa 1 giờ/ngày, lập kế hoạch dùng thiết bị của cả nhà."],
  ], ["Chuẩn bị vào lớp 1: đọc truyện, đóng vai về trường mới; tập tập trung 5–10 phút vào một việc (không tính xem màn hình)."]),
];

const TIP_IDS = new Set(GUIDE_STAGES.flatMap((item) => item.tips.map((tip) => tip.id)));
export const knownTip = (id: unknown): id is string => typeof id === "string" && TIP_IDS.has(id);
export const stageFor = (ageMonths: number) => GUIDE_STAGES.find((item) => ageMonths >= item.from && ageMonths < item.to);
export const nextStage = (stageKey: number) => GUIDE_STAGES[GUIDE_STAGES.findIndex((item) => item.key === stageKey) + 1];
