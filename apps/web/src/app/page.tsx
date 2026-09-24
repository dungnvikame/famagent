import Link from "next/link";
import { IconCheck, IconPencil, IconRuler, IconShield, IconSparkle, IconWallet } from "@/components/onboarding/icons";
import { AFFILIATE_DISCLOSURE } from "@/lib/catalog/format";

export const metadata = {
  title: "FamAgent | Trợ lý mua sắm AI cho gia đình",
  description: "Kể vài điều về bé, FamAgent lọc sản phẩm đúng cân nặng, đúng ngân sách và giải thích vì sao nên chọn.",
};

const STEPS = [
  { title: "Kể về bé trong 1 phút", text: "Chạm chọn vài câu: tuổi, cân nặng, điều bạn quan tâm. Không cần gõ dài." },
  { title: "Hỏi như đang nhắn tin", text: "“Tìm bỉm ban đêm dưới 400k” — FamAgent hiểu và dùng luôn thông tin của bé." },
  { title: "So sánh, rồi tự quyết", text: "Xem lý do, đánh đổi, giá mỗi miếng và nơi bán. Quyết định luôn là của bạn." },
];
const TRUST = [
  { icon: <IconRuler />, title: "Lọc đúng trước, gợi ý sau", text: "Sản phẩm sai cân nặng, sai size hay vượt ngân sách bị loại ngay — không bao giờ “gần đúng”." },
  { icon: <IconCheck />, title: "Luôn nói “vì sao”", text: "Mỗi gợi ý kèm lý do khớp nhu cầu và điểm đánh đổi, dựa trên dữ liệu có nguồn." },
  { icon: <IconWallet />, title: "Giá có thời điểm cập nhật", text: "Giá cũ quá 48 giờ bị ẩn nút mua. So theo giá mỗi miếng, không bị gói to đánh lừa." },
  { icon: <IconShield />, title: "Không xếp hạng theo hoa hồng", text: "Hoa hồng (nếu có) không ảnh hưởng thứ tự. Bạn xem, sửa hoặc xóa dữ liệu bất cứ lúc nào." },
];
const CATEGORIES = [
  { name: "Bỉm cho bé", live: true }, { name: "Sữa công thức", live: false }, { name: "Khăn ướt", live: false },
  { name: "Nước giặt, xả", live: false }, { name: "Đồ vệ sinh nhà cửa", live: false }, { name: "Đồ dùng ăn dặm", live: false },
];
const FAQ = [
  { q: "FamAgent có mất phí không?", a: "Không. Bạn dùng miễn phí, không cần đăng ký để thử." },
  { q: "Thông tin về con tôi được dùng thế nào?", a: "Chỉ để lọc và giải thích gợi ý. Tên bé được thay bằng mã trước khi gửi tới nhà cung cấp AI (khi bạn bật). Bạn xóa được toàn bộ dữ liệu ở trang Gia đình." },
  { q: "FamAgent kiếm tiền từ đâu?", a: "Có thể nhận hoa hồng khi bạn mua qua một số liên kết. Điều này không ảnh hưởng thứ tự đề xuất." },
  { q: "Hiện có những sản phẩm nào?", a: "Đang bắt đầu với bỉm cho bé. Các nhóm đồ dùng gia đình khác sẽ mở dần khi dữ liệu được kiểm tra kỹ." },
];

/** Landing: what FamAgent is and why to trust it, then one clear action → tap-to-answer onboarding. */
export default function Home() {
  return <div className="lp">
    <section className="lp-hero container">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow"><IconSparkle size={16} /> Trợ lý mua sắm AI cho gia đình</p>
        <h1>Chọn đồ cho con đúng ngay, <span>không cần lướt 50 tab.</span></h1>
        <p className="lp-lead">Kể vài điều về bé, FamAgent lọc sản phẩm đúng cân nặng, đúng ngân sách và giải thích vì sao nên chọn — chỉ trong vài giây.</p>
        <div className="lp-actions">
          <Link className="lp-cta" href="/onboarding">Bắt đầu — mất 1 phút <span aria-hidden="true">→</span></Link>
          <a className="lp-ghost" href="#cach-hoat-dong">Xem cách hoạt động</a>
        </div>
        <ul className="lp-assure"><li><IconCheck size={15} /> Miễn phí</li><li><IconCheck size={15} /> Không cần đăng ký</li><li><IconCheck size={15} /> Không xếp hạng theo hoa hồng</li></ul>
      </div>
      <div className="lp-demo" aria-label="Minh họa một cuộc trò chuyện">
        <span className="lp-demo-tag">Minh họa</span>
        <div className="lp-demo-top"><span className="ob-orb" aria-hidden="true" /><b>FamAgent</b><span className="lp-chip">Bé Gold · 10 kg · size L</span></div>
        <p className="lp-bubble me">Tìm bỉm ban đêm cho bé, dưới 400k</p>
        <div className="lp-bubble ai"><span className="ob-orb" aria-hidden="true" /><p>Mình tìm được 5 loại hợp 10 kg và dưới 400.000đ. Đây là 2 lựa chọn nên xem trước:</p></div>
        <div className="lp-mini-cards">
          <div className="lp-mini"><span className="lp-mini-badge">Phù hợp nhất</span><b>Dòng Đêm L44</b><small>✓ Hợp 10 kg · ✓ Đêm 4/5</small><strong>315.000đ <em>7.159đ/miếng</em></strong></div>
          <div className="lp-mini"><span className="lp-mini-badge soft">Tiết kiệm</span><b>Dòng Tiết Kiệm L72</b><small>✓ Hợp 10 kg · giá/miếng thấp</small><strong>329.000đ <em>4.569đ/miếng</em></strong></div>
        </div>
      </div>
    </section>

    <section className="lp-section container" id="cach-hoat-dong">
      <p className="lp-eyebrow center">Cách hoạt động</p>
      <h2>Ba bước, từ “không biết chọn gì” tới “yên tâm bấm mua”</h2>
      <ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title}><span className="lp-step-no">{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">Vì sao tin được</p>
      <h2>Một trợ lý đứng về phía gia đình bạn</h2>
      <div className="lp-trust">{TRUST.map((item) => <article key={item.title}><span className="lp-trust-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>

    <section className="lp-section container">
      <p className="lp-eyebrow center">Danh mục</p>
      <h2>Bắt đầu với bỉm, mở rộng cho cả nhà</h2>
      <ul className="lp-cats">{CATEGORIES.map((category) => <li key={category.name} className={category.live ? "live" : ""}>{category.name}<span>{category.live ? "Đang có" : "Sắp có"}</span></li>)}</ul>
    </section>

    <section className="lp-section container lp-faq-wrap">
      <h2>Câu hỏi thường gặp</h2>
      <div className="lp-faq">{FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </section>

    <section className="lp-final container">
      <span className="ob-orb ob-orb-lg" aria-hidden="true" />
      <h2>Sẵn sàng để FamAgent hiểu gia đình bạn?</h2>
      <p>Chạm chọn vài câu về bé — khoảng 1 phút. Bạn có thể bỏ qua bất kỳ câu nào.</p>
      <Link className="lp-cta" href="/onboarding">Bắt đầu ngay <span aria-hidden="true">→</span></Link>
      <p className="lp-fine"><IconPencil size={14} /> {AFFILIATE_DISCLOSURE}</p>
    </section>
  </div>;
}
