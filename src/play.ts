export type PlayDecision =
  | { ok: false; reason: "not_registered" | "need_another_player" | "already_picked" }
  | { ok: true; userId: string };

export function decidePlay(input: {
  senderRegistered: boolean;
  registeredUserIds: readonly string[];
  alreadyPicked: boolean;
  randomIndex: (length: number) => number;
}): PlayDecision {
  if (!input.senderRegistered) return { ok: false, reason: "not_registered" };
  if (input.registeredUserIds.length < 2) return { ok: false, reason: "need_another_player" };
  if (input.alreadyPicked) return { ok: false, reason: "already_picked" };
  const index = input.randomIndex(input.registeredUserIds.length);
  const userId = input.registeredUserIds[index];
  if (userId === undefined) {
    throw new Error(`randomIndex returned ${index} for length ${input.registeredUserIds.length}`);
  }
  return { ok: true, userId };
}
