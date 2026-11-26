import { copy } from "./copy.js";
import { displayName } from "./names.js";

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
