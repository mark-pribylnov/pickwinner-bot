import pg from "pg";

export type PlayerRow = {
  chatId: string;
  userId: string;
  username: string;
  firstName: string;
  score: number;
  registered: boolean;
  importedAllTime: number;
  importedYear: number;
  importedForYear: number | null;
};

export type HistoryImport = {
  chatId: string;
  year: number;
  players: Array<{
    userId: string;
    username: string;
    firstName: string;
    allTime: number;
    yearCount: number;
  }>;
};

type Person = {
  chatId: string;
  userId: string;
  username: string;
  firstName: string;
};

type PlayerRecord = {
  chat_id: string;
  user_id: string;
  username: string;
  first_name: string;
  score: number;
  registered: boolean;
  imported_all_time: number;
  imported_year: number;
  imported_for_year: number | null;
};

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString });
  pool.on("error", (error: Error) => {
    console.error("postgres idle client error", error.message);
  });
  return pool;
}

export async function closePool(pool: pg.Pool): Promise<void> {
  await pool.end();
}

export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      chat_id text NOT NULL,
      user_id text NOT NULL,
      username text NOT NULL DEFAULT '',
      first_name text NOT NULL,
      score integer NOT NULL DEFAULT 0,
      registered boolean NOT NULL DEFAULT false,
      imported_all_time integer NOT NULL DEFAULT 0,
      imported_year integer NOT NULL DEFAULT 0,
      imported_for_year integer,
      PRIMARY KEY (chat_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS picks (
      chat_id text NOT NULL,
      utc_date text NOT NULL,
      user_id text NOT NULL,
      PRIMARY KEY (chat_id, utc_date)
    )
  `);
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS imported_all_time integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS imported_year integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS imported_for_year integer`);
}

export async function registerPlayer(
  pool: pg.Pool,
  person: Person,
): Promise<"created" | "already" | "reregistered"> {
  const result = await pool.query<{ result: "created" | "already" | "reregistered" }>(
    `WITH previous AS (
       SELECT registered
       FROM players
       WHERE chat_id = $1 AND user_id = $2
     ),
     upserted AS (
       INSERT INTO players (chat_id, user_id, username, first_name, score, registered)
       VALUES ($1, $2, $3, $4, 0, true)
       ON CONFLICT (chat_id, user_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           registered = true
       RETURNING score
     )
     SELECT CASE
       WHEN NOT EXISTS (SELECT 1 FROM previous) THEN 'created'
       WHEN (SELECT registered FROM previous) THEN 'already'
       ELSE 'reregistered'
     END AS result
     FROM upserted`,
    [person.chatId, person.userId, person.username, person.firstName],
  );
  const row = result.rows[0];
  if (!row) throw new Error("registerPlayer did not return a row");
  return row.result;
}

export async function updateProfile(pool: pg.Pool, person: Person): Promise<void> {
  await pool.query(
    `UPDATE players
     SET username = $3, first_name = $4
     WHERE chat_id = $1 AND user_id = $2`,
    [person.chatId, person.userId, person.username, person.firstName],
  );
}

export async function setRegistered(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  registered: boolean,
): Promise<void> {
  await pool.query(
    `UPDATE players SET registered = $3 WHERE chat_id = $1 AND user_id = $2`,
    [chatId, userId, registered],
  );
}

export async function listPlayers(pool: pg.Pool, chatId: string): Promise<PlayerRow[]> {
  const result = await pool.query<PlayerRecord>(
    `SELECT chat_id, user_id, username, first_name, score, registered,
            imported_all_time, imported_year, imported_for_year
     FROM players
     WHERE chat_id = $1`,
    [chatId],
  );
  return result.rows.map((row) => ({
    chatId: row.chat_id,
    userId: row.user_id,
    username: row.username,
    firstName: row.first_name,
    score: row.score,
    registered: row.registered,
    importedAllTime: row.imported_all_time,
    importedYear: row.imported_year,
    importedForYear: row.imported_for_year,
  }));
}

