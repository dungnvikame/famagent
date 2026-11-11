"use client";

import { MEMBER_ROLES, COVER_THEMES, type AdultMember, type FamilyProfile } from "@/lib/experience/types";
import { COVER_STYLES, ROLE_LABELS, type CoverTheme } from "@/lib/family/members";
import { MemberAvatar } from "./member-avatar";

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
