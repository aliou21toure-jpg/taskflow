import { vi } from "vitest";
import type { Task } from "../types";

/**
 * An in-memory stand-in for the TaskFlow API, installed in place of fetch.
 * It models sessions (one signed-in user at a time), per-user tasks, and lets a test
 * force the next matching request to fail.
 */
export function installFakeApi(opts: { signedInAs?: string; tasks?: Task[] } = {}) {
  const users = new Map<string, string>([["ana@example.com", "correct horse"]]);
  let session: string | null = opts.signedInAs ?? null;
  let tasks = [...(opts.tasks ?? [])];
  const failures: { method: string; path: RegExp; status: number; message: string }[] = [];

  const json = (body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), { status });
  const err = (status: number, message: string) => json({ error: { message } }, status);
  const user = (email: string) => ({ user: { id: email, email, created_at: "2026-01-01T00:00:00Z" } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const path = url.pathname.replace(/^\/api/, "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    const fail = failures.findIndex((f) => f.method === method && f.path.test(path));
    if (fail !== -1) {
      const [f] = failures.splice(fail, 1);
      if (f!.status === 0) throw new TypeError("Failed to fetch");
      return err(f!.status, f!.message);
    }

    if (path === "/auth/login") {
      if (users.get(body.email) !== body.password) return err(401, "Invalid email or password");
      session = body.email;
      return json(user(body.email));
    }
    if (path === "/auth/register") {
      if (users.has(body.email)) return err(409, "An account with this email already exists");
      users.set(body.email, body.password);
      session = body.email;
      return json(user(body.email), 201);
    }
    if (path === "/auth/logout") {
      session = null;
      return json(null, 204);
    }
    if (!session) return err(401, "Authentication required");
    if (path === "/auth/me") return json(user(session));

    if (path === "/tasks/stats") {
      const s = { todo: 0, in_progress: 0, done: 0 };
      tasks.forEach((t) => s[t.status]++);
      return json(s);
    }
    if (path === "/tasks" && method === "GET") {
      const q = url.searchParams.get("q")?.toLowerCase();
      const items = q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks;
      return json({ items, total: items.length, limit: 100, offset: 0 });
    }
    if (path === "/tasks" && method === "POST") {
      const task = makeTask({ ...body, id: crypto.randomUUID() });
      tasks = [task, ...tasks];
      return json(task, 201);
    }
    const id = path.split("/")[2]!;
    if (method === "PATCH") {
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...body } : t));
      return json(tasks.find((t) => t.id === id));
    }
    if (method === "DELETE") {
      tasks = tasks.filter((t) => t.id !== id);
      return json(null, 204);
    }
    return err(404, "not found");
  });
  globalThis.fetch = fetchMock as typeof fetch;

  return {
    fetchMock,
    /** Make the next request matching method + path fail (status 0 = network error). */
    failNext(method: string, path: RegExp, status: number, message = `HTTP ${status}`) {
      failures.push({ method, path, status, message });
    },
    /** Simulate the server forgetting the session (expiry, logout elsewhere). */
    expireSession() {
      session = null;
    },
  };
}

export function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "1",
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    assignee: null,
    due_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
