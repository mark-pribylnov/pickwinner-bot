export const copy = {
  registered: "You're registered.",
  alreadyRegistered: "You're already registered.",
  registerBeforePlay: "Register before you can play.",
  needAnotherPlayer: "You need another player to play the game.",
  alreadyPicked: "A fool was already picked.",
  noOneRegistered: "No one has registered.",
  addToGroup: "Add me to a group to play.",
  help: "/register — join the game\n/play — pick the fool\n/stats — show scores",
} as const;

export function foolAnnouncement(name: string): string {
  return `The fool is ${name}.`;
}
