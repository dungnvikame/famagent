"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { dailyTasks, localDay, streak } from "@/lib/brief/daily-tasks";
import { loadDone, setDone, type DoneByDay } from "@/lib/brief/routine-client";


/** Home "Việc hôm nay": today's habits from the chosen parenting approach and money framework, plus this week's improvement. */
export function DailyTasks({ profile, loggedToday }: { profile: FamilyProfile; loggedToday: boolean }) {
  const [done, setDoneState] = useState<DoneByDay>({});
  const [error, setError] = useState("");
  useEffect(() => { loadDone().then(setDoneState).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Không thể tải việc đã làm.")); }, []);
  const today = localDay(new Date());
  const tasks = dailyTasks(profile, new Date(), { loggedToday });
  const doneToday = new Set(done[today] ?? []);
  const hasKids = profile.children.length > 0 || profile.household?.setup === "expecting";
  const missing = [hasKids && !profile.household?.careMethod ? { label: "Chọn phương pháp nuôi dạy", href: "/family#care-method" } : null, !profile.household?.moneyMethod ? { label: "Chọn cách quản lý tiền", href: "/money" } : null].filter((item): item is { label: string; href: string } => Boolean(item));

  /** Optimistic tick; rolls back if the save fails. */
  function toggle(id: string, kind: string) {
    const was = doneToday.has(id);
    const previous = done;
    setDoneState({ ...done, [today]: was ? [...doneToday].filter((item) => item !== id) : [...doneToday, id] });
    setError("");
    setDone(today, id, !was).then(() => { if (!was) trackEvent("daily_task_done", { kind }); }).catch((cause: unknown) => { setDoneState(previous); setError(cause instanceof Error ? cause.message : "Chưa lưu được."); });
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
      {error && <p className="form-error" role="alert">{error}</p>}
      {missing.length > 0 && <div className="app-card daily-task invite"><div className="t"><b>{tasks.length ? "Thêm việc hằng ngày" : "Chưa có việc hằng ngày"}</b><small>Chọn một phương pháp để FamAgent gợi ý mỗi ngày một việc nhỏ, dễ làm.</small></div><span className="daily-invite-links">{missing.map((item) => <Link key={item.href} className="app-btn ghost" href={item.href}>{item.label}</Link>)}</span></div>}
    </div>
  </section>;
}
