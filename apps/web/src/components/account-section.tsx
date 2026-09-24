"use client";

import { useAccount } from "@/components/app-shell/use-account";
import { PushToggle } from "@/components/push-toggle";

/** Account & privacy block on the Family page: who is signed in (Google name/avatar), AI consent, data controls. */
export function AccountSection({ aiConsent, onAiConsent, onErase, onSignOut, cloud }: { aiConsent: boolean; onAiConsent: (value: boolean) => void; onErase: () => void; onSignOut: () => void; cloud: boolean }) {
  const account = useAccount();
  const provider = account.provider === "google" ? "Google" : account.provider === "email" ? "email" : account.provider;
  return <section className="form-card" id="account"><div><span className="section-number">06</span><h2>Tài khoản & quyền riêng tư</h2><p>{cloud ? "Dữ liệu được lưu trong tài khoản của bạn và chỉ bạn xem được." : "Bản thử lưu trên trình duyệt này."}</p></div>
    <div className="app-rows account-rows">
      {/* eslint-disable-next-line @next/next/no-img-element -- Google avatar */}
      {account.status === "member" && <div><span className="account-who">{account.avatarUrl ? <img src={account.avatarUrl} alt="" width={40} height={40} referrerPolicy="no-referrer" /> : <span className="app-me-initial" aria-hidden="true">{(account.name ?? "?").charAt(0).toUpperCase()}</span>}<span><b>{account.name}</b><small>{account.email}{provider ? ` · đăng nhập bằng ${provider}` : ""}</small></span></span><span className="app-pill ok">Đang hoạt động</span></div>}
      {account.status === "guest" && <div><span><b>Chưa đăng nhập</b><small>Tạo tài khoản để giữ hồ sơ trên mọi thiết bị.</small></span><a className="app-btn" href="/sign-in">Đăng nhập</a></div>}
      <div><label className="account-toggle" htmlFor="ai-consent"><b>Dùng AI để hiểu câu hỏi tốt hơn</b><small>Tên bé được thay bằng mã trước khi gửi tới nhà cung cấp AI. Tắt thì FamAgent chỉ dùng quy tắc.</small></label><input id="ai-consent" type="checkbox" role="switch" checked={aiConsent} aria-checked={aiConsent} onChange={(event) => onAiConsent(event.target.checked)} /></div>
      <PushToggle cloud={cloud} />
      <div><span><b>Xóa hồ sơ và dữ liệu mua sắm</b><small>Xóa hồ sơ, lịch sử trò chuyện, sản phẩm đã lưu. Không khôi phục được.</small></span><button type="button" className="app-btn ghost danger" onClick={onErase}>Xóa</button></div>
      {cloud && account.status === "member" && <div><span><b>Đăng xuất</b><small>Thoát khỏi thiết bị này; dữ liệu vẫn ở trong tài khoản.</small></span><button type="button" className="app-btn ghost" onClick={onSignOut}>Đăng xuất</button></div>}
    </div></section>;
}
