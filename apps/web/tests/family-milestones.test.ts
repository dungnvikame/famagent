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
