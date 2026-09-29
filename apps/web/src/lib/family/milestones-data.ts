/**
 * Developmental milestones, translated to Vietnamese from:
 * - CDC "Learn the Signs. Act Early." milestone checklists (2022 revision, pages last reviewed 15/05/2026,
 *   cdc.gov/act-early/milestones) — what most children (75% or more) do by each age. US government work (public domain).
 * - WHO Motor Development Study (Acta Paediatrica 2006; 95 Suppl 450: 86–95): windows of achievement (1st–99th
 *   percentile, months) for six gross motor milestones. Items shared with a CDC line use the WHO id.
 */
export type MilestoneArea = "social" | "language" | "cognitive" | "movement";
export const AREA_LABELS: Record<MilestoneArea, { label: string; icon: string }> = {
  social: { label: "Cảm xúc & xã hội", icon: "💛" },
  language: { label: "Ngôn ngữ & giao tiếp", icon: "💬" },
  cognitive: { label: "Nhận thức", icon: "🧩" },
  movement: { label: "Vận động", icon: "🤸" },
};

export interface Milestone { id: string; area: MilestoneArea; text: string }
export interface Checkpoint { months: number; label: string; items: Milestone[] }

type Rows = Partial<Record<MilestoneArea, Array<string | [string, string]>>>;
/** Ids: "m<months>-<area letter><n>", or the WHO id given as [id, text]. */
function checkpoint(months: number, label: string, rows: Rows): Checkpoint {
  const items: Milestone[] = [];
  for (const area of Object.keys(AREA_LABELS) as MilestoneArea[]) {
    (rows[area] ?? []).forEach((row, index) => items.push(typeof row === "string" ? { id: `m${months}-${area[0]}${index + 1}`, area, text: row } : { id: row[0], area, text: row[1] }));
  }
  return { months, label, items };
}

