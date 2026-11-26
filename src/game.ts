import type { Pool } from "pg";
import { copy, foolAnnouncement } from "./copy.js";
import { gameYear, utcDate } from "./dates.js";
import {
  countPicksByUser,
  getPick,
  listPlayers,
  registerPlayer,
  setRegistered,
  tryRecordPick,
  updateProfile,
} from "./db.js";
import { reconcileRegistered, type MemberView } from "./members.js";
import { displayName, plainName } from "./names.js";
import { decidePlay } from "./play.js";
import { textReply, type Reply } from "./reply.js";
import {
  allTimeHeader,
  allTimeTotal,
  emptyBoard,
  formatBoard,
  formatStats,
  meLine,
  yearHeader,
  yearTotal,
} from "./stats.js";

export type Actor = {
  chatId: string;
  userId: string;
  username: string;
  firstName: string;
};

export async function register(pool: Pool, actor: Actor): Promise<string> {
  const result = await registerPlayer(pool, actor);
  return result === "already" ? copy.alreadyRegistered : copy.registered;
}

export async function play(
  pool: Pool,
  actor: Actor,
  opts: {
    now: Date;
    randomIndex: (length: number) => number;
    lookup: (userId: string) => Promise<MemberView>;
  },
): Promise<string> {
  await updateProfile(pool, actor);
  await reconcileRegistered(pool, actor.chatId, opts.lookup);
  const players = await listPlayers(pool, actor.chatId);
  const sender = players.find((player) => player.userId === actor.userId);
  const registered = players
    .filter((player) => player.registered)
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const existing = await getPick(pool, actor.chatId, utcDate(opts.now));
  const decision = decidePlay({
    senderRegistered: sender?.registered === true,
    registeredUserIds: registered.map((player) => player.userId),
    alreadyPicked: existing !== null,
    randomIndex: opts.randomIndex,
  });
  if (!decision.ok) {
    if (decision.reason === "not_registered") return copy.registerBeforePlay;
    if (decision.reason === "need_another_player") return copy.needAnotherPlayer;
    return copy.alreadyPicked;
  }
  const chosen = registered.find((player) => player.userId === decision.userId);
  if (!chosen) throw new Error("draw selected a player who is not registered");
  const recorded = await tryRecordPick(pool, actor.chatId, utcDate(opts.now), chosen.userId);
  if (recorded === "conflict") return copy.alreadyPicked;
  return foolAnnouncement(displayName(chosen));
}

export async function stats(pool: Pool, actor: Actor): Promise<string> {
  await updateProfile(pool, actor);
  return formatStats(await listPlayers(pool, actor.chatId));
}

export async function yearStats(pool: Pool, actor: Actor, now: Date): Promise<Reply> {
  return board(pool, actor, now, "year");
}

export async function allTimeStats(pool: Pool, actor: Actor, now: Date): Promise<Reply> {
  return board(pool, actor, now, "all");
}

export async function meStats(pool: Pool, actor: Actor): Promise<Reply> {
  await updateProfile(pool, actor);
  const players = await listPlayers(pool, actor.chatId);
  const self = players.find((player) => player.userId === actor.userId);
  const count = self ? allTimeTotal(self.importedAllTime, self.score) : 0;
  return textReply(meLine(self ?? actor, count));
}

async function board(pool: Pool, actor: Actor, now: Date, which: "year" | "all"): Promise<Reply> {
  await updateProfile(pool, actor);
  const players = await listPlayers(pool, actor.chatId);
  const empty = emptyBoard(players);
  if (empty) return textReply(empty);
  const year = gameYear(now);
  const picks = which === "year" ? await countPicksByUser(pool, actor.chatId, year) : new Map<string, number>();
  const rows = players.map((player) => ({
    name: plainName(player),
    count:
      which === "year"
        ? yearTotal({
            importedYear: player.importedYear,
            importedForYear: player.importedForYear,
            currentYear: year,
            picks: picks.get(player.userId) ?? 0,
          })
        : allTimeTotal(player.importedAllTime, player.score),
  }));
  const participants = players.filter((player) => player.registered).length;
  const header = which === "year" ? yearHeader : allTimeHeader;
  return textReply(formatBoard(header, rows, participants));
}

export async function memberLeft(pool: Pool, chatId: string, userId: string): Promise<void> {
  await setRegistered(pool, chatId, userId, false);
}

export async function memberJoined(pool: Pool, actor: Actor): Promise<void> {
  await updateProfile(pool, actor);
}
