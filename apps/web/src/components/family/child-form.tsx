"use client";

import { DIAPER_SIZES, SENSITIVITIES, type ChildProfile, type Sensitivity } from "@/lib/experience/types";
import { INPUT_BIRTH_YEARS } from "@/lib/experience/validate";
import { SENSITIVITY_LABELS } from "@/lib/family/members";
import { addDays } from "@/lib/family/child-stats";
import { ChipInput } from "./chip-input";

/** Fields of one child, saved as they change (the page debounces). Weight lives on the growth chart instead. */
export function ChildForm({ child, today, onChange, onRemove }: { child: ChildProfile; today: string; onChange: (patch: Partial<ChildProfile>) => void; onRemove: () => void }) {
  const oldest = addDays(today, -Math.round(INPUT_BIRTH_YEARS * 365.25));
  const toggle = (value: Sensitivity, on: boolean) => { const next = new Set(child.sensitivities ?? []); if (on) next.add(value); else next.delete(value); onChange({ sensitivities: next.size ? [...next] : undefined }); };
  return <div className="fam-form">
    <label className="fam-field"><span className="fam-label">Tên gọi</span><input value={child.name ?? ""} maxLength={80} placeholder="Ví dụ: Gold" onChange={(event) => onChange({ name: event.target.value || undefined })} /></label>
    <div className="fam-field"><span className="fam-label">Bé trai hay bé gái <small>(chỉ để so với đường chuẩn WHO)</small></span><div className="fam-seg" role="radiogroup" aria-label="Giới tính">
      {([["male", "👦 Bé trai"], ["female", "👧 Bé gái"]] as const).map(([value, label]) => <button type="button" role="radio" key={value} aria-checked={child.sex === value} className={child.sex === value ? "on" : ""} onClick={() => onChange({ sex: child.sex === value ? undefined : value })}>{label}</button>)}
    </div></div>
    <label className="fam-field"><span className="fam-label">Ngày sinh</span><input type="date" min={!child.birthDate || child.birthDate >= oldest ? oldest : undefined} max={today} value={child.birthDate ?? ""} onChange={(event) => onChange(event.target.value ? { birthDate: event.target.value, ageMonths: undefined, ageAsOf: undefined } : { birthDate: undefined })} /></label>
    {!child.birthDate && <label className="fam-field"><span className="fam-label">Tuổi (tháng), nếu chưa muốn nhập ngày sinh</span><input type="number" min="0" max="216" value={child.ageMonths ?? ""} onChange={(event) => onChange({ ageMonths: event.target.value ? Number(event.target.value) : undefined, ageAsOf: event.target.value ? today : undefined })} /></label>}
    <div className="fam-row2">
      <label className="fam-field"><span className="fam-label">Size bỉm đang dùng</span><select value={child.diaperSize ?? ""} onChange={(event) => onChange({ diaperSize: event.target.value || undefined })}><option value="">Không dùng / chưa rõ</option>{DIAPER_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
      <label className="fam-field"><span className="fam-label">Thương hiệu đang dùng</span><input value={child.currentBrand ?? ""} maxLength={40} placeholder="Ví dụ: Bobby" onChange={(event) => onChange({ currentBrand: event.target.value || undefined })} /></label>
    </div>
    <p className="fam-hint">Cân nặng ghi ở biểu đồ “Cân nặng & tăng trưởng” để FamAgent giữ lại lịch sử lớn lên.</p>
    <ChipInput label="Thương hiệu yêu thích" tone="yes" value={child.preferredBrands} placeholder="Gõ rồi Enter" onChange={(value) => onChange({ preferredBrands: value })} />
    <ChipInput label="Muốn tránh (sẽ không được gợi ý)" tone="no" value={child.dislikedBrands} placeholder="Gõ rồi Enter" onChange={(value) => onChange({ dislikedBrands: value })} />
    <fieldset className="fam-field fam-checks"><legend className="fam-label">Lưu ý khi chọn đồ</legend>
      {SENSITIVITIES.map((value) => <label key={value} className="fam-check"><input type="checkbox" checked={child.sensitivities?.includes(value) ?? false} onChange={(event) => toggle(value, event.target.checked)} /> {SENSITIVITY_LABELS[value]}</label>)}
    </fieldset>
    <button type="button" className="app-btn ghost danger" onClick={onRemove}>Xóa hồ sơ bé này…</button>
  </div>;
}
