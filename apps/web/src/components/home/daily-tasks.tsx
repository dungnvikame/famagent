"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { dailyTasks, localDay, streak } from "@/lib/brief/daily-tasks";

const KEY = "family-ai:routine:v1";
const KEEP_DAYS = 60;
/** Ticks per local day, kept in this browser (a convenience; the task list itself is recomputed from the profile). */
function readDone(): Record<string, string[]> { try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string[]>; } catch { return {}; } }
function writeDone(value: Record<string, string[]>) { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(value).sort().slice(-KEEP_DAYS)))); } catch { /* storage blocked: ticks stay in memory */ } }

/** Home "Việc hôm nay": today's habits from the chosen parenting approach and money framework, plus this week's improvement. */
export function DailyTasks({ profile, loggedToday }: { profile: FamilyProfile; loggedToday: boolean }) {
  const [done, setDone] = useState<Record<string, string[]>>({});
  useEffect(() => { setDone(readDone()); }, []);
  const today = localDay(new Date());
  const tasks = dailyTasks(profile, new Date(), { loggedToday });
  const doneToday = new Set(done[today] ?? []);
  const hasKids = profile.children.length > 0 || profile.household?.setup === "expecting";
  const missing = [hasKids && !profile.household?.careMethod ? { label: "Chọn phương pháp nuôi dạy", href: "/family#care-method" } : null, !profile.household?.moneyMethod ? { label: "Chọn cách quản lý tiền", href: "/money" } : null].filter((item): item is { label: string; href: string } => Boolean(item));

  function toggle(id: string, kind: string) {
    const next = { ...done, [today]: doneToday.has(id) ? [...doneToday].filter((item) => item !== id) : [...doneToday, id] };
    setDone(next); writeDone(next);
    if (!doneToday.has(id)) trackEvent("daily_task_done", { kind });
  }

  if (!tasks.length && !missing.length) return null;
  const count = tasks.filter((task) => doneToday.has(task.id)).length;
  const days = streak(done);
  return <section className="app-section" aria-labelledby="brief-today">
    <h2 id="brief-today">Việc hôm nay{tasks.length ? ` · ${count}/${tasks.length}` : ""}{days > 1 ? ` · chuỗi ${days} ngày` : ""}</h2>
    <div className="brief-att">
      {tasks.map((task) => {
        const on = doneToday.has(task.id);
        return <div key={task.id} className={`app-card daily-task ${task.kind}${on ? " done" : ""}`}>
          <button type="button" className="daily-check" role="checkbox" aria-checked={on} aria-label={on ? "Bỏ đánh dấu" : "Đánh dấu đã làm"} onClick={() => toggle(task.id, task.kind)}>{on ? "✓" : ""}</button>
          <div className="t"><small className="daily-source">{task.source}</small><b>{task.title}</b><small>{task.detail}</small></div>
          {task.href && <Link className="brief-link" href={task.href}>Xem</Link>}
        </div>;
      })}
      {missing.length > 0 && <div className="app-card daily-task invite"><div className="t"><b>{tasks.length ? "Thêm việc hằng ngày" : "Chưa có việc hằng ngày"}</b><small>Chọn một phương pháp để FamAgent gợi ý mỗi ngày một việc nhỏ, dễ làm.</small></div><span className="daily-invite-links">{missing.map((item) => <Link key={item.href} className="app-btn ghost" href={item.href}>{item.label}</Link>)}</span></div>}
    </div>
  </section>;
}
