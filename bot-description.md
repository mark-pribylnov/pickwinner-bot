# Pickwinner

A Telegram bot added to a group. People register with `/register`. When a registered player runs `/play`, and at least two people are registered, the bot picks one of them at random and labels that person the fool. The person who ran `/play` can be the one selected. The group gets one successful pick per UTC day. The day resets at 00:00 UTC. A successful pick does not move that reset. The bot does not tell players when the reset happens. Each pick is saved against that person's Telegram user id. Any user can run `/stats`. The list shows registered people, including people whose score is 0, and people who have left.

`/register` is the register command I am using for the build. The game behavior below is agreed.

## The game

The bot lives in a Telegram group. Each group has its own registered list, its own fool, and its own stats.

Users register with `/register`.

A person stays registered while they remain in the group. The next day they do not register again.

If they leave the group, they are dropped from the registered list.

If they join the group again, they need to register again to participate. Their old score continues.

Only a registered player may run `/play`. Someone who is in the group and not registered is refused.

If only one player is registered, `/play` tells that player they need another player to play the game. That reply does not use up the day's pick.

The day resets at 00:00 UTC. A successful pick does not affect that timer. Players are not told when the time resets.

Once a fool has been picked in the current UTC day, another `/play` is refused. The refusal does not say when the next pick opens.

`/play` picks a random person from the ones who are registered, once there are two or more. The draw is uniform. Yesterday's fool can be picked again.

The person who triggered the pick can also be selected:

```
alex: /play
bot:  The fool is alex
```

The picked person is labeled "fool". That announcement is the label.

Every time someone is picked, the bot saves the result on that person's Telegram user id. The score stays with that id.

Any user can run `/stats`. The list shows every registered person, including people whose score is 0, and every leaver who still has a saved score.

## Names

Telegram assigns every user a unique id. The stats row is that id.

If a person leaves and later returns with a different username, the username shown in the stats changes and the score stays the same.

If a person changes username without leaving the group, the stored username updates when anyone runs `/play`. The score stays the same. `/stats` shows the username already stored until that happens.

On `/play`, the bot refreshes usernames for people still in the group before it announces the fool.

Someone with no Telegram username is shown by their first name. The row is still their user id.

## Chat shape

```
alex: /register
sam:  /register
alex: /play
bot:  The fool is alex.

sam:  /play
bot:  A fool was already picked.

alex: /stats
bot:  sam — 4
      alex — 2
      jordan — 1
      riley — 0
```

With only one registered player:

```
alex: /play
bot:  You need another player to play the game.
```

"A fool was already picked." says nothing about when the day resets.

## Stack

- TypeScript
- Node.js
- grammY
- Long polling
- Postgres (`DATABASE_URL`)

No HTTP server. During a quiet week the process stays started and waits on one open call to Telegram. Postgres runs separately and is already up before the bot starts.
