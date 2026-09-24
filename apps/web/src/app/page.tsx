import Link from "next/link";
import { IconCheck, IconPencil, IconRuler, IconShield, IconSparkle, IconWallet } from "@/components/onboarding/icons";
import { AFFILIATE_DISCLOSURE } from "@/lib/catalog/format";

export const metadata = {
  title: "FamAgent | Gia đình vận hành nhẹ nhàng hơn",
  description: "FamAgent nhớ, theo dõi và nhắc việc cho gia đình: tiền tháng này đi đâu, bỉm còn mấy ngày, hóa đơn nào sắp đến hạn — rồi gợi ý việc nên làm.",
};

const STEPS = [
  { title: "Kể về nhà mình trong 1 phút", text: "Chạm chọn vài câu: mấy người lớn, bé bao nhiêu kg, ngân sách quen dùng. Không cần gõ dài." },
  { title: "Ghi một lần, nhiều nơi cập nhật", text: "Bấm “Đã mua” một gói bỉm: khoản chi vào sổ Tiền, tồn kho được ước tính, Trang chủ nhắc khi sắp hết." },
  { title: "Mở app là thấy việc cần làm", text: "Không phải chatbot: Trang chủ nói tiền đi đâu, món gì sắp hết, hóa đơn nào đến hạn — mỗi việc một nút." },
];
const TRUST = [
  { icon: <IconWallet />, title: "Tiền: 5 câu hỏi, không phải 20 biểu đồ", text: "Nhà có bao nhiêu, đi đâu, có gì bất thường, tương lai thế nào, nên làm gì — ghi như Excel, đọc như một lời khuyên." },
  { icon: <IconRuler />, title: "Mua sắm lọc đúng trước, gợi ý sau", text: "Sản phẩm sai cân nặng, sai size hay vượt ngân sách bị loại ngay; giá so theo từng miếng, có thời điểm cập nhật." },
  { icon: <IconCheck />, title: "Nhớ điều bạn kể", text: "“Bé bị hăm với hãng X” được ghi nhận và tự tránh ở lần tư vấn sau. Bạn xem, xác nhận hoặc xóa từng ghi chú." },
  { icon: <IconShield />, title: "Dữ liệu là của gia đình bạn", text: "Tên bé được thay bằng mã trước khi tới AI; hoa hồng không đổi thứ tự gợi ý; xóa toàn bộ dữ liệu bất cứ lúc nào." },
];
const CATEGORIES = [
  { name: "Tiền: sổ thu chi, ngân sách, định kỳ", live: true }, { name: "Mua sắm: bỉm cho bé", live: true }, { name: "Theo dõi đồ tiêu hao", live: true },
  { name: "Sữa, khăn ướt, nước giặt", live: false }, { name: "Lịch & việc nhà", live: false }, { name: "Bữa ăn & đi chợ", live: false },
];
const FAQ = [
  { q: "FamAgent có mất phí không?", a: "Bản alpha miễn phí. Đăng nhập bằng Google để hồ sơ và sổ thu chi theo bạn trên mọi thiết bị." },
  { q: "Thông tin về gia đình và tiền được dùng thế nào?", a: "Chỉ để tính toán và gợi ý cho chính bạn. Tên bé được thay bằng mã trước khi gửi tới nhà cung cấp AI (khi bạn bật). Bạn xóa được toàn bộ dữ liệu ở mục Gia đình." },
  { q: "Có cần nhập lại sổ thu chi từ Excel không?", a: "Ghi tay từng khoản như Excel (ngày · nội dung · nhóm · số tiền); khoản định kỳ tự ghi khi tới ngày; lần mua từ Mua sắm tự vào sổ. Nhập file sẽ có sau." },
  { q: "FamAgent kiếm tiền từ đâu?", a: "Có thể nhận hoa hồng khi bạn mua qua một số liên kết. Điều này không ảnh hưởng thứ tự đề xuất." },
];

