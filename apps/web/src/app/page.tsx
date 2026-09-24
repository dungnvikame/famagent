import Link from "next/link";
import { IconCheck, IconPencil, IconRuler, IconShield, IconSparkle, IconWallet } from "@/components/onboarding/icons";
import { AFFILIATE_DISCLOSURE } from "@/lib/catalog/format";

export const metadata = {
  title: "FamAgent | Trợ lý riêng cho gia đình bạn: tiền, mua sắm, chăm con",
  description: "FamAgent nhớ mọi điều về nhà bạn — con nặng bao nhiêu, ngân sách bao nhiêu, bé hợp hãng nào — rồi trả lời những câu hỏi hằng ngày: tháng này còn tiêu được bao nhiêu, bỉm còn mấy ngày, nên mua loại nào.",
};

/** Why a family needs its own assistant instead of a spending app or a generic chatbot — one concrete scene each. */
const WHY = [
  { title: "App ghi chi tiêu chỉ cộng số", text: "Nó thấy “350.000đ – Mua sắm”. Nó không biết đó là gói bỉm size L cho bé 11 kg, mua lần thứ hai trong tháng — và vì thế không nói được cho bạn: “Em bé tăng 620K vì mua bỉm hai lần, bé đang dùng nhiều hơn.”" },
  { title: "Hỏi Google hay ChatGPT thì nhận câu trả lời chung", text: "“Bỉm nào tốt?” → một bài dài cho mọi người. FamAgent trả lời cho đúng bé nhà bạn: 11 kg, da nhạy cảm, hay tràn ban đêm, ngân sách 400K, và đã từng bị hăm với hãng X nên bỏ hãng đó ra." },
  { title: "Việc nhà phần lớn là việc phải nhớ", text: "Bỉm còn mấy ngày, tiền Internet 26 hằng tháng, con sắp lên size, tháng này tiêu quá tay chưa. Không ai muốn nhớ hết. FamAgent nhớ thay, và nhắc trước khi bạn kịp quên." },
];

/** What it does every day, with the exact thing the family types and gets back. */
const DAILY = [
  {
    icon: <IconWallet />, title: "Tiền: biết còn bao nhiêu trước khi tiêu",
    text: "Ghi khoản chi như ghi vào Excel — “Ăn sáng 30k”, “Tiền điện 974k”. Khoản cố định (tiền nhà, Internet, lương) tự ghi khi tới ngày. Đặt kế hoạch chi cho tháng, FamAgent so nhịp chi và báo sớm.",
    example: { badge: "Bạn hỏi", ask: "Tháng này nhà mình tiêu thế nào?", answer: "Đã chi 10,7M / kế hoạch 12M. Với nhịp này cuối tháng sẽ chi ~13,4M, cao hơn kế hoạch 11%. Vượt ngân sách: Con (+225K). Internet 450K đến hạn sau 2 ngày." },
  },
  {
    icon: <IconRuler />, title: "Mua sắm: chọn đúng cho bé, không phải lướt 50 tab",
    text: "Hỏi như đang nhắn tin. FamAgent lọc theo cân nặng, size, da của bé và ngân sách; loại ngay thứ không hợp; so giá theo từng miếng; nói rõ vì sao nên chọn. Bấm “Đã mua” là khoản chi vào sổ và FamAgent bắt đầu đếm ngày hết.",
    example: { badge: "Bạn hỏi", ask: "Bỉm ban đêm cho Gold dưới 400k", answer: "3 loại hợp 11 kg, size L, trong 400K. Phù hợp nhất: Dòng Êm Đêm L56 – 379K (6.768đ/miếng). Mình bỏ Nhãn A vì bạn từng ghi nhận bé bị hăm. Khoản 379K này vượt ngân sách Con còn lại tháng này." },
  },
  {
    icon: <IconSparkle />, title: "Chăm sóc gia đình: nhớ những gì bạn kể",
    text: "Bé mấy tháng, nặng bao nhiêu, hợp hãng nào, hay bị gì, nhà quen mua ở đâu — bạn kể một lần trong lúc trò chuyện, FamAgent ghi lại (có nhãn “Ghi nhận” để bạn kiểm tra) và dùng cho mọi lần sau. Lịch tiêm, việc nhà, bữa ăn sẽ đến tiếp.",
    example: { badge: "Bạn kể", ask: "Gold bị hăm khi dùng hãng X", answer: "Ghi nhận: Bé Gold bị hăm khi dùng hãng X. Lần tư vấn sau mình sẽ tự tránh hãng này; bạn xem hoặc xóa ghi chú ở mục Gia đình." },
  },
];

