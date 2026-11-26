import assert from "node:assert/strict";
import test from "node:test";
import { formatStats } from "../src/stats.js";

test("stats list scores high to low, then name", () => {
  const text = formatStats([
    { username: "riley", firstName: "Riley", userId: "4", score: 0 },
    { username: "", firstName: "Alex", userId: "3", score: 1 },
    { username: "samuel", firstName: "Sam", userId: "1", score: 4 },
    { username: "alex", firstName: "Alex", userId: "2", score: 2 },
  ]);
  assert.equal(text, "@samuel — 4\n@alex — 2\nAlex — 1\n@riley — 0");
});

test("stats with nobody registered", () => {
  assert.equal(formatStats([]), "No one has registered.");
});
