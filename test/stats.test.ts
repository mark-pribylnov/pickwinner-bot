import assert from "node:assert/strict";
import test from "node:test";
import { allTimeTotal, formatBoard, meLine, yearTotal } from "../src/stats.js";

test("year total drops the imported year after that year", () => {
  assert.equal(yearTotal({ importedYear: 36, importedForYear: 2026, currentYear: 2026, picks: 1 }), 37);
  assert.equal(yearTotal({ importedYear: 36, importedForYear: 2026, currentYear: 2027, picks: 2 }), 2);
  assert.equal(allTimeTotal(146, 1), 147);
});

test("the board is a top 10 with a participant count", () => {
  const rows = [
    { name: "zero", count: 0 },
    { name: "mark_pribylnov", count: 36 },
    { name: "davidovich_sales", count: 35 },
  ];
  assert.equal(
    formatBoard("Топ-10 пидоров за текущий год:", rows, 2),
    [
      "Топ-10 пидоров за текущий год:",
      "1. mark_pribylnov — 36 раз(а)",
      "2. davidovich_sales — 35 раз(а)",
      "",
      "Всего участников — 2",
    ].join("\n"),
  );
});

test("a board with only zeros still names the participants", () => {
  assert.equal(
    formatBoard("Топ-10 пидоров за все время:", [{ name: "alex", count: 0 }], 2),
    "Топ-10 пидоров за все время:\n\nВсего участников — 2",
  );
});

test("personal stats use the all-time count", () => {
  assert.equal(meLine({ username: "mark_pribylnov", firstName: "Mark", userId: "1" }, 146), "@mark_pribylnov, ты был(а) пидором дня — 146 раз!");
  assert.equal(meLine({ username: "", firstName: "Саша", userId: "2" }, 0), "Саша, ты был(а) пидором дня — 0 раз!");
});

test("the board shows only the top 10 of 12 rows", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ name: `p${index + 1}`, count: 20 - index }));
  const lines = formatBoard("Топ-10 пидоров за текущий год:", rows, 12).split("\n");
  assert.equal(lines.filter((line) => /^\d+\. /.test(line)).length, 10);
  assert.equal(lines[10], "10. p10 — 11 раз(а)");
  assert.ok(!lines.some((line) => line.includes("p11") || line.includes("p12")));
  assert.equal(lines.at(-1), "Всего участников — 12");
});