const STEPS = [
  { title: "Kể về nhà mình — 1 phút", text: "Chạm chọn: mấy người lớn, bé mấy tháng, nặng khoảng bao nhiêu, ngân sách quen dùng. Không phải gõ, bỏ qua câu nào cũng được." },
  { title: "Đăng nhập Google để giữ dữ liệu", text: "Một chạm. Hồ sơ, sổ thu chi và ghi chú theo bạn trên điện thoại lẫn máy tính." },
  { title: "Dùng như một người trong nhà", text: "Ghi vài khoản chi, hỏi vài câu về bỉm, bấm “Đã mua” khi mua. Từ tuần thứ hai, Trang chủ bắt đầu nói cho bạn việc cần làm trước khi bạn nhớ ra." },
];

const TRUST = [
  { icon: <IconShield />, title: "Tên con không rời khỏi nhà bạn", text: "Trước khi gửi câu hỏi tới AI, tên bé được thay bằng mã. Bạn có thể tắt AI hoàn toàn — FamAgent vẫn chạy bằng quy tắc." },
  { icon: <IconWallet />, title: "Số liệu tiền chỉ để tính cho bạn", text: "Sổ thu chi nằm trong tài khoản của bạn, không dùng để quảng cáo. Xóa toàn bộ dữ liệu bằng một nút ở mục Gia đình." },
  { icon: <IconCheck />, title: "Gợi ý không bị hoa hồng chi phối", text: "FamAgent có thể nhận hoa hồng khi bạn mua qua một số liên kết, nhưng thứ tự gợi ý chỉ theo mức phù hợp với bé và ngân sách." },
  { icon: <IconRuler />, title: "Luôn nói “vì sao” và “dữ liệu từ đâu”", text: "Mỗi lời khuyên kèm con số nguồn: từ bao nhiêu giao dịch, lần mua ngày nào, giá cập nhật lúc nào. Giá quá 48 giờ chưa xác minh sẽ ẩn nút mua." },
];

const CATEGORIES = [
  { name: "Sổ thu chi, ngân sách theo nhóm, khoản định kỳ, mục tiêu tiết kiệm", live: true },
  { name: "Tư vấn & so sánh bỉm cho bé", live: true },
  { name: "Theo dõi đồ tiêu hao: còn mấy ngày, nhắc mua lại", live: true },
  { name: "Ghi nhớ về bé và gia đình từ hội thoại", live: true },
  { name: "Sữa, khăn ướt, nước giặt", live: false },
  { name: "Lịch tiêm, việc nhà, bữa ăn & đi chợ", live: false },
  { name: "Dùng chung với vợ/chồng", live: false },
];

const FAQ = [
  { q: "Tôi có phải nhập lại chi tiêu cũ không?", a: "Không. Bắt đầu từ hôm nay là đủ; nhập số dư đầu kỳ nếu muốn thấy số dư đúng. Khoản cố định (tiền nhà, Internet, lương) chỉ đặt một lần, tới ngày tự ghi." },
  { q: "“Bỉm còn mấy ngày” tính kiểu gì?", a: "Từ số miếng bạn mua và mức dùng mỗi ngày — mặc định theo tuổi bé (ví dụ 6–12 tháng: 6 miếng/ngày), bạn sửa được. Mua thêm thì cộng dồn. Đây là ước tính để nhắc sớm, không phải con số chính xác." },
  { q: "Tôi không muốn dùng AI thì sao?", a: "Tắt ở mục Gia đình → Tài khoản. FamAgent vẫn lọc sản phẩm, tính tiền và nhắc việc bằng quy tắc; chỉ phần hiểu câu hỏi tự nhiên và tóm tắt sẽ ngắn hơn." },
  { q: "Vợ/chồng tôi dùng chung được không?", a: "Hiện một tài khoản là một gia đình, dùng được trên nhiều thiết bị. Mời thành viên khác vào cùng gia đình sẽ có trong bản tiếp theo." },
  { q: "FamAgent có mất phí không? Kiếm tiền từ đâu?", a: "Bản đầu miễn phí. Sau này có gói trả phí theo hộ gia đình với tính năng nâng cao; ngoài ra có thể nhận hoa hồng khi bạn mua qua liên kết — không ảnh hưởng thứ tự gợi ý." },
];

