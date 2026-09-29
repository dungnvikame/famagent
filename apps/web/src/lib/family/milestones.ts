import { CHECKPOINTS, WHO_MOTOR, type Checkpoint, type Milestone, type MotorWindow } from "./milestones-data.ts";
import { ageParts, ageText, daysBetween } from "./child-stats.ts";

/**
 * Development milestones on the Family page: which CDC checkpoint the child is at, what the family has marked
 * ("Làm được" with a date, or "Chưa"), a memories timeline, and the WHO motor windows. The app never infers a
 * delay from missing ticks — only a "Chưa" the family chose on a past checkpoint brings up "hỏi bác sĩ".
 */
export type MilestoneStatus = "done" | "not_yet";
export interface MilestoneRecord { childId: string; milestoneId: string; status: MilestoneStatus; on?: string }

const ALL = new Map<string, Milestone>();
for (const checkpoint of CHECKPOINTS) for (const item of checkpoint.items) ALL.set(item.id, item);
for (const motor of WHO_MOTOR) if (!ALL.has(motor.id)) ALL.set(motor.id, { id: motor.id, area: "movement", text: motor.text });
export const milestoneById = (id: string) => ALL.get(id);
export const knownMilestone = (id: unknown): id is string => typeof id === "string" && ALL.has(id);

/** The checkpoint for this age (last one reached) and the next; before 2 months only `next`. */
export function checkpointsFor(ageMonths: number): { current?: Checkpoint; next?: Checkpoint; past: Checkpoint[] } {
  const reached = CHECKPOINTS.filter((checkpoint) => checkpoint.months <= ageMonths);
  const current = reached.at(-1);
  return { current, next: CHECKPOINTS.find((checkpoint) => checkpoint.months > ageMonths), past: reached.slice(0, -1) };
}

export interface Progress { done: number; notYet: number; total: number }
export function progressOf(checkpoint: Checkpoint, records: Map<string, MilestoneRecord>): Progress {
  let done = 0, notYet = 0;
  for (const item of checkpoint.items) { const status = records.get(item.id)?.status; if (status === "done") done++; else if (status === "not_yet") notYet++; }
  return { done, notYet, total: checkpoint.items.length };
}

/** Reached checkpoints where the family marked something "Chưa" — the cue CDC gives to talk with the doctor. */
export function concerns(ageMonths: number, records: Map<string, MilestoneRecord>): Array<{ checkpoint: Checkpoint; items: Milestone[] }> {
  return CHECKPOINTS.filter((checkpoint) => checkpoint.months <= ageMonths)
    .map((checkpoint) => ({ checkpoint, items: checkpoint.items.filter((item) => records.get(item.id)?.status === "not_yet") }))
    .filter((entry) => entry.items.length > 0);
}

/** "Gold vừa sang mốc 15 tháng" for the first 14 days after the month-birthday of a checkpoint. */
export function justEntered(birthDate: string, today: string): Checkpoint | undefined {
  const age = ageParts(birthDate, today);
  return age.days <= 14 ? CHECKPOINTS.find((checkpoint) => checkpoint.months === age.totalMonths) : undefined;
}

export interface Memory { milestone: Milestone; on: string; ageText?: string }
/** Things the child did, newest first, with the age on that day. */
export function memories(records: MilestoneRecord[], birthDate?: string): Memory[] {
  return records.flatMap((record) => {
    const milestone = ALL.get(record.milestoneId);
    if (record.status !== "done" || !record.on || !milestone) return [];
    return [{ milestone, on: record.on, ageText: birthDate && record.on >= birthDate ? ageText(ageParts(birthDate, record.on)) : undefined }];
  }).sort((a, b) => b.on.localeCompare(a.on));
}

export type MotorState = "done" | "early" | "window" | "late";
/** Where the child is against a WHO window: before it, inside, past it (not a verdict — a cue if also marked "Chưa"). */
export function motorState(window: MotorWindow, ageMonths: number, record?: MilestoneRecord): MotorState {
  if (record?.status === "done") return "done";
  return ageMonths < window.from ? "early" : ageMonths <= window.to ? "window" : "late";
}

/** Age in months (fractional) from birth date, for the WHO windows. */
export const ageMonthsExact = (birthDate: string, today: string) => daysBetween(birthDate, today) / 30.4375;
