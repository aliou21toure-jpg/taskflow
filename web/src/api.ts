import type { NewTask, Task, TaskList, TaskPatch, TaskStatus, User } from "./types";

// The API is served from the same origin under /api (Vite proxy in dev, nginx in Docker,
// a rewrite on Vercel), so the session cookie is first-party and no CORS is involved.
const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Typed fetch wrapper: throws ApiError with the server's message on failure. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
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

export interface Credentials {
  email: string;
  password: string;
}

export const api = {
  me: () => request<{ user: User }>("/auth/me").then((r) => r.user),
  login: (c: Credentials) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify(c) }).then((r) => r.user),
  register: (c: Credentials) =>
    request<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify(c) }).then((r) => r.user),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  list(params: ListParams = {}): Promise<TaskList> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    qs.set("limit", "100");
    return request<TaskList>(`/tasks?${qs}`);
  },
  stats: () => request<Record<TaskStatus, number>>("/tasks/stats"),
  create: (task: NewTask) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(task) }),
  update: (id: string, patch: TaskPatch) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
};
