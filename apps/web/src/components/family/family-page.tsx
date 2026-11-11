"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app-shell/use-account";
import { AccountSection } from "@/components/account-section";
import { clearCloudData, cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { stampChanges } from "@/lib/experience/profile-meta";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import { clearAllData, getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import type { AdultMember, ChildProfile, FamilyProfile, MemberLook } from "@/lib/experience/types";
import { validProfile } from "@/lib/experience/validate";
import { ageParts, ageShort, dayMilestone, nextBirthday, shortDate } from "@/lib/family/child-stats";
import { adultLook, adultMembers, adultName, childLook, childName, newMemberId, ROLE_LABELS, withChildLook, withMembers, type AvatarColor } from "@/lib/family/members";
import { loadMoney } from "@/lib/money/client";
import { todayLocal } from "@/lib/money/parse";
import { monthKey, shortVnd, summarizeMonth, type MonthSummary } from "@/lib/money/summary";
import { createAuthBrowserClient } from "@/lib/supabase/browser";
import { AvatarEditor } from "./avatar-editor";
import { ChildForm } from "./child-form";
import { ChildSpotlight } from "./child-spotlight";
import { FamilyHero, FamilyPulse, type HeroMember, type PulseTile, type TodayLine } from "./family-hero";
import { MemberAvatar } from "./member-avatar";
import { AdultForm, HouseholdForm } from "./family-panels";
import { SideSheet } from "./side-sheet";

type Sheet = { kind: "child" | "childLook" | "adult"; id: string } | { kind: "household" | "addChild" } | null;
type SaveState = "idle" | "saving" | "saved" | "error";
const vnDay = (iso?: string) => iso && !Number.isNaN(Date.parse(iso)) ? new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10) : undefined;

/**
 * Gia đình: cover with everyone's avatar, today's notes (birthdays, bills due), one card per child, the travel
 * entry and the account block. Every field saves on its own ("Đã lưu").
 */
export function FamilyPage() {
  const router = useRouter();
  const account = useAccount();
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [money, setMoney] = useState<MonthSummary | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [newChild, setNewChild] = useState<{ name: string; birthDate: string; sex?: "male" | "female" }>({ name: "", birthDate: "" });

  const original = useRef<FamilyProfile | null>(null);
  const latest = useRef<FamilyProfile | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const today = todayLocal();

  useEffect(() => {
    let cancelled = false;
    (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then((value) => {
      if (cancelled) return;
      original.current = value; latest.current = value; setProfile(value); setLoaded(true);
      if (!value) return;
      loadMoney(monthKey(new Date())).then((bundle) => { if (!cancelled) setMoney(summarizeMonth(bundle)); }).catch(() => {});
    }).catch(() => { if (!cancelled) { setLoadError("Không thể tải hồ sơ."); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (typeof window !== "undefined" && window.location.hash === "#account") setAccountOpen(true); }, [loaded]);

  /** Serialised save of the latest profile: provenance stamps, weighing dates, then cloud + this device. */
  const persist = useCallback(() => {
    window.clearTimeout(timer.current); timer.current = undefined;
    queue.current = queue.current.then(async () => {
      const next = latest.current;
      if (!next) return;
      setSave("saving");
      const updated = stampChanges(original.current, { ...next, updatedAt: new Date().toISOString() }, "user_entered");
      if (!validProfile(updated)) { setSave("error"); setError("Một số thông tin chưa hợp lệ (tên ≤ 80 ký tự, ngân sách từ 50.000đ, ngày sinh không ở tương lai)."); return; }
      try {
        if (cloudEnabled) await saveCloudProfile(updated);
        saveProfile(updated);
        original.current = updated;
        // Keep what was typed meanwhile; only take the new provenance.
        setProfile((current) => current ? { ...current, fieldMeta: updated.fieldMeta } : current);
        if (latest.current) latest.current = { ...latest.current, fieldMeta: updated.fieldMeta };
        setSave("saved"); setError("");
        trackEvent("family_profile_updated", { source: "family_page" });
      } catch { setSave("error"); setError("Chưa lưu được. Kiểm tra mạng rồi thử lại."); }
    });
    return queue.current;
  }, []);
  const change = useCallback((next: FamilyProfile, immediate = false) => {
    // No "Đang lưu…" while typing: it appears when the debounced save actually starts.
    latest.current = next; setProfile(next);
    window.clearTimeout(timer.current);
    if (immediate) void persist(); else timer.current = window.setTimeout(() => void persist(), 700);
  }, [persist]);
  // Typing then leaving the page must not lose the last field.
  useEffect(() => {
    const flush = () => { if (timer.current !== undefined) void persist(); };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush); document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("beforeunload", flush); document.removeEventListener("visibilitychange", onHide); flush(); };
  }, [persist]);

  const children = useMemo(() => profile?.children ?? [], [profile]);
  const selectedChild = children.find((child) => child.id === selected) ?? children[0];

  if (!loaded) return <div className="app-page" aria-busy="true"><p className="app-sub">Đang mở hồ sơ gia đình…</p></div>;
  if (!profile) return <div className="app-page"><div className="app-card fam-empty"><h1>Chưa có hồ sơ gia đình</h1>{loadError && <p className="form-error">{loadError}</p>}<p className="app-sub">Trả lời vài câu để FamAgent hiểu nhà mình.</p><Link className="app-btn" href="/onboarding">Bắt đầu →</Link></div></div>;

  const p = profile;
  // Reads the newest profile (not this render's), so a patch never drops what was typed meanwhile.
  const updateChild = (id: string, patch: Partial<ChildProfile>, immediate = false) => { const base = latest.current ?? p; change({ ...base, children: base.children.map((child) => child.id === id ? { ...child, ...patch } : child) }, immediate); };
  const adults = adultMembers(p);
  const setAdults = (members: AdultMember[], immediate = false) => change(withMembers(p, members), immediate);
  const photoOf = (id: string) => id === "me" ? account.avatarUrl : undefined;
  const childLooks = new Map(children.map((child, index) => [child.id, childLook(p, child, index)]));
  const names = new Map(children.map((child, index) => [child.id, childName(child, index)]));

  function addChild() {
    if (p.children.length >= 5) return;
    const child: ChildProfile = { id: crypto.randomUUID(), name: newChild.name.trim() || undefined, birthDate: newChild.birthDate || undefined, sex: newChild.sex };
    change({ ...p, children: [...p.children, child] }, true);
    setSelected(child.id); setSheet(null); setNewChild({ name: "", birthDate: "" });
  }
  function removeChild(child: ChildProfile, index: number) {
    if (!window.confirm(`Xóa hồ sơ ${childName(child, index)}?`)) return;
    const looks = { ...p.household?.looks }; delete looks[child.id];
    change({ ...p, children: p.children.filter((item) => item.id !== child.id), household: { ...p.household, looks: Object.keys(looks).length ? looks : undefined } }, true);
    setSheet(null); setSelected(null);
  }
  async function erase() { if (!window.confirm("Xóa hồ sơ gia đình và toàn bộ dữ liệu của tài khoản này?")) return; try { if (cloudEnabled) await clearCloudData(); clearAllData(); router.push("/"); } catch { setError("Chưa xóa được toàn bộ dữ liệu. Vui lòng thử lại."); } }
  async function signOut() { const client = createAuthBrowserClient(); if (!client) return; const { error: authError } = await client.auth.signOut(); if (authError) { setError("Chưa đăng xuất được. Vui lòng thử lại."); return; } clearAllData(); router.push("/sign-in"); }

  // ---------- derived view data ----------
  const members: HeroMember[] = [
    ...adults.map((member, index): HeroMember => { const look = adultLook(member, index); const name = adultName(member, index, account.name); return { id: member.id, kind: "adult", name, label: member.role ? ROLE_LABELS[member.role] : member.id === "me" ? "Bạn" : name, color: look.color, emoji: look.emoji, photo: photoOf(member.id) }; }),
    ...children.map((child): HeroMember => { const look = childLooks.get(child.id)!; return { id: child.id, kind: "child", name: names.get(child.id)!, label: names.get(child.id)!, color: look.color, emoji: look.emoji, selected: children.length > 1 && child.id === selectedChild?.id }; }),
  ];
  const lines: TodayLine[] = [];
  for (const child of children) {
    if (!child.birthDate) continue;
    const name = names.get(child.id)!;
    const birthday = nextBirthday(child.birthDate, today), milestone = dayMilestone(child.birthDate, today);
    if (birthday.isToday) lines.push({ icon: "🎉", text: <>Sinh nhật {birthday.turning} tuổi của <b>{name}</b> — chúc mừng cả nhà!</> });
    else if (birthday.daysLeft <= 30) lines.push({ icon: "🎂", text: <>Còn {birthday.daysLeft} ngày nữa {name} tròn {birthday.turning} tuổi</> });
    if (milestone && (milestone.isToday || milestone.daysLeft <= 60)) lines.push({ icon: "✨", text: milestone.isToday ? <>Hôm nay {name} tròn <b>{milestone.day.toLocaleString("vi-VN")} ngày</b>!</> : <>{name} tròn {milestone.day.toLocaleString("vi-VN")} ngày vào {shortDate(milestone.date, today)} (còn {milestone.daysLeft} ngày)</> });
  }
  for (const due of (money?.upcoming ?? []).filter((item) => item.kind === "expense" && item.daysLeft >= 0 && item.daysLeft <= 7).slice(0, 2)) lines.push({ icon: "📅", text: `${due.name} đến hạn ${shortDate(due.dueOn, today)}${due.daysLeft === 0 ? " (hôm nay)" : ""}`, href: "/money" });
  if (!lines.length) lines.push({ icon: "☀️", text: "Mọi thứ đang ổn — chưa có việc gì cần để ý." });
  const since = p.onboardedAt ? Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${vnDay(p.onboardedAt)}T00:00:00Z`)) / 86_400_000) + 1) : undefined;
  const headlineChild = selectedChild?.birthDate ? { name: names.get(selectedChild.id)!, day: ageParts(selectedChild.birthDate, today).dayNumber } : undefined;
  const headline = headlineChild ? <>{headlineChild.name} đang ở <em>ngày thứ {headlineChild.day.toLocaleString("vi-VN")}</em></> : since ? <>FamAgent đồng hành cùng nhà mình <em>{since} ngày</em></> : <>Chào mừng về nhà</>;

  const tiles: PulseTile[] = [];
  if (money && money.childSpend > 0) tiles.push({ key: "money", icon: "💜", label: `Chi cho con · T${Number(money.month.slice(5))}`, value: shortVnd(money.childSpend), detail: money.expense ? `${Math.round(money.childSpend / money.expense * 100)}% tổng chi tháng này` : "các khoản đánh dấu “cho con”", cta: "Tài chính", href: "/money" });

  const status = save === "saving" ? "Đang lưu…" : save === "saved" ? "✓ Đã lưu" : save === "error" ? <span className="form-error">Chưa lưu</span> : null;
  const sheetChild = sheet && "id" in sheet ? children.find((child) => child.id === sheet.id) : undefined;
  const sheetChildIndex = sheetChild ? children.indexOf(sheetChild) : -1;
  const sheetAdultIndex = sheet?.kind === "adult" ? adults.findIndex((member) => member.id === sheet.id) : -1;
  const sheetAdult = sheetAdultIndex >= 0 ? adults[sheetAdultIndex] : undefined;
  const closeSheet = () => { if (timer.current !== undefined) void persist(); setSheet(null); };

  return <div className="app-page fam-page">
    <FamilyHero name={p.familyName || "Nhà mình"} motto={p.household?.motto} theme={p.household?.theme ?? "aurora"} members={members} headline={headline} lines={lines}
      onMember={(member) => { if (member.kind === "adult") setSheet({ kind: "adult", id: member.id }); else if (children.length > 1 && member.id !== selectedChild?.id) { setSelected(member.id); document.getElementById("fam-kids")?.scrollIntoView({ behavior: "smooth", block: "start" }); } else setSheet({ kind: "childLook", id: member.id }); }}
      onAddChild={children.length < 5 ? () => setSheet({ kind: "addChild" }) : undefined} onEditHousehold={() => setSheet({ kind: "household" })} />
    {(error || save === "saving" || save === "saved") && <p className={`fam-savebar${save === "error" ? " err" : ""}`} role="status">{error || status}</p>}
    <FamilyPulse tiles={tiles} />

    {children.length > 0 && <section className="fam-kids" id="fam-kids" aria-label="Các bé">
      <div className="fam-sec-h"><h2>{children.length > 1 ? "Các bé" : "Bé nhà mình"}</h2><small>chạm avatar để đổi biểu tượng · mọi thay đổi tự lưu</small></div>
      {children.length > 1 && <div className="fam-kid-tabs" role="tablist" aria-label="Chọn bé">{children.map((child) => { const look = childLooks.get(child.id)!; const on = child.id === selectedChild?.id; const months = child.birthDate ? ageShort(ageParts(child.birthDate, today)) : childAgeMonths(child) !== undefined ? `${childAgeMonths(child)} tháng` : ""; return <button type="button" role="tab" aria-selected={on} key={child.id} className={`fam-kt${on ? " on" : ""}`} onClick={() => setSelected(child.id)}><MemberAvatar name={names.get(child.id)!} color={look.color} emoji={look.emoji} size={36} />{names.get(child.id)}{months && ` · ${months}`}</button>; })}</div>}
      {selectedChild && <ChildSpotlight key={selectedChild.id} child={selectedChild} name={names.get(selectedChild.id)!} look={childLooks.get(selectedChild.id)!} today={today}
        onEdit={() => setSheet({ kind: "child", id: selectedChild.id })} onEditLook={() => setSheet({ kind: "childLook", id: selectedChild.id })} />}
    </section>}
    {children.length === 0 && <section className="app-card fam-nokid"><span aria-hidden="true">👶</span><div><b>{p.household?.setup === "expecting" ? "Đang chờ bé chào đời" : "Chưa có hồ sơ bé"}</b><p className="fam-hint">Thêm bé để thấy tuổi, sinh nhật và mốc ngày tuổi.</p></div><button type="button" className="app-btn" onClick={() => setSheet({ kind: "addChild" })}>＋ Thêm bé</button></section>}

    {/* Lối vào module Du lịch (plan 261010-1335 §3.1: thẻ Home + lối vào ở Gia đình, không thêm tab). */}
    <Link className="app-card fam-travel" href="/travel"><span className="fam-travel-emoji" aria-hidden="true">🧳</span><div><b>Chuyến đi của nhà mình</b><p className="fam-hint">Lịch trình theo ngày, checklist đồ gợi ý theo các bé, chi phí nối vào sổ Tài chính.</p></div><span className="fam-travel-go">Mở →</span></Link>

    <details className="app-card fam-acct" id="account" open={accountOpen} onToggle={(event) => setAccountOpen((event.target as HTMLDetailsElement).open)}>
      <summary>🔒 Tài khoản & quyền riêng tư</summary>
      <AccountSection cloud={cloudEnabled} aiConsent={p.aiConsent} onAiConsent={(value) => change({ ...p, aiConsent: value }, true)} onErase={() => void erase()} onSignOut={() => void signOut()} />
    </details>

    <SideSheet open={sheet?.kind === "household"} title="Tùy chỉnh gia đình" status={status} onClose={closeSheet}>
      <HouseholdForm profile={p} members={adults.map((member, index) => { const look = adultLook(member, index); const name = adultName(member, index, account.name); return { member, name, look: { name, color: look.color, emoji: look.emoji, photo: photoOf(member.id) } }; })}
        onChange={(patch) => change({ ...p, ...("familyName" in patch ? { familyName: patch.familyName || undefined } : {}), household: { ...p.household, ...("motto" in patch ? { motto: patch.motto?.trim() ? patch.motto : undefined } : {}), ...(patch.theme ? { theme: patch.theme } : {}) } }, Boolean(patch.theme))}
        onMember={(id) => setSheet({ kind: "adult", id })} onAddMember={() => { const id = newMemberId(); setAdults([...adults, { id }], true); setSheet({ kind: "adult", id }); }} />
    </SideSheet>

    <SideSheet open={Boolean(sheetAdult)} title={sheetAdult ? adultName(sheetAdult, sheetAdultIndex, account.name) : ""} status={status} onClose={closeSheet}>
      {sheetAdult && <>
        <AvatarEditor name={adultName(sheetAdult, sheetAdultIndex, account.name)} color={adultLook(sheetAdult, sheetAdultIndex).color} emoji={sheetAdult.emoji} photo={photoOf(sheetAdult.id)}
          onLook={(look) => setAdults(adults.map((member) => member.id === sheetAdult.id ? { ...member, ...look } : member), true)} />
        <AdultForm member={sheetAdult} canRemove={adults.length > 1 && sheetAdult.id !== "me"} onChange={(patch) => setAdults(adults.map((member) => member.id === sheetAdult.id ? { ...member, ...patch } : member), "role" in patch)}
          onRemove={() => { setAdults(adults.filter((member) => member.id !== sheetAdult.id), true); setSheet({ kind: "household" }); }} />
        {sheetAdult.id === "me" && account.avatarUrl && <p className="fam-hint">Đang dùng ảnh tài khoản Google.</p>}
      </>}
    </SideSheet>

    <SideSheet open={sheet?.kind === "childLook" && Boolean(sheetChild)} title={sheetChild ? `Biểu tượng & màu của ${names.get(sheetChild.id)}` : ""} status={status} onClose={closeSheet}>
      {sheetChild && <AvatarEditor name={names.get(sheetChild.id)!} color={childLooks.get(sheetChild.id)!.color} emoji={childLooks.get(sheetChild.id)!.emoji}
        onLook={(look: { color: AvatarColor; emoji?: string }) => change(withChildLook(p, sheetChild.id, look as MemberLook), true)} />}
    </SideSheet>

    <SideSheet open={sheet?.kind === "child" && Boolean(sheetChild)} title={sheetChild ? `Hồ sơ ${names.get(sheetChild.id)}` : ""} status={status} onClose={closeSheet}>
      {sheetChild && <ChildForm child={sheetChild} today={today} onChange={(patch) => updateChild(sheetChild.id, patch)} onRemove={() => removeChild(sheetChild, sheetChildIndex)} />}
    </SideSheet>

    <SideSheet open={sheet?.kind === "addChild"} title="Thêm bé" onClose={() => setSheet(null)}>
      <form className="fam-form" onSubmit={(event) => { event.preventDefault(); addChild(); }}>
        <label className="fam-field"><span className="fam-label">Tên gọi</span><input value={newChild.name} maxLength={80} placeholder="Ví dụ: Bơ" onChange={(event) => setNewChild((value) => ({ ...value, name: event.target.value }))} /></label>
        <div className="fam-field"><span className="fam-label">Bé trai hay bé gái</span><div className="fam-seg" role="radiogroup" aria-label="Giới tính">{([["male", "👦 Bé trai"], ["female", "👧 Bé gái"]] as const).map(([value, label]) => <button type="button" role="radio" key={value} aria-checked={newChild.sex === value} className={newChild.sex === value ? "on" : ""} onClick={() => setNewChild((current) => ({ ...current, sex: current.sex === value ? undefined : value }))}>{label}</button>)}</div></div>
        <label className="fam-field"><span className="fam-label">Ngày sinh</span><input type="date" max={today} value={newChild.birthDate} onChange={(event) => setNewChild((value) => ({ ...value, birthDate: event.target.value }))} /></label>
        <button className="app-btn" type="submit">Thêm bé</button>
      </form>
    </SideSheet>

  </div>;
}

