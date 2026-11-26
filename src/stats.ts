import { copy, ru } from "./copy.js";
import { displayName, plainName } from "./names.js";

export function yearTotal(input: {
  importedYear: number;
  importedForYear: number | null;
  currentYear: number;
  picks: number;
}): number {
  const imported = input.importedForYear === input.currentYear ? input.importedYear : 0;
  return imported + input.picks;
}

export function allTimeTotal(importedAllTime: number, score: number): number {
  return importedAllTime + score;
}

export function formatBoard(
  header: string,
  rows: readonly { name: string; count: number }[],
  participants: number,
): string {
  const ranked = [...rows]
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name, "ru", { sensitivity: "base" });
    })
    .slice(0, 10)
    .map((row, index) => `${index + 1}. ${row.name} — ${row.count} раз(а)`);
  const body = ranked.length > 0 ? `${ranked.join("\n")}\n` : "";
  return `${header}\n${body}\nВсего участников — ${participants}`;
}

export function meLine(
  person: { username: string; firstName: string; userId: string },
  count: number,
): string {
  const name = person.username !== "" ? `@${person.username}` : plainName(person);
  return `${name}, ты был(а) пидором дня — ${count} раз!`;
}

export const yearHeader = "Топ-10 пидоров за текущий год:";
export const allTimeHeader = "Топ-10 пидоров за все время:";

export function emptyBoard(players: readonly unknown[]): string | null {
  return players.length === 0 ? ru.noOneRegistered : null;
}

export function formatStats(
  rows: readonly { username: string; firstName: string; userId: string; score: number }[],
): string {
  if (rows.length === 0) return copy.noOneRegistered;
  const sorted = [...rows].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return displayName(left).localeCompare(displayName(right), "en", { sensitivity: "base" });
  });
  return sorted.map((row) => `${displayName(row)} — ${row.score}`).join("\n");
}
