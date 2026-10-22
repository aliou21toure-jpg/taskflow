import type pg from "pg";
import { createApp } from "../src/app.js";
import { createPool } from "../src/db.js";

export function makeTestApp(): { app: ReturnType<typeof createApp>; pool: pg.Pool } {
  const pool = createPool(process.env.DATABASE_URL!);
  const app = createApp({ db: pool, logLevel: "silent" });
  return { app, pool };
}

export async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query("TRUNCATE tasks");
}
