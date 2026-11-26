import { copy } from "./copy.js";
import type { Actor } from "./game.js";

export type RouteDeps = {
  register: (actor: Actor) => Promise<string>;
  play: (actor: Actor) => Promise<string>;
  stats: (actor: Actor) => Promise<string>;
  memberLeft: (chatId: string, userId: string) => Promise<void>;
  memberJoined: (actor: Actor) => Promise<void>;
};

export type RouteEvent =
  | { kind: "command"; command: string; chatType: string; actor: Actor }
  | { kind: "left"; chatType: string; chatId: string; userId: string }
  | { kind: "joined"; chatType: string; actor: Actor };

export function isGroupChat(chatType: string | undefined): boolean {
  return chatType === "group" || chatType === "supergroup";
}

export async function route(event: RouteEvent, deps: RouteDeps): Promise<string | null> {
  if (event.kind === "command") {
    if (!isGroupChat(event.chatType)) return copy.addToGroup;
    if (event.command === "start" || event.command === "help") return copy.help;
    if (event.command === "register") return deps.register(event.actor);
    if (event.command === "play") return deps.play(event.actor);
    if (event.command === "stats") return deps.stats(event.actor);
    return null;
  }
  if (!isGroupChat(event.chatType)) return null;
  if (event.kind === "left") {
    await deps.memberLeft(event.chatId, event.userId);
    return null;
  }
  await deps.memberJoined(event.actor);
  return null;
}
