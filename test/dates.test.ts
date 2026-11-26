import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "../src/dates.js";

test("utcDate uses the UTC calendar date", () => {
  assert.equal(utcDate(new Date("2026-11-24T23:59:59.000Z")), "2026-11-24");
  assert.equal(utcDate(new Date("2026-11-25T00:01:00.000Z")), "2026-11-25");
});
