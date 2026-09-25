import assert from "node:assert/strict";
import test from "node:test";
import { classifySystem, cleanAnswers, validClassifyRequest } from "../src/lib/money/classify-ai.ts";

const request = { lines: [{ i: 0, content: "E sim", kind: "expense" }, { i: 3, content: "A Báu vay", kind: "expense" }], categories: { expense: ["Tiêu dùng", "Tiền cho vay", "Khác"], income: ["Lương", "Vay cá nhân", "Khác"] }, children: ["Gold"] };

test("classify request is validated; the prompt carries categories and children", () => {
  const clean = validClassifyRequest(request);
  assert.ok(clean);
  assert.match(classifySystem(clean!), /Tiêu dùng \| Tiền cho vay/);
  assert.match(classifySystem(clean!), /Gold/);
  assert.equal(validClassifyRequest({ ...request, lines: [] }), null);
  assert.equal(validClassifyRequest({ ...request, lines: [{ i: 0, content: "x", kind: "saving" }] }), null);
  assert.equal(validClassifyRequest({ ...request, categories: { expense: [], income: ["Lương"] } }), null);
});

test("only asked lines with a category of the right kind survive", () => {
  const clean = validClassifyRequest(request)!;
  const answers = cleanAnswers({ items: [
    { i: 0, kind: "expense", category: "Tiêu dùng" },
    { i: 3, kind: "expense", category: "Tiền cho vay" },
    { i: 3, kind: "expense", category: "Khác" },
    { i: 7, kind: "expense", category: "Tiêu dùng" },
    { i: 0, kind: "income", category: "Tiêu dùng" },
  ] }, clean);
  assert.deepEqual(answers, [{ i: 0, kind: "expense", category: "Tiêu dùng" }, { i: 3, kind: "expense", category: "Tiền cho vay" }]);
  assert.deepEqual(cleanAnswers("nope", clean), []);
});
