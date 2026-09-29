import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EVENT_NAMES, isEventName } from "../src/lib/events/event-names.ts";

const SRC = join(import.meta.dirname, "..", "src");
const files = (readdirSync(SRC, { recursive: true }) as string[]).filter((name) => /\.tsx?$/.test(name));

/** Snake_case names passed to trackEvent(...) or the money page's act(...): string literals before the payload object. */
function emittedNames(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of files) {
    const source = readFileSync(join(SRC, file), "utf8");
    for (const call of source.matchAll(/\b(?:trackEvent|act)\(([^)]*)\)/g)) {
      for (const literal of call[1].split("{")[0].matchAll(/"([a-z]+(?:_[a-z]+)+)"/g)) found.set(literal[1], file);
    }
  }
  return found;
}

test("mọi tên sự kiện app đang gửi đều nằm trong danh sách /api/events", () => {
  const emitted = emittedNames();
  assert.ok(emitted.size >= 30, `quét được ${emitted.size} tên sự kiện`);
  const missing = [...emitted].filter(([name]) => !isEventName(name)).map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(missing, [], "thêm vào EVENT_NAMES (lib/events/event-names.ts)");
  for (const name of ["daily_task_done", "family_note_recorded", "purchase_recorded", "stock_checked", "money_quick_saved", "care_method_chosen", "push_enabled", "push_disabled"]) assert.ok(emitted.has(name), `${name} vẫn được gửi`);
});

test("danh sách không trùng và chỉ chứa tên snake_case", () => {
  assert.equal(new Set(EVENT_NAMES).size, EVENT_NAMES.length);
  for (const name of EVENT_NAMES) assert.match(name, /^[a-z]+(?:_[a-z]+)+$/);
  assert.equal(isEventName("drop_table"), false);
  assert.equal(isEventName(undefined), false);
});

test("route dùng danh sách chung, không giữ bản sao riêng", () => {
  const route = readFileSync(join(SRC, "app", "api", "events", "route.ts"), "utf8");
  assert.match(route, /isEventName\(body\.name\)/);
  assert.doesNotMatch(route, /new Set\(\[/);
});
