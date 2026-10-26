import type pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp, resetDb, signUp } from "./helpers.js";

let app: ReturnType<typeof makeTestApp>["app"];
let pool: pg.Pool;
// Every task test runs as a freshly registered, signed-in user.
let agent: Awaited<ReturnType<typeof signUp>>["agent"];

beforeAll(() => {
  ({ app, pool } = makeTestApp());
});
beforeEach(async () => {
  await resetDb(pool);
  ({ agent } = await signUp(app));
});
afterAll(() => pool.end());

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

async function createTask(body: Record<string, unknown> = {}) {
  const res = await agent.post("/tasks").send({ title: "Write tests", ...body });
  expect(res.status).toBe(201);
  return res.body;
}

describe("GET /health", () => {
  it("reports ok when the database is reachable", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("POST /tasks", () => {
  it("creates a task with defaults", async () => {
    const res = await agent.post("/tasks").send({ title: "  Learn TypeScript  " });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/tasks/${res.body.id}`);
    expect(res.body).toMatchObject({
      title: "Learn TypeScript", // trimmed
      status: "todo",
      priority: "medium",
      assignee: null,
      due_date: null,
    });
  });

  it("stores all optional fields", async () => {
    const task = await createTask({
      description: "Cover every endpoint",
      status: "in_progress",
      priority: "high",
      assignee: "sadia",
      due_date: "2026-11-01",
    });
    expect(task).toMatchObject({ priority: "high", assignee: "sadia", due_date: "2026-11-01" });
  });

  it.each([
    [{}, "title"],
    [{ title: "" }, "title"],
    [{ title: "x".repeat(201) }, "title"],
    [{ title: "ok", status: "finished" }, "status"],
    [{ title: "ok", due_date: "next week" }, "due_date"],
    [{ title: "ok", isAdmin: true }, ""],
    [{ title: "ok", user_id: "00000000-0000-4000-8000-000000000000" }, ""],
  ])("rejects invalid body %j", async (body, field) => {
    const res = await agent.post("/tasks").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Validation failed");
    if (field) {
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
    }
  });

  it("rejects malformed JSON", async () => {
    const res = await agent
      .post("/tasks")
      .set("Content-Type", "application/json")
      .send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not valid JSON/);
  });
});

describe("GET /tasks", () => {
  it("lists tasks newest first with a total", async () => {
    await createTask({ title: "first" });
    await createTask({ title: "second" });
    const res = await agent.get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(["second", "first"]);
  });

  it("filters by status, assignee and text search", async () => {
    await createTask({ title: "Fix login bug", status: "done", assignee: "ana" });
    await createTask({ title: "Write docs", assignee: "ana" });
    await createTask({ title: "Fix CI", assignee: "ben" });

    const byStatus = await agent.get("/tasks?status=done");
    expect(byStatus.body.items).toHaveLength(1);

    const byAssignee = await agent.get("/tasks?assignee=ana");
    expect(byAssignee.body.total).toBe(2);

    const search = await agent.get("/tasks?q=fix");
    expect(search.body.total).toBe(2);
  });

  it("treats search wildcards literally", async () => {
    await createTask({ title: "Reach 100% coverage" });
    await createTask({ title: "Reach 1000 users" });
    const res = await agent.get("/tasks").query({ q: "100%" });
    expect(res.body.total).toBe(1);
  });

  it("sorts by priority", async () => {
    await createTask({ title: "low", priority: "low" });
    await createTask({ title: "high", priority: "high" });
    await createTask({ title: "medium", priority: "medium" });
    const res = await agent.get("/tasks?sort=priority&order=desc");
    expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(["high", "medium", "low"]);
  });

  it("paginates", async () => {
    for (let i = 0; i < 5; i++) await createTask({ title: `task ${i}` });
    const res = await agent.get("/tasks?limit=2&offset=2");
    expect(res.body).toMatchObject({ total: 5, limit: 2, offset: 2 });
    expect(res.body.items).toHaveLength(2);
  });

  it("rejects invalid query parameters", async () => {
    const res = await agent.get("/tasks?limit=500");
    expect(res.status).toBe(400);
  });
});

describe("GET /tasks/:id", () => {
  it("returns one task", async () => {
    const task = await createTask();
    const res = await agent.get(`/tasks/${task.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(task.id);
  });

  it("returns 404 for a missing task", async () => {
    const res = await agent.get(`/tasks/${MISSING_ID}`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await agent.get("/tasks/not-a-uuid");
    expect(res.status).toBe(400);
  });
});

describe("PATCH /tasks/:id", () => {
  it("updates only the given fields and bumps updated_at", async () => {
    const task = await createTask({ assignee: "ana" });
    const res = await agent.patch(`/tasks/${task.id}`).send({ status: "done" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "done", assignee: "ana", title: task.title });
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(task.updated_at).getTime(),
    );
  });

  it("can clear a nullable field", async () => {
    const task = await createTask({ assignee: "ana" });
    const res = await agent.patch(`/tasks/${task.id}`).send({ assignee: null });
    expect(res.body.assignee).toBeNull();
  });

  it("rejects an empty update", async () => {
    const task = await createTask();
    const res = await agent.patch(`/tasks/${task.id}`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when the task does not exist", async () => {
    const res = await agent.patch(`/tasks/${MISSING_ID}`).send({ status: "done" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /tasks/:id", () => {
  it("deletes a task", async () => {
    const task = await createTask();
    expect((await agent.delete(`/tasks/${task.id}`)).status).toBe(204);
    expect((await agent.get(`/tasks/${task.id}`)).status).toBe(404);
  });

  it("returns 404 when the task does not exist", async () => {
    const res = await agent.delete(`/tasks/${MISSING_ID}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /tasks/stats", () => {
  it("counts tasks per status", async () => {
    await createTask({ status: "done" });
    await createTask({ status: "done" });
    await createTask();
    const res = await agent.get("/tasks/stats");
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 2 });
  });
});

describe("unknown routes", () => {
  it("return a JSON 404", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/);
  });
});