export const CHECKPOINTS: Checkpoint[] = [
  checkpoint(2, "2 tháng", {
    social: ["Dịu lại khi được nói chuyện hoặc bế lên", "Nhìn mặt bạn", "Có vẻ vui khi thấy bạn đi tới", "Mỉm cười khi bạn nói chuyện hoặc cười với bé"],
    language: ["Phát ra âm thanh khác ngoài tiếng khóc", "Phản ứng với tiếng động lớn"],
    cognitive: ["Nhìn theo khi bạn di chuyển", "Nhìn một món đồ chơi trong vài giây"],
    movement: ["Ngẩng được đầu khi nằm sấp", "Cử động cả hai tay và hai chân", "Mở bàn tay trong chốc lát"],
  }),
  checkpoint(4, "4 tháng", {
    social: ["Tự mỉm cười để thu hút sự chú ý của bạn", "Cười khúc khích (chưa thành tiếng cười lớn) khi bạn chọc cười", "Nhìn, cử động hoặc phát ra âm thanh để giữ sự chú ý của bạn"],
    language: ["Phát ra âm “ô ô”, “a a” (hóng chuyện)", "Đáp lại bằng âm thanh khi bạn nói chuyện với bé", "Quay đầu về phía giọng nói của bạn"],
    cognitive: ["Khi đói, há miệng khi thấy vú mẹ hoặc bình sữa", "Nhìn bàn tay mình một cách thích thú"],
    movement: ["Giữ đầu vững không cần đỡ khi được bế", "Nắm món đồ chơi khi bạn đặt vào tay", "Vung tay đánh vào đồ chơi", "Đưa tay lên miệng", "Chống khuỷu tay/cẳng tay nâng người khi nằm sấp"],
  }),
  checkpoint(6, "6 tháng", {
    social: ["Nhận ra người quen", "Thích nhìn mình trong gương", "Cười thành tiếng"],
    language: ["Thay phiên “nói chuyện” bằng âm thanh với bạn", "Thè lưỡi thổi phì phì (“raspberry”)", "Ré lên thích thú"],
    cognitive: ["Cho đồ vào miệng để khám phá", "Với tay lấy món đồ chơi bé muốn", "Mím môi khi không muốn ăn thêm"],
    movement: ["Lật từ sấp sang ngửa", "Chống thẳng tay nâng người khi nằm sấp", "Chống tay đỡ người khi ngồi"],
  }),
  checkpoint(9, "9 tháng", {
    social: ["Ngại, bám người hoặc sợ người lạ", "Có nhiều nét mặt: vui, buồn, giận, ngạc nhiên", "Nhìn lại khi được gọi tên", "Phản ứng khi bạn rời đi (nhìn theo, với theo hoặc khóc)", "Cười khi chơi ú òa"],
    language: ["Bập bẹ nhiều âm khác nhau như “mamama”, “bababa”", "Giơ tay đòi bế"],
    cognitive: ["Tìm đồ vật khi bị rơi khỏi tầm mắt (thìa, đồ chơi)", "Đập hai món đồ vào nhau"],
    movement: ["Tự ngồi dậy được", "Chuyển đồ từ tay này sang tay kia", "Dùng các ngón tay “cào” thức ăn về phía mình", ["who-sit", "Ngồi vững không cần đỡ"]],
  }),
  checkpoint(12, "1 tuổi", {
    social: ["Chơi trò chơi với bạn, như vỗ tay"],
    language: ["Vẫy tay “bye bye”", "Gọi bố mẹ là “ba”, “mẹ” hoặc một tên riêng", "Hiểu chữ “không” (dừng lại khi bạn nói)"],
    cognitive: ["Bỏ đồ vào hộp, như khối gỗ vào cốc", "Tìm đồ vật bé thấy bạn giấu, như đồ chơi dưới chăn"],
    movement: [["who-stand-assist", "Vịn để đứng lên"], ["who-walk-assist", "Vịn đồ đạc để đi"], "Uống bằng cốc không nắp khi bạn cầm giúp", "Nhặt đồ nhỏ bằng ngón cái và ngón trỏ, như mẩu thức ăn"],
  }),
  checkpoint(15, "15 tháng", {
    social: ["Bắt chước trẻ khác khi chơi, như lấy đồ chơi ra khỏi hộp khi bạn khác làm", "Đưa cho bạn xem món đồ bé thích", "Vỗ tay khi phấn khích", "Ôm búp bê hoặc thú bông", "Thể hiện tình cảm với bạn (ôm, rúc, hôn)"],
    language: ["Cố nói một hai từ ngoài “ba”, “mẹ”, như “bóng”, “chó”", "Nhìn về món đồ quen khi bạn gọi tên", "Làm theo lời dặn có kèm cử chỉ, như đưa đồ chơi khi bạn chìa tay và nói “Đưa mẹ nào”", "Chỉ tay để đòi hoặc nhờ giúp"],
    cognitive: ["Thử dùng đồ vật đúng cách, như điện thoại, cốc, sách", "Chồng được ít nhất hai món nhỏ, như khối gỗ"],
    movement: ["Tự bước vài bước", "Dùng ngón tay bốc một ít thức ăn tự ăn"],
  }),
  checkpoint(18, "18 tháng", {
    social: ["Đi ra xa bạn nhưng quay lại nhìn để chắc bạn ở gần", "Chỉ cho bạn xem thứ gì đó thú vị", "Chìa tay ra cho bạn rửa", "Cùng bạn xem vài trang sách", "Giúp bạn mặc đồ bằng cách xỏ tay vào ống tay hoặc nhấc chân"],
    language: ["Cố nói ba từ trở lên ngoài “ba”, “mẹ”", "Làm theo lời dặn một bước không cần cử chỉ, như đưa đồ chơi khi bạn nói “Đưa mẹ nào”"],
    cognitive: ["Bắt chước bạn làm việc nhà, như quét nhà", "Chơi đồ chơi theo cách đơn giản, như đẩy ô tô"],
    movement: [["who-walk-alone", "Tự đi không cần vịn ai hay vật gì"], "Vẽ nguệch ngoạc", "Uống bằng cốc không nắp, đôi khi làm đổ", "Bốc thức ăn tự ăn", "Tập dùng thìa", "Tự trèo lên, xuống ghế sofa hoặc ghế"],
  }),
  checkpoint(24, "2 tuổi", {
    social: ["Nhận ra khi người khác đau hoặc buồn, như khựng lại hay buồn khi ai đó khóc", "Nhìn mặt bạn để biết nên phản ứng thế nào trong tình huống mới"],
    language: ["Chỉ vào hình trong sách khi bạn hỏi, như “Con gấu đâu?”", "Nói ít nhất hai từ ghép lại, như “Thêm sữa”", "Chỉ ít nhất hai bộ phận cơ thể khi bạn hỏi", "Dùng nhiều cử chỉ hơn vẫy tay và chỉ, như hôn gió, gật đầu"],
    cognitive: ["Cầm đồ bằng một tay, tay kia làm việc khác, như cầm hộp và mở nắp", "Thử bấm công tắc, vặn núm hoặc nút trên đồ chơi", "Chơi nhiều đồ chơi cùng lúc, như đặt đồ ăn đồ chơi lên đĩa"],
    movement: ["Đá bóng", "Chạy", "Đi (không bò) lên vài bậc thang, có hoặc không cần giúp", "Ăn bằng thìa"],
  }),
  checkpoint(30, "30 tháng", {
    social: ["Chơi cạnh trẻ khác và đôi khi chơi cùng", "Khoe việc mình làm được: “Nhìn con này!”", "Làm theo nếp đơn giản khi được nhắc, như cùng dọn đồ chơi khi nghe “Đến giờ dọn dẹp rồi”"],
    language: ["Nói khoảng 50 từ", "Nói hai từ trở lên có một động từ, như “Chó chạy”", "Gọi tên đồ vật trong sách khi bạn chỉ và hỏi “Cái gì đây?”", "Dùng từ như “con”, “mình”, “chúng mình”"],
    cognitive: ["Dùng đồ vật để giả vờ, như cho búp bê “ăn” khối gỗ", "Biết giải quyết vấn đề đơn giản, như đứng lên ghế nhỏ để lấy đồ", "Làm theo lời dặn hai bước, như “Để đồ chơi xuống rồi đóng cửa”", "Biết ít nhất một màu, như chỉ vào bút màu đỏ khi hỏi “Màu đỏ đâu?”"],
    movement: ["Dùng tay vặn đồ vật, như xoay nắm cửa, vặn nắp", "Tự cởi vài món đồ, như quần rộng hoặc áo khoác đang mở", "Bật nhảy khỏi mặt đất bằng hai chân", "Tự lật từng trang sách khi bạn đọc"],
  }),
  checkpoint(36, "3 tuổi", {
    social: ["Bình tĩnh lại trong vòng 10 phút sau khi bạn rời đi, như lúc gửi trẻ", "Để ý trẻ khác và tham gia chơi cùng"],
    language: ["Trò chuyện qua lại với bạn ít nhất hai lượt", "Hỏi “ai”, “cái gì”, “ở đâu”, “tại sao”, như “Mẹ đâu rồi?”", "Nói hành động trong tranh hoặc sách khi được hỏi, như “chạy”, “ăn”, “chơi”", "Nói tên mình khi được hỏi", "Nói đủ rõ để người khác hiểu phần lớn thời gian"],
    cognitive: ["Vẽ vòng tròn khi bạn làm mẫu", "Tránh chạm vào đồ nóng như bếp khi bạn dặn"],
    movement: ["Xâu đồ vật thành chuỗi, như hạt to hoặc nui", "Tự mặc vài món đồ, như quần rộng hoặc áo khoác", "Dùng nĩa"],
  }),
  checkpoint(48, "4 tuổi", {
    social: ["Đóng vai khi chơi (cô giáo, siêu nhân, chó con)", "Đòi đi chơi với bạn khi không có ai, như “Con sang chơi với An được không?”", "An ủi người đang đau hoặc buồn, như ôm bạn đang khóc", "Tránh nguy hiểm, như không nhảy từ chỗ cao ở sân chơi", "Thích làm “người giúp việc”", "Thay đổi cách cư xử theo nơi chốn (chùa, thư viện, sân chơi)"],
    language: ["Nói câu có từ bốn từ trở lên", "Nói được vài từ trong bài hát, câu chuyện hoặc bài đồng dao", "Kể ít nhất một việc đã xảy ra trong ngày, như “Con đá bóng”", "Trả lời câu hỏi đơn giản như “Áo khoác để làm gì?”"],
    cognitive: ["Gọi tên vài màu của đồ vật", "Nói được chuyện gì xảy ra tiếp theo trong câu chuyện quen", "Vẽ người có ba bộ phận trở lên"],
    movement: ["Bắt được bóng to phần lớn thời gian", "Tự xúc đồ ăn hoặc rót nước, có người lớn trông", "Tự cởi vài cúc áo", "Cầm bút bằng ngón tay và ngón cái (không nắm cả bàn tay)"],
  }),
  checkpoint(60, "5 tuổi", {
    social: ["Tuân theo luật hoặc chờ lượt khi chơi với trẻ khác", "Hát, nhảy hoặc diễn cho bạn xem", "Làm việc nhà đơn giản, như ghép đôi tất, dọn bàn sau bữa ăn"],
    language: ["Kể câu chuyện nghe được hoặc tự nghĩ ra có ít nhất hai sự việc", "Trả lời câu hỏi đơn giản về cuốn sách hoặc câu chuyện vừa nghe", "Duy trì cuộc trò chuyện hơn ba lượt qua lại", "Dùng hoặc nhận ra vần đơn giản"],
    cognitive: ["Đếm đến 10", "Đọc tên vài số từ 1 đến 5 khi bạn chỉ", "Dùng từ chỉ thời gian như “hôm qua”, “ngày mai”, “buổi sáng”, “buổi tối”", "Tập trung 5–10 phút vào một hoạt động, như nghe kể chuyện, làm đồ thủ công (không tính xem màn hình)", "Viết được vài chữ cái trong tên mình", "Đọc tên vài chữ cái khi bạn chỉ"],
    movement: ["Tự cài vài cúc áo", "Nhảy lò cò một chân"],
  }),
];

/** WHO windows of achievement (months, 1st–99th percentile), in the order most children reach them. */
export interface MotorWindow { id: string; text: string; from: number; to: number }
export const WHO_MOTOR: MotorWindow[] = [
  { id: "who-sit", text: "Ngồi không cần đỡ", from: 3.8, to: 9.2 },
  { id: "who-stand-assist", text: "Vịn để đứng", from: 4.8, to: 11.4 },
  { id: "who-crawl", text: "Bò bằng tay và đầu gối", from: 5.2, to: 13.5 },
  { id: "who-walk-assist", text: "Vịn để đi", from: 5.9, to: 13.7 },
  { id: "who-stand-alone", text: "Tự đứng một mình", from: 6.9, to: 16.9 },
  { id: "who-walk-alone", text: "Tự đi một mình", from: 8.2, to: 17.6 },
];
