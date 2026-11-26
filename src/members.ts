import type { Pool } from "pg";
import { listPlayers, setRegistered, updateProfile } from "./db.js";

export type MemberView = {
  state: "in" | "out" | "unknown";
  username: string;
  firstName: string;
};

export async function reconcileRegistered(
  pool: Pool,
  chatId: string,
  lookup: (userId: string) => Promise<MemberView>,
): Promise<void> {
  const players = await listPlayers(pool, chatId);
  for (const player of players) {
    if (!player.registered) continue;
    let view: MemberView;
    try {
      view = await lookup(player.userId);
    } catch {
      continue;
    }
    if (view.state === "out") {
      await setRegistered(pool, chatId, player.userId, false);
    } else if (view.state === "in") {
      await updateProfile(pool, {
        chatId,
        userId: player.userId,
        username: view.username,
        firstName: view.firstName,
      });
    }
  }
}
