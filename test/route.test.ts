import assert from "node:assert/strict";
import test from "node:test";
import { copy } from "../src/copy.js";
import { isGroupChat, route, type RouteDeps } from "../src/route.js";

const actor = { chatId: "1", userId: "2", username: "alex", firstName: "Alex" };

function spies(): RouteDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    register: async () => {
      calls.push("register");
      return "registered";
    },
    play: async () => {
      calls.push("play");
      return "played";
    },
    stats: async () => {
      calls.push("stats");
      return "stats";
    },
    memberLeft: async () => {
      calls.push("left");
    },
    memberJoined: async () => {
      calls.push("joined");
    },
  };
}

test("only groups and supergroups are game chats", () => {
  assert.equal(isGroupChat("group"), true);
  assert.equal(isGroupChat("supergroup"), true);
  assert.equal(isGroupChat("private"), false);
  assert.equal(isGroupChat("channel"), false);
  assert.equal(isGroupChat(undefined), false);
});

test("commands outside a group do not touch the game", async () => {
  const deps = spies();
  assert.equal(
    await route({ kind: "command", command: "play", chatType: "private", actor }, deps),
    copy.addToGroup,
  );
  assert.equal(
    await route({ kind: "command", command: "stats", chatType: "channel", actor }, deps),
    copy.addToGroup,
  );
  assert.deepEqual(deps.calls, []);
});

test("group start shows the commands and group play runs the draw", async () => {
  const deps = spies();
  assert.equal(await route({ kind: "command", command: "start", chatType: "group", actor }, deps), copy.help);
  assert.equal(await route({ kind: "command", command: "play", chatType: "supergroup", actor }, deps), "played");
  assert.deepEqual(deps.calls, ["play"]);
});

test("leave and join are ignored outside a group", async () => {
  const deps = spies();
  assert.equal(await route({ kind: "left", chatType: "private", chatId: "1", userId: "2" }, deps), null);
  assert.equal(
    await route({ kind: "joined", chatType: "channel", actor }, deps),
    null,
  );
  assert.equal(await route({ kind: "left", chatType: "group", chatId: "1", userId: "2" }, deps), null);
  assert.deepEqual(deps.calls, ["left"]);
});
