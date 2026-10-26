import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs the real migration files inside a scratch schema, so the shared test tables
// are untouched and each case starts from the state the migration would meet.
const sql = (file: string) => readFileSync(new URL(`../sql/${file}`, import.meta.url), "utf8");
const SCHEMA = "migration_test";
let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
});
beforeEach(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  await client.query(`SET search_path = ${SCHEMA}`);
  await client.query(sql("001_create_tasks.sql"));
});
afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.end();
});

/** Apply a migration the way scripts/migrate.ts does: in one transaction. */
async function migrate(file: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql(file));
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

describe("002_users_sessions.sql", () => {
  it("applies cleanly to a database with no tasks", async () => {
    await migrate("002_users_sessions.sql");
    const { rows } = await client.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'tasks' AND column_name = 'user_id'`,
      [SCHEMA],
    );
    expect(rows[0].is_nullable).toBe("NO");
  });

  it("refuses to run, and deletes nothing, when tasks have no owner", async () => {
    await client.query("INSERT INTO tasks (title) VALUES ('Existing task 1'), ('Existing task 2')");
    await expect(migrate("002_users_sessions.sql")).rejects.toThrow(/2 existing task\(s\) have no owner/);

    const { rows } = await client.query("SELECT count(*)::int AS n FROM tasks");
    expect(rows[0].n).toBe(2);
    const users = await client.query("SELECT to_regclass($1) AS t", [`${SCHEMA}.users`]);
    expect(users.rows[0].t).toBeNull(); // rolled back completely
  });

  it("keeps existing tasks once they are assigned an owner", async () => {
    await client.query("INSERT INTO tasks (title) VALUES ('Keep me')");
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL CHECK (email = lower(email) AND char_length(email) <= 254),
        password_hash TEXT NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      INSERT INTO users (email, password_hash) VALUES ('owner@example.com', '$argon2id$v=19$placeholder');
      ALTER TABLE tasks ADD COLUMN user_id UUID REFERENCES users (id) ON DELETE CASCADE;
      UPDATE tasks SET user_id = (SELECT id FROM users);`);
    await migrate("002_users_sessions.sql");
    const { rows } = await client.query("SELECT title, user_id IS NOT NULL AS owned FROM tasks");
    expect(rows).toEqual([{ title: "Keep me", owned: true }]);
  });
});
