import type { NewTask, Task, TaskList, TaskStatus } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Typed fetch wrapper: throws ApiError with the server's message on failure. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = body?.error?.details?.map((d: { message: string }) => d.message).join(", ");
    throw new ApiError(res.status, details || body?.error?.message || `HTTP ${res.status}`);
  }
  return body as T;
}

export interface ListParams {
  status?: TaskStatus | "";
  q?: string;
  sort?: "created_at" | "due_date" | "priority";
}

export const api = {
  list(params: ListParams = {}): Promise<TaskList> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    qs.set("limit", "100");
    return request<TaskList>(`/tasks?${qs}`);
  },
  stats: () => request<Record<TaskStatus, number>>("/tasks/stats"),
  create: (task: NewTask) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(task) }),
  update: (id: string, patch: Partial<NewTask>) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
};
