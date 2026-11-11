"use client";

import type { ChildProfile } from "@/lib/experience/types";
import { INPUT_BIRTH_YEARS } from "@/lib/experience/validate";
import { addDays } from "@/lib/family/child-stats";

/** Fields of one child, saved as they change (the page debounces). */
export function ChildForm({ child, today, onChange, onRemove }: { child: ChildProfile; today: string; onChange: (patch: Partial<ChildProfile>) => void; onRemove: () => void }) {
  const oldest = addDays(today, -Math.round(INPUT_BIRTH_YEARS * 365.25));
  return <div className="fam-form">
    <label className="fam-field"><span className="fam-label">Tên gọi</span><input value={child.name ?? ""} maxLength={80} placeholder="Ví dụ: Gold" onChange={(event) => onChange({ name: event.target.value || undefined })} /></label>
    <div className="fam-field"><span className="fam-label">Bé trai hay bé gái</span><div className="fam-seg" role="radiogroup" aria-label="Giới tính">
      {([["male", "👦 Bé trai"], ["female", "👧 Bé gái"]] as const).map(([value, label]) => <button type="button" role="radio" key={value} aria-checked={child.sex === value} className={child.sex === value ? "on" : ""} onClick={() => onChange({ sex: child.sex === value ? undefined : value })}>{label}</button>)}
    </div></div>
    <label className="fam-field"><span className="fam-label">Ngày sinh</span><input type="date" min={!child.birthDate || child.birthDate >= oldest ? oldest : undefined} max={today} value={child.birthDate ?? ""} onChange={(event) => onChange(event.target.value ? { birthDate: event.target.value, ageMonths: undefined, ageAsOf: undefined } : { birthDate: undefined })} /></label>
    {!child.birthDate && <label className="fam-field"><span className="fam-label">Tuổi (tháng), nếu chưa muốn nhập ngày sinh</span><input type="number" min="0" max="216" value={child.ageMonths ?? ""} onChange={(event) => onChange({ ageMonths: event.target.value ? Number(event.target.value) : undefined, ageAsOf: event.target.value ? today : undefined })} /></label>}
    <button type="button" className="app-btn ghost danger" onClick={onRemove}>Xóa hồ sơ bé này…</button>
  </div>;
}
