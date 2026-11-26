export function displayName(person: {
  username: string;
  firstName: string;
  userId: string;
}): string {
  if (person.username !== "") return `@${person.username}`;
  if (person.firstName !== "") return person.firstName;
  return person.userId;
}

export function plainName(person: {
  username: string;
  firstName: string;
  userId: string;
}): string {
  if (person.username !== "") return person.username;
  if (person.firstName !== "") return person.firstName;
  return person.userId;
}
