import type pg from "pg";
import request from "supertest";
import { createApp, type AppOptions } from "../src/app.js";
import { createPool } from "../src/db.js";

export type TestApp = ReturnType<typeof createApp>;

export function makeTestApp(opts: Partial<AppOptions> = {}): { app: TestApp; pool: pg.Pool } {
  const pool = createPool(process.env.DATABASE_URL!);
  const app = createApp({ db: pool, logLevel: "silent", authRateLimit: 1000, ...opts });
  return { app, pool };
}

export async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query("TRUNCATE tasks, sessions, users");
}

export const PASSWORD = "correct horse battery";

/** Register a new user and return a supertest agent that keeps their session cookie. */
export async function signUp(app: TestApp, email = `user-${crypto.randomUUID()}@example.com`) {
  const agent = request.agent(app);
  const res = await agent.post("/auth/register").send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user as { id: string; email: string } };
}

/** The session cookie value from a Set-Cookie response header. */
export function sessionCookie(res: request.Response): string | undefined {
  const raw = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return raw.find((c) => c.startsWith("tf_session="));
}
