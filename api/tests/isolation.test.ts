import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp, resetDb, signUp, type TestApp } from "./helpers.js";

let app: TestApp;
let pool: pg.Pool;
let ana: Awaited<ReturnType<typeof signUp>>;
let ben: Awaited<ReturnType<typeof signUp>>;
let anaTask: { id: string; title: string };

beforeAll(() => {
  ({ app, pool } = makeTestApp());
});
beforeEach(async () => {
  await resetDb(pool);
  ana = await signUp(app, "ana@example.com");
  ben = await signUp(app, "ben@example.com");
  anaTask = (await ana.agent.post("/tasks").send({ title: "Ana's private task", status: "done" })).body;
  await ben.agent.post("/tasks").send({ title: "Ben's task" });
});
afterAll(() => pool.end());

describe("every task endpoint requires a session", () => {
  const id = "00000000-0000-4000-8000-000000000000";
  it.each([
    ["get", "/tasks"],
    ["get", "/tasks/stats"],
    ["get", `/tasks/${id}`],
    ["post", "/tasks"],
    ["patch", `/tasks/${id}`],
    ["delete", `/tasks/${id}`],
  ] as const)("%s %s → 401", async (method, path) => {
    const res = await request(app)[method](path).send({ title: "x" });
    expect(res.status).toBe(401);
  });
});

describe("one user cannot touch another user's tasks", () => {
  it("lists and stats only include the user's own tasks", async () => {
    const list = await ben.agent.get("/tasks");
    expect(list.body.items.map((t: { title: string }) => t.title)).toEqual(["Ben's task"]);
    expect((await ben.agent.get("/tasks/stats")).body).toEqual({ todo: 1, in_progress: 0, done: 0 });
    expect((await ana.agent.get("/tasks/stats")).body).toEqual({ todo: 0, in_progress: 0, done: 1 });
  });

  it("search and filters cannot reach other users' tasks", async () => {
    const res = await ben.agent.get("/tasks").query({ q: "private", status: "done" });
    expect(res.body.total).toBe(0);
  });

  it("reading someone else's task looks exactly like a missing task (404)", async () => {
    const res = await ben.agent.get(`/tasks/${anaTask.id}`);
    expect(res.status).toBe(404);
    const missing = await ben.agent.get("/tasks/00000000-0000-4000-8000-000000000000");
    expect(res.body).toEqual(missing.body);
  });

  it("updating someone else's task fails and changes nothing", async () => {
    const res = await ben.agent.patch(`/tasks/${anaTask.id}`).send({ title: "Hacked" });
    expect(res.status).toBe(404);
    expect((await ana.agent.get(`/tasks/${anaTask.id}`)).body.title).toBe("Ana's private task");
  });

  it("deleting someone else's task fails and keeps it", async () => {
    expect((await ben.agent.delete(`/tasks/${anaTask.id}`)).status).toBe(404);
    expect((await ana.agent.get(`/tasks/${anaTask.id}`)).status).toBe(200);
  });

  it("cannot create a task on behalf of another user", async () => {
    const res = await ben.agent.post("/tasks").send({ title: "Planted", user_id: ana.user.id });
    expect(res.status).toBe(400);
    expect((await ana.agent.get("/tasks")).body.total).toBe(1);
  });
});

describe("database constraints back up the API", () => {
  it("a task cannot exist without an owner", async () => {
    await expect(pool.query("INSERT INTO tasks (title) VALUES ('orphan')")).rejects.toThrow(/user_id/);
  });

  it("deleting a user removes their tasks and sessions", async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [ana.user.id]);
    const { rows } = await pool.query(
      "SELECT (SELECT count(*) FROM tasks WHERE user_id = $1)::int AS t, (SELECT count(*) FROM sessions WHERE user_id = $1)::int AS s",
      [ana.user.id],
    );
    expect(rows[0]).toEqual({ t: 0, s: 0 });
  });
});
