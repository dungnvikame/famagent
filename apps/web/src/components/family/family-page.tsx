"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app-shell/use-account";
import { AccountSection } from "@/components/account-section";
import { CareMethodChooser } from "@/components/care/care-method-chooser";
import type { FamilyNote } from "@/lib/ai/notes";
import { dayIndex, localDay } from "@/lib/brief/daily-tasks";
import { loadDone, setDone } from "@/lib/brief/routine-client";
import { careMethodById } from "@/lib/care/methods";
import { clearCloudData, cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { stampChanges } from "@/lib/experience/profile-meta";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import { clearAllData, getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import type { AdultMember, ChildProfile, FamilyProfile, MemberLook } from "@/lib/experience/types";
import { validProfile } from "@/lib/experience/validate";
import { ageParts, ageShort, dayMilestone, nextBirthday, shortDate, weightSeries, type WeightPoint } from "@/lib/family/child-stats";
import { dueLine, measureDue, type MeasureEvery } from "@/lib/family/measure-schedule";
import { justEntered, type MilestoneRecord, type MilestoneStatus } from "@/lib/family/milestones";
import { deleteMeasure, lastMeasureDays, loadAvatars, loadMeasures, loadMilestones, saveMilestone, removeAvatar, saveAvatar, saveMeasure, type ChildMeasure } from "@/lib/family/client";
import { adultLook, adultMembers, adultName, childLook, childName, newMemberId, ROLE_LABELS, withChildLook, withMembers, type AvatarColor } from "@/lib/family/members";
import { loadMoney } from "@/lib/money/client";
import { monthKey, shortVnd, summarizeMonth, type MonthSummary } from "@/lib/money/summary";
import { loadNotes } from "@/lib/notes/client";
import { loadShopping } from "@/lib/shopping/item-client";
import { CHILD_CATEGORIES, estimateItems, itemRateResolver, type ItemEstimate } from "@/lib/shopping/items";
import { createAuthBrowserClient } from "@/lib/supabase/browser";
import { AvatarEditor } from "./avatar-editor";
import { ChildForm } from "./child-form";
import { ChildSpotlight } from "./child-spotlight";
import { FamilyHero, FamilyPulse, type HeroMember, type PulseTile, type TodayLine } from "./family-hero";
import { FamilyMemory } from "./family-memory";
import { MemberAvatar } from "./member-avatar";
import { AdultForm, CarePane, HouseholdForm, PrefsForm, PrefsPane } from "./family-panels";
import { SideSheet } from "./side-sheet";

type Sheet = { kind: "child" | "childLook" | "adult"; id: string } | { kind: "household" | "prefs" | "care" | "addChild" } | null;
type SaveState = "idle" | "saving" | "saved" | "error";
/** VN noon of a weighing day, so fieldMeta keeps the day the child was weighed (the chart and the server log read it). */
const weighedAt = (date: string) => `${date}T12:00:00+07:00`;
/** Weighings of one child from the day measurements (weight present). */
const weighings = (rows: ChildMeasure[], childId: string) => rows.flatMap((row) => row.childId === childId && row.kg !== undefined ? [{ id: row.id, date: row.date, kg: row.kg }] : []);
const vnDay = (iso?: string) => iso && !Number.isNaN(Date.parse(iso)) ? new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10) : undefined;

/**
 * Gia đình (plan 260929-1508): a personal family page instead of a long form — cover with everyone's avatar,
 * today's notes, four pulse numbers, one spotlight per child (age, today's practice, growth chart), what FamAgent
 * remembers, then priorities, parenting approach and account. Every field saves on its own ("Đã lưu").
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
  const [notes, setNotes] = useState<FamilyNote[] | null>(null);
  const [measures, setMeasures] = useState<ChildMeasure[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [done, setDoneIds] = useState<string[]>([]);
  const [money, setMoney] = useState<MonthSummary | null>(null);
  const [stock, setStock] = useState<ItemEstimate[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [newChild, setNewChild] = useState<{ name: string; birthDate: string; sex?: "male" | "female" }>({ name: "", birthDate: "" });

  const original = useRef<FamilyProfile | null>(null);
  const latest = useRef<FamilyProfile | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const weightDates = useRef<Record<string, string>>({});
  const today = localDay(new Date());

  const reloadNotes = useCallback(() => loadNotes().then(setNotes).catch(() => setNotes([])), []);
  useEffect(() => {
    let cancelled = false;
    (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then((value) => {
      if (cancelled) return;
      original.current = value; latest.current = value; setProfile(value); setLoaded(true);
      if (!value) return;
      void reloadNotes();
      loadMeasures().then((rows) => { if (!cancelled) setMeasures(rows); }).catch(() => {});
      loadMilestones().then((rows) => { if (!cancelled) setMilestones(rows); }).catch(() => {});
      loadAvatars().then((rows) => { if (!cancelled) setAvatars(rows); }).catch(() => {});
      loadDone().then((byDay) => { if (!cancelled) setDoneIds(byDay[localDay(new Date())] ?? []); }).catch(() => {});
      loadMoney(monthKey(new Date())).then((bundle) => { if (!cancelled) setMoney(summarizeMonth(bundle)); }).catch(() => {});
      loadShopping().then((shopping) => { if (!cancelled) setStock(estimateItems(shopping.items, shopping.purchases, itemRateResolver(value), new Date(), shopping.checks)); }).catch(() => {});
    }).catch(() => { if (!cancelled) { setLoadError("Không thể tải hồ sơ."); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [reloadNotes]);
  useEffect(() => { if (typeof window !== "undefined" && window.location.hash === "#account") setAccountOpen(true); }, [loaded]);

  /** Serialised save of the latest profile: provenance stamps, weighing dates, then cloud + this device. */
  const persist = useCallback(() => {
    window.clearTimeout(timer.current); timer.current = undefined;
    queue.current = queue.current.then(async () => {
      const next = latest.current;
      if (!next) return;
      setSave("saving");
      let updated = stampChanges(original.current, { ...next, updatedAt: new Date().toISOString() }, "user_entered");
      for (const [id, date] of Object.entries(weightDates.current)) {
        const key = `children.${id}.weightKg`;
        if (updated.fieldMeta?.[key]) updated = { ...updated, fieldMeta: { ...updated.fieldMeta, [key]: { ...updated.fieldMeta[key], observedAt: weighedAt(date) } } };
      }
      if (!validProfile(updated)) { setSave("error"); setError("Một số thông tin chưa hợp lệ (tên ≤ 80 ký tự, ngân sách từ 50.000đ, ngày sinh không ở tương lai)."); return; }
      try {
        if (cloudEnabled) await saveCloudProfile(updated);
        saveProfile(updated);
        weightDates.current = {};
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
  const heightsOf = (childId: string) => measures.flatMap((row) => row.childId === childId && row.cm !== undefined ? [{ id: row.id, date: row.date, cm: row.cm }] : []).sort((a, b) => a.date.localeCompare(b.date));
  const series = useCallback((child: ChildProfile): WeightPoint[] => weightSeries(weighings(measures, child.id), { kg: child.weightKg, date: vnDay(profile?.fieldMeta?.[`children.${child.id}.weightKg`]?.observedAt) ?? vnDay(profile?.updatedAt) }), [measures, profile]);

  if (!loaded) return <div className="app-page" aria-busy="true"><p className="app-sub">Đang mở hồ sơ gia đình…</p></div>;
  if (!profile) return <div className="app-page"><div className="app-card fam-empty"><h1>Chưa có hồ sơ gia đình</h1>{loadError && <p className="form-error">{loadError}</p>}<p className="app-sub">Trả lời vài câu để FamAgent hiểu nhà mình.</p><Link className="app-btn" href="/onboarding">Bắt đầu →</Link></div></div>;

  const p = profile;
  // Reads the newest profile (not this render's): weight saves call it after an await, while typing may continue.
  const updateChild = (id: string, patch: Partial<ChildProfile>, immediate = false) => { const base = latest.current ?? p; change({ ...base, children: base.children.map((child) => child.id === id ? { ...child, ...patch } : child) }, immediate); };
  const adults = adultMembers(p);
  const setAdults = (members: AdultMember[], immediate = false) => change(withMembers(p, members), immediate);
  const photoOf = (id: string) => avatars[id] ?? (id === "me" ? account.avatarUrl : undefined);
  const childLooks = new Map(children.map((child, index) => [child.id, childLook(p, child, index)]));
  const names = new Map(children.map((child, index) => [child.id, childName(child, index)]));
  const hasKids = children.length > 0 || p.household?.setup === "expecting";

  async function setPhoto(id: string, image: string | null) {
    if (image) await saveAvatar(id, image); else await removeAvatar(id);
    setAvatars((current) => { const next = { ...current }; if (image) next[id] = image; else delete next[id]; return next; });
    setSave("saved");
  }
  /** A day's weight and/or height; a newest weight also becomes the profile weight (size, shopping). */
  async function addMeasure(child: ChildProfile, date: string, values: { kg?: number; cm?: number }) {
    if (timer.current !== undefined) await persist();
    const last = series(child).at(-1);
    const id = await saveMeasure(child.id, date, values);
    setMeasures((rows) => { const same = rows.find((row) => row.childId === child.id && row.date === date); return [...rows.filter((row) => row !== same), { ...same, id, childId: child.id, date, ...values }]; });
    if (values.kg !== undefined && (!last || date >= last.date)) { weightDates.current[child.id] = date; updateChild(child.id, { weightKg: values.kg }, true); }
    if (values.kg !== undefined) trackEvent("child_weight_logged");
    if (values.cm !== undefined) trackEvent("child_height_logged");
  }
  async function removeMeasure(child: ChildProfile, id: string, field: "kg" | "cm") {
    const removed = measures.find((row) => row.id === id);
    await deleteMeasure(id, field);
    const rest = measures.flatMap((row) => { if (row.id !== id) return [row]; const next = { ...row, [field]: undefined }; return next.kg === undefined && next.cm === undefined ? [] : [next]; });
    setMeasures(rest);
    if (field !== "kg" || removed?.kg === undefined) return;
    const previous = weightSeries(weighings(rest, child.id)).at(-1);
    // Deleting the newest weighing moves the profile weight back to the one before it.
    if (previous && child.weightKg === removed.kg && previous.date < removed.date) { weightDates.current[child.id] = previous.date; updateChild(child.id, { weightKg: previous.kg }, true); }
  }
  /** Optimistic mark; rolled back when the save fails (the panel shows the error). */
  async function markMilestone(childId: string, milestoneId: string, status: MilestoneStatus | null, on?: string) {
    const before = milestones;
    setMilestones((rows) => [...rows.filter((row) => !(row.childId === childId && row.milestoneId === milestoneId)), ...(status ? [{ childId, milestoneId, status, ...(on ? { on } : {}) }] : [])]);
    try { await saveMilestone(childId, milestoneId, status, on); if (status) trackEvent(milestoneId.startsWith("tip-") ? "guide_tip_tried" : "milestone_marked", { status }); } catch (cause) { setMilestones(before); throw cause; }
  }
  async function togglePractice(id: string, on: boolean) {
    setDoneIds((ids) => on ? [...ids, id] : ids.filter((item) => item !== id));
    try { await setDone(today, id, on); } catch { setDoneIds((ids) => on ? ids.filter((item) => item !== id) : [...ids, id]); setError("Chưa lưu được việc đã làm."); }
  }
  function addChild() {
    if (p.children.length >= 5) return;
    const child: ChildProfile = { id: crypto.randomUUID(), name: newChild.name.trim() || undefined, birthDate: newChild.birthDate || undefined, sex: newChild.sex };
    change({ ...p, children: [...p.children, child] }, true);
    setSelected(child.id); setSheet(null); setNewChild({ name: "", birthDate: "" });
  }
  function removeChild(child: ChildProfile, index: number) {
    if (!window.confirm(`Xóa hồ sơ ${childName(child, index)}? Lịch sử cân nặng và ảnh của bé cũng bị xóa.`)) return;
    const looks = { ...p.household?.looks }; delete looks[child.id];
    change({ ...p, children: p.children.filter((item) => item.id !== child.id), household: { ...p.household, looks: Object.keys(looks).length ? looks : undefined } }, true);
    void removeAvatar(child.id).catch(() => {});
    setSheet(null); setSelected(null);
  }
  async function erase() { if (!window.confirm("Xóa hồ sơ, lịch sử trò chuyện và sản phẩm đã lưu?")) return; try { if (cloudEnabled) await clearCloudData(); clearAllData(); router.push("/"); } catch { setError("Chưa xóa được toàn bộ dữ liệu. Vui lòng thử lại."); } }
  async function signOut() { const client = createAuthBrowserClient(); if (!client) return; const { error: authError } = await client.auth.signOut(); if (authError) { setError("Chưa đăng xuất được. Vui lòng thử lại."); return; } clearAllData(); router.push("/sign-in"); }

  // ---------- derived view data ----------
  const method = hasKids ? careMethodById(p.household?.careMethod) : undefined;
  const practiceIndex = method ? dayIndex(new Date()) % method.practices.length : 0;
  const practiceId = method ? `care:${method.id}:${practiceIndex}` : "";
  const members: HeroMember[] = [
    ...adults.map((member, index): HeroMember => { const look = adultLook(member, index); const name = adultName(member, index, account.name); return { id: member.id, kind: "adult", name, label: member.role ? ROLE_LABELS[member.role] : member.id === "me" ? "Bạn" : name, color: look.color, emoji: look.emoji, photo: photoOf(member.id) }; }),
    ...children.map((child): HeroMember => { const look = childLooks.get(child.id)!; return { id: child.id, kind: "child", name: names.get(child.id)!, label: names.get(child.id)!, color: look.color, emoji: look.emoji, photo: avatars[child.id], selected: children.length > 1 && child.id === selectedChild?.id }; }),
  ];
  // Measuring schedule per child: last weighing (log or profile) and last height, on the family's cadence.
  const every: MeasureEvery = p.household?.measureEvery ?? "auto";
  const lastDays = lastMeasureDays(measures);
  const dueOf = (child: ChildProfile) => measureDue({ ageMonths: child.birthDate ? ageParts(child.birthDate, today).totalMonths : childAgeMonths(child), lastWeight: series(child).at(-1)?.date, lastHeight: lastDays[child.id]?.height, today, every });
  const lines: TodayLine[] = [];
  for (const child of children) { const entered = child.birthDate ? justEntered(child.birthDate, today) : undefined; if (entered) lines.push({ icon: "🌟", text: <><b>{names.get(child.id)}</b> vừa sang mốc {entered.label} — {entered.items.length} điều bé thường làm được</>, href: "#fam-milestones" }); }
  for (const child of children) { const due = dueOf(child); if (due && due.state !== "ok") lines.push({ icon: due.state === "due" ? "⏰" : "📅", text: <><b>{names.get(child.id)}</b>: {dueLine(due, today)}</> }); }
  for (const child of children) {
    if (!child.birthDate) continue;
    const name = names.get(child.id)!;
    const birthday = nextBirthday(child.birthDate, today), milestone = dayMilestone(child.birthDate, today);
    if (birthday.isToday) lines.push({ icon: "🎉", text: <>Sinh nhật {birthday.turning} tuổi của <b>{name}</b> — chúc mừng cả nhà!</> });
    else if (birthday.daysLeft <= 30) lines.push({ icon: "🎂", text: <>Còn {birthday.daysLeft} ngày nữa {name} tròn {birthday.turning} tuổi</> });
    if (milestone && (milestone.isToday || milestone.daysLeft <= 60)) lines.push({ icon: "✨", text: milestone.isToday ? <>Hôm nay {name} tròn <b>{milestone.day.toLocaleString("vi-VN")} ngày</b>!</> : <>{name} tròn {milestone.day.toLocaleString("vi-VN")} ngày vào {shortDate(milestone.date, today)} (còn {milestone.daysLeft} ngày)</> });
  }
  const low = stock.filter((item) => item.known && item.daysLeft !== null && item.daysLeft <= 7).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  for (const item of low.slice(0, 2)) lines.push({ icon: "🧷", text: `${item.item.name} ${item.daysLeft === 0 ? "ước tính đã hết" : `còn ~${item.daysLeft} ngày`}`, href: "/shopping" });
  for (const due of (money?.upcoming ?? []).filter((item) => item.kind === "expense" && item.daysLeft >= 0 && item.daysLeft <= 7).slice(0, 2)) lines.push({ icon: "📅", text: `${due.name} đến hạn ${shortDate(due.dueOn, today)}${due.daysLeft === 0 ? " (hôm nay)" : ""}`, href: "/money" });
  if (method && !done.includes(practiceId)) lines.push({ icon: "🌱", text: `Việc nuôi dạy hôm nay: ${method.practices[practiceIndex]}` });
  if (!lines.length) lines.push({ icon: "☀️", text: "Mọi thứ đang ổn — chưa có việc gì cần để ý." });
  const since = p.onboardedAt ? Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${vnDay(p.onboardedAt)}T00:00:00Z`)) / 86_400_000) + 1) : undefined;
  const headlineChild = selectedChild?.birthDate ? { name: names.get(selectedChild.id)!, day: ageParts(selectedChild.birthDate, today).dayNumber } : undefined;
  const headline = headlineChild ? <>{headlineChild.name} đang ở <em>ngày thứ {headlineChild.day.toLocaleString("vi-VN")}</em></> : since ? <>FamAgent đồng hành cùng nhà mình <em>{since} ngày</em></> : <>Chào mừng về nhà</>;

  const childStock = stock.filter((item) => item.known && CHILD_CATEGORIES.has(item.item.category) && item.daysLeft !== null).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const tiles: PulseTile[] = [];
  if (childStock.length) { const first = childStock[0]; tiles.push({ key: "stock", icon: "🧷", label: "Đồ cho bé", value: first.daysLeft === 0 ? "Đã hết" : `~${first.daysLeft} ngày`, detail: `${first.item.name} sắp hết nhất${childStock[1] ? ` · ${childStock[1].item.name} còn ${childStock[1].daysLeft} ngày` : ""}`, cta: "Mua sắm", href: "/shopping", tone: (first.daysLeft ?? 99) <= 7 ? "warn" : undefined }); }
  if (money && money.childSpend > 0) tiles.push({ key: "money", icon: "💜", label: `Chi cho con · T${Number(money.month.slice(5))}`, value: shortVnd(money.childSpend), detail: money.expense ? `${Math.round(money.childSpend / money.expense * 100)}% tổng chi tháng này` : "các khoản đánh dấu “cho con”", cta: "Tài chính", href: "/money" });
  if (hasKids) tiles.push({ key: "care", icon: "🌱", label: "Nuôi dạy", value: method?.name ?? "Chưa chọn", detail: method ? method.ages.label : "Chọn để nhận việc nhỏ mỗi ngày", cta: method ? "Xem việc làm" : "Chọn", onClick: () => setSheet({ kind: "care" }) });
  if (notes) { const pending = notes.filter((note) => note.status !== "confirmed").length; tiles.push({ key: "memory", icon: "🧠", label: "FamAgent nhớ", value: `${notes.length} điều`, detail: pending ? `${pending} điều chờ bạn xác nhận` : notes.length ? "Tất cả đã xác nhận" : "Kể với Trợ lý để FamAgent nhớ", cta: "Xem", onClick: () => document.getElementById("memory")?.scrollIntoView({ behavior: "smooth" }), tone: pending ? "warn" : undefined }); }

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
      <div className="fam-sec-h"><h2>{children.length > 1 ? "Các bé" : "Bé nhà mình"}</h2><small>chạm avatar để đổi ảnh · mọi thay đổi tự lưu</small></div>
      {children.length > 1 && <div className="fam-kid-tabs" role="tablist" aria-label="Chọn bé">{children.map((child) => { const look = childLooks.get(child.id)!; const on = child.id === selectedChild?.id; const months = child.birthDate ? ageShort(ageParts(child.birthDate, today)) : childAgeMonths(child) !== undefined ? `${childAgeMonths(child)} tháng` : ""; return <button type="button" role="tab" aria-selected={on} key={child.id} className={`fam-kt${on ? " on" : ""}`} onClick={() => setSelected(child.id)}><MemberAvatar name={names.get(child.id)!} color={look.color} emoji={look.emoji} photo={avatars[child.id]} size={36} />{names.get(child.id)}{months && ` · ${months}`}</button>; })}</div>}
      {selectedChild && <ChildSpotlight key={selectedChild.id} child={selectedChild} name={names.get(selectedChild.id)!} look={childLooks.get(selectedChild.id)!} photo={avatars[selectedChild.id]} today={today}
        series={series(selectedChild)} heights={heightsOf(selectedChild.id)} notes={(notes ?? []).filter((note) => note.childId === selectedChild.id || (!note.childId && children.length === 1))}
        practice={method ? { id: practiceId, title: method.practices[practiceIndex], source: method.name, done: done.includes(practiceId) } : undefined}
        onTogglePractice={() => void togglePractice(practiceId, !done.includes(practiceId))}
        onEdit={() => setSheet({ kind: "child", id: selectedChild.id })} onEditLook={() => setSheet({ kind: "childLook", id: selectedChild.id })}
        onAddMeasure={(date, values) => addMeasure(selectedChild, date, values)} onDeleteMeasure={(id, field) => removeMeasure(selectedChild, id, field)}
        onUseSize={(size) => updateChild(selectedChild.id, { diaperSize: size }, true)} onSetSex={(sex) => updateChild(selectedChild.id, { sex }, true)}
        tipPush={p.household?.tipPush !== false} onTipPush={(on) => { change({ ...p, household: { ...p.household, tipPush: on ? undefined : false } }, true); trackEvent("guide_tip_push_set", { on }); }}
        milestones={milestones.filter((row) => row.childId === selectedChild.id)} onMarkMilestone={(id, status, on) => markMilestone(selectedChild.id, id, status, on)}
        due={dueOf(selectedChild)} every={every} onEvery={(value) => { change({ ...p, household: { ...p.household, measureEvery: value === "auto" ? undefined : value } }, true); trackEvent("measure_reminder_set", { every: value }); }} />}
    </section>}
    {children.length === 0 && <section className="app-card fam-nokid"><span aria-hidden="true">👶</span><div><b>{p.household?.setup === "expecting" ? "Đang chờ bé chào đời" : "Chưa có hồ sơ bé"}</b><p className="fam-hint">Thêm bé để thấy tuổi, mốc ngày tuổi, biểu đồ cân nặng và gợi ý size bỉm.</p></div><button type="button" className="app-btn" onClick={() => setSheet({ kind: "addChild" })}>＋ Thêm bé</button></section>}

    <FamilyMemory notes={notes} childNames={names} onChanged={reloadNotes} />
    <div className="fam-duo"><PrefsPane profile={p} onEdit={() => setSheet({ kind: "prefs" })} />{hasKids && <CarePane profile={p} onChoose={() => setSheet({ kind: "care" })} />}</div>

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
          onLook={(look) => setAdults(adults.map((member) => member.id === sheetAdult.id ? { ...member, ...look } : member), true)} onPhoto={(image) => setPhoto(sheetAdult.id, image)} />
        <AdultForm member={sheetAdult} canRemove={adults.length > 1 && sheetAdult.id !== "me"} onChange={(patch) => setAdults(adults.map((member) => member.id === sheetAdult.id ? { ...member, ...patch } : member), "role" in patch)}
          onRemove={() => { setAdults(adults.filter((member) => member.id !== sheetAdult.id), true); void removeAvatar(sheetAdult.id).catch(() => {}); setSheet({ kind: "household" }); }} />
        {sheetAdult.id === "me" && account.avatarUrl && !avatars.me && <p className="fam-hint">Đang dùng ảnh tài khoản Google. Tải ảnh khác hoặc chọn biểu tượng để thay.</p>}
      </>}
    </SideSheet>

    <SideSheet open={sheet?.kind === "childLook" && Boolean(sheetChild)} title={sheetChild ? `Ảnh & màu của ${names.get(sheetChild.id)}` : ""} status={status} onClose={closeSheet}>
      {sheetChild && <AvatarEditor name={names.get(sheetChild.id)!} color={childLooks.get(sheetChild.id)!.color} emoji={childLooks.get(sheetChild.id)!.emoji} photo={avatars[sheetChild.id]}
        onLook={(look: { color: AvatarColor; emoji?: string }) => change(withChildLook(p, sheetChild.id, look as MemberLook), true)} onPhoto={(image) => setPhoto(sheetChild.id, image)} />}
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
        <p className="fam-hint">Cân nặng, size bỉm, thương hiệu… bổ sung sau trong hồ sơ của bé.</p>
      </form>
    </SideSheet>

    <SideSheet open={sheet?.kind === "prefs"} title="Nhà mình ưu tiên" status={status} onClose={closeSheet}>
      <PrefsForm profile={p} onChange={(patch) => change({ ...p, ...patch }, "pricePreference" in patch || "deliveryPreference" in patch)} />
    </SideSheet>

    <SideSheet open={sheet?.kind === "care"} title="Cách nuôi dạy" status={status} onClose={closeSheet}>
      <p className="fam-hint" style={{ marginTop: 0 }}>FamAgent gợi ý, gia đình quyết định. Chọn là lưu ngay.</p>
      <CareMethodChooser profile={p} value={method?.id} onChange={(id) => { change({ ...p, household: { ...p.household, careMethod: id } }, true); trackEvent("care_method_chosen", { method: id, source: "family" }); }} />
    </SideSheet>
  </div>;
}

