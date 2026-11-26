import type { HistoryImport } from "./db.js";

export function parseHistory(raw: string): HistoryImport {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error("history must be an object");
  const chatId = value.chatId;
  const year = value.year;
  const players = value.players;
  if (typeof chatId !== "string" || chatId === "") throw new Error("chatId is required");
  if (typeof year !== "number" || !Number.isInteger(year)) throw new Error("year must be an integer");
  if (!Array.isArray(players)) throw new Error("players must be a list");
  return {
    chatId,
    year,
    players: players.map((player) => {
      if (!isRecord(player)) throw new Error("player must be an object");
      const userId = player.userId;
      const username = player.username;
      const firstName = player.firstName;
      const allTime = player.allTime;
      const yearCount = player.yearCount;
      if (typeof userId !== "string" || !/^\d+$/.test(userId)) throw new Error("userId must be digits");
      if (typeof username !== "string" || typeof firstName !== "string") throw new Error("name must be a string");
      if (!isCount(allTime) || !isCount(yearCount)) throw new Error("counts must be integers");
      return { userId, username, firstName, allTime, yearCount };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