/** Landing: what FamAgent is and why to trust it, then one clear action → tap-to-answer onboarding. */
export default function Home() {
  return <div className="lp">
    <section className="lp-hero container">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow"><IconSparkle size={16} /> Hệ điều hành AI cho đời sống gia đình</p>
        <h1>Gia đình vận hành <span>nhẹ nhàng hơn.</span></h1>
        <p className="lp-lead">FamAgent nhớ, theo dõi và nhắc những việc dễ quên trong nhà — tiền tháng này đi đâu, bỉm còn mấy ngày, hóa đơn nào sắp đến hạn — rồi gợi ý việc nên làm, có lý do rõ ràng.</p>
        <div className="lp-actions">
          <Link className="lp-cta" href="/onboarding">Bắt đầu miễn phí — 1 phút <span aria-hidden="true">→</span></Link>
          <a className="lp-ghost" href="#cach-hoat-dong">Xem cách hoạt động</a>
        </div>
        <ul className="lp-assure"><li><IconCheck size={15} /> Miễn phí</li><li><IconCheck size={15} /> Đăng nhập Google một chạm</li><li><IconCheck size={15} /> Dữ liệu của bạn, xóa được bất cứ lúc nào</li></ul>
      </div>
      <div className="lp-demo" aria-label="Minh họa một cuộc trò chuyện">
        <span className="lp-demo-tag">Minh họa</span>
        <div className="lp-demo-top"><span className="ob-orb" aria-hidden="true" /><b>Trang chủ · Thứ Tư 24/9</b><span className="lp-chip">3 việc cần chú ý</span></div>
        <div className="lp-mini-cards">
          <div className="lp-mini"><span className="lp-mini-badge">Sắp hết</span><b>Bỉm Merries L64 còn ~4 ngày</b><small>Ước tính từ lần mua 12/09 · 6 miếng/ngày</small><strong>Mua lại <em>giá hiện thấp hơn 18K</em></strong></div>
          <div className="lp-mini"><span className="lp-mini-badge soft">Tiền</span><b>Chi tháng này cao hơn kế hoạch 7%</b><small>Ăn ngoài +700K · Em bé +620K (mua bỉm 2 lần)</small><strong>Xem vì sao <em>18,2M / 25M</em></strong></div>
        </div>
        <p className="lp-bubble me">Tháng này nhà mình tiêu thế nào?</p>
        <div className="lp-bubble ai"><span className="ob-orb" aria-hidden="true" /><p>Đã chi 18,2M, cao hơn nhịp tháng trước 9%. Hai nhóm tăng mạnh: Ăn uống và Em bé — Em bé tăng vì mua bỉm hai lần. Bạn muốn xem nguyên nhân hay tối ưu phần còn lại?</p></div>
      </div>
    </section>

    <section className="lp-section container" id="cach-hoat-dong">
      <p className="lp-eyebrow center">Cách hoạt động</p>
      <h2>Ba bước để bớt phải nhớ</h2>
      <ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title}><span className="lp-step-no">{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">Vì sao tin được</p>
      <h2>Một lớp thông minh chung cho cả nhà</h2>
      <div className="lp-trust">{TRUST.map((item) => <article key={item.title}><span className="lp-trust-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">Đang có gì</p>
      <h2>Bắt đầu với Tiền và Mua sắm, mở rộng cho cả nhà</h2>
      <ul className="lp-cats">{CATEGORIES.map((category) => <li key={category.name} className={category.live ? "live" : ""}>{category.name}<span>{category.live ? "Đang có" : "Sắp có"}</span></li>)}</ul>
    </section>

    <section className="lp-section container lp-faq-wrap">
      <h2>Câu hỏi thường gặp</h2>
      <div className="lp-faq">{FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </section>

    <section className="lp-final container">
      <span className="ob-orb ob-orb-lg" aria-hidden="true" />
      <h2>Để FamAgent nhớ giúp gia đình bạn</h2>
      <p>Chạm chọn vài câu về nhà mình — khoảng 1 phút — rồi đăng nhập Google để giữ dữ liệu. Bạn có thể bỏ qua bất kỳ câu nào.</p>
      <Link className="lp-cta" href="/onboarding">Bắt đầu ngay <span aria-hidden="true">→</span></Link>
      <p className="lp-fine"><IconPencil size={14} /> {AFFILIATE_DISCLOSURE}</p>
    </section>
  </div>;
}
