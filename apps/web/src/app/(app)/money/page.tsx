import Link from "next/link";

export const metadata = { title: "FamAgent | Tiền" };

const CATEGORIES = ["Ăn uống", "Tiêu dùng", "Con", "Gia đình", "Mua sắm", "Khám, thuốc", "Tiền điện", "Tiền nước", "Trả góp", "Giải trí"];

/** Money home (spec v2 §8–12). The ledger and monthly view ship in the Finance phase; this page states what it will answer. */
export default function MoneyPage() {
  return <div className="app-page">
    <div className="app-page-head"><div><h1>Tiền</h1><p className="app-sub">Nhà mình có bao nhiêu · tiền đi đâu · có gì bất thường · nên làm gì</p></div></div>
    <div className="app-card"><div className="app-grid2" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><div className="brief-kpi"><small>Thu tháng này</small><b>—</b></div><div className="brief-kpi"><small>Đã chi</small><b>—</b></div><div className="brief-kpi"><small>Còn lại</small><b>—</b></div></div></div>
    <div className="app-card app-empty"><strong>Sổ thu chi đang được hoàn thiện</strong><p style={{ margin: 0 }}>Bạn sẽ ghi từng khoản như trong Excel (ngày · nội dung · nhóm · chi / thu / chuyển tiết kiệm · tiêu cho con), xem bảng nhóm theo tháng và nhận nhắc khi chi lệch kế hoạch. Nhóm mặc định: {CATEGORIES.join(", ")}…</p><Link className="app-btn ghost" href="/agent">Hỏi FamAgent trong lúc chờ →</Link></div>
  </div>;
}
