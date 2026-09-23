"use client";

import Link from "next/link";
import { useState } from "react";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import { stampChanges } from "@/lib/experience/profile-meta";
import { validProfile } from "@/lib/experience/validate";
import { DIAPER_SIZES, PRICE_PREFERENCE_LABELS, PRICE_PREFERENCES, SHOPPING_CONCERN_LABELS, WASHING_MACHINE_LABELS, type ChildProfile, type FamilyProfile, type FieldMeta } from "@/lib/experience/types";

// "Family AI đang hiểu" — what the agent currently knows, editable inline (P4, mockup note 5).
// Shared by onboarding and /shop so both show the same context (DRY).

export interface PendingValue { path: string; label: string; value?: unknown }

/** Value-only text for a pending confirmation, so the row reads "Cân nặng: ~10 kg" (not the full label). */
function pendingText(item: PendingValue): string {
  const field = item.path.split(".").at(-1);
  if (typeof item.value === "number") return field === "weightKg" ? `~${item.value} kg` : field === "ageMonths" ? `~${item.value} tháng` : field === "maxBudget" ? `${item.value.toLocaleString("vi-VN")}đ` : String(item.value);
  return typeof item.value === "string" ? item.value : item.label;
}

type Editor =
  | { kind: "number"; min: number; max: number; step?: number }
  | { kind: "text"; max: number }
  | { kind: "select"; options: Array<{ value: string; label: string }> };

interface Row { path: string; label: string; display: string | null; editor?: Editor; raw?: string | number }

const SENSITIVITY_LABELS: Record<string, string> = { sensitive_skin: "da nhạy cảm", rash_prone: "dễ hăm", fragrance_free: "không hương liệu" };
const SOURCE_LABELS: Record<FieldMeta["source"], string> = { user_entered: "bạn nhập", user_confirmed: "đã xác nhận" };

function childRows(child: ChildProfile): Row[] {
  const base = `children.${child.id}`;
  const age = childAgeMonths(child);
  const notes = [...(child.sensitivities ?? []).map((item) => SENSITIVITY_LABELS[item]), child.currentBrand ? `đang dùng ${child.currentBrand}` : null, child.dislikedBrands?.length ? `tránh ${child.dislikedBrands.join(", ")}` : null].filter(Boolean).join(" · ");
  return [
    { path: `${base}.name`, label: "Tên gọi", display: child.name ?? null, editor: { kind: "text", max: 30 }, raw: child.name },
    { path: `${base}.weightKg`, label: "Cân nặng", display: child.weightKg !== undefined ? `${child.weightKg} kg` : null, editor: { kind: "number", min: 2, max: 30, step: 0.1 }, raw: child.weightKg },
    { path: `${base}.diaperSize`, label: "Size bỉm", display: child.diaperSize ?? null, editor: { kind: "select", options: DIAPER_SIZES.map((size) => ({ value: size, label: size })) }, raw: child.diaperSize },
    // Age is shown but edited as a birth date in /family; the agent collects it in chat.
    { path: child.birthDate ? `${base}.birthDate` : `${base}.ageMonths`, label: "Tuổi", display: age !== undefined ? `${age} tháng` : null },
    { path: `${base}.sensitivities`, label: "Lưu ý", display: notes || null },
  ];
}

function familyRows(profile: FamilyProfile): Array<{ title: string; rows: Row[] }> {
  return [
    { title: "Hộ gia đình", rows: [{ path: "adultsCount", label: "Người lớn", display: profile.adultsCount?.toString() ?? null, editor: { kind: "number", min: 1, max: 10 }, raw: profile.adultsCount }] },
    ...(profile.children.length ? profile.children : [{ id: "pending-child" } as ChildProfile]).map((child, index) => ({ title: child.name ? `Bé ${child.name}` : profile.children.length > 1 ? `Bé thứ ${index + 1}` : "Bé", rows: child.id === "pending-child" ? [{ path: "children", label: "Cân nặng / size", display: null }] : childRows(child) })),
    { title: "Ưu tiên", rows: [
      { path: "pricePreference", label: "Ưu tiên giá", display: profile.fieldMeta?.pricePreference ? PRICE_PREFERENCE_LABELS[profile.pricePreference] : null, editor: { kind: "select", options: PRICE_PREFERENCES.map((value) => ({ value, label: PRICE_PREFERENCE_LABELS[value] })) }, raw: profile.pricePreference },
      { path: "mainConcern", label: "Quan trọng nhất", display: profile.mainConcern ? SHOPPING_CONCERN_LABELS[profile.mainConcern] : null },
      { path: "maxBudget", label: "Ngân sách tối đa", display: profile.maxBudget ? `${profile.maxBudget.toLocaleString("vi-VN")}đ` : null, editor: { kind: "number", min: 50_000, max: 100_000_000, step: 1000 }, raw: profile.maxBudget },
    ] },
    { title: "Thiết bị", rows: [{ path: "appliances.washingMachine", label: "Máy giặt", display: profile.appliances?.washingMachine ? WASHING_MACHINE_LABELS[profile.appliances.washingMachine] : null, editor: { kind: "select", options: Object.entries(WASHING_MACHINE_LABELS).map(([value, label]) => ({ value, label })) }, raw: profile.appliances?.washingMachine }] },
  ];
}

