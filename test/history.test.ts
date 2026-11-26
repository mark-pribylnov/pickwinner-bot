import assert from "node:assert/strict";
import test from "node:test";
import { parseHistory } from "../src/history.js";

test("parseHistory reads the import file", () => {
  const history = parseHistory(
    JSON.stringify({
      chatId: "123",
      year: 2026,
      players: [
        { userId: "456", username: "mark_pribylnov", firstName: "Mark", allTime: 146, yearCount: 36 },
      ],
    }),
  );
  assert.equal(history.chatId, "123");
  assert.equal(history.players[0]?.allTime, 146);
});

test("parseHistory rejects a missing user id", () => {
  assert.throws(
    () =>
      parseHistory(
        JSON.stringify({
          chatId: "123",
          year: 2026,
          players: [{ userId: "", username: "mark_pribylnov", firstName: "Mark", allTime: 146, yearCount: 36 }],
        }),
      ),
    /userId/,
  );
});

test("parseHistory accepts a negative chat id and rejects other chat ids", () => {
  const withChat = (chatId: unknown) =>
    JSON.stringify({ chatId, year: 2026, players: [] });
  assert.equal(parseHistory(withChat("-1001234567890")).chatId, "-1001234567890");
  for (const bad of ["abc", "12a", "--1", "1.5", "-", " 12", "", 123]) {
    assert.throws(() => parseHistory(withChat(bad)), /chatId/);
  }
});
