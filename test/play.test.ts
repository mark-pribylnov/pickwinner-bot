import assert from "node:assert/strict";
import test from "node:test";
import { decidePlay } from "../src/play.js";

test("an unregistered sender cannot start a pick", () => {
  let calls = 0;
  const decision = decidePlay({
    senderRegistered: false,
    registeredUserIds: ["a", "b"],
    alreadyPicked: false,
    randomIndex: () => {
      calls += 1;
      return 0;
    },
  });
  assert.deepEqual(decision, { ok: false, reason: "not_registered" });
  assert.equal(calls, 0);
});

test("one registered player is not enough", () => {
  const decision = decidePlay({
    senderRegistered: true,
    registeredUserIds: ["a"],
    alreadyPicked: false,
    randomIndex: () => 0,
  });
  assert.deepEqual(decision, { ok: false, reason: "need_another_player" });
});

test("a group that already has a fool is refused before the draw", () => {
  let calls = 0;
  const decision = decidePlay({
    senderRegistered: true,
    registeredUserIds: ["a", "b"],
    alreadyPicked: true,
    randomIndex: () => {
      calls += 1;
      return 0;
    },
  });
  assert.deepEqual(decision, { ok: false, reason: "already_picked" });
  assert.equal(calls, 0);
});

test("the draw uses randomIndex and can select the sender", () => {
  assert.deepEqual(
    decidePlay({
      senderRegistered: true,
      registeredUserIds: ["a", "b"],
      alreadyPicked: false,
      randomIndex: (length) => {
        assert.equal(length, 2);
        return 0;
      },
    }),
    { ok: true, userId: "a" },
  );
  assert.deepEqual(
    decidePlay({
      senderRegistered: true,
      registeredUserIds: ["a", "b"],
      alreadyPicked: false,
      randomIndex: () => 1,
    }),
    { ok: true, userId: "b" },
  );
});
