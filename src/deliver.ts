import type { MessageEntity } from "grammy/types";
import type { Reply } from "./reply.js";
import { skitPauseMs } from "./reply.js";

type Extra = { entities: MessageEntity[] };

export async function deliver(
  reply: Reply | null,
  send: (text: string, extra?: Extra) => Promise<void>,
  wait: (ms: number) => Promise<void>,
  mentionId: number | null = null,
): Promise<void> {
  if (!reply) return;
  if (reply.kind === "text") {
    await send(reply.text);
    return;
  }
  if (reply.kind === "spoiler") {
    await send(reply.text, {
      entities: [{ type: "spoiler", offset: reply.offset, length: reply.length }],
    });
    return;
  }
  for (const line of reply.lead) {
    await send(line);
    await wait(skitPauseMs);
  }
  const extra: Extra | undefined =
    mentionId === null
      ? undefined
      : {
          entities: [
            {
              type: "text_mention",
              offset: reply.mentionOffset,
              length: reply.mentionLength,
              user: { id: mentionId, is_bot: false, first_name: reply.mentionName },
            },
          ],
        };
  await send(reply.reveal, extra);
}