export async function importTotals(pool: pg.Pool, history: HistoryImport): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const player of history.players) {
      await client.query(
        `INSERT INTO players (
           chat_id, user_id, username, first_name, score, registered,
           imported_all_time, imported_year, imported_for_year
         )
         VALUES ($1, $2, $3, $4, 0, true, $5, $6, $7)
         ON CONFLICT (chat_id, user_id) DO UPDATE
         SET username = CASE WHEN EXCLUDED.username <> '' THEN EXCLUDED.username ELSE players.username END,
             first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE players.first_name END,
             imported_all_time = EXCLUDED.imported_all_time,
             imported_year = EXCLUDED.imported_year,
             imported_for_year = EXCLUDED.imported_for_year`,
        [
          history.chatId,
          player.userId,
          player.username,
          player.firstName,
          player.allTime,
          player.yearCount,
          history.year,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function countPicksByUser(
  pool: pg.Pool,
  chatId: string,
  year: number,
): Promise<Map<string, number>> {
  const result = await pool.query<{ user_id: string; picks: number }>(
    `SELECT user_id, COUNT(*)::int AS picks
     FROM picks
     WHERE chat_id = $1 AND utc_date LIKE $2
     GROUP BY user_id`,
    [chatId, `${year}-%`],
  );
  return new Map(result.rows.map((row) => [row.user_id, Number(row.picks)]));
}

export async function getPick(
  pool: pg.Pool,
  chatId: string,
  utcDate: string,
): Promise<{ userId: string } | null> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM picks WHERE chat_id = $1 AND utc_date = $2`,
    [chatId, utcDate],
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id } : null;
}

export async function migrateChat(pool: pg.Pool, fromChatId: string, toChatId: string): Promise<void> {
  if (fromChatId === toChatId) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE players AS destination
       SET score = GREATEST(destination.score, source.score),
           registered = destination.registered OR source.registered,
           username = CASE WHEN destination.username <> '' THEN destination.username ELSE source.username END,
           first_name = CASE WHEN destination.first_name <> '' THEN destination.first_name ELSE source.first_name END,
           imported_all_time = GREATEST(destination.imported_all_time, source.imported_all_time),
           imported_year = CASE
             WHEN destination.imported_for_year IS NOT NULL THEN destination.imported_year
             ELSE source.imported_year
           END,
           imported_for_year = COALESCE(destination.imported_for_year, source.imported_for_year)
       FROM players AS source
       WHERE destination.chat_id = $2
         AND source.chat_id = $1
         AND destination.user_id = source.user_id`,
      [fromChatId, toChatId],
    );
    await client.query(
      `DELETE FROM players AS source
       USING players AS destination
       WHERE source.chat_id = $1
         AND destination.chat_id = $2
         AND source.user_id = destination.user_id`,
      [fromChatId, toChatId],
    );
    await client.query(`UPDATE players SET chat_id = $2 WHERE chat_id = $1`, [fromChatId, toChatId]);
    await client.query(
      `DELETE FROM picks AS source
       USING picks AS destination
       WHERE source.chat_id = $1
         AND destination.chat_id = $2
         AND source.utc_date = destination.utc_date`,
      [fromChatId, toChatId],
    );
    await client.query(`UPDATE picks SET chat_id = $2 WHERE chat_id = $1`, [fromChatId, toChatId]);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function tryRecordPick(
  pool: pg.Pool,
  chatId: string,
  utcDate: string,
  userId: string,
): Promise<"recorded" | "conflict"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO picks (chat_id, utc_date, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (chat_id, utc_date) DO NOTHING
       RETURNING user_id`,
      [chatId, utcDate, userId],
    );
    if ((inserted.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return "conflict";
    }
    const updated = await client.query(
      `UPDATE players
       SET score = score + 1
       WHERE chat_id = $1 AND user_id = $2 AND registered = true`,
      [chatId, userId],
    );
    if ((updated.rowCount ?? 0) !== 1) {
      await client.query("ROLLBACK");
      throw new Error("pick target is not a registered player");
    }
    await client.query("COMMIT");
    return "recorded";
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    throw error;
  } finally {
    client.release();
  }
}
