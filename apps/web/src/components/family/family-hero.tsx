"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { COVER_STYLES, type AvatarColor, type CoverTheme } from "@/lib/family/members";
import { MemberAvatar } from "./member-avatar";

export interface HeroMember { id: string; name: string; label: string; color: AvatarColor; emoji?: string; photo?: string; kind: "adult" | "child"; selected?: boolean }
export interface TodayLine { icon: string; text: ReactNode; href?: string }
export interface PulseTile { key: string; icon: string; label: string; value: string; detail: string; cta: string; href?: string; onClick?: () => void; tone?: "warn" }

/** Cover of the page: family name + motto, everyone's avatar, and a "Hôm nay" card of what is worth noticing today. */
export function FamilyHero({ name, motto, theme, members, headline, lines, onMember, onAddChild, onEditHousehold }: {
  name: string; motto?: string; theme: CoverTheme; members: HeroMember[]; headline: ReactNode; lines: TodayLine[];
  onMember: (member: HeroMember) => void; onAddChild?: () => void; onEditHousehold: () => void;
}) {
  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
  return <section className="fam-hero" style={{ background: COVER_STYLES[theme].background }}>
    <div className="fam-hero-main">
      <div className="fam-hero-eyebrow"><span>Gia đình của bạn</span><button type="button" className="fam-hero-edit" onClick={onEditHousehold}>✎ Tùy chỉnh</button></div>
      <h1>{name}</h1>
      {motto ? <p className="fam-motto">“{motto}”</p> : <p className="fam-lead"><button type="button" className="link-btn" onClick={onEditHousehold}>＋ Thêm câu khẩu hiệu của nhà mình</button></p>}
      <div className="fam-members">
        {members.map((member) => <button type="button" key={`${member.kind}-${member.id}`} className={`fam-mem${member.selected ? " on" : ""}`} onClick={() => onMember(member)} aria-label={`${member.name} — ${member.kind === "child" ? "xem hồ sơ" : "sửa ảnh và tên"}`}>
          <MemberAvatar name={member.name} color={member.color} emoji={member.emoji} photo={member.photo} size={58} />
          <small>{member.label}</small>
        </button>)}
        {onAddChild && <button type="button" className="fam-mem add" onClick={onAddChild} aria-label="Thêm bé"><span className="fam-av add" aria-hidden="true">＋</span><small>Thêm bé</small></button>}
      </div>
    </div>
    <div className="fam-today">
      <div className="fam-today-date">Hôm nay · {today}</div>
      <div className="fam-today-big">{headline}</div>
      <ul>{lines.map((line, index) => <li key={index}><i aria-hidden="true">{line.icon}</i>{line.href ? <Link href={line.href}>{line.text}</Link> : <span>{line.text}</span>}</li>)}</ul>
    </div>
  </section>;
}

/** Four tappable numbers that lead to their page; a tile without real data is left out (no filler). */
export function FamilyPulse({ tiles }: { tiles: PulseTile[] }) {
  if (!tiles.length) return null;
  return <div className="fam-pulse">{tiles.map((tile) => {
    const body = <><span className="k"><i aria-hidden="true">{tile.icon}</i>{tile.label}</span><b>{tile.value}</b><span className="d">{tile.detail}</span><span className="go">{tile.cta} →</span></>;
    return tile.href ? <Link key={tile.key} href={tile.href} className={`fam-pt${tile.tone ? ` ${tile.tone}` : ""}`}>{body}</Link> : <button type="button" key={tile.key} className={`fam-pt${tile.tone ? ` ${tile.tone}` : ""}`} onClick={tile.onClick}>{body}</button>;
  })}</div>;
}
