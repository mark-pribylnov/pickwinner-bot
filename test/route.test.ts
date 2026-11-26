import assert from "node:assert/strict";
import test from "node:test";
import { maintenanceMessage, ru } from "../src/copy.js";
import { textReply } from "../src/reply.js";
import { dispatch, isGroupChat, route, type RouteDeps, type RouteEvent } from "../src/route.js";

const actor = { chatId: "1", userId: "2", username: "alex", firstName: "Alex" };

function spies(): RouteDeps & { calls: string[] } {
  const calls: string[] = [];
  const reply = (name: string) => async () => {
    calls.push(name);
    return textReply("ok");
  };
  return {
    calls,
    register: reply("register"),
    play: reply("play"),
    yearStats: reply("yearStats"),
    allTimeStats: reply("allTimeStats"),
    me: reply("me"),
    memberLeft: async () => {
      calls.push("left");
    },
    memberJoined: async () => {
      calls.push("joined");
    },
  };
}

const command = (name: string, chatType: string): RouteEvent => ({
  kind: "command",
  command: name,
  chatType,
  actor,
});

test("only groups and supergroups are game chats", () => {
  assert.equal(isGroupChat("group"), true);
  assert.equal(isGroupChat("supergroup"), true);
  assert.equal(isGroupChat("private"), false);
  assert.equal(isGroupChat("channel"), false);
  assert.equal(isGroupChat(undefined), false);
});

test("a private /pidor asks to join a group and calls nothing", async () => {
  const deps = spies();
  assert.deepEqual(await route(command("pidor", "private"), deps), textReply(ru.addToGroup));
  assert.deepEqual(await route(command("pidorstats", "channel"), deps), textReply(ru.addToGroup));
  assert.deepEqual(deps.calls, []);
});

test("private rules, start, and help answer without the game", async () => {
  const deps = spies();
  assert.deepEqual(await route(command("pidorules", "private"), deps), textReply(ru.rules));
  assert.deepEqual(await route(command("start", "private"), deps), textReply(ru.help));
  assert.deepEqual(await route(command("help", "private"), deps), textReply(ru.help));
  assert.deepEqual(deps.calls, []);
});

test("each group command calls its handler", async () => {
  const deps = spies();
  const expected = [
    ["pidor", "play"],
    ["pidoreg", "register"],
    ["pidorstats", "yearStats"],
    ["pidorall", "allTimeStats"],
    ["pidorme", "me"],
  ] as const;
  for (const [name, call] of expected) {
    assert.deepEqual(await route(command(name, "group"), deps), textReply("ok"));
    assert.equal(deps.calls.at(-1), call);
  }
  assert.deepEqual(deps.calls, ["play", "register", "yearStats", "allTimeStats", "me"]);
});

test("the English commands are gone", async () => {
  const deps = spies();
  for (const name of ["register", "play", "stats"]) {
    assert.equal(await route(command(name, "group"), deps), null);
  }
  assert.deepEqual(deps.calls, []);
});

test("maintenance answers every command and calls nothing", async () => {
  const deps = spies();
  for (const chatType of ["private", "group"]) {
    assert.deepEqual(
      await dispatch({ maintenance: true, event: command("pidor", chatType) }, deps),
      maintenanceMessage(),
    );
  }
  assert.deepEqual(deps.calls, []);
});

test("a group leave during maintenance is ignored", async () => {
  const deps = spies();
  const event: RouteEvent = { kind: "left", chatType: "group", chatId: "1", userId: "2" };
  assert.equal(await dispatch({ maintenance: true, event }, deps), null);
  assert.deepEqual(deps.calls, []);
});

test("a group leave outside maintenance still records it", async () => {
  const deps = spies();
  const event: RouteEvent = { kind: "left", chatType: "group", chatId: "1", userId: "2" };
  assert.equal(await dispatch({ maintenance: false, event }, deps), null);
  assert.deepEqual(deps.calls, ["left"]);
});

test("leave and join are ignored outside a group", async () => {
  const deps = spies();
  assert.equal(await route({ kind: "left", chatType: "private", chatId: "1", userId: "2" }, deps), null);
  assert.equal(await route({ kind: "joined", chatType: "channel", actor }, deps), null);
  assert.deepEqual(deps.calls, []);
});
