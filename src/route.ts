import { maintenanceMessage, ru } from "./copy.js";
import type { Actor } from "./game.js";
import { textReply, type Reply } from "./reply.js";

export type RouteDeps = {
  register: (actor: Actor) => Promise<Reply>;
  play: (actor: Actor) => Promise<Reply>;
  yearStats: (actor: Actor) => Promise<Reply>;
  allTimeStats: (actor: Actor) => Promise<Reply>;
  me: (actor: Actor) => Promise<Reply>;
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

export async function route(event: RouteEvent, deps: RouteDeps): Promise<Reply | null> {
  if (event.kind === "command") {
    if (event.command === "start" || event.command === "help") return textReply(ru.help);
    if (event.command === "pidorules") return textReply(ru.rules);
    if (!isGroupChat(event.chatType)) return textReply(ru.addToGroup);
    if (event.command === "pidoreg") return deps.register(event.actor);
    if (event.command === "pidor") return deps.play(event.actor);
    if (event.command === "pidorstats") return deps.yearStats(event.actor);
    if (event.command === "pidorall") return deps.allTimeStats(event.actor);
    if (event.command === "pidorme") return deps.me(event.actor);
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

export async function dispatch(
  input: { maintenance: boolean; event: RouteEvent },
  deps: RouteDeps,
): Promise<Reply | null> {
  if (input.maintenance) {
    if (input.event.kind === "command") return maintenanceMessage();
    return null;
  }
  return route(input.event, deps);
}
