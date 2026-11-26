import assert from "node:assert/strict";
import test from "node:test";
import { buildSkit, scripts } from "../src/scripts.js";

const alex = { username: "alex", firstName: "Alex", userId: "7" };
const noName = { username: "", firstName: "Саша", userId: "8" };

test("there are 11 scripts and the cat ones name the winner", () => {
  assert.equal(scripts.length, 11);
  for (const index of [6, 7]) {
    const skit = buildSkit(index, alex);
    assert.match(skit.reveal, /ВЖУХ И ТЫ ПИДОР/);
    assert.equal(skit.reveal.slice(skit.mentionOffset, skit.mentionOffset + skit.mentionLength), "@alex");
  }
});

test("a script mentions the winner at the end of the reveal", () => {
  const skit = buildSkit(0, alex);
  assert.equal(skit.kind, "skit");
  assert.equal(skit.scriptIndex, 0);
  assert.equal(skit.userId, "7");
  assert.equal(skit.lead[0], "Кто сегодня счастливчик?");
  assert.equal(skit.lead.length, 3);
  assert.equal(skit.reveal.slice(skit.mentionOffset), "@alex");
  assert.equal(skit.mentionLength, "@alex".length);
});

test("a winner with no username is mentioned by first name", () => {
  const skit = buildSkit(10, noName);
  assert.equal(skit.reveal.slice(skit.mentionOffset), "Саша");
  assert.equal(skit.lead[0], "Что тут у нас?");
});
