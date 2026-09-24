import { careMethodById } from "../care/methods.ts";
import { careHealth } from "../care/nurturing.ts";
import type { FamilyProfile } from "../experience/types.ts";
import { babyStep, frameworkById } from "../money/frameworks.ts";
import { financialHealth } from "../money/health.ts";

/**
 * "Việc hôm nay" on Home: small, doable habits from what the family chose — one practice of their parenting approach
 * (rotating daily), the habit of their money framework (daily or on its weekly day) and one improvement for the week
 * from the care/finance checks. Pure: the date decides the rotation, so every device shows the same list.
 */
export interface DailyTask {
  /** Stable per day, so a tick survives reloads: `<kind>:<source>:<variant>`. */
  id: string;
  kind: "care" | "money" | "improve";
  title: string;
  detail: string;
  /** Where the task comes from (method name / check), shown under the title. */
  source: string;
  href?: string;
}

/** Shape of task ids; the /api/routine route validates against the same pattern. */
export const TASK_ID = /^[a-z-]+:[a-z0-9-]+:[a-z0-9-]+$/;

const DAY_MS = 86_400_000;
/** Local day number (days since epoch in local time) — drives the rotation. */
export const dayIndex = (date: Date) => Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY_MS);
export const localDay = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function dailyTasks(profile: FamilyProfile, now = new Date(), context: { loggedToday?: boolean } = {}): DailyTask[] {
  const h = profile.household ?? {};
  const tasks: DailyTask[] = [];
  const day = dayIndex(now);
  const sunday = now.getDay() === 0;
  const hasKids = profile.children.length > 0 || h.setup === "expecting";

  // 1) Parenting approach: one practice per day, rotating through its three practices.
  const method = hasKids ? careMethodById(h.careMethod) : undefined;
  if (method) {
    const index = day % method.practices.length;
    tasks.push({ id: `care:${method.id}:${index}`, kind: "care", title: method.practices[index], detail: `Việc ${index + 1}/${method.practices.length} của phương pháp — mỗi ngày một việc, lặp lại để thành nếp.`, source: method.name, href: "/family#care-method" });
  }

  // 2) Money framework: its habit for today (weekly habits land on Sunday).
  const framework = frameworkById(h.moneyMethod);
  if (framework) {
    const weekly: Partial<Record<typeof framework.id, { title: string; detail: string }>> = {
      kakeibo: { title: "Tự hỏi 4 câu Kakeibo cho tuần này", detail: "Thu bao nhiêu? Muốn để dành bao nhiêu? Đã tiêu bao nhiêu? Tuần sau cải thiện gì?" },
      "zero-based": { title: "Giao việc cho khoản thu chưa có kế hoạch", detail: "Mở mục Tiền → Tháng: đưa phần “Chưa giao việc” về 0 bằng cách đặt ngân sách cho nhóm hoặc chuyển vào tiết kiệm." },
      jars: { title: "Kiểm tra 6 chiếc lọ", detail: "Lọ nào đã vượt? Dừng tiêu nhóm đó đến tháng sau; phần dư của lọ Hưởng thụ có thể dồn sang tháng sau." },
      "50-30-20": { title: "Xem lại tỷ lệ 50/30/20 tuần này", detail: "Phần Mong muốn có vượt 30% chưa? Nếu có, cắt một khoản tuần tới." },
      "pay-first": { title: "Kiểm tra khoản “trả cho mình” đã chuyển chưa", detail: "Nếu tháng này chưa chuyển phần để dành, chuyển ngay — rồi mới tiêu tiếp." },
      "baby-steps": { title: `Tiến độ ${babyStep(profile).text.split(" — ")[0]}`, detail: babyStep(profile).text },
    };
    if (sunday && weekly[framework.id]) tasks.push({ id: `money:${framework.id}:weekly`, kind: "money", ...weekly[framework.id]!, source: framework.name, href: "/money#month" });
    else if (!context.loggedToday) tasks.push({ id: `money:${framework.id}:log`, kind: "money", title: "Ghi các khoản chi hôm nay", detail: framework.id === "kakeibo" ? "Mỗi khoản ghi vào một trong 4 nhóm: Sinh tồn, Mong muốn, Văn hóa, Phát sinh." : "Ghi ngay trong ngày để phương pháp tính đúng từng phần.", source: framework.name, href: "/money" });
  }

  // 3) One improvement for the week, from the care check first (children), then the financial check.
  const problems = [...(hasKids ? careHealth(profile, now).problems : []), ...financialHealth(profile).problems];
  if (problems.length) {
    const week = Math.floor(day / 7);
    const pick = problems[week % problems.length];
    tasks.push({ id: `improve:${pick.key}:${week}`, kind: "improve", title: pick.fix ?? "", detail: pick.problem ?? "", source: "Việc cải thiện tuần này", href: "label" in pick && "component" in pick ? "/family" : "/money" });
  }
  return tasks.filter((task) => task.title);
}

/** Consecutive days (ending today, or yesterday if today has nothing yet) with at least one task done. */
export function streak(doneByDay: Record<string, string[]>, now = new Date()): number {
  let count = 0;
  const today = localDay(now);
  for (let offset = doneByDay[today]?.length ? 0 : 1; ; offset++) {
    const key = localDay(new Date(now.getTime() - offset * DAY_MS));
    if (!doneByDay[key]?.length) break;
    count++;
  }
  return count;
}
