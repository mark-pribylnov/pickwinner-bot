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
