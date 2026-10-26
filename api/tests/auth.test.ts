import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashToken } from "../src/lib/sessionRepository.js";
import { makeTestApp, PASSWORD, resetDb, sessionCookie, signUp, type TestApp } from "./helpers.js";

let app: TestApp;
let pool: pg.Pool;

beforeAll(() => {
  ({ app, pool } = makeTestApp());
});
beforeEach(() => resetDb(pool));
afterAll(() => pool.end());

describe("POST /auth/register", () => {
  it("creates an account, normalises the email and signs the user in", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/auth/register").send({ email: "  Ana@Example.COM ", password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "ana@example.com" });
    expect(res.body.user).not.toHaveProperty("password_hash");

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("ana@example.com");
  });

  it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
    const res = await request(app).post("/auth/register").send({ email: "a@example.com", password: PASSWORD });
    const cookie = sessionCookie(res)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Secure/); // tests run over plain HTTP
  });

  it("marks the cookie Secure when configured for production", async () => {
    const { app: secureApp, pool: p2 } = makeTestApp({ cookieSecure: true });
    const res = await request(secureApp).post("/auth/register").send({ email: "s@example.com", password: PASSWORD });
    expect(sessionCookie(res)).toMatch(/Secure/);
    await p2.end();
  });

  it("stores an Argon2id hash, never the password", async () => {
    await request(app).post("/auth/register").send({ email: "a@example.com", password: PASSWORD });
    const { rows } = await pool.query("SELECT password_hash FROM users");
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
  });

  it("stores only a SHA-256 hash of the session token", async () => {
    const res = await request(app).post("/auth/register").send({ email: "a@example.com", password: PASSWORD });
    const token = decodeURIComponent(sessionCookie(res)!.split(";")[0]!.split("=")[1]!);
    const { rows } = await pool.query("SELECT token_hash FROM sessions");
    expect(rows).toHaveLength(1);
    expect(Buffer.compare(rows[0].token_hash, hashToken(token))).toBe(0);
    expect(rows[0].token_hash.toString("utf8")).not.toContain(token);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await signUp(app, "ana@example.com");
    const res = await request(app).post("/auth/register").send({ email: "ANA@example.com", password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it.each([
    [{ email: "not-an-email", password: PASSWORD }, "email"],
    [{ email: "a@example.com", password: "short" }, "password"],
    [{ email: "a@example.com", password: "x".repeat(129) }, "password"],
    [{ email: "a@example.com" }, "password"],
    [{ email: "a@example.com", password: PASSWORD, role: "admin" }, ""],
  ])("rejects invalid input %j", async (body, field) => {
    const res = await request(app).post("/auth/register").send(body);
    expect(res.status).toBe(400);
    if (field) expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
    expect(sessionCookie(res)).toBeUndefined();
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await signUp(app, "ana@example.com");
  });

  it("signs in with the right password", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/auth/login").send({ email: "Ana@example.com", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("ana@example.com");
    expect((await agent.get("/auth/me")).status).toBe(200);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await request(app).post("/auth/login").send({ email: "ana@example.com", password: "wrong password" });
    const unknown = await request(app).post("/auth/login").send({ email: "nobody@example.com", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(sessionCookie(wrong)).toBeUndefined();
  });

  it("issues a new session token on every login (no session fixation)", async () => {
    const agent = request.agent(app);
    const first = sessionCookie(await agent.post("/auth/login").send({ email: "ana@example.com", password: PASSWORD }));
    const second = sessionCookie(await agent.post("/auth/login").send({ email: "ana@example.com", password: PASSWORD }));
    expect(first).toBeDefined();
    expect(second).not.toBe(first);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM sessions");
    expect(rows[0].n).toBe(2); // signUp's session + the latest login; the replaced one was deleted
  });

  it("rate-limits repeated attempts from one address", async () => {
    const { app: limited, pool: p2 } = makeTestApp({ authRateLimit: 3 });
    const attempt = () => request(limited).post("/auth/login").send({ email: "ana@example.com", password: "nope nope" });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/Too many attempts/);
    await p2.end();
  });
});

describe("sessions", () => {
  it("GET /auth/me requires a session", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentication required");
  });

  it("rejects a forged session token", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", "tf_session=forged-token-value");
    expect(res.status).toBe(401);
  });

  it("logout ends the session on the server, not just in the browser", async () => {
    const reg = await request(app).post("/auth/register").send({ email: "a@example.com", password: PASSWORD });
    const cookie = sessionCookie(reg)!.split(";")[0]!;
    expect((await request(app).get("/auth/me").set("Cookie", cookie)).status).toBe(200);

    const out = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);
    expect(sessionCookie(out)).toMatch(/tf_session=;/); // browser told to drop it

    // Replaying the old cookie no longer works.
    expect((await request(app).get("/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).get("/tasks").set("Cookie", cookie)).status).toBe(401);
  });

  it("rejects an expired session", async () => {
    const { agent } = await signUp(app);
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect((await agent.get("/auth/me")).status).toBe(401);
  });
});

describe("CSRF protection", () => {
  it("blocks a write from another website", async () => {
    const { agent } = await signUp(app);
    const res = await agent.post("/tasks").set("Origin", "https://evil.example").send({ title: "Injected" });
    expect(res.status).toBe(403);
    expect((await agent.get("/tasks")).body.total).toBe(0);
  });

  it("allows a write from the app's own origin", async () => {
    const { agent } = await signUp(app);
    const res = await agent.post("/tasks").set("Origin", "http://127.0.0.1").set("Host", "127.0.0.1").send({ title: "Mine" });
    expect(res.status).toBe(201);
  });
});
