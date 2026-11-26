export type TextReply = { kind: "text"; text: string };

export type SkitReply = {
  kind: "skit";
  scriptIndex: number;
  lead: readonly [string, string, string];
  reveal: string;
  mentionOffset: number;
  mentionLength: number;
  userId: string;
  mentionName: string;
};

export type SpoilerReply = {
  kind: "spoiler";
  text: string;
  offset: number;
  length: number;
};

export type Reply = TextReply | SkitReply | SpoilerReply;

export const skitPauseMs = 2000;

export function textReply(text: string): TextReply {
  return { kind: "text", text };
}
