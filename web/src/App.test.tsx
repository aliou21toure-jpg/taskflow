import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Task } from "./types";

/** A tiny in-memory fake of the API, installed in place of fetch. */
function installFakeApi(initial: Task[] = []) {
  let tasks = [...initial];
  const json = (body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), { status });

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname === "/tasks/stats") {
      const s = { todo: 0, in_progress: 0, done: 0 };
      tasks.forEach((t) => s[t.status]++);
      return json(s);
    }
    if (url.pathname === "/tasks" && method === "GET") {
      return json({ items: tasks, total: tasks.length, limit: 100, offset: 0 });
    }
    if (url.pathname === "/tasks" && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const task = makeTask({ ...body, id: crypto.randomUUID() });
      tasks = [task, ...tasks];
      return json(task, 201);
    }
    const id = url.pathname.split("/")[2]!;
    if (method === "PATCH") {
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...JSON.parse(String(init?.body)) } : t));
      return json(tasks.find((t) => t.id === id));
    }
    if (method === "DELETE") {
      tasks = tasks.filter((t) => t.id !== id);
      return json(null, 204);
    }
    return json({ error: { message: "not found" } }, 404);
  }) as typeof fetch;
}

function makeTask(overrides: Partial<Task>): Task {
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

describe("App", () => {
  beforeEach(() => installFakeApi([makeTask({ id: "a", title: "Existing task" })]));

  it("shows tasks from the API", async () => {
    render(<App />);
    expect(await screen.findByText("Existing task")).toBeInTheDocument();
  });

  it("creates a task", async () => {
    render(<App />);
    await screen.findByText("Existing task");
    await userEvent.type(screen.getByLabelText("Task title"), "Write README");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByText("Write README")).toBeInTheDocument();
  });

  it("changes status and deletes", async () => {
    render(<App />);
    await screen.findByText("Existing task");
    await userEvent.selectOptions(screen.getByLabelText("Status of Existing task"), "done");
    await waitFor(() => expect(screen.getByLabelText("Task counts")).toHaveTextContent("1 Done"));
    await userEvent.click(screen.getByLabelText("Delete Existing task"));
    expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument();
  });

  it("shows API errors", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 500 })) as typeof fetch;
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 500");
  });
});
