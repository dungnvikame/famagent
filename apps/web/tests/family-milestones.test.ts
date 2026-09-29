import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKPOINTS, WHO_MOTOR } from "../src/lib/family/milestones-data.ts";
import { checkpointsFor, concerns, justEntered, knownMilestone, memories, milestoneById, motorState, progressOf, type MilestoneRecord } from "../src/lib/family/milestones.ts";

test("CDC checklists: 12 checkpoints, unique ids, every area where CDC has one", () => {
  assert.deepEqual(CHECKPOINTS.map((checkpoint) => checkpoint.months), [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60]);
  const ids = CHECKPOINTS.flatMap((checkpoint) => checkpoint.items.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^(m\d{1,2}-[slcm]\d{1,2}|who-[a-z-]+)$/.test(id)));
  // Counts per checkpoint as published by CDC (2022 revision).
  assert.deepEqual(CHECKPOINTS.map((checkpoint) => checkpoint.items.length), [11, 13, 12, 13, 10, 13, 15, 13, 15, 12, 17, 15]);
  // WHO motor items shared with CDC lines keep one record.
  assert.equal(milestoneById("who-sit")?.text, "Ngồi vững không cần đỡ");
  assert.ok(knownMilestone("who-crawl")); assert.ok(!knownMilestone("m7-s1"));
  assert.deepEqual(WHO_MOTOR.map((window) => [window.from, window.to]), [[3.8, 9.2], [4.8, 11.4], [5.2, 13.5], [5.9, 13.7], [6.9, 16.9], [8.2, 17.6]]);
});

test("current / next checkpoint, progress, concerns only from a family 'Chưa'", () => {
  assert.equal(checkpointsFor(1).current, undefined); assert.equal(checkpointsFor(1).next?.months, 2);
  const at14 = checkpointsFor(14);
  assert.equal(at14.current?.months, 12); assert.equal(at14.next?.months, 15); assert.equal(at14.past.length, 4);
  const records = new Map<string, MilestoneRecord>([
    ["m12-s1", { childId: "c", milestoneId: "m12-s1", status: "done", on: "2026-07-01" }],
    ["who-stand-assist", { childId: "c", milestoneId: "who-stand-assist", status: "not_yet" }],
  ]);
  assert.deepEqual(progressOf(at14.current!, records), { done: 1, notYet: 1, total: 10 });
  assert.deepEqual(concerns(14, records).map((entry) => [entry.checkpoint.months, entry.items.map((item) => item.id)]), [[12, ["who-stand-assist"]]]);
  assert.deepEqual(concerns(14, new Map()), []);
});

test("just entered a checkpoint, memories with age, WHO motor state", () => {
  assert.equal(justEntered("2025-07-20", "2026-10-25")?.months, 15);
  assert.equal(justEntered("2025-07-20", "2026-11-10"), undefined);
  const list = memories([
    { childId: "c", milestoneId: "who-walk-alone", status: "done", on: "2026-09-01" },
    { childId: "c", milestoneId: "m12-l1", status: "done", on: "2026-06-10" },
    { childId: "c", milestoneId: "m12-l2", status: "not_yet" },
  ], "2025-07-20");
  assert.deepEqual(list.map((memory) => memory.milestone.id), ["who-walk-alone", "m12-l1"]);
  assert.equal(list[0].ageText, "1 tuổi 1 tháng 12 ngày");
  const walk = WHO_MOTOR.at(-1)!;
  assert.equal(motorState(walk, 7), "early"); assert.equal(motorState(walk, 12), "window"); assert.equal(motorState(walk, 18), "late");
  assert.equal(motorState(walk, 18, { childId: "c", milestoneId: walk.id, status: "done" }), "done");
});

test("age guide: stages cover 0–72 months without gaps, unique tip ids, tips can be saved", async () => {
  const { GUIDE_STAGES, stageFor, knownTip } = await import("../src/lib/family/age-guide-data.ts");
  const { validMilestoneInput } = await import("../src/lib/family/validate.ts");
  assert.equal(GUIDE_STAGES[0].from, 0); assert.equal(GUIDE_STAGES.at(-1)!.to, 72);
  for (let index = 1; index < GUIDE_STAGES.length; index++) assert.equal(GUIDE_STAGES[index].from, GUIDE_STAGES[index - 1].to);
  const ids = GUIDE_STAGES.flatMap((item) => item.tips.map((tip) => tip.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^tip-[0-9]{1,2}-[0-9]{1,2}$/.test(id)));
  assert.ok(GUIDE_STAGES.every((item) => item.tips.length >= 8));
  assert.equal(stageFor(14)?.label, "14–17 tháng"); assert.equal(stageFor(0)?.key, 2); assert.equal(stageFor(72), undefined);
  assert.ok(knownTip("tip-12-1")); assert.ok(!knownTip("tip-99-1"));
  const child = "11111111-1111-4111-8111-111111111111";
  assert.equal(validMilestoneInput({ childId: child, milestoneId: "tip-12-1", status: "done", on: "2026-09-29" }, new Date("2026-09-29T05:00:00Z")), true);
  assert.equal(validMilestoneInput({ childId: child, milestoneId: "tip-99-1", status: "done" }), false);
});

test("tip of the day: same pick for page and push, skips tried tips, youngest child under 6", async () => {
  const { GUIDE_STAGES, stageFor } = await import("../src/lib/family/age-guide-data.ts");
  const { tipOfDay, tipPushFor, dayNumberOf } = await import("../src/lib/family/age-guide.ts");
  const stage = stageFor(14)!;
  const first = tipOfDay(stage, new Set(), "2026-09-29")!;
  assert.equal(first.id, stage.tips[dayNumberOf("2026-09-29") % stage.tips.length].id);
  const next = tipOfDay(stage, new Set([first.id]), "2026-09-29")!;
  assert.notEqual(next.id, first.id);
  assert.equal(tipOfDay(stage, new Set(stage.tips.map((tip) => tip.id)), "2026-09-29"), undefined);
  const push = tipPushFor([{ id: "big", name: "Bơ", ageMonths: 42 }, { id: "small", name: "Gold", ageMonths: 14 }, { id: "teen", name: "An", ageMonths: 150 }], new Map(), "2026-09-29")!;
  assert.equal(push.childId, "small"); assert.equal(push.tipId, first.id);
  assert.equal(push.title, "Mẹo hôm nay cho Gold (14–17 tháng)"); assert.equal(push.url, "/family#fam-guide");
  // Every tip of the youngest tried → falls back to the next child.
  const allTried = new Map([["small", new Set(stage.tips.map((tip) => tip.id))]]);
  assert.equal(tipPushFor([{ id: "small", name: "Gold", ageMonths: 14 }, { id: "big", name: "Bơ", ageMonths: 42 }], allTried, "2026-09-29")?.childId, "big");
  assert.equal(tipPushFor([{ id: "teen", name: "An", ageMonths: 150 }], new Map(), "2026-09-29"), null);
  assert.ok(GUIDE_STAGES.length === 12);
});
