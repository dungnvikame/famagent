"use client";

import { careMethodById } from "@/lib/care/methods";
import { DELIVERY_PREFERENCE_LABELS, DELIVERY_PREFERENCES, MEMBER_ROLES, PRICE_PREFERENCE_LABELS, PRICE_PREFERENCES, COVER_THEMES, type AdultMember, type FamilyProfile } from "@/lib/experience/types";
import { COVER_STYLES, ROLE_LABELS, type CoverTheme } from "@/lib/family/members";
import { ChipInput } from "./chip-input";
import { MemberAvatar } from "./member-avatar";

const vnd = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Summary of shopping priorities; editing happens in the sheet. */
export function PrefsPane({ profile, onEdit }: { profile: FamilyProfile; onEdit: () => void }) {
  return <section className="app-card fam-pane" aria-labelledby="fam-prefs-h">
    <h2 id="fam-prefs-h">🛒 Nhà mình ưu tiên <span className="sp" /><button type="button" className="link-btn" onClick={onEdit}>Sửa</button></h2>
    <p className="fam-hint">FamAgent dùng để xếp hạng lựa chọn khi gợi ý mua.</p>
    <dl className="fam-kv">
      <dt>Giá</dt><dd>{PRICE_PREFERENCE_LABELS[profile.pricePreference]}</dd>
      <dt>Giao hàng</dt><dd>{profile.deliveryPreference ? cap(DELIVERY_PREFERENCE_LABELS[profile.deliveryPreference]) : "Chưa chọn"}</dd>
      <dt>Ngân sách/lần</dt><dd>{profile.maxBudget ? `≤ ${vnd(profile.maxBudget)}` : "Không giới hạn"}</dd>
      {profile.preferredBrands?.length ? <><dt>Tin dùng</dt><dd className="fam-tags">{profile.preferredBrands.map((brand) => <span key={brand} className="fam-tag yes">♥ {brand}</span>)}</dd></> : null}
      {profile.avoidedIngredients?.length ? <><dt>Tránh</dt><dd className="fam-tags">{profile.avoidedIngredients.map((item) => <span key={item} className="fam-tag no">✕ {item}</span>)}</dd></> : null}
    </dl>
  </section>;
}

