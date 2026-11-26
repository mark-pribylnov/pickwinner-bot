import assert from "node:assert/strict";
import test from "node:test";
import { displayName, plainName } from "../src/names.js";

test("display name prefers username, then first name, then user id", () => {
  assert.equal(displayName({ username: "samuel", firstName: "Sam", userId: "1" }), "@samuel");
  assert.equal(displayName({ username: "", firstName: "Alex", userId: "2" }), "Alex");
  assert.equal(displayName({ username: "", firstName: "", userId: "42" }), "42");
});

test("plain name has no @ sign", () => {
  assert.equal(plainName({ username: "samuel", firstName: "Sam", userId: "1" }), "samuel");
  assert.equal(plainName({ username: "", firstName: "Alex", userId: "2" }), "Alex");
  assert.equal(plainName({ username: "", firstName: "", userId: "42" }), "42");
});
