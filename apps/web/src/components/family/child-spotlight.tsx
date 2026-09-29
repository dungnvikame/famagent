"use client";

import type { FamilyNote } from "@/lib/ai/notes";
import { screenGuide, sleepRange } from "@/lib/care/nurturing";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import type { ChildProfile } from "@/lib/experience/types";
import { ageParts, ageText, dayMilestone, nextBirthday, shortDate, sizeOutlook, growthPerMonth, type WeightPoint } from "@/lib/family/child-stats";
import { COLOR_STYLES, SENSITIVITY_LABELS, type AvatarColor } from "@/lib/family/members";
import { MemberAvatar } from "./member-avatar";
import { GrowthChart, type HeightPoint } from "./growth-chart";
import { MilestonesPanel } from "./milestones-panel";
import { AgeGuide } from "./age-guide";
import { ageMonthsExact, type MilestoneRecord, type MilestoneStatus } from "@/lib/family/milestones";
import { MEASURE_EVERY, MEASURE_EVERY_LABELS, cadenceText, dueLine, type MeasureDue, type MeasureEvery } from "@/lib/family/measure-schedule";

export interface TodayPractice { id: string; title: string; source: string; done: boolean }

/**
 * One child, age first (Huckleberry/BabyCenter style): the ring counts the way to the next birthday, then what to do
 * with them today, the growth line on diaper sizes, and what to watch for when buying — all from data already known.
 */
