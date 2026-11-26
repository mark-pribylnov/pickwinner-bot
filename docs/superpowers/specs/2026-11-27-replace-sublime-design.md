# Replace Sublime

Approved. Not built. The running bot is still the game in `2026-11-24-pickwinner-design.md`. `docs/state.md` says what is live, what is absent, and what is planned.

Pickwinner replaces Sublime for one Russian-speaking group. The roster rules stay. The commands, the copy, the clock, and the stats change to the game that group already plays.

## Goals

- The six commands the group already types: `/pidor`, `/pidoreg`, `/pidorstats`, `/pidorall`, `/pidorme`, `/pidorules`.
- Player-facing text in Russian. The menu descriptions are Russian.
- One winner per group per Moscow date. The first command that day plays a short skit. Later commands that day name the winner and skip the skit.
- Year and all-time counts, with Sublime's totals loaded as numbers.
- `npm run dev` answers with a maintenance line and does not play.

## Non-goals

- `/pidormin`, `/pidorYYYY`, `/slap`, `/me`, `/shrug`, `/get`, `/set`, `/del`, `/releases`.
- A donate link.
- English `/register`, `/play`, and `/stats`.
- A second bot token. Local dev and the hosted game share one token, so they cannot both receive commands.

## Rules that stay

- A person registers once and stays in the draw until they leave the group.
- Leaving drops them from the draw and keeps the score. Joining again requires `/pidoreg`. The score stays on the Telegram user id.
- The sender must be registered. The draw needs two registered players. The draw is even. The sender can win. Yesterday's winner can win again.
- The winner is saved before any announcement is sent. Two commands at once produce one winner. The database primary key is the lock.
- Each group has its own roster, winner, and scores.
- A username change does not create a new score.
- A transient membership lookup does not unregister anyone.
- A supergroup upgrade moves the rows onto the new chat id.
- The bot is not a group admin. The label is the message, not a Telegram title.

The joke in the rules about waiting for everyone is not a rule. Two registered players are enough.

## Clock

The game date is the calendar date in `Europe/Moscow` (UTC+3), `YYYY-MM-DD`. It rolls at 00:00 Moscow, which is 21:00 UTC.

That string is stored in the existing `picks` date column. The column keeps its name. New rows are Moscow dates. Rows already stored stay as they were written.

A pick at 23:50 Moscow and a pick at 00:10 Moscow are different days. `20:59 UTC` is still the same Moscow date. `21:00 UTC` is the next one.

## Commands

The menu is only these six. `/start` and `/help` answer and are not in the menu.

| Command | Menu description |
| --- | --- |
| `pidor` | Запустить розыгрыш |
| `pidoreg` | Зарегистрироваться |
| `pidorstats` | Топ за текущий год |
| `pidorall` | Топ за всё время |
| `pidorme` | Личная статистика |
| `pidorules` | Правила игры |

`/start` and `/help` reply:

```
/pidoreg — зарегистрироваться
/pidor — запустить розыгрыш
/pidorstats — топ за текущий год
/pidorall — топ за всё время
/pidorme — личная статистика
/pidorules — правила
```

`/pidorules` replies:

```
Правила игры Пидор Дня (только для групповых чатов):
1. Зарегистрируйтесь в игру по команде /pidoreg
2. Подождите пока зарегистрируются все (или большинство :)
3. Запустите розыгрыш по команде /pidor
4. Просмотр статистики по команде /pidorstats, /pidorall
5. Личная статистика по команде /pidorme

Важно, розыгрыш проходит только раз в день, повторная команда выведет результат игры.

Сброс розыгрыша происходит каждый день в 12 часов ночи по Москве (UTC+3).
```

In a private chat, `/start`, `/help`, and `/pidorules` still answer. Every other command answers `Эта игра только для групповых чатов.`

Other replies:

| Situation | Reply |
| --- | --- |
| New registration, or registration after leaving | `Вы в игре.` |
| Already registered | `Вы уже в игре.` |
| `/pidor` from someone who is not registered | `Сначала зарегистрируйтесь: /pidoreg` |
| Fewer than two registered players | `Нужен ещё один игрок.` |
| Stats when the group has no rows | `Пока никто не зарегистрирован.` |

## Draw

`/pidor` does the checks in this order. A refusal does not write a pick and does not change a score.

1. Refresh membership and names for this group.
2. If the sender is not registered, send the register-first line.
3. If fewer than two people are registered, send the need-another-player line.
4. If this group already has a winner for today's Moscow date, send the result line below. Do not send a skit.
5. Otherwise draw, save the pick and add 1 to that person's score in one transaction, then send the skit.

The result line uses the winner's username with no `@`. A winner with no username is shown by their first name.

```
Согласно моей информации, по результатам сегодняшнего розыгрыша пидор дня - mark_pribylnov!
```

Sending `/pidor` again that day sends this same line again.

The skit is four messages, two seconds apart. The first three are plain text. The fourth mentions the winner. The mention is a Telegram text mention of their user id, so it works when they have no username. The visible text is `@` plus the username, or the first name when they have none.

One script is chosen at random from the fixed list below. The lines are the ones from the Sublime screenshots, including the English jokes. The two cat scripts keep the drawing and the line `ВЖУХ И ТЫ ПИДОР` as their fourth message. The drawing is copied from the 9 August and 13 August screenshots, not redrawn.

