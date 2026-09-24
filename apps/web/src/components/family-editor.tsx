"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAllData, getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import { DIAPER_SIZES, PRICE_PREFERENCE_LABELS, PRICE_PREFERENCES, type ChildProfile, type FamilyProfile, type Sensitivity } from "@/lib/experience/types";
import { clearCloudData, cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { stampChanges } from "@/lib/experience/profile-meta";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import { INPUT_BIRTH_YEARS, validProfile } from "@/lib/experience/validate";
import { createAuthBrowserClient } from "@/lib/supabase/browser";
import { AccountSection } from "@/components/account-section";
import { FamilyNotes } from "@/components/family-notes";
import { CareMethodPanel } from "@/components/care/care-method-panel";
import { familyPolicy, STYLE_LABELS } from "@/lib/policy/family-policy";
import type { CareMethodId } from "@/lib/care/methods";

const sensitivityLabels: Record<Sensitivity, string> = { sensitive_skin: "Da nhạy cảm", rash_prone: "Dễ hăm", fragrance_free: "Cần không hương liệu" };
const toList = (value: string) => [...new Set(value.split(",").map((item) => item.trim().slice(0, 40)).filter(Boolean))].slice(0, 10);
/** Local calendar date (YYYY-MM-DD) so Vietnam users can pick today before 07:00. */
const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const optionalNumber = (value: string) => value ? Number(value) : undefined;

/**
 * Comma-separated list field. The raw draft stays in local state so typing commas is not
 * interrupted, while the parsed list is pushed on every change (so Enter-to-submit never
 * loses text). On blur the draft is normalised to exactly what will be saved.
 */
function ListInput({ label, value, placeholder, onChange }: { label: string; value?: string[]; placeholder: string; onChange: (value: string[] | undefined) => void }) {
  const [draft, setDraft] = useState(value?.join(", ") ?? "");
  const push = (text: string) => { const items = toList(text); onChange(items.length ? items : undefined); return items; };
  return <label>{label}<input value={draft} placeholder={placeholder} onChange={(event) => { setDraft(event.target.value); push(event.target.value); }} onBlur={() => setDraft(push(draft).join(", "))} /></label>;
}

export function FamilyEditor() {
  const router = useRouter();
  const [original, setOriginal] = useState<FamilyProfile | null>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = (value: FamilyProfile | null) => { setOriginal(value); setProfile(value); };
    if (cloudEnabled) void loadCloudProfile().then(load).catch(() => setError("Không thể tải hồ sơ.")); else load(getProfile());
  }, []);
  if (!profile) return <div className="container account-page"><h1>Chưa có hồ sơ gia đình</h1>{error && <p className="form-error">{error}</p>}<Link href="/">Bắt đầu trò chuyện với FamAgent →</Link></div>;

  function update(patch: Partial<FamilyProfile>) { setProfile((current) => current ? { ...current, ...patch } : current); setSaved(false); }
  function updateChild(index: number, patch: Partial<ChildProfile>) { setProfile((current) => current ? { ...current, children: current.children.map((child, at) => at === index ? { ...child, ...patch } : child) } : current); setSaved(false); }
  function toggleSensitivity(index: number, child: ChildProfile, value: Sensitivity, checked: boolean) { const next = new Set(child.sensitivities ?? []); if (checked) next.add(value); else next.delete(value); updateChild(index, { sensitivities: next.size ? [...next] : undefined }); }
  function addChild() { setProfile((current) => current && current.children.length < 5 ? { ...current, children: [...current.children, { id: crypto.randomUUID() }] } : current); setSaved(false); }
  function removeChild(index: number) { setProfile((current) => current ? { ...current, children: current.children.filter((_, at) => at !== index) } : current); setSaved(false); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!profile) return;
    // Values typed here are the user's own entries: stamp them as confirmed (spec v1 §6.1).
    const updated = stampChanges(original, { ...profile, updatedAt: new Date().toISOString() }, "user_entered");
    if (!validProfile(updated)) { setError("Một số thông tin chưa hợp lệ. Vui lòng kiểm tra cân nặng (2–30 kg), ngày sinh, ngân sách (từ 50.000đ) và số người lớn."); return; }
    setError("");
    try { if (cloudEnabled) await saveCloudProfile(updated); saveProfile(updated); setOriginal(updated); setProfile(updated); setSaved(true); trackEvent("family_profile_updated"); } catch { setError("Chưa lưu được hồ sơ. Vui lòng thử lại."); }
  }
  /** Parenting approach saves immediately, like the AI switch. */
  async function saveCareMethod(careMethod: CareMethodId) {
    if (!profile) return;
    const updated = { ...profile, household: { ...profile.household, careMethod }, updatedAt: new Date().toISOString() };
    setProfile(updated); setError("");
    try { if (cloudEnabled) await saveCloudProfile(updated); saveProfile(updated); setOriginal(updated); trackEvent("care_method_chosen", { method: careMethod, source: "family" }); } catch { setError("Chưa lưu được phương pháp nuôi dạy. Vui lòng thử lại."); }
  }
  /** The AI switch saves immediately: it is a permission, not a form field the user must remember to submit. */
  async function saveConsent(aiConsent: boolean) {
    if (!profile) return;
    const updated = { ...profile, aiConsent, updatedAt: new Date().toISOString() };
    setProfile(updated); setError("");
    try { if (cloudEnabled) await saveCloudProfile(updated); saveProfile(updated); setOriginal(updated); trackEvent("family_profile_updated", { source: "consent" }); } catch { setError("Chưa lưu được lựa chọn AI. Vui lòng thử lại."); }
  }
  async function erase() { if (!window.confirm("Xóa hồ sơ, lịch sử trò chuyện và sản phẩm đã lưu?")) return; setError(""); try { if (cloudEnabled) await clearCloudData(); clearAllData(); router.push("/"); } catch { setError("Chưa xóa được toàn bộ dữ liệu. Vui lòng thử lại."); } }
  async function signOut() { const client = createAuthBrowserClient(); if (!client) return; const { error: authError } = await client.auth.signOut(); if (authError) { setError("Chưa đăng xuất được. Vui lòng thử lại."); return; } clearAllData(); router.push("/sign-in"); }

  const now = new Date();
  const today = localDate(now);
  const oldestBirthDate = localDate(new Date(now.getFullYear() - INPUT_BIRTH_YEARS, now.getMonth(), now.getDate()));
  return <div className="container account-page"><div className="account-heading"><h1>Gia đình</h1><p>Những gì FamAgent biết về nhà bạn — xem, sửa hoặc xóa bất cứ lúc nào.</p></div>
    <form className="family-form" onSubmit={submit}>
      <section className="form-card"><div><span className="section-number">01</span><h2>Hộ gia đình</h2><p>Giúp ước lượng nhu cầu đồ dùng chung.</p></div><div className="form-grid">
        <label>Tên gọi gia đình<input value={profile.familyName ?? ""} maxLength={80} onChange={(event) => update({ familyName: event.target.value || undefined })} placeholder="Ví dụ: Nhà Gold" /></label>
        <label>Số người lớn<input type="number" min="1" max="10" value={profile.adultsCount ?? ""} onChange={(event) => update({ adultsCount: optionalNumber(event.target.value) })} /></label>
      </div></section>

      <section className="form-card"><div><span className="section-number">02</span><h2>Thông tin của bé</h2><p>Cân nặng hoặc size giúp loại bỉm không phù hợp. Có thể lưu tối đa 5 bé.</p></div><div className="children-editor">{profile.children.map((child, index) => { const age = childAgeMonths(child); return <div className="child-editor" key={child.id}>
        <div className="child-editor-heading"><strong>Bé {index + 1}{age !== undefined ? ` · ${age} tháng` : ""}</strong><button type="button" onClick={() => removeChild(index)}>Xóa bé này</button></div>
        <div className="form-grid">
          <label>Tên gọi của bé<input value={child.name ?? ""} maxLength={80} onChange={(event) => updateChild(index, { name: event.target.value || undefined })} placeholder="Ví dụ: Gold" /></label>
          <label>Ngày sinh<input type="date" min={!child.birthDate || child.birthDate >= oldestBirthDate ? oldestBirthDate : undefined} max={today} value={child.birthDate ?? ""} onChange={(event) => updateChild(index, { birthDate: event.target.value || undefined })} /></label>
          {!child.birthDate && <label>Tuổi (tháng), nếu không nhập ngày sinh<input type="number" min="0" max="72" value={child.ageMonths ?? ""} onChange={(event) => updateChild(index, { ageMonths: optionalNumber(event.target.value) })} /></label>}
          <label>Cân nặng hiện tại (kg)<input type="number" min="2" max="30" step="0.1" value={child.weightKg ?? ""} onChange={(event) => updateChild(index, { weightKg: optionalNumber(event.target.value) })} /></label>
          <label>Size bỉm hiện tại<select value={child.diaperSize ?? ""} onChange={(event) => updateChild(index, { diaperSize: event.target.value || undefined })}><option value="">Chưa rõ</option>{DIAPER_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
          <label>Thương hiệu đang dùng<input value={child.currentBrand ?? ""} maxLength={40} onChange={(event) => updateChild(index, { currentBrand: event.target.value || undefined })} placeholder="Ví dụ: Bobby" /></label>
          <ListInput label="Thương hiệu yêu thích" value={child.preferredBrands} placeholder="Cách nhau bằng dấu phẩy" onChange={(value) => updateChild(index, { preferredBrands: value })} />
          <ListInput label="Thương hiệu muốn tránh" value={child.dislikedBrands} placeholder="Sẽ không được gợi ý" onChange={(value) => updateChild(index, { dislikedBrands: value })} />
        </div>
        <fieldset className="form-grid"><legend>Lưu ý khi chọn đồ</legend>{(Object.keys(sensitivityLabels) as Sensitivity[]).map((value) => <label className="consent-line" key={value}><input type="checkbox" checked={child.sensitivities?.includes(value) ?? false} onChange={(event) => toggleSensitivity(index, child, value, event.target.checked)} /> {sensitivityLabels[value]}</label>)}</fieldset>
      </div>; })}{profile.children.length < 5 && <button className="add-child" type="button" onClick={addChild}>＋ Thêm bé</button>}</div></section>

      <section className="form-card"><div><span className="section-number">03</span><h2>Ưu tiên mua sắm</h2><p>Giúp FamAgent sắp xếp các lựa chọn theo nhu cầu của bạn.</p></div><div className="form-grid">
        <label>Phong cách của nhà mình<select value={profile.household?.style ?? "balanced"} onChange={(event) => { const style = event.target.value as NonNullable<NonNullable<FamilyProfile["household"]>["style"]>; update({ household: { ...profile.household, style }, pricePreference: ({ saving: "budget", balanced: "balanced", convenience: "value" } as const)[style] }); }}>{(["saving", "balanced", "convenience"] as const).map((value) => <option key={value} value={value}>{STYLE_LABELS[value]}</option>)}</select><small>{familyPolicy(profile).lines.join(" · ")}</small></label>
        <label>Ưu tiên giá<select value={profile.pricePreference} onChange={(event) => update({ pricePreference: event.target.value as FamilyProfile["pricePreference"] })}>{PRICE_PREFERENCES.map((value) => <option key={value} value={value}>{PRICE_PREFERENCE_LABELS[value]}</option>)}</select></label>
        <label>Ưu tiên giao hàng<select value={profile.deliveryPreference ?? ""} onChange={(event) => update({ deliveryPreference: (event.target.value || undefined) as FamilyProfile["deliveryPreference"] })}><option value="">Chưa chọn</option><option value="cheapest">Phí giao thấp</option><option value="fastest">Giao nhanh</option><option value="balanced">Cân bằng</option></select></label>
        <label>Điều quan trọng nhất<select value={profile.mainConcern ?? ""} onChange={(event) => update({ mainConcern: (event.target.value || undefined) as FamilyProfile["mainConcern"] })}><option value="">Chưa chọn</option><option value="night">Dùng ban đêm</option><option value="leak">Hạn chế tràn</option><option value="soft">Mỏng nhẹ</option><option value="sensitive">Da nhạy cảm</option><option value="value">Giá trị theo đơn vị</option></select></label>
        <label>Ngân sách tối đa thường dùng (đ)<input type="number" min="50000" step="1000" value={profile.maxBudget ?? ""} onChange={(event) => update({ maxBudget: optionalNumber(event.target.value) })} /></label>
        <ListInput label="Thương hiệu gia đình tin dùng" value={profile.preferredBrands} placeholder="Cách nhau bằng dấu phẩy" onChange={(value) => update({ preferredBrands: value })} />
        <ListInput label="Thành phần muốn tránh" value={profile.avoidedIngredients} placeholder="Ví dụ: hương liệu, paraben" onChange={(value) => update({ avoidedIngredients: value })} />
      </div></section>

      <section className="form-card"><div><span className="section-number">04</span><h2>Thiết bị trong nhà</h2><p>Tùy chọn. Dùng khi chọn nước giặt phù hợp máy.</p></div><div className="form-grid">
        <label>Máy giặt<select value={profile.appliances?.washingMachine ?? ""} onChange={(event) => update({ appliances: event.target.value ? { washingMachine: event.target.value as NonNullable<FamilyProfile["appliances"]>["washingMachine"] } : undefined })}><option value="">Chưa chọn</option><option value="front">Cửa trước</option><option value="top">Cửa trên</option><option value="none">Không dùng máy giặt</option></select></label>
      </div></section>

      {(profile.children.length > 0 || profile.household?.setup === "expecting") && <details className="app-card advanced"><summary>Nâng cao · phương pháp nuôi dạy và kiểm tra chăm sóc</summary><CareMethodPanel profile={profile} onChoose={(id) => void saveCareMethod(id)} /><p className="app-sub"><a className="brief-link" href="/onboarding?update=1&section=care">Làm bài kiểm tra chăm sóc (1 phút)</a></p></details>}
      <section className="form-card"><div><span className="section-number">05</span><h2>Điều FamAgent đã ghi nhớ</h2><p>Ghi chú rút ra từ các cuộc trò chuyện, gắn nhãn “Ghi nhận” cho tới khi bạn xác nhận.</p></div><FamilyNotes /></section>
      <div className="form-actions"><button className="button primary" type="submit">Lưu hồ sơ</button>{saved && <span>Đã lưu thay đổi.</span>}{error && <span className="form-error">{error}</span>}<Link href="/agent">Hỏi FamAgent →</Link></div></form>
    <AccountSection cloud={cloudEnabled} aiConsent={profile.aiConsent} onAiConsent={(value) => void saveConsent(value)} onErase={() => void erase()} onSignOut={() => void signOut()} /></div>;
}