export function ChildSpotlight({ child, name, look, photo, today, series, heights, notes, practice, onTogglePractice, onEdit, onEditLook, onAddMeasure, onDeleteMeasure, onUseSize, onSetSex, due, every, onEvery, milestones, onMarkMilestone }: {
  child: ChildProfile; name: string; look: { color: AvatarColor; emoji?: string }; photo?: string; today: string;
  series: WeightPoint[]; heights: HeightPoint[]; notes: FamilyNote[]; practice?: TodayPractice;
  onTogglePractice: () => void; onEdit: () => void; onEditLook: () => void;
  onAddMeasure: (date: string, values: { kg?: number; cm?: number }) => Promise<void>; onDeleteMeasure: (id: string, field: "kg" | "cm") => Promise<void>; onUseSize: (size: string) => void; onSetSex: (sex: "male" | "female") => void;
  due: MeasureDue | null; every: MeasureEvery; onEvery: (every: MeasureEvery) => void;
  milestones: MilestoneRecord[]; onMarkMilestone: (milestoneId: string, status: MilestoneStatus | null, on?: string) => Promise<void>;
}) {
  const style = COLOR_STYLES[look.color];
  const months = child.birthDate ? ageParts(child.birthDate, today).totalMonths : childAgeMonths(child);
  const age = child.birthDate ? ageParts(child.birthDate, today) : undefined;
  const birthday = child.birthDate ? nextBirthday(child.birthDate, today) : undefined;
  const milestone = child.birthDate ? dayMilestone(child.birthDate, today) : null;
  const r = 70, circ = 2 * Math.PI * r;
  const outlook = sizeOutlook(series, growthPerMonth(series));
  const usesDiapers = Boolean(child.diaperSize) || (months !== undefined && months < 36);
  const suggestSize = usesDiapers && outlook && child.diaperSize && !outlook.size.split("/").includes(child.diaperSize) ? outlook.size.split("/").at(-1)! : undefined;
  const avoidReason = (brand: string) => notes.find((note) => note.brand?.toLocaleLowerCase("vi") === brand.toLocaleLowerCase("vi"))?.text;
  const health = notes.filter((note) => note.kind === "health" && note.status === "confirmed" && !(note.brand && child.dislikedBrands?.some((brand) => brand.toLocaleLowerCase("vi") === note.brand!.toLocaleLowerCase("vi"))));
  const tags = [
    ...(child.sensitivities ?? []).map((value) => <span key={value} className="fam-tag care">⚠️ {SENSITIVITY_LABELS[value]}</span>),
    ...health.map((note) => <span key={note.id} className="fam-tag care">🩺 {note.text} <small>· ghi nhớ {shortDate(note.createdAt.slice(0, 10), today)}</small></span>),
    ...(child.currentBrand ? [<span key="cur" className="fam-tag">Đang dùng <b>{child.currentBrand}</b></span>] : []),
    ...(child.preferredBrands ?? []).map((brand) => <span key={`y-${brand}`} className="fam-tag yes">♥ {brand}</span>),
    ...(child.dislikedBrands ?? []).map((brand) => { const why = avoidReason(brand); return <span key={`n-${brand}`} className="fam-tag no">✕ {brand}{why && <small> · {why}</small>}</span>; }),
  ];

  return <section className={`app-card fam-kid${birthday?.isToday ? " party" : ""}`} style={{ ["--kid-tint" as string]: style.tint, ["--kid-grad" as string]: style.grad, ["--kid-ink" as string]: style.ink, ["--kid-dot" as string]: style.dot }} aria-label={`Hồ sơ ${name}`}>
    <div className="fam-kid-id">
      {birthday?.isToday && <div className="fam-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ left: `${(index * 7.3) % 100}%`, animationDelay: `${(index % 7) * 0.35}s` }} />)}</div>}
      <button type="button" className="fam-ring" onClick={onEditLook} aria-label={`Đổi ảnh đại diện của ${name}`} title={birthday ? `Chặng đường tới sinh nhật ${birthday.turning} tuổi` : undefined}>
        <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r={r} fill="none" stroke="#ffffffb0" strokeWidth="10" />{birthday && <circle cx="80" cy="80" r={r} fill="none" stroke={style.dot} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - birthday.progress)} className="fam-ring-arc" />}</svg>
        <MemberAvatar name={name} color={look.color} emoji={look.emoji} photo={photo} size={124} className="fam-ring-face" />
        <span className="fam-ring-edit" aria-hidden="true">✎</span>
        {birthday && <span className="fam-ring-badge">{birthday.isToday ? "🎉 Hôm nay!" : `🎂 còn ${birthday.daysLeft} ngày`}</span>}
      </button>
      <h2>{name}</h2>
      <div className="fam-kid-age">{age ? ageText(age) : months !== undefined ? `khoảng ${months} tháng` : "Chưa có tuổi"}</div>
      {(series.at(-1) || heights.at(-1)) && <div className="fam-kid-size">{[heights.at(-1) && `📏 ${heights.at(-1)!.cm.toLocaleString("vi-VN")} cm`, series.at(-1) && `⚖️ ${series.at(-1)!.kg.toLocaleString("vi-VN")} kg`].filter(Boolean).join(" · ")}</div>}
      <div className="fam-kid-born">{child.birthDate ? `Sinh ${shortDate(child.birthDate)}${age ? ` · ngày thứ ${age.dayNumber.toLocaleString("vi-VN")}` : ""}` : <button type="button" className="link-btn" onClick={onEdit}>Thêm ngày sinh để xem sinh nhật & mốc ngày tuổi</button>}</div>
      {(milestone || birthday) && <div className="fam-moments">
        {birthday?.isToday && <div className="fam-mo hi"><i>🎉</i><div><b>Chúc mừng sinh nhật {name}!</b>Tròn {birthday.turning} tuổi hôm nay</div></div>}
        {milestone && <div className={`fam-mo${milestone.isToday ? " hi" : ""}`}><i>✨</i><div><b>{milestone.day.toLocaleString("vi-VN")} ngày tuổi</b>{milestone.isToday ? "Chính là hôm nay!" : `${shortDate(milestone.date, today)} · còn ${milestone.daysLeft} ngày`}</div></div>}
        {birthday && !birthday.isToday && <div className="fam-mo"><i>🎂</i><div><b>Tròn {birthday.turning} tuổi</b>{shortDate(birthday.date)} · còn {birthday.daysLeft} ngày</div></div>}
      </div>}
    </div>

    <div className="fam-kid-body">
      <div className="fam-blk wide"><h3>Hôm nay với {name}</h3>
        {practice && <div className="fam-tip"><span className="fam-tip-ico" aria-hidden="true">🌱</span><div><b>{practice.title}</b><small>{practice.source} · cũng có trong “Việc hôm nay” ở Trang chủ</small></div>
          <button type="button" className={`fam-tip-done${practice.done ? " on" : ""}`} aria-pressed={practice.done} onClick={onTogglePractice}>{practice.done ? "✓ Đã làm" : "Đã làm"}</button></div>}
        {months !== undefined && <div className="fam-guides">
          <span><i aria-hidden="true">😴</i><span><b>Ngủ {sleepRange(months).replace(" (khuyến nghị cho trẻ sơ sinh)", "")}/ngày</b><small>kể cả giấc trưa · AASM</small></span></span>
          <span><i aria-hidden="true">📵</i><span><b>{months < 24 ? "Chưa xem màn hình" : months < 60 ? "Màn hình ≤ 1 giờ/ngày" : "Có quy tắc màn hình"}</b><small>{screenGuide(months).text.split(".")[0].replace(/^WHO khuyến nghị /, "WHO: ")}</small></span></span>
        </div>}
        <small className="fam-hint">Tham khảo theo tuổi — không thay lời khuyên của bác sĩ.</small>
      </div>

      {months !== undefined && months < 72 && <div className="fam-blk wide" id="fam-guide"><h3>Cẩm nang chăm {name} theo tuổi <span className="sp" /><span className="fam-use">CDC · WHO · AAP</span></h3>
        <AgeGuide name={name} ageMonths={months} records={milestones.filter((record) => record.milestoneId.startsWith("tip-"))} onTried={(id, tried) => onMarkMilestone(id, tried ? "done" : null, tried ? today : undefined)} />
      </div>}

      <div className="fam-blk wide"><h3>Cân nặng & tăng trưởng <span className="sp" /><span className="fam-use">dùng cho: size bỉm · so chuẩn WHO</span></h3>
        <div className={`fam-sched ${due?.state ?? "off"}`} role="status">
          <span className="fam-sched-ico" aria-hidden="true">{due?.state === "due" ? "⏰" : "📅"}</span>
          <div><b>{due ? dueLine(due, today) : "Đã tắt nhắc cân đo"}</b><small>{due ? `Ở tuổi này nên cân đo ${cadenceText(due.interval)}. Bật thông báo ở mục Tài khoản để được nhắc lúc 8 giờ sáng.` : "Bật lại để FamAgent nhắc khi đến lịch."}</small></div>
          <label className="fam-sched-every"><span className="sr-only">Tần suất nhắc</span><select value={every} onChange={(event) => onEvery(event.target.value as MeasureEvery)} aria-label="Tần suất nhắc cân đo">{MEASURE_EVERY.map((value) => <option key={value} value={value}>{MEASURE_EVERY_LABELS[value]}</option>)}</select></label>
          {due?.state === "due" && <button type="button" className="app-btn" onClick={(event) => { const input = event.currentTarget.closest(".fam-blk")?.querySelector<HTMLInputElement>(".fam-weight-add input[inputmode]"); input?.scrollIntoView({ behavior: "smooth", block: "center" }); input?.focus({ preventScroll: true }); }}>Ghi ngay</button>}
        </div>
        <GrowthChart weights={series} heights={heights} today={today} name={name} color={{ dot: style.dot, ink: style.ink }} onAdd={onAddMeasure} onDelete={onDeleteMeasure}
          who={{ sex: child.sex, birthDate: child.birthDate, showSize: usesDiapers, onSex: onSetSex, onAddBirth: onEdit }} />
        {suggestSize && <div className="fam-suggest">Theo cân nặng mới nhất, {name} hợp size <b>{suggestSize}</b> (đang ghi {child.diaperSize}).<button type="button" className="app-btn" onClick={() => onUseSize(suggestSize)}>Đổi sang {suggestSize}</button></div>}
        {!usesDiapers && <small className="fam-hint">{name} đã qua tuổi dùng bỉm nên FamAgent không lập kế hoạch bỉm cho con.</small>}
      </div>

      {months !== undefined && months < 72 && <div className="fam-blk wide" id="fam-milestones"><h3>Cột mốc phát triển <span className="sp" /><span className="fam-use">theo CDC · WHO</span></h3>
        <MilestonesPanel name={name} ageMonths={months} ageMonthsExact={child.birthDate ? ageMonthsExact(child.birthDate, today) : months} birthDate={child.birthDate} today={today} records={milestones.filter((record) => !record.milestoneId.startsWith("tip-"))} onMark={onMarkMilestone} />
      </div>}

      <div className="fam-blk wide"><h3>Lưu ý khi chọn đồ <span className="sp" /><span className="fam-use">dùng cho: gợi ý sản phẩm</span></h3>
        {tags.length ? <div className="fam-tags">{tags}</div> : <p className="fam-hint">Chưa có lưu ý. Kể với Trợ lý kiểu “{name} bị hăm với hãng X” hoặc bấm Sửa hồ sơ.</p>}
      </div>
      <div className="fam-kid-foot"><button type="button" className="app-btn ghost" onClick={onEditLook}>🎨 Ảnh & màu</button><button type="button" className="app-btn ghost" onClick={onEdit}>Sửa hồ sơ {name}</button></div>
    </div>
  </section>;
}