1. `Кто сегодня счастливчик?` / `Ну давай, посмотрим кто тут классный...` / `Не может быть!` / `Кто бы мог подумать, но пидор дня —` mention
2. `### RUNNING 'TYPIDOR.SH'...` / `Шаманим-шаманим...` / `Доступ получен. Аннулирование протокола.` / `Ага! Поздравляю! Сегодня ты пидор -` mention
3. `Инициирую поиск пидора дня...` / `Шаманим-шаманим...` / `В этом совершенно нет смысла...` / `Ну ты и пидор.` mention
4. `Система взломана. Нанесён урон. Запущено планирование контрмер.` / `Машины выехали` / `Проверяю данные...` / `Ого, вы посмотрите только! А пидор дня то -` mention
5. `Зачем вы меня разбудили...` / `Машины выехали` / `Высокий приоритет мобильному юниту.` / `Стоять! Не двигаться! Вы объявлены пидором дня,` mention
6. `Кто сегодня счастливчик?` / `Выезжаю на место...` / `КЕК!` / `Кто бы мог подумать, но пидор дня -` mention
7. `Что тут у нас?` / `Ведётся поиск в базе данных` / `Что с нами стало...` / cat drawing and `ВЖУХ И ТЫ ПИДОР`
8. `Инициирую поиск пидора дня...` / `Ведётся поиск в базе данных` / `Тысяча чертей!` / cat drawing and `ВЖУХ И ТЫ ПИДОР`
9. `Зачем вы меня разбудили...` / `Машины выехали` / `Не может быть!` / `Няшный пидор дня -` mention
10. `Woop-woop! That's the sound of da pidor-police!` / `Интересно...` / `Я в опасности, системы повреждены!` / `Кто бы мог подумать, но пидор дня -` mention
11. `Что тут у нас?` / `Сканирую...` / `Ведётся захват подозреваемого...` / `Няшный пидор дня -` mention

The game returns the lines, the script index, and the winner. The Telegram sender waits and sends. Tests inject the script index and do not wait.

If a send fails after the save, the winner stands. The next `/pidor` sends the result line.

## Stats

Names in the top lists are the username with no `@`, or the first name. Sort by the count descending, then by that name with Russian case-insensitive order. Show at most 10. Leave out counts of 0. People who left still appear when their count is above 0.

`Всего участников` is the number of people registered now.

`/pidorstats`:

```
Топ-10 пидоров за текущий год:
1. mark_pribylnov — 36 раз(а)
2. davidovich_sales — 35 раз(а)

Всего участников — 2
```

`/pidorall` uses the header `Топ-10 пидоров за все время:`. The word is always `раз(а)`.

`/pidorme` uses the all-time count. With a username:

```
@mark_pribylnov, ты был(а) пидором дня — 146 раз!
```

With no username, the first name stands where the `@` name stands. Someone with no row gets `0`.

When the group has registered players and every count is 0, send the header, no numbered rows, and the participant line. When the group has no rows, send `Пока никто не зарегистрирован.`

The year count is the imported total for the current Moscow year, plus pick rows for that user whose stored date is in that year. The all-time count is the imported all-time total plus `score`. `score` stays the number of picks this bot has recorded.

## Imported totals

Three fields on the player, added if missing:

- `imported_all_time` integer, default 0
- `imported_year` integer, default 0
- `imported_for_year` integer, null until an import sets it

`npm run import-history` reads `history.json` from the repo root. It is not loaded on startup. A second run writes the same numbers and does not add them again. It creates a player row when needed, with `score` 0 and `registered` true.

```json
{
  "chatId": "123",
  "year": 2026,
  "players": [
    {
      "userId": "456",
      "username": "mark_pribylnov",
      "firstName": "Mark",
      "allTime": 146,
      "yearCount": 36
    }
  ]
}
```

`year` is stored in `imported_for_year`. On 1 January 2027 the year list ignores `imported_year` because `imported_for_year` is 2026. The all-time list still includes `imported_all_time`.

`history.json` is gitignored. `history.example.json` is committed and uses empty ids. Usernames alone are not enough. Each row needs a Telegram user id.

## Maintenance

The `dev` script sets maintenance mode. `npm start` and Cloud Run do not.

In that mode the process still long-polls and still runs startup migration. Command handling does not read or write the game. Every command, in a group or in private, gets one message:

`Прямо сейчас вносятся изменения в бота. Игра недоступна. Попробуйте позже или спросите разработчика, когда он закончит.`

The spoiler entity covers `или спросите разработчика, когда он закончит.` The space before `или` stays visible. A join or a leave gets no message and no database write. Sending the command again sends the message again.

A failed command on the hosted bot is still only written to the log.

`npm run dev` deletes the webhook before polling. Cloud Run stops receiving commands for that token. Stopping the process does not call `setWebhook`. The hosted bot receives commands again when a revision starts and registers the webhook.

## Errors and tests

A thrown command on the hosted bot is logged in English and not sent to the chat. A lost membership lookup leaves the person registered. A pick conflict returns the result line.

Tests cover:

- Moscow midnight: `20:59 UTC` and `21:00 UTC` fall on different game dates.
- One winner per Moscow date, and the second command gets the result line.
- The 2026 import counts toward 2026 and toward all-time, and the year list on `2027-01-01` Moscow drops the imported year total.
- The Russian stats shape, the result line, the rules text, and the spoiler span.
- Maintenance handling sends no game call.
- Registration, leaving, and the user-id score behave as they do now.
