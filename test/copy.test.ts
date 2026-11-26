import assert from "node:assert/strict";
import test from "node:test";
import { copy, foolAnnouncement } from "../src/copy.js";

test("player-facing copy matches the design", () => {
  assert.equal(copy.registered, "You're registered.");
  assert.equal(copy.alreadyRegistered, "You're already registered.");
  assert.equal(copy.registerBeforePlay, "Register before you can play.");
  assert.equal(copy.needAnotherPlayer, "You need another player to play the game.");
  assert.equal(copy.alreadyPicked, "A fool was already picked.");
  assert.equal(copy.noOneRegistered, "No one has registered.");
  assert.equal(copy.addToGroup, "Add me to a group to play.");
  assert.equal(copy.help, "/register — join the game\n/play — pick the fool\n/stats — show scores");
  assert.equal(foolAnnouncement("alex"), "The fool is alex.");
});

test("player-facing copy does not reveal the reset time", () => {
  const hidden = /UTC|00:00|hour/i;
  for (const value of Object.values(copy)) {
    assert.doesNotMatch(value, hidden);
  }
  assert.doesNotMatch(foolAnnouncement("alex"), hidden);
});
