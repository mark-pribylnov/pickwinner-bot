import assert from "node:assert/strict";
import test from "node:test";
import { gameDate, gameYear, utcDate } from "../src/dates.js";

test("utcDate uses the UTC calendar date", () => {
  assert.equal(utcDate(new Date("2026-11-24T23:59:59.000Z")), "2026-11-24");
  assert.equal(utcDate(new Date("2026-11-25T00:01:00.000Z")), "2026-11-25");
});

test("gameDate rolls at midnight Moscow", () => {
  assert.equal(gameDate(new Date("2026-11-24T20:59:00.000Z")), "2026-11-24");
  assert.equal(gameDate(new Date("2026-11-24T21:00:00.000Z")), "2026-11-25");
  assert.equal(gameDate(new Date("2026-12-31T20:59:00.000Z")), "2026-12-31");
  assert.equal(gameDate(new Date("2026-12-31T21:00:00.000Z")), "2027-01-01");
});

test("gameYear is the Moscow calendar year", () => {
  assert.equal(gameYear(new Date("2026-12-31T20:59:00.000Z")), 2026);
  assert.equal(gameYear(new Date("2026-12-31T21:00:00.000Z")), 2027);
});