/** Writes one edited value; returns null when the result would be an invalid profile. */
function applyEdit(profile: FamilyProfile, path: string, raw: string): FamilyProfile | null {
  const [head, childId, field] = path.split(".");
  const text = raw.trim();
  const value: unknown = text === "" ? undefined : ["weightKg", "adultsCount", "maxBudget"].includes(field ?? head) ? Number(text) : text;
  const next: FamilyProfile = { ...profile, children: profile.children.map((child) => ({ ...child })) };
  if (head === "children") Object.assign(next.children.find((child) => child.id === childId) ?? {}, { [field]: value });
  else if (head === "appliances") next.appliances = value ? { washingMachine: value as NonNullable<FamilyProfile["appliances"]>["washingMachine"] } : undefined;
  else Object.assign(next, { [head]: value ?? (head === "pricePreference" ? "balanced" : undefined) });
  const stamped = stampChanges(profile, { ...next, updatedAt: new Date().toISOString() }, "user_entered");
  // Clearing the price preference returns to the default, which is not a user choice: drop its provenance.
  if (head === "pricePreference" && value === undefined && stamped.fieldMeta) { const { pricePreference: _cleared, ...rest } = stamped.fieldMeta; void _cleared; stamped.fieldMeta = Object.keys(rest).length ? rest : undefined; }
  return validProfile(stamped) ? stamped : null;
}

export function FamilyContextPanel({ profile, fresh, pending = [], onEdit, disabled = false, title = "Family AI đang hiểu" }: {
  profile: FamilyProfile;
  fresh?: Set<string>;
  pending?: PendingValue[];
  /** Omit to render read-only. */
  onEdit?: (next: FamilyProfile, changedPath: string) => void;
  /** Locks editing while a chat turn is in flight so the reply cannot overwrite an edit. */
  disabled?: boolean;
  title?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const groups = familyRows(profile);
  // How much context the agent has so far (display only; empty rows are fine — every question is skippable).
  const allRows = groups.flatMap((group) => group.rows);
  const filled = allRows.filter((row) => row.display).length;
  const first = profile.children[0];
  const compact = [profile.adultsCount ? `${profile.adultsCount} người lớn` : null, first && (first.name || first.weightKg || first.diaperSize) ? [first.name ? `Bé ${first.name}` : "Bé", first.weightKg ? `${first.weightKg} kg` : null, first.diaperSize].filter(Boolean).join(" ") : null, profile.maxBudget ? `≤ ${profile.maxBudget.toLocaleString("vi-VN")}đ` : null].filter(Boolean).join(" · ") || "Chưa có thông tin";

  function save(path: string) {
    const next = applyEdit(profile, path, draft);
    if (!next) { setError("Giá trị chưa hợp lệ."); return; }
    setError(""); setEditing(null); onEdit?.(next, path);
  }

  return <aside className={`ob-panel${open ? " open" : ""}`} aria-label={title}>
    <button type="button" className="ob-panel-compact" aria-expanded={open} onClick={() => setOpen(!open)}><span>{compact}</span><b>{open ? "Thu gọn ▴" : "Xem & sửa ▾"}</b></button>
    <div className="ob-panel-body">
      <div className="ob-panel-head"><span className="ob-orb" aria-hidden="true" /><h3>{title}</h3></div>
      <div className="ob-meter" role="meter" aria-label="Mức độ đầy đủ của hồ sơ" aria-valuemin={0} aria-valuemax={allRows.length} aria-valuenow={filled}><span style={{ width: `${allRows.length ? Math.round((filled / allRows.length) * 100) : 0}%` }} /></div>
      <p className="ob-meter-label">Đã có {filled}/{allRows.length} thông tin</p>
      <p className="ob-panel-sub">{onEdit ? "Bấm vào dòng bất kỳ để sửa — không cần chat." : "Thông tin đang dùng để tư vấn."}</p>
      {groups.map((group) => <section className="ob-group" key={group.title}><h4>{group.title}</h4>
        {group.rows.map((row) => {
          const waiting = pending.find((item) => item.path === row.path);
          const meta = profile.fieldMeta?.[row.path];
          const state = waiting ? " pending" : fresh?.has(row.path) ? " fresh" : !row.display ? " empty" : "";
          if (editing === row.path && row.editor) {
            return <form className="ob-field editing" key={row.path} onSubmit={(event) => { event.preventDefault(); save(row.path); }}>
              <label htmlFor={`edit-${row.path}`}>{row.label}</label>
              {row.editor.kind === "select"
                ? <select id={`edit-${row.path}`} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus><option value="">Chưa có</option>{row.editor.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : <input id={`edit-${row.path}`} type={row.editor.kind === "number" ? "number" : "text"} value={draft} autoFocus onChange={(event) => setDraft(event.target.value)} {...(row.editor.kind === "number" ? { min: row.editor.min, max: row.editor.max, step: row.editor.step ?? 1 } : { maxLength: row.editor.max })} />}
              <span className="ob-field-actions"><button type="submit" disabled={disabled}>Lưu</button><button type="button" onClick={() => { setEditing(null); setError(""); }}>Hủy</button></span>
            </form>;
          }
          const content = <><span>{row.label}</span><b>{waiting ? `${pendingText(waiting)} · chờ xác nhận` : row.display ?? "Chưa có"}{meta && !waiting && row.display ? <small>{SOURCE_LABELS[meta.source]}</small> : null}</b></>;
          return onEdit && row.editor
            ? <button type="button" className={`ob-field${state}`} key={row.path} disabled={disabled} onClick={() => { setEditing(row.path); setDraft(row.raw?.toString() ?? ""); setError(""); }} aria-label={`Sửa ${row.label.toLowerCase()}`}>{content}</button>
            : <div className={`ob-field${state}`} key={row.path}>{content}</div>;
        })}
      </section>)}
      {error && <p className="ob-panel-error" role="alert">{error}</p>}
      <p className="ob-panel-foot"><Link href="/family">Sửa chi tiết (ngày sinh, thương hiệu, lưu ý) ở trang Gia đình →</Link></p>
    </div>
  </aside>;
}