/** Landing (signed-out): purpose first — a personal assistant for one family's money, shopping and care — then proof, then one action. */
export default function Home() {
  return <div className="lp">
    <section className="lp-hero container">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow"><IconSparkle size={16} /> Trợ lý riêng cho gia đình bạn</p>
        <h1>Một trợ lý hiểu riêng nhà mình — <span>lo tiền, lo mua sắm, lo chăm con.</span></h1>
        <p className="lp-lead">Mỗi nhà một kiểu: con mấy tháng, nặng bao nhiêu, tháng tiêu bao nhiêu là vừa, bé hợp hãng nào, hay mua ở đâu. FamAgent ghi nhớ những điều đó về <em>nhà bạn</em>, rồi dùng chúng để trả lời câu hỏi mỗi ngày: <b>tháng này còn tiêu được bao nhiêu? bỉm còn đủ mấy ngày? nên mua loại nào cho bé?</b> — và nhắc bạn trước khi quên.</p>
        <div className="lp-actions">
          <Link className="lp-cta" href="/onboarding">Tạo trợ lý cho nhà mình — 1 phút <span aria-hidden="true">→</span></Link>
          <a className="lp-ghost" href="#vi-sao">Vì sao cần trợ lý riêng?</a>
        </div>
        <ul className="lp-assure"><li><IconCheck size={15} /> Miễn phí</li><li><IconCheck size={15} /> Đăng nhập bằng Gmail, một chạm</li><li><IconCheck size={15} /> Xóa toàn bộ dữ liệu bất cứ lúc nào</li></ul>
      </div>
      <div className="lp-demo" aria-label="Minh họa Trang chủ của một gia đình">
        <span className="lp-demo-tag">Minh họa</span>
        <div className="lp-demo-top"><span className="ob-orb" aria-hidden="true" /><b>Trang chủ nhà Gold · Thứ Tư 24/9</b><span className="lp-chip">3 việc cần chú ý</span></div>
        <div className="lp-mini-cards">
          <div className="lp-mini"><span className="lp-mini-badge">Sắp hết</span><b>Bỉm Merries L64 còn ~4 ngày</b><small>Mua 12/09, 64 miếng · bé dùng ~6 miếng/ngày</small><strong>Mua lại <em>giá hôm nay thấp hơn 18K</em></strong></div>
          <div className="lp-mini"><span className="lp-mini-badge soft">Tiền</span><b>Chi tháng này cao hơn kế hoạch 7%</b><small>Ăn ngoài +700K · Em bé +620K (bỉm mua 2 lần)</small><strong>Xem vì sao <em>18,2M / 25M</em></strong></div>
        </div>
        <p className="lp-bubble me">Tháng này nhà mình tiêu thế nào?</p>
        <div className="lp-bubble ai"><span className="ob-orb" aria-hidden="true" /><p>Đã chi 18,2M, cao hơn nhịp tháng trước 9%. Hai nhóm tăng mạnh: Ăn uống và Em bé — Em bé tăng vì mua bỉm hai lần. Bạn muốn xem nguyên nhân hay tối ưu phần còn lại của tháng?</p></div>
      </div>
    </section>

    <section className="lp-section container" id="vi-sao">
      <p className="lp-eyebrow center">Vì sao cần một trợ lý riêng</p>
      <h2>Vì nhà bạn không giống nhà nào khác</h2>
      <div className="lp-trust three">{WHY.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">FamAgent giúp gì mỗi ngày</p>
      <h2>Ba việc lo nhất trong nhà, một chỗ để hỏi</h2>
      <div className="lp-daily">{DAILY.map((item) => <article key={item.title}>
        <span className="lp-trust-icon">{item.icon}</span>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
        <div className="lp-example"><span className="lp-mini-badge soft">{item.example.badge}</span><p className="lp-bubble me">{item.example.ask}</p><div className="lp-bubble ai"><span className="ob-orb" aria-hidden="true" /><p>{item.example.answer}</p></div></div>
      </article>)}</div>
    </section>

    <section className="lp-section container" id="cach-hoat-dong">
      <p className="lp-eyebrow center">Bắt đầu thế nào</p>
      <h2>Ba bước, không cần nhập lại quá khứ</h2>
      <ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title}><span className="lp-step-no">{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">Điều bạn cần biết trước khi giao dữ liệu nhà mình</p>
      <h2>Trợ lý của gia đình bạn, đứng về phía gia đình bạn</h2>
      <div className="lp-trust">{TRUST.map((item) => <article key={item.title}><span className="lp-trust-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">Đang có gì</p>
      <h2>Bắt đầu với tiền và bỉm, mở rộng dần cho cả nhà</h2>
      <ul className="lp-cats">{CATEGORIES.map((category) => <li key={category.name} className={category.live ? "live" : ""}>{category.name}<span>{category.live ? "Đang có" : "Sắp có"}</span></li>)}</ul>
    </section>

    <section className="lp-section container lp-faq-wrap">
      <h2>Câu hỏi thường gặp</h2>
      <div className="lp-faq">{FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </section>

    <section className="lp-final container">
      <span className="ob-orb ob-orb-lg" aria-hidden="true" />
      <h2>Bớt một việc phải nhớ, từ hôm nay</h2>
      <p>Kể về nhà mình trong 1 phút, đăng nhập Gmail, rồi ghi khoản chi đầu tiên hoặc hỏi về bỉm cho bé. Phần còn lại FamAgent nhớ giúp.</p>
      <Link className="lp-cta" href="/onboarding">Tạo trợ lý cho nhà mình <span aria-hidden="true">→</span></Link>
      <p className="lp-fine"><IconPencil size={14} /> {AFFILIATE_DISCLOSURE}</p>
    </section>
  </div>;
}