export function PrefsForm({ profile, onChange }: { profile: FamilyProfile; onChange: (patch: Partial<FamilyProfile>) => void }) {
  return <div className="fam-form">
    <div className="fam-field"><span className="fam-label">Ưu tiên giá</span><div className="fam-seg" role="radiogroup" aria-label="Ưu tiên giá">{PRICE_PREFERENCES.map((value) => <button type="button" role="radio" aria-checked={profile.pricePreference === value} key={value} className={profile.pricePreference === value ? "on" : ""} onClick={() => onChange({ pricePreference: value })}>{PRICE_PREFERENCE_LABELS[value]}</button>)}</div></div>
    <div className="fam-field"><span className="fam-label">Giao hàng</span><div className="fam-seg" role="radiogroup" aria-label="Giao hàng">{DELIVERY_PREFERENCES.map((value) => <button type="button" role="radio" aria-checked={profile.deliveryPreference === value} key={value} className={profile.deliveryPreference === value ? "on" : ""} onClick={() => onChange({ deliveryPreference: profile.deliveryPreference === value ? undefined : value })}>{cap(DELIVERY_PREFERENCE_LABELS[value])}</button>)}</div></div>
    <label className="fam-field"><span className="fam-label">Ngân sách tối đa mỗi lần mua (đ)</span><input type="number" min="50000" step="10000" value={profile.maxBudget ?? ""} placeholder="Để trống = không giới hạn" onChange={(event) => onChange({ maxBudget: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <ChipInput label="Thương hiệu gia đình tin dùng" tone="yes" value={profile.preferredBrands} placeholder="Gõ rồi Enter" onChange={(value) => onChange({ preferredBrands: value })} />
    <ChipInput label="Thành phần muốn tránh" tone="no" value={profile.avoidedIngredients} placeholder="Ví dụ: hương liệu, paraben" onChange={(value) => onChange({ avoidedIngredients: value })} />
  </div>;
}

/** The chosen parenting approach, compact; the six options open only on "Đổi". */
export function CarePane({ profile, onChoose }: { profile: FamilyProfile; onChoose: () => void }) {
  const method = careMethodById(profile.household?.careMethod);
  return <section className="app-card fam-pane" id="care-method" aria-labelledby="fam-care-h">
    <h2 id="fam-care-h">🌱 Cách nuôi dạy <span className="sp" /><button type="button" className="link-btn" onClick={onChoose}>{method ? "Đổi" : "Chọn"}</button></h2>
    {method ? <>
      <div className="fam-method"><span className="mi" aria-hidden="true">🌱</span><div><b>{method.name}</b><small>{method.ages.label} · {method.origin}</small></div></div>
      <p className="fam-idea">{method.idea}</p>
      <ol className="fam-practices">{method.practices.map((line) => <li key={line}>{line}</li>)}</ol>
      <p className="fam-hint">Mỗi ngày một việc xoay vòng trong “Hôm nay với bé” và “Việc hôm nay” ở Trang chủ.</p>
    </> : <p className="fam-hint">Chọn một phương pháp được nhiều gia đình trên thế giới dùng — FamAgent nhắc mỗi ngày một việc nhỏ của phương pháp đó.</p>}
  </section>;
}

/** Name, motto, cover and the list of adults (tap one to edit its look). */
export function HouseholdForm({ profile, members, onChange, onMember, onAddMember }: {
  profile: FamilyProfile; members: Array<{ member: AdultMember; name: string; look: Parameters<typeof MemberAvatar>[0]; }>;
  onChange: (patch: { familyName?: string; motto?: string; theme?: CoverTheme }) => void; onMember: (id: string) => void; onAddMember: () => void;
}) {
  const theme = profile.household?.theme ?? "aurora";
  return <div className="fam-form">
    <label className="fam-field"><span className="fam-label">Tên gọi gia đình</span><input value={profile.familyName ?? ""} maxLength={80} placeholder="Ví dụ: Nhà Gold" onChange={(event) => onChange({ familyName: event.target.value })} /></label>
    <label className="fam-field"><span className="fam-label">Câu khẩu hiệu của nhà mình</span><input value={profile.household?.motto ?? ""} maxLength={80} placeholder="Ví dụ: Chậm mà chắc, vui là chính" onChange={(event) => onChange({ motto: event.target.value })} /></label>
    <div className="fam-field"><span className="fam-label">Ảnh bìa</span><div className="fam-covers" role="radiogroup" aria-label="Ảnh bìa">
      {COVER_THEMES.map((item) => <button type="button" key={item} role="radio" aria-checked={theme === item} className={theme === item ? "on" : ""} style={{ background: COVER_STYLES[item].background }} onClick={() => onChange({ theme: item })}><span>{COVER_STYLES[item].label}</span></button>)}
    </div></div>
    <div className="fam-field"><span className="fam-label">Người lớn trong nhà ({members.length})</span>
      <div className="fam-adults">{members.map(({ member, name, look }) => <button type="button" key={member.id} className="fam-adult" onClick={() => onMember(member.id)}><MemberAvatar {...look} size={44} /><span><b>{name}</b><small>{member.role ? ROLE_LABELS[member.role] : member.id === "me" ? "Bạn" : "Chưa chọn vai trò"}</small></span><em aria-hidden="true">›</em></button>)}
        {members.length < 10 && <button type="button" className="fam-adult add" onClick={onAddMember}><span className="fam-av add" aria-hidden="true">＋</span><span><b>Thêm người lớn</b><small>Vợ/chồng, ông bà, người giúp việc…</small></span></button>}
      </div>
    </div>
  </div>;
}

export function AdultForm({ member, canRemove, onChange, onRemove }: { member: AdultMember; canRemove: boolean; onChange: (patch: Partial<AdultMember>) => void; onRemove: () => void }) {
  return <div className="fam-form">
    <label className="fam-field"><span className="fam-label">Tên gọi</span><input value={member.name ?? ""} maxLength={40} placeholder={member.id === "me" ? "Tên của bạn" : "Ví dụ: Linh"} onChange={(event) => onChange({ name: event.target.value || undefined })} /></label>
    <div className="fam-field"><span className="fam-label">Vai trò</span><div className="fam-seg wrap" role="radiogroup" aria-label="Vai trò">{MEMBER_ROLES.map((role) => <button type="button" role="radio" aria-checked={member.role === role} key={role} className={member.role === role ? "on" : ""} onClick={() => onChange({ role: member.role === role ? undefined : role })}>{ROLE_LABELS[role]}</button>)}</div></div>
    {canRemove && <button type="button" className="app-btn ghost danger" onClick={onRemove}>Bỏ người này khỏi hộ</button>}
  </div>;
}
