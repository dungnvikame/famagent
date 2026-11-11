"use client";

import { childAgeMonths } from "@/lib/experience/profile-mapper";
import type { ChildProfile } from "@/lib/experience/types";
import { ageParts, ageText, dayMilestone, nextBirthday, shortDate } from "@/lib/family/child-stats";
import { COLOR_STYLES, type AvatarColor } from "@/lib/family/members";
import { MemberAvatar } from "./member-avatar";

/** One child, age first: the ring counts the way to the next birthday, then the day milestones coming up. */
export function ChildSpotlight({ child, name, look, today, onEdit, onEditLook }: {
  child: ChildProfile; name: string; look: { color: AvatarColor; emoji?: string }; today: string;
  onEdit: () => void; onEditLook: () => void;
}) {
  const style = COLOR_STYLES[look.color];
  const months = child.birthDate ? ageParts(child.birthDate, today).totalMonths : childAgeMonths(child);
  const age = child.birthDate ? ageParts(child.birthDate, today) : undefined;
  const birthday = child.birthDate ? nextBirthday(child.birthDate, today) : undefined;
  const milestone = child.birthDate ? dayMilestone(child.birthDate, today) : null;
  const r = 70, circ = 2 * Math.PI * r;

  return <section className={`app-card fam-kid${birthday?.isToday ? " party" : ""}`} style={{ ["--kid-tint" as string]: style.tint, ["--kid-grad" as string]: style.grad, ["--kid-ink" as string]: style.ink, ["--kid-dot" as string]: style.dot }} aria-label={`Hồ sơ ${name}`}>
    <div className="fam-kid-id">
      {birthday?.isToday && <div className="fam-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ left: `${(index * 7.3) % 100}%`, animationDelay: `${(index % 7) * 0.35}s` }} />)}</div>}
      <button type="button" className="fam-ring" onClick={onEditLook} aria-label={`Đổi biểu tượng của ${name}`} title={birthday ? `Chặng đường tới sinh nhật ${birthday.turning} tuổi` : undefined}>
        <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r={r} fill="none" stroke="#ffffffb0" strokeWidth="10" />{birthday && <circle cx="80" cy="80" r={r} fill="none" stroke={style.dot} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - birthday.progress)} className="fam-ring-arc" />}</svg>
        <MemberAvatar name={name} color={look.color} emoji={look.emoji} size={124} className="fam-ring-face" />
        <span className="fam-ring-edit" aria-hidden="true">✎</span>
        {birthday && <span className="fam-ring-badge">{birthday.isToday ? "🎉 Hôm nay!" : `🎂 còn ${birthday.daysLeft} ngày`}</span>}
      </button>
      <h2>{name}</h2>
      <div className="fam-kid-age">{age ? ageText(age) : months !== undefined ? `khoảng ${months} tháng` : "Chưa có tuổi"}</div>
      <div className="fam-kid-born">{child.birthDate ? `Sinh ${shortDate(child.birthDate)}${age ? ` · ngày thứ ${age.dayNumber.toLocaleString("vi-VN")}` : ""}` : <button type="button" className="link-btn" onClick={onEdit}>Thêm ngày sinh để xem sinh nhật & mốc ngày tuổi</button>}</div>
    </div>

    <div className="fam-kid-body">
      {(milestone || birthday) && <div className="fam-moments">
        {birthday?.isToday && <div className="fam-mo hi"><i>🎉</i><div><b>Chúc mừng sinh nhật {name}!</b>Tròn {birthday.turning} tuổi hôm nay</div></div>}
        {milestone && <div className={`fam-mo${milestone.isToday ? " hi" : ""}`}><i>✨</i><div><b>{milestone.day.toLocaleString("vi-VN")} ngày tuổi</b>{milestone.isToday ? "Chính là hôm nay!" : `${shortDate(milestone.date, today)} · còn ${milestone.daysLeft} ngày`}</div></div>}
        {birthday && !birthday.isToday && <div className="fam-mo"><i>🎂</i><div><b>Tròn {birthday.turning} tuổi</b>{shortDate(birthday.date)} · còn {birthday.daysLeft} ngày</div></div>}
      </div>}
      <div className="fam-kid-foot"><button type="button" className="app-btn ghost" onClick={onEditLook}>🎨 Biểu tượng & màu</button><button type="button" className="app-btn ghost" onClick={onEdit}>Sửa hồ sơ {name}</button></div>
    </div>
  </section>;
}
